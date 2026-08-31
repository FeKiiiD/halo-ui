import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export interface ChoiceCardProps {
  value: string;
  selected?: boolean;
  onSelect?: (value: string) => void;

  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: IconName;
  badge?: React.ReactNode;

  /** Cards in one group must share a name for arrow-key navigation. */
  name?: string;
  disabled?: boolean;
  /** Counter-mode proportions: taller, larger type, bigger icon. */
  counter?: boolean;
  className?: string;
}

/**
 * A radio option that deserves a sentence: a plan, a rhythm, a channel.
 *
 * Selection is marked twice over — a solid border and a soft accent halo —
 * because a card is large enough that a single thin border change is easy to
 * miss. The halo is the one place a glow appears in the system, and it is
 * tuned low (0.35) so it reads as emphasis rather than as a shadow.
 *
 * When an icon is given it replaces the radio dot: two selection marks on one
 * card is one too many.
 */
export function ChoiceCard({
  value,
  selected = false,
  onSelect,
  title,
  description,
  icon,
  badge,
  name,
  disabled = false,
  counter = false,
  className,
}: ChoiceCardProps) {
  return (
    <label
      className={cn(
        "group relative flex items-start gap-4 rounded-card border-[1.5px] bg-surface-card",
        "transition-[border-color,box-shadow,background-color] duration-[160ms] ease-out",
        counter ? "min-h-[84px] p-6" : "p-4",
        disabled
          ? "cursor-not-allowed bg-surface-disabled opacity-60"
          : "cursor-pointer hover:border-text-secondary",
        selected
          ? "border-border-strong shadow-[0_0_0_3px_rgb(217_248_79/0.35)]"
          : "border-border-subtle",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect?.(value)}
        className="sr-only"
      />

      {icon ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-chip text-ink",
            "transition-colors duration-[180ms] ease-standard",
            counter ? "size-12" : "size-10",
            selected ? "bg-accent" : "bg-surface-sunken",
          )}
        >
          <Icon name={icon} size={counter ? 24 : 20} />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-surface-card",
            selected ? "border-border-strong" : "border-border-subtle",
          )}
        >
          {selected ? <span className="size-2.5 rounded-full bg-text-primary" /> : null}
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "font-medium text-text-primary",
              counter ? "text-[18px]" : "text-body",
            )}
          >
            {title}
          </span>
          {badge ? (
            <span className="inline-flex h-5.5 items-center rounded-pill bg-accent px-2.25 text-[12px] font-medium text-accent-ink">
              {badge}
            </span>
          ) : null}
        </span>

        {description ? (
          <span
            className={cn(
              "text-pretty leading-[1.5] text-text-secondary",
              counter ? "text-[15px]" : "text-body-s",
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
