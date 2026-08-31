import * as React from "react";
import { areaPath, linePath, useReveal, useWidth, type Point } from "../../lib/chart";

export interface SparklineProps {
  values: number[];
  /** Fixed width in px. Omit to fill the container. */
  width?: number;
  height?: number;
  color?: string;
  /** A soft fill under the line. */
  area?: boolean;
  smooth?: boolean;
  /** Marks the final value in the highlight colour. */
  showLast?: boolean;
  bars?: boolean;
  dots?: boolean;
  strokeWidth?: number;
  className?: string;
}

/**
 * Trend at a glance, inside a stat block or a table row.
 *
 * NO AXES, NO TOOLTIP, NO LEGEND. A sparkline says direction, not values —
 * the figure beside it says the value. Adding an axis to one makes a bad
 * chart out of a good ornament.
 *
 * It is `aria-hidden`: the number it accompanies is the accessible content,
 * and a screen reader gains nothing from "graphic".
 */
export function Sparkline({
  values,
  width,
  height = 36,
  color = "var(--chart-1)",
  area = true,
  smooth = true,
  showLast = true,
  bars = false,
  dots = false,
  strokeWidth = 2,
  className,
}: SparklineProps) {
  const [ref, measured] = useWidth(width ?? 120);
  const progress = useReveal(600, [values.length]);

  const w = width ?? measured;
  // Zero is always in range so a series of small positive numbers does not
  // exaggerate its own variation.
  const low = Math.min(...values, 0);
  const high = Math.max(...values, 1);
  const span = high - low || 1;

  // The stroke has width; without padding, the first and last points clip.
  const pad = strokeWidth + 1;
  const x = (index: number) =>
    values.length <= 1 ? w / 2 : ((w - pad * 2) * index) / (values.length - 1) + pad;
  const y = (value: number) => height - pad - ((height - pad * 2) * (value - low)) / span;

  const points: Point[] = values.map((value, index) => [x(index), y(value)]);
  const last = points[points.length - 1];

  const svgProps = {
    width: "100%",
    height,
    viewBox: `0 0 ${w} ${height}`,
    className: "block",
    "aria-hidden": true as const,
  };

  if (dots) {
    return (
      <div ref={ref} className={className} style={{ width: width ?? "100%" }}>
        <svg {...svgProps}>
          {points.map(([px, py], index) => {
            const isLast = index === values.length - 1;
            return (
              <circle
                key={index}
                cx={px}
                cy={py}
                r={(isLast ? strokeWidth + 1.2 : strokeWidth) * progress}
                fill={showLast && isLast ? "var(--chart-highlight)" : color}
                opacity={showLast && isLast ? 1 : 0.55}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  if (bars) {
    const barWidth = Math.max(2, (w - pad * 2) / Math.max(1, values.length) - 2);

    return (
      <div ref={ref} className={className} style={{ width: width ?? "100%" }}>
        <svg {...svgProps}>
          {values.map((value, index) => {
            // A floor of 1px, so a zero value still reads as a bar rather than
            // as missing data.
            const barHeight = Math.max(1, (height - pad * 2) * ((value - low) / span) * progress);
            const isLast = index === values.length - 1;

            return (
              <rect
                key={index}
                x={x(index) - barWidth / 2}
                y={height - pad - barHeight}
                width={barWidth}
                height={barHeight}
                rx={Math.min(2, barWidth / 2)}
                fill={showLast && isLast ? "var(--chart-highlight)" : color}
                opacity={showLast && isLast ? 1 : 0.55}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div ref={ref} className={className} style={{ width: width ?? "100%" }}>
      <svg {...svgProps}>
        {area ? <path d={areaPath(points, height, smooth)} fill={color} opacity={0.12 * progress} /> : null}

        {/* pathLength normalises the dash to 1 regardless of the real path
            length, so the draw-in takes the same time whatever the data. */}
        <path
          d={linePath(points, smooth)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          style={{ strokeDasharray: 1, strokeDashoffset: 1 - progress }}
        />

        {showLast && last ? (
          <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.6} fill={color} opacity={progress} />
        ) : null}
      </svg>
    </div>
  );
}
