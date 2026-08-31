import * as React from "react";
import { cn } from "../../lib/cn";

export interface RadioProps {
  label?: React.ReactNode;
  checked?: boolean;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Radios in one group must share a name for arrow-key navigation to work. */
  name?: string;
  value: string;
  id?: string;
  className?: string;
}

/**
 * A radio. Always controlled — a radio only means anything relative to its
 * siblings, so the group owns the value and there is no uncontrolled mode.
 *
 * The dot scales from nothing with a slight overshoot; the ring itself only
 * darkens. Unlike the checkbox, the accent stays out of it: a list of radios
 * would otherwise put several accent marks on one screen.
 */
export function Radio({
  label,
  checked = false,
  onChange,
  disabled = false,
  name,
  value,
  id,
  className,
}: RadioProps) {
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
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full border bg-surface-card",
          "transition-colors duration-[220ms] ease-standard",
          checked ? "border-border-strong" : "border-border-subtle",
          "group-has-[:focus-visible]:outline group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-2 group-has-[:focus-visible]:outline-focus-ring",
        )}
      >
        <span
          className={cn(
            "size-2.5 rounded-full bg-text-primary",
            checked ? "scale-100 opacity-100" : "scale-0 opacity-0",
          )}
          style={{
            transition:
              "transform 260ms cubic-bezier(.34,1.56,.64,1), opacity 160ms var(--ease-standard)",
          }}
        />
      </span>

      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(value)}
        className="sr-only"
      />

      {label}
    </label>
  );
}
