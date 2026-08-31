import * as React from "react";
import { cn } from "../../lib/cn";
import { useDismissable } from "../../lib/use-dismissable";
import { Icon } from "../core/icon";
import { Field } from "./field";
import {
  fieldChrome,
  fieldHeights,
  optionChrome,
  panelChrome,
  type FieldSize,
} from "./field-chrome";

export interface MultiSelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectProps<T extends string = string> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  help?: string;

  options: MultiSelectOption<T>[];
  /** Always controlled: a multi-select's value is the caller's to own. */
  values?: T[];
  onChange?: (values: T[]) => void;
  placeholder?: string;

  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  /** Hard cap. At the limit, unselected options go unavailable rather than
   *  silently doing nothing. */
  max?: number;
  /** Chips shown before collapsing the rest into "+n". */
  maxChips?: number;

  selectAllLabel?: string;
  clearAllLabel?: string;
  limitLabel?: (max: number) => string;
  id?: string;
  className?: string;
}

/**
 * Several choices from a known list, shown as removable chips in the field.
 *
 * Chips collapse past `maxChips` so a long selection cannot grow the field
 * without limit — the count carries what the chips no longer show.
 */
export function MultiSelect<T extends string = string>({
  label,
  hint,
  error,
  help,
  options,
  values = [],
  onChange,
  placeholder = "Select…",
  size = "md",
  disabled = false,
  required = false,
  max,
  maxChips = 3,
  selectAllLabel = "Select all",
  clearAllLabel = "Clear all",
  limitLabel = (limit) => `Limit reached: ${limit} maximum.`,
  id,
  className,
}: MultiSelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const root = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const minHeight = fieldHeights[size];

  const atLimit = max !== undefined && values.length >= max;
  const allOn = options.length > 0 && values.length === options.length;

  const toggle = (value: T) => {
    if (!onChange) return;
    if (values.includes(value)) onChange(values.filter((v) => v !== value));
    else if (!atLimit) onChange([...values, value]);
  };

  const shown = values.slice(0, maxChips);
  const extra = values.length - shown.length;
  const labelOf = (value: T) => options.find((o) => o.value === value)?.label ?? value;

  return (
    <Field
      label={label}
      hint={hint}
      // The limit is a warning, not an error: nothing is wrong, there is just
      // no room for more.
      error={atLimit ? undefined : error}
      warning={atLimit && max !== undefined ? limitLabel(max) : undefined}
      help={help}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      counter={max !== undefined ? `${values.length} / ${max}` : undefined}
      counterAlert={atLimit}
      className={className}
    >
      <div ref={root} className="relative">
        <button
          type="button"
          id={fieldId}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={error ? true : undefined}
          onClick={() => setOpen((o) => !o)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={cn(
            "box-border flex w-full flex-wrap items-center gap-1.5 py-1.5 pl-2 pr-3 text-left font-sans text-[15px]",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
            fieldChrome({ tone: error ? "error" : null, focus: open, hover, disabled }),
          )}
          style={{ minHeight }}
        >
          {values.length === 0 ? (
            <span className="pl-1.5 text-text-secondary">{placeholder}</span>
          ) : null}

          {shown.map((value) => (
            <span
              key={value}
              className="inline-flex h-6.5 items-center gap-1.25 rounded-pill bg-accent py-0 pl-2.5 pr-1.25 text-[13px] font-medium text-accent-ink"
            >
              {labelOf(value)}
              {/* A nested <button> is invalid inside the trigger button, so the
                  remove control is a span with an explicit role. */}
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Remove ${labelOf(value)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(value);
                }}
                className="inline-flex cursor-pointer p-0.5"
              >
                <Icon name="x" size={12} />
              </span>
            </span>
          ))}

          {extra > 0 ? (
            <span className="text-[13px] font-medium text-text-secondary">+{extra}</span>
          ) : null}

          <span
            className={cn(
              "ml-auto inline-flex text-text-secondary transition-transform duration-[150ms] ease-out",
              open && "rotate-180",
            )}
          >
            <Icon name="chevron-down" size={16} />
          </span>
        </button>

        {open ? (
          <div
            role="listbox"
            aria-multiselectable="true"
            className={cn("absolute left-0 right-0 top-[calc(100%+6px)] z-60 origin-top", panelChrome)}
            style={{ animation: "halo-panel-in 120ms ease-out both" }}
          >
            <div
              onClick={() =>
                onChange?.(
                  allOn ? [] : options.slice(0, max ?? options.length).map((option) => option.value),
                )
              }
              className={cn(
                optionChrome({}).className,
                "mb-1 rounded-none border-b border-hairline font-medium",
              )}
            >
              {allOn ? clearAllLabel : selectAllLabel}
            </div>

            {options.map((option) => {
              const on = values.includes(option.value);
              const blocked = (!on && atLimit) || option.disabled;
              const chrome = optionChrome({ selected: on });

              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={on}
                  aria-disabled={blocked || undefined}
                  onClick={() => !blocked && toggle(option.value)}
                  className={cn(chrome.className, blocked && "cursor-not-allowed opacity-45")}
                  style={chrome.style}
                >
                  <span
                    className={cn(
                      "inline-flex size-4.5 shrink-0 items-center justify-center rounded-[5px]",
                      "text-surface-page transition-colors duration-[120ms] ease-out",
                      on ? "border-none bg-text-primary" : "border-[1.5px] border-border-strong bg-transparent",
                    )}
                  >
                    {on ? <Icon name="check" size={12} /> : null}
                  </span>
                  {option.label}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Field>
  );
}
