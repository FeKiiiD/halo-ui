import * as React from "react";
import { useAsyncVerdict } from "../../lib/use-async-verdict";
import {
  ActionButtonShell,
  Confetti,
  VerdictBody,
  VerdictCross,
  actionSizing,
  type ActionButtonSize,
  type ConfettiPiece,
} from "./action-button-shell";

export interface AIButtonProps {
  children?: React.ReactNode;
  /**
   * Rotated every 2.1s while thinking. Give it several: a single frozen
   * "Loading…" is exactly what this component exists to avoid.
   */
  thinkingLabels?: string[];
  doneLabel?: string;
  errorLabel?: string;
  onAsk?: () => unknown | Promise<unknown>;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
  className?: string;
}

const sparks: ConfettiPiece[] = [
  { dx: -40, dy: -26, rotate: "40deg", color: "var(--color-halo-1)" },
  { dx: -14, dy: -34, rotate: "-30deg", color: "var(--color-ink)" },
  { dx: 16, dy: -32, rotate: "70deg", color: "var(--color-halo-1)" },
  { dx: 40, dy: -18, rotate: "-50deg", color: "var(--color-ink)" },
  { dx: -30, dy: -6, rotate: "20deg", color: "var(--color-halo-1)" },
  { dx: 30, dy: -4, rotate: "-20deg", color: "var(--color-ink)" },
];

const defaultThinking = [
  "Thinking",
  "Interesting",
  "Cross-checking",
  "One moment",
  "Almost there",
];

/**
 * Waits on an assistant. The robot bobs, its antenna pulses, its eyes track
 * left and right, and the label cycles through a rotation of thoughts.
 *
 * The rotating label is the substance of this component: an assistant call can
 * take ten seconds, and a static spinner over that span reads as a hang. The
 * width animates between labels rather than snapping, so the button does not
 * jump every 2.1 seconds.
 */
export function AIButton({
  children = "Ask the assistant",
  thinkingLabels = defaultThinking,
  doneLabel = "Analysis ready.",
  errorLabel = "Analysis unavailable.",
  onAsk,
  size = "md",
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  minWidth = 235,
  className,
}: AIButtonProps) {
  const g = actionSizing[size];
  const { phase, run } = useAsyncVerdict({ onAction: onAsk, minBusy: 900, successHold: 2400 });

  const thinking = phase === "busy";
  const labels = thinkingLabels.length ? thinkingLabels : defaultThinking;

  const [step, setStep] = React.useState(0);
  const [labelWidth, setLabelWidth] = React.useState<number | null>(null);
  const measure = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!thinking) {
      setStep(0);
      return;
    }
    const id = setInterval(() => setStep((n) => n + 1), 2100);
    return () => clearInterval(id);
  }, [thinking]);

  // Measured in a layout effect so the width is known before paint — reading it
  // afterwards would show one frame at the wrong size on every label change.
  React.useLayoutEffect(() => {
    if (!thinking) {
      setLabelWidth(null);
      return;
    }
    if (measure.current) setLabelWidth(measure.current.offsetWidth);
  }, [thinking, step, labels]);

  const label = typeof children === "string" ? children : "Ask";
  const current = labels[step % labels.length];

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
      className={`overflow-hidden ${className ?? ""}`}
    >
      {/* An accent sweep crossing the button — the one place a gradient is
          allowed, and only because it is motion rather than a surface. */}
      {thinking ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 -z-10 w-[45%]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgb(217 248 79 / 0.22), transparent)",
            animation: "halo-ai-sweep 1500ms linear infinite",
          }}
        />
      ) : null}

      {phase === "idle" || thinking ? (
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
                transformOrigin: "10px 12px",
                ...(thinking ? { animation: "halo-ai-bob 1100ms ease-in-out infinite" } : null),
              }}
            >
              <path d="M10 5.4V3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <rect x="3.6" y="7.4" width="12.8" height="9.2" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3.6 11.4H2.2M16.4 11.4h1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              {/* Eyes scan on their own cycle, off-phase with the bob, so the
                  head and the gaze never move in lockstep. */}
              <g style={thinking ? { animation: "halo-ai-scan 1300ms ease-in-out infinite" } : undefined}>
                <circle cx="7.6" cy="11.6" r="1.05" fill="currentColor" />
                <circle cx="12.4" cy="11.6" r="1.05" fill="currentColor" />
              </g>
            </g>
            <circle
              cx="10"
              cy="2.6"
              r="1.4"
              fill={thinking ? "var(--color-accent)" : "currentColor"}
              style={{
                transformOrigin: "10px 2.6px",
                ...(thinking ? { animation: "halo-ai-antenna 900ms ease-in-out infinite" } : null),
              }}
            />
          </svg>

          {iconOnly ? null : thinking ? (
            <span
              className="relative inline-block h-[1em]"
              style={{
                width: labelWidth ?? "auto",
                transition: "width 520ms var(--ease-standard)",
              }}
            >
              {/* A hidden copy at natural width: the visible one is absolutely
                  positioned and cannot be measured. */}
              <span
                ref={measure}
                aria-hidden="true"
                className="pointer-events-none invisible absolute left-0 top-0"
              >
                {current}
              </span>
              {/* Keyed on step so React remounts it and the swap replays. */}
              <span
                key={step}
                className="absolute left-0 top-0"
                style={{ animation: "halo-ai-swap 2100ms var(--ease-standard) both" }}
              >
                {current}
              </span>
            </span>
          ) : (
            <span>{children}</span>
          )}

          {thinking ? (
            <span aria-hidden="true" className="-ml-0.5 inline-flex gap-[3px]">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="size-[3px] rounded-full bg-accent"
                  style={{ animation: `halo-ai-dot 1000ms ease-in-out ${index * 160}ms infinite` }}
                />
              ))}
            </span>
          ) : null}
        </span>
      ) : null}

      {/* Success draws a sparkle rather than a tick: the assistant produced
          something, it did not merely succeed. */}
      {phase === "success" ? (
        <>
          <VerdictBody>
            <svg width={g.icon} height={g.icon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 2.6l1.5 4.4L16 8.5l-4.5 1.5L10 14.4 8.5 10 4 8.5 8.5 7 10 2.6Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 44,
                  strokeDashoffset: 44,
                  animation: "halo-draw 420ms var(--ease-standard) 80ms forwards",
                }}
              />
              <path
                d="M15.2 13.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 22,
                  strokeDashoffset: 22,
                  animation: "halo-draw 320ms var(--ease-standard) 260ms forwards",
                }}
              />
            </svg>
            {iconOnly ? null : doneLabel}
          </VerdictBody>
          <Confetti pieces={sparks} />
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
