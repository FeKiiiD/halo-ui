/**
 * Filtering, sorting and saved-view logic for a data table.
 *
 * Pure, and kept out of the components because it is the part that decides
 * what a person actually sees. A filter that silently drops the wrong rows
 * looks exactly like a filter that works — the table is shorter either way.
 */

export type ColumnKind = "text" | "number" | "date" | "enum" | "boolean";

export interface QueryColumn {
  key: string;
  label: string;
  type?: ColumnKind;
  /** Choices for an enum column. */
  options?: string[];
}

export type FilterOp =
  | "contains"
  | "not_contains"
  | "is"
  | "starts"
  | "empty"
  | "filled"
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "between"
  | "after"
  | "before"
  | "last_days"
  | "in"
  | "not_in"
  | "true"
  | "false";

export interface FilterRule {
  id?: string;
  key: string;
  op: FilterOp;
  /** A single value, or a pair for `between`, or a list for `in`. */
  value?: string | number | (string | number)[];
}

export type MatchMode = "all" | "any";

export interface SortRule {
  key: string;
  dir: "asc" | "desc";
}

/** Operators available per column type, in the order they are usually wanted. */
export const FILTER_OPS: Record<ColumnKind, [FilterOp, string][]> = {
  text: [
    ["contains", "contains"],
    ["not_contains", "does not contain"],
    ["is", "is exactly"],
    ["starts", "starts with"],
    ["empty", "is empty"],
    ["filled", "is set"],
  ],
  number: [
    ["eq", "equals"],
    ["neq", "does not equal"],
    ["gt", "greater than"],
    ["lt", "less than"],
    ["between", "between"],
    ["empty", "is empty"],
  ],
  date: [
    ["after", "after"],
    ["before", "before"],
    ["between", "between"],
    ["last_days", "in the last"],
    ["empty", "is empty"],
  ],
  enum: [
    ["in", "is one of"],
    ["not_in", "is not one of"],
    ["empty", "is empty"],
  ],
  boolean: [
    ["true", "is true"],
    ["false", "is false"],
  ],
};

/** Operators that need no value at all. */
export const VALUELESS_OPS: FilterOp[] = ["empty", "filled", "true", "false"];

export const opsFor = (type?: ColumnKind) => FILTER_OPS[type ?? "text"] ?? FILTER_OPS.text;

export const opLabel = (type: ColumnKind | undefined, op: FilterOp) =>
  opsFor(type).find(([value]) => value === op)?.[1] ?? op;

/**
 * A date as a sortable YYYYMMDD string.
 *
 * ACCEPTS BOTH ISO AND DD/MM/YYYY. The source matched only the slashed form,
 * so an ISO date — which is what an API returns, and what a date input
 * produces — fell through to a raw string comparison. "2026-08-31" against
 * "31/08/2026" compares character by character and every date filter on real
 * data returned the wrong rows, quietly.
 */
export function dateKey(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";

  // ISO first: it is the interchange format, so it is the common case.
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;

  const slashed = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slashed) return `${slashed[3]}${slashed[2]}${slashed[1]}`;

  // Anything else: let Date have a go before giving up on ordering.
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return (
      String(parsed.getFullYear()) +
      String(parsed.getMonth() + 1).padStart(2, "0") +
      String(parsed.getDate()).padStart(2, "0")
    );
  }
  return text;
}

/**
 * A number from a formatted cell.
 *
 * Strips currency and spaces, and accepts a comma as the decimal mark — a
 * table shows "1 208,50 €" and the filter has to compare against 1208.5, not
 * against zero.
 */
export function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = String(value ?? "")
    .replace(/[^\d.,-]/g, "")
    // A comma is the decimal mark; a dot in the same string is then a
    // thousands separator, so it goes.
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const isEmpty = (value: unknown) => value == null || value === "";

const valuesOf = (rule: FilterRule) =>
  Array.isArray(rule.value) ? rule.value : [rule.value];

/** True when a rule is complete enough to change the result. */
export function isRuleLive(rule: FilterRule): boolean {
  if (!rule.key || !rule.op) return false;
  if (VALUELESS_OPS.includes(rule.op)) return true;

  return valuesOf(rule).some((value) => value !== "" && value != null);
}

