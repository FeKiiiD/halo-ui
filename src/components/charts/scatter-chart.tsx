import * as React from "react";
import {
  axisTextProps,
  formatCompact,
  niceMax,
  seriesColors,
  ticks,
  useReveal,
  useWidth,
} from "../../lib/chart";
import { ChartTooltip } from "./chart-frame";
import type { ChartPadding } from "./line-chart";

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  /** Radius in px — makes this a bubble chart, encoding a third measure. */
  r?: number;
  /** What `r` represents, for the tooltip. */
  rLabel?: string;
  rValue?: number;
  /** Index into the series palette. */
  group?: number;
  color?: string;
}

export interface ScatterChartProps {
  points: ScatterPoint[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  xMax?: number;
  yMax?: number;
  ticksX?: number;
  ticksY?: number;
  radius?: number;
  /** A least-squares line through the points. */
  trend?: boolean;
  padding?: ChartPadding;
  className?: string;
}

/**
 * Two measures against each other, one dot per record: visits against spend,
 * frequency against basket.
 *
 * Pass `r` on a point for a bubble chart. Bubbles are drawn at 72% opacity
 * rather than 90% so overlaps stay readable — with a third measure, the points
 * are larger and overlap is the normal case, not the exception.
 *
 * The trend line is least-squares and is clamped to the plot, so a steep fit
 * does not draw outside the axes.
 */
export function ScatterChart({
  points,
  height = 260,
  xLabel,
  yLabel,
  formatX = formatCompact,
  formatY = formatCompact,
  xMax,
  yMax,
  ticksX = 4,
  ticksY = 4,
  radius = 5,
  trend = false,
  padding,
  className,
}: ScatterChartProps) {
  const [ref, width] = useWidth();
  const progress = useReveal(680, [points.length]);
  const [active, setActive] = React.useState<number | null>(null);

  // Wider by default than the other charts: the rotated y label lives here.
  const padLeft = padding?.left ?? (yLabel ? 60 : 46);
  const padRight = padding?.right ?? 12;
  const padTop = padding?.top ?? 12;
  const padBottom = padding?.bottom ?? 34;

  const innerWidth = Math.max(40, width - padLeft - padRight);
  const innerHeight = Math.max(40, height - padTop - padBottom);

  const peakX = niceMax(xMax || Math.max(1, ...points.map((point) => point.x)));
  const peakY = niceMax(yMax || Math.max(1, ...points.map((point) => point.y)));

  const toX = (value: number) => padLeft + (innerWidth * value) / peakX;
  const toY = (value: number) => padTop + innerHeight - (innerHeight * value) / peakY;

  /** Least squares: y = a + bx. */
  const line = React.useMemo(() => {
    if (!trend || points.length < 2) return null;

    const n = points.length;
    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);
    const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);

    // A vertical cloud has no slope; the guard keeps it flat rather than NaN.
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / n;

    return { y0: intercept, y1: intercept + slope * peakX };
  }, [trend, points, peakX]);

  const activePoint = active !== null ? points[active] : null;

  return (
    <div ref={ref} className={className} style={{ position: "relative", width: "100%" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        className="block overflow-visible"
      >
        {ticks(peakY, ticksY).map((value, index) => (
          <g key={`y-${index}`}>
            <line
              x1={padLeft}
              x2={padLeft + innerWidth}
              y1={toY(value)}
              y2={toY(value)}
              stroke="var(--chart-grid)"
            />
            <text x={padLeft - 10} y={toY(value) + 4} textAnchor="end" {...axisTextProps}>
              {formatY(value)}
            </text>
          </g>
        ))}

        {ticks(peakX, ticksX).map((value, index) => (
          <text
            key={`x-${index}`}
            x={toX(value)}
            y={padTop + innerHeight + 18}
            textAnchor="middle"
            {...axisTextProps}
          >
            {formatX(value)}
          </text>
        ))}

        {line ? (
          <line
            x1={toX(0)}
            y1={toY(Math.max(0, Math.min(peakY, line.y0)))}
            x2={toX(peakX)}
            y2={toY(Math.max(0, Math.min(peakY, line.y1)))}
            stroke="var(--chart-1)"
            strokeWidth="1.5"
            strokeDasharray="6 5"
            opacity={0.45 * progress}
          />
        ) : null}

        {points.map((point, index) => {
          const on = active === index;
          return (
            <circle
              key={point.label ?? index}
              cx={toX(point.x)}
              cy={toY(point.y)}
              r={(point.r ?? radius) * (on ? 1.35 : 1) * progress}
              fill={point.color ?? seriesColors[(point.group ?? 0) % seriesColors.length]}
              opacity={active !== null && !on ? 0.45 : point.r ? 0.72 : 0.9}
              stroke={on ? "var(--color-border-strong)" : "none"}
              strokeWidth="1.5"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              className="transition-[r,opacity] duration-[140ms] ease-standard"
            />
          );
        })}

        {xLabel ? (
          <text x={padLeft + innerWidth} y={height - 2} textAnchor="end" {...axisTextProps}>
            {xLabel}
          </text>
        ) : null}

        {/* Rotated up the axis rather than sitting above it: at padTop the
            label lands on the topmost tick and the two overlap. */}
        {yLabel ? (
          <text
            x={12}
            y={padTop + innerHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 12 ${padTop + innerHeight / 2})`}
            {...axisTextProps}
          >
            {yLabel}
          </text>
        ) : null}
      </svg>

      {activePoint ? (
        <ChartTooltip
          x={toX(activePoint.x)}
          y={toY(activePoint.y)}
          title={activePoint.label}
          rows={[
            { label: xLabel ?? "x", value: formatX(activePoint.x) },
            { label: yLabel ?? "y", value: formatY(activePoint.y) },
            ...(activePoint.r
              ? [
                  {
                    label: activePoint.rLabel ?? "size",
                    value: formatCompact(activePoint.rValue ?? activePoint.r),
                  },
                ]
              : []),
          ]}
        />
      ) : null}
    </div>
  );
}
