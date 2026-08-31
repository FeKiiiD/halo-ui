import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";
import { DataCell, type CellType, type ColumnMeta } from "./data-cell";
import {
  MenuRow,
  Popover,
  SkeletonCell,
  TableCheckbox,
  densities,
  useMenuDismiss,
  type MenuAction,
  type TableDensity,
} from "./table-primitives";

export interface Column extends ColumnMeta {
  key: string;
  label?: string;
  type?: CellType;
  width?: number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  editable?: boolean;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export type Row = Record<string, unknown>;

export interface DataTableProps<T extends Row = Row> {
  columns: Column[];
  rows: T[];
  /** Which field identifies a row. */
  rowKey?: string;

  selectable?: boolean;
  selected?: unknown[];
  onSelectedChange?: (selected: unknown[]) => void;

  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  onColumnHide?: (key: string) => void;

  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: React.ReactNode;

  density?: TableDensity;
  stickyHeader?: boolean;
  maxHeight?: number | string;
  zebra?: boolean;

  onRowClick?: (row: T) => void;
  rowActions?: MenuAction<T>[];
  /** Enables single-cell editing. */
  onCellEdit?: (rowKey: unknown, columnKey: string, value: unknown) => void;

  footer?: React.ReactNode;
  labels?: {
    selectAll?: string;
    selectRow?: string;
    actions?: string;
    sortAscending?: string;
    sortDescending?: string;
    clearSort?: string;
    hideColumn?: string;
    columnOptions?: (label: string) => string;
  };
  className?: string;
}

/**
 * The back-office table.
 *
 * HAIRLINE ROW SEPARATORS ONLY — no zebra by default, no vertical rules. The
 * eye tracks a row perfectly well along a single hairline, and grid lines turn
 * a table into a spreadsheet. `zebra` exists for the rare dense report where it
 * genuinely helps.
 *
 * The header is sticky and sits on the alt surface, so it stays legible over
 * scrolled content without needing a shadow.
 */
export function DataTable<T extends Row = Row>({
  columns,
  rows,
  rowKey = "id",
  selectable = false,
  selected = [],
  onSelectedChange,
  sort,
  onSortChange,
  onColumnHide,
  loading = false,
  skeletonRows = 5,
  emptyTitle = "No rows",
  emptyHint,
  emptyAction,
  density = "regular",
  stickyHeader = true,
  maxHeight,
  zebra = false,
  onRowClick,
  rowActions,
  onCellEdit,
  footer,
  labels,
  className,
}: DataTableProps<T>) {
  const g = densities[density];
  const [editing, setEditing] = React.useState<{ row: unknown; column: string } | null>(null);

  const text = {
    selectAll: "Select all",
    selectRow: "Select row",
    actions: "Actions",
    sortAscending: "Sort ascending",
    sortDescending: "Sort descending",
    clearSort: "Clear sort",
    hideColumn: "Hide column",
    columnOptions: (label: string) => `Options for ${label}`,
    ...labels,
  };

  const keyOf = (row: T) => row[rowKey];

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const someSelected = selected.length > 0 && !allSelected;

  const toggleAll = () => onSelectedChange?.(allSelected ? [] : rows.map(keyOf));
  const toggleOne = (key: unknown) =>
    onSelectedChange?.(
      selected.includes(key) ? selected.filter((value) => value !== key) : [...selected, key],
    );

  // Clicking a sorted column cycles its direction rather than resetting to
  // ascending — the second click on a column is almost always "the other way".
  const nextDirection = (key: string): "asc" | "desc" =>
    sort?.key === key && sort.dir === "asc" ? "desc" : "asc";

  const allColumns: Column[] = [
    ...(selectable ? [{ key: "__select", width: 44, align: "center" as const }] : []),
    ...columns,
    ...(rowActions ? [{ key: "__actions", width: 52, align: "right" as const }] : []),
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-panel border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      <div style={{ maxHeight, overflow: maxHeight ? "auto" : "visible" }}>
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {allColumns.map((column) => {
                const sorted = sort?.key === column.key;
                const sortable = column.sortable && !loading;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
                    }
                    onClick={() =>
                      sortable && onSortChange?.({ key: column.key, dir: nextDirection(column.key) })
                    }
                    className={cn(
                      "select-none whitespace-nowrap border-b border-border-subtle bg-surface-alt",
                      "text-[12px] font-medium tracking-[0.01em] text-text-secondary",
                      stickyHeader && "sticky top-0 z-3",
                      sortable ? "cursor-pointer" : "cursor-default",
                    )}
                    style={{
                      height: g.head,
                      padding: g.padding,
                      width: column.width,
                      textAlign: column.align ?? "left",
                    }}
                  >
                    {column.key === "__select" ? (
                      <TableCheckbox
                        state={allSelected ? true : someSelected ? "mixed" : false}
                        onChange={toggleAll}
                        disabled={loading || !rows.length}
                        label={text.selectAll}
                      />
                    ) : column.key === "__actions" ? null : (
                      <span className="inline-flex items-center gap-1.25">
                        {column.label}

                        {column.sortable ? (
                          <span
                            className={cn(
                              "inline-flex",
                              sorted ? "text-text-primary opacity-100" : "text-text-secondary opacity-45",
                            )}
                          >
                            <Icon
                              name={
                                sorted
                                  ? sort.dir === "asc"
                                    ? "arrow-up"
                                    : "arrow-down"
                                  : "chevrons-up-down"
                              }
                              size={13}
                            />
                          </span>
                        ) : null}

                        {(column.sortable && onSortChange) || onColumnHide ? (
                          <HeadMenu
                            column={column}
                            sort={sort}
                            onSortChange={column.sortable ? onSortChange : undefined}
                            onHide={onColumnHide}
                            text={text}
                          />
                        ) : null}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={`skeleton-${index}`}>
                    {allColumns.map((column) => (
                      <td
                        key={column.key}
                        className="border-b border-border-subtle"
                        style={{ height: g.row, padding: g.padding }}
                      >
                        {column.key.startsWith("__") ? null : (
                          // Varying widths, so the placeholder reads as content
                          // rather than as a grid of identical bars.
                          <SkeletonCell width={`${52 + ((index * 13) % 34)}%`} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, rowIndex) => {
                  const key = keyOf(row);
                  const isSelected = selected.includes(key);

                  return (
                    <tr
                      key={String(key)}
                      onClick={() => onRowClick?.(row)}
                      className={cn(
                        "transition-colors duration-[120ms] ease-out",
                        onRowClick && "cursor-pointer",
                        isSelected ? "bg-mist" : zebra && rowIndex % 2 ? "bg-surface-alt" : "bg-transparent",
                        "hover:bg-surface-alt",
                      )}
                      style={{ animation: "halo-row-in 180ms ease-out both" }}
                    >
                      {allColumns.map((column) => {
                        if (column.key === "__select") {
                          return (
                            <td
                              key={column.key}
                              className="border-b border-border-subtle text-center"
                              style={{ height: g.row, padding: g.padding }}
                            >
                              <TableCheckbox
                                state={isSelected}
                                onChange={() => toggleOne(key)}
                                label={text.selectRow}
                              />
                            </td>
                          );
                        }

                        if (column.key === "__actions") {
                          return (
                            <td
                              key={column.key}
                              className="border-b border-border-subtle text-right"
                              style={{ height: g.row, padding: g.padding }}
                            >
                              <RowMenu actions={rowActions ?? []} row={row} label={text.actions} />
                            </td>
                          );
                        }

                        const isEditing =
                          editing !== null && editing.row === key && editing.column === column.key;

                        return (
                          <td
                            key={column.key}
                            onDoubleClick={() => {
                              if (column.editable && onCellEdit) {
                                setEditing({ row: key, column: column.key });
                              }
                            }}
                            className="border-b border-border-subtle"
                            style={{
                              height: g.row,
                              padding: g.padding,
                              fontSize: g.fontSize,
                              textAlign: column.align ?? "left",
                            }}
                          >
                            <DataCell
                              type={column.type}
                              value={row[column.key]}
                              column={column}
                              editing={isEditing}
                              onCommit={(next) => {
                                onCellEdit?.(key, column.key, next);
                                setEditing(null);
                              }}
                              onCancel={() => setEditing(null)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="text-body font-medium text-text-primary">{emptyTitle}</span>
            {emptyHint ? (
              <span className="max-w-[42ch] text-pretty text-body-s text-text-secondary">
                {emptyHint}
              </span>
            ) : null}
            {emptyAction ? <div className="mt-2">{emptyAction}</div> : null}
          </div>
        ) : null}
      </div>

      {footer ? (
        <div className="border-t border-border-subtle bg-surface-alt px-4 py-2.5">{footer}</div>
      ) : null}
    </div>
  );
}

function RowMenu<T>({
  actions,
  row,
  label,
}: {
  actions: MenuAction<T>[];
  row: T;
  label: string;
}) {
  const [open, setOpen] = React.useState(false);
  const button = React.useRef<HTMLButtonElement>(null);
  useMenuDismiss(open, () => setOpen(false));

  return (
    <span className="relative inline-flex">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-lg border-none text-text-secondary halo-focus",
          "transition-colors duration-[120ms] ease-out",
          open ? "bg-surface-alt" : "bg-transparent hover:bg-surface-alt",
        )}
      >
        <Icon name="ellipsis-vertical" size={16} />
      </button>

      {open ? (
        <Popover anchor={button} align="right" width={200}>
          <span role="menu" className="block">
            {actions.map((action) => (
              <MenuRow
                key={action.label}
                label={action.label}
                icon={action.icon}
                disabled={action.disabled}
                tone={action.tone}
                onClick={() => {
                  setOpen(false);
                  action.onClick?.(row);
                }}
              />
            ))}
          </span>
        </Popover>
      ) : null}
    </span>
  );
}

function HeadMenu({
  column,
  sort,
  onSortChange,
  onHide,
  text,
}: {
  column: Column;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  onHide?: (key: string) => void;
  text: {
    sortAscending: string;
    sortDescending: string;
    clearSort: string;
    hideColumn: string;
    columnOptions: (label: string) => string;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const button = React.useRef<HTMLButtonElement>(null);
  useMenuDismiss(open, () => setOpen(false));

  const close = <T,>(fn: () => T) => () => {
    setOpen(false);
    fn();
  };

  return (
    <span className="relative inline-flex">
      <button
        ref={button}
        type="button"
        aria-label={text.columnOptions(column.label ?? column.key)}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={cn(
          "inline-flex size-5.5 items-center justify-center rounded-md border-none text-text-secondary halo-focus",
          open ? "bg-surface-card opacity-100" : "bg-transparent opacity-70",
        )}
      >
        <Icon name="ellipsis" size={14} />
      </button>

      {open ? (
        <Popover anchor={button} align="left" width={210}>
          <span role="menu" className="block">
            {onSortChange ? (
              <>
                <MenuRow
                  label={text.sortAscending}
                  icon="arrow-up"
                  height={34}
                  active={sort?.key === column.key && sort.dir === "asc"}
                  onClick={close(() => onSortChange({ key: column.key, dir: "asc" }))}
                />
                <MenuRow
                  label={text.sortDescending}
                  icon="arrow-down"
                  height={34}
                  active={sort?.key === column.key && sort.dir === "desc"}
                  onClick={close(() => onSortChange({ key: column.key, dir: "desc" }))}
                />
                {sort?.key === column.key ? (
                  <MenuRow
                    label={text.clearSort}
                    icon="x"
                    height={34}
                    onClick={close(() => onSortChange(null))}
                  />
                ) : null}
              </>
            ) : null}

            {onHide ? (
              <>
                <span className="mx-1 my-1.25 block h-px bg-border-subtle" />
                <MenuRow
                  label={text.hideColumn}
                  icon="eye-off"
                  height={34}
                  onClick={close(() => onHide(column.key))}
                />
              </>
            ) : null}
          </span>
        </Popover>
      ) : null}
    </span>
  );
}
