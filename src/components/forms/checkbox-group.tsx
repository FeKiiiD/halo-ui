import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../core/icon";
import { Checkbox } from "./checkbox";

export interface CheckboxGroupOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface CheckboxGroupProps<T extends string = string> {
  legend?: React.ReactNode;
  options: CheckboxGroupOption<T>[];
  values?: T[];
  onChange?: (values: T[]) => void;
  disabled?: boolean;
  /** Shown only above three options, where it starts to earn its row. */
  selectAll?: boolean;
  selectAllLabel?: string;
  error?: React.ReactNode;
  className?: string;
}

/**
 * A set of checkboxes with a select-all that reports the indeterminate state.
 *
 * `aria-checked="mixed"` is the part that matters: a half-filled box that
 * announces itself as merely unchecked tells a screen-reader user the opposite
 * of what the sighted user sees.
 */
export function CheckboxGroup<T extends string = string>({
  legend,
  options,
  values = [],
  onChange,
  disabled = false,
  selectAll = true,
  selectAllLabel = "Select all",
  error,
  className,
}: CheckboxGroupProps<T>) {
  const selectable = options.filter((option) => !option.disabled);
  const all = selectable.length > 0 && selectable.every((option) => values.includes(option.value));
  const some = values.length > 0 && !all;

  const flip = () => {
    if (disabled) return;
    // Clearing keeps disabled-but-selected values: the user cannot toggle those
    // individually, so a select-all must not remove them either.
    onChange?.(
      all
        ? values.filter((value) => options.find((o) => o.value === value)?.disabled)
        : [...new Set([...values, ...selectable.map((o) => o.value)])],
    );
  };

  return (
    <fieldset className={cn("m-0 border-none p-0 font-sans", className)}>
      {legend ? (
        <legend
          className={cn(
            "mb-3 p-0 text-body-s font-medium",
            error ? "text-error" : "text-text-primary",
          )}
        >
          {legend}
        </legend>
      ) : null}

      <div className="flex flex-col gap-3">
        {selectAll && options.length > 2 ? (
          <label
            onClick={flip}
            className={cn(
              "flex items-center gap-2.5 border-b border-hairline pb-1.5",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
          >
            <span
              role="checkbox"
              aria-checked={some ? "mixed" : all}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(event) => {
                if (event.key !== " " && event.key !== "Enter") return;
                event.preventDefault();
                flip();
              }}
              className={cn(
                "inline-flex size-4.5 items-center justify-center rounded-[5px] halo-focus",
                "text-surface-page transition-colors duration-[120ms] ease-out",
                all || some ? "border-none bg-text-primary" : "border-[1.5px] border-border-strong bg-transparent",
              )}
            >
              {all ? <Icon name="check" size={12} /> : some ? <Icon name="minus" size={12} /> : null}
            </span>
            <span className="text-body font-medium text-text-primary">{selectAllLabel}</span>
          </label>
        ) : null}

        {options.map((option) => (
          <Checkbox
            key={option.value}
            label={option.label}
            disabled={disabled || option.disabled}
            checked={values.includes(option.value)}
            onChange={(on) =>
              onChange?.(
                on ? [...values, option.value] : values.filter((value) => value !== option.value),
              )
            }
          />
        ))}
      </div>

      {error ? (
        <span
          role="alert"
          className="mt-2 inline-flex items-center gap-1.5 text-body-s text-error"
        >
          <Icon name="circle-alert" size={14} />
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}
