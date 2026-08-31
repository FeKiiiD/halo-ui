import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export type AlertTone = "success" | "warning" | "error" | "info";

export interface AlertProps {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons, shown under the message. */
  action?: React.ReactNode;
  /** Overrides the tone's own glyph. */
  icon?: IconName;
  onDismiss?: () => void;
  density?: "comfortable" | "compact";
  dismissLabel?: string;
  className?: string;
}

const tones: Record<
  AlertTone,
  { wash: string; chipBorder: string; text: string; icon: IconName }
> = {
  success: {
    wash: "from-success-soft",
    chipBorder: "border-success-soft",
    text: "text-success",
    icon: "check",
  },
  warning: {
    wash: "from-warning-soft",
    chipBorder: "border-warning-soft",
    text: "text-warning",
    icon: "triangle-alert",
  },
  error: {
    wash: "from-error-soft",
    chipBorder: "border-error-soft",
    text: "text-error",
    icon: "triangle-alert",
  },
  info: {
    wash: "from-info-soft",
    chipBorder: "border-info-soft",
    text: "text-info",
    icon: "info",
  },
};

/**
 * A message about the page, not about a field — a field's message belongs in
 * its own Field frame.
 *
 * THE TONE IS CARRIED BY A CHIP AND A WASH, not by a flooded surface. A fully
 * tinted panel competes with everything around it and makes a page of two
 * alerts unreadable; a gradient fading out of one corner says the same thing
 * and stays quiet.
 *
 * `role="status"` announces politely. An error that must interrupt belongs in a
 * dialog, not an alert.
 */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  icon,
  onDismiss,
  density = "comfortable",
  dismissLabel = "Dismiss",
  className,
}: AlertProps) {
  const t = tones[tone];
  const tight = density === "compact";

  return (
    <div
      role="status"
      className={cn(
        "relative flex items-start gap-3 overflow-hidden rounded-card border border-border-subtle font-sans",
        // The wash stops at 62% so the right half of a wide alert is plain
        // card, which is what keeps the text on it legible.
        "bg-gradient-to-br to-surface-card to-62%",
        t.wash,
        tight ? "p-3.5" : "px-4 pb-4.5 pt-4",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-7.5 shrink-0 items-center justify-center rounded-[10px] border bg-surface-card",
          "shadow-[0_1px_2px_rgb(11_11_11/0.04)]",
          t.chipBorder,
          t.text,
        )}
      >
        <Icon name={icon ?? t.icon} size={16} strokeWidth={1.9} />
      </span>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          title ? "gap-0.75" : "gap-0",
          onDismiss && "pr-5",
        )}
      >
        {title ? (
          <strong className="text-body font-semibold tracking-[-0.01em] text-text-primary">
            {title}
          </strong>
        ) : null}

        {children ? (
          <span
            className={cn(
              "text-pretty text-body-s leading-[var(--lh-body-s)]",
              // Without a title the message is the whole point, so it takes the
              // primary colour rather than reading as a subtitle.
              title ? "text-text-secondary" : "text-text-primary",
            )}
          >
            {children}
          </span>
        ) : null}

        {action ? <div className="mt-3 flex gap-2">{action}</div> : null}
      </div>

      {onDismiss ? (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className={cn(
            "absolute right-3 inline-flex size-6 items-center justify-center rounded-lg border-none bg-transparent",
            "cursor-pointer text-text-secondary transition-colors duration-[140ms] ease-standard hover:text-text-primary halo-focus",
            tight ? "top-3.25" : "top-3.75",
          )}
        >
          <Icon name="x" size={15} strokeWidth={1.9} />
        </button>
      ) : null}
    </div>
  );
}
