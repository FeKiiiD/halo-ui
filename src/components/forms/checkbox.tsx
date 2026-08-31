import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";

export interface CheckboxProps {
  label?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  id?: string;
  className?: string;
}

/**
 * A checkbox. The real input is present but visually hidden, so keyboard
 * activation, form submission and screen-reader semantics all come for free —
 * the drawn box is decoration over a working control, not a replacement for
 * one.
 *
 * The tick is drawn rather than faded in, and the box overshoots slightly on
 * the way up. It is the one spring in the system, and it is here because a
 * checkbox is the smallest possible confirmation: it has to feel like it
 * caught.
 */
export function Checkbox({
  label,
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  name,
  value,
  id,
  className,
}: CheckboxProps) {
  const [on, set] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  });

  return (
    <label
      className={cn(
        "group inline-flex items-center gap-3 font-sans text-body text-text-primary",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-md border",
          "transition-[background-color,border-color,transform] duration-[220ms] ease-standard",
          on ? "border-accent bg-accent scale-100" : "border-border-subtle bg-surface-card scale-[0.98]",
          // The focus ring lives on the box, driven by the hidden input's focus.
          "group-has-[:focus-visible]:outline group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-2 group-has-[:focus-visible]:outline-focus-ring",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)" }}
      >
        {on ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2 6.4 4.6 9 10 3.2"
              fill="none"
              stroke="var(--color-accent-ink)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 14,
                strokeDashoffset: 14,
                animation: "halo-draw 220ms var(--ease-standard) 60ms forwards",
              }}
            />
          </svg>
        ) : null}
      </span>

      <input
        type="checkbox"
        id={id}
        name={name}
        value={value}
        checked={on}
        disabled={disabled}
        onChange={(event) => set(event.target.checked)}
        // sr-only rather than display:none: a hidden input cannot be focused,
        // which would take the control off the keyboard entirely.
        className="sr-only"
      />

      {label}
    </label>
  );
}
