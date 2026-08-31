import * as React from "react";
import { cn } from "../../lib/cn";

export interface IconChipProps {
  icon: React.ReactNode;
  /**
   * Flips to the accent with an ink glyph. Reserved for the single inverted
   * card in a grid — this is one of the accent's four permitted homes, so a
   * second inverted chip on the same screen spends the budget twice.
   */
  inverted?: boolean;
  /** Square side in px. 40 is the system default and near-universal. */
  size?: number;
  className?: string;
}

/**
 * The rounded square that carries almost every icon in the system: a glyph
 * above a card title, or a standalone marker. Neutral is ink-on-light and
 * flips to accent-on-ink in dark mode, which is what keeps the glyph legible
 * in both régimes without the caller thinking about it.
 */
export function IconChip({ icon, inverted = false, size = 40, className }: IconChipProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-chip",
        inverted ? "bg-accent text-accent-ink" : "bg-chip-neutral-bg text-chip-neutral-fg",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {icon}
    </span>
  );
}
