import * as React from "react";
import { cn } from "../../lib/cn";
import {
  frenchMonths,
  frenchWeekdays,
  isWithin,
  monthGrid,
  shiftMonth,
  todayIso,
  type IsoDate,
  type MonthView,
} from "../../lib/date";
import { Icon } from "../core/icon";

export interface CalendarProps {
  view: MonthView;
  onViewChange: (view: MonthView) => void;

  /** The selected day, or the range's ends. */
  selected?: IsoDate | null;
  rangeStart?: IsoDate | null;
  rangeEnd?: IsoDate | null;
  /** The day under the cursor while a range is half-drawn. */
  hovered?: IsoDate | null;
  onHover?: (date: IsoDate | null) => void;

  onSelect: (date: IsoDate) => void;
  min?: IsoDate;
  max?: IsoDate;

  monthNames?: string[];
  weekdayNames?: string[];
  previousLabel?: string;
  nextLabel?: string;
  /** Which month arrows to draw. A range pair keeps "back" on the first
   *  calendar and "forward" on the last, so the two always stay adjacent and
   *  no arrow is inert decoration. */
  nav?: "both" | "back" | "forward" | "none";
  className?: string;
}

/**
 * One month of days. Shared by DatePicker and DateRangePicker so the two can
 * never drift apart visually.
 *
 * A selected day is ink with an accent numeral — one of the four places the
 * accent is allowed, and the only one inside a form. Today carries a hairline
 * ring instead, so the two are never confused.
 */
export function Calendar({
  view,
  onViewChange,
  selected,
  rangeStart,
  rangeEnd,
  hovered,
  onHover,
  onSelect,
  min,
  max,
  monthNames = frenchMonths,
  weekdayNames = frenchWeekdays,
  previousLabel = "Previous month",
  nextLabel = "Next month",
  nav = "both",
  className,
}: CalendarProps) {
  const today = todayIso();
  const cells = monthGrid(view);

  // While a range is half-drawn, the hovered day stands in for its end so the
  // band previews as the pointer moves.
  const end = rangeEnd ?? (rangeStart && hovered && hovered > rangeStart ? hovered : null);

  const inBand = (date: IsoDate) =>
    Boolean(rangeStart && end && date > rangeStart && date < end);

  return (
    <div className={cn("flex-1", className)}>
      <div className="mb-2 flex h-7 items-center justify-between">
        {nav === "both" || nav === "back" ? (
          <CalendarNav
            label={previousLabel}
            icon="chevron-left"
            onClick={() => onViewChange(shiftMonth(view, -1))}
          />
        ) : (
          <span className="size-7" />
        )}
        <span className="font-sans text-[14px] font-medium capitalize">
          {monthNames[view.month]} {view.year}
        </span>
        {nav === "both" || nav === "forward" ? (
          <CalendarNav
            label={nextLabel}
            icon="chevron-right"
            onClick={() => onViewChange(shiftMonth(view, 1))}
          />
        ) : (
          <span className="size-7" />
        )}
      </div>

      <div
        className="grid grid-cols-7 gap-0.5"
        onMouseLeave={() => onHover?.(null)}
      >
        {weekdayNames.map((day) => (
          <span
            key={day}
            className="py-1 text-center font-sans text-[11px] text-text-secondary"
          >
            {day}
          </span>
        ))}

        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />;

          const isSelected = date === selected || date === rangeStart || date === rangeEnd;
          const isToday = date === today;
          const blocked = !isWithin(date, min, max);
          const banded = inBand(date);

          return (
            <button
              key={date}
              type="button"
              disabled={blocked}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected || undefined}
              onClick={() => onSelect(date)}
              onMouseEnter={() => onHover?.(date)}
              className={cn(
                "size-8 rounded-full border-none font-sans text-[13px] tabular-nums",
                "transition-colors duration-[120ms] ease-out halo-focus",
                "disabled:cursor-not-allowed disabled:opacity-40",
                isSelected
                  ? "bg-ink font-semibold text-accent"
                  : banded
                    ? "bg-mist text-text-primary"
                    : blocked
                      ? "bg-transparent text-text-secondary"
                      : "bg-transparent text-text-primary hover:bg-mist",
                // The ring marks today without competing with the selection.
                isToday && !isSelected && "font-semibold shadow-[inset_0_0_0_1px_var(--color-border-strong)]",
              )}
            >
              {Number(date.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarNav({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: "chevron-left" | "chevron-right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-lg border-none bg-transparent text-text-primary transition-colors duration-[120ms] ease-out hover:bg-mist halo-focus"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
