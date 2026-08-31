import * as React from "react";
import { cn } from "../../lib/cn";
import type { QueryColumn, SortRule } from "../../lib/table-query";
import { Icon } from "../core/icon";
import { Select } from "../forms/select";
import { Drawer } from "../overlay/drawer";

export interface SortPreset {
  label: string;
  rules: SortRule[];
}

export interface SortPanelProps {
  open?: boolean;
  onClose?: () => void;
  inline?: boolean;

  columns: (QueryColumn & { sortable?: boolean })[];
  rules: SortRule[];
  onChange: (rules: SortRule[]) => void;

  nullsLast?: boolean;
  onNullsLastChange?: (nullsLast: boolean) => void;

  presets?: SortPreset[];
  title?: React.ReactNode;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

/**
 * Multi-column sorting.
 *
 * THE ORDER OF THE RULES IS THE SORT, so the list is reorderable and numbered.
 * A panel that lets you pick three columns without saying which wins is not
 * describing a sort — it is describing a set, and the result will surprise
 * whoever built it.
 *
 * A column already used disappears from the picker: sorting by the same column
 * twice is not a thing, and offering it invites a rule that silently does
 * nothing.
 */
export function SortPanel({
  open = true,
  onClose,
  inline = false,
  columns,
  rules,
  onChange,
  nullsLast = true,
  onNullsLastChange,
  presets = [],
  title = "Sort",
  labels,
  className,
}: SortPanelProps) {
  const text = {
    add: "Add a level",
    clear: "Clear",
    presets: "Common sorts",
    empty: "No sort. Rows keep their natural order.",
    asc: "A → Z",
    desc: "Z → A",
    ascNumber: "Low to high",
    descNumber: "High to low",
    ascDate: "Oldest first",
    descDate: "Newest first",
    nullsLast: "Empty values last",
    up: "Move up",
    down: "Move down",
    remove: "Remove this level",
    then: "then by",
    ...labels,
  };

  const sortable = columns.filter((entry) => entry.sortable !== false);
  const used = rules.map((rule) => rule.key);
  const free = sortable.filter((entry) => !used.includes(entry.key));

  const typeOf = (key: string) => sortable.find((entry) => entry.key === key)?.type ?? "text";

  /** Direction wording depends on the type: "A → Z" is meaningless on a date. */
  const directionLabel = (key: string, dir: "asc" | "desc") => {
    const type = typeOf(key);
    if (type === "number") return dir === "asc" ? text.ascNumber : text.descNumber;
    if (type === "date") return dir === "asc" ? text.ascDate : text.descDate;
    return dir === "asc" ? text.asc : text.desc;
  };

  const patch = (index: number, change: Partial<SortRule>) =>
    onChange(rules.map((rule, at) => (at === index ? { ...rule, ...change } : rule)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rules.length) return;

    const next = [...rules];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  const body = (
    <div className={cn("flex flex-col gap-4 font-sans", className)}>
      {presets.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-text-secondary">{text.presets}</span>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(preset.rules)}
                className="inline-flex h-7.5 items-center rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt halo-focus"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {rules.length === 0 ? (
        <span className="rounded-panel border border-dashed border-border-subtle px-3.5 py-4 text-center text-body-s text-text-secondary">
          {text.empty}
        </span>
      ) : null}

      <div className="flex flex-col gap-2">
        {rules.map((rule, index) => (
          <div
            key={`${rule.key}-${index}`}
            className="flex flex-wrap items-center gap-2 rounded-panel border border-border-subtle bg-surface-alt p-2.5"
          >
            {/* Numbered, because the position IS the precedence. */}
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-card text-[11.5px] tabular-nums text-text-secondary">
              {index + 1}
            </span>

            {index > 0 ? (
              <span className="shrink-0 text-[12px] text-text-secondary">{text.then}</span>
            ) : null}

            <span className="min-w-32 flex-1">
              <Select
                bare
                size="sm"
                value={rule.key}
                onChange={(value) => patch(index, { key: value })}
                options={[
                  // The current column plus the unused ones: dropping the
                  // current one would make the picker show the wrong value.
                  ...sortable.filter((entry) => entry.key === rule.key),
                  ...free,
                ].map((entry) => ({ value: entry.key, label: entry.label }))}
              />
            </span>

            <span className="min-w-36 flex-1">
              <Select
                bare
                size="sm"
                value={rule.dir}
                onChange={(value) => patch(index, { dir: value as "asc" | "desc" })}
                options={[
                  { value: "asc", label: directionLabel(rule.key, "asc") },
                  { value: "desc", label: directionLabel(rule.key, "desc") },
                ]}
              />
            </span>

            <span className="inline-flex shrink-0 gap-0.5">
              <button
                type="button"
                aria-label={text.up}
                title={text.up}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="inline-flex size-7 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:bg-surface-card disabled:opacity-30 halo-focus"
              >
                <Icon name="chevron-up" size={13} />
              </button>
              <button
                type="button"
                aria-label={text.down}
                title={text.down}
                disabled={index === rules.length - 1}
                onClick={() => move(index, 1)}
                className="inline-flex size-7 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:bg-surface-card disabled:opacity-30 halo-focus"
              >
                <Icon name="chevron-down" size={13} />
              </button>
              <button
                type="button"
                aria-label={text.remove}
                title={text.remove}
                onClick={() => onChange(rules.filter((_, at) => at !== index))}
                className="inline-flex size-7 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:bg-surface-card hover:text-error halo-focus"
              >
                <Icon name="x" size={13} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!free.length}
          onClick={() => free[0] && onChange([...rules, { key: free[0].key, dir: "asc" }])}
          className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt disabled:opacity-40 halo-focus"
        >
          <Icon name="plus" size={13} />
          {text.add}
        </button>

        {rules.length ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex h-8 items-center rounded-pill border-none bg-transparent px-2.5 font-sans text-[13px] text-text-secondary hover:text-text-primary halo-focus"
          >
            {text.clear}
          </button>
        ) : null}

        <label className="ml-auto inline-flex items-center gap-1.75 text-[12.5px] text-text-primary">
          <input
            type="checkbox"
            checked={nullsLast}
            onChange={(event) => onNullsLastChange?.(event.target.checked)}
            className="accent-text-primary"
          />
          {text.nullsLast}
        </label>
      </div>
    </div>
  );

  if (inline) return body;

  return (
    <Drawer open={open} onClose={onClose} width={480} title={title} icon="arrow-up-down">
      {body}
    </Drawer>
  );
}
