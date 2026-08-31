import * as React from "react";
import { cn } from "../../lib/cn";
import { formatCompact, formatNumber, useReveal } from "../../lib/chart";

export interface FunnelStep {
  label: string;
  value: number;
  color?: string;
}

export interface FunnelChartProps {
  steps: FunnelStep[];
  height?: number;
  gap?: number;
  format?: (value: number) => string;
  /** The loss line between bands. */
  showDrop?: boolean;
  dropLabel?: (percent: string, from: string) => string;
  /** Marks the final step in the highlight colour — the outcome that matters. */
  highlightLast?: boolean;
  className?: string;
}

/**
 * Conversion between steps.
 *
 * BANDS, NOT A TAPERED FUNNEL. A drawn funnel encodes its values in a trapezoid
 * whose area nobody can compare; horizontal bands share one baseline, so the
 * widths are directly comparable and the labels stay horizontal.
 *
 * The drop-off between bands is the whole point of the chart, which is why it
 * is called out in words rather than left to be inferred from two widths.
 */
export function FunnelChart({
  steps,
  height = 62,
  gap = 10,
  format = formatCompact,
  showDrop = true,
  dropLabel = (percent, from) => `${percent} % lost since “${from}”`,
  highlightLast = true,
  className,
}: FunnelChartProps) {
  const progress = useReveal(720, [steps.length]);
  const [active, setActive] = React.useState<number | null>(null);

  const top = steps[0]?.value || 1;

  return (
    <div className={cn("flex flex-col font-sans", className)} style={{ gap }}>
      {steps.map((step, index) => {
        const share = (step.value || 0) / top;
        const previous = index ? (steps[index - 1]!.value || 1) : null;
        const drop = previous ? 1 - (step.value || 0) / previous : null;
        const last = index === steps.length - 1;

        const color =
          step.color ??
          (last && highlightLast
            ? "var(--chart-highlight)"
            : index === 0
              ? "var(--chart-1)"
              : `var(--chart-${Math.min(4, index + 1)})`);

        // The label sits on the band when the band is wide enough to hold it,
        // and on the track when it is not — which is why the colour flips.
        const onBand = share > 0.34;
        const valueOnBand = share > 0.9;

        const bandText = last && highlightLast ? "text-ink" : index === 0 ? "text-surface-page" : "text-paper";

        return (
          <div key={step.label}>
            <div
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              className="relative overflow-hidden rounded-chip bg-surface-sunken"
              style={{ height }}
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-chip",
                  "transition-[width,opacity] duration-[240ms] ease-standard",
                  active !== null && active !== index && "opacity-70",
                )}
                style={{
                  // A 2% floor keeps a near-zero step visible as a stub.
                  width: `${Math.max(2, share * 100 * progress)}%`,
                  background: color,
                }}
              />

              <div className="relative flex h-full items-center gap-3 px-4">
                <span
                  className={cn(
                    "text-[14px] font-medium",
                    onBand ? bandText : "text-text-primary",
                  )}
                >
                  {step.label}
                </span>

                <span
                  className={cn(
                    "ml-auto flex items-baseline gap-2 tabular-nums",
                    valueOnBand ? bandText : "text-text-primary",
                  )}
                >
                  <strong className="text-[19px] font-medium tracking-[-0.01em]">
                    {format(step.value)}
                  </strong>
                  <span className="text-[12px] opacity-75">
                    {formatNumber(share * 100, share < 0.1 ? 1 : 0)} %
                  </span>
                </span>
              </div>
            </div>

            {showDrop && drop !== null ? (
              <div className="flex items-center gap-1.5 px-4 pt-1.5 text-[12px] text-text-secondary">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d="M6 2v7.4M6 9.4 2.8 6.2M6 9.4l3.2-3.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {dropLabel(formatNumber(drop * 100, 1), steps[index - 1]!.label)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
