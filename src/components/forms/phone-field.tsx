import * as React from "react";
import { cn } from "../../lib/cn";
import { normalize, useDismissable } from "../../lib/use-dismissable";
import { Icon } from "../core/icon";
import { Field } from "./field";
import {
  fieldChrome,
  fieldFontSizes,
  fieldHeights,
  optionChrome,
  panelChrome,
  type FieldSize,
  type FieldTone,
} from "./field-chrome";

export interface Country {
  /** ISO 3166-1 alpha-2. */
  iso: string;
  /** With the leading plus. */
  dial: string;
  name: string;
  /** National digits, excluding the dial code. */
  length: number;
  /** How those digits are grouped for display: [1,2,2,2,2] → "6 12 34 56 78". */
  groups: number[];
}

/** A working default. Pass your own list for anything wider. */
export const countries: Country[] = [
  { iso: "FR", dial: "+33", name: "France", length: 9, groups: [1, 2, 2, 2, 2] },
  { iso: "BE", dial: "+32", name: "Belgium", length: 9, groups: [3, 2, 2, 2] },
  { iso: "CH", dial: "+41", name: "Switzerland", length: 9, groups: [2, 3, 2, 2] },
  { iso: "LU", dial: "+352", name: "Luxembourg", length: 9, groups: [3, 3, 3] },
  { iso: "ES", dial: "+34", name: "Spain", length: 9, groups: [3, 3, 3] },
  { iso: "IT", dial: "+39", name: "Italy", length: 10, groups: [3, 3, 4] },
  { iso: "DE", dial: "+49", name: "Germany", length: 11, groups: [4, 7] },
  { iso: "PT", dial: "+351", name: "Portugal", length: 9, groups: [3, 3, 3] },
  { iso: "GB", dial: "+44", name: "United Kingdom", length: 10, groups: [4, 6] },
  { iso: "MA", dial: "+212", name: "Morocco", length: 9, groups: [3, 3, 3] },
  { iso: "CA", dial: "+1", name: "Canada", length: 10, groups: [3, 3, 4] },
  { iso: "US", dial: "+1", name: "United States", length: 10, groups: [3, 3, 4] },
];

export interface PhoneFieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  warning?: React.ReactNode;
  success?: React.ReactNode;
  help?: string;

  /** The national part, already grouped. The dial code is separate. */
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;

  country?: string;
  onCountryChange?: (iso: string) => void;
  options?: Country[];

  /**
   * Renders the flag for a country. Omit and the ISO code is shown in a chip.
   *
   * NOTHING IS FETCHED BY DEFAULT: the source system pulled flag artwork from
   * three CDNs in turn, which makes a form field depend on the network and
   * leaks a request per render. Supply your own bundled artwork if you want
   * flags — the library will not reach out on your behalf.
   */
  renderFlag?: (country: Country) => React.ReactNode;

  bare?: boolean;
  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  searchPlaceholder?: string;
  id?: string;
  className?: string;
}

/** Groups the national digits per the country's own convention. */
function groupDigits(digits: string, groups: number[]): string {
  const parts: string[] = [];
  let index = 0;

  for (const size of groups) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  // Anything past the pattern is appended rather than dropped, so a longer
  // number than expected is still visible while being typed.
  if (index < digits.length) parts.push(digits.slice(index));

  return parts.join(" ");
}

/**
 * A phone number with a country selector.
 *
 * The dial code and the national digits stay separate values: they are chosen
 * and typed separately, and joining them is a formatting decision that belongs
 * to whatever consumes the number.
 *
 * Digits are regrouped on every keystroke per the selected country, and capped
 * at its expected length — which is also what the counter reports.
 */
