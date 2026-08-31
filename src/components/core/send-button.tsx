import * as React from "react";
import { cn } from "../../lib/cn";
import { playError, playSuccess } from "../../lib/feedback-sound";
import { useHold } from "../../lib/use-hold";
import { Confetti, VerdictCross, actionSizing, type ActionButtonSize, type ConfettiPiece } from "./action-button-shell";

export interface SendButtonProps {
  children?: React.ReactNode;
  sendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  /** Resolving `false` or throwing makes the plane stall instead of leaving. */
  onSend?: () => unknown | Promise<unknown>;
  /** Require a press-and-hold. Use when the send is irreversible. */
  hold?: boolean;
  holdLabel?: string;
  holdDuration?: number;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
  className?: string;
}

/**
 * The system's send: the plane pitches up, cruises for as long as the server
 * takes, then either leaves the frame with a burst of confetti, or stalls and
 * drops away.
 *
 * This one does not use `useAsyncVerdict` because its busy phase is not a
 * single state: takeoff has to finish before the verdict can land (a plane
 * that vanishes mid-rotation reads as a bug), and the exit is a distinct beat
 * between the answer arriving and the tick appearing.
 */
type SendPhase = "idle" | "takeoff" | "cruise" | "exit" | "stall" | "success" | "error";

const plane = "M2.5 10 17.5 3 12.8 17.5 10.2 11.8 2.5 10Z";

const confetti: ConfettiPiece[] = [
  { dx: -46, dy: -34, rotate: "-120deg", color: "var(--color-accent)" },
  { dx: -28, dy: -48, rotate: "90deg", color: "var(--color-halo-1)" },
  { dx: -8, dy: -54, rotate: "200deg", color: "var(--color-ink)" },
  { dx: 14, dy: -48, rotate: "-60deg", color: "var(--color-accent)" },
  { dx: 34, dy: -36, rotate: "150deg", color: "var(--color-halo-1)" },
  { dx: 48, dy: -14, rotate: "-200deg", color: "var(--color-ink)" },
  { dx: -48, dy: -8, rotate: "70deg", color: "var(--color-halo-1)" },
  { dx: -20, dy: -22, rotate: "-140deg", color: "var(--color-accent)" },
  { dx: 22, dy: -22, rotate: "260deg", color: "var(--color-ink)" },
  { dx: 42, dy: 10, rotate: "-90deg", color: "var(--color-accent)" },
];

const planeAnimation: Record<string, string> = {
  takeoff: "halo-send-takeoff 340ms cubic-bezier(.32,.72,.3,1) forwards",
  cruise: "halo-send-cruise 900ms ease-in-out infinite",
  exit: "halo-send-exit 300ms forwards",
  stall: "halo-send-stall 260ms cubic-bezier(.4,0,.9,.4) forwards",
};

