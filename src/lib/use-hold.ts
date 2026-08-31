import * as React from "react";

/**
 * Press-and-hold to confirm: the gesture Halo uses for anything irreversible,
 * and the one that works standing at a counter where a stray tap is likely.
 *
 * Progress is driven by requestAnimationFrame rather than a CSS transition
 * because releasing early has to freeze it exactly where it stopped, and a
 * transition cannot be interrogated mid-flight.
 */
export interface UseHoldOptions {
  /** How long the press must be held, in ms. */
  duration?: number;
  onComplete?: () => void;
  disabled?: boolean;
}

export interface UseHold {
  /** 0 → 1. Drive the fill from this. */
  progress: number;
  holding: boolean;
  /** Spread onto the element: pointer, keyboard and cancel handlers. */
  handlers: {
    onPointerDown: (event: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onKeyDown: (event: React.KeyboardEvent) => void;
    onKeyUp: () => void;
  };
}

export function useHold(options: UseHoldOptions = {}): UseHold {
  const { duration = 1200, onComplete, disabled = false } = options;

  const [progress, setProgress] = React.useState(0);
  const frame = React.useRef<number | null>(null);
  const startedAt = React.useRef(0);
  // Latched once the hold completes, so the release that follows cannot reset
  // a gesture that has already fired.
  const fired = React.useRef(false);

  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const stop = React.useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  React.useEffect(() => stop, [stop]);

  const begin = React.useCallback(() => {
    if (disabled || frame.current !== null || fired.current) return;

    startedAt.current = performance.now();
    const tick = (now: number) => {
      const value = Math.min(1, (now - startedAt.current) / duration);
      setProgress(value);

      if (value >= 1) {
        stop();
        fired.current = true;
        onCompleteRef.current?.();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [disabled, duration, stop]);

  const cancel = React.useCallback(() => {
    if (fired.current) return;
    stop();
    setProgress(0);
  }, [stop]);

  /** Call after the confirmed action settles, to accept a new gesture. */
  const handlers = React.useMemo(
    () => ({
      onPointerDown: (event: React.PointerEvent) => {
        // Only the primary button arms the hold; a right-click must not.
        if (event.button !== 0) return;
        begin();
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key !== " " && event.key !== "Enter") return;
        // Space would scroll the page, and both keys auto-repeat — the frame
        // guard in `begin` absorbs the repeats.
        event.preventDefault();
        begin();
      },
      onKeyUp: cancel,
    }),
    [begin, cancel],
  );

  return { progress, holding: progress > 0, handlers };
}
