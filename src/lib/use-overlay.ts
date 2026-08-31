import * as React from "react";

/**
 * Keeps a closed overlay mounted long enough to play its exit animation.
 *
 * Without this an overlay unmounts the instant `open` flips, so the closing
 * animation never runs — the panel simply vanishes. `mounted` stays true for
 * `duration` after close; `closing` tells the panel which animation to play.
 */
export function usePresence(open: boolean, duration = 240): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = React.useState(open);
  const [closing, setClosing] = React.useState(false);
  // Guards the first render: a component mounting closed must not play an exit.
  const wasOpen = React.useRef(open);

  React.useEffect(() => {
    if (open) {
      wasOpen.current = true;
      setMounted(true);
      setClosing(false);
      return;
    }

    if (!wasOpen.current) return;
    wasOpen.current = false;
    setClosing(true);

    const timer = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, duration);
    return () => clearTimeout(timer);
  }, [open, duration]);

  return { mounted, closing };
}

/** Elements that can hold focus, in DOM order. */
const FOCUSABLE =
  'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

export interface UseOverlayOptions {
  open: boolean;
  onClose?: () => void;
  /** Set false for a dialog that must be answered rather than dismissed. */
  closeOnEsc?: boolean;
  lockScroll?: boolean;
  /** Must match the exit animation, or the panel disappears mid-fade. */
  duration?: number;
}

/**
 * Everything a modal overlay owes the keyboard: Escape to close, focus moved
 * in on open and restored on close, Tab looped inside the panel, and the page
 * behind it locked from scrolling.
 *
 * THE FOCUS TRAP IS NOT OPTIONAL. Without it, Tab walks out of the dialog into
 * the page behind — which is still there, still interactive to a screen reader,
 * and invisible to a sighted user. The loop is what makes a modal actually
 * modal.
 */
export function useOverlay({
  open,
  onClose,
  closeOnEsc = true,
  lockScroll = true,
  duration = 240,
}: UseOverlayOptions): {
  mounted: boolean;
  closing: boolean;
  panelRef: React.RefObject<HTMLDivElement | null>;
} {
  const { mounted, closing } = usePresence(open, duration);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<Element | null>(null);

  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  React.useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement;

    // A frame's delay: the panel has to exist and be laid out before it can
    // take focus, and preventScroll stops the page jumping behind the veil.
    const focusTimer = setTimeout(() => {
      panelRef.current?.focus({ preventScroll: true });
    }, 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEsc) {
        // stopPropagation so a nested overlay closes only the innermost one.
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const candidates = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(
        (element) =>
          !(element as HTMLButtonElement).disabled &&
          // offsetParent is null for anything display:none — a hidden control
          // must not be a tab stop inside the loop.
          element.offsetParent !== null,
      );
      if (!candidates.length) return;

      const first = candidates[0]!;
      const last = candidates[candidates.length - 1]!;

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = lockScroll ? document.body.style.overflow : null;
    if (lockScroll) document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      if (lockScroll) document.body.style.overflow = previousOverflow ?? "";

      // Restoring focus to whatever opened the overlay is what keeps a
      // keyboard user's place in the page. Deferred a tick so the panel is
      // gone before focus moves.
      const target = previouslyFocused.current;
      if (target instanceof HTMLElement) {
        setTimeout(() => target.focus({ preventScroll: true }), 0);
      }
    };
  }, [open, closeOnEsc, lockScroll]);

  return { mounted, closing, panelRef };
}

/**
 * Reports whether a scrollable region has content above or below the fold.
 *
 * Used to show a header or footer hairline only when it is separating
 * something — a rule under a header that has nothing scrolled beneath it is
 * noise.
 */
export function useScrollEdges(
  ref: React.RefObject<HTMLElement | null>,
  deps: React.DependencyList = [],
): { edges: { top: boolean; bottom: boolean }; onScroll: () => void; remeasure: () => void } {
  const [edges, setEdges] = React.useState({ top: false, bottom: false });

  const read = React.useCallback(() => {
    const element = ref.current;
    if (!element) return;
    // A 2px tolerance: sub-pixel layout otherwise flickers the rule on and off.
    setEdges({
      top: element.scrollTop > 2,
      bottom: element.scrollTop + element.clientHeight < element.scrollHeight - 2,
    });
  }, [ref]);

  React.useEffect(() => {
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read, ...deps]);

  return { edges, onScroll: read, remeasure: read };
}
