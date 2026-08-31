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
  type FieldTone,
} from "./field-chrome";

export interface Currency {
  code: string;
  /** Shown in the field. "€", "CHF", "$ CA". */
  symbol: string;
  name: string;
  decimals: number;
}

export const currencies: Currency[] = [
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  { code: "CHF", symbol: "CHF", name: "Swiss franc", decimals: 2 },
  { code: "GBP", symbol: "£", name: "Pound sterling", decimals: 2 },
  { code: "USD", symbol: "$", name: "US dollar", decimals: 2 },
  { code: "CAD", symbol: "$ CA", name: "Canadian dollar", decimals: 2 },
  { code: "MAD", symbol: "DH", name: "Moroccan dirham", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese yen", decimals: 0 },
];

export interface AmountFieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  warning?: React.ReactNode;
  success?: React.ReactNode;
  help?: string;

  /** The formatted string. Parse with `parseNumber` at submission. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;

  currency?: string;
  onCurrencyChange?: (code: string) => void;
  options?: Currency[];
  /** Where the symbol sits. Prefix suits "$ 29", suffix suits "29 €". */
  symbolPosition?: "prefix" | "suffix";

  /** One-tap amounts, shown as pills below. */
  presets?: number[];
  /** Rates keyed by currency code, relative to the selected one. */
  rates?: Record<string, number>;
  /** Shows a converted figure under the field. */
  convertTo?: string;

  min?: number;
  max?: number;
  separators?: NumberSeparators;

  bare?: boolean;
  size?: FieldSize;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** Blurs the amount behind a reveal toggle. For payroll and the like. */
  masked?: boolean;
  id?: string;
  className?: string;
}

/**
 * A monetary amount with a switchable currency.
 *
 * The decimal count follows the currency: euros take two, yen take none. That
 * is why the currency lives inside the field rather than beside it — changing
 * it changes how the number itself is written.
 *
 * On blur the amount is padded to the currency's precision ("29" → "29,00"),
 * which is what stops a list of amounts from looking ragged. While typing it
 * is left exactly as entered.
 */
