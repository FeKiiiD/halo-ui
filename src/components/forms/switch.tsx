import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";

export interface SwitchProps {
  label?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Sitting on the ink régime, where the track needs a translucent fill. */
  onDark?: boolean;
  className?: string;
}

/**
 * An immediate on/off — a setting that takes effect the moment it is flipped,
 * with no save step. If a form has to be submitted afterwards, use a Checkbox
 * instead; a switch that does not take effect immediately is a lie.
 *
 * The knob is lime when on, in both régimes: it is the one lit thing on the
 * track. A disabled switch keeps an ink knob — lime means live, never
 * unavailable.
 */
export function Switch({
  label,
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  onDark = false,
  className,
}: SwitchProps) {
  const [on, set] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  });

  const toggle = () => {
    if (!disabled) set(!on);
  };

  return (
    <label
      className={cn(
        "inline-flex items-center gap-3 font-sans text-body",
        onDark ? "text-paper" : "text-text-primary",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      {/* role="switch" on a span rather than a hidden input: the knob's spring
          is the whole point, and a checkbox would announce itself as one. */}
      <span
        role="switch"
        aria-checked={on}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          toggle();
        }}
        className={cn(
          "relative box-border inline-block h-6.5 w-11 shrink-0 rounded-pill border-[1.5px] halo-focus",
          "transition-[border-color,background-color] duration-[260ms] ease-standard",
          on ? "border-accent-deep" : onDark ? "border-[#2E2E2E]" : "border-hairline",
          disabled
            ? onDark
              ? "bg-white/[0.06]"
              : "bg-surface-disabled"
            : onDark
              ? "bg-white/[0.09]"
              : "bg-surface-card",
        )}
      >
        {/* justify-content cannot be animated, so the knob is positioned and
            moved with a transform. */}
        <span
          className={cn(
            "absolute left-[2.5px] top-[2.5px] size-4.5 rounded-full",
            disabled
              ? onDark
                ? "bg-[#5A5F5F]"
                : "bg-ink"
              : on
                ? "bg-accent"
                : onDark
                  ? "bg-[#7A8180]"
                  : "bg-[#C9D0CE]",
          )}
          style={{
            transform: `translateX(${on ? 18 : 0}px) scale(${on ? 1 : 0.92})`,
            transition:
              "transform 340ms cubic-bezier(.34,1.56,.64,1), background-color 240ms var(--ease-standard)",
          }}
        />
      </span>

      {label}
    </label>
  );
}
