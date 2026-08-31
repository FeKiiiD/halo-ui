import * as React from "react";
import { cn } from "../../lib/cn";
import { playError, playSuccess } from "../../lib/feedback-sound";
import { useHold } from "../../lib/use-hold";
import { Confetti, VerdictCross, actionSizing, type ActionButtonSize, type ConfettiPiece } from "./action-button-shell";

export interface RewardButtonProps {
  children?: React.ReactNode;
  claimingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  /** Resolving `false` or throwing refuses the reward. */
  onClaim?: () => unknown | Promise<unknown>;
  /** Hold to confirm. On by default: crediting a reward is not reversible. */
  hold?: boolean;
  holdDuration?: number;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
  className?: string;
}

type RewardPhase = "idle" | "charging" | "opening" | "success" | "error";

const burst: ConfettiPiece[] = [
  { dx: -52, dy: -40, rotate: "-130deg", color: "var(--color-accent)" },
  { dx: -32, dy: -54, rotate: "80deg", color: "var(--color-halo-1)" },
  { dx: -10, dy: -62, rotate: "210deg", color: "var(--color-ink)" },
  { dx: 12, dy: -58, rotate: "-70deg", color: "var(--color-accent)" },
  { dx: 34, dy: -46, rotate: "150deg", color: "var(--color-halo-1)" },
  { dx: 52, dy: -22, rotate: "-190deg", color: "var(--color-ink)" },
  { dx: -54, dy: -14, rotate: "60deg", color: "var(--color-halo-1)" },
  { dx: -24, dy: -30, rotate: "-150deg", color: "var(--color-accent)" },
  { dx: 24, dy: -30, rotate: "250deg", color: "var(--color-ink)" },
  { dx: 46, dy: 4, rotate: "-80deg", color: "var(--color-accent)" },
  { dx: -6, dy: -34, rotate: "300deg", color: "var(--color-halo-1)" },
  { dx: 8, dy: -20, rotate: "-40deg", color: "var(--color-accent)" },
];

/**
 * Credits a reward: the gift shakes while the press is held, the lid flies off
 * when it lands, and confetti bursts on confirmation.
 *
 * Held by default and sized for the counter, because this is the moment the
 * whole product exists for — and because an accidental credit cannot be taken
 * back. The choreography is deliberately the loudest in the system; it is
 * spent once per transaction, not on every save.
 */
