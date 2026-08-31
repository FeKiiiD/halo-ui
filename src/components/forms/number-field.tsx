import * as React from "react";
import { cn } from "../../lib/cn";
import {
  formatNumber,
  formatTyped,
  parseNumber,
  type NumberSeparators,
} from "../../lib/number-format";
import { useControllableState } from "../../lib/use-controllable-state";
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

export interface NumberUnit {
  value: string;
  label: string;
}

export interface NumberFieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  warning?: React.ReactNode;
  success?: React.ReactNode;
  help?: string;

  /** The formatted string, not a number — this field owns its own formatting. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;

  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  grouping?: boolean;
  separators?: NumberSeparators;

  /** A fixed unit shown after the value. */
  unit?: string;
  /** Switchable units. Takes precedence over `unit`. */
  units?: NumberUnit[];
  unitValue?: string;
  onUnitChange?: (value: string) => void;

  /** One-tap common values, shown as pills under the field. */
  presets?: number[];
  /** Adds − / + buttons either side of the value. */
  stepper?: boolean;

  bare?: boolean;
  size?: FieldSize;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  id?: string;
  className?: string;

  minLabel?: (min: number, unit: string) => string;
  maxLabel?: (max: number, unit: string) => string;
  nearMaxLabel?: (max: number) => string;
}

/**
 * A typed figure, formatted as it is entered.
 *
 * The value is a STRING, not a number: "1 208," is a legitimate intermediate
 * state while someone is typing "1 208,50", and it has no numeric equivalent.
 * Use `parseNumber` at submission time.
 *
 * Range violations surface as the field's own error rather than waiting for
 * the caller — a number outside its bounds is wrong the moment it is typed —
 * and approaching the maximum raises a warning first.
 */
