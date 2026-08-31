import * as React from "react";
import { cn } from "../../lib/cn";
import { usePlotDrag } from "../../lib/use-plot-drag";
import { MatrixFrame } from "./matrix-frame";

export type PainGainQuadrant = "quick" | "bets" | "fill" | "sink";

export interface PainGainItem {
  id: string;
  label: string;
  /** Effort, cost, risk. 0 → `max`. */
  pain: number;
  /** Value delivered. 0 → `max`. */
  gain: number;
}

export interface PainGainMatrixProps {
  title?: React.ReactNode;
  items: PainGainItem[];
  onChange?: (id: string, position: { pain: number; gain: number }) => void;
  onSelect?: (item: PainGainItem) => void;

  height?: number;
  max?: number;
  editable?: boolean;
  painLabel?: string;
  gainLabel?: string;
  /** The ranked list under the plot. */
  list?: boolean;
  quadrantLabels?: Partial<Record<PainGainQuadrant, { label: string; hint: string }>>;
  className?: string;
}

/**
 * ONLY THE QUICK-WINS QUADRANT IS TINTED. Colouring all four turns the plot
 * into a set of boxes and makes the eye compare hues instead of positions —
 * whereas the whole point is that one corner is where the work should go.
 */
const quadrants: Record<
  PainGainQuadrant,
  { label: string; hint: string; dot: string; tint: string }
> = {
  quick: {
    label: "Quick wins",
    hint: "Little effort, high value — do these now.",
    dot: "bg-accent-deep",
    tint: "bg-[rgb(217_248_79/0.14)]",
  },
  bets: {
    label: "Big bets",
    hint: "A lot of both — plan them, do not improvise.",
    dot: "bg-info",
    tint: "bg-info-soft",
  },
  fill: {
    label: "Fill-ins",
    hint: "Little effort, little value — when there is time.",
    dot: "bg-text-secondary",
    tint: "bg-transparent",
  },
  sink: {
    label: "Money pits",
    hint: "A lot of effort, little value — drop them.",
    dot: "bg-error",
    tint: "bg-error-soft",
  },
};

/**
 * Effort on x, value on y, one dot per item.
 *
 * The ranked list under the plot orders by `gain − pain`, which is the same
 * judgement the quadrants make, stated as a sequence. A matrix says where
 * things sit; the list says what to do first.
 */
export function PainGainMatrix({
  title = "Pain / gain",
  items,
  onChange,
  onSelect,
  height = 380,
  max = 10,
  editable = true,
  painLabel = "Pain — effort, cost, risk",
  gainLabel = "Gain — value delivered",
  list = true,
  quadrantLabels,
  className,
}: PainGainMatrixProps) {
  const [hover, setHover] = React.useState<string | null>(null);

  const { plotRef, drag, start } = usePlotDrag<{ x: number; y: number }>({
    x: { max, precision: 1 },
    y: { max, precision: 1 },
    onCommit: (id, position) => onChange?.(id, { pain: position.x, gain: position.y }),
  });

  const live = items.map((item) =>
    drag?.id === item.id ? { ...item, pain: drag.x, gain: drag.y } : item,
  );

  const quadrantOf = (item: PainGainItem): PainGainQuadrant =>
    item.gain >= max / 2 ? (item.pain < max / 2 ? "quick" : "bets") : item.pain < max / 2 ? "fill" : "sink";

  // Highest value for the least effort first.
  const ranked = [...live].sort((a, b) => b.gain - b.pain - (a.gain - a.pain));

  const zone = (key: PainGainQuadrant, className: string) => {
    const meta = { ...quadrants[key], ...quadrantLabels?.[key] };
    return (
      <span
        className={cn(
          "pointer-events-none absolute flex flex-col gap-0.5 p-2.5",
          quadrants[key].tint,
          className,
        )}
      >
        <span className="inline-flex items-center gap-1.25 text-[12px] font-medium">
          <span className={cn("size-1.75 rounded-full", quadrants[key].dot)} />
          <span
            className={cn(
              key === "quick"
                ? "text-accent-deep"
                : key === "bets"
                  ? "text-info"
                  : key === "sink"
                    ? "text-error"
                    : "text-text-secondary",
            )}
          >
            {meta.label}
          </span>
        </span>
        <span className="max-w-[170px] text-[11px] leading-[1.35] text-text-secondary">
          {meta.hint}
        </span>
      </span>
    );
  };

  return (
    <MatrixFrame title={title} meta={`${items.length} items`} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex">
          <span
            className="inline-flex shrink-0 items-center justify-center pr-2 text-[12px] text-text-secondary"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {gainLabel}
          </span>

          <div
            ref={plotRef}
            className="relative min-w-0 flex-1 touch-none overflow-hidden rounded-panel border border-hairline bg-surface-page"
            style={{ height }}
          >
            {zone("quick", "left-0 top-0 h-1/2 w-1/2")}
            {zone("bets", "right-0 top-0 h-1/2 w-1/2 items-end text-right")}
            {zone("fill", "bottom-0 left-0 h-1/2 w-1/2")}
            {zone("sink", "bottom-0 right-0 h-1/2 w-1/2 items-end text-right")}

            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-hairline" />
            <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-hairline" />

            {live.map((item) => {
              const dragging = drag?.id === item.id;
              const on = hover === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onPointerDown={() => {
                    if (editable) start(item.id, { x: item.pain, y: item.gain });
                  }}
                  onMouseEnter={() => setHover(item.id)}
                  onMouseLeave={() => setHover((current) => (current === item.id ? null : current))}
                  onClick={() => onSelect?.(item)}
                  aria-label={item.label}
                  className={cn(
                    "absolute z-2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-pill border",
                    "px-2.5 py-1 font-sans text-[12.5px] font-medium halo-focus",
                    "transition-[box-shadow,background-color] duration-[140ms] ease-standard",
                    on || dragging
                      ? "border-border-strong bg-surface-card shadow-float"
                      : "border-border-subtle bg-surface-card",
                    editable ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer",
                    !dragging && "transition-[left,top] duration-[200ms] ease-standard",
                  )}
                  style={{
                    left: `${(item.pain / max) * 100}%`,
                    top: `${(1 - item.gain / max) * 100}%`,
                  }}
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", quadrants[quadrantOf(item)].dot)}
                  />
                  <span className="whitespace-nowrap text-text-primary">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pl-6 text-center text-[12px] text-text-secondary">{painLabel}</div>

        {list ? (
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {ranked.map((item, index) => (
              <li
                key={item.id}
                onMouseEnter={() => setHover(item.id)}
                onMouseLeave={() => setHover((current) => (current === item.id ? null : current))}
                onClick={() => onSelect?.(item)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border border-border-subtle px-3 py-2 text-[13px]",
                  "transition-colors duration-[140ms] ease-standard",
                  hover === item.id ? "bg-surface-alt" : "bg-transparent",
                  onSelect ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span className="w-4 shrink-0 tabular-nums text-text-secondary">{index + 1}</span>
                <span
                  className={cn("size-2 shrink-0 rounded-full", quadrants[quadrantOf(item)].dot)}
                />
                <span className="truncate font-medium text-text-primary">{item.label}</span>
                <span className="ml-auto shrink-0 tabular-nums text-text-secondary">
                  {item.gain.toFixed(1)} / {item.pain.toFixed(1)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </MatrixFrame>
  );
}
