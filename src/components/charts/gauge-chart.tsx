import * as React from "react";
import { cn } from "../../lib/cn";
import { formatNumber, useReveal } from "../../lib/chart";

export interface GaugeSegment {
  from: number;
  to: number;
  color: string;
}

export interface GaugeChartProps {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  label?: React.ReactNode;
  caption?: React.ReactNode;
  format?: (value: number) => string;
  unit?: string;
  /** `accent` is the default; `ink` for a figure that is not the goal. */
  tone?: "accent" | "ink" | "success" | "warning" | "error";
  /** Thin bands on the track: acceptable ranges, thresholds. */
  segments?: GaugeSegment[];
  className?: string;
}

/**
 * Progress toward one objective.
 *
 * THE ONE CHART WHERE THE ACCENT COVERS A WHOLE SHAPE, because the shape is
 * small and singular — a single arc reading one number. The accent rule is
 * about not spending the colour on large surfaces or on several things at
 * once; a gauge is neither.
 *
 * The arc spans 240°, not a full circle: the gap at the bottom is what makes
 * the ends readable as a start and an end rather than as a ring.
 */
export function GaugeChart({
  value,
  max = 100,
  size = 200,
  thickness = 14,
  label,
  caption,
  format = (input) => formatNumber(input),
  unit,
  tone = "accent",
  segments,
  className,
}: GaugeChartProps) {
  const progress = useReveal(760, [value, max]);
  const ratio = Math.max(0, Math.min(1, (value || 0) / (max || 1)));

  const span = Math.PI * 1.34;
  const start = Math.PI / 2 + (Math.PI * 2 - span) / 2;
  const radius = size / 2 - thickness / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;

  const polar = (angle: number, r: number): [number, number] => [
    cx + r * Math.cos(angle),
    cy + r * Math.sin(angle),
  ];

  const arcPath = (from: number, to: number) => {
    const [x0, y0] = polar(from, radius);
    const [x1, y1] = polar(to, radius);
    return `M${x0} ${y0} A${radius} ${radius} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };

  const fill =
    tone === "accent"
      ? "var(--chart-highlight)"
      : tone === "ink"
        ? "var(--chart-1)"
        : `var(--color-${tone})`;

  const end = start + span * ratio * progress;

  return (
    <div
      className={cn("relative font-sans", className)}
      style={{ width: size, height: size * 0.78 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        className="block overflow-visible"
      >
        <path
          d={arcPath(start, start + span)}
          fill="none"
          stroke="var(--color-surface-sunken)"
          strokeWidth={thickness}
          strokeLinecap="round"
        />

        {segments?.map((segment, index) => (
          <path
            key={index}
            d={arcPath(start + span * (segment.from / max), start + span * (segment.to / max))}
            fill="none"
            stroke={segment.color}
            strokeWidth={2}
            opacity="0.6"
          />
        ))}

        {/* A hair of length even at zero, so the rounded cap is visible and the
            gauge does not look broken before it animates. */}
        <path
          d={arcPath(start, Math.max(start + 0.001, end))}
          fill="none"
          stroke={fill}
          strokeWidth={thickness}
          strokeLinecap="round"
        />

        {ratio > 0 ? (
          <circle
            cx={polar(end, radius)[0]}
            cy={polar(end, radius)[1]}
            r={thickness / 2 + 2.5}
            fill="var(--color-surface-card)"
            stroke={fill}
            strokeWidth="2.5"
          />
        ) : null}
      </svg>

      <div
        className="pointer-events-none absolute inset-x-0 -translate-y-1/2 text-center"
        style={{ top: cy }}
      >
        <div className="text-[32px] font-medium leading-none tracking-[-0.02em] tabular-nums">
          {format(value)}
          {unit ? <span className="ml-0.75 text-[17px] text-text-secondary">{unit}</span> : null}
        </div>
        {label ? <div className="mt-1.25 text-[13px] text-text-secondary">{label}</div> : null}
      </div>

      {caption ? (
        <div className="absolute inset-x-0 bottom-0 text-center text-[12px] text-text-secondary">
          {caption}
        </div>
      ) : null}
    </div>
  );
}