export function NumberField({
  label,
  hint,
  error,
  warning,
  success,
  help,
  value,
  defaultValue = "",
  onChange,
  onBlur,
  min,
  max,
  step = 1,
  decimals = 0,
  grouping = true,
  separators,
  unit,
  units,
  unitValue,
  onUnitChange,
  presets,
  stepper = false,
  bare = false,
  size = "md",
  disabled = false,
  readOnly = false,
  required = false,
  fullWidth = true,
  id,
  className,
  minLabel = (value, suffix) => `Minimum ${value}${suffix}.`,
  maxLabel = (value, suffix) => `Maximum ${value}${suffix}.`,
  nearMaxLabel = (value) => `Close to the maximum (${value}).`,
}: NumberFieldProps) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const [val, set] = useControllableState({ value, defaultValue, onChange });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const root = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const height = fieldHeights[size];

  const numeric = parseNumber(val, separators);
  const currentUnit = units ? (units.find((u) => u.value === unitValue) ?? units[0]) : null;
  const unitSuffix = unit ? ` ${unit}` : "";

  const emit = (raw: string) => set(formatTyped(raw, { decimals, grouping, separators }));

  const bump = (direction: 1 | -1) => {
    if (disabled || readOnly) return;
    const base = numeric ?? min ?? 0;
    let next = base + direction * step;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    emit(decimals ? next.toFixed(decimals).replace(".", separators?.decimal ?? ",") : String(next));
  };

  const outOfRange =
    numeric !== null && ((min !== undefined && numeric < min) || (max !== undefined && numeric > max));
  const nearMax = !outOfRange && numeric !== null && max !== undefined && numeric >= max * 0.9;

  const rangeError = outOfRange
    ? min !== undefined && numeric !== null && numeric < min
      ? minLabel(min, unitSuffix)
      : maxLabel(max as number, unitSuffix)
    : undefined;

  const stepButton = (direction: 1 | -1, glyph: "plus" | "minus", blocked: boolean) => (
    <button
      type="button"
      aria-label={direction === 1 ? "Increase" : "Decrease"}
      disabled={disabled || readOnly || blocked}
      onClick={(event) => {
        event.stopPropagation();
        bump(direction);
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill border-none halo-focus",
        "transition-colors duration-[120ms] ease-out",
        disabled || readOnly || blocked
          ? "cursor-not-allowed bg-surface-disabled text-text-secondary"
          : "cursor-pointer bg-text-primary text-surface-page",
      )}
      style={{ width: height - 14, height: height - 14 }}
    >
      <Icon name={glyph} size={15} />
    </button>
  );

  return (
    <Field
      reserveMessage={!bare}
      label={bare ? undefined : label}
      hint={hint}
      error={error ?? rangeError}
      warning={warning ?? (nearMax && max !== undefined ? nearMaxLabel(max) : undefined)}
      success={success}
      help={help}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      // Formatted on both sides: a counter reading "1208 / 5000" beside a
      // field reading "1 208" looks like two different numbers.
      counter={
        max !== undefined && !outOfRange
          ? `${formatNumber(numeric ?? 0, { decimals, grouping, separators })} / ${formatNumber(max, { grouping, separators })}`
          : undefined
      }
      counterAlert={nearMax}
      className={className}
    >
      <div ref={root} className="relative">
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={(event) => {
            // Only when the padding itself is clicked; a click on the unit
            // button must not steal focus back to the input.
            if (event.target === event.currentTarget) inputRef.current?.focus();
          }}
          className={cn(
            "box-border flex cursor-text items-center gap-1.5 pr-1.5",
            stepper ? "pl-1.5" : "pl-3.5",
            fullWidth && "w-full",
            fieldChrome({
              tone: error ?? rangeError ? "error" : warning ?? nearMax ? "warning" : success ? "success" : null,
              focus: focus || open,
              hover,
              disabled,
              readOnly,
            }),
          )}
          style={{ height }}
        >
          {stepper
            ? stepButton(-1, "minus", min !== undefined && numeric !== null && numeric <= min)
            : null}

          <input
            ref={inputRef}
            id={fieldId}
            inputMode={decimals ? "decimal" : "numeric"}
            value={val}
            placeholder={decimals ? `0${separators?.decimal ?? ","}${"0".repeat(decimals)}` : "0"}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-invalid={error ?? rangeError ? true : undefined}
            aria-describedby={fieldId ? `${fieldId}-msg` : undefined}
            onChange={(event) => emit(event.target.value)}
            // Select on focus: a figure is almost always replaced wholesale,
            // not edited character by character.
            onFocus={(event) => {
              setFocus(true);
              event.target.select();
            }}
            onBlur={(event) => {
              setFocus(false);
              onBlur?.(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                bump(1);
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                bump(-1);
              }
            }}
            className={cn(
              "h-full min-w-0 flex-1 border-none bg-transparent font-sans font-medium tabular-nums outline-none",
              readOnly ? "text-text-secondary" : "text-text-primary",
              "placeholder:font-normal placeholder:text-text-secondary",
              stepper ? "text-center" : "text-right",
              size === "counter" ? "text-[19px]" : "text-[16px]",
            )}
          />

          {unit && !units ? (
            <span
              className={cn(
                "shrink-0 whitespace-nowrap text-text-secondary",
                stepper ? "pr-0" : "pr-1.5",
                size === "counter" ? "text-[16px]" : "text-[14px]",
              )}
            >
              {unit}
            </span>
          ) : null}

          {units && currentUnit ? (
            <>
              <span aria-hidden="true" className="my-2 w-px shrink-0 self-stretch bg-hairline" />
              <button
                type="button"
                disabled={disabled || readOnly}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen((o) => !o);
                }}
                aria-label={`Unit: ${currentUnit.label}`}
                aria-expanded={open}
                aria-haspopup="listbox"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-pill border-none px-2 font-sans font-medium",
                  "whitespace-nowrap text-text-primary transition-colors duration-[120ms] ease-out halo-focus",
                  open ? "bg-mist" : "bg-transparent",
                  disabled || readOnly ? "cursor-not-allowed" : "cursor-pointer",
                  size === "counter" ? "text-[15px]" : "text-[13px]",
                )}
                style={{ height: height - 14 }}
              >
                {currentUnit.label}
                <span
                  className={cn(
                    "inline-flex text-text-secondary transition-transform duration-[150ms] ease-out",
                    open && "rotate-180",
                  )}
                >
                  <Icon name="chevron-down" size={13} />
                </span>
              </button>
            </>
          ) : null}

          {stepper
            ? stepButton(1, "plus", max !== undefined && numeric !== null && numeric >= max)
            : null}
        </div>

        {open && units ? (
          <div
            role="listbox"
            className={cn(
              "absolute right-0 top-[calc(100%+6px)] z-60 min-w-[180px] origin-top-right",
              panelChrome,
            )}
            style={{ animation: "halo-panel-in 120ms ease-out both" }}
          >
            {units.map((option) => {
              const chrome = optionChrome({
                selected: option.value === currentUnit?.value,
                height: 36,
              });
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={option.value === currentUnit?.value}
                  onClick={() => {
                    onUnitChange?.(option.value);
                    setOpen(false);
                  }}
                  className={chrome.className}
                  style={chrome.style}
                >
                  {option.label}
                </div>
              );
            })}
          </div>
        ) : null}

        {presets?.length && !bare ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={disabled || readOnly}
                onClick={() =>
                  emit(decimals ? String(preset).replace(".", separators?.decimal ?? ",") : String(preset))
                }
                className={cn(
                  "h-7 rounded-pill border border-border-subtle px-3 font-sans text-[12px] font-medium",
                  "tabular-nums transition-colors duration-[150ms] ease-out halo-focus",
                  "disabled:cursor-not-allowed",
                  numeric === preset
                    ? "bg-ink text-paper"
                    : "bg-surface-card text-text-primary hover:bg-mist",
                )}
              >
                {preset}
                {unit ? ` ${unit}` : currentUnit ? ` ${currentUnit.label}` : ""}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Field>
  );
}
