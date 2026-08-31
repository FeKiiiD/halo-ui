import * as React from "react";
import {
  areaPath,
  axisTextProps,
  formatCompact,
  linePath,
  niceMax,
  seriesColors,
  ticks,
  useReveal,
  useWidth,
  type Point,
} from "../../lib/chart";
import { ChartTooltip } from "./chart-frame";

export interface ChartSeries {
  name: string;
  values: number[];
  color?: string;
  /** Draws thinner — for a comparison or a previous period. */
  emphasis?: false;
  dashed?: boolean;
}

export interface ChartPadding {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export interface LineChartProps {
  series: ChartSeries[];
  labels?: string[];
  height?: number;
  area?: boolean;
  smooth?: boolean;
  stacked?: boolean;

  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  yTicks?: number;
  /** Label every nth point. Defaults to about eight labels across. */
  xEvery?: number;
  /** A dashed reference line. */
  target?: number;
  targetLabel?: string;
  /** Series names to hide, from a legend toggle. */
  hidden?: string[];

  padding?: ChartPadding;
  className?: string;
}

/**
 * A line or area chart over time.
 *
 * ONE CROSSHAIR, ONE TOOLTIP. Hovering anywhere in the plot snaps to the
 * nearest x and reads out every visible series at once — never one tooltip per
 * series, which turns a three-series chart into a game of pointer accuracy.
 *
 * The x hit-test is a rounding, not a hover target: there is nothing to miss,
 * and the read-out follows the pointer continuously.
 */
export function LineChart({
  series,
  labels = [],
  height = 240,
  area = false,
  smooth = true,
  stacked = false,
  formatValue = formatCompact,
  formatTick = formatCompact,
  yTicks = 4,
  xEvery,
  target,
  targetLabel = "Target",
  hidden = [],
  padding,
  className,
}: LineChartProps) {
  const [ref, width] = useWidth();
  const progress = useReveal(760, [series.length, labels.length]);
  const [active, setActive] = React.useState<number | null>(null);

  const padLeft = padding?.left ?? 44;
  const padRight = padding?.right ?? 8;
  const padTop = padding?.top ?? 10;
  const padBottom = padding?.bottom ?? 26;

  const live = series.filter((entry) => !hidden.includes(entry.name));
  const count = labels.length || live[0]?.values.length || 0;

  const innerWidth = Math.max(40, width - padLeft - padRight);
  const innerHeight = Math.max(40, height - padTop - padBottom);

  const stackTotal = (index: number) =>
    live.reduce((sum, entry) => sum + (entry.values[index] ?? 0), 0);

  const peak = niceMax(
    Math.max(
      1,
      ...(stacked
        ? Array.from({ length: count }, (_, index) => stackTotal(index))
        : live.flatMap((entry) => entry.values.map((value) => value ?? 0))),
      target ?? 0,
    ),
  );

  const x = (index: number) =>
    padLeft + (count <= 1 ? innerWidth / 2 : (innerWidth * index) / (count - 1));
  const y = (value: number) => padTop + innerHeight - (innerHeight * (value ?? 0)) / peak;

  // Running total, so a stacked series sits on the one below it.
  const accumulated = new Array(count).fill(0);
  const shapes = live.map((entry, seriesIndex) => {
    const color = entry.color ?? seriesColors[seriesIndex % seriesColors.length]!;
    const points: Point[] = Array.from({ length: count }, (_, index) => {
      if (!stacked) return [x(index), y(entry.values[index] ?? 0)];
      accumulated[index] += entry.values[index] ?? 0;
      return [x(index), y(accumulated[index])];
    });
    return { entry, color, points };
  });

  const labelStep = xEvery ?? Math.max(1, Math.ceil(count / 8));

  return (
    <div ref={ref} className={className} style={{ position: "relative", width: "100%" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        className="block overflow-visible"
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = event.clientX - box.left;
          const index = Math.round(((px - padLeft) / innerWidth) * (count - 1));
          setActive(Math.max(0, Math.min(count - 1, index)));
        }}
        onMouseLeave={() => setActive(null)}
      >
        {ticks(peak, yTicks).map((value, index) => (
          <g key={index}>
            <line
              x1={padLeft}
              x2={padLeft + innerWidth}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--chart-grid)"
              strokeWidth="1"
            />
            <text x={padLeft - 10} y={y(value) + 4} textAnchor="end" {...axisTextProps}>
              {formatTick(value)}
            </text>
          </g>
        ))}

        {target !== undefined ? (
          <g>
            <line
              x1={padLeft}
              x2={padLeft + innerWidth}
              y1={y(target)}
              y2={y(target)}
              stroke="var(--chart-1)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              opacity="0.5"
            />
            <text
              x={padLeft + innerWidth}
              y={y(target) - 6}
              textAnchor="end"
              {...axisTextProps}
              fill="var(--color-text-primary)"
            >
              {targetLabel}
            </text>
          </g>
        ) : null}

        {labels.map((label, index) =>
          index % labelStep === 0 || index === count - 1 ? (
            <text
              key={index}
              x={x(index)}
              y={height - 6}
              // The first and last labels anchor inward so they do not hang off
              // the plot.
              textAnchor={index === 0 ? "start" : index === count - 1 ? "end" : "middle"}
              {...axisTextProps}
            >
              {label}
            </text>
          ) : null,
        )}

        {active !== null ? (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={padTop}
            y2={padTop + innerHeight}
            stroke="var(--chart-crosshair)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        ) : null}

        {area
          ? shapes.map(({ entry, color, points }, index) => (
              <path
                key={`area-${entry.name}`}
                d={areaPath(points, padTop + innerHeight, smooth)}
                fill={color}
                // Stacked areas are opaque because they must read as bands;
                // overlaid ones are faint so the lines stay legible through them.
                opacity={(stacked ? 0.85 : index === 0 ? 0.16 : 0.1) * progress}
                style={{ transition: "opacity 200ms var(--ease-standard)" }}
              />
            ))
          : null}

        {shapes.map(({ entry, color, points }) => (
          <path
            key={entry.name}
            d={linePath(points, smooth)}
            fill="none"
            stroke={color}
            strokeWidth={entry.emphasis === false ? 1.5 : 2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            // A dashed series cannot also draw itself in — the two dash arrays
            // would fight. It fades with the rest instead.
            style={
              entry.dashed
                ? { strokeDasharray: "6 5", opacity: progress }
                : { strokeDasharray: 1, strokeDashoffset: 1 - progress }
            }
          />
        ))}

        {active !== null
          ? shapes.map(({ entry, color, points }) => {
              const point = points[active];
              if (!point) return null;
              return (
                <circle
                  key={`dot-${entry.name}`}
                  cx={point[0]}
                  cy={point[1]}
                  r="4.5"
                  fill="var(--color-surface-card)"
                  stroke={color}
                  strokeWidth="2.5"
                />
              );
            })
          : null}
      </svg>

      {active !== null && shapes.length ? (
        <ChartTooltip
          x={x(active)}
          y={padTop + innerHeight / 2}
          title={labels[active]}
          rows={shapes.map(({ entry, color }) => ({
            label: entry.name,
            color,
            value: formatValue(entry.values[active] ?? 0),
          }))}
        />
      ) : null}
    </div>
  );
}
