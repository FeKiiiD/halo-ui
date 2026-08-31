import * as React from "react";
import { cn } from "../../lib/cn";
import { useDismissable } from "../../lib/use-dismissable";
import { Icon, type IconName } from "../core/icon";
import { SearchField } from "../forms/search-field";
import type { TableDensity } from "./table-primitives";

export interface ToolbarFilter {
  key: string;
  label: React.ReactNode;
}

export interface ToolbarColumn {
  key: string;
  label: string;
}

export interface TableToolbarProps {
  title?: React.ReactNode;
  count?: number;
  countLabel?: string;

  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** Active filters, as removable chips. */
  filters?: ToolbarFilter[];
  onFilterRemove?: (key: string) => void;
  onFiltersClear?: () => void;

  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;

  columns?: ToolbarColumn[];
  hiddenColumns?: string[];
  onColumnsChange?: (hidden: string[]) => void;

  /** Switches the bar to the selection state. */
  selectedCount?: number;
  bulkActions?: React.ReactNode;
  onSelectionClear?: () => void;

  actions?: React.ReactNode;
  labels?: {
    clearFilters?: string;
    columns?: string;
    density?: string;
    selected?: (count: number) => string;
    clearSelection?: string;
  };
  className?: string;
}

const densityIcons: [TableDensity, IconName][] = [
  ["compact", "rows-3"],
  ["regular", "rows-2"],
  ["comfy", "rows-4"],
];

/**
 * The bar above a table: what this is, how to narrow it, how to change what is
 * shown.
 *
 * WITH A SELECTION IT BECOMES A DIFFERENT BAR. Bulk actions replace the search
 * and the view controls rather than joining them — a toolbar carrying both is
 * how someone deletes forty rows meaning to filter them.
 */
export function TableToolbar({
  title,
  count,
  countLabel = "rows",
  search = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  onFilterRemove,
  onFiltersClear,
  density,
  onDensityChange,
  columns = [],
  hiddenColumns = [],
  onColumnsChange,
  selectedCount = 0,
  bulkActions,
  onSelectionClear,
  actions,
  labels,
  className,
}: TableToolbarProps) {
  const [columnsOpen, setColumnsOpen] = React.useState(false);
  const columnsRoot = useDismissable<HTMLSpanElement>(columnsOpen, () => setColumnsOpen(false));

  const text = {
    clearFilters: "Clear filters",
    columns: "Columns",
    density: "Density",
    selected: (n: number) => `${n} selected`,
    clearSelection: "Clear selection",
    ...labels,
  };

  if (selectedCount > 0) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-panel bg-mist px-3.5 py-2.5 font-sans",
          className,
        )}
        style={{ animation: "halo-row-in 160ms ease-out both" }}
      >
        <span className="text-body-s font-medium tabular-nums text-text-primary">
          {text.selected(selectedCount)}
        </span>

        {onSelectionClear ? (
          <button
            type="button"
            onClick={onSelectionClear}
            className="text-body-s text-text-secondary underline-offset-4 hover:underline halo-focus"
          >
            {text.clearSelection}
          </button>
        ) : null}

        <span className="ml-auto inline-flex items-center gap-2">{bulkActions}</span>
      </div>
    );
  }

  const iconButton = (icon: IconName, label: string, onClick: () => void, on?: boolean) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border text-text-primary halo-focus",
        "transition-[background-color,border-color] duration-[120ms] ease-out",
        on ? "border-border-strong bg-surface-alt" : "border-border-subtle bg-surface-card hover:bg-surface-alt",
      )}
    >
      <Icon name={icon} size={16} />
    </button>
  );

  return (
    <div className={cn("flex flex-col gap-2.5 font-sans", className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        {title ? (
          <span className="mr-auto inline-flex items-baseline gap-2">
            <span className="text-[18px] font-semibold tracking-[-0.01em] text-text-primary">
              {title}
            </span>
            {count !== undefined ? (
              <span className="text-[13px] tabular-nums text-text-secondary">
                {count} {countLabel}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="mr-auto" />
        )}

        {onSearchChange ? (
          <SearchField
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            size="sm"
            className="h-9 w-[240px]"
          />
        ) : null}

        {onDensityChange ? (
          <span className="inline-flex gap-1" role="group" aria-label={text.density}>
            {densityIcons.map(([value, icon]) =>
              iconButton(icon, value, () => onDensityChange(value), density === value),
            )}
          </span>
        ) : null}

        {onColumnsChange && columns.length ? (
          <span ref={columnsRoot} className="relative inline-flex">
            {iconButton("columns-3", text.columns, () => setColumnsOpen((open) => !open), columnsOpen)}

            {columnsOpen ? (
              <div
                className="absolute right-0 top-[calc(100%+6px)] z-60 max-h-72 w-[220px] overflow-y-auto rounded-panel border border-border-subtle bg-surface-card p-1.5 shadow-float"
                style={{ animation: "halo-panel-in 120ms ease-out both" }}
              >
                {columns.map((column) => {
                  const visible = !hiddenColumns.includes(column.key);
                  return (
                    <button
                      key={column.key}
                      type="button"
                      onClick={() =>
                        onColumnsChange(
                          visible
                            ? [...hiddenColumns, column.key]
                            : hiddenColumns.filter((key) => key !== column.key),
                        )
                      }
                      className="flex h-8.5 w-full items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 text-left font-sans text-[13.5px] text-text-primary hover:bg-surface-alt halo-focus"
                    >
                      <Icon
                        name={visible ? "eye" : "eye-off"}
                        size={15}
                        className={visible ? "text-text-primary" : "text-text-secondary"}
                      />
                      <span className={cn("truncate", !visible && "text-text-secondary")}>
                        {column.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </span>
        ) : null}

        {actions ? <span className="inline-flex items-center gap-2">{actions}</span> : null}
      </div>

      {filters.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((filter) => (
            <span
              key={filter.key}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-pill border border-border-subtle bg-surface-alt",
                "text-[13px] font-medium text-text-primary",
                onFilterRemove ? "py-0 pl-2.5 pr-1" : "px-2.5",
              )}
            >
              {filter.label}
              {onFilterRemove ? (
                <button
                  type="button"
                  aria-label={`Remove filter`}
                  onClick={() => onFilterRemove(filter.key)}
                  className="inline-flex cursor-pointer border-none bg-transparent p-0.75 text-text-secondary hover:text-text-primary"
                >
                  <Icon name="x" size={12} />
                </button>
              ) : null}
            </span>
          ))}

          {onFiltersClear && filters.length > 1 ? (
            <button
              type="button"
              onClick={onFiltersClear}
              className="ml-1 text-[13px] text-text-secondary underline-offset-4 hover:underline halo-focus"
            >
              {text.clearFilters}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