/** "Status is one of active, loyal" — the chip text for a rule. */
export function describeRule(rule: FilterRule, columns: QueryColumn[] = []): string {
  const column = columns.find((entry) => entry.key === rule.key);
  const type = column?.type ?? "text";

  const shown = Array.isArray(rule.value)
    ? rule.value
        .filter((value) => value !== "" && value != null)
        .join(rule.op === "between" ? " → " : ", ")
    : rule.value;

  const tail = VALUELESS_OPS.includes(rule.op)
    ? ""
    : ` ${shown || "…"}${rule.op === "last_days" ? " days" : ""}`;

  return `${column?.label ?? rule.key} ${opLabel(type, rule.op)}${tail}`;
}

/** Tests one row against one rule. */
function testRule(row: Record<string, unknown>, rule: FilterRule, columns: QueryColumn[]): boolean {
  const column = columns.find((entry) => entry.key === rule.key);
  const type = column?.type ?? "text";

  const raw = row[rule.key];
  const text = String(raw ?? "").toLowerCase();
  const values = valuesOf(rule);
  const first = String(values[0] ?? "").toLowerCase();

  switch (rule.op) {
    case "empty":
      return isEmpty(raw);
    case "filled":
      return !isEmpty(raw);
    case "true":
      return Boolean(raw);
    case "false":
      return !raw;
  }

  /**
   * An empty cell answers no comparison.
   *
   * Without this, an empty number parses to 0 and matches "less than 100";
   * an empty date parses to "" and matches "before" every date there is. The
   * rows with no value are exactly the ones a person is not asking about, and
   * they arrive silently in the middle of the answer. `empty` and `filled`
   * are handled above — they are the operators that DO ask about absence.
   */
  if (isEmpty(raw)) return false;

  switch (rule.op) {

    case "contains":
      return text.includes(first);
    case "not_contains":
      return !text.includes(first);
    case "is":
      return text === first;
    case "starts":
      return text.startsWith(first);

    case "in":
      return values.map((value) => String(value).toLowerCase()).includes(text);
    case "not_in":
      return !values.map((value) => String(value).toLowerCase()).includes(text);

    case "eq":
      return numberValue(raw) === numberValue(values[0]);
    case "neq":
      return numberValue(raw) !== numberValue(values[0]);
    case "gt":
      return numberValue(raw) > numberValue(values[0]);
    case "lt":
      return numberValue(raw) < numberValue(values[0]);

    case "between": {
      if (type === "date") {
        const day = dateKey(raw);
        const from = dateKey(values[0]);
        const to = dateKey(values[1] ?? values[0]);
        // Tolerate the bounds being given the wrong way round: somebody
        // picking two dates does not mean "no rows".
        return day >= (from <= to ? from : to) && day <= (from <= to ? to : from);
      }
      const value = numberValue(raw);
      const from = numberValue(values[0]);
      const to = numberValue(values[1] ?? values[0]);
      return value >= Math.min(from, to) && value <= Math.max(from, to);
    }

    case "after":
      return dateKey(raw) > dateKey(values[0]);
    case "before":
      return dateKey(raw) < dateKey(values[0]);

    case "last_days": {
      const days = numberValue(values[0]);
      const since = new Date();
      since.setDate(since.getDate() - days);
      return dateKey(raw) >= dateKey(since.toISOString());
    }

    default:
      return true;
  }
}

/**
 * Filters rows against the rules.
 *
 * INCOMPLETE RULES ARE IGNORED, not treated as matching nothing. A half-typed
 * rule is the normal state of a filter panel someone is still using, and a
 * table that empties itself the moment a field is focused is unusable.
 */
export function applyFilterRules<T extends Record<string, unknown>>(
  rows: T[],
  rules: FilterRule[] = [],
  columns: QueryColumn[] = [],
  match: MatchMode = "all",
): T[] {
  const live = rules.filter(isRuleLive);
  if (!live.length) return rows;

  return rows.filter((row) =>
    match === "any"
      ? live.some((rule) => testRule(row, rule, columns))
      : live.every((rule) => testRule(row, rule, columns)),
  );
}

/**
 * Sorts rows by the rules, first rule first.
 *
 * Empty cells go last by default in both directions. Sorting them to the top
 * on a descending sort is technically consistent and practically useless: the
 * point of sorting descending is to see the largest values, not the missing
 * ones.
 */
