import * as React from "react";
import { cn } from "../../lib/cn";
import { useOverlay } from "../../lib/use-overlay";
import { Logo, type LogoProps } from "../brand/logo";
import { Button } from "../core/button";
import { Icon, type IconName } from "../core/icon";

export interface NavItem {
  label: string;
  href?: string;
  icon?: IconName;
  /** Nested links, shown as a disclosure. */
  items?: NavItem[];
}

export interface MobileNavProps {
  open?: boolean;
  onClose?: () => void;

  brand?: string;
  logo?: LogoProps["src"];
  links?: NavItem[];
  action?: React.ReactNode;
  onAction?: () => void;
  activeHref?: string;
  onNavigate?: (href: string | undefined) => void;
  footer?: React.ReactNode;
  closeLabel?: string;
  className?: string;
}

/**
 * The navigation drawer for narrow screens.
 *
 * ROWS ARE 56px, NOT 48. This is used standing, one-handed, often with a thumb
 * — the counter-mode target applies to the marketing site's mobile menu just as
 * much as to the back office. Nested rows drop to 48 because they are a second
 * choice within a decision already made.
 *
 * Sub-menus expand in place rather than sliding to a second panel: a drill-down
 * hides where the user came from, and the whole point of this menu is that the
 * structure is visible at once.
 */
export function MobileNav({
  open = false,
  onClose,
  brand = "Halo",
  logo,
  links = [],
  action,
  onAction,
  activeHref,
  onNavigate,
  footer,
  closeLabel = "Close menu",
  className,
}: MobileNavProps) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const { mounted, closing, panelRef } = useOverlay({ open, onClose, duration: 240 });

  if (!mounted) return null;

  const renderRows = (items: NavItem[], nested: boolean): React.ReactNode =>
    items.map((item) => {
      const children = item.items ?? null;
      const isOpen = expanded === item.label;
      const active = Boolean(item.href && item.href === activeHref);

      return (
        <div key={item.label} className="border-b border-border-subtle">
          <a
            href={item.href ?? "#"}
            onClick={(event) => {
              if (children?.length) {
                event.preventDefault();
                setExpanded(isOpen ? null : item.label);
                return;
              }
              if (onNavigate) {
                event.preventDefault();
                onNavigate(item.href);
              }
              onClose?.();
            }}
            className={cn(
              "flex items-center gap-3 px-1 font-sans no-underline",
              nested
                ? "min-h-12 pl-8.5 text-[15px] font-normal text-text-secondary"
                : "min-h-14 text-[17px] font-medium tracking-[-0.01em] text-text-primary",
            )}
          >
            {item.icon ? (
              <span className="inline-flex text-text-secondary">
                <Icon name={item.icon} size={18} />
              </span>
            ) : null}
            {item.label}

            {active ? <span className="size-1.5 rounded-full bg-accent" /> : null}

            {children?.length ? (
              <span
                className={cn(
                  "ml-auto inline-flex text-text-secondary transition-transform duration-[200ms] ease-standard",
                  isOpen && "rotate-180",
                )}
              >
                <Icon name="chevron-down" size={18} />
              </span>
            ) : null}
          </a>

          {children?.length && isOpen ? (
            <div className="pb-1.5">{renderRows(children, true)}</div>
          ) : null}
        </div>
      );
    });

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-200 bg-[rgb(11_11_11/0.42)]"
      style={{
        animation: closing ? "halo-veil-out 160ms linear both" : "halo-veil-in 160ms ease-out both",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={brand}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "absolute inset-y-0 right-0 flex w-[min(400px,88vw)] flex-col bg-surface-page outline-none",
          className,
        )}
        style={{
          animation: closing
            ? "halo-drawer-right-out 220ms cubic-bezier(.4,0,1,1) both"
            : "halo-drawer-right-in 240ms var(--ease-standard) both",
        }}
      >
        <div className="flex h-18 items-center border-b border-border-subtle px-5">
          <Logo src={logo} wordmark={brand} height={26} />

          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="ml-auto inline-flex size-11 items-center justify-center rounded-pill border-none bg-surface-alt text-text-primary halo-focus"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-1">{renderRows(links, false)}</div>

        {action || footer ? (
          <div className="flex flex-col gap-2.5 border-t border-border-subtle p-5">
            {action ? (
              <Button variant="primary" size="counter" fullWidth onClick={onAction}>
                {action}
              </Button>
            ) : null}
            {footer ? (
              <span className="text-center font-sans text-[13px] text-text-secondary">{footer}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
