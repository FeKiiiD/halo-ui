import * as React from "react";
import { cn } from "../../lib/cn";
import { useDismissable } from "../../lib/use-dismissable";
import { Icon, type IconName } from "../core/icon";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: IconName;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (href: string | undefined) => void;
  /** Levels shown before the middle collapses. */
  max?: number;
  ariaLabel?: string;
  className?: string;
}

/**
 * The trail back up a hierarchy.
 *
 * A LONG PATH COLLAPSES IN THE MIDDLE, not at the end: the first level and the
 * last two are what orient someone — the middle is exactly what nobody reads.
 * The hidden levels stay reachable behind the ellipsis rather than being
 * dropped.
 *
 * The last item is not a link. It is where the user already is, and making it
 * clickable invites a pointless navigation.
 */
export function Breadcrumbs({
  items,
  onNavigate,
  max = 4,
  ariaLabel = "Breadcrumb",
  className,
}: BreadcrumbsProps) {
  const [open, setOpen] = React.useState(false);
  const root = useDismissable<HTMLSpanElement>(open, () => setOpen(false));

  const collapsed = items.length > max;
  const hidden = collapsed ? items.slice(1, items.length - 2) : [];

  const shown: (BreadcrumbItem | { ellipsis: true })[] = collapsed
    ? [items[0]!, { ellipsis: true }, items[items.length - 2]!, items[items.length - 1]!]
    : items;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1 font-sans text-body-s", className)}
    >
      {shown.map((item, index) => {
        const last = index === shown.length - 1;
        const isEllipsis = "ellipsis" in item;

        return (
          <span
            key={isEllipsis ? "ellipsis" : item.label}
            className="inline-flex items-center gap-1"
          >
            {index > 0 ? (
              <span className="inline-flex text-text-secondary opacity-70">
                <Icon name="chevron-right" size={14} />
              </span>
            ) : null}

            {isEllipsis ? (
              <span ref={root} className="relative inline-flex">
                <button
                  type="button"
                  aria-label="Show hidden levels"
                  aria-expanded={open}
                  onClick={() => setOpen((value) => !value)}
                  className={cn(
                    "h-6 rounded-pill border-none px-2 font-sans text-[13px] text-text-secondary halo-focus",
                    open ? "bg-mist" : "bg-transparent hover:bg-mist",
                  )}
                >
                  …
                </button>

                {open ? (
                  <span
                    className="absolute left-0 top-[calc(100%+6px)] z-40 flex min-w-[180px] flex-col rounded-chip border border-border-subtle bg-surface-card p-1.5 shadow-float"
                    style={{ animation: "halo-panel-in 120ms ease-out both" }}
                  >
                    {hidden.map((level) => (
                      <a
                        key={level.label}
                        href={level.href ?? "#"}
                        onClick={(event) => {
                          if (onNavigate) {
                            event.preventDefault();
                            onNavigate(level.href);
                          }
                          setOpen(false);
                        }}
                        className="whitespace-nowrap rounded-lg px-2.25 py-1.75 text-[13.5px] text-text-primary no-underline hover:bg-mist"
                      >
                        {level.label}
                      </a>
                    ))}
                  </span>
                ) : null}
              </span>
            ) : last ? (
              <span aria-current="page" className="font-medium text-text-primary">
                {item.label}
              </span>
            ) : (
              <a
                href={item.href ?? "#"}
                onClick={(event) => {
                  if (!onNavigate) return;
                  event.preventDefault();
                  onNavigate(item.href);
                }}
                className="inline-flex items-center gap-1.5 text-text-secondary no-underline hover:text-text-primary"
              >
                {item.icon ? <Icon name={item.icon} size={15} /> : null}
                {item.label}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}
