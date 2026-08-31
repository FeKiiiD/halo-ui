import * as React from "react";
import { useAsyncVerdict } from "../../lib/use-async-verdict";
import {
  ActionButtonShell,
  VerdictBody,
  actionSizing,
  type ActionButtonSize,
  type ActionButtonVariant,
} from "./action-button-shell";

export interface ScanButtonProps {
  children?: React.ReactNode;
  scanningLabel?: string;
  /** Overrides the recognised-card label entirely. */
  successLabel?: string;
  errorLabel?: string;
  /** Resolving a string names who was recognised. */
  onScan?: () => unknown | Promise<unknown>;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
  className?: string;
}

/** The module grid, minus the three finder corners. */
const modules: [number, number][] = [
  [9.2, 4.6], [11.4, 4.6], [9.2, 6.8], [13.6, 6.8],
  [4.6, 9.2], [6.8, 9.2], [9.2, 9.2], [11.4, 9.2], [13.6, 9.2],
  [9.2, 11.4], [4.6, 11.4], [13.6, 11.4],
  [9.2, 13.6], [11.4, 13.6], [13.6, 13.6],
];

/** Where each spark flies when the code locks. */
const sparks: [number, number][] = [
  [-13, -9], [13, -10], [-10, 10], [11, 11], [0, -15], [0, 15],
];

const frame =
  "M3 6.6V4.4A1.4 1.4 0 0 1 4.4 3h2.2M13.4 3h2.2A1.4 1.4 0 0 1 17 4.4v2.2M17 13.4v2.2a1.4 1.4 0 0 1-1.4 1.4h-2.2M6.6 17H4.4A1.4 1.4 0 0 1 3 15.6v-2.2";

/**
 * Reads a code at the counter: a beam travels the symbol, modules light as it
 * passes, and the frame pinches shut when it locks.
 *
 * Defaults to `size="counter"` and `variant="primary"` because that is where it
 * lives — used standing, at arm's length, during service. The 56px target and
 * the lime fill are both part of being usable there.
 */
export function ScanButton({
  children = "Scan card",
  scanningLabel = "Reading code…",
  successLabel,
  errorLabel = "Code unreadable.",
  onScan,
  variant = "primary",
  size = "counter",
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  minWidth = 210,
  className,
}: ScanButtonProps) {
  const g = actionSizing[size];
  const { phase, result, run } = useAsyncVerdict({
    onAction: onScan,
    minBusy: 900,
    successHold: 2400,
  });

  const busy = phase === "busy";
  const label = typeof children === "string" ? children : "Scan";
  // On a lime button the beam must be ink to read; on ink, it is the accent.
  const beam = variant === "primary" ? "var(--color-ink)" : "var(--color-accent)";
  const done = successLabel ?? (typeof result === "string" ? `${result}'s card.` : "Card recognised.");

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
      {phase === "idle" || busy ? (
        <span className="inline-flex items-center gap-2">
          <svg width={g.icon} height={g.icon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d={frame} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

            {/* Finder squares pulse out of phase with each other. */}
            <rect
              x="5.4" y="5.4" width="3.4" height="3.4" rx="0.7"
              stroke="currentColor" strokeWidth="1.3"
              style={busy ? { animation: "halo-scan-finder 900ms ease-in-out infinite" } : undefined}
            />
            <rect
              x="11.2" y="5.4" width="3.4" height="3.4" rx="0.7"
              stroke="currentColor" strokeWidth="1.3"
              style={busy ? { animation: "halo-scan-finder 900ms ease-in-out 150ms infinite" } : undefined}
            />
            <rect
              x="5.4" y="11.2" width="3.4" height="3.4" rx="0.7"
              stroke="currentColor" strokeWidth="1.3"
              style={busy ? { animation: "halo-scan-finder 900ms ease-in-out 300ms infinite" } : undefined}
            />

            {busy ? (
              modules.map(([x, y], index) => (
                <rect
                  key={index}
                  x={x} y={y} width="1.5" height="1.5" rx="0.35"
                  fill="currentColor"
                  // Delay tracks vertical position, so modules light in the
                  // order the beam actually reaches them.
                  style={{ animation: `halo-scan-module 900ms ease-in-out ${(y / 20) * 620}ms infinite` }}
                />
              ))
            ) : (
              <rect x="11.2" y="11.2" width="3.4" height="3.4" rx="0.7" fill="currentColor" opacity="0.9" />
            )}

            {busy ? (
              <g style={{ animation: "halo-scan-beam 900ms cubic-bezier(.45,0,.55,1) infinite" }}>
                <rect x="3.6" y="9.4" width="12.8" height="1.2" rx="0.6" fill={beam} opacity="0.9" />
                {/* The soft trail behind the beam. */}
                <rect x="3.6" y="10.6" width="12.8" height="2.6" rx="1.3" fill={beam} opacity="0.16" />
              </g>
            ) : null}
          </svg>
          {iconOnly ? null : <span>{busy ? scanningLabel : children}</span>}
        </span>
      ) : null}

      {phase === "success" ? (
        <span
          className="relative inline-flex items-center gap-2"
          style={{ animation: "halo-pop 320ms var(--ease-standard) both" }}
        >
          <span aria-hidden="true" className="absolute top-1/2" style={{ left: g.icon / 2 }}>
            {sparks.map(([dx, dy], index) => (
              <span
                key={index}
                className="absolute size-1 rounded-full bg-ink"
                style={
                  {
                    "--dx": `${dx}px`,
                    "--dy": `${dy}px`,
                    "--r": "0deg",
                    animation: `halo-spark 620ms var(--ease-standard) ${index * 40}ms both`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
          <svg width={g.icon} height={g.icon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <g style={{ transformOrigin: "10px 10px", animation: "halo-scan-lock 420ms var(--ease-standard) both" }}>
              <path d={frame} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </g>
            <path
              d="M6.4 10.2 9.1 12.9 14 7.2"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
              style={{
                strokeDasharray: 20,
                strokeDashoffset: 20,
                animation: "halo-draw 300ms var(--ease-standard) 120ms forwards",
              }}
            />
          </svg>
          {iconOnly ? null : done}
        </span>
      ) : null}

      {/* The failure keeps the frame at half opacity behind the cross: the
          reader is still there, the code was not. */}
      {phase === "error" ? (
        <VerdictBody duration={260}>
          <svg width={g.icon} height={g.icon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d={frame} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            <path
              d="M7 7 13 13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
              style={{ strokeDasharray: 10, strokeDashoffset: 10, animation: "halo-draw 200ms var(--ease-standard) forwards" }}
            />
            <path
              d="M13 7 7 13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
              style={{ strokeDasharray: 10, strokeDashoffset: 10, animation: "halo-draw 200ms var(--ease-standard) 140ms forwards" }}
            />
          </svg>
          {iconOnly ? null : errorLabel}
        </VerdictBody>
      ) : null}
    </ActionButtonShell>
  );
}
