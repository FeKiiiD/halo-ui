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
import type { ChartPadding, ChartSeries } from "./line-chart";

export interface BarChartProps {
  series: ChartSeries[];
  labels?: string[];
  height?: number;
  layout?: "vertical" | "horizontal";
  stacked?: boolean;

  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  yTicks?: number;
  hidden?: string[];

  /**
   * Names the one bar that carries the accent — by label or by index. The
   * accent rule holds inside a chart: one bar, not a palette.
   */
  highlight?: string | number;
  target?: number;

  radius?: number;
  /** Share of each band left empty, 0–1. */
  gap?: number;
  /** Pixels between grouped bars. */
  groupGap?: number;

  padding?: ChartPadding;
  className?: string;
}

/**
 * Bars: one series or several, grouped or stacked, vertical or horizontal.
 *
 * HORIZONTAL IS FOR LONG CATEGORY NAMES. A vertical chart with rotated labels
 * is a chart nobody reads; turning it on its side gives every label a full line
 * of its own. That is why the left padding widens automatically in that layout.
 *
 * Hovering a bar dims the others rather than highlighting the one — the eye
 * finds the bright thing faster than it finds the changed thing.
 */
export function BarChart({
  series,
  labels = [],
  height = 240,
  layout = "vertical",
  stacked = false,
  formatValue = formatCompact,
  formatTick = formatCompact,
  yTicks = 4,
  hidden = [],
  highlight,
  target,
  radius = 5,
  gap = 0.34,
  groupGap = 3,
  padding,
  className,
}: BarChartProps) {
  const [ref, width] = useWidth();
  const progress = useReveal(700, [series.length, labels.length, layout, stacked]);
  const [active, setActive] = React.useState<number | null>(null);

  const horizontal = layout === "horizontal";
  // Category names need room when they sit to the left of the bars.
  const padLeft = horizontal ? Math.max(padding?.left ?? 44, 96) : (padding?.left ?? 44);
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

  const band = (horizontal ? innerHeight : innerWidth) / Math.max(1, count);
  const slot = band * (1 - gap);
  const thickness =
    stacked || live.length === 1 ? slot : (slot - groupGap * (live.length - 1)) / live.length;

  const bandStart = (index: number) =>
    (horizontal ? padTop : padLeft) + band * index + (band - slot) / 2;

  /** Length of a bar, in px, scaled by the reveal. */
  const scale = (value: number) =>
    ((value ?? 0) / peak) * (horizontal ? innerWidth : innerHeight) * progress;
  /** The same, unanimated — for gridlines, which must not move. */
  const position = (value: number) =>
    ((value ?? 0) / peak) * (horizontal ? innerWidth : innerHeight);

  const bars: {
    key: string;
    index: number;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];

  const accumulated = new Array(count).fill(0);
  live.forEach((entry, seriesIndex) => {
    const color = entry.color ?? seriesColors[seriesIndex % seriesColors.length]!;

    for (let index = 0; index < count; index++) {
      const length = scale(entry.values[index] ?? 0);
      const offset = stacked ? scale(accumulated[index]) : 0;
      if (stacked) accumulated[index] += entry.values[index] ?? 0;

      const start =
        bandStart(index) +
        (stacked || live.length === 1 ? 0 : seriesIndex * (thickness + groupGap));

      // The accent only applies to a single-series chart: on a grouped one it
      // would compete with the series colours.
      const accented =
        highlight !== undefined &&
        (highlight === labels[index] || highlight === index) &&
        live.length === 1;

      bars.push({
        key: `${entry.name}-${index}`,
        index,
        color: accented ? "var(--chart-highlight)" : color,
        x: horizontal ? padLeft + offset : start,
        y: horizontal ? start : padTop + innerHeight - offset - length,
        width: horizontal ? length : thickness,
        height: horizontal ? thickness : length,
      });
    }
  });

  return (
    <div ref={ref} className={className} style={{ position: "relative", width: "100%" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        className="block overflow-visible"
        onMouseLeave={() => setActive(null)}
      >
        {ticks(peak, yTicks).map((value, index) =>
          horizontal ? (
            <g key={index}>
              <line
                x1={padLeft + position(value)}
                x2={padLeft + position(value)}
                y1={padTop}
                y2={padTop + innerHeight}
                stroke="var(--chart-grid)"
              />
              <text
                x={padLeft + position(value)}
                y={height - 8}
                textAnchor="middle"
                {...axisTextProps}
              >
                {formatTick(value)}
              </text>
            </g>
          ) : (
            <g key={index}>
              <line
                x1={padLeft}
                x2={padLeft + innerWidth}
                y1={padTop + innerHeight - position(value)}
                y2={padTop + innerHeight - position(value)}
                stroke="var(--chart-grid)"
              />
              <text
                x={padLeft - 10}
                y={padTop + innerHeight - position(value) + 4}
                textAnchor="end"
                {...axisTextProps}
              >
                {formatTick(value)}
              </text>
            </g>
          ),
        )}

        {target !== undefined ? (
          horizontal ? (
            <line
              x1={padLeft + position(target)}
              x2={padLeft + position(target)}
              y1={padTop}
              y2={padTop + innerHeight}
              stroke="var(--chart-1)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              opacity="0.5"
            />
          ) : (
            <line
              x1={padLeft}
              x2={padLeft + innerWidth}
              y1={padTop + innerHeight - position(target)}
              y2={padTop + innerHeight - position(target)}
              stroke="var(--chart-1)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              opacity="0.5"
            />
          )
        ) : null}

        {labels.map((label, index) =>
          horizontal ? (
            <text
              key={index}
              x={padLeft - 12}
              y={bandStart(index) + slot / 2 + 4}
              textAnchor="end"
              {...axisTextProps}
            >
              {label}
            </text>
          ) : (
            <text
              key={index}
              x={bandStart(index) + slot / 2}
              y={height - 8}
              textAnchor="middle"
              {...axisTextProps}
            >
              {label}
            </text>
          ),
        )}

        {bars.map((bar) => (
          <rect
            key={bar.key}
            x={bar.x}
            y={bar.y}
            width={Math.max(0, bar.width)}
            height={Math.max(0, bar.height)}
            // The radius cannot exceed half the bar's thickness, or a short bar
            // renders as a lozenge.
            rx={Math.min(radius, (horizontal ? bar.height : bar.width) / 2)}
            fill={bar.color}
            opacity={active !== null && active !== bar.index ? 0.45 : 1}
            onMouseEnter={() => setActive(bar.index)}
            className="cursor-default transition-opacity duration-[140ms] ease-standard"
          />
        ))}
      </svg>

      {active !== null ? (
        <ChartTooltip
          x={horizontal ? padLeft + innerWidth / 2 : bandStart(active) + slot / 2}
          y={horizontal ? bandStart(active) + slot / 2 : padTop + innerHeight / 2}
          title={labels[active]}
          rows={live.map((entry, index) => ({
            label: entry.name,
            color: entry.color ?? seriesColors[index % seriesColors.length]!,
            value: formatValue(entry.values[active] ?? 0),
          }))}
        />
      ) : null}
    </div>
  );
}
