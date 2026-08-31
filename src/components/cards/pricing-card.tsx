import * as React from "react";
import { cn } from "../../lib/cn";
import { Button, type ButtonProps } from "../core/button";
import { CountUp } from "../core/count-up";
import { Icon } from "../core/icon";

export interface PricingCardCta {
  label: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
}

export interface PricingHighlight {
  icon?: React.ReactNode;
  label: React.ReactNode;
}

export interface PricingCardProps {
  name: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;

  /** Any string. A numeric one counts up; "On request" is shown as written. */
  price: string;
  oldPrice?: string;
  period?: string;
  note?: React.ReactNode;

  /** The one thing that sells this plan, above the feature list. */
  highlight?: PricingHighlight;
  features?: string[];
  /** Shown struck through the list with a minus — what this plan does not include. */
  excluded?: string[];

  cta?: PricingCardCta;
  badge?: string;
  /** Ink fill. ONE per row: the plan you want chosen. */
  featured?: boolean;
  animate?: boolean;
  className?: string;
}

/**
 * Splits "1 490 " into a prefix, a number and a suffix so the figure can be
 * animated while its currency stays put. Returns null for anything that is not
 * a price -- "On request", "Free" -- which is then rendered verbatim.
 *
 * THE SEPARATOR RULE IS THE WHOLE TRICK: a space counts as a thousands
 * separator only when a digit follows it. A looser class swallowed the space in
 * "1 490 EUR" (losing it from the suffix) and matched the one in "On request",
 * parsing it as zero and rendering "On0request".
 */
export function parsePrice(
  input: string,
): { pre: string; value: number; post: string; decimals: number } | null {
  const match =
    /^(\D*?)(\d(?:[\s\u00a0\u202f]?\d)*(?:[.,]\d+)?)(.*)$/.exec(input);
  if (!match) return null;

  const [, pre = "", digits = "", post = ""] = match;
  const value = Number(digits.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  if (!Number.isFinite(value)) return null;

  return { pre, value, post, decimals: /[.,]\d+$/.test(digits) ? 2 : 0 };
}

/**
 * A plan is a decision, so the card states the price, what it covers, and one
 * action.
 *
 * THE PRICE COUNTS UP when it changes, which is what makes a monthly/annual
 * toggle legible — the figure visibly moves rather than swapping, so the
 * saving is felt rather than read.
 *
 * Unlike other cards this one has a hairline border: a pricing row sits on the
 * page surface rather than on mist, so there is no value difference to separate
 * it.
 */
export function PricingCard({
  name,
  subtitle,
  icon,
  price,
  oldPrice,
  period = "/ month",
  note,
  highlight,
  features = [],
  excluded = [],
  cta,
  badge,
  featured = false,
  animate = true,
  className,
}: PricingCardProps) {
  const parsed = animate ? parsePrice(price) : null;
  const primary = featured ? "text-paper" : "text-text-primary";
  const muted = featured ? "text-text-muted-dark" : "text-text-secondary";

  const formatter = React.useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: parsed?.decimals ?? 0,
        maximumFractionDigits: parsed?.decimals ?? 0,
      }),
    [parsed?.decimals],
  );

  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-card border p-card font-sans",
        featured ? "border-ink bg-ink" : "border-border-subtle bg-surface-card",
        className,
      )}
    >
      {badge ? (
        // Notched into the corner rather than floating over it: a badge with
        // its own shadow would be the only floating thing on the page.
        <span className="absolute right-0 top-0 inline-flex h-6.5 items-center rounded-bl-xl rounded-tr-card bg-accent px-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-accent-ink">
          {badge}
        </span>
      ) : null}

      {icon ? (
        <span
          className={cn(
            "mb-2 inline-flex size-10 items-center justify-center rounded-chip",
            featured ? "bg-accent text-accent-ink" : "bg-mist text-text-primary",
          )}
        >
          {icon}
        </span>
      ) : null}

      <span className="flex flex-col gap-0.5">
        <span className={cn("text-heading-s", primary)}>{name}</span>
        {subtitle ? <span className={cn("text-[13.5px]", muted)}>{subtitle}</span> : null}
      </span>

      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "text-[40px] font-semibold leading-10 tracking-[-0.03em] tabular-nums",
            primary,
          )}
        >
          {parsed ? (
            <CountUp
              value={parsed.value}
              decimals={parsed.decimals}
              format={(value) => `${parsed.pre}${formatter.format(value)}${parsed.post}`}
            />
          ) : (
            price
          )}
        </span>

        {oldPrice ? (
          <span
            className={cn(
              "text-[26px] font-semibold leading-7 tracking-[-0.02em] line-through tabular-nums",
              featured ? "text-[#5A5F5F]" : "text-[#B4BAB9]",
            )}
          >
            {oldPrice}
          </span>
        ) : null}

        {period ? <span className={cn("text-[14px]", muted)}>{period}</span> : null}
      </div>

      {note ? <span className={cn("-mt-1 text-[13px]", muted)}>{note}</span> : null}

      {cta ? (
        <div className="mt-2">
          <Button
            variant={cta.variant ?? (featured ? "primary" : "outlined")}
            size="md"
            fullWidth
            onDark={featured && cta.variant !== "primary"}
            onClick={cta.onClick}
          >
            {cta.label}
          </Button>
        </div>
      ) : null}

      {highlight ? (
        <span className={cn("inline-flex items-center gap-2 text-[13.5px] font-medium", primary)}>
          {highlight.icon ? <span className="inline-flex">{highlight.icon}</span> : null}
          {highlight.label}
        </span>
      ) : null}

      {features.length || excluded.length ? (
        <span className={cn("h-px", featured ? "bg-ink-hairline" : "bg-border-subtle")} />
      ) : null}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {features.map((feature) => (
          <li
            key={feature}
            className={cn("flex items-start gap-2.25 text-body-s leading-[var(--lh-body-s)]", primary)}
          >
            <span className={cn("mt-0.5 inline-flex shrink-0", muted)}>
              <Icon name="check" size={16} />
            </span>
            {feature}
          </li>
        ))}

        {excluded.map((feature) => (
          <li
            key={feature}
            className={cn("flex items-start gap-2.25 text-body-s leading-[var(--lh-body-s)]", muted)}
          >
            <span className="mt-0.5 inline-flex shrink-0">
              <Icon name="minus" size={16} />
            </span>
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}
