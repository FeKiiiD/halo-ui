import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import type { FieldSize } from "./field-chrome";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  size?: FieldSize;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Required: the group has no visible label of its own. */
  ariaLabel?: string;
  className?: string;
}

const sizing: Record<FieldSize, { height: string; text: string; padding: string }> = {
  sm: { height: "h-[30px]", text: "text-[13px]", padding: "px-3" },
  md: { height: "h-[38px]", text: "text-[14px]", padding: "px-4.5" },
  counter: { height: "h-12", text: "text-[16px]", padding: "px-4.5" },
};

/**
 * Two to four mutually exclusive options, all visible at once. Beyond four,
 * use a Select — the segments get too narrow to read and the thumb's travel
 * stops being legible.
 *
 * The white thumb slides between positions rather than the labels changing
 * colour on their own, so the eye can follow which option it moved from. It
 * carries the system's only small shadow, because it has to read as sitting
 * above the mist track.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  defaultValue,
  onChange,
  size = "md",
  disabled = false,
  fullWidth = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const [selected, set] = useControllableState<T | undefined>({
    value,
    defaultValue: defaultValue ?? options[0]?.value,
    onChange: onChange as ((value: T | undefined) => void) | undefined,
  });

  const g = sizing[size];
  // Falls back to the first segment so the thumb is never orphaned off-track
  // when the value does not match any option.
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === selected),
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative rounded-pill bg-mist p-[3px] font-sans",
        fullWidth ? "grid" : "inline-grid",
        disabled && "opacity-50",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      <span
        aria-hidden="true"
        // The thumb is the page surface rather than the card surface: on the
        // ink régime the track is already elevated, so a card-coloured thumb
        // would not separate from it.
        className="absolute bottom-[3px] left-[3px] top-[3px] rounded-pill bg-surface-page shadow-[0_1px_4px_rgb(11_11_11/0.10)]"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
          transition: "transform 180ms cubic-bezier(.4,0,.2,1)",
        }}
      />

      {options.map((option) => {
        const on = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => set(option.value)}
            className={cn(
              "relative z-[1] whitespace-nowrap rounded-pill border-none bg-transparent halo-focus",
              "font-sans transition-colors duration-[150ms] ease-out",
              "disabled:cursor-not-allowed",
              g.height,
              g.text,
              g.padding,
              // text-primary, not ink: the thumb follows the régime, so a
              // hard-coded ink label goes unreadable in dark mode.
              on ? "font-semibold text-text-primary" : "font-normal text-text-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
