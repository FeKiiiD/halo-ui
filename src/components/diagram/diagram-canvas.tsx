import * as React from "react";
import { cn } from "../../lib/cn";
import {
  ALIGNMENTS,
  FILLS,
  GRID,
  SHAPES,
  anchorPoint,
  bounds,
  duplicateShapes,
  expandSelection,
  linkGeometry,
  midpoint,
  newShape,
  removeShapes,
  routePath,
  snap,
  uid,
  type Diagram,
  type Link,
  type Shape,
  type ShapeType,
  type Side,
} from "../../lib/diagram";
import { Icon, type IconName } from "../core/icon";

export interface DiagramView {
  x: number;
  y: number;
  /** Zoom. 1 is actual size. */
  k: number;
}

export type DiagramTool = "select" | "pan" | `shape:${ShapeType}`;

export interface DiagramCanvasProps {
  shapes: Shape[];
  links: Link[];
  onChange?: (next: Diagram) => void;

  selected?: string[];
  onSelect?: (ids: string[]) => void;
  /** Id of the shape whose text is being edited. */
  editing?: string | null;
  onEditing?: (id: string | null) => void;

  tool?: DiagramTool;
  onToolChange?: (tool: DiagramTool) => void;

  gridOn?: boolean;
  snapOn?: boolean;

  view: DiagramView;
  onView: (view: DiagramView) => void;

  height?: number | string;
  readOnly?: boolean;
  labels?: {
    connect?: string;
    locked?: string;
    editText?: string;
    duplicate?: string;
    group?: string;
    ungroup?: string;
    lock?: string;
    unlock?: string;
    bringToFront?: string;
    sendToBack?: string;
    delete?: string;
    selectAll?: string;
    unlockAll?: string;
    actualSize?: string;
    zoomIn?: string;
    zoomOut?: string;
  };
  className?: string;
}

