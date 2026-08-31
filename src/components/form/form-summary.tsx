import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../core/icon";

export interface SummaryItem {
  label: string;
  value?: React.ReactNode;
  /** Nothing was entered. Renders in the error tone with a prompt. */
  missing?: boolean;
  /** Emphasises the value: a total, a chosen plan. */
  strong?: boolean;
}

export interface SummaryGroup {
  title: string;
  items: SummaryItem[];
  /** Passed back to `onEdit` so the caller knows which step to return to. */
  step?: number;
}

export interface FormSummaryProps {
  groups: SummaryGroup[];
  onEdit?: (group: SummaryGroup) => void;
  /** Tighter padding, for a summary inside a dialog. */
  dense?: boolean;
  editLabel?: string;
  missingLabel?: string;
  className?: string;
}

/**
 * Everything the user entered, before they commit to it.
 *
 * MISSING ENTRIES ARE SHOWN, NOT HIDDEN. A summary that silently omits what was
 * skipped is how someone submits a half-finished form believing it complete —
 * so a blank renders in the error tone with a prompt, and the row still appears.
 *
 * Each group carries its own way back, which is what makes this usable as the
 * last step of a wizard rather than a dead-end receipt.
 */
export function FormSummary({
  groups,
  onEdit,
  dense = false,
  editLabel = "Edit",
  missingLabel = "Not provided",
  className,
}: FormSummaryProps) {
  return (
    <div className={cn("flex flex-col gap-6 font-sans", className)}>
      {groups.map((group) => (
        <div
          key={group.title}
          className="overflow-hidden rounded-card border border-border-subtle bg-surface-card"
        >
          <div
            className={cn(
              "flex items-center gap-3 bg-surface-alt",
              dense ? "px-4 py-2.5" : "px-6 py-4",
            )}
          >
            <span className="text-body-s font-medium text-text-primary">{group.title}</span>
            <span className="flex-1" />
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(group)}
                className="inline-flex h-7 items-center gap-1.5 rounded-pill border-none bg-transparent px-2.5 font-sans text-[13px] font-medium text-text-primary transition-colors duration-[120ms] ease-out hover:bg-surface-card halo-focus"
              >
                <Icon name="pen-line" size={14} />
                {editLabel}
              </button>
            ) : null}
          </div>

          <dl className={cn("m-0", dense ? "px-4 py-1.5" : "px-6 py-3")}>
            {group.items.map((item, index) => (
              <div
                key={item.label}
                className={cn(
                  "grid grid-cols-[minmax(0,200px)_minmax(0,1fr)] gap-4",
                  dense ? "py-1.75" : "py-2.5",
                  index > 0 && "border-t border-border-subtle",
                )}
              >
                <dt className="text-body-s text-text-secondary">{item.label}</dt>
                <dd
                  className={cn(
                    "m-0 text-body-s",
                    item.missing ? "text-error" : "text-text-primary",
                    item.strong && "font-medium",
                  )}
                >
                  {item.missing ? missingLabel : item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
