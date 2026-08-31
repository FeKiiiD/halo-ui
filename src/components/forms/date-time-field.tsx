import * as React from "react";
import { cn } from "../../lib/cn";
import type { IsoDate } from "../../lib/date";
import { Icon } from "../core/icon";
import { DatePicker } from "./date-picker";
import { TimePicker } from "./time-picker";
import type { FieldSize } from "./field-chrome";

export interface DateTimeFieldProps {
  label?: React.ReactNode;
  timeLabel?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  help?: React.ReactNode;

  date?: IsoDate;
  time?: string;
  onDateChange?: (value: IsoDate) => void;
  onTimeChange?: (value: string) => void;

  min?: IsoDate;
  max?: IsoDate;
  step?: number;

  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * A date and a time side by side, sharing one error line.
 *
 * The two halves stay separate values rather than one timestamp: they are
 * entered separately, validated separately, and a date without a time is a
 * legitimate half-filled state. Combining them is the caller's job at
 * submission.
 *
 * The date takes more width than the time because DD/MM/YYYY simply needs it.
 */
export function DateTimeField({
  label = "Date and time",
  timeLabel = "Time",
  hint,
  error,
  help,
  date,
  time,
  onDateChange,
  onTimeChange,
  min,
  max,
  step = 15,
  size = "md",
  disabled = false,
  required = false,
  className,
}: DateTimeFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 font-sans", className)}>
      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-2.5">
        <DatePicker
          label={label}
          hint={hint}
          value={date}
          onChange={onDateChange}
          min={min}
          max={max}
          size={size}
          disabled={disabled}
          required={required}
          // The tone has to reach both halves, but the text belongs to the
          // shared line below — a space marks the field without duplicating it.
          error={error ? " " : undefined}
        />
        <TimePicker
          label={timeLabel}
          value={time}
          onChange={onTimeChange}
          step={step}
          size={size}
          disabled={disabled}
          error={error ? " " : undefined}
        />
      </div>

      {error ? (
        <span role="alert" className="inline-flex items-center gap-1.5 text-body-s text-error">
          <Icon name="circle-alert" size={14} />
          {error}
        </span>
      ) : null}

      {help ? <span className="text-body-s text-text-secondary">{help}</span> : null}
    </div>
  );
}
