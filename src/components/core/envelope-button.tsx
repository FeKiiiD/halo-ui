import * as React from "react";
import { useAsyncVerdict } from "../../lib/use-async-verdict";
import {
  ActionButtonShell,
  Confetti,
  VerdictBody,
  VerdictCheck,
  VerdictCross,
  actionSizing,
  type ActionButtonSize,
  type ConfettiPiece,
} from "./action-button-shell";

export interface EnvelopeButtonProps {
  children?: React.ReactNode;
  openingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  onOpen?: () => unknown | Promise<unknown>;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
  className?: string;
}

const burst: ConfettiPiece[] = [
  { dx: -48, dy: -34, rotate: "-120deg", color: "var(--color-halo-1)" },
  { dx: -26, dy: -48, rotate: "70deg", color: "var(--color-ink)" },
  { dx: -4, dy: -54, rotate: "200deg", color: "var(--color-halo-1)" },
  { dx: 18, dy: -46, rotate: "-60deg", color: "var(--color-ink)" },
  { dx: 40, dy: -30, rotate: "140deg", color: "var(--color-halo-1)" },
  { dx: 50, dy: -8, rotate: "-180deg", color: "var(--color-ink)" },
  { dx: -50, dy: -10, rotate: "50deg", color: "var(--color-halo-1)" },
  { dx: 10, dy: -28, rotate: "260deg", color: "var(--color-ink)" },
];

/**
 * Opens something sealed: the flap swings back and the letter rises out.
 *
 * The letter is drawn in the accent — one of the few places a filled shape
 * carries it — because the whole point of the animation is that something was
 * inside.
 */
export function EnvelopeButton({
  children = "Open message",
  openingLabel = "Opening…",
  successLabel = "Message opened.",
  errorLabel = "Message unreadable.",
  onOpen,
  size = "md",
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  minWidth = 210,
  className,
}: EnvelopeButtonProps) {
  const g = actionSizing[size];
  // 820ms covers the flap (380) plus the letter rising (620 at +120 delay).
  const { phase, run } = useAsyncVerdict({ onAction: onOpen, minBusy: 820, successHold: 2400 });

  const opening = phase === "busy";
  const label = typeof children === "string" ? children : "Open";

  return (
    <ActionButtonShell
      phase={phase}
      variant="secondary"
      size={size}
      disabled={disabled}
      fullWidth={fullWidth}
      iconOnly={iconOnly}
      minWidth={minWidth}
      label={label}
      onClick={() => void run()}
      className={className}
    >
      {phase === "idle" || opening ? (
        <span className="inline-flex items-center gap-2">
          <svg
            width={g.icon}
            height={g.icon}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="overflow-visible"
          >
            {/* Drawn first so it sits behind the envelope body and appears to
                slide out from within it. */}
            {opening ? (
              <g
                style={{
                  transformOrigin: "10px 9px",
                  animation: "halo-env-letter 620ms var(--ease-standard) 120ms both",
                }}
              >
                <rect x="5.6" y="2.6" width="8.8" height="8" rx="1" fill="var(--color-accent)" />
                <path
                  d="M7.4 5h5.2M7.4 6.9h5.2M7.4 8.8h3.2"
                  stroke="var(--color-ink)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              </g>
            ) : null}

            <path
              d="M3 7.2h14v8.4a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 15.6V7.2Z"
              fill={opening ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M3 15.8l5.4-4.6M17 15.8l-5.4-4.6"
              stroke={opening ? "var(--color-ink)" : "currentColor"}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            {/* rotateX past 90° puts the flap behind the envelope, which is
                what sells the opening as three-dimensional. */}
            <g
              style={{
                transformOrigin: "10px 7.2px",
                animation: opening ? "halo-env-flap 380ms var(--ease-standard) forwards" : "none",
              }}
            >
              <path
                d="M3 7.2 10 12.6 17 7.2Z"
                fill={opening ? "var(--color-ink)" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </g>
          </svg>
          {iconOnly ? null : <span>{opening ? openingLabel : children}</span>}
        </span>
      ) : null}

      {phase === "success" ? (
        <>
          <VerdictBody>
            <VerdictCheck size={g.icon} />
            {iconOnly ? null : successLabel}
          </VerdictBody>
          <Confetti pieces={burst} />
        </>
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
