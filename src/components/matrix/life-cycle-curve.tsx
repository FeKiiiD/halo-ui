import * as React from "react";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/number-format";
import { usePlotDrag } from "../../lib/use-plot-drag";
import { MatrixFrame } from "./matrix-frame";

export interface LifeCycleItem {
  id: string;
  label: string;
  /** Position along the curve, 0–100. */
  at: number;
  value?: number;
  growth?: number;
  players?: number;
  since?: string;
}

export interface LifeCyclePhase {
  key: string;
  label: string;
  from: number;
  to: number;
  traits: string[];
}

export interface LifeCycleCurveProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  items: LifeCycleItem[];
  onChange?: (id: string, at: number) => void;
  onSelect?: (item: LifeCycleItem) => void;

  height?: number;
  editable?: boolean;
  /** The traits table under the curve. */
  traits?: boolean;
  phases?: LifeCyclePhase[];
  unit?: string;
  className?: string;
}

const defaultPhases: LifeCyclePhase[] = [
  {
    key: "launch",
    label: "Launch",
    from: 0,
    to: 22,
    traits: ["Demand to create", "Few competitors", "Thin margins", "Product effort"],
  },
  {
    key: "growth",
    label: "Growth",
    from: 22,
    to: 52,
    traits: ["Demand accelerating", "New entrants", "Margins rising", "Sales effort"],
  },
  {
    key: "maturity",
    label: "Maturity",
    from: 52,
    to: 82,
    traits: ["Demand stable", "Price competition", "Margins at their peak", "Retention effort"],
  },
  {
    key: "decline",
    label: "Decline",
    from: 82,
    to: 100,
    traits: ["Demand receding", "Exits from the market", "Margins eroding", "Exit effort"],
  },
];

/**
 * The S-curve: sales rise slowly, accelerate, plateau, then fall.
 *
 * A logistic through the first three phases, then a quadratic fall — one
 * function, so the drawn path and the marker positions can never disagree. A
 * curve drawn as a bézier and markers placed by a second formula drift apart at
 * exactly the points anyone looks at.
 */
function curveY(x: number): number {
  if (x <= 82) {
    const t = x / 82;
    return 100 - 92 / (1 + Math.exp(-11 * (t - 0.52)));
  }
  const t = (x - 82) / 18;
  return 8 + t * t * 34;
}

/** Sampled once at module scope: the shape never changes. */
const curvePath = (() => {
  let path = `M 0 ${curveY(0).toFixed(2)}`;
  for (let x = 1; x <= 100; x++) path += ` L ${x} ${curveY(x).toFixed(2)}`;
  return path;
})();

/**
 * Where each activity sits in its market's life.
 *
 * Ink line, one marker per activity, no other colour. The phases are named on
 * the axis rather than tinted as bands — a coloured background would suggest
 * the boundaries are precise, and they never are.
 */
