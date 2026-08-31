import * as React from "react";
import { cn } from "../../lib/cn";
import { parseTypedTime, timeSlots } from "../../lib/date";
import { useControllableState } from "../../lib/use-controllable-state";
import { useDismissable } from "../../lib/use-dismissable";
import { Icon } from "../core/icon";
import { Field } from "./field";
import {
  fieldChrome,
  fieldFontSizes,
  fieldHeights,
  optionChrome,
  panelChrome,
  type FieldSize,
} from "./field-chrome";

export interface TimePickerProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  help?: string;

  /** "HH:MM", 24-hour. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;

  /** Minutes between slots. */
  step?: number;
  min?: string;
  max?: string;

  bare?: boolean;
  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
}

/**
 * A time, typed loosely or chosen from a list of slots.
 *
 * The parser accepts "9", "9h30", "9:30", "9.30" — people type times every one
 * of those ways, and refusing input that is perfectly clear is the field's
 * fault, not the user's. Anything it cannot read reverts rather than clearing.
 *
 * The slot list scrolls to the current value when it opens: a list of 96 slots
 * that always starts at midnight is a list nobody can use.
 */
export function TimePicker({
  label,
  hint,
  error,
  help,
  value,
  defaultValue = "",
  onChange,
  step = 15,
  min = "00:00",
  max = "23:45",
  bare = false,
  size = "md",
  disabled = false,
  required = false,
  placeholder = "HH:MM",
  id,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);

  const [val, set] = useControllableState({ value, defaultValue, onChange });
  const [draft, setDraft] = React.useState(val);
  React.useEffect(() => setDraft(val), [val]);

  const root = useDismissable<HTMLDivElement>(open, () => setOpen(false));
  const listRef = React.useRef<HTMLDivElement>(null);

  const slots = React.useMemo(() => timeSlots(min, max, step), [min, max, step]);

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const height = fieldHeights[size];

  // Scroll the selection into view on open. A layout effect, so it happens
  // before paint and the list never appears at the top and then jumps.
  React.useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const selected = listRef.current.querySelector<HTMLElement>('[aria-selected="true"]');
    if (selected) listRef.current.scrollTop = selected.offsetTop - 80;
  }, [open]);

  const commit = () => {
    const parsed = parseTypedTime(draft);
    if (!parsed) {
      setDraft(val);
      return;
    }
    set(parsed);
  };

  return (
    <Field
      reserveMessage={!bare}
      label={bare ? undefined : label}
      hint={hint}
      error={error}
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
          className={cn(
            "box-border flex items-center gap-2 pl-3 pr-1.5",
            fieldChrome({ tone: error ? "error" : null, focus: focus || open, hover, disabled }),
          )}
          style={{ height }}
        >
          <span className="inline-flex shrink-0 text-text-secondary">
            <Icon name="clock" size={17} />
          </span>

          <input
            id={fieldId}
            value={draft}
            placeholder={placeholder}
            disabled={disabled}
            inputMode="numeric"
            aria-invalid={error ? true : undefined}
            aria-describedby={fieldId ? `${fieldId}-msg` : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => {
              setFocus(false);
              commit();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              }
            }}
            className="h-full min-w-0 flex-1 border-none bg-transparent font-sans tabular-nums text-text-primary outline-none placeholder:text-text-secondary"
            style={{ fontSize: fieldFontSizes[size] }}
          />

          <button
            type="button"
            aria-label="Open time slots"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "inline-flex size-8.5 shrink-0 items-center justify-center rounded-[10px] border-none",
              "cursor-pointer text-text-primary transition-colors duration-[120ms] ease-out halo-focus",
              open ? "bg-mist" : "bg-transparent hover:bg-mist",
            )}
          >
            <Icon name="chevron-down" size={16} />
          </button>
        </div>

        {open ? (
          <div
            ref={listRef}
            role="listbox"
            className={cn(
              "absolute left-0 top-[calc(100%+6px)] z-60 w-[148px] origin-top-left",
              panelChrome,
              "max-h-60",
            )}
            style={{ animation: "halo-panel-in 120ms ease-out both" }}
          >
            {slots.map((slot) => {
              const chrome = optionChrome({ selected: slot === val, height: 34 });
              return (
                <div
                  key={slot}
                  role="option"
                  aria-selected={slot === val}
                  onClick={() => {
                    set(slot);
                    setOpen(false);
                  }}
                  className={cn(chrome.className, "tabular-nums")}
                  style={chrome.style}
                >
                  {slot}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Field>
  );
}
