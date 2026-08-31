import * as React from "react";
import { cn } from "../../lib/cn";
import { playError, playSuccess } from "../../lib/feedback-sound";
import { Icon } from "../core/icon";
import { overlayTones, type OverlayTone } from "./overlay-chrome";

export type OverlayPhase = "idle" | "pending" | "success" | "error";

export interface OverlayActionProps {
  label: React.ReactNode;
  /** Replaces the label once the action has succeeded. */
  doneLabel?: React.ReactNode;
  tone?: OverlayTone;
  phase?: OverlayPhase;
  counter?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * The primary action of a dialog, carrying the request it fires.
 *
 * Same grammar as the choreographed buttons, at dialog scale: a spinner while
 * it runs, a drawn tick on success, an error fill on refusal. Success flips to
 * the accent even on a destructive dialog — the deletion happened, and that is
 * a completed action, not a dangerous one.
 */
export function OverlayAction({
  label,
  doneLabel,
  tone = "neutral",
  phase = "idle",
  counter = false,
  onClick,
  disabled,
  className,
}: OverlayActionProps) {
  const ok = phase === "success";
  const bad = phase === "error";
  const busy = phase === "pending";
  const t = overlayTones[tone];

  return (
    <button
      type="button"
      // Locked once it has succeeded: the dialog is about to close, and a
      // second press would fire the request again.
      disabled={disabled || busy || ok}
      onClick={onClick}
      aria-busy={busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-pill border-none px-5.5 font-sans font-medium",
        "transition-colors duration-[180ms] ease-standard halo-focus",
        counter ? "h-14 text-[17px]" : "h-11 text-[15px]",
        disabled
          ? "cursor-not-allowed bg-surface-disabled text-text-secondary"
          : ok
            ? "bg-accent text-accent-ink"
            : bad
              ? "bg-error text-paper"
              : cn(t.action, !busy && t.actionHover),
        busy && "cursor-progress",
        className,
      )}
    >
      {busy ? (
        <span className="inline-flex" style={{ animation: "halo-spin 900ms linear infinite" }}>
          <Icon name="loader-circle" size={17} />
        </span>
      ) : ok ? (
        <svg
          width="17"
          height="17"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          style={{ animation: "halo-pop 280ms var(--ease-standard) both" }}
        >
          <path
            d="M4 10.6 8 14.5 16 5.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 26,
              strokeDashoffset: 26,
              animation: "halo-draw 300ms var(--ease-standard) 60ms forwards",
            }}
          />
        </svg>
      ) : bad ? (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      ) : null}

      {ok ? (doneLabel ?? label) : label}
    </button>
  );
}

/**
 * Runs a dialog's primary action through the phase machine.
 *
 * Kept separate from `useAsyncVerdict` because a dialog's success has a
 * consequence that a button's does not: it closes the dialog. The hold before
 * closing is what lets the tick actually be seen.
 */
export function useOverlayAction(options: {
  onAction?: () => unknown | Promise<unknown>;
  onClose?: () => void;
  /** How long the tick shows before the dialog closes. */
  successHold?: number;
  errorHold?: number;
  defaultError?: string;
  sound?: boolean;
}): {
  phase: OverlayPhase;
  message: string | null;
  run: () => Promise<void>;
  reset: () => void;
} {
  const {
    onAction,
    onClose,
    successHold = 900,
    errorHold = 1500,
    defaultError = "That did not go through. Try again.",
    sound = true,
  } = options;

  const [phase, setPhase] = React.useState<OverlayPhase>("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = React.useRef(true);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (alive.current) fn();
    }, ms);
    timers.current.push(id);
  };

  const reset = React.useCallback(() => {
    setPhase("idle");
    setMessage(null);
  }, []);

  const run = React.useCallback(async () => {
    if (!onAction) {
      onClose?.();
      return;
    }

    setPhase("pending");
    setMessage(null);

    try {
      const returned = await onAction();
      if (returned === false) throw new Error("");

      if (sound) playSuccess();
      setPhase("success");
      later(() => {
        setPhase("idle");
        onClose?.();
      }, successHold);
    } catch (error) {
      if (sound) playError();
      setPhase("error");
      // An Error with a message says something specific; an empty one (or a
      // bare `false`) falls back to the generic line.
      setMessage((error instanceof Error && error.message) || defaultError);
      later(() => setPhase("idle"), errorHold);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAction, onClose, successHold, errorHold, defaultError, sound]);

  return { phase, message, run, reset };
}
