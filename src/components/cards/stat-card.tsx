import * as React from "react";
import { cn } from "../../lib/cn";
import { Button, type ButtonProps } from "../core/button";
import { Icon } from "../core/icon";

export interface StatCardCta {
  label: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
}

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** Percentage change. Sign decides the arrow and the colour. */
  delta?: number;
  /** What the delta is measured against: "vs last month". */
  deltaLabel?: React.ReactNode;

  icon?: React.ReactNode;
  /**
   * A slot for a Sparkline or any small chart. A slot rather than a `series`
   * prop, so this card does not drag the chart code into every bundle that
   * shows a number.
   */
  chart?: React.ReactNode;
  footer?: React.ReactNode;
  cta?: StatCardCta;

  /** Lime fill. ONE per grid — this is the number to act on. */
  accent?: boolean;
  /** Ink fill. Use for a figure that is important but not the call to action. */
  inverted?: boolean;
  align?: "start" | "center";
  className?: string;
}

/**
 * One number that carries a decision.
 *
 * The delta's colour is semantic, not decorative: green up, red down — except
 * on the accent and inverted fills, where the semantic colours would not read
 * and the arrow alone carries the direction.
 *
 * Figures are tabular so a grid of stat cards keeps its numbers on a common
 * grid rather than jittering as values update.
 */
export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  icon,
  chart,
  footer,
  cta,
  accent = false,
  inverted = false,
  align = "start",
  className,
}: StatCardProps) {
  const up = delta !== undefined && delta >= 0;

  const surface = accent ? "bg-accent" : inverted ? "bg-ink" : "bg-surface-card";
  const primary = accent ? "text-accent-ink" : inverted ? "text-paper" : "text-text-primary";
  const muted = accent
    ? "text-[rgb(11_11_11/0.66)]"
    : inverted
      ? "text-text-muted-dark"
      : "text-text-secondary";
  const trend = accent
    ? "text-accent-ink"
    : inverted
      ? "text-accent"
      : up
        ? "text-success"
        : "text-error";

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-card p-card font-sans",
        surface,
        align === "center" ? "items-center text-center" : "items-stretch text-left",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3",
          align === "center" ? "justify-center" : "justify-start",
        )}
      >
        {icon ? <span className={cn("inline-flex", primary)}>{icon}</span> : null}
        <span className={cn("text-[13px]", muted)}>{label}</span>
      </div>

      <div
        className={cn(
          "flex items-baseline gap-2",
          align === "center" ? "justify-center" : "justify-start",
        )}
      >
        <span className={cn("text-stat tabular-nums", primary)}>{value}</span>
        {unit ? <span className={cn("text-[18px] font-medium", muted)}>{unit}</span> : null}
      </div>

      {delta !== undefined ? (
        <div
          className={cn(
            "flex items-center gap-1.5",
            align === "center" ? "justify-center" : "justify-start",
          )}
        >
          <span className={cn("inline-flex", trend)}>
            <Icon name={up ? "trending-up" : "trending-down"} size={16} />
          </span>
          <span className={cn("text-[13px] font-medium tabular-nums", trend)}>
            {up ? "+" : ""}
            {delta} %
          </span>
          {deltaLabel ? <span className={cn("text-[12.5px]", muted)}>{deltaLabel}</span> : null}
        </div>
      ) : null}

      {chart ? <div className="mt-0.5">{chart}</div> : null}

      {footer ? <div className={cn("text-[12.5px]", muted)}>{footer}</div> : null}

      {cta ? (
        <div className="mt-2">
          <Button
            variant={cta.variant ?? (accent ? "secondary" : inverted ? "primary" : "texted")}
            size="sm"
            onDark={inverted && !accent}
            onClick={cta.onClick}
          >
            {cta.label}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