export function SendButton({
  children = "Send",
  sendingLabel = "Sending…",
  successLabel = "Sent.",
  errorLabel = "Could not send.",
  onSend,
  hold = false,
  holdLabel = "Hold to send",
  holdDuration = 1100,
  size = "md",
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  minWidth = 190,
  className,
}: SendButtonProps) {
  const g = actionSizing[size];
  const [phase, setPhase] = React.useState<SendPhase>("idle");

  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = React.useRef(true);
  // Latched between the hold completing and the verdict landing, so the
  // pointer-up that follows a completed hold cannot rewind the takeoff.
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
    const began = Date.now();
    let ok = true;

    try {
      const returned = onSend ? await onSend() : true;
      ok = returned !== false;
    } catch {
      ok = false;
    }

    // 460ms is takeoff (340) plus a beat of cruising: the verdict never
    // interrupts the plane mid-rotation.
    later(
      () => {
        if (ok) {
          setPhase("exit");
          later(() => {
            playSuccess();
            setPhase("success");
            committed.current = false;
            later(() => setPhase("idle"), 2000);
          }, 300);
        } else {
          setPhase("stall");
          later(() => {
            playError();
            setPhase("error");
            committed.current = false;
            later(() => setPhase("idle"), 2400);
          }, 260);
        }
      },
      Math.max(0, 460 - (Date.now() - began)),
    );
  }, [onSend, later]);

  const launch = React.useCallback(() => {
    setPhase("takeoff");
    // Hand over to the cruise loop only if takeoff was not superseded — a fast
    // server can already have moved the phase on.
    later(() => setPhase((current) => (current === "takeoff" ? "cruise" : current)), 340);
    void dispatch();
  }, [dispatch, later]);

  const { progress, handlers } = useHold({
    duration: holdDuration,
    disabled: disabled || phase !== "idle",
    onComplete: () => {
      committed.current = true;
      launch();
    },
  });

  // The hold's own progress arms the takeoff early, so the plane starts
  // rotating under the finger rather than only once the hold completes.
  React.useEffect(() => {
    if (!hold || progress === 0 || phase !== "idle") return;
    setPhase("takeoff");
    later(() => setPhase((current) => (current === "takeoff" ? "cruise" : current)), 340);
  }, [hold, progress, phase, later]);

  const flying = phase === "takeoff" || phase === "cruise" || phase === "exit" || phase === "stall";
  const idle = phase === "idle";
  const label = typeof children === "string" ? children : "Send";

  return (
    <button
      type="button"
      disabled={disabled || !idle}
      onClick={hold ? undefined : launch}
      {...(hold ? handlers : null)}
      aria-busy={flying}
      aria-live="polite"
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn(
        "relative isolate inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
        "font-sans font-medium leading-[1] halo-focus rounded-pill",
        "transition-[background-color,color] duration-[180ms] ease-standard",
        "disabled:cursor-not-allowed",
        hold && "touch-none select-none",
        phase === "error" ? "bg-error-soft text-error" : "bg-accent text-accent-ink",
        disabled && "bg-surface-disabled text-text-secondary",
        idle && !disabled && "cursor-pointer hover:bg-accent-deep",
        flying && "cursor-progress",
        progress > 0 && !committed.current && "cursor-grabbing",
        g.box,
        g.text,
        iconOnly ? cn("overflow-hidden px-0", g.square) : fullWidth && "flex w-full",
        className,
      )}
      style={{
        ...(iconOnly || fullWidth ? null : { minWidth }),
        ...(phase === "error" ? { animation: "halo-shake 480ms var(--ease-standard) 1" } : null),
      }}
    >
      {/* The hold fill, behind everything, retracting if the press is released. */}
      {hold && (idle || phase === "takeoff" || phase === "cruise") ? (
        <span aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden rounded-pill">
          <span
            className="block size-full origin-left bg-accent-deep"
            style={{
              transform: `scaleX(${committed.current ? 1 : progress})`,
              transition: progress === 0 ? "transform var(--dur-base) var(--ease-standard)" : "none",
            }}
          />
        </span>
      ) : null}

      {idle || flying ? (
        <span className="inline-flex items-center gap-2">
          <span className="relative inline-flex items-center">
            {/* Speed lines trailing the plane. They loop while cruising and
                fire once on takeoff, so a long wait does not look frozen. */}
            {flying && phase !== "stall" ? (
              <span
                aria-hidden="true"
                className="absolute right-[calc(100%+2px)] top-1/2 flex -translate-y-1/2 flex-col gap-[3px]"
              >
                {[14, 9, 12].map((width, index) => (
                  <span
                    key={index}
                    className="block h-[1.5px] origin-right rounded-[1px] bg-current opacity-0"
                    style={{
                      width,
                      animation:
                        phase === "cruise"
                          ? `halo-send-streak-loop ${620 + index * 90}ms cubic-bezier(.4,0,.9,.3) ${index * 120}ms infinite`
                          : `halo-send-streak ${420 + index * 40}ms cubic-bezier(.4,0,.9,.3) ${180 + index * 30}ms forwards`,
                    }}
                  />
                ))}
              </span>
            ) : null}

            <span className="inline-flex" style={{ animation: planeAnimation[phase] ?? "none" }}>
              <svg width={g.icon} height={g.icon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d={plane} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </span>

          {iconOnly ? null : (
            <span
              className="inline-block max-w-[240px] overflow-hidden whitespace-nowrap"
              style={
                flying
                  ? { animation: "halo-send-label 300ms cubic-bezier(.4,0,.2,1) 40ms forwards" }
                  : undefined
              }
            >
              {flying ? sendingLabel : hold ? holdLabel : children}
            </span>
          )}
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
                  animation: "halo-draw 340ms var(--ease-standard) 120ms forwards",
                }}
              />
            </svg>
            {iconOnly ? null : successLabel}
          </span>
          <Confetti pieces={confetti} />
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
