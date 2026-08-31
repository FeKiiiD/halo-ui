import * as React from "react";
import { cn } from "../../lib/cn";

export interface TestimonialStat {
  value: React.ReactNode;
  label: React.ReactNode;
}

export interface TestimonialCardProps {
  quote: React.ReactNode;
  author: string;
  role?: string;
  place?: string;
  /** Two letters. No stock portraits ship with the system. */
  initials?: string;
  /** One figure that backs the quote up. */
  stat?: TestimonialStat;
  inverted?: boolean;
  className?: string;
}

/**
 * A customer's sentence, verbatim.
 *
 * NO STARS, NO RATING WIDGET, NO STOCK PORTRAIT. A five-star row is a pattern
 * from review sites and reads as marketing; a real sentence with a name and a
 * place under it reads as a person. The optional figure is what makes the quote
 * checkable.
 *
 * `mt-auto` on the caption pins the attribution to the bottom, so a row of
 * cards with quotes of different lengths still aligns its names.
 */
export function TestimonialCard({
  quote,
  author,
  role,
  place,
  initials,
  stat,
  inverted = false,
  className,
}: TestimonialCardProps) {
  const primary = inverted ? "text-paper" : "text-text-primary";
  const muted = inverted ? "text-text-muted-dark" : "text-text-secondary";

  return (
    <figure
      className={cn(
        "m-0 flex flex-col gap-6 rounded-card p-card font-sans",
        inverted ? "bg-ink" : "bg-surface-card",
        className,
      )}
    >
      <blockquote
        className={cn(
          "m-0 text-pretty text-[20px] font-medium leading-7 tracking-[-0.015em]",
          primary,
        )}
      >
        {quote}
      </blockquote>

      {stat ? (
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-[32px] font-semibold leading-8 tracking-[-0.02em] tabular-nums",
              inverted ? "text-accent" : "text-text-primary",
            )}
          >
            {stat.value}
          </span>
          <span className={cn("text-[13px]", muted)}>{stat.label}</span>
        </div>
      ) : null}

      <figcaption className="mt-auto flex items-center gap-3">
        <span
          className={cn(
            "inline-flex size-9.5 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
            inverted ? "bg-accent text-accent-ink" : "bg-chip-neutral-bg text-chip-neutral-fg",
          )}
        >
          {initials}
        </span>
        <span className="flex flex-col leading-[1.3]">
          <span className={cn("text-[14px] font-medium", primary)}>{author}</span>
          <span className={cn("text-[12.5px]", muted)}>
            {[role, place].filter(Boolean).join(" · ")}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
