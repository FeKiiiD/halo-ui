import * as React from "react";
import { cn } from "../../lib/cn";
import {
  FLOW_H,
  FLOW_W,
  type Branch,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeType,
  branchLabel,
  duplicateFlowNodes,
  flowEdgePath,
  flowSnap,
  flowUid,
  nodeHealth,
  outPort,
  ports,
  removeFlowNodes,
} from "../../lib/flow";
import { Icon, type IconName } from "../core/icon";

export interface FlowView {
  x: number;
  y: number;
  k: number;
}

export type FlowSelection = { type: "node" | "edge"; id: string } | null;

export interface FlowRunStep {
  status: "ok" | "error" | "running" | "skipped";
  /** Shown on the card while the run is displayed. */
  detail?: string;
}

export interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  types: Record<string, FlowNodeType>;
  onChange?: (next: FlowGraph) => void;

  selected?: FlowSelection;
  onSelect?: (selection: FlowSelection) => void;
  onOpen?: (node: FlowNode) => void;

  multi?: string[];
  onMultiChange?: (ids: string[]) => void;

  tool?: "select" | "pan";
  onToolChange?: (tool: "select" | "pan") => void;

  /** Per-node run results. Present means the canvas shows a run, not an edit. */
  runStatus?: Record<string, FlowRunStep>;
  /** The order the run actually took, for the travelling dot. */
  runPath?: string[];
  animateRun?: boolean;

  height?: number;
  editable?: boolean;
  className?: string;
}

const runSkins: Record<
  FlowRunStep["status"],
  { border: string; text: string; icon: IconName; label: string }
> = {
  ok: { border: "border-success", text: "text-success", icon: "check", label: "Succeeded" },
  error: { border: "border-error", text: "text-error", icon: "x", label: "Failed" },
  running: { border: "border-accent-deep", text: "text-accent-deep", icon: "loader", label: "Running" },
  skipped: { border: "border-border-subtle", text: "text-text-secondary", icon: "minus", label: "Not run" },
};

/**
 * The canvas half of the flow editor: pan, zoom, drag on a snapped grid, and
 * ports you pull into links.
 *
 * TWO OUTPUTS ON EVERY NODE — success above, failure below. A canvas that
 * offers one output lets people build automations whose failure path does not
 * exist, and an automation that silently stops is worse than one that visibly
 * fails.
 *
 * When a run is being shown the canvas stops being an editor: the cards carry
 * their result, a single dot retraces the route the run actually took, and it
 * halts on the step that failed rather than looping forever.
 */
