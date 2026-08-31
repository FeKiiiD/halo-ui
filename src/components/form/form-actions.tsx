import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export interface FormActionsProps {
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  /** Anything belonging at the far left: a delete action, a back link. */
  left?: React.ReactNode;

  dirty?: boolean;
  saving?: boolean;
  /** A time, already formatted: "14:32". */
  savedAt?: string;
  errorCount?: number;

  /**
   * Sticks to the bottom of the scroll container. The bar is never fixed to the
   * window: on a short form that would float it in the middle of empty space.
   */
  sticky?: boolean;
  align?: "left" | "right";

  savingLabel?: string;
  savedLabel?: (at: string) => string;
  dirtyLabel?: string;
  errorLabel?: (count: number) => string;
  className?: string;
}

/**
 * The bar at the foot of a form: what is unsaved, what is wrong, and what will
 * happen.
 *
 * ONE STATUS AT A TIME, in priority order: errors, then saving, then saved,
 * then unsaved. Showing "3 fields to fix" beside "unsaved changes" tells the
 * user nothing the first message did not.
 */
export function FormActions({
  primary,
  secondary,
  left,
  dirty = false,
  saving = false,
  savedAt,
  errorCount = 0,
  sticky = true,
  align = "right",
  savingLabel = "Saving…",
  savedLabel = (at) => `Saved at ${at}.`,
  dirtyLabel = "Unsaved changes.",
  errorLabel = (count) => (count === 1 ? "1 field to fix." : `${count} fields to fix.`),
  className,
}: FormActionsProps) {
  const status: { icon: IconName; className: string; text: string; spin?: boolean } | null =
    errorCount > 0
      ? { icon: "circle-alert", className: "text-error", text: errorLabel(errorCount) }
      : saving
        ? { icon: "loader-circle", className: "text-text-secondary", text: savingLabel, spin: true }
        : savedAt
          ? { icon: "circle-check", className: "text-success", text: savedLabel(savedAt) }
          : dirty
            ? { icon: "dot", className: "text-warning", text: dirtyLabel }
            : null;

  return (
    <div
      className={cn(
        "mt-4 flex flex-wrap items-center gap-4 border-t border-border-subtle py-4 font-sans",
        sticky ? "sticky bottom-0 z-5 bg-surface-page" : "static bg-transparent",
        className,
      )}
    >
      {left}

      {status ? (
        <span className={cn("inline-flex items-center gap-2 text-body-s", status.className)}>
          <span
            className="inline-flex"
            style={status.spin ? { animation: "halo-spin 900ms linear infinite" } : undefined}
          >
            <Icon name={status.icon} size={16} />
          </span>
          {status.text}
        </span>
      ) : null}

      <span className={align === "right" ? "flex-1" : "flex-none"} />

      <span className="inline-flex items-center gap-3">
        {secondary}
        {primary}
      </span>
    </div>
  );
}
