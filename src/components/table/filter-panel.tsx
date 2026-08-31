import * as React from "react";
import { cn } from "../../lib/cn";
import {
  VALUELESS_OPS,
  describeRule,
  isRuleLive,
  opsFor,
  type FilterOp,
  type FilterRule,
  type MatchMode,
  type QueryColumn,
} from "../../lib/table-query";
import { Icon } from "../core/icon";
import { Select } from "../forms/select";
import { Drawer } from "../overlay/drawer";

export interface FilterPanelProps {
  open?: boolean;
  onClose?: () => void;

  columns: QueryColumn[];
  rules: FilterRule[];
  onChange: (rules: FilterRule[]) => void;

  match?: MatchMode;
  onMatchChange?: (match: MatchMode) => void;

  /** How many rows the current rules would leave. Shown live in the footer. */
  resultCount?: number;
  totalCount?: number;

  /** Renders in place instead of in a drawer. */
  inline?: boolean;
  title?: React.ReactNode;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

let counter = 0;
const ruleId = () => `r${(counter += 1).toString(36)}`;

/**
 * The filter builder.
 *
 * RULES APPLY AS THEY ARE TYPED, and the footer says how many rows survive.
 * A filter panel with an Apply button makes people build a rule blind and
 * then discover it matched nothing — the count is the feedback that lets them
 * correct it while they still remember what they meant.
 *
 * An incomplete rule is simply inert rather than matching nothing, so the
 * table does not empty itself the moment a field is focused.
 */
export function FilterPanel({
  open = true,
  onClose,
  columns,
  rules,
  onChange,
  match = "all",
  onMatchChange,
  resultCount,
  totalCount,
  inline = false,
  title = "Filters",
  labels,
  className,
}: FilterPanelProps) {
  const text = {
    add: "Add a filter",
    clear: "Clear all",
    all: "match every rule",
    any: "match any rule",
    where: "Show rows that",
    and: "and",
    empty: "No filter yet. Every row is shown.",
    close: "Done",
    remove: "Remove this rule",
    min: "min",
    max: "max",
    value: "Value",
    ...labels,
  };

  const columnFor = (key: string) => columns.find((entry) => entry.key === key);

  const patch = (index: number, change: Partial<FilterRule>) =>
    onChange(rules.map((rule, at) => (at === index ? { ...rule, ...change } : rule)));

  const add = () => {
    const first = columns[0];
    if (!first) return;
    onChange([
      ...rules,
      { id: ruleId(), key: first.key, op: opsFor(first.type)[0]![0], value: "" },
    ]);
  };

  const remove = (index: number) => onChange(rules.filter((_, at) => at !== index));

  /** Changing the column has to reset the operator: they are type-specific. */
  const setColumn = (index: number, key: string) => {
    const column = columnFor(key);
    patch(index, { key, op: opsFor(column?.type)[0]![0], value: "" });
  };

  /** Changing the operator resets the value: a pair and a scalar are not
   *  interchangeable, and a stale array reads as garbage in a text field. */
  const setOp = (index: number, op: FilterOp) =>
    patch(index, { op, value: op === "between" ? ["", ""] : "" });

  const live = rules.filter(isRuleLive).length;

  const body = (
    <div className={cn("flex flex-col gap-3 font-sans", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-text-secondary">{text.where}</span>
        <span className="inline-flex gap-0.5 rounded-pill bg-mist p-0.75">
          {(["all", "any"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => onMatchChange?.(entry)}
              aria-pressed={match === entry}
              className={cn(
                "h-6.5 rounded-pill border-none px-2.75 font-sans text-[12.5px] halo-focus",
                "transition-colors duration-[140ms] ease-standard",
                match === entry
                  ? "bg-surface-card font-medium text-text-primary"
                  : "bg-transparent text-text-secondary",
              )}
            >
              {entry === "all" ? text.all : text.any}
            </button>
          ))}
        </span>
      </div>

      {rules.length === 0 ? (
        <span className="rounded-panel border border-dashed border-border-subtle px-3.5 py-4 text-center text-body-s text-text-secondary">
          {text.empty}
        </span>
      ) : null}

      <div className="flex flex-col gap-2">
        {rules.map((rule, index) => {
          const column = columnFor(rule.key);
          const type = column?.type ?? "text";
          const needsValue = !VALUELESS_OPS.includes(rule.op);

          return (
            <div
              key={rule.id ?? index}
              className="flex flex-wrap items-center gap-2 rounded-panel border border-border-subtle bg-surface-alt p-2.5"
            >
              {/* The connector, so a stack of rules reads as a sentence
                  rather than as a list of unrelated fields. */}
              {index > 0 ? (
                <span className="w-9 shrink-0 text-[12px] text-text-secondary">
                  {match === "all" ? text.and : "or"}
                </span>
              ) : (
                <span className="w-9 shrink-0" />
              )}

              <span className="min-w-32 flex-1">
                <Select
                  bare
                  size="sm"
                  value={rule.key}
                  onChange={(value) => setColumn(index, value)}
                  options={columns.map((entry) => ({ value: entry.key, label: entry.label }))}
                />
              </span>

              <span className="min-w-32 flex-1">
                <Select
                  bare
                  size="sm"
                  value={rule.op}
                  onChange={(value) => setOp(index, value as FilterOp)}
                  options={opsFor(type).map(([value, label]) => ({ value, label }))}
                />
              </span>

              <button
                type="button"
                aria-label={text.remove}
                title={text.remove}
                onClick={() => remove(index)}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:bg-surface-card hover:text-error halo-focus"
              >
                <Icon name="x" size={13} />
              </button>

              {needsValue ? (
                <span className="flex w-full items-center gap-1.5 pl-9">
                  <RuleValue
                    column={column}
                    rule={rule}
                    labels={text}
                    onChange={(value) => patch(index, { value })}
                  />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt halo-focus"
        >
          <Icon name="plus" size={13} />
          {text.add}
        </button>

        {rules.length ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex h-8 items-center gap-1.5 rounded-pill border-none bg-transparent px-2.5 font-sans text-[13px] text-text-secondary hover:text-text-primary halo-focus"
          >
            {text.clear}
          </button>
        ) : null}

        {resultCount != null ? (
          <span className="ml-auto text-[12.5px] tabular-nums text-text-secondary">
            {resultCount}
            {totalCount != null ? ` / ${totalCount}` : ""} rows
            {live ? ` · ${live} active` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (inline) return body;

  return (
    <Drawer open={open} onClose={onClose} width={520} title={title} icon="funnel">
      {body}
    </Drawer>
  );
}

/** The value editor, which depends entirely on the column type. */
function RuleValue({
  column,
  rule,
  labels,
  onChange,
}: {
  column?: QueryColumn;
  rule: FilterRule;
  labels: Record<string, string>;
  onChange: (value: FilterRule["value"]) => void;
}) {
  const type = column?.type ?? "text";
  const values = Array.isArray(rule.value) ? rule.value : [rule.value ?? ""];

  const field =
    "h-8.5 min-w-0 rounded-[10px] border border-border-subtle bg-surface-card px-2.5 font-sans text-[13.5px] text-text-primary outline-none focus:border-border-strong placeholder:text-text-secondary";

  if (type === "enum") {
    const picked = Array.isArray(rule.value)
      ? rule.value.map(String)
      : rule.value
        ? [String(rule.value)]
        : [];

    return (
      <span className="flex flex-1 flex-wrap gap-1.25">
        {(column?.options ?? []).map((option) => {
          const on = picked.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(on ? picked.filter((entry) => entry !== option) : [...picked, option])
              }
              className={cn(
                "h-7.5 rounded-pill border px-2.75 font-sans text-[13px] halo-focus",
                "transition-colors duration-[140ms] ease-standard",
                on
                  ? "border-accent-deep bg-accent font-medium text-accent-ink"
                  : "border-border-subtle bg-transparent text-text-primary hover:bg-surface-card",
              )}
            >
              {option}
            </button>
          );
        })}
      </span>
    );
  }

  if (rule.op === "between") {
    const put = (at: number, next: string) => {
      const pair = [String(values[0] ?? ""), String(values[1] ?? "")];
      pair[at] = next;
      onChange(pair);
    };

    return (
      <>
        <input
          value={String(values[0] ?? "")}
          type={type === "date" ? "date" : "text"}
          inputMode={type === "number" ? "decimal" : undefined}
          placeholder={labels.min}
          aria-label={labels.min}
          onChange={(event) => put(0, event.target.value)}
          className={cn(field, "flex-1")}
        />
        <span className="shrink-0 text-[13px] text-text-secondary">{labels.and}</span>
        <input
          value={String(values[1] ?? "")}
          type={type === "date" ? "date" : "text"}
          inputMode={type === "number" ? "decimal" : undefined}
          placeholder={labels.max}
          aria-label={labels.max}
          onChange={(event) => put(1, event.target.value)}
          className={cn(field, "flex-1")}
        />
      </>
    );
  }

  return (
    <input
      value={String(values[0] ?? "")}
      // A native date input for a date column: it produces ISO, which is what
      // the filter parses, and it saves everyone a format to remember.
      type={type === "date" && rule.op !== "last_days" ? "date" : "text"}
      inputMode={type === "number" || rule.op === "last_days" ? "numeric" : undefined}
      placeholder={rule.op === "last_days" ? "30" : type === "number" ? "0" : labels.value}
      aria-label={labels.value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(field, "flex-1")}
    />
  );
}

export { describeRule };
