import * as React from "react";
import { cn } from "../../lib/cn";

export interface StatBlockProps {
  /** The figure. Set as numerals with French conventions: `1 208`, `+18 %`. */
  value: React.ReactNode;
  /** What it counts, in one short line. */
  label: React.ReactNode;
  /**
   * `accent` is the key-figure treatment and one of the accent's four
   * permitted homes. Use `neutral` for the second and third stat in a row —
   * a row of three lime figures spends the accent three times.
   */
  tone?: "accent" | "neutral";
  align?: "left" | "center";
  className?: string;
}

/** A key figure over its caption. The stat size is 48px and never scales down
 *  inside the application, where headings cap at app-title. */
export function StatBlock({
  value,
  label,
  tone = "accent",
  align = "left",
  className,
}: StatBlockProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <span className={cn("text-stat", tone === "accent" ? "text-accent" : "text-text-primary")}>
        {value}
      </span>
      {/* 22ch keeps a caption to two lines at most, so a row of stats stays
          on one baseline. */}
      <span className="max-w-[22ch] text-body-s text-text-secondary">{label}</span>
    </div>
  );
}
