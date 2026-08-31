import * as React from "react";
import { cn } from "../../lib/cn";
import { Logo, type LogoProps } from "../brand/logo";
import { Button } from "../core/button";
import { Icon } from "../core/icon";
import { MegaMenu, type MegaColumn, type MegaMedia } from "./mega-menu";
import { MenuDropdown, type MenuItem } from "./menu-dropdown";
import { MobileNav, type NavItem } from "./mobile-nav";

export interface NavMenu {
  /** `list` renders a MenuDropdown; `mega` renders a MegaMenu. */
  kind?: "list" | "mega";
  align?: "trigger" | "center" | "full";
  width?: number;
  items?: MenuItem[];
  columns?: MegaColumn[];
  media?: MegaMedia[];
  right?: React.ReactNode;
  footer?: React.ReactNode;
}

export interface NavbarLink {
  label: string;
  href?: string;
  menu?: NavMenu;
}

export interface NavbarProps {
  brand?: string;
  logo?: LogoProps["src"];
  links?: NavbarLink[];
  activeHref?: string;
  action?: React.ReactNode;
  onAction?: () => void;
  /** `dark` for the ink hero, `light` for a white section. */
  theme?: "dark" | "light";
  compact?: boolean;
  onNavigate?: (href: string | undefined) => void;
  mobileFooter?: React.ReactNode;
  menuLabel?: string;
  className?: string;
}

/**
 * Panels inherit the bar's régime by overriding the semantic tokens on the
 * wrapper: one declaration flips every child at once, without any component
 * inside knowing it is on a dark bar.
 *
 * This is the token architecture used deliberately — the same mechanism the
 * theme switch uses, applied to a subtree.
 */
const darkPanelTokens: React.CSSProperties = {
  "--color-surface-card": "#141414",
  "--color-surface-alt": "#0B0B0B",
  "--color-surface-page": "#0B0B0B",
  "--color-text-primary": "#FFFFFF",
  "--color-text-secondary": "#9AA0A0",
  "--color-border-subtle": "#242424",
  "--color-border-strong": "#3A3A3A",
  "--color-mist": "#1B2321",
  "--color-mist-strong": "#24302C",
  "--color-hairline": "#242424",
  "--color-chip-neutral-bg": "#D9F84F",
  "--color-chip-neutral-fg": "#0B0B0B",
  "--shadow-float": "0 24px 60px rgb(0 0 0 / 0.55)",
} as React.CSSProperties;

/** Delay before hover opens a menu — long enough to cross a link without opening it. */
const OPEN_DELAY = 70;
/** Grace before hover closes one, so the diagonal to the panel is forgiven. */
const CLOSE_DELAY = 300;

/**
 * The site header.
 *
 * MENUS OPEN ON HOVER WITH A DELAY IN BOTH DIRECTIONS: 70ms to open, so passing
 * the cursor across the bar does not flash three panels, and 300ms to close, so
 * the diagonal towards a panel does not lose it. Click still works, and Escape
 * always closes.
 *
 * Moving between two open menus slides the panel across rather than dropping it
 * again — the bar stays one surface whose contents change.
 */
