import * as React from "react";
import { cn } from "../../lib/cn";
import { Button, type ButtonProps } from "../core/button";

export type CardHalo = "corner" | "bottom" | "lime";

export interface FeatureCardCta {
  label: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
  iconRight?: React.ReactNode;
}

export interface FeatureCardFooterIcon {
  icon: React.ReactNode;
  label: React.ReactNode;
}

export interface FeatureCardProps {
  icon?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  children?: React.ReactNode;

  cta?: FeatureCardCta;
  /** A row of small facts under a rule: counts, formats, durations. */
  footerIcons?: FeatureCardFooterIcon[];
  footer?: React.ReactNode;

  /**
   * Flips the card to ink. EXACTLY ONE per grid — the inverted card exists to
   * break the reading rhythm, and two of them break nothing.
   */
  inverted?: boolean;
  /** Brings the hero halo down to card size. Implies the ink régime. */
  halo?: boolean | CardHalo;

  interactive?: boolean;
  href?: string;
  onClick?: () => void;
  align?: "start" | "center";
  className?: string;
}

/**
 * The halo at card scale: three blurred radials, never a linear gradient.
 * Each variant places the light differently so a grid of haloed cards does not
 * read as wallpaper.
 */
const halos: Record<CardHalo, string> = {
  corner:
    "radial-gradient(120% 120% at 88% 6%, rgb(59 208 126 / 0.30) 0%, rgb(59 208 126 / 0) 58%), radial-gradient(90% 90% at 8% 92%, rgb(12 107 79 / 0.42) 0%, rgb(12 107 79 / 0) 62%), radial-gradient(70% 70% at 62% 96%, rgb(30 92 85 / 0.34) 0%, rgb(30 92 85 / 0) 70%)",
  bottom:
    "radial-gradient(120% 90% at 50% 118%, rgb(59 208 126 / 0.34) 0%, rgb(59 208 126 / 0) 62%), radial-gradient(80% 70% at 6% 104%, rgb(12 107 79 / 0.40) 0%, rgb(12 107 79 / 0) 66%), radial-gradient(60% 60% at 92% 8%, rgb(30 92 85 / 0.26) 0%, rgb(30 92 85 / 0) 72%)",
  lime:
    "radial-gradient(110% 110% at 84% 4%, rgb(217 248 79 / 0.22) 0%, rgb(217 248 79 / 0) 56%), radial-gradient(90% 90% at 10% 96%, rgb(59 208 126 / 0.26) 0%, rgb(59 208 126 / 0) 64%)",
};

/**
 * The workhorse card: an icon, a title, a sentence, sometimes an action.
 *
 * NO SHADOW AND NO BORDER. Cards separate from the mist ground by value alone —
 * adding a drop shadow is the first thing that would read as an approximate
 * copy of this system.
 *
 * The title caps at 18ch so a grid of cards keeps its titles to two lines and
 * the cards stay the same height without being forced to.
 */
export function FeatureCard({
  icon,
  eyebrow,
  title,
  body,
  children,
  cta,
  footerIcons,
  footer,
  inverted = false,
  halo,
  interactive = false,
  href,
  onClick,
  align = "start",
  className,
}: FeatureCardProps) {
  const glow: CardHalo | null = halo === true ? "corner" : halo || null;
  const dark = inverted || Boolean(glow);
  const clickable = interactive || Boolean(href) || Boolean(onClick);

  const Tag = (href ? "a" : "article") as "a";
  // Content sits above the halo layer; without a stacking context it would be
  // painted under it.
  const layer = glow ? "relative z-1" : undefined;

  return (
    <Tag
      href={href}
      onClick={onClick}
      className={cn(
        "group flex flex-col rounded-card border-none p-card font-sans no-underline shadow-none",
        "transition-colors duration-[180ms] ease-standard",
        glow && "relative isolate overflow-hidden",
        dark ? "bg-ink" : "bg-surface-card",
        clickable && (dark ? "cursor-pointer hover:bg-ink-elevated" : "cursor-pointer hover:bg-mist"),
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {glow ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-70 transition-opacity duration-[300ms] ease-standard group-hover:opacity-[0.88]"
          style={{ background: halos[glow] }}
        />
      ) : null}

      {icon ? <div className={cn("mb-6", layer)}>{icon}</div> : null}

      {eyebrow ? (
        <span
          className={cn(
            // The only uppercase in the system, and only here: a card eyebrow
            // is a label, not a sentence.
            "mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]",
            dark ? "text-accent" : "text-text-secondary",
            layer,
          )}
        >
          {eyebrow}
        </span>
      ) : null}

      <h3
        className={cn(
          "m-0 max-w-[18ch] text-heading-s",
          dark ? "text-paper" : "text-text-primary",
          layer,
        )}
      >
        {title}
      </h3>

      {body ? (
        <p
          className={cn(
            "m-0 mt-3 text-pretty text-body-s",
            dark ? "text-text-muted-dark" : "text-text-secondary",
            layer,
          )}
        >
          {body}
        </p>
      ) : null}

      {children ? <div className={cn("mt-6 w-full", layer)}>{children}</div> : null}

      {footerIcons?.length ? (
        <div
          className={cn(
            "mt-6 flex w-full items-center gap-4 border-t pt-4",
            dark ? "border-ink-hairline" : "border-border-subtle",
            layer,
          )}
        >
          {footerIcons.map((item, index) => (
            <span
              key={index}
              className={cn(
                "inline-flex items-center gap-1.5 text-[12.5px]",
                dark ? "text-text-muted-dark" : "text-text-secondary",
              )}
            >
              <span className={cn("inline-flex", dark ? "text-accent" : "text-text-primary")}>
                {item.icon}
              </span>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}

      {footer ? (
        <div
          className={cn(
            "mt-4 text-[12.5px]",
            dark ? "text-text-muted-dark" : "text-text-secondary",
          )}
        >
          {footer}
        </div>
      ) : null}

      {cta ? (
        <div className={cn("mt-6", layer)}>
          <Button
            variant={cta.variant ?? (dark ? "primary" : "secondary")}
            size="sm"
            onDark={dark && cta.variant !== "primary"}
            iconRight={cta.iconRight}
            onClick={cta.onClick}
          >
            {cta.label}
          </Button>
        </div>
      ) : null}
    </Tag>
  );
}
