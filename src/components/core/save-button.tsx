import * as React from "react";
import { useAsyncVerdict } from "../../lib/use-async-verdict";
import {
  ActionButtonShell,
  VerdictBody,
  VerdictCheck,
  VerdictCross,
  actionSizing,
  type ActionButtonSize,
  type ActionButtonVariant,
} from "./action-button-shell";

export interface SaveButtonProps {
  children?: React.ReactNode;
  savingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  /** Resolving `false` or throwing plays the failure choreography. */
  onSave?: () => unknown | Promise<unknown>;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
  /** Shows the unsaved-changes dot. Pass false once the form is pristine. */
  dirty?: boolean;
  className?: string;
}

/**
 * Save, with the floppy's reel spinning while the write is in flight.
 *
 * The dot beside the label is the unsaved-changes marker: it is the only thing
 * telling the user the button is worth pressing, so wire `dirty` to real form
 * state rather than leaving it on.
 */
export function SaveButton({
  children = "Save",
  savingLabel = "Saving…",
  successLabel = "Saved.",
  errorLabel = "Could not save.",
  onSave,
  variant = "secondary",
  size = "md",
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  minWidth = 190,
  dirty = true,
  className,
}: SaveButtonProps) {
  const g = actionSizing[size];
  // 780ms: long enough for the reel to complete a visible turn, so a fast
  // server does not make the icon flash.
  const { phase, run } = useAsyncVerdict({ onAction: onSave, minBusy: 780, successHold: 2200 });

  const busy = phase === "busy";
  const label = typeof children === "string" ? children : "Save";

  return (
    <ActionButtonShell
      phase={phase}
      variant={variant}
      size={size}
      disabled={disabled}
      fullWidth={fullWidth}
      iconOnly={iconOnly}
      minWidth={minWidth}
      label={label}
      onClick={() => void run()}
      className={className}
    >
      {phase === "idle" || busy ? (
        <span className="inline-flex items-center gap-2">
          <svg
            width={g.icon}
            height={g.icon}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="overflow-visible"
          >
            <g
              style={{
                transformOrigin: "10px 10px",
                ...(busy ? { animation: "halo-save-nudge 900ms ease-in-out infinite" } : null),
              }}
            >
              <path
                d="M3.4 4.6A1.2 1.2 0 0 1 4.6 3.4h8.1l3.9 3.9v8.1a1.2 1.2 0 0 1-1.2 1.2H4.6a1.2 1.2 0 0 1-1.2-1.2V4.6Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {/* The shutter drops into the slot as the write begins. */}
              <path
                d="M6.6 3.4h6v3.9h-6V3.4Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
                style={
                  busy ? { animation: "halo-save-insert 620ms var(--ease-standard) both" } : undefined
                }
              />
              <rect x="6.2" y="10.6" width="7.6" height="6" rx="0.8" stroke="currentColor" strokeWidth="1.4" />
              {/* Reel and its spoke turn together — the write in progress. */}
              <circle
                cx="10"
                cy="13.6"
                r="1.5"
                stroke="currentColor"
                strokeWidth="1.2"
                style={
                  busy
                    ? { transformOrigin: "10px 13.6px", animation: "halo-spin 700ms linear infinite" }
                    : undefined
                }
              />
              <path
                d="M10 12.1v1.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                style={
                  busy
                    ? { transformOrigin: "10px 13.6px", animation: "halo-spin 700ms linear infinite" }
                    : undefined
                }
              />
            </g>
          </svg>

          {iconOnly ? null : <span>{busy ? savingLabel : children}</span>}

          {!iconOnly && !busy && dirty ? (
            <span
              aria-hidden="true"
              title="Unsaved changes"
              className={`size-1.5 shrink-0 rounded-full ${variant === "primary" ? "bg-ink" : "bg-accent"}`}
            />
          ) : null}
        </span>
      ) : null}

      {phase === "success" ? (
        <VerdictBody>
          <VerdictCheck size={g.icon} />
          {iconOnly ? null : successLabel}
        </VerdictBody>
      ) : null}

      {phase === "error" ? (
        <VerdictBody duration={260}>
          <VerdictCross size={g.icon} />
          {iconOnly ? null : errorLabel}
        </VerdictBody>
      ) : null}
    </ActionButtonShell>
  );
}
