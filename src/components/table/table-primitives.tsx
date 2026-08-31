import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export type TableDensity = "compact" | "regular" | "comfy" | "counter";

export const densities: Record<
  TableDensity,
  { row: number; padding: string; fontSize: number; head: number }
> = {
  compact: { row: 36, padding: "0 10px", fontSize: 13, head: 32 },
  regular: { row: 48, padding: "0 14px", fontSize: 14, head: 40 },
  comfy: { row: 60, padding: "0 18px", fontSize: 15, head: 44 },
  // The counter row is 68px: a target that can be hit while standing.
  counter: { row: 68, padding: "0 20px", fontSize: 17, head: 48 },
};

export interface PopoverProps {
  anchor: React.RefObject<HTMLElement | null>;
  align?: "left" | "right";
  width?: number;
  children: React.ReactNode;
}

/**
 * A menu that escapes the table's own overflow.
 *
 * WHY A PORTAL: a table with `maxHeight` scrolls, which means `overflow`, which
 * clips any absolutely positioned child. Rendering into `document.body` at the
 * trigger's measured rect is the only way a row menu can hang below the last
 * visible row.
 *
 * Position is re-read on scroll and resize — with capture on scroll, so a
 * scrolling ancestor moves it too, not just the window.
 */
export function Popover({ anchor, align = "right", width, children }: PopoverProps) {
  const [box, setBox] = React.useState<{ top: number; left: number; right: number } | null>(null);

  React.useLayoutEffect(() => {
    const element = anchor.current;
    if (!element) return;

    const place = () => {
      const rect = element.getBoundingClientRect();
      setBox({
        top: rect.bottom + 4,
        left: rect.left,
        right: window.innerWidth - rect.right,
      });
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor]);

  if (!box || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed z-900 rounded-panel border border-border-subtle bg-surface-card p-1.5 shadow-float"
      style={{
        top: box.top,
        left: align === "left" ? box.left : undefined,
        right: align === "right" ? box.right : undefined,
        minWidth: width ?? 190,
        transformOrigin: align === "right" ? "top right" : "top left",
        animation: "halo-panel-in 120ms ease-out both",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export interface TableCheckboxProps {
  state: boolean | "mixed";
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * The selection box in a table.
 *
 * Its own component rather than the form Checkbox: this one has to report
 * `mixed` for a partial selection, and it sits inside a clickable row, so every
 * event has to stop propagating.
 */
export function TableCheckbox({ state, onChange, disabled, label }: TableCheckboxProps) {
  const on = state === true;
  const mixed = state === "mixed";

  return (
    <span
      role="checkbox"
      aria-checked={mixed ? "mixed" : on}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onChange?.(!on);
      }}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onChange?.(!on);
      }}
      className={cn(
        "inline-flex size-4.5 shrink-0 items-center justify-center rounded-[5px] halo-focus",
        "text-surface-page transition-colors duration-[120ms] ease-out",
        on || mixed ? "border-none bg-text-primary" : "border-[1.5px] border-border-strong bg-transparent",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
      )}
    >
      {on ? <Icon name="check" size={12} /> : mixed ? <Icon name="minus" size={12} /> : null}
    </span>
  );
}

export interface MenuAction<T = unknown> {
  label: string;
  icon?: IconName;
  onClick?: (row: T) => void;
  disabled?: boolean;
  tone?: "default" | "error";
}

/** One row in a table popover menu. */
export function MenuRow({
  label,
  icon,
  onClick,
  disabled,
  tone,
  active,
  height = 36,
}: {
  label: string;
  icon?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "error";
  active?: boolean;
  height?: number;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "flex w-full items-center gap-2.25 rounded-[9px] border-none px-2.5 text-left font-sans text-[14px]",
        "transition-colors duration-[120ms] ease-out hover:bg-surface-alt halo-focus",
        active ? "bg-surface-alt font-semibold" : "bg-transparent",
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
        tone === "error" ? "text-error" : "text-text-primary",
      )}
      style={{ height }}
    >
      {icon ? <Icon name={icon} size={15} /> : null}
      {label}
    </button>
  );
}

/**
 * Closes a popover on an outside press or Escape.
 *
 * The hit-test looks for `[role=menu]` rather than a ref, because the menu is
 * in a portal and is therefore not a DOM descendant of its trigger.
 */
export function useMenuDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  React.useEffect(() => {
    if (!open) return;

    const away = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.("[role=menu]")) onCloseRef.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
}

/** A shimmering bar standing in for a cell's content while loading. */
export function SkeletonCell({ width }: { width: number | string }) {
  return <span className="block h-2.5 rounded-[5px] bg-shimmer" style={{ width }} />;
}
