import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Field } from "./field";

export interface SliderProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Unit shown beside the value in the counter lane. */
  suffix?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

/**
 * A value on a continuum, where the approximate position matters more than the
 * exact figure. If the exact figure matters, use a NumberField.
 *
 * A real `<input type="range">` sits transparent on top of the drawn track, so
 * keyboard support, drag behaviour and touch targets are the browser's — the
 * visible parts are pointer-events-none decoration underneath.
 */
export function Slider({
  label,
  hint,
  error,
  value,
  defaultValue = 50,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix,
  disabled = false,
  name,
  id,
  className,
}: SliderProps) {
  const [val, set] = useControllableState({ value, defaultValue, onChange });
  const [focused, setFocused] = React.useState(false);

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

  // Guard against max === min, which would divide by zero.
  const percent = max === min ? 0 : ((val - min) / (max - min)) * 100;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={fieldId}
      id={fieldId}
      counter={`${val}${suffix ? ` ${suffix}` : ""}`}
      className={className}
    >
      <div className={cn("relative flex h-6 items-center", disabled && "opacity-50")}>
        <div className="absolute inset-x-0 h-1.5 rounded-pill bg-mist-strong" />
        <div
          className={cn("absolute left-0 h-1.5 rounded-pill", error ? "bg-error" : "bg-text-primary")}
          style={{ width: `${percent}%` }}
        />
        {/* The ring is a 1px outline rather than a border so the knob's own
            2px surface-coloured border reads as a gap. The transparent input
            above carries the real focus, so the ring has to be drawn here or
            keyboard users get no focus indicator at all. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute size-4.5 rounded-full border-2 border-surface-card bg-text-primary",
            focused
              ? "shadow-[0_0_0_1px_var(--color-border-strong),0_0_0_4px_var(--color-focus-ring)]"
              : "shadow-[0_0_0_1px_var(--color-border-strong)]",
          )}
          style={{ left: `calc(${percent}% - 9px)` }}
        />

        <input
          id={fieldId}
          name={name}
          type="range"
          min={min}
          max={max}
          step={step}
          value={val}
          disabled={disabled}
          onChange={(event) => set(Number(event.target.value))}
          // :focus-visible only, so a click-drag does not leave a ring behind.
          onFocus={(event) => setFocused(event.target.matches(":focus-visible"))}
          onBlur={() => setFocused(false)}
          className={cn(
            "absolute inset-x-0 m-0 h-6 w-full opacity-0",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
          )}
        />
      </div>
    </Field>
  );
}
