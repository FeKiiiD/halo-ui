import * as React from "react";
import { cn } from "../../lib/cn";

export interface FormGridProps {
  cols?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}

/**
 * Puts short fields side by side.
 *
 * The 180px floor is the point: below that a field is too narrow to read its
 * own value back, which is where typos survive review. `minmax(180px, 1fr)`
 * means a column drops out rather than being squeezed, so the grid degrades on
 * a narrow screen without a media query.
 */
export function FormGrid({ cols = 2, children, className }: FormGridProps) {
  return (
    <div
      className={cn("grid items-start gap-4", className)}
      style={{
        // min() keeps the floor from overflowing a viewport narrower than it.
        gridTemplateColumns: `repeat(${cols}, minmax(min(180px, 100%), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

export interface FormCellProps {
  /** Columns to occupy. Use for a field that needs the full width of a row. */
  span?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}

export function FormCell({ span = 1, children, className }: FormCellProps) {
  return (
    <div className={cn("min-w-0", className)} style={{ gridColumn: `span ${span}` }}>
      {children}
    </div>
  );
}