export function RewardButton({
  children = "Hold to credit",
  claimingLabel = "Crediting…",
  successLabel = "Reward credited.",
  errorLabel = "Credit refused.",
  onClaim,
  hold = true,
  holdDuration = 1100,
  size = "counter",
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  minWidth = 260,
  className,
}: RewardButtonProps) {
  const g = actionSizing[size];
  const [phase, setPhase] = React.useState<RewardPhase>("idle");

  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = React.useRef(true);
  const committed = React.useRef(false);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const later = React.useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (alive.current) fn();
    }, ms);
    timers.current.push(id);
  }, []);

  const dispatch = React.useCallback(async () => {
    setPhase("opening");
    const began = Date.now();
    let ok = true;

    try {
      const returned = onClaim ? await onClaim() : true;
      ok = returned !== false;
    } catch {
      ok = false;
    }

    // The lid takes 420ms to leave; the verdict waits for it.
    later(
      () => {
        (ok ? playSuccess : playError)();
        setPhase(ok ? "success" : "error");
        committed.current = false;
        later(() => setPhase("idle"), ok ? 2400 : 2400);
      },
      Math.max(0, 520 - (Date.now() - began)),
    );
  }, [onClaim, later]);

  const { progress, handlers } = useHold({
    duration: holdDuration,
    disabled: disabled || phase !== "idle",
    onComplete: () => {
      committed.current = true;
      void dispatch();
    },
  });

  // Charging is just idle-with-progress: the box wobbles under the finger.
  const charging = hold && progress > 0 && phase === "idle";
  const shown: RewardPhase = charging ? "charging" : phase;
  const idle = phase === "idle" && !charging;
  const busy = shown === "charging" || shown === "opening";
  const label = typeof children === "string" ? children : "Credit reward";

  return (
    <button
      type="button"
      disabled={disabled || phase !== "idle"}
      onClick={hold ? undefined : () => void dispatch()}
      {...(hold ? handlers : null)}
      aria-busy={busy}
      aria-live="polite"
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn(
        "relative isolate inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
        "font-sans font-medium leading-[1] halo-focus rounded-pill",
        "transition-[background-color,color] duration-[180ms] ease-standard",
        "disabled:cursor-not-allowed",
        hold && "touch-none select-none",
        phase === "error"
          ? "bg-error-soft text-error"
          : phase === "success"
            ? "bg-accent text-accent-ink"
            : "bg-ink text-paper",
        disabled && "bg-surface-disabled text-text-secondary",
        idle && !disabled && "cursor-pointer hover:bg-ink-hairline",
        progress > 0 && !committed.current && "cursor-grabbing",
        shown === "opening" && "cursor-progress",
        g.box,
        g.text,
        iconOnly ? cn("px-0", g.square) : fullWidth && "flex w-full",
        className,
      )}
      style={{
        ...(iconOnly || fullWidth ? null : { minWidth }),
        ...(phase === "error" ? { animation: "halo-shake 480ms var(--ease-standard) 1" } : null),
      }}
    >
      {shown === "idle" || shown === "charging" ? (
        <span aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden rounded-pill">
          <span
            className="block size-full origin-left bg-accent-deep"
            style={{
              transform: `scaleX(${progress})`,
              transition: progress === 0 ? "transform var(--dur-base) var(--ease-standard)" : "none",
            }}
          />
        </span>
      ) : null}

      {shown === "idle" || busy ? (
        <span
          className="inline-flex items-center gap-2"
          // Past the midpoint the accent fill is under the label, so it inverts.
          style={progress > 0.52 ? { color: "var(--color-ink)" } : undefined}
        >
          <svg
            width={g.icon}
            height={g.icon}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="overflow-visible"
          >
            {/* The box: shaking while charged, compressing as the lid leaves. */}
            <g
              style={{
                transformOrigin: "10px 14px",
                animation:
                  shown === "charging"
                    ? "halo-reward-wobble 420ms ease-in-out infinite"
                    : shown === "opening"
                      ? "halo-reward-box 420ms var(--ease-standard)"
                      : "none",
              }}
            >
              <path
                d="M4 9.5h12v7.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M10 9.5V18" stroke="currentColor" strokeWidth="1.5" />
            </g>
            {/* The lid and its ribbon, leaving together. */}
            <g
              style={{
                transformOrigin: "10px 7px",
                animation: shown === "opening" ? "halo-reward-lid 420ms forwards" : "none",
              }}
            >
              <path d="M2.8 6.2h14.4v3.3H2.8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path
                d="M10 6.2C10 4.4 8.9 3 7.6 3S6 5 7.4 5.6c.9.4 1.8.6 2.6.6Zm0 0C10 4.4 11.1 3 12.4 3S14 5 12.6 5.6c-.9.4-1.8.6-2.6.6Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </g>
          </svg>
          {iconOnly ? null : <span>{shown === "opening" ? claimingLabel : children}</span>}
        </span>
      ) : null}

      {phase === "success" ? (
        <>
          <span
            className="inline-flex items-center gap-2"
            style={{ animation: "halo-pop 320ms var(--ease-standard) both" }}
          >
            <svg width={g.icon} height={g.icon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4 10.6 8 14.5 16 5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 26,
                  strokeDashoffset: 26,
                  animation: "halo-draw 340ms var(--ease-standard) 100ms forwards",
                }}
              />
            </svg>
            {iconOnly ? null : successLabel}
          </span>
          <Confetti pieces={burst} />
        </>
      ) : null}

      {phase === "error" ? (
        <span
          className="inline-flex items-center gap-2"
          style={{ animation: "halo-pop 260ms var(--ease-standard) both" }}
        >
          <VerdictCross size={g.icon} />
          {iconOnly ? null : errorLabel}
        </span>
      ) : null}
    </button>
  );
}
