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

export interface CopyButtonProps {
  children?: React.ReactNode;
  /** The text to place on the clipboard. Ignored when `onCopy` is given. */
  value?: string;
  copiedLabel?: string;
  errorLabel?: string;
  /** Take over the copy entirely. Resolving `false` reports failure. */
  onCopy?: () => unknown | Promise<unknown>;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
  className?: string;
}

/**
 * Copy to clipboard, with the front sheet lifting off the stack as it goes.
 *
 * Falls back to a hidden textarea and `execCommand` when the async Clipboard
 * API is unavailable — it needs a secure context, so plain-HTTP staging hosts
 * and older Safari would otherwise fail silently.
 */
export function CopyButton({
  children = "Copy link",
  value = "",
  copiedLabel = "Copied.",
  errorLabel = "Could not copy.",
  onCopy,
  variant = "secondary",
  size = "md",
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  minWidth = 180,
  className,
}: CopyButtonProps) {
  const g = actionSizing[size];

  const copy = React.useCallback(async () => {
    if (onCopy) return onCopy();

    const text = String(value);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to the legacy path rather than reporting failure: a
      // rejected permission here does not mean the copy is impossible.
    }
    return legacyCopy(text);
  }, [onCopy, value]);

  const { phase, run } = useAsyncVerdict({ onAction: copy, minBusy: 420, successHold: 1800, errorHold: 1800 });

  const busy = phase === "busy";
  const label = typeof children === "string" ? children : "Copy";

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
      className={`overflow-hidden ${className ?? ""}`}
    >
      {/* An accent wash confirms the gesture registered before the verdict lands. */}
      {busy ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 z-0 bg-accent"
          style={{ animation: "halo-copy-flash 420ms var(--ease-standard) both" }}
        />
      ) : null}

      {phase === "idle" || busy ? (
        <span className="relative z-[1] inline-flex items-center gap-2">
          <svg
            width={g.icon}
            height={g.icon}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="overflow-visible"
          >
            {/* The sheet left behind, shrinking slightly as the top one leaves. */}
            <g
              style={{
                transformOrigin: "12px 8px",
                ...(busy ? { animation: "halo-copy-back 420ms var(--ease-standard) both" } : null),
              }}
            >
              <rect x="7.4" y="2.6" width="9.6" height="11.4" rx="2" stroke="currentColor" strokeWidth="1.5" />
            </g>
            {/* The sheet being taken: it fills with accent as it lifts. */}
            <g
              style={{
                transformOrigin: "8px 12px",
                ...(busy ? { animation: "halo-copy-lift 420ms var(--ease-standard) both" } : null),
              }}
            >
              <rect
                x="3"
                y="6"
                width="9.6"
                height="11.4"
                rx="2"
                fill={busy ? "var(--color-accent)" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M5.6 9.6h4.4M5.6 12h4.4M5.6 14.4h2.6"
                stroke={busy ? "var(--color-ink)" : "currentColor"}
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity={busy ? 1 : 0.55}
              />
            </g>
          </svg>
          {iconOnly ? null : <span>{children}</span>}
        </span>
      ) : null}

      {phase === "success" ? (
        <VerdictBody>
          <VerdictCheck size={g.icon} />
          {iconOnly ? null : copiedLabel}
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

/** Pre-Clipboard-API copy, for insecure contexts and older browsers. */
function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    // Off-screen and invisible, but still focusable — a display:none element
    // cannot be selected, so the copy would fail.
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";

    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
