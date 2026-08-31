import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";

/** The three ways a field can be marked, and what each one looks like. */
export type FieldTone = "error" | "warning" | "success";

export const toneStyles: Record<
  FieldTone,
  { border: string; text: string; icon: "circle-alert" | "triangle-alert" | "circle-check" }
> = {
  error: { border: "border-error", text: "text-error", icon: "circle-alert" },
  warning: { border: "border-warning", text: "text-warning", icon: "triangle-alert" },
  success: { border: "border-success", text: "text-success", icon: "circle-check" },
};

export interface ChromeState {
  tone?: FieldTone | null;
  focus?: boolean;
  hover?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}

/**
 * The shell every Halo input wears: 12px radius, a hairline that darkens on
 * hover and goes solid on focus, and a soft 3px halo instead of a heavy ring.
 *
 * Focus here is deliberately quiet — a 220ms colour shift and a barely-there
 * glow. The loud 2px ring is reserved for keyboard focus on buttons; a text
 * field that shouts every time it is clicked makes a form exhausting to fill.
 *
 * A tone always wins over focus and hover: once a field is in error, that has
 * to stay legible even while the user is typing in it.
 */
export function fieldChrome({ tone, focus, hover, disabled, readOnly }: ChromeState): string {
  const t = tone ? toneStyles[tone] : null;

  return cn(
    "rounded-input border outline-none",
    "transition-[border-color,box-shadow,background-color] duration-[150ms] ease-out",

    disabled || readOnly ? "bg-surface-disabled" : "bg-surface-card",
    disabled && "opacity-50",

    t
      ? t.border
      : focus
        ? "border-border-strong"
        : hover && !disabled && !readOnly
          ? "border-[#B7C0BE]"
          : "border-border-subtle",

    // The glow is tinted by the tone so an error field reads as wrong even at
    // the edge of vision.
    focus && (tone === "error" ? "shadow-[0_0_0_3px_rgb(214_49_74/0.10)]" : "shadow-[0_0_0_3px_rgb(11_11_11/0.055)]"),
  );
}

/** A floating panel: dropdown, calendar, option list. */
export const panelChrome = cn(
  "rounded-panel border border-hairline bg-surface-card p-2 shadow-float",
  "max-h-80 overflow-y-auto",
);

/** One row in such a panel. Selected wins over active — the accent marks the
 *  committed choice, the mist marks where the cursor merely is. */
export function optionChrome({
  active,
  selected,
  height = 40,
}: {
  active?: boolean;
  selected?: boolean;
  height?: number;
}): { className: string; style: CSSProperties } {
  return {
    className: cn(
      "flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-1.5",
      "text-body text-text-primary transition-colors duration-[120ms] ease-out",
      selected ? "bg-accent text-accent-ink" : active ? "bg-mist" : "bg-transparent",
    ),
    style: { minHeight: height },
  };
}

/** Field heights, shared by every control so a row of mixed inputs lines up. */
export const fieldHeights = { sm: 36, md: 48, counter: 56 } as const;
export const fieldFontSizes = { sm: 13, md: 15, counter: 17 } as const;

export type FieldSize = keyof typeof fieldHeights;
