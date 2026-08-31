import * as React from "react";
import { cn } from "../../lib/cn";
import { useOverlay } from "../../lib/use-overlay";
import { Icon, type IconName } from "../core/icon";
import { surfaceClassName, veilClassName } from "./overlay-chrome";

export interface BottomSheetProps {
  open?: boolean;
  onClose?: () => void;

  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: IconName;

  children?: React.ReactNode;
  /** Stacked full-width buttons. At a counter, side-by-side targets are misses. */
  actions?: React.ReactNode;

  height?: string;
  maxHeight?: string;
  /** The grab bar. Also enables flick-to-dismiss. */
  handle?: boolean;
  dismissible?: boolean;
  inline?: boolean;
  className?: string;
}

/** How far the sheet must be dragged before releasing dismisses it. */
const DISMISS_THRESHOLD = 90;

/**
 * The counter-mode overlay: the user is standing, one hand on a tablet.
 *
 * IT RISES FROM THE BOTTOM because that is where the thumb is. A centred dialog
 * on a tablet held at waist height puts its buttons where nobody can reach them
 * without shifting grip.
 *
 * The sheet can be flicked away — dragged down past 90px and released. That is
 * the gesture people already know, and it costs nothing to support: the same
 * pointer handlers serve mouse and touch.
 *
 * Actions are stacked full-width, and the footer clears the home indicator via
 * `env(safe-area-inset-bottom)`.
 */
export function BottomSheet({
  open = false,
  onClose,
  title,
  subtitle,
  icon,
  children,
  actions,
  height = "auto",
  maxHeight = "78vh",
  handle = true,
  dismissible = true,
  inline = false,
  className,
}: BottomSheetProps) {
  const { mounted, closing, panelRef } = useOverlay({
    open: inline ? false : open,
    onClose,
    closeOnEsc: dismissible,
    duration: 260,
  });

  const [drag, setDrag] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const startY = React.useRef<number | null>(null);
  const distance = React.useRef(0);

  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  const begin = (clientY: number) => {
    if (!handle || !dismissible) return;
    startY.current = clientY;
    distance.current = 0;
    setDragging(true);
  };

  // Downward only: dragging up would let the sheet leave the top of the screen.
  const moveTo = React.useCallback((clientY: number) => {
    if (startY.current === null) return;
    distance.current = Math.max(0, clientY - startY.current);
    setDrag(distance.current);
  }, []);

  const release = React.useCallback(() => {
    if (startY.current === null) return;
    const travelled = distance.current;
    startY.current = null;
    setDragging(false);
    setDrag(0);
    if (travelled > DISMISS_THRESHOLD) onCloseRef.current?.();
  }, []);

  // A mouse drag continues outside the sheet, so the listeners have to live on
  // the window rather than the panel.
  React.useEffect(() => {
    if (!dragging) return;

    const onMove = (event: MouseEvent) => moveTo(event.clientY);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", release);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", release);
    };
  }, [dragging, moveTo, release]);

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-label={typeof title === "string" ? title : undefined}
      tabIndex={-1}
      onTouchStart={(event) => begin(event.touches[0]!.clientY)}
      onTouchMove={(event) => moveTo(event.touches[0]!.clientY)}
      onTouchEnd={release}
      className={cn(
        "flex w-full flex-col overflow-hidden border-none font-sans outline-none",
        surfaceClassName,
        // Rounded at the top only when docked to the bottom edge; all four
        // corners when inline, where it is a floating card.
        inline ? "max-w-[520px] rounded-[28px]" : "max-w-[720px] rounded-t-[28px]",
        className,
      )}
      style={{
        height,
        maxHeight: inline ? "none" : maxHeight,
        transform: drag ? `translateY(${drag}px)` : undefined,
        // No transition while dragging: the sheet must track the finger exactly.
        transition: dragging ? "none" : "transform 260ms cubic-bezier(.16,1,.3,1)",
        animation: inline
          ? "none"
          : closing
            ? "halo-sheet-out 240ms cubic-bezier(.4,0,1,1) both"
            : "halo-sheet-in 400ms cubic-bezier(.16,1,.3,1) both",
      }}
    >
      {handle ? (
        <div
          onMouseDown={(event) => begin(event.clientY)}
          className={cn(
            "grid shrink-0 place-items-center pb-1 pt-3",
            dismissible ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          )}
        >
          <span className="h-1.25 w-11 rounded-pill bg-border-subtle" />
        </div>
      ) : null}

      <div className="flex items-center gap-4 px-7 py-4">
        {icon ? (
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-chip bg-accent text-accent-ink">
            <Icon name={icon} size={24} />
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[26px] font-semibold leading-[1.12] tracking-[-0.02em] text-text-primary">
            {title}
          </h2>
          {subtitle ? (
            <p className="m-0 mt-1.5 text-[16px] text-text-secondary">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {children ? (
        <div className="flex-1 overflow-y-auto px-7 pb-4 text-[16px] text-text-primary">
          {children}
        </div>
      ) : null}

      {actions ? (
        <div
          className="flex flex-col gap-3 px-7 pt-4"
          // Clears the home indicator on a phone; zero everywhere else.
          style={{ paddingBottom: "calc(var(--space-6) + env(safe-area-inset-bottom, 0px))" }}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );

  if (inline) return panel;
  if (!mounted) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose?.();
      }}
      className={cn(veilClassName, "flex items-end justify-center")}
      style={{
        animation: closing
          ? "halo-veil-out 200ms linear both"
          : "halo-veil-in 240ms cubic-bezier(.16,1,.3,1) both",
      }}
    >
      {panel}
    </div>
  );
}
