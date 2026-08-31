import * as React from "react";
import { cn } from "../../lib/cn";
import {
  formatIsoDate,
  isWithin,
  monthOf,
  parseTypedDate,
  type IsoDate,
  type MonthView,
} from "../../lib/date";
import { useControllableState } from "../../lib/use-controllable-state";
import { useDismissable } from "../../lib/use-dismissable";
import { Icon } from "../core/icon";
import { Calendar } from "./calendar";
import { Field } from "./field";
import { fieldChrome, fieldFontSizes, fieldHeights, panelChrome, type FieldSize } from "./field-chrome";

export interface DatePreset {
  label: string;
  /** Returns the ISO date to jump to. */
  get: () => IsoDate;
}

export interface DatePickerProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  help?: string;

  /** ISO "YYYY-MM-DD". Never a Date — see lib/date for why. */
  value?: IsoDate;
  defaultValue?: IsoDate;
  onChange?: (value: IsoDate) => void;

  min?: IsoDate;
  max?: IsoDate;
  /** Shortcuts in a rail beside the calendar: today, next Monday, and so on. */
  presets?: DatePreset[];

  bare?: boolean;
  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  monthNames?: string[];
  weekdayNames?: string[];
  id?: string;
  className?: string;
}

/**
 * A single date, typeable or picked from a calendar.
 *
 * BOTH ROUTES MATTER: a keyboard user entering a birth date should not have to
 * page back through a calendar twenty years, and someone choosing "next
 * Thursday" should not have to work out the number. The text input accepts
 * DD/MM/YYYY and commits on blur; anything unparseable reverts rather than
 * clearing what was there.
 */
export function DatePicker({
  label,
  hint,
  error,
  help,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  presets,
  bare = false,
  size = "md",
  disabled = false,
  required = false,
  placeholder = "DD/MM/YYYY",
  monthNames,
  weekdayNames,
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);

  const [val, set] = useControllableState({ value, defaultValue, onChange });

  // The typed text is separate from the committed value: "05/03" has to survive
  // long enough to become "05/03/2026".
  const [draft, setDraft] = React.useState(() => formatIsoDate(val));
  React.useEffect(() => setDraft(formatIsoDate(val)), [val]);

  const [view, setView] = React.useState<MonthView>(() => monthOf(val));
  const root = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const height = fieldHeights[size];

  const commit = () => {
    const parsed = parseTypedDate(draft);
    // Reverting rather than clearing: a typo should not destroy the value the
    // user could see a moment ago.
    if (!parsed || !isWithin(parsed, min, max)) {
      setDraft(formatIsoDate(val));
      return;
    }
    set(parsed);
    setView(monthOf(parsed));
  };

  const pick = (date: IsoDate) => {
    set(date);
    setOpen(false);
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
            aria-label="Open calendar"
            aria-expanded={open}
            aria-haspopup="dialog"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border-none",
              "cursor-pointer text-text-primary transition-colors duration-[120ms] ease-out halo-focus",
              open ? "bg-mist" : "bg-transparent hover:bg-mist",
            )}
          >
            <Icon name="calendar" size={18} />
          </button>
        </div>

        {open ? (
          <div
            role="dialog"
            aria-label="Calendar"
            className={cn(
              "absolute left-0 top-[calc(100%+6px)] z-60 flex origin-top-left overflow-visible p-3",
              panelChrome,
              "max-h-none",
            )}
            style={{
              animation: "halo-panel-in 120ms ease-out both",
              width: presets ? 372 : 272,
            }}
          >
            {presets ? (
              <div className="mr-3 flex w-24 flex-col gap-0.5 border-r border-hairline pr-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const date = preset.get();
                      if (isWithin(date, min, max)) pick(date);
                    }}
                    className="rounded-lg border-none bg-transparent px-2 py-2 text-left font-sans text-[13px] text-text-primary transition-colors duration-[120ms] ease-out hover:bg-mist halo-focus"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}

            <Calendar
              view={view}
              onViewChange={setView}
              selected={val || null}
              onSelect={pick}
              min={min}
              max={max}
              monthNames={monthNames}
              weekdayNames={weekdayNames}
            />
          </div>
        ) : null}
      </div>
    </Field>
  );
}
