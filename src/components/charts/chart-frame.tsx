import * as React from "react";
import { cn } from "../../lib/cn";
import { seriesColors } from "../../lib/chart";
import { SectionMarker } from "../core/section-marker";

export interface LegendItem {
  name: string;
  color?: string;
  /** Follows the mark: a bar or area is a square, a line a dash, a point a dot. */
  shape?: "square" | "line" | "dot";
  value?: React.ReactNode;
}

export interface ChartFrameProps {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  /** The headline figure, above the chart. */
  value?: React.ReactNode;
  /** Percentage change beside the value. Sign decides the tone. */
  delta?: number;
  note?: React.ReactNode;
  legend?: LegendItem[];
  onToggleSeries?: (name: string) => void;
  hiddenSeries?: string[];
  actions?: React.ReactNode;

  children?: React.ReactNode;
  marker?: boolean;
  height?: number;
  padded?: boolean;
  tone?: "card" | "sunken";
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  className?: string;
}

/**
 * The shell every chart sits in: eyebrow, title, headline value, legend, and
 * one flat card.
 *
 * SEPARATING THE FRAME FROM THE PLOT is what keeps the charts consistent: the
 * loading skeleton, the empty state and the header are written once, and a new
 * chart type only has to draw its own marks.
 *
 * The card has a hairline border rather than sitting on value alone, because a
 * chart is usually placed on the page surface rather than on mist.
 */
export function ChartFrame({
  eyebrow,
  title,
  value,
  delta,
  note,
  legend,
  onToggleSeries,
  hiddenSeries = [],
  actions,
  children,
  marker = false,
  height,
  padded = true,
  tone = "card",
  loading = false,
  empty = false,
  emptyLabel = "No data for this period.",
  className,
}: ChartFrameProps) {
  const up = delta !== undefined && delta >= 0;
  const hasHeader = Boolean(title || eyebrow || value !== undefined || actions);

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-card border border-border-subtle font-sans text-text-primary",
        padded && "p-6",
        tone === "sunken" ? "bg-surface-alt" : "bg-surface-card",
        className,
      )}
    >
      {hasHeader ? (
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            {marker ? <SectionMarker className="mb-3" /> : null}

            {eyebrow ? (
              <div className="mb-1 text-[13px] text-text-secondary">{eyebrow}</div>
            ) : null}

            {title ? (
              <h3 className="m-0 text-[20px] font-medium leading-[1.3] tracking-[-0.01em]">
                {title}
              </h3>
            ) : null}

            {value !== undefined ? (
              <div className="mt-2.5 flex items-baseline gap-2.5">
                <span className="text-[34px] font-medium leading-none tracking-[-0.02em] tabular-nums">
                  {value}
                </span>

                {delta !== undefined ? (
                  <span
                    className={cn(
                      "inline-flex h-5.5 items-center gap-0.75 rounded-pill px-2.25 text-[12px] font-medium",
                      up ? "bg-success-soft text-success" : "bg-error-soft text-error",
                    )}
                  >
                    {/* One arrow, flipped for a fall — two glyphs would need
                        two sets of optical alignment. */}
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                      className={up ? undefined : "-scale-y-100"}
                    >
                      <path
                        d="M6 10V2.6M6 2.6 2.8 5.8M6 2.6l3.2 3.2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {up ? "+" : ""}
                    {delta} %
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}

      {legend?.length ? (
        <ChartLegend items={legend} onToggle={onToggleSeries} hidden={hiddenSeries} />
      ) : null}

      {loading ? (
        <div className="rounded-lg bg-shimmer" style={{ height: height ?? 220 }} />
      ) : empty ? (
        <div
          className="flex flex-col items-center justify-center gap-1.5 rounded-panel border border-dashed border-border-subtle text-[14px] text-text-secondary"
          style={{ height: height ?? 220 }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="opacity-50"
          >
            <path
              d="M4 19h16M6 15v-4M11 15V7M16 15v-6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          {emptyLabel}
        </div>
      ) : (
        children
      )}

      {note ? <footer className="text-body-s text-text-secondary">{note}</footer> : null}
    </section>
  );
}

export interface ChartLegendProps {
  items: LegendItem[];
  /** Makes the legend interactive: clicking a name hides that series. */
  onToggle?: (name: string) => void;
  hidden?: string[];
  className?: string;
}

/**
 * The series key.
 *
 * The swatch follows the mark — a square for a bar or an area, a dash for a
 * line, a dot for a scatter — so the legend reads as belonging to the chart
 * rather than as a colour list beside it.
 */
export function ChartLegend({ items, onToggle, hidden = [], className }: ChartLegendProps) {
  return (
    <div className={cn("flex flex-wrap gap-x-4.5 gap-y-2 font-sans text-[13px]", className)}>
      {items.map((item, index) => {
        const off = hidden.includes(item.name);
        const color = item.color ?? seriesColors[index % seriesColors.length];

        return (
          <button
            key={item.name}
            type="button"
            disabled={!onToggle}
            aria-pressed={onToggle ? !off : undefined}
            onClick={() => onToggle?.(item.name)}
            className={cn(
              "inline-flex items-center gap-1.75 border-none bg-transparent p-0 font-[inherit] text-[inherit]",
              "transition-opacity duration-[140ms] ease-standard halo-focus",
              onToggle ? "cursor-pointer" : "cursor-default",
              off ? "text-text-secondary opacity-55" : "text-text-primary",
            )}
          >
            {item.shape === "line" ? (
              <span
                className="h-0.5 w-3.5 rounded-sm"
                style={{ background: off ? "var(--chart-6)" : color }}
              />
            ) : item.shape === "dot" ? (
              <span
                className="size-2.25 rounded-full"
                style={{ background: off ? "var(--chart-6)" : color }}
              />
            ) : (
              <span
                className="size-2.5 rounded-[3px]"
                style={{ background: off ? "var(--chart-6)" : color }}
              />
            )}

            {item.name}
            {item.value !== undefined ? (
              <span className="tabular-nums text-text-secondary">{item.value}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export interface ChartTooltipRow {
  label: string;
  value: React.ReactNode;
  color?: string;
}

export interface ChartTooltipProps {
  x: number;
  y: number;
  title?: React.ReactNode;
  rows?: ChartTooltipRow[];
  /** `auto` flips the tooltip to the left half of the plot. */
  align?: "auto" | "left" | "right";
  width?: number;
}

/**
 * The floating read-out, positioned by the caller in the chart's own pixel
 * space.
 *
 * `pointer-events-none` is essential: a tooltip that can be hovered steals the
 * pointer from the plot underneath and makes the crosshair jump.
 */
export function ChartTooltip({
  x,
  y,
  title,
  rows = [],
  align = "auto",
  width = 168,
}: ChartTooltipProps) {
  const flip = align === "left" || (align === "auto" && x > width);

  return (
    <div
      className="pointer-events-none absolute z-5 rounded-chip border border-border-subtle bg-surface-card px-3 py-2.5 font-sans shadow-float"
      style={{
        left: x,
        top: y,
        minWidth: width,
        transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
        animation: "halo-fade-in 110ms ease-out both",
      }}
    >
      {title ? (
        <div className={cn("text-[12px] text-text-secondary", rows.length && "mb-1.5")}>{title}</div>
      ) : null}

      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 py-0.5 text-[13px]">
          {row.color ? (
            <span className="size-2 shrink-0 rounded-sm" style={{ background: row.color }} />
          ) : null}
          <span className="truncate text-text-secondary">{row.label}</span>
          <span className="ml-auto font-medium tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