export function Navbar({
  brand = "Halo",
  logo,
  links = [],
  activeHref,
  action,
  onAction,
  theme = "dark",
  compact = false,
  onNavigate,
  mobileFooter,
  menuLabel = "Open menu",
  className,
}: NavbarProps) {
  const dark = theme === "dark";

  const [open, setOpen] = React.useState<string | null>(null);
  const [burger, setBurger] = React.useState(false);
  const [anchor, setAnchor] = React.useState(0);
  const [swap, setSwap] = React.useState<"left" | "right" | null>(null);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggers = React.useRef<Record<string, HTMLSpanElement | null>>({});
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const previous = React.useRef<{ label: string | null; left: number }>({ label: null, left: 0 });

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /**
   * The panel hangs under the link that opened it, nudged back inside the bar
   * when it would overflow the right edge.
   */
  const place = React.useCallback((label: string) => {
    const trigger = triggers.current[label];
    const root = rootRef.current;
    if (!trigger || !root) return;

    const left = trigger.getBoundingClientRect().left - root.getBoundingClientRect().left;
    const panelWidth = panelRef.current?.offsetWidth ?? 0;
    const next = panelWidth
      ? Math.max(0, Math.min(left, root.offsetWidth - panelWidth))
      : left;

    const from = previous.current;
    // Only slide when moving between two menus, not on a first open.
    setSwap(from.label && from.label !== label ? (next >= from.left ? "right" : "left") : null);
    previous.current = { label, left: next };
    setAnchor(next);
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    place(open);

    const onResize = () => place(open);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, place]);

  const enter = (label: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(label), OPEN_DELAY);
  };

  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen(null);
      previous.current = { label: null, left: 0 };
    }, CLOSE_DELAY);
  };

  const go = (href: string | undefined) => {
    setOpen(null);
    setBurger(false);
    onNavigate?.(href);
  };

  const openLink = links.find((link) => link.label === open && link.menu);
  const menu = openLink?.menu;

  return (
    <div ref={rootRef} className={cn("relative", className)} onMouseLeave={leave}>
      <nav
        className={cn(
          "flex items-center gap-8 bg-transparent font-sans",
          compact ? "h-16" : "h-20",
          dark ? "text-paper" : "text-ink",
        )}
      >
        <Logo
          src={logo}
          wordmark={brand}
          theme={dark ? "dark" : "light"}
          height={compact ? 24 : 28}
          onClick={() => go("#")}
          className="shrink-0"
        />

        {/* Hidden below 900px, where the burger takes over. */}
        <div className="mx-auto hidden items-center gap-8 min-[900px]:flex">
          {links.map((link) => {
            const hasMenu = Boolean(link.menu);
            const active = link.href === activeHref || (hasMenu && open === link.label);

            return (
              <span
                key={link.label}
                ref={(element) => {
                  triggers.current[link.label] = element;
                }}
                onMouseEnter={() => (hasMenu ? enter(link.label) : leave())}
                className="relative inline-flex"
              >
                <a
                  href={link.href ?? "#"}
                  aria-haspopup={hasMenu || undefined}
                  aria-expanded={hasMenu ? open === link.label : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    if (hasMenu) {
                      setOpen(open === link.label ? null : link.label);
                      return;
                    }
                    go(link.href);
                  }}
                  className={cn(
                    "relative inline-flex items-center gap-1.25 pb-2 text-body-s no-underline",
                    "transition-colors duration-[140ms] ease-standard",
                    active
                      ? dark
                        ? "text-paper"
                        : "text-ink"
                      : dark
                        ? "text-text-muted-dark"
                        : "text-text-muted-light",
                  )}
                >
                  {link.label}

                  {hasMenu ? (
                    <span
                      className={cn(
                        "inline-flex transition-transform duration-[200ms] ease-standard",
                        open === link.label && "rotate-180",
                      )}
                    >
                      <Icon name="chevron-down" size={14} />
                    </span>
                  ) : null}

                  {/* The accent underline is the active-navigation state — one
                      of the four places the accent belongs. It stops short of
                      the chevron so it underlines the word, not the control. */}
                  {link.href === activeHref ? (
                    <span
                      className={cn("absolute bottom-0 left-0 h-0.5 bg-accent", hasMenu ? "right-[19px]" : "right-0")}
                    />
                  ) : null}
                </a>
              </span>
            );
          })}
        </div>

        {action ? (
          <span className="ml-auto inline-flex shrink-0 items-center gap-2 min-[900px]:ml-0">
            <Button variant="primary" size={compact ? "sm" : "md"} onClick={onAction}>
              {action}
            </Button>

            <button
              type="button"
              aria-label={menuLabel}
              onClick={() => setBurger(true)}
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-pill border-none halo-focus min-[900px]:hidden",
                dark ? "bg-white/10 text-paper" : "bg-mist text-ink",
              )}
            >
              <Icon name="menu" size={20} />
            </button>
          </span>
        ) : null}
      </nav>

      {openLink && menu ? (
        <div
          ref={panelRef}
          onMouseEnter={() => {
            if (timer.current) clearTimeout(timer.current);
          }}
          onMouseLeave={leave}
          className="absolute top-full z-90"
          style={{
            left: menu.align === "full" ? 0 : menu.align === "center" ? "50%" : anchor,
            right: menu.align === "full" ? 0 : undefined,
            transform: menu.align === "center" ? "translateX(-50%)" : undefined,
            animation: swap
              ? `halo-nav-swap-${swap} 240ms var(--ease-standard) both`
              : "halo-nav-panel 160ms var(--ease-standard) both",
            transition: "left 260ms var(--ease-standard)",
            ...(dark ? darkPanelTokens : null),
          }}
        >
          {menu.kind === "list" ? (
            <MenuDropdown
              items={menu.items ?? []}
              footer={menu.footer}
              width={menu.width}
              onNavigate={go}
              onClose={() => setOpen(null)}
            />
          ) : (
            <MegaMenu
              columns={menu.columns}
              media={menu.media}
              right={menu.right}
              footer={menu.footer}
              width={menu.align === "full" ? "100%" : menu.width}
              onNavigate={go}
            />
          )}
        </div>
      ) : null}

      <MobileNav
        open={burger}
        onClose={() => setBurger(false)}
        brand={brand}
        logo={logo}
        links={links as NavItem[]}
        action={action}
        onAction={onAction}
        activeHref={activeHref}
        onNavigate={go}
        footer={mobileFooter}
      />
    </div>
  );
}