export function AmountField({
  label = "Amount",
  hint,
  error,
  warning,
  success,
  help,
  value,
  defaultValue = "",
  onChange,
  onBlur,
  currency = "EUR",
  onCurrencyChange,
  options = currencies,
  symbolPosition = "suffix",
  presets,
  rates,
  convertTo,
  min,
  max,
  separators,
  bare = false,
  size = "md",
  disabled = false,
  readOnly = false,
  required = false,
  masked = false,
  id,
  className,
}: AmountFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);

  const [val, set] = useControllableState({ value, defaultValue, onChange });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const root = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const height = fieldHeights[size];
  const tone: FieldTone | null = error ? "error" : warning ? "warning" : success ? "success" : null;

  const current = options.find((option) => option.code === currency) ?? options[0];
  const decimals = current?.decimals ?? 2;
  const numeric = parseNumber(val, separators);
  const blurred = masked && !revealed;

  const emit = (raw: string) => set(formatTyped(raw, { decimals, separators }));

  const outOfRange =
    numeric !== null && ((min !== undefined && numeric < min) || (max !== undefined && numeric > max));

  const converted =
    convertTo && rates?.[convertTo] !== undefined && numeric !== null
      ? formatNumber(numeric * rates[convertTo]!, {
          decimals: options.find((o) => o.code === convertTo)?.decimals ?? 2,
          separators,
        })
      : null;

  const symbol = current ? (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap text-text-secondary",
        size === "counter" ? "text-[16px]" : "text-[14px]",
      )}
    >
      {current.symbol}
    </span>
  ) : null;

  if (!current) return null;

  return (
    <Field
      reserveMessage={!bare}
      label={bare ? undefined : label}
      hint={hint}
      error={error ?? (outOfRange ? `Between ${min ?? "—"} and ${max ?? "—"}.` : undefined)}
      warning={warning}
      success={success}
      help={help}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      className={className}
    >
      <div ref={root} className="relative">
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) inputRef.current?.focus();
          }}
          className={cn(
            "box-border flex w-full cursor-text items-center gap-1.5 pl-3.5 pr-1.5",
            fieldChrome({
              tone: outOfRange ? "error" : tone,
              focus: focus || open,
              hover,
              disabled,
              readOnly,
            }),
          )}
          style={{ height }}
        >
          {symbolPosition === "prefix" ? symbol : null}

          <input
            ref={inputRef}
            id={fieldId}
            inputMode="decimal"
            value={val}
            placeholder={decimals ? `0${separators?.decimal ?? ","}${"0".repeat(decimals)}` : "0"}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-invalid={error ?? outOfRange ? true : undefined}
            aria-describedby={fieldId ? `${fieldId}-msg` : undefined}
            onChange={(event) => emit(event.target.value)}
            onFocus={(event) => {
              setFocus(true);
              event.target.select();
            }}
            onBlur={(event) => {
              setFocus(false);
              // Pad to the currency's precision, so a column of amounts lines
              // up. Only on blur: doing it while typing fights the caret.
              if (numeric !== null && decimals) {
                set(formatNumber(numeric, { decimals, separators }));
              }
              onBlur?.(event.target.value);
            }}
            className={cn(
              "h-full min-w-0 flex-1 border-none bg-transparent text-right font-sans font-medium tabular-nums outline-none",
              readOnly ? "text-text-secondary" : "text-text-primary",
              "placeholder:font-normal placeholder:text-text-secondary",
              "transition-[filter] duration-220 ease-standard",
              blurred && "select-none blur-[5px]",
              size === "counter" ? "text-[19px]" : "text-[16px]",
            )}
          />

          {symbolPosition === "suffix" ? symbol : null}

          {masked ? (
            <button
              type="button"
              aria-label={revealed ? "Hide amount" : "Show amount"}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setRevealed((r) => !r)}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:text-text-primary"
            >
              <Icon name={revealed ? "eye-off" : "eye"} size={16} />
            </button>
          ) : null}

          {options.length > 1 ? (
            <>
              <span aria-hidden="true" className="my-2 w-px shrink-0 self-stretch bg-hairline" />
              <button
                type="button"
                disabled={disabled || readOnly}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen((o) => !o);
                }}
                aria-label={`Currency: ${current.name}`}
                aria-expanded={open}
                aria-haspopup="listbox"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-pill border-none px-2 font-sans font-medium",
                  "text-text-primary transition-colors duration-[120ms] ease-out halo-focus",
                  open ? "bg-mist" : "bg-transparent hover:bg-mist",
                  disabled || readOnly ? "cursor-not-allowed" : "cursor-pointer",
                  size === "counter" ? "text-[15px]" : "text-[13px]",
                )}
                style={{ height: height - 14 }}
              >
                {current.code}
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
        </div>

        {open ? (
          <div
            role="listbox"
            className={cn(
              "absolute right-0 top-[calc(100%+6px)] z-60 min-w-[220px] origin-top-right",
              panelChrome,
            )}
            style={{ animation: "halo-panel-in 120ms ease-out both" }}
          >
            {options.map((option) => {
              const chrome = optionChrome({ selected: option.code === current.code, height: 36 });
              return (
                <div
                  key={option.code}
                  role="option"
                  aria-selected={option.code === current.code}
                  onClick={() => {
                    onCurrencyChange?.(option.code);
                    setOpen(false);
                  }}
                  className={chrome.className}
                  style={chrome.style}
                >
                  <span className="w-10 shrink-0 font-medium">{option.code}</span>
                  <span className="flex-1 truncate text-text-secondary">{option.name}</span>
                  <span className="shrink-0 text-text-secondary">{option.symbol}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {converted && convertTo ? (
          <div className="mt-1.5 text-body-s tabular-nums text-text-secondary">
            ≈ {converted} {options.find((o) => o.code === convertTo)?.symbol ?? convertTo}
          </div>
        ) : null}

        {presets?.length && !bare ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={disabled || readOnly}
                onClick={() => set(formatNumber(preset, { decimals, separators }))}
                className={cn(
                  "h-7 rounded-pill border border-border-subtle px-3 font-sans text-[12px] font-medium",
                  "tabular-nums transition-colors duration-[150ms] ease-out halo-focus",
                  "disabled:cursor-not-allowed",
                  numeric === preset
                    ? "bg-ink text-paper"
                    : "bg-surface-card text-text-primary hover:bg-mist",
                )}
              >
                {formatNumber(preset, { decimals: 0, separators })} {current.symbol}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Field>
  );
}
