import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export interface MenuItem {
  label: string;
  href?: string;
  icon?: IconName;
  description?: string;
  badge?: string;
  /** A single level of nesting. See MAX_DEPTH below. */
  items?: MenuItem[];
  /** A rule above this row. */
  separated?: boolean;
  tone?: "default" | "error";
  disabled?: boolean;
}

export interface MenuDropdownProps {
  items: MenuItem[];
  footer?: React.ReactNode;
  width?: number;
  subWidth?: number;
  onNavigate?: (href: string | undefined) => void;
  onClose?: () => void;
  className?: string;
}

/**
 * HOUSE RULE: menu, then sub-menu, and that is all. A third level is a page,
 * not a flyout — nobody has ever successfully navigated one with a mouse.
 */
const MAX_DEPTH = 1;

/** The gap a flyout leaves beside its parent, and the bridge that spans it. */
const GAP = 6;

/** How long a flyout survives after the pointer leaves, to forgive a sloppy diagonal. */
const GRACE = 260;

function MenuRow({
  item,
  depth,
  subWidth,
  onNavigate,
  onClose,
}: {
  item: MenuItem;
  depth: number;
  subWidth: number;
  onNavigate?: (href: string | undefined) => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [placement, setPlacement] = React.useState<{ dx: number; dy: number } | null>(null);

  const rowRef = React.useRef<HTMLDivElement>(null);
  const flyoutRef = React.useRef<HTMLDivElement>(null);
  const graceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const children = depth < MAX_DEPTH && item.items?.length ? item.items : null;
  const width = subWidth;

  React.useEffect(
    () => () => {
      if (graceTimer.current) clearTimeout(graceTimer.current);
    },
    [],
  );

  /**
   * Placement is decided against the viewport, in order: to the right of the
   * row, else to its left, else clamped underneath. Then pulled up if the
   * bottom would leave the screen.
   *
   * Measured in a layout effect so the flyout never paints in the wrong place
   * and jumps.
   */
  React.useLayoutEffect(() => {
    if (!children || !open || !rowRef.current) return;

    const row = rowRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const flyoutHeight = flyoutRef.current?.offsetHeight ?? 0;

    let next: { dx: number; dy: number };
    if (row.right + GAP + width <= viewportWidth - 8) {
      next = { dx: 0, dy: -8 };
    } else if (row.left - GAP - width >= 8) {
      next = { dx: -(width + GAP + row.width), dy: -8 };
    } else {
      const clamped = Math.max(8, Math.min(row.left, viewportWidth - 8 - width));
      next = { dx: clamped - row.left, dy: row.height + GAP };
    }

    if (flyoutHeight) {
      const top = row.top + next.dy;
      if (top + flyoutHeight > viewportHeight - 8) {
        next.dy -= top + flyoutHeight - (viewportHeight - 8);
      }
      if (row.top + next.dy < 8) next.dy = 8 - row.top;
    }

    setPlacement((current) =>
      current && current.dx === next.dx && current.dy === next.dy ? current : next,
    );
  }, [children, open, width]);

  const enter = () => {
    if (graceTimer.current) clearTimeout(graceTimer.current);
    if (children) setOpen(true);
  };

  const leave = () => {
    if (!children) return;
    // Forgiving: a diagonal towards the flyout crosses the gap and briefly
    // leaves both elements. Closing instantly would make sub-menus unusable.
    graceTimer.current = setTimeout(() => setOpen(false), GRACE);
  };

  return (
    <div ref={rowRef} className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      {item.separated ? <span className="my-1.5 block h-px bg-hairline" /> : null}

      <a
        href={item.href ?? "#"}
        aria-haspopup={children ? "menu" : undefined}
        aria-expanded={children ? open : undefined}
        aria-disabled={item.disabled || undefined}
        onClick={(event) => {
          if (item.disabled) {
            event.preventDefault();
            return;
          }
          if (children) {
            event.preventDefault();
            setOpen((value) => !value);
            return;
          }
          if (onNavigate) {
            event.preventDefault();
            onNavigate(item.href);
          }
          onClose?.();
        }}
        className={cn(
          "flex items-center gap-3 rounded-chip px-3 py-2 font-sans no-underline",
          "transition-colors duration-[120ms] ease-out halo-focus",
          item.disabled
            ? "cursor-not-allowed text-text-secondary opacity-50"
            : cn(
                "hover:bg-mist",
                item.tone === "error" ? "text-error" : "text-text-primary",
              ),
        )}
      >
        {item.icon ? (
          <span className="inline-flex shrink-0 text-text-secondary">
            <Icon name={item.icon} size={17} />
          </span>
        ) : null}

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-s">{item.label}</span>
          {item.description ? (
            <span className="truncate text-[12px] text-text-secondary">{item.description}</span>
          ) : null}
        </span>

        {item.badge ? (
          <span className="inline-flex h-4.5 shrink-0 items-center rounded-pill bg-accent px-1.75 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-accent-ink">
            {item.badge}
          </span>
        ) : null}

        {children ? (
          <span className="inline-flex shrink-0 text-text-secondary">
            <Icon name="chevron-right" size={15} />
          </span>
        ) : null}
      </a>

      {children && open ? (
        <>
          {/* An invisible bridge across the gap, so the pointer never crosses
              dead space between the row and its flyout. */}
          <span
            aria-hidden="true"
            className="absolute top-0 h-full"
            style={{ left: "100%", width: GAP }}
          />

          <div
            ref={flyoutRef}
            role="menu"
            className="absolute z-50 rounded-panel border border-border-subtle bg-surface-card p-2 shadow-float"
            style={{
              left: `calc(100% + ${GAP}px + ${placement?.dx ?? 0}px)`,
              top: placement?.dy ?? -8,
              width,
              animation: "halo-menu-fly 160ms var(--ease-standard) both",
            }}
          >
            {children.map((child) => (
              <MenuRow
                key={child.label}
                item={child}
                depth={depth + 1}
                subWidth={subWidth}
                onNavigate={onNavigate}
                onClose={onClose}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * A list menu: an account menu, a row's actions, a section of a navbar.
 *
 * Sub-menus open beside their row and are forgiving to leave — a 260ms grace
 * period plus an invisible bridge across the gap, so the diagonal everyone
 * actually draws towards a flyout does not close it halfway.
 */
export function MenuDropdown({
  items,
  footer,
  width = 260,
  subWidth = 240,
  onNavigate,
  onClose,
  className,
}: MenuDropdownProps) {
  return (
    <div
      role="menu"
      className={cn(
        "box-border rounded-panel border border-border-subtle bg-surface-card p-2 shadow-float",
        className,
      )}
      style={{ width }}
    >
      {items.map((item) => (
        <MenuRow
          key={item.label}
          item={item}
          depth={0}
          subWidth={subWidth}
          onNavigate={onNavigate}
          onClose={onClose}
        />
      ))}

      {footer ? (
        <div className="mt-1.5 border-t border-hairline px-3 pb-1 pt-2.5 text-[12.5px] text-text-secondary">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