export function LifeCycleCurve({
  title = "Industry life cycle",
  subtitle,
  items,
  onChange,
  onSelect,
  height = 300,
  editable = true,
  traits = true,
  phases = defaultPhases,
  unit = "€",
  className,
}: LifeCycleCurveProps) {
  const [hover, setHover] = React.useState<string | null>(null);

  const { plotRef, drag, start } = usePlotDrag<{ x: number }>({
    x: { max: 100, precision: 1 },
    onCommit: (id, position) => onChange?.(id, position.x),
  });

  const live = items.map((item) => (drag?.id === item.id ? { ...item, at: drag.x } : item));
  const hovered = live.find((item) => item.id === hover);

  const phaseAt = (x: number) =>
    phases.find((phase) => x >= phase.from && x <= phase.to) ?? phases[phases.length - 1]!;

  return (
    <MatrixFrame
      title={title}
      subtitle={subtitle}
      meta={`${items.length} activities`}
      className={className}
    >
      <div className="flex flex-col gap-4">
        <div
          ref={plotRef}
          className="relative touch-none overflow-hidden rounded-panel border border-hairline bg-surface-page"
          style={{ height }}
        >
          {/* Phase dividers, drawn faintly: the boundaries are approximate. */}
          {phases.slice(1).map((phase) => (
            <span
              key={phase.key}
              aria-hidden="true"
              className="absolute inset-y-0 w-px bg-hairline"
              style={{ left: `${phase.from}%` }}
            />
          ))}

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
            aria-hidden="true"
          >
            <path
              d={curvePath}
              fill="none"
              stroke="var(--color-text-primary)"
              strokeWidth="0.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {live.map((item) => {
            const dragging = drag?.id === item.id;
            const on = hover === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onPointerDown={() => {
                  if (editable) start(item.id, { x: item.at });
                }}
                onMouseEnter={() => setHover(item.id)}
                onMouseLeave={() => setHover((current) => (current === item.id ? null : current))}
                onClick={() => onSelect?.(item)}
                aria-label={item.label}
                className={cn(
                  "absolute z-2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.75 rounded-pill border",
                  "px-2.5 py-1 font-sans text-[12.5px] font-medium halo-focus",
                  "transition-[box-shadow,border-color] duration-[140ms] ease-standard",
                  on || dragging
                    ? "border-border-strong bg-surface-card shadow-float"
                    : "border-border-subtle bg-surface-card",
                  editable ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer",
                  !dragging && "transition-[left] duration-[200ms] ease-standard",
                )}
                style={{ left: `${item.at}%`, top: `${curveY(item.at)}%` }}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    on || dragging ? "bg-accent-deep" : "bg-text-primary",
                  )}
                />
                <span className="whitespace-nowrap text-text-primary">{item.label}</span>
              </button>
            );
          })}

          {hovered ? (
            <LifeCycleCard item={hovered} phase={phaseAt(hovered.at).label} unit={unit} />
          ) : null}
        </div>

        <div className="grid" style={{ gridTemplateColumns: phases.map((phase) => `${phase.to - phase.from}fr`).join(" ") }}>
          {phases.map((phase) => (
            <span
              key={phase.key}
              className="border-l border-hairline px-2 text-[12px] font-medium text-text-primary first:border-l-0"
            >
              {phase.label}
            </span>
          ))}
        </div>

        {traits ? (
          <div
            className="grid gap-x-3 gap-y-1"
            style={{ gridTemplateColumns: phases.map((phase) => `${phase.to - phase.from}fr`).join(" ") }}
          >
            {phases.map((phase) => (
              <ul key={phase.key} className="m-0 flex list-none flex-col gap-1 p-0 px-2">
                {phase.traits.map((trait) => (
                  <li
                    key={trait}
                    className="text-[11.5px] leading-[1.4] text-text-secondary"
                  >
                    {trait}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        ) : null}
      </div>
    </MatrixFrame>
  );
}

function LifeCycleCard({
  item,
  phase,
  unit,
}: {
  item: LifeCycleItem;
  phase: string;
  unit: string;
}) {
  // Flips left past the midpoint so the card never leaves the plot.
  const flip = item.at > 58;

  const rows: [string, string][] = [
    ["Phase", phase],
    ...(item.value !== undefined
      ? ([["Revenue", `${formatNumber(item.value)} ${unit}`]] as [string, string][])
      : []),
    ...(item.growth !== undefined
      ? ([["Growth", `${item.growth >= 0 ? "+" : ""}${item.growth} %`]] as [string, string][])
      : []),
    ...(item.players !== undefined
      ? ([["Players", String(item.players)]] as [string, string][])
      : []),
    ...(item.since ? ([["In market since", item.since]] as [string, string][]) : []),
  ];

  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute z-400 w-[244px] overflow-hidden rounded-panel border border-border-subtle bg-surface-card shadow-float"
      style={{
        left: `${item.at}%`,
        top: `${curveY(item.at)}%`,
        transform: `translate(${flip ? "calc(-100% - 16px)" : "16px"}, -50%)`,
      }}
    >
      <span className="block px-3.25 pb-2.25 pt-2.75 text-[14.5px] font-semibold tracking-[-0.01em] text-text-primary">
        {item.label}
      </span>

      <span className="block border-t border-hairline px-3.25 py-2">
        {rows.map(([label, value]) => (
          <span key={label} className="flex justify-between gap-3 py-0.75 text-[12.5px]">
            <span className="text-text-secondary">{label}</span>
            <span className="font-medium tabular-nums text-text-primary">{value}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