export function PhoneField({
  label = "Phone",
  hint,
  error,
  warning,
  success,
  help,
  value = "",
  onChange,
  onBlur,
  country = "FR",
  onCountryChange,
  options = countries,
  renderFlag,
  bare = false,
  size = "md",
  disabled = false,
  required = false,
  searchPlaceholder = "Search a country…",
  id,
  className,
}: PhoneFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const root = useDismissable<HTMLDivElement>(open, close);

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const height = fieldHeights[size];
  const tone: FieldTone | null = error ? "error" : warning ? "warning" : success ? "success" : null;

  const current = options.find((option) => option.iso === country) ?? options[0];
  const digits = value.replace(/\D/g, "");

  const set = (raw: string) => {
    if (!current) return;
    const cleaned = raw.replace(/\D/g, "").slice(0, current.length);
    onChange?.(groupDigits(cleaned, current.groups));
  };

  const visible = query
    ? options.filter(
        (option) =>
          normalize(option.name).includes(normalize(query)) ||
          option.dial.includes(query) ||
          normalize(option.iso).includes(normalize(query)),
      )
    : options;

  if (!current) return null;

  return (
    <Field
      reserveMessage={!bare}
      label={bare ? undefined : label}
      hint={hint}
      error={error}
      warning={warning}
      success={success}
      help={help}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      counter={digits.length ? `${digits.length} / ${current.length}` : undefined}
      className={className}
    >
      <div ref={root} className="relative">
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={cn(
            "box-border flex items-center gap-2 pl-1 pr-2",
            fieldChrome({ tone, focus: focus || open, hover, disabled }),
          )}
          style={{ height }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => (open ? close() : setOpen(true))}
            aria-label={`Dial code: ${current.name} ${current.dial}`}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-pill border-none px-2 font-sans",
              "text-text-primary transition-colors duration-[120ms] ease-out halo-focus",
              open ? "bg-mist" : "bg-transparent hover:bg-mist",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
            )}
            style={{ height: height - 12 }}
          >
            {renderFlag ? renderFlag(current) : <IsoChip iso={current.iso} />}
            <span className="text-[14px] font-medium tabular-nums">{current.dial}</span>
            <span
              className={cn(
                "inline-flex text-text-secondary transition-transform duration-[150ms] ease-out",
                open && "rotate-180",
              )}
            >
              <Icon name="chevron-down" size={13} />
            </span>
          </button>

          <span aria-hidden="true" className="my-2 w-px shrink-0 self-stretch bg-hairline" />

          <input
            id={fieldId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={value}
            disabled={disabled}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={fieldId ? `${fieldId}-msg` : undefined}
            onChange={(event) => set(event.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={(event) => {
              setFocus(false);
              onBlur?.(event.target.value);
            }}
            className="h-full min-w-0 flex-1 border-none bg-transparent font-sans tabular-nums text-text-primary outline-none placeholder:text-text-secondary"
            style={{ fontSize: fieldFontSizes[size] }}
          />
        </div>

        {open ? (
          <div
            role="listbox"
            className={cn("absolute left-0 top-[calc(100%+6px)] z-60 w-[280px] origin-top-left", panelChrome)}
            style={{ animation: "halo-panel-in 120ms ease-out both" }}
          >
            <div className="px-1 pb-2 pt-0.5">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="box-border h-9 w-full rounded-[10px] border border-border-subtle bg-surface-card px-3 font-sans text-[14px] text-text-primary outline-none"
              />
            </div>

            {visible.length === 0 ? (
              <div className="px-3 py-3.5 text-body-s text-text-secondary">No results</div>
            ) : (
              visible.map((option) => {
                const chrome = optionChrome({ selected: option.iso === current.iso, height: 36 });
                return (
                  <div
                    key={option.iso}
                    role="option"
                    aria-selected={option.iso === current.iso}
                    onClick={() => {
                      onCountryChange?.(option.iso);
                      close();
                    }}
                    className={chrome.className}
                    style={chrome.style}
                  >
                    {renderFlag ? renderFlag(option) : <IsoChip iso={option.iso} />}
                    <span className="flex-1 truncate">{option.name}</span>
                    <span className="shrink-0 text-[13px] tabular-nums text-text-secondary">
                      {option.dial}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </Field>
  );
}

/**
 * The two-letter code in a chip, used when no flag renderer is supplied.
 *
 * Not an emoji flag: Windows ships no flag glyphs at all, so 🇫🇷 degrades to
 * the bare letters "FR" on a large share of screens — inconsistently styled and
 * differently sized from everything around it.
 */
function IsoChip({ iso }: { iso: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-3.5 w-[18px] shrink-0 items-center justify-center rounded-[2px] bg-mist-strong font-sans text-[9px] font-semibold tracking-[-0.02em] text-ink"
    >
      {iso.toUpperCase()}
    </span>
  );
}
