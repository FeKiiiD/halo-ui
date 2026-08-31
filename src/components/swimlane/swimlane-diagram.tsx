import * as React from "react";
import { cn } from "../../lib/cn";
import {
  HEADER_W,
  NODE_H,
  NODE_W,
  PHASE_H,
  PHASE_TONES,
  SWIM_KINDS,
  contentHeight,
  contentWidth,
  isUniqueKind,
  laneAt,
  laneTop,
  moveNodes,
  nodeTop,
  nodesInBand,
  phaseBands,
  phaseTone,
  removeLane,
  removeSwimNodes,
  swimEdgePath,
  swimSnap,
  type PhaseToneName,
  type SwimEdge,
  type SwimGraph,
  type SwimLane,
  type SwimNode,
  type SwimNodeKind,
  type SwimPhase,
} from "../../lib/swimlane";
import { normalize } from "../../lib/use-dismissable";
import { Icon, type IconName } from "../core/icon";
import { SaveButton } from "../core/save-button";
import { SearchField } from "../forms/search-field";
import { SWIM_CATEGORIES, type SwimCatalogGroup, type SwimCatalogItem } from "./swimlane-catalog";

export interface SwimlaneDiagramProps {
  lanes: SwimLane[];
  nodes: SwimNode[];
  edges: SwimEdge[];
  phases?: SwimPhase[];

  onChange?: (next: SwimGraph) => void;
  onSelect?: (node: SwimNode) => void;
  onSave?: (next: SwimGraph) => unknown | Promise<unknown>;

  title?: React.ReactNode;
  subtitle?: React.ReactNode;

  editable?: boolean;
  palette?: boolean;
  catalog?: SwimCatalogGroup[];

  laneHeight?: number;
  width?: number;
  height?: number;

  labels?: Partial<Record<string, string>>;
  className?: string;
}

const MEDIA_TYPE = "text/halo-swim-step";

type Drag = {
  id: string;
  /** Pointer offset inside the card, so it does not jump to the cursor. */
  ox: number;
  x: number;
  y: number;
  startX: number;
  startLaneId: string;
  laneId: string;
};

/**
 * A journey drawn as bands: one lane per actor, steps placed along the time
 * axis, links crossing between them.
 *
 * THE TWO AXES MEAN DIFFERENT THINGS, and dragging says so. Sideways moves a
 * step in time; up or down hands it to a different actor. That is the whole
 * grammar of a swimlane — the diagram exists to show handoffs, and a handoff
 * is a vertical move.
 *
 * Phases band the background behind the lanes, so a phase reads as a region of
 * the drawing rather than as another row competing with the cards.
 */
