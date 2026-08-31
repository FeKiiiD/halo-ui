import * as React from "react";

/**
 * Closes a panel when the user clicks outside it or presses Escape.
 *
 * `mousedown` rather than `click`: a click fires after the mouse is released,
 * so a press that starts inside the panel and drifts outside — selecting text,
 * dragging a slider — would dismiss it on release. mousedown settles the
 * question at the moment of the press.
 */
export function useDismissable<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
): React.RefObject<T | null> {
  const ref = React.useRef<T>(null);

  // Held in a ref so the effect does not resubscribe on every render when the
  // caller passes an inline arrow.
  const onDismissRef = React.useRef(onDismiss);
  React.useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  React.useEffect(() => {
    if (!open) return;

    const away = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismissRef.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismissRef.current();
    };

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return ref;
}

/**
 * Arrow-key navigation over a list of options.
 *
 * Returns the active index and a key handler. The index is clamped rather than
 * wrapped: wrapping from the last option back to the first makes a long list
 * feel like it lost your place.
 */
export function useListNavigation(options: {
  length: number;
  open: boolean;
  onOpen: () => void;
  onSelect: (index: number) => void;
  onClose?: () => void;
}): {
  active: number;
  setActive: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
} {
  const { length, open, onOpen, onSelect, onClose } = options;
  const [active, setActive] = React.useState(-1);

  // A filtered list can shrink under the cursor; clamp so the highlight never
  // points past the end.
  React.useEffect(() => {
    if (active >= length) setActive(length - 1);
  }, [length, active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        if (open && active >= 0) onSelect(active);
        else onOpen();
        break;
      case "ArrowDown":
        event.preventDefault();
        if (!open) onOpen();
        setActive((a) => Math.min(length - 1, a + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case "Home":
        if (!open) break;
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        if (!open) break;
        event.preventDefault();
        setActive(length - 1);
        break;
      case "Escape":
        onClose?.();
        break;
      default:
        break;
    }
  };

  return { active, setActive, onKeyDown };
}

/** Strips diacritics and case, so "Genève" matches a search for "geneve". */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
