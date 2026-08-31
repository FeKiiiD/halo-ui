import * as React from "react";
import { playError, playSuccess } from "./feedback-sound";

/**
 * The lifecycle every choreographed button in Halo shares: idle → busy →
 * success | error → idle.
 *
 * Two behaviours are the point of factoring this out:
 *
 * 1. A FLOOR ON THE BUSY PHASE. If the server answers in 20ms the animation
 *    would flash and read as a glitch, so the verdict waits until `minBusy` has
 *    elapsed. A slow server simply extends the busy phase — the floor never
 *    delays a late answer.
 *
 * 2. A REJECTED PROMISE IS A VERDICT, NOT A CRASH. `onAction` throwing means
 *    the operation failed, which is exactly the error choreography. Returning
 *    `false` means the same thing for callers who do not throw.
 */
export type VerdictPhase = "idle" | "busy" | "success" | "error";

export interface UseAsyncVerdictOptions<T> {
  /** The work. Throwing, or resolving `false`, plays the error choreography. */
  onAction?: (() => T | Promise<T>) | undefined;
  /** Minimum time the busy phase is shown, so the animation always reads. */
  minBusy?: number;
  /** How long the success state holds before returning to idle. */
  successHold?: number;
  /** How long the error state holds before returning to idle. Longer: it is a
   *  message the user has to actually read. */
  errorHold?: number;
  /** Set false to run the choreography silently. */
  sound?: boolean;
}

export interface UseAsyncVerdict<T> {
  phase: VerdictPhase;
  /** Whatever `onAction` resolved to, available during the success phase — a
   *  count, a name, anything a label wants to interpolate. */
  result: T | null;
  run: () => Promise<void>;
  /** True while the phase machine owns the button; it must stay disabled. */
  locked: boolean;
}

export function useAsyncVerdict<T>(options: UseAsyncVerdictOptions<T> = {}): UseAsyncVerdict<T> {
  const { onAction, minBusy = 520, successHold = 1800, errorHold = 2400, sound = true } = options;

  const [phase, setPhase] = React.useState<VerdictPhase>("idle");
  const [result, setResult] = React.useState<T | null>(null);

  // Timers are tracked so an unmount mid-choreography cannot set state on a
  // dead component.
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = React.useRef(true);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const later = React.useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (alive.current) fn();
    }, ms);
    timers.current.push(id);
  }, []);

  // The live phase is read from a ref rather than the state value so `run` does
  // not need `phase` in its dependency list — that would give every consumer a
  // new callback on every phase change.
  const phaseRef = React.useRef<VerdictPhase>("idle");
  phaseRef.current = phase;

  const run = React.useCallback(async () => {
    if (phaseRef.current !== "idle") return;

    setPhase("busy");
    phaseRef.current = "busy";

    const began = Date.now();
    let ok = true;
    let value: T | null = null;

    try {
      const returned = onAction ? await onAction() : (true as unknown as T);
      ok = (returned as unknown) !== false;
      value = returned ?? null;
    } catch {
      ok = false;
    }

    later(
      () => {
        if (sound) (ok ? playSuccess : playError)();
        setResult(value);
        setPhase(ok ? "success" : "error");
        later(() => setPhase("idle"), ok ? successHold : errorHold);
      },
      Math.max(0, minBusy - (Date.now() - began)),
    );
  }, [onAction, minBusy, successHold, errorHold, sound, later]);

  return { phase, result, run, locked: phase !== "idle" };
}
