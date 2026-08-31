import * as React from "react";
import { cn } from "../../lib/cn";
import {
  addToIso,
  formatIsoDate,
  isWithin,
  monthOf,
  shiftMonth,
  todayIso,
  toIso,
  type IsoDate,
  type MonthView,
} from "../../lib/date";
import { useDismissable } from "../../lib/use-dismissable";
import { Icon } from "../core/icon";
import { Calendar } from "./calendar";
import { Field } from "./field";
import { fieldChrome, fieldHeights, panelChrome, type FieldSize } from "./field-chrome";

export interface RangePreset {
  label: string;
  /** Returns [from, to] as ISO dates. */
  get: () => [IsoDate, IsoDate];
}

/** The ranges a back-office actually asks for. */
export const rangePresets: RangePreset[] = [
  {
    label: "Last 7 days",
    get: () => [addToIso(todayIso(), -6, "day"), todayIso()],
  },
  {
    label: "Last 30 days",
    get: () => [addToIso(todayIso(), -29, "day"), todayIso()],
  },
  {
    label: "This month",
    get: () => {
      const now = new Date();
      return [toIso(new Date(now.getFullYear(), now.getMonth(), 1)), todayIso()];
    },
  },
  {
    label: "Last month",
    get: () => {
      const now = new Date();
      return [
        toIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        // Day 0 of this month is the last day of the previous one.
        toIso(new Date(now.getFullYear(), now.getMonth(), 0)),
      ];
    },
  },
  {
    label: "This year",
    get: () => {
      const now = new Date();
      return [toIso(new Date(now.getFullYear(), 0, 1)), todayIso()];
    },
  },
];

export interface DateRangePickerProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  help?: string;

  from?: IsoDate;
  to?: IsoDate;
  onChange?: (from: IsoDate, to: IsoDate) => void;

  min?: IsoDate;
  max?: IsoDate;
  presets?: RangePreset[];
  /** Months shown side by side. Two lets a range cross a boundary in one view. */
  months?: 1 | 2;

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
 * A span between two dates.
 *
 * Selection is two clicks: the first sets a pending start, the second closes
 * the range. Between them the band previews under the cursor, which is what
 * tells the user the second click is still owed.
 *
 * Clicking backwards is not an error — the two dates are sorted on commit, so
 * picking the end first works exactly as well.
 */
export function DateRangePicker({
  label,
  hint,
  error,
  help,
  from,
  to,
  onChange,
  min,
  max,
  presets = rangePresets,
  months = 2,
  size = "md",
  disabled = false,
  required = false,
  placeholder = "Select a period",
  monthNames,
  weekdayNames,
  id,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  /** The first click of a two-click selection. */
  const [pending, setPending] = React.useState<IsoDate | null>(null);
  const [peek, setPeek] = React.useState<IsoDate | null>(null);

  const [view, setView] = React.useState<MonthView>(() => monthOf(from));

  const close = React.useCallback(() => {
    setOpen(false);
    // Abandon a half-drawn range rather than leaving it armed for the next open.
    setPending(null);
    setPeek(null);
  }, []);

  const root = useDismissable<HTMLDivElement>(open, close);

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const height = fieldHeights[size];

  const select = (date: IsoDate) => {
    if (!isWithin(date, min, max)) return;

    if (!pending) {
      setPending(date);
      setPeek(date);
      return;
    }

    // Sorted, so a backwards selection is a valid one.
    const [start, end] = pending <= date ? [pending, date] : [date, pending];
    onChange?.(start, end);
    setPending(null);
    setPeek(null);
    setOpen(false);
  };

  const displayStart = pending ?? from ?? null;
  const displayEnd = pending ? null : (to ?? null);

  const summary =
    from && to ? `${formatIsoDate(from)} — ${formatIsoDate(to)}` : "";

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      help={help}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      className={className}
    >
      <div ref={root} className="relative">
        <button
          type="button"
          id={fieldId}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-invalid={error ? true : undefined}
          onClick={() => (open ? close() : setOpen(true))}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={cn(
            "box-border flex w-full items-center gap-2 pl-3 pr-3 text-left font-sans",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
            summary ? "text-text-primary" : "text-text-secondary",
            fieldChrome({ tone: error ? "error" : null, focus: open, hover, disabled }),
          )}
          style={{ height }}
        >
          <span className="inline-flex shrink-0 text-text-secondary">
            <Icon name="calendar" size={17} />
          </span>
          <span className="flex-1 truncate tabular-nums">{summary || placeholder}</span>
          <span
            className={cn(
              "inline-flex shrink-0 text-text-secondary transition-transform duration-[150ms] ease-out",
              open && "rotate-180",
            )}
          >
            <Icon name="chevron-down" size={16} />
          </span>
        </button>

        {open ? (
          <div
            role="dialog"
            aria-label="Date range"
            className={cn(
              "absolute left-0 top-[calc(100%+6px)] z-60 flex origin-top-left gap-4 overflow-visible p-3",
              panelChrome,
              "max-h-none",
            )}
            style={{ animation: "halo-panel-in 120ms ease-out both" }}
          >
            {presets.length ? (
              <div className="flex w-32 shrink-0 flex-col gap-0.5 border-r border-hairline pr-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const [start, end] = preset.get();
                      onChange?.(start, end);
                      setView(monthOf(start));
                      close();
                    }}
                    className="rounded-lg border-none bg-transparent px-2 py-2 text-left font-sans text-[13px] text-text-primary transition-colors duration-[120ms] ease-out hover:bg-mist halo-focus"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex gap-4">
              {Array.from({ length: months }, (_, offset) => (
                <Calendar
                  key={offset}
                  view={shiftMonth(view, offset)}
                  // Both calendars page the same underlying view, so they stay
                  // adjacent months rather than drifting apart.
                  onViewChange={(next) => setView(shiftMonth(next, -offset))}
                  // The first calendar pages backwards, the last forwards; a
                  // single calendar keeps both.
                  nav={months === 1 ? "both" : offset === 0 ? "back" : "forward"}
                  rangeStart={displayStart}
                  rangeEnd={displayEnd}
                  hovered={peek}
                  onHover={pending ? setPeek : undefined}
                  onSelect={select}
                  min={min}
                  max={max}
                  monthNames={monthNames}
                  weekdayNames={weekdayNames}
                  className="w-[248px] shrink-0"
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Field>
  );
}
