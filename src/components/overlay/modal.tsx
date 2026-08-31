import * as React from "react";
import { cn } from "../../lib/cn";
import { useOverlay, useScrollEdges } from "../../lib/use-overlay";
import { HoldButton } from "../core/hold-button";
import { Icon, type IconName } from "../core/icon";
import { OverlayAction, useOverlayAction, type OverlayPhase } from "./overlay-action";
import {
  OverlayFooter,
  OverlayHeader,
  OverlaySecondaryButton,
  overlayWidths,
  surfaceClassName,
  veilClassName,
  type OverlaySize,
  type OverlayTone,
} from "./overlay-chrome";

export interface ModalProps {
  open?: boolean;
  onClose?: () => void;

  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: IconName;
  tone?: OverlayTone;

  size?: OverlaySize;
  /** Overrides the size preset, in px. */
  width?: number;
  children?: React.ReactNode;

  /** Replaces the whole footer. */
  footer?: React.ReactNode;
  /** Sits at the far left of the default footer. */
  footerLeft?: React.ReactNode;

  primaryLabel?: React.ReactNode;
  /** Resolving `false` or throwing shows the error state. */
  onPrimary?: () => unknown | Promise<unknown>;
  doneLabel?: React.ReactNode;
  secondaryLabel?: React.ReactNode;
  onSecondary?: () => void;

  /** Requires a press-and-hold instead of a click. For irreversible actions. */
  hold?: boolean;
  holdLabel?: string;
  holdDuration?: number;

  /** False for a dialog that must be answered: no Escape, no backdrop click. */
  dismissible?: boolean;
  showClose?: boolean;
  counter?: boolean;

  /** Drives the phase from outside, for specimen sheets. */
  phase?: OverlayPhase;
  errorMessage?: string | null;
  /** Renders the panel in place, with no veil — for embedding in a page. */
  inline?: boolean;
  id?: string;
  className?: string;
}

/**
 * The system's dialog.
 *
 * THE PRIMARY ACTION CARRIES THE REQUEST rather than the caller closing the
 * dialog themselves: a spinner while it runs, a drawn tick before it closes, an
 * error message inside the panel if it fails. A dialog that closes optimistically
 * and surfaces the failure as a toast makes the user hunt for what went wrong.
 *
 * Header and footer rules appear only once the body actually scrolls under
 * them, so a short dialog has no lines in it at all.
 */
export function Modal({
  open = false,
  onClose,
  title,
  subtitle,
  icon,
  tone = "neutral",
  size = "md",
  width,
  children,
  footer,
  footerLeft,
  primaryLabel,
  onPrimary,
  doneLabel,
  secondaryLabel = "Cancel",
  onSecondary,
  hold = false,
  holdLabel = "Hold to confirm",
  holdDuration = 1600,
  dismissible = true,
  showClose = true,
  counter = false,
  phase: forcedPhase,
  errorMessage: forcedError,
  inline = false,
  id,
  className,
}: ModalProps) {
  const { mounted, closing, panelRef } = useOverlay({
    open: inline ? false : open,
    onClose,
    closeOnEsc: dismissible,
  });

  const bodyRef = React.useRef<HTMLDivElement>(null);
  const { edges, onScroll } = useScrollEdges(bodyRef, [open, children]);

  const { phase, message, run, reset } = useOverlayAction({ onAction: onPrimary, onClose });

  // A dialog reopened after a failure must not still be showing the old error.
  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const shownPhase = forcedPhase ?? phase;
  const shownMessage = forcedError !== undefined ? forcedError : message;
  const resolvedWidth = width ?? overlayWidths[size];
  const pad = counter ? "px-7" : "px-8";

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-label={typeof title === "string" ? title : undefined}
      tabIndex={-1}
      id={id}
      className={cn(
        "flex flex-col overflow-hidden rounded-panel font-sans outline-none",
        surfaceClassName,
        inline ? "w-full max-h-none" : "max-h-[min(86vh,780px)]",
        className,
      )}
      style={{
        width: inline ? "100%" : `min(${resolvedWidth}px, 100%)`,
        maxWidth: inline ? resolvedWidth : undefined,
        animation: inline
          ? "none"
          : closing
            ? "halo-overlay-out 200ms cubic-bezier(.4,0,1,1) both"
            : shownPhase === "error"
              ? "halo-shake 460ms var(--ease-standard) 1"
              : "halo-overlay-in 420ms cubic-bezier(.16,1,.3,1) both",
      }}
    >
      <OverlayHeader
        title={title}
        subtitle={subtitle}
        icon={icon ? <Icon name={icon} size={20} /> : undefined}
        tone={tone}
        onClose={onClose}
        showClose={showClose && dismissible}
        scrolled={edges.top}
        counter={counter}
      />

      {children ? (
        <div
          ref={bodyRef}
          onScroll={onScroll}
          className={cn(
            "flex-1 overflow-y-auto pb-6 text-text-primary",
            pad,
            counter ? "text-[16px]" : "text-body",
          )}
        >
          {children}
        </div>
      ) : null}

      {shownMessage ? (
        <div
          role="alert"
          className={cn(
            "mb-4 flex items-center gap-2.5 rounded-chip bg-error-soft px-3.5 py-2.5 text-body-s text-error",
            counter ? "mx-7" : "mx-8",
          )}
          style={{ animation: "halo-rise 240ms cubic-bezier(.16,1,.3,1) both" }}
        >
          <Icon name="circle-alert" size={16} />
          {shownMessage}
        </div>
      ) : null}

      {footer !== undefined ? (
        footer
      ) : primaryLabel || secondaryLabel ? (
        <OverlayFooter scrolled={edges.bottom} counter={counter}>
          {footerLeft}
          <span className="flex-1" />

          {secondaryLabel ? (
            <OverlaySecondaryButton
              counter={counter}
              disabled={shownPhase === "pending"}
              onClick={() => (onSecondary ? onSecondary() : onClose?.())}
            >
              {secondaryLabel}
            </OverlaySecondaryButton>
          ) : null}

          {hold ? (
            <HoldButton
              size={counter ? "counter" : "md"}
              duration={holdDuration}
              onConfirm={() => void run()}
              doneLabel={doneLabel ?? "Confirmed."}
            >
              {holdLabel}
            </HoldButton>
          ) : primaryLabel ? (
            <OverlayAction
              label={primaryLabel}
              doneLabel={doneLabel}
              tone={tone}
              phase={shownPhase}
              counter={counter}
              onClick={() => void run()}
            />
          ) : null}
        </OverlayFooter>
      ) : null}
    </div>
  );

  if (inline) return panel;
  if (!mounted) return null;

  return (
    <div
      role="presentation"
      // mousedown on the veil itself, not a click anywhere inside: a drag that
      // starts in the panel and ends on the backdrop must not dismiss.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose?.();
      }}
      className={cn(veilClassName, "grid place-items-center p-6")}
      style={{
        animation: closing
          ? "halo-veil-out 180ms linear both"
          : "halo-veil-in 260ms cubic-bezier(.16,1,.3,1) both",
      }}
    >
      {panel}
    </div>
  );
}
