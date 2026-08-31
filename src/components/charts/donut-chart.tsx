import * as React from "react";
import { cn } from "../../lib/cn";
import { donutSlice, formatCompact, formatNumber, seriesColors, useReveal } from "../../lib/chart";

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  /** Ring width in px. `null` renders a filled pie. */
  thickness?: number | null;
  /** Radians of empty space between slices. */
  gapAngle?: number;

  centerLabel?: React.ReactNode;
  centerValue?: React.ReactNode;
  format?: (value: number) => string;
  showPercent?: boolean;
  legend?: "right" | "bottom" | "none";
  onSelect?: (label: string) => void;
  className?: string;
}

/**
 * Composition of a whole.
 *
 * THE CENTRE IS THE POINT of a donut: hovering a slice pulls it out slightly
 * and swaps the read-out, so the ring answers "how much is this one" without a
 * tooltip covering the chart. A pie (thickness null) has nowhere to put that,
 * which is why the donut is the default.
 *
 * Above about six slices this becomes unreadable whatever the styling — use a
 * horizontal BarChart instead.
 */
export function DonutChart({
  data,
  size = 220,
  thickness = 26,
  gapAngle = 0.014,
  centerLabel,
  centerValue,
  format = formatCompact,
  showPercent = true,
  legend = "right",
  onSelect,
  className,
}: DonutChartProps) {
  const progress = useReveal(720, [data.length]);
  const [active, setActive] = React.useState<number | null>(null);

  const total = data.reduce((sum, datum) => sum + (datum.value || 0), 0) || 1;
  const radius = size / 2;
  const innerRadius = thickness === null ? 0 : radius - thickness;

  // Starts at twelve o'clock: a ring beginning at three reads as rotated.
  let angle = -Math.PI / 2;
  const slices = data.map((datum, index) => {
    const span = ((datum.value || 0) / total) * Math.PI * 2 * progress;
    const slice = {
      datum,
      index,
      from: angle + gapAngle / 2,
      // A floor of gapAngle, so a tiny slice is still a visible sliver rather
      // than disappearing into the gap.
      to: angle + Math.max(gapAngle, span) - gapAngle / 2,
      color: datum.color ?? seriesColors[index % seriesColors.length]!,
    };
    angle += span;
    return slice;
  });

  const hovered = active !== null ? data[active] : null;

  return (
    <div
      className={cn(
        "flex items-center gap-6 font-sans",
        legend === "bottom" ? "flex-col" : "flex-row",
        className,
      )}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          className="block overflow-visible"
        >
          {slices.map((slice) => {
            const pull = active === slice.index ? 4 : 0;
            const mid = (slice.from + slice.to) / 2;

            return (
              <path
                key={slice.datum.label}
                d={donutSlice(radius, radius, radius - 1, innerRadius, slice.from, slice.to)}
                fill={slice.color}
                transform={
                  pull
                    ? `translate(${Math.cos(mid) * pull} ${Math.sin(mid) * pull})`
                    : undefined
                }
                opacity={active !== null && active !== slice.index ? 0.55 : 1}
                onMouseEnter={() => setActive(slice.index)}
                onMouseLeave={() => setActive(null)}
                onClick={() => onSelect?.(slice.datum.label)}
                className={cn(
                  "transition-[opacity,transform] duration-[160ms] ease-standard",
                  onSelect ? "cursor-pointer" : "cursor-default",
                )}
              />
            );
          })}
        </svg>

        {thickness !== null ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              className="text-[12px] text-text-secondary"
              style={{ maxWidth: size - thickness * 2 - 8 }}
            >
              {hovered ? hovered.label : centerLabel}
            </span>
            <span className="text-[26px] font-medium leading-[1.2] tracking-[-0.02em] tabular-nums">
              {hovered ? format(hovered.value) : (centerValue ?? format(total))}
            </span>
            {hovered && showPercent ? (
              <span className="text-[12px] text-text-secondary">
                {formatNumber((hovered.value / total) * 100, 1)} %
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {legend !== "none" ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {data.map((datum, index) => (
            <div
              key={datum.label}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              className={cn(
                "flex items-center gap-2.25 text-[13px] transition-opacity duration-[140ms] ease-standard",
                active !== null && active !== index && "opacity-55",
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: datum.color ?? seriesColors[index % seriesColors.length] }}
              />
              <span className="truncate">{datum.label}</span>
              <span className="ml-auto font-medium tabular-nums">{format(datum.value)}</span>
              {showPercent ? (
                <span className="w-11 text-right tabular-nums text-text-secondary">
                  {formatNumber((datum.value / total) * 100, 0)} %
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
