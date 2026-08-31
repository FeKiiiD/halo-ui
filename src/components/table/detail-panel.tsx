import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export interface DetailTab {
  value: string;
  label: string;
  icon?: IconName;
  /** A count beside the label — unread, attached, whatever the tab holds. */
  count?: number;
}

export interface DetailPanelProps {
  open?: boolean;
  onClose?: () => void;

  side?: "right" | "left";
  width?: number;

  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;

  tabs?: DetailTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;

  footer?: React.ReactNode;
  /** Floats over the table with a veil instead of sitting beside it. */
  overlay?: boolean;

  children?: React.ReactNode;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

/**
 * The row inspector.
 *
 * DOCKED BY DEFAULT, NOT OVERLAID. A detail panel exists so somebody can read
 * a row while still seeing the list it came from — comparing against its
 * neighbours is most of why they opened it. An overlay hides exactly the
 * context that makes the detail mean something, so it is available but not the
 * default.
 */
export function DetailPanel({
  open = false,
  onClose,
  side = "right",
  width = 380,
  eyebrow,
  title,
  subtitle,
  tabs = [],
  activeTab,
  onTabChange,
  footer,
  overlay = false,
  children,
  labels,
  className,
}: DetailPanelProps) {
  const text = { close: "Close", ...labels };

  React.useEffect(() => {
    if (!open || !overlay) return;

    // Escape closes only the overlay form: a docked panel is part of the page,
    // and stealing Escape from the table behind it would be wrong.
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, overlay, onClose]);

  if (!open) return null;

  const panel = (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden bg-surface-card font-sans",
        overlay
          ? "fixed inset-y-0 z-1000 shadow-float"
          : cn("border-hairline", side === "right" ? "border-l" : "border-r"),
        className,
      )}
      style={{
        width,
        maxWidth: "100vw",
        ...(overlay ? { [side]: 0 } : {}),
        animation: overlay
          ? `halo-drawer-${side}-in 240ms var(--ease-standard) both`
          : undefined,
      }}
    >
      <div className="flex items-start gap-2.5 border-b border-hairline px-4 py-3.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {eyebrow ? (
            <span className="text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
              {eyebrow}
            </span>
          ) : null}
          {title ? (
            <span className="truncate text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
              {title}
            </span>
          ) : null}
          {subtitle ? (
            <span className="truncate text-[12.5px] text-text-secondary">{subtitle}</span>
          ) : null}
        </span>

        {onClose ? (
          <button
            type="button"
            aria-label={text.close}
            title={text.close}
            onClick={onClose}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary halo-focus"
          >
            <Icon name="x" size={14} />
          </button>
        ) : null}
      </div>

      {tabs.length ? (
        <div className="flex gap-0.5 overflow-x-auto border-b border-hairline px-2 pt-2">
          {tabs.map((tab) => {
            const on = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onTabChange?.(tab.value)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2 pt-1 font-sans text-[13px] halo-focus",
                  "transition-colors duration-[140ms] ease-standard",
                  on
                    ? "border-b-ink font-medium text-text-primary"
                    : "border-b-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {tab.icon ? <Icon name={tab.icon} size={13} /> : null}
                {tab.label}
                {tab.count != null ? (
                  <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-pill bg-mist px-1.25 text-[10.5px] tabular-nums text-text-secondary">
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

      {footer ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-3">
          {footer}
        </div>
      ) : null}
    </aside>
  );

  if (!overlay) return panel;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-999 bg-veil"
        style={{ animation: "halo-veil-in 240ms var(--ease-standard) both" }}
      />
      {panel}
    </>
  );
}

export interface PanelFieldProps {
  label: React.ReactNode;
  children: React.ReactNode;
  /** Label above the value instead of beside it, for long content. */
  stacked?: boolean;
}

/** One labelled value inside a detail panel. */
export function PanelField({ label, children, stacked = false }: PanelFieldProps) {
  return (
    <div
      className={cn(
        "font-sans",
        stacked ? "flex flex-col gap-1" : "grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] items-baseline gap-3",
      )}
    >
      <span className="text-[12.5px] text-text-secondary">{label}</span>
      <span className="min-w-0 text-[13.5px] text-text-primary">{children}</span>
    </div>
  );
}

export interface PanelSectionProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  gap?: number;
}

/** A titled group of fields. */
export function PanelSection({ title, children, gap = 10 }: PanelSectionProps) {
  return (
    <section className="flex flex-col font-sans" style={{ gap }}>
      {title ? (
        <span className="text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
          {title}
        </span>
      ) : null}
      {children}
    </section>
  );
}

/** Lays a table and its docked panel side by side. */
export function PanelLayout({
  side = "right",
  gap = 0,
  children,
}: {
  side?: "right" | "left";
  gap?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex min-w-0 items-stretch", side === "left" && "flex-row-reverse")}
      style={{ gap }}
    >
      {children}
    </div>
  );
}
