import * as React from "react";
import { cn } from "../../lib/cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "error" | "info";

export interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-mist text-text-primary",
  // The accent tone spends one of its four permitted homes — reserve it for a
  // badge that is genuinely the point of the row, not for every "New".
  accent: "bg-accent text-accent-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  info: "bg-info-soft text-info",
};

/**
 * A short status word attached to something else: a plan, a row, a card.
 *
 * It is not a button and never carries an action — a badge that can be clicked
 * is a chip, and chips live in the form components.
 */
export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6.5 items-center whitespace-nowrap rounded-pill px-3",
        "font-sans text-body-s font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