export function applySortRules<T extends Record<string, unknown>>(
  rows: T[],
  rules: SortRule[] = [],
  columns: QueryColumn[] = [],
  nullsLast = true,
): T[] {
  if (!rules.length) return rows;

  const typeOf = (key: string) =>
    columns.find((entry) => entry.key === key)?.type ?? "text";

  // A copy: sorting the caller's array in place would mutate props.
  return [...rows].sort((a, b) => {
    for (const rule of rules) {
      const direction = rule.dir === "asc" ? 1 : -1;
      const left = a[rule.key];
      const right = b[rule.key];

      if (isEmpty(left) !== isEmpty(right)) {
        // Not multiplied by direction: empties stay put whichever way the
        // column is sorted.
        return nullsLast ? (isEmpty(left) ? 1 : -1) : isEmpty(left) ? -1 : 1;
      }
      if (isEmpty(left)) continue;

      const type = typeOf(rule.key);
      let delta = 0;

      if (type === "number") {
        delta = numberValue(left) - numberValue(right);
      } else if (type === "date") {
        delta = dateKey(left).localeCompare(dateKey(right));
      } else {
        // numeric: true so "item 2" sorts before "item 10".
        delta = String(left).localeCompare(String(right), undefined, { numeric: true });
      }

      if (delta) return delta * direction;
    }
    return 0;
  });
}

export interface ViewConfig {
  hidden?: string[];
  filters?: FilterRule[];
  match?: MatchMode;
  sort?: SortRule | SortRule[];
  density?: "compact" | "regular" | "comfortable";
  [key: string]: unknown;
}

export interface SavedView {
  id: string;
  name: string;
  config: ViewConfig;
  /** Marks a view that ships with the product and cannot be deleted. */
  builtin?: boolean;
}

/**
 * Normalises a config so two equivalent ones compare equal.
 *
 * Key order and rule ids vary without meaning anything, so a naive JSON
 * comparison marks a view dirty the moment a rule is rebuilt — and a "unsaved
 * changes" badge that is always on is one nobody reads.
 */
export function normaliseView(config: ViewConfig = {}): string {
  const sort = config.sort
    ? (Array.isArray(config.sort) ? config.sort : [config.sort]).map(
        (rule) => `${rule.key}:${rule.dir}`,
      )
    : [];

  const filters = (config.filters ?? []).filter(isRuleLive).map((rule) => {
    const values = valuesOf(rule)
      .filter((value) => value !== "" && value != null)
      .map(String);
    return `${rule.key}|${rule.op}|${values.join(",")}`;
  });

  return JSON.stringify({
    hidden: [...(config.hidden ?? [])].sort(),
    match: config.match ?? "all",
    density: config.density ?? "regular",
    // Filters keep their order: "any" of A then B reads differently from B
    // then A even though it matches the same rows.
    filters,
    sort,
  });
}

export const isViewDirty = (view: SavedView | null | undefined, config: ViewConfig): boolean =>
  Boolean(view) && normaliseView(view!.config) !== normaliseView(config);

/** One line describing what a view holds. */
export function describeView(config: ViewConfig = {}, columns: QueryColumn[] = []): string {
  const bits: string[] = [];

  const hidden = config.hidden?.length ?? 0;
  if (hidden) bits.push(`${hidden} column${hidden === 1 ? "" : "s"} hidden`);

  const filters = (config.filters ?? []).filter(isRuleLive).length;
  if (filters) bits.push(`${filters} filter${filters === 1 ? "" : "s"}`);

  const sorts = config.sort ? (Array.isArray(config.sort) ? config.sort : [config.sort]) : [];
  for (const rule of sorts) {
    const column = columns.find((entry) => entry.key === rule.key);
    bits.push(`sorted by ${column?.label ?? rule.key} ${rule.dir === "asc" ? "↑" : "↓"}`);
  }

  if (config.density && config.density !== "regular") bits.push(`${config.density} density`);

  return bits.length ? bits.join(" · ") : "All columns, no filter";
}

/** Groups rows into board columns by a field's value. */
export function groupRows<T extends Record<string, unknown>>(
  rows: T[],
  key: string,
  groups: { id: string; label: string }[],
): { id: string; label: string; rows: T[] }[] {
  return groups.map((group) => ({
    ...group,
    rows: rows.filter((row) => String(row[key] ?? "") === group.id),
  }));
}
