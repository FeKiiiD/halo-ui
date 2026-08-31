import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Icon } from "../core/icon";
import { Field } from "./field";
import { fieldHeights, type FieldSize } from "./field-chrome";

export interface NumberStepperProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: React.ReactNode;
  size?: FieldSize;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** Delay before a held button starts repeating, then the repeat interval. */
const HOLD_DELAY = 450;
const HOLD_INTERVAL = 70;

/**
 * A small integer adjusted by tapping — a quantity, a number of stamps, a
 * count of seats. There is no text input: the value is bounded and small
 * enough that typing is slower than tapping.
 *
 * Holding a button repeats. That is why the counter is sized for a fingertip
 * and why the value uses tabular figures — 9 → 10 must not shift the buttons.
 */
export function NumberStepper({
  label,
  hint,
  error,
  value,
  defaultValue = 0,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  suffix,
  size = "md",
  disabled = false,
  id,
  className,
}: NumberStepperProps) {
  const [val, set] = useControllableState({ value, defaultValue, onChange });

  const height = size === "counter" ? fieldHeights.counter : fieldHeights.md;
  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  // The live value is mirrored into a ref so the repeat loop reads the current
  // one rather than the value captured when the hold began.
  const latest = React.useRef(val);
  latest.current = val;

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopHold = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  React.useEffect(() => stopHold, [stopHold]);

  const startHold = (direction: 1 | -1) => {
    timer.current = setTimeout(function repeat() {
      const next = clamp(latest.current + direction * step);
      // Stop at the bound rather than spinning against it.
      if (next === latest.current) return;
      set(next);
      timer.current = setTimeout(repeat, HOLD_INTERVAL);
    }, HOLD_DELAY);
  };

  const button = (direction: 1 | -1, glyph: "plus" | "minus", blocked: boolean) => (
    <button
      type="button"
      aria-label={direction === 1 ? "Increase" : "Decrease"}
      disabled={disabled || blocked}
      onClick={() => set(clamp(val + direction * step))}
      onPointerDown={() => startHold(direction)}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill border-none halo-focus",
        "transition-colors duration-[180ms] ease-standard",
        disabled || blocked
          ? "cursor-not-allowed bg-surface-disabled text-text-secondary"
          : "cursor-pointer bg-text-primary text-surface-page",
      )}
      style={{ width: height - 12, height: height - 12 }}
    >
      <Icon name={glyph} size={16} />
    </button>
  );

  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId} id={fieldId} className={className}>
      <div
        className={cn(
          "inline-flex min-w-[168px] items-center justify-between gap-2 rounded-input border px-1.5",
          error ? "border-error" : "border-border-subtle",
          disabled ? "bg-surface-disabled opacity-50" : "bg-surface-card",
        )}
        style={{ height }}
      >
        {button(-1, "minus", val <= min)}

        {/* aria-live so a screen reader hears the value change without the
            focus moving off the button being pressed. */}
        <span
          id={fieldId}
          aria-live="polite"
          className={cn(
            "font-medium tabular-nums text-text-primary",
            size === "counter" ? "text-[20px]" : "text-[17px]",
          )}
        >
          {val}
          {suffix ? <span className="ml-1 text-body-s text-text-secondary">{suffix}</span> : null}
        </span>

        {button(1, "plus", val >= max)}
      </div>
    </Field>
  );
}
