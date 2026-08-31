import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../core/icon";
import { toneStyles, type FieldTone } from "./field-chrome";

export interface FieldProps {
  label?: React.ReactNode;
  /** Guidance shown when there is no message. A message replaces it. */
  hint?: React.ReactNode;
  error?: React.ReactNode;
  warning?: React.ReactNode;
  success?: React.ReactNode;
  help?: string;
  htmlFor?: string;
  required?: boolean;
  /** Marks the field optional in words. Prefer this to marking everything else
   *  required — a form of asterisks reads as a form of obligations. */
  optional?: boolean;
  /** Character count, e.g. "84 / 140". */
  counter?: React.ReactNode;
  counterAlert?: boolean;
  /**
   * Keeps a 20px lane for the message even when there is none, so a field
   * appearing in error does not shove the rest of the form down. Turn it off
   * for inputs packed into a dense row.
   */
  reserveMessage?: boolean;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * The label / hint / message frame every Halo input sits in.
 *
 * Only one message shows at a time, in priority order: error, then warning,
 * then success, then the hint. Wiring `aria-describedby` on the control to
 * `${id}-msg` is what makes the message reachable to a screen reader — the
 * inputs in this group do it for you.
 */
export function Field({
  label,
  hint,
  error,
  warning,
  success,
  help,
  htmlFor,
  required,
  optional,
  counter,
  counterAlert,
  reserveMessage = true,
  id,
  children,
  className,
}: FieldProps) {
  const tone: FieldTone | null = error ? "error" : warning ? "warning" : success ? "success" : null;
  const message = error ?? warning ?? success;
  const messageId = id ? `${id}-msg` : undefined;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col font-sans",
        reserveMessage ? "gap-2" : "gap-0",
        className,
      )}
    >
      {label ? (
        <label
          htmlFor={htmlFor}
          className={cn(
            "flex items-center gap-1.25 text-body-s font-medium",
            error ? "text-error" : "text-text-primary",
          )}
        >
          {label}
          {required ? (
            <span aria-hidden="true" className="text-error">
              *
            </span>
          ) : null}
          {optional ? (
            <span className="font-normal text-text-secondary">· optional</span>
          ) : null}
          {help ? (
            // tabIndex so the hint is reachable without a pointer; the title
            // gives the tooltip, the aria-label gives the announcement.
            <span
              title={help}
              tabIndex={0}
              aria-label={help}
              className="inline-flex cursor-help text-text-secondary"
            >
              <Icon name="circle-help" size={14} />
            </span>
          ) : null}
        </label>
      ) : null}

      {children}

      {!reserveMessage && !message ? null : (
        <div
          aria-live="polite"
          className={cn(
            "flex items-start justify-between gap-4",
            reserveMessage && "min-h-5",
          )}
        >
          {message && tone ? (
            <span
              id={messageId}
              // role="alert" only for errors: a success message interrupting a
              // screen reader mid-sentence is worse than useless.
              role={error ? "alert" : undefined}
              className={cn("inline-flex items-center gap-1.5 text-body-s", toneStyles[tone].text)}
              style={{ animation: "halo-msg-in 150ms ease-out both" }}
            >
              <Icon name={toneStyles[tone].icon} size={14} />
              {message}
            </span>
          ) : hint ? (
            <span className="text-body-s text-text-secondary">{hint}</span>
          ) : (
            <span />
          )}

          {counter && reserveMessage ? (
            <span
              className={cn(
                "whitespace-nowrap text-body-s tabular-nums",
                counterAlert ? "text-warning" : "text-text-secondary",
              )}
            >
              {counter}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
