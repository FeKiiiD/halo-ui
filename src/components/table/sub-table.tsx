import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export interface SubTableProps {
  title?: React.ReactNode;
  count?: number;
  countLabel?: string;
  icon?: IconName;
  actions?: React.ReactNode;
  /** Left indent in px, aligning with the parent's expand control. */
  indent?: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * The frame for a table nested under an expanded row.
 *
 * THE INDENT IS THE HIERARCHY. A nested table flush with its parent reads as a
 * second table that happens to be below; indented to align past the expand
 * control, it reads as belonging to the row above it — no extra border or
 * background needed.
 */
export function SubTable({
  title,
  count,
  countLabel = "rows",
  icon,
  actions,
  indent = 34,
  children,
  className,
}: SubTableProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 px-6 pb-6 pt-4 font-sans", className)}
      style={{ paddingLeft: indent }}
    >
      {title ? (
        <div className="flex items-center gap-2">
          {icon ? <Icon name={icon} size={15} className="text-text-secondary" /> : null}
          <span className="text-[13px] font-semibold text-text-primary">{title}</span>
          {count !== undefined ? (
            <span className="text-[12px] tabular-nums text-text-secondary">
              {count} {countLabel}
            </span>
          ) : null}
          {actions ? <span className="ml-auto inline-flex gap-1.5">{actions}</span> : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}