const HANDLES: { id: string; x: number; y: number; cursor: string }[] = [
  { id: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { id: "n", x: 0.5, y: 0, cursor: "ns-resize" },
  { id: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { id: "e", x: 1, y: 0.5, cursor: "ew-resize" },
  { id: "se", x: 1, y: 1, cursor: "nwse-resize" },
  { id: "s", x: 0.5, y: 1, cursor: "ns-resize" },
  { id: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { id: "w", x: 0, y: 0.5, cursor: "ew-resize" },
];

const SIDES: Side[] = ["top", "right", "bottom", "left"];

const MIN_W = 48;
const MIN_H = 36;

type Drag =
  | { kind: "pan"; x: number; y: number; view: DiagramView }
  | { kind: "move"; px: number; py: number; origin: Record<string, { x: number; y: number }> }
  | {
      kind: "resize";
      id: string;
      handle: string;
      px: number;
      py: number;
      origin: { x: number; y: number; w: number; h: number };
    };

/**
 * Shapes, text and connectors on an unbounded surface.
 *
 * UNLIKE THE FLOW CANVAS THERE ARE NO RULES. No typed nodes, no ports, no
 * execution order — anything links to anything, or to nothing at all. That is
 * the point: a diagram is for thinking, and a canvas that refuses an
 * ill-formed drawing refuses the drawing you make while working out what you
 * mean.
 *
 * Shapes are HTML boxes with CSS silhouettes rather than SVG paths, so the
 * text inside wraps, selects and edits like text.
 */
export function DiagramCanvas({
  shapes,
  links,
  onChange,
  selected = [],
  onSelect,
  editing,
  onEditing,
  tool = "select",
  onToolChange,
  gridOn = true,
  snapOn = true,
  view,
  onView,
  height = 560,
  readOnly = false,
  labels,
  className,
}: DiagramCanvasProps) {
  const text = {
    connect: "Drag to connect",
    locked: "Locked",
    editText: "Edit text",
    duplicate: "Duplicate",
    group: "Group",
    ungroup: "Ungroup",
    lock: "Lock",
    unlock: "Unlock",
    bringToFront: "Bring to front",
    sendToBack: "Send to back",
    delete: "Delete",
    selectAll: "Select all",
    unlockAll: "Unlock all",
    actualSize: "Actual size",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    ...labels,
  };

  const box = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const [band, setBand] = React.useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const [wire, setWire] = React.useState<{ from: string; ox: number; oy: number; x: number; y: number } | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);
  const [hoverLink, setHoverLink] = React.useState<string | null>(null);
  const [space, setSpace] = React.useState(false);
  const [menu, setMenu] = React.useState<{ x: number; y: number; ids: string[] } | null>(null);

  const mode: DiagramTool = space ? "pan" : tool;
  const byId = React.useMemo(
    () => Object.fromEntries(shapes.map((shape) => [shape.id, shape])) as Record<string, Shape>,
    [shapes],
  );

  const commit = (next: Diagram) => onChange?.(next);

  const patch = (ids: string[], change: (shape: Shape) => Partial<Shape>) =>
    commit({
      shapes: shapes.map((shape) => (ids.includes(shape.id) ? { ...shape, ...change(shape) } : shape)),
      links,
    });

  const remove = (ids: string[]) => commit(removeShapes(ids, { shapes, links }));

  const expand = (ids: string[]) => expandSelection(ids, shapes);

  const duplicate = (ids: string[]) => {
    const { diagram, created } = duplicateShapes(ids, { shapes, links });
    commit(diagram);
    onSelect?.(created);
  };

  const setOrder = (ids: string[], direction: "front" | "back") => {
    const picked = shapes.filter((shape) => ids.includes(shape.id));
    const rest = shapes.filter((shape) => !ids.includes(shape.id));
    commit({ shapes: direction === "front" ? [...rest, ...picked] : [...picked, ...rest], links });
  };

  const align = (ids: string[], id: string) => {
    const alignment = ALIGNMENTS.find((entry) => entry.id === id);
    const region = bounds(shapes.filter((shape) => ids.includes(shape.id)));
    if (!alignment || !region) return;
    patch(ids, (shape) => alignment.apply(shape, region));
  };

  /* --- keyboard --------------------------------------------------------- */

  // Read inside the listener so it does not need rebinding on every change.
  const state = React.useRef({ selected, shapes, links, readOnly, byId });
  state.current = { selected, shapes, links, readOnly, byId };

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase() ?? "";

      // Never steal a key from a field or from text being edited.
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || target?.isContentEditable) return;

      if (event.code === "Space") {
        event.preventDefault();
        setSpace(true);
      }

      const current = state.current;
      if (current.readOnly) return;

      const key = event.key.toLowerCase();
      const meta = event.metaKey || event.ctrlKey;

      if (key === "v") onToolChange?.("select");
      if (key === "h") onToolChange?.("pan");

      if (event.key === "Escape") {
        onSelect?.([]);
        onEditing?.(null);
      }

      if ((event.key === "Delete" || event.key === "Backspace") && current.selected.length) {
        event.preventDefault();
        remove(current.selected.filter((id) => !current.byId[id]?.locked));
      }

      if (meta && key === "d" && current.selected.length) {
        event.preventDefault();
        duplicate(current.selected);
      }

      if (meta && key === "a") {
        event.preventDefault();
        onSelect?.(current.shapes.map((shape) => shape.id));
      }

      if (meta && key === "g" && current.selected.length > 1) {
        event.preventDefault();
        const group = event.shiftKey ? undefined : uid("g");
        commit({
          shapes: current.shapes.map((shape) =>
            current.selected.includes(shape.id) ? { ...shape, group } : shape,
          ),
          links: current.links,
        });
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
  }, []);

  React.useEffect(() => {
    if (!menu) return;
    const away = () => setMenu(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [menu]);

  /* --- pointer ---------------------------------------------------------- */

  /** Screen point to diagram coordinates. */
  const at = (event: { clientX: number; clientY: number }) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left - view.x) / view.k,
      y: (event.clientY - rect.top - view.y) / view.k,
    };
  };

  const surfaceDown = (event: React.PointerEvent) => {
    // Middle button pans regardless of tool: it is the one gesture people
    // expect to work everywhere.
    if (event.button === 1 || mode === "pan") {
      setDrag({ kind: "pan", x: event.clientX, y: event.clientY, view: { ...view } });
      return;
    }

    if (mode.startsWith("shape:") && !readOnly) {
      const type = mode.slice(6) as ShapeType;
      const point = at(event);
      const shape = newShape(type, snap(point.x, snapOn), snap(point.y, snapOn));

      commit({ shapes: [...shapes, shape], links });
      onSelect?.([shape.id]);
      onEditing?.(shape.id);
      // Back to select: a tool that stays armed drops a second shape on the
      // next click, which is never intended.
      onToolChange?.("select");
      return;
    }

    const target = event.target as HTMLElement;
    if (event.target === event.currentTarget || target.dataset.surface) {
      onSelect?.([]);
      onEditing?.(null);
      const point = at(event);
      setBand({ x0: point.x, y0: point.y, x: point.x, y: point.y });
    }
  };

  React.useEffect(() => {
    if (!drag && !band && !wire) return;

    const move = (event: PointerEvent) => {
      if (drag?.kind === "pan") {
        onView({
          ...view,
          x: drag.view.x + (event.clientX - drag.x),
          y: drag.view.y + (event.clientY - drag.y),
        });
        return;
      }

      const point = at(event);

      if (band) {
        setBand((current) => (current ? { ...current, x: point.x, y: point.y } : current));
        return;
      }
      if (wire) {
        setWire((current) => (current ? { ...current, x: point.x, y: point.y } : current));
        return;
      }

      if (drag?.kind === "move") {
        const dx = point.x - drag.px;
        const dy = point.y - drag.py;

        commit({
          shapes: shapes.map((shape) => {
            const origin = drag.origin[shape.id];
            return origin
              ? { ...shape, x: snap(origin.x + dx, snapOn), y: snap(origin.y + dy, snapOn) }
              : shape;
          }),
          links,
        });
      }

      if (drag?.kind === "resize") {
        const origin = drag.origin;
        const handle = drag.handle;
        const dx = point.x - drag.px;
        const dy = point.y - drag.py;

        let { x, y, w, h } = origin;

        if (handle.includes("e")) w = Math.max(MIN_W, origin.w + dx);
        if (handle.includes("s")) h = Math.max(MIN_H, origin.h + dy);
        // A west or north handle moves the origin as well as the size, and the
        // minimum has to be applied before the origin is derived or the shape
        // walks away as it hits the floor.
        if (handle.includes("w")) {
          w = Math.max(MIN_W, origin.w - dx);
          x = origin.x + origin.w - w;
        }
        if (handle.includes("n")) {
          h = Math.max(MIN_H, origin.h - dy);
          y = origin.y + origin.h - h;
        }

        patch([drag.id], () => ({
          x: snap(x, snapOn),
          y: snap(y, snapOn),
          w: snap(w, snapOn),
          h: snap(h, snapOn),
        }));
      }
    };

    const up = (event: PointerEvent) => {
      if (band) {
        const region = {
          x: Math.min(band.x0, band.x),
          y: Math.min(band.y0, band.y),
          w: Math.abs(band.x - band.x0),
          h: Math.abs(band.y - band.y0),
        };

        // A few px is a click, not a marquee.
        if (region.w > 6 && region.h > 6) {
          const hit = shapes.filter(
            (shape) =>
              !shape.locked &&
              shape.x < region.x + region.w &&
              shape.x + shape.w > region.x &&
              shape.y < region.y + region.h &&
              shape.y + shape.h > region.y,
          );
          onSelect?.(expand(hit.map((shape) => shape.id)));
        }
        setBand(null);
      }

      if (wire) {
        // elementFromPoint rather than a pointerup on the target: the wire
        // overlay sits above every shape, so the shape never receives it.
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const host = element?.closest<HTMLElement>("[data-shape]");
        const to = host?.dataset.shape;

        if (
          to &&
          to !== wire.from &&
          !links.some((link) => link.from === wire.from && link.to === to)
        ) {
          commit({
            shapes,
            links: [...links, { id: uid("l"), from: wire.from, to, style: "elbow" }],
          });
        }
        setWire(null);
      }

      setDrag(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, band, wire, shapes, links, view, snapOn]);

  const wheel = (event: React.WheelEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      // Zoom about the pointer, not the origin: zooming towards the corner of
      // the canvas is disorienting on a surface with no edges.
      const k = Math.min(2.5, Math.max(0.25, view.k * (event.deltaY > 0 ? 0.92 : 1.08)));
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      onView({
        k,
        x: mx - ((mx - view.x) / view.k) * k,
        y: my - ((my - view.y) / view.k) * k,
      });
    } else {
      onView({ ...view, x: view.x - event.deltaX, y: view.y - event.deltaY });
    }
  };

  /* --- render ----------------------------------------------------------- */

  // Frames paint behind everything. Keyed on the shape's TYPE — the source
  // looked this up by id, which is never a shape type, so a frame always
  // landed in the foreground and covered the diagram it was framing.
  const behind = shapes.filter((shape) => SHAPES[shape.type]?.back);
  const inFront = shapes.filter((shape) => !SHAPES[shape.type]?.back);

  const paths = links
    .map((link) => {
      const geometry = linkGeometry(link, byId);
      if (!geometry) return null;
      return {
        link,
        d: routePath(geometry.from, geometry.to, link.style ?? "elbow"),
        mid: midpoint(geometry.from, geometry.to),
      };
    })
    .filter((entry): entry is { link: Link; d: string; mid: { x: number; y: number } } =>
      Boolean(entry),
    );

  const renderShape = (shape: Shape) => {
    const spec = SHAPES[shape.type] ?? SHAPES.rect;
    const fill = FILLS[shape.fill ?? "paper"] ?? FILLS.paper;
    const on = selected.includes(shape.id);
    const isEditing = editing === shape.id;
    const pad = spec.pad ?? 14;

    return (
      <div
        key={shape.id}
        data-shape={shape.id}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (readOnly || mode === "pan" || mode.startsWith("shape:")) return;
          event.stopPropagation();

          const point = at(event);
          const base = on ? selected : event.shiftKey ? [...selected, shape.id] : [shape.id];
          const ids = expand(base);
          onSelect?.(ids);

          if (shape.locked) return;

          const origin: Record<string, { x: number; y: number }> = {};
          for (const id of ids) {
            const target = byId[id];
            if (target && !target.locked) origin[id] = { x: target.x, y: target.y };
          }
          setDrag({ kind: "move", px: point.x, py: point.y, origin });
        }}
        onDoubleClick={(event) => {
          if (readOnly || shape.locked) return;
          event.stopPropagation();
          onEditing?.(shape.id);
        }}
        onContextMenu={(event) => {
          if (readOnly) return;
          event.preventDefault();
          event.stopPropagation();
          const ids = on ? selected : expand([shape.id]);
          onSelect?.(ids);
          setMenu({ x: event.clientX, y: event.clientY, ids });
        }}
        onMouseEnter={() => setHover(shape.id)}
        onMouseLeave={() => setHover((current) => (current === shape.id ? null : current))}
        className={cn(
          "absolute box-border flex font-sans leading-[1.32] tracking-[-0.01em]",
          on && "outline-2 outline-offset-2 outline-accent-deep",
          readOnly ? "cursor-default" : mode === "pan" ? "cursor-grab" : "cursor-move",
        )}
        style={{
          left: shape.x,
          top: shape.y,
          width: shape.w,
          height: shape.h,
          padding: pad,
          color: fill.fg,
          fontSize: shape.fontSize ?? 15,
          fontWeight: shape.bold ? 600 : 400,
          textAlign: shape.align ?? "center",
          alignItems:
            shape.valign === "top" ? "flex-start" : shape.valign === "bottom" ? "flex-end" : "center",
          justifyContent:
            shape.align === "left" ? "flex-start" : shape.align === "right" ? "flex-end" : "center",
          borderRadius: spec.css?.borderRadius,
          animation: "halo-diagram-in 160ms var(--ease-standard) both",
        }}
      >
        {/* The silhouette is a separate layer so the clip path never cuts the
            text, only the fill.

            A CLIPPED SHAPE CANNOT USE A BORDER. clip-path cuts at the very
            edge of the box, which is exactly where a border is drawn, so the
            outline disappeared entirely — invisibly on a diamond whose fill
            matched the surface, which is the common case. Clipped shapes get
            their outline as a second, inset fill layer instead: the outer
            layer is the line colour, the inner one the fill. */}
        {spec.css?.clipPath ? (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: shape.fill === "none" ? "transparent" : fill.line, ...spec.css }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[1.5px]"
              style={{ background: fill.bg, ...spec.css }}
            />
          </>
        ) : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 box-border"
            style={{
              background: fill.bg,
              border: spec.dashed
                ? `1.5px dashed ${shape.fill === "none" ? "var(--color-border-strong)" : fill.line}`
                : shape.fill === "none"
                  ? "none"
                  : `1.5px solid ${fill.line}`,
              ...spec.css,
            }}
          />
        )}

        <div
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(event) => {
            patch([shape.id], () => ({ text: event.currentTarget.innerText }));
            onEditing?.(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.blur();
            // The canvas shortcuts must not fire while typing.
            event.stopPropagation();
          }}
          ref={(element) => {
            if (element && isEditing && document.activeElement !== element) {
              element.focus();
              document.getSelection()?.selectAllChildren(element);
            }
          }}
          className={cn(
            "relative min-h-[1em] w-full whitespace-pre-wrap break-words outline-none",
            isEditing ? "cursor-text select-text" : "pointer-events-none select-none",
          )}
        >
          {shape.text}
        </div>

        {shape.locked ? (
          <span
            aria-hidden="true"
            title={text.locked}
            className="absolute -right-2 -top-2 inline-flex size-5 items-center justify-center rounded-full border border-border-subtle bg-surface-card text-text-secondary"
          >
            <Icon name="lock" size={11} />
          </span>
        ) : null}

        {shape.group && on ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-0.75 rounded-md border border-dashed border-accent-deep"
          />
        ) : null}

        {!readOnly && !isEditing && !shape.locked && (hover === shape.id || on)
          ? SIDES.map((side) => {
              const anchor = anchorPoint(shape, side);
              return (
                <span
                  key={side}
                  title={text.connect}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setWire({
                      from: shape.id,
                      ox: anchor.x,
                      oy: anchor.y,
                      x: anchor.x,
                      y: anchor.y,
                    });
                  }}
                  className="absolute z-4 size-2.75 cursor-crosshair rounded-full border-[1.5px] border-accent-deep bg-accent"
                  style={{ left: anchor.x - shape.x - 5.5, top: anchor.y - shape.y - 5.5 }}
                />
              );
            })
          : null}

        {!readOnly && on && !shape.locked && selected.length === 1
          ? HANDLES.map((handle) => (
              <span
                key={handle.id}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const point = at(event);
                  setDrag({
                    kind: "resize",
                    id: shape.id,
                    handle: handle.id,
                    px: point.x,
                    py: point.y,
                    origin: { x: shape.x, y: shape.y, w: shape.w, h: shape.h },
                  });
                }}
                className="absolute z-5 size-2.25 rounded-sm border-[1.5px] border-accent-deep bg-surface-card"
                style={{
                  left: handle.x * shape.w - 4.5,
                  top: handle.y * shape.h - 4.5,
                  cursor: handle.cursor,
                }}
              />
            ))
          : null}
      </div>
    );
  };

  const zoomButton = (icon: IconName, label: string, action: () => void) => (
    <button
      key={icon}
      type="button"
      title={label}
      aria-label={label}
      onClick={action}
      className="inline-flex size-7 items-center justify-center rounded-full border-none bg-transparent text-text-primary hover:bg-surface-alt halo-focus"
    >
      <Icon name={icon} size={14} />
    </button>
  );

  return (
    <div
      ref={box}
      data-surface="1"
      draggable={false}
      onPointerDown={surfaceDown}
      onDragStart={(event) => event.preventDefault()}
      onWheel={wheel}
      onContextMenu={(event) => {
        if (readOnly) return;
        event.preventDefault();
        onSelect?.([]);
        setMenu({ x: event.clientX, y: event.clientY, ids: [] });
      }}
      className={cn(
        "relative touch-none select-none overflow-hidden bg-surface-page",
        mode === "pan"
          ? drag?.kind === "pan"
            ? "cursor-grabbing"
            : "cursor-grab"
          : mode.startsWith("shape:")
            ? "cursor-crosshair"
            : "cursor-default",
        className,
      )}
      style={{
        height,
        // The grid scales and pans with the view, so it reads as the surface
        // rather than as an overlay.
        backgroundImage: gridOn
          ? "radial-gradient(circle, var(--color-border-subtle) 1px, transparent 1px)"
          : undefined,
        backgroundSize: `${GRID * 3 * view.k}px ${GRID * 3 * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})` }}
      >
        <svg
          width="1"
          height="1"
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
        >
          <defs>
            <marker id="halo-dg-arrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
              <path d="M0 1 L8 4.5 L0 8 z" fill="var(--color-text-primary)" />
            </marker>
            <marker id="halo-dg-arrow-on" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
              <path d="M0 1 L8 4.5 L0 8 z" fill="var(--color-accent-deep)" />
            </marker>
          </defs>

          {paths.map(({ link, d }) => {
            const on = selected.includes(link.id) || hoverLink === link.id;
            return (
              <g key={link.id} style={{ pointerEvents: "stroke" }}>
                {/* A 14px transparent stroke under the visible one: a 1.6px
                    line is not something anyone can reliably click. */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className={readOnly ? "cursor-default" : "cursor-pointer"}
                  onMouseEnter={() => setHoverLink(link.id)}
                  onMouseLeave={() => setHoverLink((current) => (current === link.id ? null : current))}
                  onPointerDown={(event) => {
                    if (readOnly) return;
                    event.stopPropagation();
                    onSelect?.([link.id]);
                  }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={on ? "var(--color-accent-deep)" : "var(--color-text-primary)"}
                  strokeWidth={on ? 2.4 : 1.6}
                  strokeLinecap="round"
                  strokeDasharray={link.dashed ? "7 6" : undefined}
                  markerEnd={`url(#halo-dg-arrow${on ? "-on" : ""})`}
                />
              </g>
            );
          })}
        </svg>

        {behind.map(renderShape)}
        {inFront.map(renderShape)}

        {paths
          .filter(({ link }) => link.label)
          .map(({ link, mid }) => (
            <span
              key={`${link.id}-label`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-pill border border-border-subtle bg-surface-page px-2 py-0.5 font-sans text-[12px] text-text-secondary"
              style={{ left: mid.x, top: mid.y }}
            >
              {link.label}
            </span>
          ))}

        {wire ? (
          <svg
            width="1"
            height="1"
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
          >
            <path
              d={`M ${wire.ox} ${wire.oy} L ${wire.x} ${wire.y}`}
              fill="none"
              stroke="var(--color-accent-deep)"
              strokeWidth="2"
              strokeDasharray="6 6"
              style={{ animation: "halo-diagram-dash 500ms linear infinite" }}
            />
          </svg>
        ) : null}

        {band ? (
          <div
            className="pointer-events-none absolute border-[1.5px] border-accent-deep"
            style={{
              left: Math.min(band.x0, band.x),
              top: Math.min(band.y0, band.y),
              width: Math.abs(band.x - band.x0),
              height: Math.abs(band.y - band.y0),
              // color-mix on the token, not a literal lime rgba, so the
              // marquee follows a retheme.
              background: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
            }}
          />
        ) : null}
      </div>

      {menu ? (
        <ContextMenu
          menu={menu}
          shapes={shapes}
          links={links}
          text={text}
          onClose={() => setMenu(null)}
          onEditing={onEditing}
          onSelect={onSelect}
          onView={onView}
          commit={commit}
          duplicate={duplicate}
          remove={remove}
          setOrder={setOrder}
          align={align}
        />
      ) : null}

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-pill border border-border-subtle bg-surface-card p-1 shadow-float">
        {zoomButton("minus", text.zoomOut, () =>
          onView({ ...view, k: Math.max(0.25, view.k * 0.9) }),
        )}
        {zoomButton("maximize", text.actualSize, () => onView({ x: 40, y: 30, k: 1 }))}
        {zoomButton("plus", text.zoomIn, () => onView({ ...view, k: Math.min(2.5, view.k * 1.1) }))}
        <span className="px-2 font-sans text-[12px] tabular-nums text-text-secondary">
          {Math.round(view.k * 100)} %
        </span>
      </div>
    </div>
  );
}

/** The right-click menu. Split out because the canvas is long enough. */
function ContextMenu({
  menu,
  shapes,
  links,
  text,
  onClose,
  onEditing,
  onSelect,
  onView,
  commit,
  duplicate,
  remove,
  setOrder,
  align,
}: {
  menu: { x: number; y: number; ids: string[] };
  shapes: Shape[];
  links: Link[];
  text: Record<string, string>;
  onClose: () => void;
  onEditing?: (id: string | null) => void;
  onSelect?: (ids: string[]) => void;
  onView: (view: DiagramView) => void;
  commit: (next: Diagram) => void;
  duplicate: (ids: string[]) => void;
  remove: (ids: string[]) => void;
  setOrder: (ids: string[], direction: "front" | "back") => void;
  align: (ids: string[], id: string) => void;
}) {
  const picked = shapes.filter((shape) => menu.ids.includes(shape.id));
  const grouped = picked.length > 0 && picked.every((shape) => shape.group);
  const locked = picked.length > 0 && picked.every((shape) => shape.locked);

  const item = (
    icon: IconName,
    label: string,
    hint: string,
    action: () => void,
    tone?: "error",
  ) => (
    <button
      key={label}
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => {
        action();
        onClose();
      }}
      className={cn(
        "flex h-8 w-full items-center gap-2.25 rounded-lg border-none bg-transparent px-2.5 text-left font-sans text-[13px] hover:bg-mist halo-focus",
        tone === "error" ? "text-error" : "text-text-primary",
      )}
    >
      <Icon name={icon} size={14} />
      <span className="flex-1">{label}</span>
      {hint ? <span className="text-[11.5px] text-text-secondary">{hint}</span> : null}
    </button>
  );

  const separator = (key: string) => (
    <span key={key} className="mx-1.5 my-1.25 block h-px bg-hairline" />
  );

  return (
    <div
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-[3000] w-56 rounded-[12px] border border-border-subtle bg-surface-card p-1.25 shadow-float"
      style={{
        // Clamped to the viewport: a menu opened near the edge must not open
        // off-screen.
        left: Math.max(8, Math.min(menu.x, window.innerWidth - 232)),
        top: Math.max(8, Math.min(menu.y, window.innerHeight - (menu.ids.length ? 300 : 150))),
        transformOrigin: "top left",
        animation: "halo-diagram-in 110ms var(--ease-standard) both",
      }}
    >
      {picked.length
        ? [
            !locked
              ? item("pencil", text.editText!, "double-click", () =>
                  onEditing?.(picked[0]!.id),
                )
              : null,
            item("copy", text.duplicate!, "⌘D", () => duplicate(menu.ids)),
            separator("s1"),

            picked.length > 1 && !grouped
              ? item("group", text.group!, "⌘G", () => {
                  const group = uid("g");
                  commit({
                    shapes: shapes.map((shape) =>
                      menu.ids.includes(shape.id) ? { ...shape, group } : shape,
                    ),
                    links,
                  });
                })
              : null,

            grouped
              ? item("ungroup", text.ungroup!, "⇧⌘G", () =>
                  commit({
                    shapes: shapes.map((shape) =>
                      menu.ids.includes(shape.id) ? { ...shape, group: undefined } : shape,
                    ),
                    links,
                  }),
                )
              : null,

            picked.length > 1
              ? item("align-start-vertical", "Align left", "", () => align(menu.ids, "left"))
              : null,

            item(locked ? "lock-open" : "lock", locked ? text.unlock! : text.lock!, "", () =>
              commit({
                shapes: shapes.map((shape) =>
                  menu.ids.includes(shape.id) ? { ...shape, locked: !locked } : shape,
                ),
                links,
              }),
            ),
            separator("s2"),

            item("bring-to-front", text.bringToFront!, "", () => setOrder(menu.ids, "front")),
            item("send-to-back", text.sendToBack!, "", () => setOrder(menu.ids, "back")),
            separator("s3"),

            item(
              "trash-2",
              text.delete!,
              "Del",
              () => {
                remove(menu.ids);
                onSelect?.([]);
              },
              "error",
            ),
          ].filter(Boolean)
        : [
            item("box-select", text.selectAll!, "⌘A", () =>
              onSelect?.(shapes.map((shape) => shape.id)),
            ),
            item("lock-open", text.unlockAll!, "", () =>
              commit({ shapes: shapes.map((shape) => ({ ...shape, locked: false })), links }),
            ),
            separator("e1"),
            item("maximize", "Zoom 100 %", "", () => onView({ x: 40, y: 30, k: 1 })),
          ]}
    </div>
  );
}
