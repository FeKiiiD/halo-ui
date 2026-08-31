import * as React from "react";
import { cn } from "../../lib/cn";
import { normalize } from "../../lib/use-dismissable";
import { Icon } from "../core/icon";
import { Drawer } from "../overlay/drawer";

export interface GraphNode {
  id: string;
  label: string;
  /** Index into `groups`; also picks the colour. */
  group?: number;
  /** Added to the degree-derived radius. */
  size?: number;
  meta?: string;
  body?: React.ReactNode;
  stats?: { label: string; value: React.ReactNode }[];
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphMapProps {
  nodes: GraphNode[];
  links: GraphLink[];
  height?: number;

  selectedId?: string;
  onSelect?: (node: GraphNode) => void;
  onOpen?: (node: GraphNode) => void;

  searchable?: boolean;
  showLabels?: boolean;
  detail?: boolean;

  /** Rest length of a link, in px. */
  linkDistance?: number;
  /** Node repulsion. Negative pushes apart. */
  charge?: number;
  /** Hops lit around the focused node. 0 lights the whole graph. */
  depth?: number;

  groups?: string[];
  title?: React.ReactNode;
  labels?: {
    search?: string;
    oneHop?: string;
    twoHops?: string;
    all?: string;
    zoomIn?: string;
    zoomOut?: string;
    recentre?: string;
    pin?: string;
    unpin?: string;
    open?: string;
    linked?: string;
    hint?: string;
    show?: string;
    hide?: string;
    links?: (count: number) => string;
  };
  className?: string;
}

/**
 * Five slots, cycled. Group 0 is NOT --color-ink: that is a fixed dark value
 * and the dark page surface is also dark, so the default group vanished.
 * action-secondary-bg is the neutral solid that flips with the theme.
 */
const groupColors = [
  "var(--color-action-secondary-bg)",
  "var(--color-info)",
  "var(--color-warning)",
  "var(--color-success)",
  "var(--color-error)",
];

interface Particle extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * A map of linked notes: a force layout you can pan, zoom and pull apart.
 *
 * HOVERING LIGHTS A NEIGHBOURHOOD AND DIMS THE REST. On a graph past about
 * thirty nodes every layout looks like the same hairball; the only way to read
 * one is to ask it a question, and "what is this connected to" is the question
 * people actually have.
 *
 * The selected node is the only lime element on screen — the accent marks the
 * one thing you are looking at, never the groups.
 */
export function GraphMap({
  nodes,
  links,
  height = 420,
  selectedId,
  onSelect,
  onOpen,
  searchable = true,
  showLabels = true,
  detail = true,
  linkDistance = 78,
  charge = -420,
  depth = 0,
  groups = [],
  title,
  labels,
  className,
}: GraphMapProps) {
  const text = {
    search: "Filter nodes…",
    oneHop: "1 hop",
    twoHops: "2 hops",
    all: "All",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    recentre: "Recentre",
    pin: "Pin",
    unpin: "Unpin",
    open: "Open the record",
    linked: "Linked items",
    hint: "Click to open, double-click to pin, scroll to zoom.",
    show: "Show this group",
    hide: "Hide this group",
    links: (count: number) => `${count} link${count === 1 ? "" : "s"}`,
    ...labels,
  };

  const [hidden, setHidden] = React.useState<number[]>([]);
  const [focusDepth, setFocusDepth] = React.useState(depth || 1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [pinned, setPinned] = React.useState<string[]>([]);
  const [view, setView] = React.useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [pan, setPan] = React.useState<{ x0: number; y0: number; vx: number; vy: number } | null>(null);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(selectedId ?? null);

  const box = React.useRef<HTMLDivElement>(null);
  const simulation = React.useRef<{ nodes: Particle[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const frame = React.useRef<number>(0);
  const [, redraw] = React.useReducer((count: number) => count + 1, 0);

  React.useEffect(() => setSelected(selectedId ?? null), [selectedId]);

  const liveNodes = React.useMemo(
    () => nodes.filter((node) => !hidden.includes(node.group ?? 0)),
    [nodes, hidden],
  );
  const liveIds = React.useMemo(() => new Set(liveNodes.map((node) => node.id)), [liveNodes]);
  const liveLinks = React.useMemo(
    () => links.filter((link) => liveIds.has(link.source) && liveIds.has(link.target)),
    [links, liveIds],
  );

  const degree = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const link of liveLinks) {
      counts[link.source] = (counts[link.source] ?? 0) + 1;
      counts[link.target] = (counts[link.target] ?? 0) + 1;
    }
    return counts;
  }, [liveLinks]);

  const neighbours = React.useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const link of liveLinks) {
      (map[link.source] ??= new Set()).add(link.target);
      (map[link.target] ??= new Set()).add(link.source);
    }
    return map;
  }, [liveLinks]);

  // Seed on a circle so the layout unfolds rather than exploding out of a point.
  React.useEffect(() => {
    const width = box.current?.clientWidth ?? 640;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.42;

    simulation.current.nodes = liveNodes.map((node, index) => {
      const existing = simulation.current.nodes.find((particle) => particle.id === node.id);
      if (existing) return { ...existing, ...node };

      const angle = (index / Math.max(liveNodes.length, 1)) * Math.PI * 2;
      return {
        ...node,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });
    simulation.current.links = liveLinks;
  }, [liveNodes, liveLinks, height]);

  /* --- The simulation ---------------------------------------------------
   * drag and pinned are read through refs, NOT dependencies. As dependencies
   * they would tear down the loop on every pointer move and reset alpha to 1,
   * so grabbing one node would re-explode the entire graph. */

  const dragRef = React.useRef(drag);
  dragRef.current = drag;
  const pinnedRef = React.useRef(pinned);
  pinnedRef.current = pinned;

  React.useEffect(() => {
    let alpha = 1;

    const step = () => {
      const particles = simulation.current.nodes;
      const width = box.current?.clientWidth ?? 640;
      const cx = width / 2;
      const cy = height / 2;
      const held = dragRef.current;

      // Repulsion, every pair. O(n²) is honest at this scale — a quadtree
      // costs more to build than it saves under ~200 nodes.
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!;
          const b = particles[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;

          // Floored at a node's width. Without it 1/d² explodes as two nodes
          // touch, the pair is fired across the canvas, and the layout never
          // settles — so the damping has to be strong enough to absorb that,
          // which is what crushed the whole graph into a knot.
          const squared = Math.max(dx * dx + dy * dy, 144);
          const distance = Math.sqrt(squared);
          const force = (charge * alpha) / squared;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Links pull towards their rest length.
      for (const link of simulation.current.links) {
        const a = particles.find((particle) => particle.id === link.source);
        const b = particles.find((particle) => particle.id === link.target);
        if (!a || !b) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = ((distance - linkDistance) / distance) * 0.045 * alpha * 10;
        const fx = dx * force * 0.1;
        const fy = dy * force * 0.1;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const particle of particles) {
        // A weak pull to the middle, so a detached cluster cannot drift away.
        // 0.0015, not 0.016: at ten times that it beat the repulsion outright
        // and every layout collapsed into a knot at the centre, whatever the
        // charge. Gravity only has to stop drift; the links do the gathering.
        particle.vx += (cx - particle.x) * 0.0015 * alpha;
        particle.vy += (cy - particle.y) * 0.0015 * alpha;

        if (held && held.id === particle.id) {
          particle.x = held.x;
          particle.y = held.y;
          particle.vx = 0;
          particle.vy = 0;
          continue;
        }
        if (pinnedRef.current.includes(particle.id)) {
          particle.vx = 0;
          particle.vy = 0;
          continue;
        }

        particle.vx *= 0.82;
        particle.vy *= 0.82;
        particle.x += particle.vx;
        particle.y += particle.vy;
      }

      // 0.997 rather than 0.992: at 60fps the faster decay reached the floor
      // in about two seconds, which is not long enough for a seeded circle to
      // open out, so the graph stayed knotted at its starting radius.
      // The floor while dragging keeps neighbours reacting to the node in
      // your hand rather than freezing once the layout has settled.
      alpha = Math.max(alpha * 0.997, held ? 0.28 : 0.06);

      redraw();
      frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [height, charge, linkDistance]);

  React.useEffect(() => {
    if (!drag && !pan) return;

    const move = (event: PointerEvent) => {
      const rect = box.current?.getBoundingClientRect();
      if (!rect) return;

      if (drag) {
        setDrag((current) =>
          current
            ? {
                ...current,
                x: (event.clientX - rect.left - view.x) / view.k,
                y: (event.clientY - rect.top - view.y) / view.k,
              }
            : current,
        );
      } else if (pan) {
        setView((current) => ({
          ...current,
          x: pan.vx + (event.clientX - pan.x0),
          y: pan.vy + (event.clientY - pan.y0),
        }));
      }
    };

    const up = () => {
      setDrag(null);
      setPan(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, pan, view.x, view.y, view.k]);

  const particles = simulation.current.nodes;

  const matches = (node: GraphNode) => !query || normalize(node.label).includes(normalize(query));

  /** The set of nodes within `focusDepth` hops of whatever is focused. */
  const ring = React.useMemo(() => {
    const focus = hover ?? selected;
    if (!focus) return null;

    const seen = new Set([focus]);
    let front = new Set([focus]);

    for (let hop = 0; hop < focusDepth; hop++) {
      const next = new Set<string>();
      for (const id of front) {
        for (const neighbour of neighbours[id] ?? []) {
          if (!seen.has(neighbour)) {
            seen.add(neighbour);
            next.add(neighbour);
          }
        }
      }
      if (next.size === 0) break;
      front = next;
    }
    return seen;
  }, [hover, selected, neighbours, focusDepth]);

  const lit = (id: string) => !ring || ring.has(id);
  const radiusOf = (node: Particle) =>
    5 + Math.min(degree[node.id] ?? 0, 8) * 1.25 + (node.size ?? 0);
  const colorOf = (node?: { group?: number }) => groupColors[(node?.group ?? 0) % groupColors.length];

  const openNode = liveNodes.find((node) => node.id === openId);
  const openLinks = openNode
    ? [...(neighbours[openNode.id] ?? [])]
        .map((id) => liveNodes.find((node) => node.id === id))
        .filter((node): node is GraphNode => Boolean(node))
    : [];

  const groupName = (node?: GraphNode) => (node ? (groups[node.group ?? 0] ?? null) : null);

  const zoom = (factor: number) =>
    setView((current) => ({ ...current, k: Math.max(0.35, Math.min(2.6, current.k * factor)) }));

  const focused = particles.find((particle) => particle.id === (hover ?? selected));

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3.5 py-3">
        {title ? (
          <span className="mr-auto text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
            {title}
          </span>
        ) : (
          <span className="mr-auto" />
        )}

        {searchable ? (
          <span className="inline-flex h-8 items-center gap-1.75 rounded-pill border border-border-subtle pl-3 pr-2.5">
            <Icon name="search" size={14} className="text-text-secondary" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.search}
              aria-label={text.search}
              className="w-[150px] border-none bg-transparent font-sans text-[13px] text-text-primary outline-none placeholder:text-text-secondary"
            />
          </span>
        ) : null}

        <span className="inline-flex gap-0.5 rounded-pill border border-border-subtle bg-surface-alt p-0.5">
          {([[1, text.oneHop], [2, text.twoHops], [99, text.all]] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setFocusDepth(value)}
              aria-pressed={focusDepth === value}
              className={cn(
                "h-6.5 rounded-pill border-none px-2.5 font-sans text-[12.5px] halo-focus",
                "transition-colors duration-[140ms] ease-standard",
                focusDepth === value
                  ? "bg-text-primary text-surface-page"
                  : "bg-transparent text-text-primary",
              )}
            >
              {label}
            </button>
          ))}
        </span>

        <span className="inline-flex gap-1">
          {(
            [
              ["minus", () => zoom(1 / 1.25), text.zoomOut],
              ["plus", () => zoom(1.25), text.zoomIn],
              ["maximize", () => setView({ x: 0, y: 0, k: 1 }), text.recentre],
            ] as const
          ).map(([icon, action, label]) => (
            <button
              key={icon}
              type="button"
              aria-label={label}
              title={label}
              onClick={action}
              className="inline-flex size-8 items-center justify-center rounded-[10px] border border-border-subtle bg-transparent text-text-primary hover:bg-surface-alt halo-focus"
            >
              <Icon name={icon} size={15} />
            </button>
          ))}
        </span>
      </div>

      <div
        ref={box}
        onPointerDown={(event) => {
          // Only the empty canvas pans. A node consumes its own pointerdown.
          const tag = (event.target as Element).tagName;
          if (event.target === event.currentTarget || tag === "svg" || tag === "line") {
            setPan({ x0: event.clientX, y0: event.clientY, vx: view.x, vy: view.y });
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          zoom(event.deltaY < 0 ? 1.08 : 1 / 1.08);
        }}
        className={cn(
          "relative touch-none overflow-hidden bg-surface-page",
          pan ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ height }}
      >
        <svg width="100%" height={height} className="block">
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {liveLinks.map((link, index) => {
              const a = particles.find((particle) => particle.id === link.source);
              const b = particles.find((particle) => particle.id === link.target);
              if (!a || !b) return null;

              const on = lit(a.id) && lit(b.id);
              return (
                <line
                  key={index}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={on ? "var(--color-text-secondary)" : "var(--color-hairline)"}
                  strokeWidth={on ? 1.1 : 0.8}
                  opacity={on ? 0.55 : 0.18}
                />
              );
            })}

            {particles.map((node) => {
              const radius = radiusOf(node);
              const on = lit(node.id) && matches(node);
              const isSelected = selected === node.id;
              const isPinned = pinned.includes(node.id);

              return (
                <g
                  key={node.id}
                  opacity={on ? 1 : 0.22}
                  className="cursor-pointer"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    const rect = box.current?.getBoundingClientRect();
                    if (!rect) return;
                    setDrag({
                      id: node.id,
                      x: (event.clientX - rect.left - view.x) / view.k,
                      y: (event.clientY - rect.top - view.y) / view.k,
                    });
                  }}
                  onMouseEnter={() => setHover(node.id)}
                  onMouseLeave={() => setHover((current) => (current === node.id ? null : current))}
                  onClick={() => {
                    setSelected(node.id);
                    if (detail) setOpenId(node.id);
                    onSelect?.(node);
                  }}
                  onDoubleClick={() =>
                    setPinned((current) =>
                      current.includes(node.id)
                        ? current.filter((id) => id !== node.id)
                        : [...current, node.id],
                    )
                  }
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + (isSelected ? 4 : 0)}
                    fill={isSelected ? "var(--color-accent)" : colorOf(node)}
                    stroke={isSelected ? "var(--color-accent-deep)" : "var(--color-surface-page)"}
                    strokeWidth={isSelected ? 2 : 1.5}
                  />

                  {isPinned ? (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius + 6}
                      fill="none"
                      stroke="var(--color-text-secondary)"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                      opacity="0.7"
                    />
                  ) : null}

                  {showLabels && (view.k > 0.7 || isSelected || hover === node.id) ? (
                    <text
                      x={node.x}
                      y={node.y + radius + 12}
                      textAnchor="middle"
                      className="pointer-events-none font-sans"
                      style={{
                        // Divided by k so the label keeps a constant size on
                        // screen as the graph zooms.
                        fontSize: 11 / Math.max(view.k, 0.8),
                        fill:
                          isSelected || hover === node.id
                            ? "var(--color-text-primary)"
                            : "var(--color-text-secondary)",
                      }}
                    >
                      {node.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>

        {focused ? (
          <span className="absolute bottom-3 left-3 inline-flex max-w-[70%] items-center gap-2 rounded-pill border border-border-subtle bg-surface-card px-3 py-2 shadow-float">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: colorOf(focused) }}
            />
            <span className="truncate text-[13px] text-text-primary">{focused.label}</span>
            <span className="shrink-0 text-[12px] tabular-nums text-text-secondary">
              {text.links(degree[focused.id] ?? 0)}
            </span>
          </span>
        ) : null}
      </div>

      {groups.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-3.5 py-2.5">
          {groups.map((group, index) => {
            const off = hidden.includes(index);
            return (
              <button
                key={group}
                type="button"
                title={off ? text.show : text.hide}
                aria-pressed={!off}
                onClick={() =>
                  setHidden((current) =>
                    off ? current.filter((entry) => entry !== index) : [...current, index],
                  )
                }
                className={cn(
                  "inline-flex h-6.5 items-center gap-1.5 rounded-pill border px-2.5 font-sans text-[12.5px] halo-focus",
                  "transition-colors duration-[140ms] ease-standard",
                  off
                    ? "border-border-subtle bg-transparent text-text-secondary opacity-60"
                    : "border-transparent bg-surface-alt text-text-primary",
                )}
              >
                <span
                  className="size-2.25 rounded-full"
                  style={{ background: groupColors[index % groupColors.length] }}
                />
                {group}
              </button>
            );
          })}
          <span className="ml-auto text-[12.5px] text-text-secondary">{text.hint}</span>
        </div>
      ) : null}

      {detail ? (
        <Drawer
          open={Boolean(openNode)}
          onClose={() => setOpenId(null)}
          width={420}
          icon="circle-dot"
          title={openNode?.label ?? ""}
          subtitle={
            openNode
              ? [groupName(openNode), text.links(degree[openNode.id] ?? 0)]
                  .filter(Boolean)
                  .join(" · ")
              : ""
          }
          footer={
            openNode ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setPinned((current) =>
                      current.includes(openNode.id)
                        ? current.filter((id) => id !== openNode.id)
                        : [...current, openNode.id],
                    )
                  }
                  className="h-10 rounded-pill border border-border-subtle bg-transparent px-4 font-sans text-[15px] text-text-primary hover:bg-surface-alt halo-focus"
                >
                  {pinned.includes(openNode.id) ? text.unpin : text.pin}
                </button>

                {onOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpen(openNode)}
                    className="h-10 rounded-pill border-none bg-accent px-4.5 font-sans text-[15px] font-medium text-accent-ink halo-focus"
                  >
                    {text.open}
                  </button>
                ) : null}
              </>
            ) : null
          }
        >
          {openNode ? (
            <div className="flex flex-col gap-4 font-sans">
              {openNode.meta ? (
                <span className="text-[13px] text-text-secondary">{openNode.meta}</span>
              ) : null}

              {openNode.body ? (
                <span className="text-pretty text-[14.5px] leading-[1.55] text-text-primary">
                  {openNode.body}
                </span>
              ) : null}

              {openNode.stats?.length ? (
                <span className="flex flex-wrap gap-2">
                  {openNode.stats.map((stat) => (
                    <span
                      key={stat.label}
                      className="flex min-w-24 flex-col gap-0.5 rounded-[14px] border border-border-subtle bg-surface-alt px-3.5 py-2.5"
                    >
                      <span className="text-[12px] text-text-secondary">{stat.label}</span>
                      <strong className="text-[19px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
                        {stat.value}
                      </strong>
                    </span>
                  ))}
                </span>
              ) : null}

              {openLinks.length ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-text-secondary">{text.linked}</span>
                  {openLinks.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        setSelected(node.id);
                        setOpenId(node.id);
                      }}
                      className={cn(
                        "flex items-center gap-2.25 rounded-[12px] border border-border-subtle bg-surface-alt px-3 py-2.5 text-left font-sans",
                        "transition-colors duration-[140ms] ease-standard hover:border-border-strong halo-focus",
                      )}
                    >
                      <span
                        className="size-2.25 shrink-0 rounded-full"
                        style={{ background: colorOf(node) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-primary">
                        {node.label}
                      </span>
                      <span className="shrink-0 text-[12px] text-text-secondary">
                        {groupName(node)}
                      </span>
                      <Icon name="arrow-right" size={15} className="text-text-secondary" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Drawer>
      ) : null}
    </div>
  );
}
