import * as React from "react";
import { cn } from "../../lib/cn";
import { Sparkline } from "./sparkline";

export interface KpiTileProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: number;
  /** The comparison the delta is against, as a tooltip on the chip. */
  deltaLabel?: string;

  /** The period's shape. Omit for a bare figure. */
  series?: number[];
  /** How the series is drawn. `gauge` shows progress toward `target` instead. */
  spark?: "area" | "bars" | "dots" | "gauge" | "none";
  target?: number;
  targetLabel?: (percent: number) => string;

  tone?: "card" | "sunken";
  /** Lime fill. ONE per row — this is the figure to act on. */
  accent?: boolean;
  loading?: boolean;
  onClick?: () => void;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * The dashboard's smallest unit: one figure, its movement, its shape over the
 * period.
 *
 * Compact enough to sit four across on a back-office row, which is the
 * constraint that shapes it — the sparkline is 34px tall and unlabelled
 * because there is no room for anything more, and nothing more is needed.
 */
export function KpiTile({
  label,
  value,
  unit,
  delta,
  deltaLabel = "vs previous period",
  series,
  spark,
  target,
  targetLabel = (percent) => `${percent} % of target`,
  tone = "card",
  accent = false,
  loading = false,
  onClick,
  footer,
  className,
}: KpiTileProps) {
  const up = delta !== undefined && delta >= 0;
  const Tag = (onClick ? "button" : "div") as "button";

  // On the accent fill everything must be ink: the semantic colours and the
  // theme-following text would both be unreadable on lime.
  const muted = accent ? "text-[rgb(11_11_11/0.66)]" : "text-text-secondary";

  const kind = spark ?? "area";

  return (
    <Tag
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 rounded-card border p-6 text-left font-sans",
        accent
          ? "border-accent bg-accent text-accent-ink"
          : cn(
              "border-border-subtle text-text-primary",
              tone === "sunken" ? "bg-surface-alt" : "bg-surface-card",
            ),
        onClick ? "cursor-pointer halo-focus" : "cursor-default",
        className,
      )}
    >
      <span className={cn("text-[13px]", muted)}>{label}</span>

      {loading ? (
        <span
          className="h-8.5 w-[62%] rounded-lg bg-surface-sunken"
          style={{ animation: "halo-pulse 1.1s ease-in-out infinite" }}
        />
      ) : (
        <span className="flex flex-wrap items-baseline gap-2">
          <strong className="text-[30px] font-medium leading-none tracking-[-0.02em] tabular-nums">
            {value}
          </strong>
          {unit ? <span className={cn("text-[15px]", muted)}>{unit}</span> : null}

          {delta !== undefined ? (
            <span
              title={deltaLabel}
              className={cn(
                "inline-flex h-5.25 items-center gap-0.75 rounded-pill px-2 text-[12px] font-medium",
                accent
                  ? "bg-[rgb(11_11_11/0.10)] text-ink"
                  : up
                    ? "bg-success-soft text-success"
                    : "bg-error-soft text-error",
              )}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className={up ? undefined : "-scale-y-100"}
              >
                <path
                  d="M6 10V2.6M6 2.6 2.8 5.8M6 2.6l3.2 3.2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {up ? "+" : ""}
              {delta} %
            </span>
          ) : null}
        </span>
      )}

      {!loading && kind === "gauge" ? (
        <GaugeBar
          series={series}
          value={value}
          target={target}
          accent={accent}
          muted={muted}
          targetLabel={targetLabel}
        />
      ) : !loading && kind !== "none" && series?.length ? (
        <Sparkline
          values={series}
          height={34}
          color={accent ? "var(--color-ink)" : "var(--chart-1)"}
          showLast={!accent}
          bars={kind === "bars"}
          dots={kind === "dots"}
          area={kind === "area"}
        />
      ) : null}

      {footer ? <span className={cn("text-[12px]", muted)}>{footer}</span> : null}
    </Tag>
  );
}

/**
 * Progress toward a target, as a bar rather than a sparkline.
 *
 * The current value is read from the series' last point, or parsed out of the
 * displayed value when there is no series — a tile showing "1 208 €" against a
 * target should not also have to be handed 1208.
 */
function GaugeBar({
  series,
  value,
  target,
  accent,
  muted,
  targetLabel,
}: {
  series?: number[];
  value: React.ReactNode;
  target?: number;
  accent: boolean;
  muted: string;
  targetLabel: (percent: number) => string;
}) {
  const last =
    series?.length
      ? series[series.length - 1]!
      : Number(String(value).replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;

  const max = target || (series?.length ? Math.max(...series) : last) || 1;
  const ratio = Math.max(0, Math.min(1, last / max));

  return (
    <span className="flex flex-col gap-1.25">
      <span
        className={cn(
          "h-2 overflow-hidden rounded-pill",
          accent ? "bg-[rgb(11_11_11/0.14)]" : "bg-surface-sunken",
        )}
      >
        <span
          className={cn(
            "block h-full rounded-pill transition-[width] duration-[600ms] ease-standard",
            accent ? "bg-ink" : "bg-[var(--chart-1)]",
          )}
          style={{ width: `${(ratio * 100).toFixed(1)}%` }}
        />
      </span>

      {target ? (
        <span className={cn("text-[11.5px] tabular-nums", muted)}>
          {targetLabel(Math.round(ratio * 100))}
        </span>
      ) : null}
    </span>
  );
}
