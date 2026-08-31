import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export interface KanbanColumn {
  value: string;
  label: string;
  /** Above this many cards the count turns amber: a column over its limit. */
  limit?: number;
  /** A dot beside the heading. */
  tone?: "accent" | "success" | "warning" | "error" | "info";
}

export interface KanbanCardFace {
  /** Row field shown as the card's title. */
  title?: string;
  subtitle?: string;
  /** Small labelled values along the bottom. */
  fields?: { key: string; label?: string }[];
  /** Row fields rendered as chips. */
  badges?: string[];
}

export interface KanbanBoardProps<T extends Record<string, unknown> = Record<string, unknown>> {
  rows: T[];
  rowKey?: string;
  /** The field the columns group by. */
  groupBy?: string;
  columns?: KanbanColumn[];

  card?: KanbanCardFace;
  onCardMove?: (row: T, to: string) => void;
  onCardClick?: (row: T) => void;
  cardActions?: (row: T) => React.ReactNode;

  loading?: boolean;
  height?: number;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

const toneDot: Record<NonNullable<KanbanColumn["tone"]>, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
};

/**
 * The same rows as a board: one column per value of a field.
 *
 * DRAGGING A CARD SETS THAT FIELD. The board is not a separate data structure
 * — it is a view of the table, and moving a card is an edit to the row, which
 * is why `onCardMove` gets the row and the new value rather than a pair of
 * indices. A board that maintains its own ordering diverges from the table
 * beside it within a day.
 *
 * An empty column is kept rather than hidden: the columns are the workflow,
 * and one that vanishes when it empties makes the workflow look shorter than
 * it is.
 */
export function KanbanBoard<T extends Record<string, unknown>>({
  rows,
  rowKey = "id",
  groupBy = "status",
  columns,
  card = {},
  onCardMove,
  onCardClick,
  cardActions,
  loading = false,
  height = 460,
  labels,
  className,
}: KanbanBoardProps<T>) {
  const text = {
    cards: "cards",
    empty: "Nothing here",
    over: "over the limit",
    ...labels,
  };

  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);

  // Without explicit columns, one per distinct value — in the order they first
  // appear, which is the closest thing to an author's intent available.
  const resolved: KanbanColumn[] =
    columns ??
    [...new Set(rows.map((row) => String(row[groupBy] ?? "")))].map((value) => ({
      value,
      label: value || "—",
    }));

  const keyOf = (row: T) => String(row[rowKey] ?? "");

  const drop = (value: string) => {
    const row = rows.find((entry) => keyOf(entry) === dragging);
    setDragging(null);
    setOver(null);
    // Dropping a card back where it came from is not an edit.
    if (row && String(row[groupBy] ?? "") !== value) onCardMove?.(row, value);
  };

  return (
    <div
      className={cn("flex gap-3 overflow-x-auto font-sans", className)}
      style={{ height }}
    >
      {resolved.map((column) => {
        const inColumn = rows.filter((row) => String(row[groupBy] ?? "") === column.value);
        const overLimit = column.limit != null && inColumn.length > column.limit;
        const isTarget = over === column.value;

        return (
          <div
            key={column.value}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOver(column.value);
            }}
            onDragLeave={(event) => {
              // Only when the pointer actually leaves the column, not when it
              // crosses a card inside it.
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setOver((current) => (current === column.value ? null : current));
              }
            }}
            onDrop={() => drop(column.value)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-card border bg-surface-alt",
              "transition-colors duration-[140ms] ease-standard",
              isTarget ? "border-accent-deep bg-mist" : "border-border-subtle",
            )}
          >
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
              {column.tone ? (
                <span className={cn("size-2 shrink-0 rounded-full", toneDot[column.tone])} />
              ) : null}

              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-primary">
                {column.label}
              </span>

              <span
                title={overLimit ? `${inColumn.length} / ${column.limit} — ${text.over}` : undefined}
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-pill px-1.5 text-[11.5px] tabular-nums",
                  overLimit ? "bg-warning-soft text-warning" : "bg-surface-card text-text-secondary",
                )}
              >
                {inColumn.length}
                {column.limit != null ? `/${column.limit}` : ""}
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
              {loading ? (
                [0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="h-20 shrink-0 rounded-panel bg-surface-card"
                    style={{ animation: "halo-shimmer 1.4s ease-in-out infinite" }}
                  />
                ))
              ) : inColumn.length === 0 ? (
                <span className="m-auto text-[12.5px] text-text-secondary">{text.empty}</span>
              ) : (
                inColumn.map((row) => {
                  const id = keyOf(row);
                  const held = dragging === id;

                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={(event) => {
                        setDragging(id);
                        event.dataTransfer.effectAllowed = "move";
                        // Some browsers refuse to start a drag without data.
                        event.dataTransfer.setData("text/plain", id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onClick={() => onCardClick?.(row)}
                      className={cn(
                        "flex cursor-grab flex-col gap-1.5 rounded-panel border border-border-subtle bg-surface-card p-2.5",
                        "transition-[opacity,box-shadow] duration-[140ms] ease-standard",
                        held ? "cursor-grabbing opacity-40" : "hover:shadow-float",
                      )}
                      style={{ animation: "halo-row-in 180ms var(--ease-standard) both" }}
                    >
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-text-primary">
                          {String(row[card.title ?? "name"] ?? "")}
                        </span>
                        {cardActions ? (
                          <span
                            onClick={(event) => event.stopPropagation()}
                            className="shrink-0"
                          >
                            {cardActions(row)}
                          </span>
                        ) : null}
                      </span>

                      {card.subtitle && row[card.subtitle] ? (
                        <span className="truncate text-[12px] text-text-secondary">
                          {String(row[card.subtitle])}
                        </span>
                      ) : null}

                      {card.badges?.length ? (
                        <span className="flex flex-wrap gap-1">
                          {card.badges
                            .filter((key) => row[key] != null && row[key] !== "")
                            .map((key) => (
                              <span
                                key={key}
                                className="inline-flex h-5 items-center rounded-pill bg-mist px-2 text-[11px] text-text-primary"
                              >
                                {String(row[key])}
                              </span>
                            ))}
                        </span>
                      ) : null}

                      {card.fields?.length ? (
                        <span className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                          {card.fields
                            .filter((field) => row[field.key] != null && row[field.key] !== "")
                            .map((field) => (
                              <span
                                key={field.key}
                                className="inline-flex items-center gap-1 text-[11.5px] tabular-nums text-text-secondary"
                              >
                                {field.label ? (
                                  <span className="opacity-70">{field.label}</span>
                                ) : null}
                                {String(row[field.key])}
                              </span>
                            ))}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