export function SwimlaneDiagram({
  lanes,
  nodes,
  edges,
  phases = [],
  onChange,
  onSelect,
  onSave,
  title = "Swimlane",
  subtitle,
  editable = true,
  palette = true,
  catalog = SWIM_CATEGORIES,
  laneHeight = 108,
  width = 1200,
  height,
  labels,
  className,
}: SwimlaneDiagramProps) {
  const text = {
    search: "Search a step…",
    addLane: "Add a lane",
    newLane: "New lane",
    placed: "placed",
    dragHint: "drag into a lane",
    alreadyPlaced: "Already placed — dragging it will move it.",
    ...labels,
  };

  const box = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const [link, setLink] = React.useState<{ from: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = React.useState<{ type: "node" | "edge" | "lane"; id: string } | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  const [dropLane, setDropLane] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [tool, setTool] = React.useState<"select" | "pan">("select");
  const [space, setSpace] = React.useState(false);
  const [pan, setPan] = React.useState<{ x0: number; y0: number; sl: number; st: number } | null>(null);
  const [band, setBand] = React.useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [phaseDrag, setPhaseDrag] = React.useState<{ index: number; x0: number; w0: number } | null>(null);

  const graph: SwimGraph = { lanes, nodes, edges, phases };
  const graphJson = JSON.stringify(graph);
  const [saved, setSaved] = React.useState(() => graphJson);
  const dirty = graphJson !== saved;

  const mode = space ? "pan" : tool;
  const headerHeight = phases.length || editable ? PHASE_H : 0;

  const emit = (next: Partial<SwimGraph>) => onChange?.({ ...graph, ...next });

  const byId = React.useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<string, SwimNode>,
    [nodes],
  );

  const topOf = (node: SwimNode) => nodeTop(lanes, node, laneHeight);
  // contentHeight, not lanes × laneHeight: an offset card can sit below the
  // last lane, and the surface has to reach it or it is clipped away.
  const totalHeight = contentHeight(lanes, nodes, laneHeight);
  const contentW = contentWidth(nodes, phases, width);
  const bands = phaseBands(phases);

  /* --- keyboard --------------------------------------------------------- */

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase() ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || target?.isContentEditable) return;

      const key = event.key.toLowerCase();
      if (key === "v") setTool("select");
      if (key === "h") setTool("pan");
      if (event.code === "Space") {
        event.preventDefault();
        setSpace(true);
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
  }, []);

  const live = React.useRef({ selected, picked, graph, editable });
  live.current = { selected, picked, graph, editable };

  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (["INPUT", "TEXTAREA"].includes(target?.tagName?.toUpperCase() ?? "")) return;

      const current = live.current;
      if (!current.editable) return;

      if (event.key === "Escape") {
        setSelected(null);
        setLink(null);
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") return;

      if (current.picked.length > 1) {
        event.preventDefault();
        emit(removeSwimNodes(current.graph, current.picked));
        setPicked([]);
        setSelected(null);
        return;
      }

      const target2 = current.selected;
      if (!target2) return;
      event.preventDefault();

      if (target2.type === "node") emit(removeSwimNodes(current.graph, [target2.id]));
      else if (target2.type === "edge") {
        emit({ edges: current.graph.edges.filter((edge) => edge.id !== target2.id) });
      } else if (target2.type === "lane") emit(removeLane(current.graph, target2.id));

      setSelected(null);
    };

    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- phase resizing --------------------------------------------------- */

  React.useEffect(() => {
    if (!phaseDrag) return;

    const move = (event: PointerEvent) => {
      const next = Math.max(80, Math.min(1200, phaseDrag.w0 + (event.clientX - phaseDrag.x0)));
      emit({
        phases: phases.map((phase, index) =>
          index === phaseDrag.index ? { ...phase, width: next } : phase,
        ),
      });
    };
    const up = () => setPhaseDrag(null);

    const previous = document.body.style.cursor;
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      document.body.style.cursor = previous;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseDrag, phases]);

  /* --- pointer ---------------------------------------------------------- */

  /** Screen point to content coordinates, past the lane headers and the phase strip. */
  const toLocal = (event: { clientX: number; clientY: number }) => {
    const element = box.current;
    const rect = element?.getBoundingClientRect();
    if (!element || !rect) return { x: 0, y: 0 };
    return {
      x: event.clientX - rect.left + element.scrollLeft - HEADER_W,
      y: event.clientY - rect.top + element.scrollTop - headerHeight,
    };
  };

  React.useEffect(() => {
    if (!pan && !band) return;

    const move = (event: PointerEvent) => {
      if (pan && box.current) {
        box.current.scrollLeft = pan.sl - (event.clientX - pan.x0);
        box.current.scrollTop = pan.st - (event.clientY - pan.y0);
        return;
      }
      if (band) {
        const point = toLocal(event);
        setBand((current) => (current ? { ...current, x2: point.x, y2: point.y } : current));
      }
    };

    const up = () => {
      if (band) {
        const wide = Math.abs(band.x2 - band.x1) > 6;
        const tall = Math.abs(band.y2 - band.y1) > 6;
        setPicked(wide && tall ? nodesInBand(graph, band, laneHeight) : []);
        setBand(null);
      }
      setPan(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pan, band, nodes, lanes, laneHeight]);

  React.useEffect(() => {
    if (!drag && !link) return;

    const move = (event: PointerEvent) => {
      const point = toLocal(event);

      if (drag) {
        setDrag((current) =>
          current
            ? {
                ...current,
                x: point.x - current.ox,
                y: point.y,
                laneId: laneAt(lanes, point.y, laneHeight)?.id ?? current.laneId,
              }
            : current,
        );
        return;
      }
      setLink((current) => (current ? { ...current, x: point.x, y: point.y } : current));
    };

    const up = (event: PointerEvent) => {
      if (drag) {
        const group = picked.length > 1 && picked.includes(drag.id) ? picked : [drag.id];
        emit({
          nodes: moveNodes(graph, {
            draggedId: drag.id,
            group,
            x: Math.max(0, swimSnap(drag.x)),
            laneId: drag.laneId,
            startX: drag.startX,
            startLaneId: drag.startLaneId,
          }),
        });
        setDrag(null);
      }

      if (link) {
        const point = toLocal(event);
        // Reversed: the topmost card wins when two overlap.
        const target = [...nodes]
          .reverse()
          .find(
            (node) =>
              point.x >= node.x &&
              point.x <= node.x + NODE_W &&
              point.y >= topOf(node) &&
              point.y <= topOf(node) + NODE_H,
          );

        if (
          target &&
          target.id !== link.from &&
          !edges.some((edge) => edge.source === link.from && edge.target === target.id)
        ) {
          emit({
            edges: [...edges, { id: `e${edges.length}-${link.from}-${target.id}`, source: link.from, target: target.id }],
          });
        }
        setLink(null);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, link, nodes, edges, lanes, picked, laneHeight]);

  /* --- placing ---------------------------------------------------------- */

  const hasKind = (kind: SwimNodeKind) => nodes.some((node) => node.kind === kind);

  const place = (spec: SwimCatalogItem, laneId: string, x: number) => {
    const kind = spec.type;

    // A journey has one entry and one exit: placing a second moves the first
    // rather than leaving two starts, which no reader can interpret.
    if (isUniqueKind(kind) && hasKind(kind)) {
      const existing = nodes.find((node) => node.kind === kind)!;
      emit({
        nodes: nodes.map((node) =>
          node.id === existing.id ? { ...node, laneId, x: Math.max(0, swimSnap(x)) } : node,
        ),
      });
      return;
    }

    emit({
      nodes: [
        ...nodes,
        {
          id: `n${nodes.length}-${kind}-${laneId}`,
          laneId,
          x: Math.max(0, swimSnap(x)),
          label: spec.label,
          kind,
          icon: spec.icon,
          note: spec.note,
        },
      ],
    });
  };

  const addLane = () => {
    const id = `l${lanes.length}`;
    emit({ lanes: [...lanes, { id, label: text.newLane! }] });
    setSelected({ type: "lane", id });
  };

  const doSave = async () => {
    if (onSave) await onSave(graph);
    setSaved(graphJson);
  };

  /* --- render ----------------------------------------------------------- */

  const cardFor = (node: SwimNode) => {
    const live2 = drag?.id === node.id;
    const x = live2 ? swimSnap(drag!.x) : node.x;
    const laneId = live2 ? drag!.laneId : node.laneId;
    const top = live2
      ? laneTop(lanes, laneId, laneHeight) + laneHeight / 2 - NODE_H / 2 + (node.offset ?? 0)
      : topOf(node);
    return { x: Math.max(0, x), top };
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-3.25">
        <span className="mr-auto flex min-w-0 flex-col">
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
            {title}
          </span>
          {subtitle ? (
            <span className="text-[12.5px] text-text-secondary">{subtitle}</span>
          ) : null}
        </span>

        <span className="text-[12.5px] tabular-nums text-text-secondary">
          {lanes.length} lane{lanes.length === 1 ? "" : "s"} · {nodes.length} step
          {nodes.length === 1 ? "" : "s"}
        </span>

        {editable ? (
          <button
            type="button"
            onClick={addLane}
            className="inline-flex h-7.5 items-center gap-1.5 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt halo-focus"
          >
            <Icon name="rows-3" size={13} />
            {text.addLane}
          </button>
        ) : null}

        {editable ? (
          <SaveButton variant="primary" size="md" minWidth={150} dirty={dirty} disabled={!dirty} onSave={doSave} />
        ) : null}
      </div>

      <div className="flex items-stretch">
        {palette && editable ? (
          <div
            className="flex w-58 shrink-0 flex-col border-r border-hairline"
            style={{ maxHeight: height ? height + 44 : undefined }}
          >
            <div className="border-b border-hairline p-2.5">
              <SearchField value={query} onChange={setQuery} size="sm" fullWidth placeholder={text.search} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {catalog.map((group) => {
                const items = group.items.filter(
                  (item) =>
                    !query ||
                    normalize(`${item.label} ${item.note} ${group.label}`).includes(normalize(query)),
                );
                if (!items.length) return null;

                // A search reveals every group: folding away a match would
                // hide the thing that was just searched for.
                const folded = collapsed.includes(group.key) && !query;

                return (
                  <div key={group.key} className="mb-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((current) =>
                          current.includes(group.key)
                            ? current.filter((entry) => entry !== group.key)
                            : [...current, group.key],
                        )
                      }
                      aria-expanded={!folded}
                      className="flex h-7.5 w-full items-center gap-2 rounded-lg border-none bg-transparent px-2 font-sans text-[12px] font-medium text-text-secondary hover:bg-surface-alt halo-focus"
                    >
                      <Icon name={group.icon as IconName} size={13} />
                      <span className="flex-1 text-left">{group.label}</span>
                      <Icon
                        name="chevron-right"
                        size={12}
                        className={cn(
                          "transition-transform duration-[180ms] ease-standard",
                          !folded && "rotate-90",
                        )}
                      />
                    </button>

                    {!folded
                      ? items.map((item, index) => {
                          const used = isUniqueKind(item.type) && hasKind(item.type);

                          return (
                            <button
                              key={`${group.key}-${index}`}
                              type="button"
                              draggable
                              title={`${used ? `${text.alreadyPlaced} ` : ""}${item.note} — ${text.dragHint}`}
                              onDragStart={(event) => {
                                event.dataTransfer.setData(MEDIA_TYPE, JSON.stringify(item));
                                event.dataTransfer.effectAllowed = "copy";
                              }}
                              onClick={() => {
                                const first = lanes[0];
                                if (first) place(item, first.id, 32);
                              }}
                              className="flex w-full cursor-grab items-center gap-2.25 rounded-[10px] border-none bg-transparent px-2 py-1.75 text-left hover:bg-surface-alt halo-focus"
                            >
                              <span
                                className={cn(
                                  "inline-flex size-6.5 shrink-0 items-center justify-center",
                                  // A milestone is round, a step is square —
                                  // the same distinction the canvas makes.
                                  item.type === "start" || item.type === "end"
                                    ? "rounded-full bg-accent text-accent-ink"
                                    : "rounded-lg bg-surface-sunken text-text-primary",
                                )}
                              >
                                <Icon name={item.icon as IconName} size={13} strokeWidth={1.9} />
                              </span>

                              <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-text-primary">
                                {item.label}
                              </span>

                              {used ? (
                                <span className="inline-flex h-4.25 shrink-0 items-center gap-0.75 rounded-pill bg-surface-sunken px-1.5 text-[10px] text-text-primary">
                                  <Icon name="check" size={8} strokeWidth={3.4} />
                                  {text.placed}
                                </span>
                              ) : (
                                <Icon name="grip-vertical" size={12} className="text-text-secondary" />
                              )}
                            </button>
                          );
                        })
                      : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div
          ref={box}
          onDragOver={(event) => {
            if (!editable || !event.dataTransfer.types.includes(MEDIA_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            const point = toLocal(event);
            setDropLane(laneAt(lanes, point.y, laneHeight)?.id ?? null);
          }}
          onDragLeave={() => setDropLane(null)}
          onDrop={(event) => {
            if (!editable) return;
            event.preventDefault();
            setDropLane(null);

            const raw = event.dataTransfer.getData(MEDIA_TYPE);
            if (!raw) return;

            let spec: SwimCatalogItem;
            try {
              spec = JSON.parse(raw) as SwimCatalogItem;
            } catch {
              return;
            }

            const point = toLocal(event);
            const lane = laneAt(lanes, point.y, laneHeight);
            if (lane) place(spec, lane.id, point.x - NODE_W / 2);
          }}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget && !(event.target as HTMLElement).dataset.surface)
              return;

            if (mode === "pan" && box.current) {
              setPan({
                x0: event.clientX,
                y0: event.clientY,
                sl: box.current.scrollLeft,
                st: box.current.scrollTop,
              });
              return;
            }
            setSelected(null);
            const point = toLocal(event);
            setBand({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
          }}
          className={cn(
            "relative min-w-0 flex-1 touch-none select-none overflow-auto",
            mode === "pan" ? (pan ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
          )}
          style={{ maxHeight: height }}
        >
          <div style={{ width: HEADER_W + contentW, minHeight: headerHeight + totalHeight }}>
            {headerHeight ? (
              <div
                className="sticky top-0 z-3 flex border-b border-hairline bg-surface-card"
                style={{ height: headerHeight }}
              >
                <span
                  className="shrink-0 border-r border-hairline"
                  style={{ width: HEADER_W }}
                />

                <div className="relative" style={{ width: contentW }}>
                  {bands.map((phase, index) => {
                    const tone = phaseTone(phase.tone);
                    return (
                      <span
                        key={phase.id}
                        className="absolute inset-y-0 flex items-center border-r border-hairline px-2.5"
                        style={{ left: phase.left, width: phase.width }}
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: tone?.chip ?? "var(--color-border-strong)" }}
                        />
                        <span className="ml-1.5 min-w-0 flex-1 truncate text-[12px] text-text-secondary">
                          {phase.label}
                        </span>

                        {editable ? (
                          <span
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setPhaseDrag({ index, x0: event.clientX, w0: phase.width });
                            }}
                            className="absolute inset-y-0 -right-1 w-2 cursor-col-resize"
                          />
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="relative flex">
              <div className="sticky left-0 z-2 shrink-0 bg-surface-card" style={{ width: HEADER_W }}>
                {lanes.map((lane) => (
                  <div
                    key={lane.id}
                    onClick={() => setSelected({ type: "lane", id: lane.id })}
                    className={cn(
                      "flex flex-col justify-center gap-0.5 border-b border-r border-hairline px-3.5",
                      "transition-colors duration-[140ms] ease-standard",
                      selected?.type === "lane" && selected.id === lane.id
                        ? "bg-mist"
                        : dropLane === lane.id
                          ? "bg-surface-alt"
                          : "bg-surface-card",
                    )}
                    style={{ height: laneHeight }}
                  >
                    <span className="truncate text-[13.5px] font-medium text-text-primary">
                      {lane.label}
                    </span>
                    {lane.note ? (
                      <span className="truncate text-[11.5px] text-text-secondary">{lane.note}</span>
                    ) : null}
                  </div>
                ))}
              </div>

              <div
                data-surface="1"
                className="relative"
                style={{ width: contentW, height: totalHeight }}
              >
                {/* Phase bands, behind everything. */}
                {bands.map((phase) => {
                  const tone = phaseTone(phase.tone);
                  if (!tone) return null;
                  return (
                    <span
                      key={phase.id}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0"
                      style={{ left: phase.left, width: phase.width, background: tone.band }}
                    />
                  );
                })}

                {lanes.map((lane) => (
                  <span
                    key={lane.id}
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-x-0 border-b border-hairline",
                      dropLane === lane.id && "bg-mist",
                    )}
                    style={{ top: laneTop(lanes, lane.id, laneHeight), height: laneHeight }}
                  />
                ))}

                <svg
                  className="pointer-events-none absolute inset-0 overflow-visible"
                  width={contentW}
                  height={totalHeight}
                  aria-hidden="true"
                >
                  {edges.map((edge) => {
                    const from = byId[edge.source];
                    const to = byId[edge.target];
                    if (!from || !to) return null;

                    const on = selected?.type === "edge" && selected.id === edge.id;
                    const d = swimEdgePath(cardFor(from), cardFor(to));
                    const end = cardFor(to);

                    return (
                      <g key={edge.id}>
                        <path
                          d={d}
                          fill="none"
                          stroke={on ? "var(--color-accent-deep)" : "var(--color-text-secondary)"}
                          strokeWidth={on ? 2.2 : 1.5}
                          strokeDasharray={edge.dashed ? "6 5" : undefined}
                        />
                        <path
                          d={`M ${end.x - 8} ${end.top + NODE_H / 2 - 5} L ${end.x} ${end.top + NODE_H / 2} L ${end.x - 8} ${end.top + NODE_H / 2 + 5} Z`}
                          fill={on ? "var(--color-accent-deep)" : "var(--color-text-secondary)"}
                        />
                      </g>
                    );
                  })}

                  {link && byId[link.from] ? (
                    <path
                      d={`M ${cardFor(byId[link.from]!).x + NODE_W} ${cardFor(byId[link.from]!).top + NODE_H / 2} L ${link.x} ${link.y}`}
                      fill="none"
                      stroke="var(--color-accent-deep)"
                      strokeWidth="2"
                      strokeDasharray="6 6"
                      style={{ animation: "halo-diagram-dash 500ms linear infinite" }}
                    />
                  ) : null}
                </svg>

                {/* Edge hit targets, above the lines but below the cards. */}
                <svg
                  className="absolute inset-0 overflow-visible"
                  width={contentW}
                  height={totalHeight}
                  style={{ pointerEvents: "none" }}
                >
                  {edges.map((edge) => {
                    const from = byId[edge.source];
                    const to = byId[edge.target];
                    if (!from || !to) return null;

                    return (
                      <path
                        key={edge.id}
                        d={swimEdgePath(cardFor(from), cardFor(to))}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={12}
                        style={{ pointerEvents: "stroke", cursor: editable ? "pointer" : "default" }}
                        onPointerDown={(event) => {
                          if (!editable) return;
                          event.stopPropagation();
                          setSelected({ type: "edge", id: edge.id });
                        }}
                      />
                    );
                  })}
                </svg>

                {nodes.map((node) => {
                  const kind = SWIM_KINDS[node.kind ?? "step"];
                  const geometry = cardFor(node);
                  const on = selected?.type === "node" && selected.id === node.id;
                  const inGroup = picked.includes(node.id);
                  const milestone = node.kind === "start" || node.kind === "end";

                  return (
                    <div
                      key={node.id}
                      onPointerDown={(event) => {
                        if (!editable || mode === "pan") return;
                        event.stopPropagation();
                        setSelected({ type: "node", id: node.id });
                        onSelect?.(node);

                        const point = toLocal(event);
                        setDrag({
                          id: node.id,
                          ox: point.x - node.x,
                          x: node.x,
                          y: point.y,
                          startX: node.x,
                          startLaneId: node.laneId,
                          laneId: node.laneId,
                        });
                      }}
                      onMouseEnter={() => setHover(node.id)}
                      onMouseLeave={() => setHover((current) => (current === node.id ? null : current))}
                      className={cn(
                        "absolute flex items-center gap-2 border px-2.5",
                        "transition-shadow duration-[140ms] ease-standard",
                        milestone
                          ? "border-accent-deep bg-accent text-accent-ink"
                          : "border-border-subtle bg-surface-card text-text-primary",
                        on || inGroup ? "shadow-float ring-2 ring-accent-deep" : "shadow-none",
                        editable ? (drag?.id === node.id ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
                      )}
                      style={{
                        left: geometry.x,
                        top: geometry.top,
                        width: NODE_W,
                        height: NODE_H,
                        borderRadius: kind.radius,
                        // Above the lanes and the wires, and above its
                        // neighbours while it is being carried.
                        zIndex: drag?.id === node.id ? 6 : 4,
                        animation: "halo-swim-in 180ms var(--ease-standard) both",
                      }}
                    >
                      <span
                        className={cn(
                          "inline-flex size-6 shrink-0 items-center justify-center rounded-lg",
                          milestone ? "bg-accent-ink/12" : "bg-surface-sunken",
                        )}
                      >
                        <Icon name={(node.icon ?? kind.icon) as IconName} size={13} strokeWidth={1.9} />
                      </span>

                      <span className="min-w-0 flex-1 truncate text-[13px]">{node.label}</span>

                      {editable && (hover === node.id || on) ? (
                        <span
                          title="Drag to connect"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setLink({
                              from: node.id,
                              x: geometry.x + NODE_W,
                              y: geometry.top + NODE_H / 2,
                            });
                          }}
                          className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-surface-card bg-accent-deep"
                        />
                      ) : null}
                    </div>
                  );
                })}

                {band ? (
                  <span
                    className="pointer-events-none absolute z-5 border-[1.5px] border-accent-deep"
                    style={{
                      left: Math.min(band.x1, band.x2),
                      top: Math.min(band.y1, band.y2),
                      width: Math.abs(band.x2 - band.x1),
                      height: Math.abs(band.y2 - band.y1),
                      background: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editable ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-4 py-2.25 text-[12.5px] text-text-secondary">
          <span>
            Drag sideways to move a step in time, up or down to hand it to another actor · V select,
            H or space to pan · Del to remove
          </span>
        </div>
      ) : null}
    </div>
  );
}

export type { PhaseToneName, SwimEdge, SwimGraph, SwimLane, SwimNode, SwimPhase };
export { PHASE_TONES };
