import * as React from "react";
import { cn } from "../../lib/cn";
import { useAsyncVerdict } from "../../lib/use-async-verdict";
import { Spinner } from "../core/spinner";
import type { FieldSize } from "./field-chrome";

export interface FieldActionProps {
  label: React.ReactNode;
  /** Resolving `false` or throwing plays the failure choreography. */
  onAction?: () => unknown | Promise<unknown>;
  variant?: "primary" | "secondary" | "outlined";
  size?: FieldSize;
  disabled?: boolean;
  className?: string;
}

/**
 * The pill that lives inside a field: "Verify", "Send code", "Look up".
 *
 * It runs the same verdict machine as the choreographed buttons, at a smaller
 * scale — a spinner, then a drawn tick or a shaking cross. It sits 12px shorter
 * than the field so the field's own border stays visible around it.
 *
 * `sound` is off: a field-level check firing a chime on every keystroke-driven
 * validation would be intolerable. The animation carries the verdict.
 */
export function FieldAction({
  label,
  onAction,
  variant = "primary",
  size = "md",
  disabled = false,
  className,
}: FieldActionProps) {
  const { phase, run } = useAsyncVerdict({
    onAction,
    minBusy: 520,
    successHold: 1800,
    errorHold: 1800,
    sound: false,
  });

  const idle = phase === "idle";
  const busy = phase === "busy";
  const compact = size === "sm";

  return (
    <button
      type="button"
      disabled={disabled || !idle}
      onClick={(event) => {
        // The field wrapper focuses the input on click; this button must not
        // trigger that.
        event.stopPropagation();
        void run();
      }}
      aria-live="polite"
      aria-busy={busy}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill",
        "whitespace-nowrap font-sans font-medium",
        "transition-[background-color,color] duration-[150ms] ease-out",
        "disabled:cursor-not-allowed",
        compact ? "h-6 px-3 text-[12px]" : "h-9 px-4 text-[14px]",
        busy && "cursor-progress",
        !idle && !busy && "cursor-default",

        disabled
          ? "bg-surface-disabled text-text-secondary"
          : phase === "error"
            ? "bg-error-soft text-error"
            : phase === "success"
              ? "bg-accent text-accent-ink"
              : variant === "outlined"
                ? cn("border-[1.5px] border-ink text-text-primary", busy ? "bg-mist" : "bg-transparent")
                : variant === "secondary"
                  ? cn("bg-ink text-paper", idle && "hover:bg-ink-hairline")
                  : cn("bg-accent text-accent-ink", idle && "hover:bg-accent-deep"),
        className,
      )}
      style={phase === "error" ? { animation: "halo-shake 420ms ease-out 1" } : undefined}
    >
      {busy ? <Spinner size={14} /> : null}

      {phase === "success" ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          style={{ animation: "halo-pop 260ms ease-out both" }}
        >
          <path
            d="M4 10.6 8 14.5 16 5.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 26,
              strokeDashoffset: 26,
              animation: "halo-draw 280ms ease-out 60ms forwards",
            }}
          />
        </svg>
      ) : null}

      {phase === "error" ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          style={{ animation: "halo-pop 240ms ease-out both" }}
        >
          <path
            d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      ) : null}

      {label}
    </button>
  );
}
