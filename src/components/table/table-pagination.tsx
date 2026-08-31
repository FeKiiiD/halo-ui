import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../core/icon";

export interface TablePaginationProps {
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
  labels?: {
    rows?: string;
    perPage?: string;
    previous?: string;
    next?: string;
    range?: (from: number, to: number, total: number, rows: string) => string;
  };
  className?: string;
}

/**
 * Builds the page list, collapsing the middle: 1 … 4 5 6 … 20.
 *
 * Always shows the first and last page — they are the two anyone jumps to —
 * plus one either side of the current. Under eight pages, no collapsing is
 * needed at all.
 */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages: (number | "gap")[] = [1];
  if (current > 3) pages.push("gap");

  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page++) {
    pages.push(page);
  }

  if (current < total - 2) pages.push("gap");
  pages.push(total);

  return pages;
}

/**
 * The row of page controls under a table.
 *
 * The range read-out comes first and the controls sit at the far right: "1–25
 * of 1 208" answers the question people actually have, and the buttons are
 * where the thumb already is on a wide screen.
 */
export function TablePagination({
  page = 1,
  pageSize = 25,
  total = 0,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50, 100],
  labels,
  className,
}: TablePaginationProps) {
  const text = {
    rows: "rows",
    perPage: "Per page",
    previous: "Previous page",
    next: "Next page",
    range: (from: number, to: number, count: number, rows: string) =>
      `${from}–${to} of ${count} ${rows}`,
    ...labels,
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const arrow = (icon: "chevron-left" | "chevron-right", label: string, target: number, off: boolean) => (
    <button
      type="button"
      aria-label={label}
      disabled={off}
      onClick={() => onPageChange?.(target)}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[9px] border border-border-subtle bg-surface-card halo-focus",
        off ? "cursor-not-allowed text-text-secondary opacity-45" : "cursor-pointer text-text-primary hover:bg-surface-alt",
      )}
    >
      <Icon name={icon} size={15} />
    </button>
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-3 px-3.5 py-2.5 font-sans", className)}>
      <span className="text-[13px] tabular-nums text-text-secondary">
        {text.range(from, to, total, text.rows)}
      </span>

      {onPageSizeChange ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary">
          {text.perPage}
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label={text.perPage}
            className="h-7.5 cursor-pointer rounded-[9px] border border-border-subtle bg-surface-card px-2 font-sans text-[13px] text-text-primary halo-focus"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </span>
      ) : null}

      <span className="ml-auto inline-flex items-center gap-1">
        {arrow("chevron-left", text.previous, page - 1, page <= 1)}

        {pageWindow(page, pages).map((entry, index) =>
          entry === "gap" ? (
            <span
              key={`gap-${index}`}
              className="w-6 text-center text-[13px] text-text-secondary"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange?.(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 rounded-[9px] border px-2 font-sans text-[13px] tabular-nums halo-focus",
                "transition-colors duration-[120ms] ease-out",
                entry === page
                  ? "border-text-primary bg-text-primary font-semibold text-surface-page"
                  : "cursor-pointer border-transparent bg-transparent font-normal text-text-primary hover:bg-surface-alt",
              )}
            >
              {entry}
            </button>
          ),
        )}

        {arrow("chevron-right", text.next, page + 1, page >= pages)}
      </span>
    </div>
  );
}
