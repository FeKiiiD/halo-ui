import * as React from "react";
import { cn } from "../../lib/cn";
import { useOverlay, useScrollEdges } from "../../lib/use-overlay";
import { Icon, type IconName } from "../core/icon";
import { surfaceClassName, veilClassName } from "./overlay-chrome";

export interface DrawerTab {
  value: string;
  label: React.ReactNode;
}

export interface DrawerProps {
  open?: boolean;
  onClose?: () => void;

  side?: "right" | "left";
  /** In px. Capped at the viewport width on a narrow screen. */
  width?: number;

  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: IconName;

  children?: React.ReactNode;
  footer?: React.ReactNode;

  tabs?: DrawerTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;

  dismissible?: boolean;
  /** Renders in place with no veil — for a specimen sheet or a docked panel. */
  inline?: boolean;
  closeLabel?: string;
  className?: string;
}

/**
 * A side panel for work that keeps its context: a record's detail, a filter
 * set, a long form the user should not lose their place in.
 *
 * WHY NOT A MODAL: a drawer leaves the page visible beside it, so the row being
 * edited stays on screen. That is the whole reason to reach for one — if the
 * context does not matter, a modal is simpler and more focused.
 *
 * It rounds only on the inner edge, so it reads as attached to the side of the
 * window rather than floating.
 */
export function Drawer({
  open = false,
  onClose,
  side = "right",
  width = 460,
  title,
  subtitle,
  icon,
  children,
  footer,
  tabs,
  activeTab,
  onTabChange,
  dismissible = true,
  inline = false,
  closeLabel = "Close",
  className,
}: DrawerProps) {
  const { mounted, closing, panelRef } = useOverlay({
    open: inline ? false : open,
    onClose,
    closeOnEsc: dismissible,
    duration: 260,
  });

  const bodyRef = React.useRef<HTMLDivElement>(null);
  const { edges, onScroll } = useScrollEdges(bodyRef, [open, children, activeTab]);

  const animation = closing
    ? `halo-drawer-${side}-out 240ms cubic-bezier(.4,0,1,1) both`
    : `halo-drawer-${side}-in 380ms cubic-bezier(.16,1,.3,1) both`;

  const panel = (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-label={typeof title === "string" ? title : undefined}
      tabIndex={-1}
      className={cn(
        "flex flex-col overflow-hidden border-none font-sans outline-none",
        surfaceClassName,
        inline
          ? "h-[420px] w-full rounded-panel"
          : side === "right"
            ? "h-full rounded-l-panel"
            : "h-full rounded-r-panel",
        className,
      )}
      style={{
        width: inline ? "100%" : `min(${width}px, 100%)`,
        maxWidth: inline ? width : undefined,
        animation: inline ? "none" : animation,
      }}
    >
      <div className="flex items-start gap-4 p-6 pb-4">
        {icon ? (
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-chip bg-chip-neutral-bg text-chip-neutral-fg">
            <Icon name={icon} size={20} />
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[20px] font-semibold leading-[1.2] tracking-[-0.01em] text-text-primary">
            {title}
          </h2>
          {subtitle ? (
            <p className="m-0 mt-1.5 text-body-s text-text-secondary">{subtitle}</p>
          ) : null}
        </div>

        {dismissible && onClose ? (
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border-none bg-transparent text-text-secondary transition-colors duration-[140ms] ease-out hover:bg-mist halo-focus"
          >
            <Icon name="x" size={18} />
          </button>
        ) : null}
      </div>

      {tabs?.length ? (
        <div role="tablist" className="flex gap-6 border-b border-border-subtle px-6">
          {tabs.map((tab) => {
            const on = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={on}
                type="button"
                onClick={() => onTabChange?.(tab.value)}
                className={cn(
                  "relative border-none bg-transparent pb-2.5 font-sans text-body-s halo-focus",
                  on ? "font-medium text-text-primary" : "font-normal text-text-secondary",
                )}
              >
                {tab.label}
                {/* The accent underline is the active-navigation state — one of
                    the four places the accent belongs. */}
                <span
                  className={cn(
                    "absolute inset-x-0 -bottom-px h-0.5 rounded-sm transition-colors duration-[160ms] ease-out",
                    on ? "bg-accent" : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        ref={bodyRef}
        onScroll={onScroll}
        className={cn(
          "flex flex-1 flex-col gap-4 overflow-y-auto border-t p-6 text-body text-text-primary",
          "transition-colors duration-[160ms] ease-out",
          edges.top ? "border-border-subtle" : "border-transparent",
        )}
      >
        {children}
      </div>

      {footer ? (
        <div
          className={cn(
            "flex items-center justify-end gap-3 border-t px-6 pb-6 pt-4",
            "transition-colors duration-[160ms] ease-out",
            edges.bottom ? "border-border-subtle" : "border-transparent",
          )}
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );

  if (inline) return panel;
  if (!mounted) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose?.();
      }}
      className={cn(
        veilClassName,
        "flex",
        side === "right" ? "justify-end" : "justify-start",
      )}
      style={{
        animation: closing
          ? "halo-veil-out 200ms linear both"
          : "halo-veil-in 260ms cubic-bezier(.16,1,.3,1) both",
      }}
    >
      {panel}
    </div>
  );
}
