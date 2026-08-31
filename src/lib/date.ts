/**
 * Date helpers for the picker components.
 *
 * THE VALUE FORMAT IS "YYYY-MM-DD", always. A `Date` carries a time and a time
 * zone that a calendar date does not have, and the two disagree the moment a
 * user west of UTC picks a day: `new Date("2026-03-05").toISOString()` can come
 * back as the 4th. Every value crossing a component boundary is a plain string;
 * `Date` exists only inside the arithmetic below, constructed at local noon
 * where a day boundary cannot be crossed by a rounding error.
 */

export type IsoDate = string;

/** Formats a Date as YYYY-MM-DD in the LOCAL calendar, not UTC. */
export function toIso(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses YYYY-MM-DD into a local Date at noon, or null if malformed. */
export function fromIso(value: string | undefined | null): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  // Noon, so a DST shift in either direction cannot move the date.
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Today, as an ISO date in the local calendar. */
export function todayIso(): IsoDate {
  return toIso(new Date());
}

/** ISO dates sort correctly as strings, which is the point of the format. */
export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return a < b;
}

export function isWithin(value: IsoDate, min?: IsoDate, max?: IsoDate): boolean {
  if (min && value < min) return false;
  if (max && value > max) return false;
  return true;
}

/** Adds days, months or years, clamping the day to the target month's length. */
export function addToIso(
  value: IsoDate,
  amount: number,
  unit: "day" | "month" | "year",
): IsoDate {
  const date = fromIso(value);
  if (!date) return value;

  if (unit === "day") {
    date.setDate(date.getDate() + amount);
    return toIso(date);
  }

  // setMonth on the 31st of a 30-day target rolls into the next month; pinning
  // to the 1st first and clamping afterwards is what avoids that.
  const day = date.getDate();
  date.setDate(1);
  if (unit === "month") date.setMonth(date.getMonth() + amount);
  else date.setFullYear(date.getFullYear() + amount);

  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toIso(date);
}

export interface MonthView {
  year: number;
  /** 0-indexed, as `Date` uses. */
  month: number;
}

export function monthOf(value: IsoDate | undefined): MonthView {
  const date = fromIso(value) ?? new Date();
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function shiftMonth(view: MonthView, amount: number): MonthView {
  const date = new Date(view.year, view.month + amount, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/**
 * The cells of a month grid: leading blanks for the offset, then each day.
 *
 * `weekStartsOn` defaults to Monday, the European convention. Sunday-first
 * locales pass 0.
 */
export function monthGrid(view: MonthView, weekStartsOn: 0 | 1 = 1): (IsoDate | null)[] {
  const first = new Date(view.year, view.month, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const days = new Date(view.year, view.month + 1, 0).getDate();

  return [
    ...Array.from<null>({ length: offset }).fill(null),
    ...Array.from({ length: days }, (_, index) => toIso(new Date(view.year, view.month, index + 1))),
  ];
}

/* -------------------------------------------------------------------------
 * Display formatting
 *
 * Defaults are French — DD/MM/YYYY, lowercase month names — matching the
 * system this was ported from. Every picker takes overrides.
 * ---------------------------------------------------------------------- */

export const frenchMonths = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Two letters, starting Monday. */
export const frenchWeekdays = ["lu", "ma", "me", "je", "ve", "sa", "di"];

export const englishMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const englishWeekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** "2026-03-05" → "05/03/2026". Empty string for anything unparseable. */
export function formatIsoDate(value: string | undefined | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** "05/03/2026" → "2026-03-05". Null if it is not a real date. */
export function parseTypedDate(input: string): IsoDate | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);

  // Rejects 31/02: the Date constructor rolls it into March rather than
  // failing, so the round-trip has to be checked.
  if (date.getDate() !== Number(day) || date.getMonth() !== Number(month) - 1) return null;
  return toIso(date);
}

/* -------------------------------------------------------------------------
 * Time
 * ---------------------------------------------------------------------- */

const pad = (value: number) => String(value).padStart(2, "0");

/** Builds "HH:MM" slots between two bounds. */
export function timeSlots(min: string, max: string, step: number): string[] {
  const [minHour = 0, minMinute = 0] = min.split(":").map(Number);
  const [maxHour = 23, maxMinute = 45] = max.split(":").map(Number);

  const slots: string[] = [];
  for (
    let minutes = minHour * 60 + minMinute;
    minutes <= maxHour * 60 + maxMinute;
    minutes += step
  ) {
    slots.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return slots;
}

/**
 * Parses loosely typed time into "HH:MM".
 *
 * Accepts "9", "9h", "9h30", "9:30", "9.30", "0930" — people type times in
 * every one of these ways, and rejecting the input outright loses what they
 * meant when it is perfectly clear.
 */
export function parseTypedTime(input: string): string | null {
  const cleaned = input.trim().toLowerCase();

  const match = /^(\d{1,2})\s*[h:.]?\s*(\d{0,2})$/.exec(cleaned);
  if (!match) return null;

  const [, rawHour, rawMinute] = match;
  const hour = Number(rawHour);
  const minute = rawMinute ? Number(rawMinute) : 0;

  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}
