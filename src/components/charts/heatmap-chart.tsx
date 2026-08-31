import * as React from "react";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/chart";
import { ChartTooltip } from "./chart-frame";

/**
 * Five steps from the palest mint to forest.
 *
 * NEVER A RAINBOW. A hue-based scale makes the eye read colour differences that
 * do not correspond to value differences — and excludes anyone who cannot
 * separate red from green. A single hue darkening is read as "more" by
 * everyone.
 */
const defaultScale = [
  "var(--chart-scale-0)",
  "var(--chart-scale-1)",
  "var(--chart-scale-2)",
  "var(--chart-scale-3)",
  "var(--chart-scale-4)",
];

export interface HeatmapChartProps {
  /** Row labels, top to bottom. */
  rows: string[];
  /** Column labels, left to right. */
  cols: string[];
  /** values[row][col]. Missing entries render as the lowest step. */
  values: (number | null | undefined)[][];

  cell?: number;
  gap?: number;
  radius?: number;
  format?: (value: number) => string;
  /** What one cell counts, shown in the tooltip. */
  unit?: string;
  /** Label every nth column, so a 24-hour axis stays readable. */
  colEvery?: number;
  /** Overrides the scale's top, for comparing two heatmaps. */
  max?: number;
  scale?: string[];
  legendLabels?: [string, string];
  className?: string;
}

/**
 * Density across two axes — days down, hours across.
 *
 * The scale is quantised into five steps rather than being continuous: five
 * distinguishable shades let the eye group cells into regions, which is what a
 * heatmap is for. A continuous ramp looks smoother and says less.
 */
export function HeatmapChart({
  rows,
  cols,
  values,
  cell = 26,
  gap = 3,
  radius = 5,
  format = (value) => formatNumber(value),
  unit = "visits",
  colEvery = 2,
  max,
  scale = defaultScale,
  legendLabels = ["less", "more"],
  className,
}: HeatmapChartProps) {
  const [active, setActive] = React.useState<[number, number] | null>(null);

  const peak = max || Math.max(1, ...values.flat().map((value) => value ?? 0));
  const bucket = (value: number | null | undefined) =>
    value == null
      ? 0
      : Math.min(scale.length - 1, Math.round(((value || 0) / peak) * (scale.length - 1)));

  const labelWidth = 44;

  return (
    <div className={cn("relative overflow-x-auto font-sans", className)}>
      <div className="inline-flex flex-col" style={{ gap }}>
        <div className="flex" style={{ gap, paddingLeft: labelWidth }}>
          {cols.map((col, index) => (
            <span
              key={col}
              className="text-center text-[11px] text-[var(--chart-axis)]"
              style={{ width: cell }}
            >
              {index % colEvery === 0 ? col : ""}
            </span>
          ))}
        </div>

        {rows.map((row, rowIndex) => (
          <div key={row} className="flex items-center" style={{ gap }}>
            <span
              className="shrink-0 pr-2 text-right text-[11px] text-[var(--chart-axis)]"
              style={{ width: labelWidth }}
            >
              {row}
            </span>

            {cols.map((col, colIndex) => {
              const value = values[rowIndex]?.[colIndex];
              const on = active?.[0] === rowIndex && active?.[1] === colIndex;

              return (
                <span
                  key={col}
                  onMouseEnter={() => setActive([rowIndex, colIndex])}
                  onMouseLeave={() => setActive(null)}
                  className="shrink-0 transition-[outline-color] duration-[120ms] ease-standard"
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: radius,
                    background: scale[bucket(value)],
                    // An outline rather than a border: a border would resize
                    // the cell and shift the whole grid on hover.
                    outline: on ? "2px solid var(--color-border-strong)" : "none",
                    outlineOffset: 1,
                  }}
                />
              );
            })}
          </div>
        ))}

        <div
          className="mt-1.5 flex items-center gap-1.75 text-[11px] text-[var(--chart-axis)]"
          style={{ paddingLeft: labelWidth }}
        >
          {legendLabels[0]}
          {scale.map((step) => (
            <span key={step} className="h-2.5 w-4.5 rounded-[3px]" style={{ background: step }} />
          ))}
          {legendLabels[1]}
        </div>
      </div>

      {active ? (
        <ChartTooltip
          x={labelWidth + (active[1] + 1) * (cell + gap)}
          y={(active[0] + 1) * (cell + gap) + 14}
          title={`${rows[active[0]]} · ${cols[active[1]]}`}
          rows={[{ label: unit, value: format(values[active[0]]?.[active[1]] ?? 0) }]}
          width={150}
        />
      ) : null}
    </div>
  );
}
