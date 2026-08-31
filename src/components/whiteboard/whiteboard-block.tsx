import * as React from "react";
import { cn } from "../../lib/cn";
import {
  DEFAULT_BOARD_VIEW,
  boardBounds,
  boardUid,
  fitView,
  hitTest,
  penPath,
  shapeBounds,
  shapesInRect,
  thinPoints,
  toBoard,
  translateShapes,
  zoomAt,
  type BoardShape,
  type BoardView,
  type BoardPoint,
  type ShapeKind,
} from "../../lib/whiteboard";
import { Icon, type IconName } from "../core/icon";

export interface Whiteboard {
  shapes: BoardShape[];
  /** The region the thumbnail crops to. Without it the thumbnail fits all. */
  frame?: { x: number; y: number; w: number; h: number };
}

export interface WhiteboardBlockProps {
  value: Whiteboard;
  onChange?: (next: Whiteboard) => void;
  readOnly?: boolean;
  height?: number;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

type Tool = "select" | "pan" | "pen" | "rect" | "ellipse" | "arrow" | "line" | "text" | "note" | "erase";

const TOOLS: { id: Tool; icon: IconName; label: string; key: string }[] = [
  { id: "select", icon: "mouse-pointer-2", label: "Select", key: "v" },
  { id: "pan", icon: "hand", label: "Pan (or hold space)", key: "h" },
  { id: "pen", icon: "pen-line", label: "Pen", key: "p" },
  { id: "rect", icon: "square", label: "Rectangle", key: "r" },
  { id: "ellipse", icon: "circle", label: "Ellipse", key: "o" },
  { id: "arrow", icon: "arrow-right", label: "Arrow", key: "a" },
  { id: "line", icon: "minus", label: "Line", key: "l" },
  { id: "text", icon: "type", label: "Text", key: "t" },
  { id: "note", icon: "sticky-note", label: "Sticky note", key: "n" },
  { id: "erase", icon: "eraser", label: "Eraser", key: "e" },
];

/** Strokes and fills. The first stroke follows the theme; the rest are fixed
 *  ink the author chose, and stay put in both régimes on purpose. */
const STROKES = [
  "var(--color-text-primary)",
  "var(--color-error)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-warning)",
];

const FILLS: (string | null)[] = [
  null,
  "var(--color-accent)",
  "var(--color-mist)",
  "var(--color-warning-soft)",
  "var(--color-error-soft)",
];

const TWO_POINT: ShapeKind[] = ["rect", "ellipse", "arrow", "line"];

/**
 * An unbounded drawing surface.
 *
 * THE THUMBNAIL IS A CROP, NOT A SCALE. A board grows past its frame as soon
 * as anyone uses it, and shrinking the whole thing to fit turns a diagram into
 * an illegible smudge in the document that embeds it. The author frames the
 * part that matters and the rest keeps existing off-screen.
 */
export function WhiteboardBlock({
  value,
  onChange,
  readOnly = false,
  height = 320,
  labels,
  className,
}: WhiteboardBlockProps) {
  const text = {
    edit: "Edit",
    done: "Done",
    empty: "Empty whiteboard",
    emptyHint: "“Edit” opens the unbounded canvas",
    objects: "objects",
    frame: "framed thumbnail",
    setFrame: "Frame the thumbnail",
    clearFrame: "Clear the frame",
    fit: "Fit to content",
    actual: "Actual size",
    undo: "Undo",
    clear: "Clear the board",
    ...labels,
  };

  const [editing, setEditing] = React.useState(false);
  const shapes = value.shapes ?? [];

  return (
    <div className={cn("flex flex-col gap-1.5 font-sans", className)}>
      <div className="relative overflow-hidden rounded-card border border-border-subtle bg-surface-page">
        <BoardSurface value={value} height={height} readOnly />

        {!readOnly ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="absolute right-2.5 top-2.5 inline-flex h-7 items-center gap-1.5 rounded-pill border-none bg-action-secondary-bg/80 px-3 font-sans text-[12.5px] text-action-secondary-fg backdrop-blur-sm halo-focus"
          >
            <Icon name="maximize-2" size={12} />
            {text.edit}
          </button>
        ) : null}

        {!shapes.length ? (
          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-[13.5px] text-text-secondary">{text.empty}</span>
            {!readOnly ? (
              <span className="text-[12px] text-text-secondary opacity-75">{text.emptyHint}</span>
            ) : null}
          </span>
        ) : null}
      </div>

      <span className="flex items-center gap-2 text-[12px] text-text-secondary">
        <Icon name="pencil-ruler" size={12} />
        {shapes.length} {text.objects}
        {value.frame ? ` · ${text.frame}` : ""}
      </span>

      {editing ? (
        <BoardEditor
          value={value}
          labels={text}
          onClose={() => setEditing(false)}
          onApply={(next) => {
            onChange?.(next);
            setEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Renders the board. Read-only in the block, interactive in the editor. */
function BoardSurface({
  value,
  height,
  readOnly,
  view: viewProp,
  selected = [],
  draft,
  marquee,
  onPointerDown,
  hostRef,
}: {
  value: Whiteboard;
  height: number;
  readOnly?: boolean;
  view?: BoardView;
  selected?: string[];
  draft?: BoardShape | null;
  marquee?: { x: number; y: number; w: number; h: number } | null;
  onPointerDown?: (event: React.PointerEvent) => void;
  hostRef?: React.Ref<HTMLDivElement>;
}) {
  const shapes = value.shapes ?? [];
  const [measured, setMeasured] = React.useState({ width: 640, height });
  const own = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = own.current;
    if (!element || viewProp) return;

    const update = () =>
      setMeasured({ width: element.clientWidth || 640, height: element.clientHeight || height });
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewProp, height]);

  // A read-only surface fits its content (or its frame); the editor drives the
  // view itself.
  const view =
    viewProp ?? fitView(value.frame ?? boardBounds(shapes), measured, value.frame ? 8 : 24);

  return (
    <div
      ref={hostRef ?? own}
      onPointerDown={onPointerDown}
      className={cn("relative w-full touch-none select-none overflow-hidden", !readOnly && "cursor-crosshair")}
      style={{ height }}
    >
      <svg width="100%" height={height} className="block">
        <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
          {shapes.map((shape) => (
            <ShapeMark key={shape.id} shape={shape} selected={selected.includes(shape.id)} />
          ))}
          {draft ? <ShapeMark shape={draft} selected={false} /> : null}

          {selected.length
            ? selected.map((id) => {
                const shape = shapes.find((entry) => entry.id === id);
                if (!shape) return null;
                const box = shapeBounds(shape);
                return (
                  <rect
                    key={`sel-${id}`}
                    x={box.x - 4}
                    y={box.y - 4}
                    width={box.w + 8}
                    height={box.h + 8}
                    fill="none"
                    stroke="var(--color-accent-deep)"
                    strokeWidth={1.5 / view.z}
                    strokeDasharray={`${4 / view.z} ${3 / view.z}`}
                  />
                );
              })
            : null}

          {marquee ? (
            <rect
              x={Math.min(marquee.x, marquee.x + marquee.w)}
              y={Math.min(marquee.y, marquee.y + marquee.h)}
              width={Math.abs(marquee.w)}
              height={Math.abs(marquee.h)}
              fill="color-mix(in srgb, var(--color-accent) 14%, transparent)"
              stroke="var(--color-accent-deep)"
              strokeWidth={1.5 / view.z}
            />
          ) : null}
        </g>
      </svg>
    </div>
  );
}

function ShapeMark({ shape, selected }: { shape: BoardShape; selected: boolean }) {
  const stroke = shape.stroke ?? STROKES[0]!;
  const width = shape.width ?? 2;
  const box = shapeBounds(shape);

  if (shape.kind === "pen") {
    return (
      <path
        d={penPath(shape.points ?? [])}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  if (shape.kind === "note") {
    return (
      <g>
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={2}
          fill={shape.fill ?? "var(--color-accent)"}
          // A note's text is always ink: the fill is a fixed colour, so a
          // theme-following foreground would go unreadable in one régime.
          stroke="none"
        />
        <foreignObject x={box.x} y={box.y} width={box.w} height={box.h}>
          <div
            className="size-full overflow-hidden p-2.5 font-sans text-[13px] leading-snug"
            style={{ color: "var(--color-accent-ink)" }}
          >
            {shape.text}
          </div>
        </foreignObject>
      </g>
    );
  }

  if (shape.kind === "text") {
    return (
      <foreignObject x={box.x} y={box.y} width={box.w} height={box.h}>
        <div className="font-sans text-[15px] leading-snug" style={{ color: stroke }}>
          {shape.text}
        </div>
      </foreignObject>
    );
  }

  if (shape.kind === "ellipse") {
    return (
      <ellipse
        cx={box.x + box.w / 2}
        cy={box.y + box.h / 2}
        rx={box.w / 2}
        ry={box.h / 2}
        fill={shape.fill ?? "none"}
        stroke={stroke}
        strokeWidth={width}
      />
    );
  }

  if (shape.kind === "line" || shape.kind === "arrow") {
    const x2 = shape.x2 ?? shape.x;
    const y2 = shape.y2 ?? shape.y;
    return (
      <g>
        <line
          x1={shape.x}
          y1={shape.y}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
        />
        {shape.kind === "arrow" ? <ArrowHead from={shape} to={{ x: x2, y: y2 }} colour={stroke} /> : null}
      </g>
    );
  }

  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.w}
      height={box.h}
      rx={4}
      fill={shape.fill ?? "none"}
      stroke={stroke}
      strokeWidth={width}
    />
  );
}

/** The head of an arrow, rotated to its own direction. */
function ArrowHead({ from, to, colour }: { from: BoardPoint; to: BoardPoint; colour: string }) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 10;

  const wing = (offset: number) => ({
    x: to.x - Math.cos(angle - offset) * size,
    y: to.y - Math.sin(angle - offset) * size,
  });

  const left = wing(0.4);
  const right = wing(-0.4);

  return (
    <polygon points={`${to.x},${to.y} ${left.x},${left.y} ${right.x},${right.y}`} fill={colour} />
  );
}

/** The full-screen editor. */
function BoardEditor({
  value,
  labels,
  onClose,
  onApply,
}: {
  value: Whiteboard;
  labels: Record<string, string>;
  onClose: () => void;
  onApply: (next: Whiteboard) => void;
}) {
  const [draft, setDraft] = React.useState<Whiteboard>(() => ({
    shapes: [...(value.shapes ?? [])],
    frame: value.frame,
  }));
  const [past, setPast] = React.useState<Whiteboard[]>([]);
  const [tool, setTool] = React.useState<Tool>("select");
  const [stroke, setStroke] = React.useState(STROKES[0]!);
  const [fill, setFill] = React.useState<string | null>(null);
  const [view, setView] = React.useState<BoardView>(DEFAULT_BOARD_VIEW);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [drawing, setDrawing] = React.useState<BoardShape | null>(null);
  const [marquee, setMarquee] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [space, setSpace] = React.useState(false);

  const host = React.useRef<HTMLDivElement>(null);
  const gesture = React.useRef<{ kind: "draw" | "move" | "pan" | "marquee"; from: BoardPoint; screen: BoardPoint; view: BoardView } | null>(null);

  const active: Tool = space ? "pan" : tool;

  const commit = (next: Whiteboard) => {
    setPast((current) => [...current.slice(-40), draft]);
    setDraft(next);
  };

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (["INPUT", "TEXTAREA"].includes(target?.tagName?.toUpperCase() ?? "")) return;

      if (event.code === "Space") {
        event.preventDefault();
        setSpace(true);
        return;
      }
      if (event.key === "Escape") {
        onClose();
        return;
      }

      const match = TOOLS.find((entry) => entry.key === event.key.toLowerCase());
      if (match) setTool(match.id);

      if ((event.key === "Delete" || event.key === "Backspace") && selected.length) {
        event.preventDefault();
        commit({ ...draft, shapes: draft.shapes.filter((shape) => !selected.includes(shape.id)) });
        setSelected([]);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpace(false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, selected, onClose]);

  const pointAt = (event: { clientX: number; clientY: number }): BoardPoint => {
    const rect = host.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return toBoard({ x: event.clientX - rect.left, y: event.clientY - rect.top }, view);
  };

  const start = (event: React.PointerEvent) => {
    const point = pointAt(event);
    const screen = { x: event.clientX, y: event.clientY };

    if (active === "pan") {
      gesture.current = { kind: "pan", from: point, screen, view };
      return;
    }

    if (active === "erase") {
      const hit = [...draft.shapes].reverse().find((shape) => hitTest(shape, point));
      if (hit) commit({ ...draft, shapes: draft.shapes.filter((shape) => shape.id !== hit.id) });
      return;
    }

    if (active === "select") {
      const hit = [...draft.shapes].reverse().find((shape) => hitTest(shape, point));
      if (hit) {
        setSelected(event.shiftKey ? [...new Set([...selected, hit.id])] : [hit.id]);
        gesture.current = { kind: "move", from: point, screen, view };
      } else {
        setSelected([]);
        setMarquee({ x: point.x, y: point.y, w: 0, h: 0 });
        gesture.current = { kind: "marquee", from: point, screen, view };
      }
      return;
    }

    if (active === "text" || active === "note") {
      const created: BoardShape = {
        id: boardUid(),
        kind: active,
        x: point.x,
        y: point.y,
        text: active === "note" ? "Note" : "Text",
        stroke,
        fill: active === "note" ? (fill ?? "var(--color-accent)") : undefined,
      };
      commit({ ...draft, shapes: [...draft.shapes, created] });
      setSelected([created.id]);
      setTool("select");
      return;
    }

    const created: BoardShape =
      active === "pen"
        ? { id: boardUid(), kind: "pen", x: point.x, y: point.y, points: [point], stroke, width: 2 }
        : {
            id: boardUid(),
            kind: active as ShapeKind,
            x: point.x,
            y: point.y,
            x2: point.x,
            y2: point.y,
            stroke,
            fill,
            width: 2,
          };

    setDrawing(created);
    gesture.current = { kind: "draw", from: point, screen, view };
  };

  React.useEffect(() => {
    if (!gesture.current) return;

    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current) return;
      const point = pointAt(event);

      if (current.kind === "pan") {
        setView({
          ...current.view,
          x: current.view.x + (event.clientX - current.screen.x),
          y: current.view.y + (event.clientY - current.screen.y),
        });
        return;
      }

      if (current.kind === "marquee") {
        setMarquee({ x: current.from.x, y: current.from.y, w: point.x - current.from.x, h: point.y - current.from.y });
        return;
      }

      if (current.kind === "move") {
        const dx = point.x - current.from.x;
        const dy = point.y - current.from.y;
        setDraft((state) => ({
          ...state,
          shapes: translateShapes(state.shapes, selected, dx, dy),
        }));
        current.from = point;
        return;
      }

      setDrawing((shape) => {
        if (!shape) return shape;
        if (shape.kind === "pen") {
          return { ...shape, points: [...(shape.points ?? []), point] };
        }
        return { ...shape, x2: point.x, y2: point.y };
      });
    };

    const up = () => {
      const current = gesture.current;
      gesture.current = null;

      if (current?.kind === "marquee" && marquee) {
        setSelected(shapesInRect(draft.shapes, marquee).map((shape) => shape.id));
        setMarquee(null);
        return;
      }

      if (current?.kind === "draw" && drawing) {
        const finished =
          drawing.kind === "pen"
            ? { ...drawing, points: thinPoints(drawing.points ?? []) }
            : drawing;

        const box = shapeBounds(finished);
        // A click that did not drag is not a shape: a zero-sized rectangle is
        // invisible and un-selectable, so it would be litter.
        const meaningful =
          finished.kind === "pen" ? (finished.points?.length ?? 0) > 1 : box.w > 2 || box.h > 2;

        if (meaningful) commit({ ...draft, shapes: [...draft.shapes, finished] });
        setDrawing(null);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((current) => current.slice(0, -1));
    setDraft(previous);
  };

  return (
    <div className="fixed inset-0 z-1000 flex flex-col bg-surface-page font-sans">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2.5">
        <span className="inline-flex gap-0.5 rounded-pill bg-mist p-0.75">
          {TOOLS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={`${entry.label} (${entry.key.toUpperCase()})`}
              aria-label={entry.label}
              aria-pressed={active === entry.id}
              onClick={() => setTool(entry.id)}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-pill border-none halo-focus",
                "transition-colors duration-[140ms] ease-standard",
                active === entry.id
                  ? "bg-surface-card text-text-primary"
                  : "bg-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              <Icon name={entry.icon} size={14} />
            </button>
          ))}
        </span>

        <span className="inline-flex gap-1 border-l border-hairline pl-2">
          {STROKES.map((colour) => (
            <button
              key={colour}
              type="button"
              aria-label="Stroke colour"
              aria-pressed={stroke === colour}
              onClick={() => setStroke(colour)}
              className={cn(
                "size-6 rounded-full border-2 halo-focus",
                stroke === colour ? "border-accent-deep" : "border-transparent",
              )}
              style={{ background: colour }}
            />
          ))}
        </span>

        <span className="inline-flex gap-1 border-l border-hairline pl-2">
          {FILLS.map((colour, index) => (
            <button
              key={index}
              type="button"
              aria-label="Fill colour"
              aria-pressed={fill === colour}
              onClick={() => setFill(colour)}
              className={cn(
                "size-6 rounded-full border-2 halo-focus",
                fill === colour ? "border-accent-deep" : "border-border-subtle",
              )}
              style={{
                // "No fill" is a hatch: an empty swatch reads as white.
                background:
                  colour ??
                  "repeating-linear-gradient(45deg,var(--color-surface-alt) 0 4px,transparent 4px 8px)",
              }}
            />
          ))}
        </span>

        <span className="ml-auto inline-flex items-center gap-1.5">
          <ToolbarButton icon="undo-2" label={labels.undo!} onClick={undo} disabled={!past.length} />
          <ToolbarButton
            icon="maximize"
            label={labels.fit!}
            onClick={() => {
              const rect = host.current?.getBoundingClientRect();
              if (rect) setView(fitView(boardBounds(draft.shapes), { width: rect.width, height: rect.height }));
            }}
          />
          <ToolbarButton
            icon="crop"
            label={draft.frame ? labels.clearFrame! : labels.setFrame!}
            on={Boolean(draft.frame)}
            onClick={() =>
              setDraft((state) => ({
                ...state,
                // Framing the current selection, or the whole board.
                frame: state.frame
                  ? undefined
                  : (boardBounds(
                      selected.length
                        ? state.shapes.filter((shape) => selected.includes(shape.id))
                        : state.shapes,
                    ) ?? undefined),
              }))
            }
          />
          <ToolbarButton
            icon="trash-2"
            label={labels.clear!}
            tone="error"
            onClick={() => commit({ shapes: [] })}
          />

          <button
            type="button"
            onClick={() => onApply(draft)}
            className="ml-1 inline-flex h-8 items-center rounded-pill border-none bg-accent px-4 font-sans text-[13px] font-medium text-accent-ink halo-focus"
          >
            {labels.done}
          </button>
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <BoardSurface
          value={draft}
          height={0}
          view={view}
          selected={selected}
          draft={drawing}
          marquee={marquee}
          onPointerDown={start}
          hostRef={host}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-hairline px-3 py-2 text-[12px] text-text-secondary">
        <span>
          {draft.shapes.length} {labels.objects} · scroll to zoom · space to pan · Del to remove
        </span>
        <span className="ml-auto tabular-nums">{Math.round(view.z * 100)} %</span>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  on,
  tone,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  on?: boolean;
  tone?: "error";
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7.5 items-center justify-center rounded-lg border border-border-subtle bg-transparent halo-focus",
        on ? "border-accent-deep bg-accent text-accent-ink" : "text-text-primary hover:bg-surface-alt",
        tone === "error" && !on && "hover:text-error",
        disabled && "opacity-40",
      )}
    >
      <Icon name={icon} size={13} />
    </button>
  );
}