export function FlowCanvas({
  nodes,
  edges,
  types,
  onChange,
  selected,
  onSelect,
  onOpen,
  multi,
  onMultiChange,
  tool,
  onToolChange,
  runStatus,
  runPath,
  animateRun = true,
  height = 520,
  editable = true,
  className,
}: FlowCanvasProps) {
  const box = React.useRef<HTMLDivElement>(null);
  const [view, setView] = React.useState<FlowView>({ x: 40, y: 30, k: 1 });
  const [drag, setDrag] = React.useState<{
    id: string;
    ox: number;
    oy: number;
    sx: number;
    sy: number;
    moved: boolean;
  } | null>(null);
  const [pan, setPan] = React.useState<{ x0: number; y0: number; vx: number; vy: number } | null>(null);
  const [link, setLink] = React.useState<{ from: string; branch: Branch; x: number; y: number } | null>(null);
  const [band, setBand] = React.useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);
  const [space, setSpace] = React.useState(false);
  const [ownTool, setOwnTool] = React.useState<"select" | "pan">("select");
  const [ownMulti, setOwnMulti] = React.useState<string[]>([]);

  const mode = space ? "pan" : (tool ?? ownTool);
  const picked = multi ?? ownMulti;
  const setPicked = (ids: string[]) => (onMultiChange ? onMultiChange(ids) : setOwnMulti(ids));
  const setTool = (next: "select" | "pan") =>
    onToolChange ? onToolChange(next) : setOwnTool(next);

  const graph: FlowGraph = { nodes, edges };
  const emit = (next: FlowGraph) => onChange?.(next);

  /* --- keyboard --------------------------------------------------------- */

  const live = React.useRef({ picked, selected, graph, editable });
  live.current = { picked, selected, graph, editable };

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase() ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || target?.isContentEditable) return;

      if (event.code === "Space") {
        event.preventDefault();
        setSpace(true);
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "v") setTool("select");
      if (key === "h") setTool("pan");

      const current = live.current;
      if (event.key === "Escape") {
        onSelect?.(null);
        setLink(null);
        return;
      }

      if (!current.editable) return;

      if ((event.key === "Delete" || event.key === "Backspace")) {
        const ids = current.picked.length
          ? current.picked
          : current.selected?.type === "node"
            ? [current.selected.id]
            : [];

        if (ids.length) {
          event.preventDefault();
          emit(removeFlowNodes(current.graph, ids));
          setPicked([]);
          onSelect?.(null);
          return;
        }

        if (current.selected?.type === "edge") {
          event.preventDefault();
          emit({
            nodes: current.graph.nodes,
            edges: current.graph.edges.filter((edge) => edge.id !== current.selected!.id),
          });
          onSelect?.(null);
        }
      }

      if ((event.metaKey || event.ctrlKey) && key === "d" && current.picked.length) {
        event.preventDefault();
        const { graph: next, created } = duplicateFlowNodes(current.graph, current.picked);
        emit(next);
        setPicked(created);
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

  /* --- pointer ---------------------------------------------------------- */

  const toLocal = (event: { clientX: number; clientY: number }) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left - view.x) / view.k,
      y: (event.clientY - rect.top - view.y) / view.k,
    };
  };

  React.useEffect(() => {
    if (!drag && !pan && !link && !band) return;

    const move = (event: PointerEvent) => {
      if (pan) {
        setView((current) => ({
          ...current,
          x: pan.vx + (event.clientX - pan.x0),
          y: pan.vy + (event.clientY - pan.y0),
        }));
        return;
      }

      const point = toLocal(event);

      if (drag) {
        const nextX = flowSnap(point.x - drag.ox);
        const nextY = flowSnap(point.y - drag.oy);
        const dx = nextX - drag.sx;
        const dy = nextY - drag.sy;

        const group = picked.length > 1 && picked.includes(drag.id) ? picked : [drag.id];

        emit({
          nodes: nodes.map((node) => {
            if (!group.includes(node.id)) return node;
            if (node.id === drag.id) return { ...node, x: nextX, y: nextY };
            return { ...node, x: flowSnap(node.x + dx), y: flowSnap(node.y + dy) };
          }),
          edges,
        });

        if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
          setDrag((current) => (current ? { ...current, moved: true } : current));
        }
        return;
      }

      if (link) {
        setLink((current) => (current ? { ...current, x: point.x, y: point.y } : current));
        return;
      }

      if (band) setBand((current) => (current ? { ...current, x2: point.x, y2: point.y } : current));
    };

    const up = (event: PointerEvent) => {
      if (link) {
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const card = element?.closest<HTMLElement>("[data-flow-node]");
        const target = card?.dataset.flowNode;

        if (
          target &&
          target !== link.from &&
          // One edge per source port per target: a second identical link adds
          // nothing and draws exactly on top of the first.
          !edges.some(
            (edge) =>
              edge.source === link.from && edge.target === target && edge.branch === link.branch,
          )
        ) {
          emit({
            nodes,
            edges: [...edges, { id: flowUid("e"), source: link.from, target, branch: link.branch }],
          });
        }
        setLink(null);
      }

      if (band) {
        const left = Math.min(band.x1, band.x2);
        const right = Math.max(band.x1, band.x2);
        const top = Math.min(band.y1, band.y2);
        const bottom = Math.max(band.y1, band.y2);

        if (right - left > 6 && bottom - top > 6) {
          setPicked(
            nodes
              .filter(
                (node) =>
                  node.x + FLOW_W > left &&
                  node.x < right &&
                  node.y + FLOW_H > top &&
                  node.y < bottom,
              )
              .map((node) => node.id),
          );
        } else setPicked([]);
        setBand(null);
      }

      setDrag(null);
      setPan(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, pan, link, band, nodes, edges, view, picked]);

  const zoom = (factor: number) =>
    setView((current) => ({ ...current, k: Math.max(0.4, Math.min(1.8, current.k * factor)) }));

  /* --- the run trace ----------------------------------------------------- */

  const byId = React.useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<string, FlowNode>,
    [nodes],
  );

  /**
   * One dot for the whole run. The executed nodes are chained into a single
   * path so the dot retraces the route the run actually took, and stops on the
   * step that failed rather than continuing past it.
   */
  const trace = React.useMemo(() => {
    if (!runStatus) return null;

    const order = (runPath?.length ? runPath : Object.keys(runStatus)).filter(
      (id) => byId[id] && runStatus[id] && runStatus[id]!.status !== "skipped",
    );
    if (order.length < 2) return null;

    let d = "";
    for (let i = 0; i < order.length - 1; i++) {
      const a = byId[order[i]!]!;
      const b = byId[order[i + 1]!]!;
      const edge = edges.find((entry) => entry.source === a.id && entry.target === b.id);
      const from = outPort(a, edge?.branch);
      const to = ports(b).in;

      // The M of each later segment becomes an L, so the dot steps across the
      // card rather than teleporting to the next port.
      const curve = flowEdgePath(from, to).replace(/^M [\d.-]+ [\d.-]+ /, "");
      d += i === 0 ? `M ${from.x} ${from.y} ${curve}` : ` L ${from.x} ${from.y} ${curve}`;
    }

    const last = runStatus[order[order.length - 1]!];
    return {
      d,
      failed: last?.status === "error",
      duration: `${Math.max(1.6, (order.length - 1) * 0.85)}s`,
    };
  }, [runStatus, runPath, byId, edges]);

  /* --- render ----------------------------------------------------------- */

  const nodeCard = (node: FlowNode) => {
    const type = types[node.type];
    const run = runStatus?.[node.id];
    const skin = run ? runSkins[run.status] : null;
    // Health is an editing concern: while a run is on screen the card shows
    // what happened, not what might be wrong with it.
    const bad = runStatus ? null : nodeHealth(node, graph, types);

    const isSelected =
      (selected?.type === "node" && selected.id === node.id) || picked.includes(node.id);
    const kind = type?.kind ?? "action";
    const isTrigger = kind === "trigger";

    return (
      <div
        key={node.id}
        data-flow-node={node.id}
        onPointerDown={(event) => {
          if (!editable || mode === "pan") return;
          event.stopPropagation();
          const point = toLocal(event);
          setDrag({
            id: node.id,
            ox: point.x - node.x,
            oy: point.y - node.y,
            sx: node.x,
            sy: node.y,
            moved: false,
          });
        }}
        onClick={(event) => {
          event.stopPropagation();
          // A drag is not a click: selecting on pointerup after a move would
          // make every drag also change the selection.
          if (drag?.moved) return;
          onSelect?.({ type: "node", id: node.id });
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onOpen?.(node);
        }}
        onMouseEnter={() => setHover(node.id)}
        onMouseLeave={() => setHover((current) => (current === node.id ? null : current))}
        className={cn(
          "absolute box-border flex items-center gap-2.5 rounded-[14px] border-[1.5px] px-3",
          "bg-surface-card text-text-primary",
          skin
            ? cn("border-2", skin.border)
            : bad
              ? cn("border-dashed", bad.tone === "error" ? "border-error" : "border-warning")
              : isSelected
                ? "border-accent-deep"
                : "border-text-primary",
          isSelected && "ring-3 ring-accent/30",
          node.disabled && "opacity-50",
          run?.status === "skipped" && "opacity-55",
          editable && !runStatus ? (drag?.id === node.id ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
        )}
        style={{
          left: node.x,
          top: node.y,
          width: FLOW_W,
          height: FLOW_H,
          zIndex: drag?.id === node.id ? 6 : isSelected ? 5 : 3,
          animation:
            run?.status === "error" && animateRun
              ? "halo-flow-shake 2.4s var(--ease-standard) infinite"
              : "halo-diagram-in 160ms var(--ease-standard) both",
        }}
      >
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
            isTrigger ? "bg-accent text-accent-ink" : "bg-surface-sunken text-text-primary",
          )}
        >
          <Icon name={(type?.icon ?? "square") as IconName} size={15} strokeWidth={1.9} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-medium leading-tight">
            {node.label ?? type?.label ?? node.type}
          </span>
          <span className="truncate text-[11.5px] leading-tight text-text-secondary">
            {run?.detail ?? (skin ? skin.label : (bad?.text ?? type?.category))}
          </span>
        </span>

        {skin ? (
          <span className={cn("inline-flex shrink-0", skin.text)}>
            <Icon
              name={skin.icon}
              size={15}
              className={run?.status === "running" ? "animate-[halo-spin_900ms_linear_infinite]" : undefined}
            />
          </span>
        ) : bad ? (
          <span
            title={bad.text}
            className={cn("inline-flex shrink-0", bad.tone === "error" ? "text-error" : "text-warning")}
          >
            <Icon name="circle-alert" size={14} />
          </span>
        ) : null}

        {/* Ports. Drawn only while editing: during a run they would invite an
            edit that the displayed result would no longer describe. */}
        {editable && !runStatus ? (
          <>
            <span
              aria-hidden="true"
              className="absolute -left-1.25 top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-surface-card bg-text-secondary"
            />

            {(["ok", "err"] as const).map((branch) => {
              const port = branch === "ok" ? ports(node).ok : ports(node).err;
              const visible = hover === node.id || isSelected;

              return (
                <span
                  key={branch}
                  title={branchLabel(branch, kind)}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setLink({ from: node.id, branch, x: port.x, y: port.y });
                  }}
                  className={cn(
                    "absolute -right-1.25 size-3 cursor-crosshair rounded-full border-2 border-surface-card",
                    "transition-opacity duration-[140ms] ease-standard",
                    branch === "ok" ? "bg-accent-deep" : "bg-error",
                    visible ? "opacity-100" : "opacity-0",
                  )}
                  style={{ top: port.y - node.y - 6 }}
                />
              );
            })}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={box}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (event.target !== event.currentTarget && !target.dataset.flowSurface) return;

        if (mode === "pan" || event.button === 1) {
          setPan({ x0: event.clientX, y0: event.clientY, vx: view.x, vy: view.y });
          return;
        }
        onSelect?.(null);
        const point = toLocal(event);
        setBand({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      }}
      onWheel={(event) => {
        event.preventDefault();
        const rect = box.current?.getBoundingClientRect();
        if (!rect) return;

        if (event.ctrlKey || event.metaKey) {
          const k = Math.min(1.8, Math.max(0.4, view.k * (event.deltaY > 0 ? 0.92 : 1.08)));
          const mx = event.clientX - rect.left;
          const my = event.clientY - rect.top;
          setView({ k, x: mx - ((mx - view.x) / view.k) * k, y: my - ((my - view.y) / view.k) * k });
        } else {
          setView((current) => ({
            ...current,
            x: current.x - event.deltaX,
            y: current.y - event.deltaY,
          }));
        }
      }}
      className={cn(
        "relative touch-none select-none overflow-hidden bg-surface-page",
        mode === "pan" ? (pan ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
        className,
      )}
      style={{
        height,
        backgroundImage:
          "radial-gradient(circle, var(--color-border-subtle) 1px, transparent 1px)",
        backgroundSize: `${24 * view.k}px ${24 * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div
        data-flow-surface="1"
        className="absolute inset-0"
        style={{
          transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`,
          transformOrigin: "0 0",
        }}
      >
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
          {edges.map((edge) => {
            const from = byId[edge.source];
            const to = byId[edge.target];
            if (!from || !to) return null;

            const d = flowEdgePath(outPort(from, edge.branch), ports(to).in);
            const on = selected?.type === "edge" && selected.id === edge.id;
            const failureBranch = edge.branch === "err" || edge.branch === "no";

            const ran =
              runStatus &&
              runStatus[edge.source]?.status !== "skipped" &&
              runStatus[edge.target] &&
              runStatus[edge.target]!.status !== "skipped";

            return (
              <g key={edge.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ pointerEvents: "stroke", cursor: editable ? "pointer" : "default" }}
                  onPointerDown={(event) => {
                    if (!editable || runStatus) return;
                    event.stopPropagation();
                    onSelect?.({ type: "edge", id: edge.id });
                  }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={
                    on
                      ? "var(--color-accent-deep)"
                      : runStatus
                        ? ran
                          ? "var(--color-text-primary)"
                          : "var(--color-border-subtle)"
                        : failureBranch
                          ? "var(--color-error)"
                          : "var(--color-text-secondary)"
                  }
                  strokeWidth={on ? 2.4 : 1.6}
                  strokeDasharray={failureBranch && !runStatus ? "5 4" : undefined}
                />
              </g>
            );
          })}

          {/* The travelling dot. It stops at the failure rather than looping,
              which is the whole point of watching a run. */}
          {trace ? (
            <>
              <path d={trace.d} fill="none" stroke="transparent" strokeWidth={0} />
              <circle
                r={5}
                fill={trace.failed ? "var(--color-error)" : "var(--color-accent-deep)"}
              >
                <animateMotion
                  dur={trace.duration}
                  path={trace.d}
                  fill="freeze"
                  repeatCount={trace.failed ? 1 : "indefinite"}
                />
              </circle>
            </>
          ) : null}

          {link && byId[link.from] ? (
            <path
              d={flowEdgePath(outPort(byId[link.from]!, link.branch), { x: link.x, y: link.y })}
              fill="none"
              stroke="var(--color-accent-deep)"
              strokeWidth="2"
              strokeDasharray="6 6"
              style={{ animation: "halo-diagram-dash 500ms linear infinite" }}
            />
          ) : null}
        </svg>

        {nodes.map(nodeCard)}

        {band ? (
          <span
            className="pointer-events-none absolute z-10 border-[1.5px] border-accent-deep"
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

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-pill border border-border-subtle bg-surface-card p-1 shadow-float">
        {(
          [
            ["minus", "Zoom out", () => zoom(0.9)],
            ["maximize", "Actual size", () => setView({ x: 40, y: 30, k: 1 })],
            ["plus", "Zoom in", () => zoom(1.1)],
          ] as const
        ).map(([icon, label, action]) => (
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
        ))}
        <span className="px-2 font-sans text-[12px] tabular-nums text-text-secondary">
          {Math.round(view.k * 100)} %
        </span>
      </div>
    </div>
  );
}
