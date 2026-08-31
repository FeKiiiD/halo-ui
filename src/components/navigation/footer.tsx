import * as React from "react";
import { cn } from "../../lib/cn";
import { Logo, type LogoProps } from "../brand/logo";
import { Button } from "../core/button";
import { Icon, type IconName } from "../core/icon";

export interface FooterLink {
  label: string;
  href?: string;
  badge?: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterSocial {
  icon: IconName;
  href?: string;
  label?: string;
}

export interface FooterNewsletter {
  title: React.ReactNode;
  note?: React.ReactNode;
  placeholder?: string;
  action?: string;
  onSubmit?: (email: string) => void;
}

export interface FooterProps {
  columns?: FooterColumn[];
  tagline?: React.ReactNode;
  brand?: string;
  logo?: LogoProps["src"];
  contact?: { label: string; href?: string; icon?: IconName }[];
  socials?: FooterSocial[];
  newsletter?: FooterNewsletter;
  legal?: FooterLink[];
  copyright?: React.ReactNode;
  /** `ink` closes a dark composition; `alt` suits a light page. */
  tone?: "ink" | "alt";
  onNavigate?: (href: string | undefined) => void;
  className?: string;
}

/**
 * The foot of a marketing site.
 *
 * ON INK BY DEFAULT: the site opens on the dark hero and closes on dark, which
 * is what makes the page read as one composition rather than as sections that
 * stopped. A light footer leaves the page feeling unfinished.
 */
export function Footer({
  columns = [],
  tagline,
  brand = "Halo",
  logo,
  contact,
  socials = [],
  newsletter,
  legal = [],
  copyright,
  tone = "ink",
  onNavigate,
  className,
}: FooterProps) {
  const [email, setEmail] = React.useState("");
  const dark = tone === "ink";

  // Read once on mount rather than during render: a server rendering on 31
  // December and a client hydrating on 1 January would otherwise disagree, and
  // React would warn about the mismatch.
  const [year, setYear] = React.useState<number | null>(null);
  React.useEffect(() => setYear(new Date().getFullYear()), []);

  const primary = dark ? "text-paper" : "text-text-primary";
  const muted = dark ? "text-text-muted-dark" : "text-text-secondary";
  const line = dark ? "border-ink-hairline" : "border-border-subtle";

  const navigate = (href: string | undefined) => (event: React.MouseEvent) => {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate(href);
  };

  return (
    <footer
      className={cn(
        "px-0 pb-8 pt-20 font-sans",
        dark ? "bg-ink" : "bg-surface-alt",
        primary,
        className,
      )}
    >
      <div className="mx-auto max-w-content px-6">
        <div className="grid items-start gap-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] md:gap-16">
          <div className="flex max-w-[34ch] flex-col gap-6">
            <Logo
              src={logo}
              wordmark={brand}
              theme={dark ? "dark" : "light"}
              height={30}
              onClick={onNavigate ? () => onNavigate("#") : undefined}
            />

            {tagline ? (
              <p
                className={cn(
                  "m-0 text-pretty text-[17px] leading-[26px] tracking-[-0.015em]",
                  primary,
                )}
              >
                {tagline}
              </p>
            ) : null}

            {contact?.length ? (
              <div className="flex flex-col gap-1.5">
                {contact.map((entry) => (
                  <a
                    key={entry.label}
                    href={entry.href ?? "#"}
                    onClick={navigate(entry.href)}
                    className={cn(
                      "inline-flex items-center gap-2 text-body-s no-underline hover:opacity-80",
                      muted,
                    )}
                  >
                    {entry.icon ? (
                      <span className="inline-flex">
                        <Icon name={entry.icon} size={16} />
                      </span>
                    ) : null}
                    {entry.label}
                  </a>
                ))}
              </div>
            ) : null}

            {socials.length ? (
              <div className="flex gap-2">
                {socials.map((social) => (
                  <a
                    key={social.icon}
                    href={social.href ?? "#"}
                    aria-label={social.label ?? social.icon}
                    onClick={navigate(social.href)}
                    className={cn(
                      "inline-flex size-9.5 items-center justify-center rounded-pill border bg-transparent no-underline halo-focus",
                      line,
                      primary,
                    )}
                  >
                    <Icon name={social.icon} size={17} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className="grid gap-8"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))`,
            }}
          >
            {columns.map((column) => (
              <nav key={column.title} className="flex flex-col gap-2.5">
                <span
                  className={cn(
                    "text-[11.5px] font-semibold uppercase tracking-[0.08em]",
                    muted,
                  )}
                >
                  {column.title}
                </span>

                {column.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href ?? "#"}
                    onClick={navigate(link.href)}
                    className={cn(
                      "inline-flex items-center gap-1.75 text-body-s no-underline hover:opacity-80",
                      primary,
                    )}
                  >
                    {link.label}
                    {link.badge ? (
                      <span className="inline-flex h-4.5 items-center rounded-pill bg-accent px-1.75 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-accent-ink">
                        {link.badge}
                      </span>
                    ) : null}
                  </a>
                ))}
              </nav>
            ))}
          </div>
        </div>

        {newsletter ? (
          <div className={cn("mt-16 flex flex-wrap items-center gap-6 border-t pt-8", line)}>
            <span className="flex flex-[1_1_280px] flex-col gap-1">
              <span className="text-[15px] font-medium">{newsletter.title}</span>
              {newsletter.note ? (
                <span className={cn("text-body-s", muted)}>{newsletter.note}</span>
              ) : null}
            </span>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                newsletter.onSubmit?.(email);
              }}
              className="flex flex-[0_1_420px] gap-2"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={newsletter.placeholder ?? "you@example.com"}
                aria-label={typeof newsletter.title === "string" ? newsletter.title : "Email"}
                className={cn(
                  "h-12 min-w-0 flex-1 rounded-pill border bg-transparent px-4 font-sans text-[15px] outline-none",
                  "placeholder:opacity-60 focus:border-current",
                  line,
                  primary,
                  !dark && "bg-surface-card",
                )}
              />
              <Button variant="primary" type="submit">
                {newsletter.action ?? "Subscribe"}
              </Button>
            </form>
          </div>
        ) : null}

        <div
          className={cn(
            "mt-8 flex flex-wrap items-center gap-6 border-t pt-6 text-[12.5px]",
            line,
            muted,
          )}
        >
          <span>{copyright ?? (year ? `© ${year} ${brand}. All rights reserved.` : `© ${brand}. All rights reserved.`)}</span>

          <span className="ml-auto flex flex-wrap gap-4">
            {legal.map((link) => (
              <a
                key={link.label}
                href={link.href ?? "#"}
                onClick={navigate(link.href)}
                className={cn("no-underline hover:opacity-80", muted)}
              >
                {link.label}
              </a>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
