import * as React from "react";
import { cn } from "../../lib/cn";
import { useOverlay } from "../../lib/use-overlay";
import { Button, type ButtonProps } from "../core/button";
import { OverlayAction, useOverlayAction } from "./overlay-action";
import {
  OverlaySecondaryButton,
  surfaceClassName,
  veilClassName,
  type OverlayTone,
} from "./overlay-chrome";

export interface ModalButtonProps {
  /** The trigger's label. */
  children?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Replaces the description with arbitrary content. */
  body?: React.ReactNode;

  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => unknown | Promise<unknown>;

  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  tone?: OverlayTone;
  disabled?: boolean;
  width?: number;
  className?: string;
}

/**
 * A button that opens its own dialog, and the dialog grows out of the button.
 *
 * THE GROWTH IS THE POINT. A dialog that fades in at the centre of the screen
 * leaves the user to work out where it came from; one that travels from the
 * control they just pressed answers that before it is asked. The offset is
 * measured at open time — `--tx` and `--ty` carry the distance from the trigger
 * to the viewport centre — and the blur resolving as it lands is what makes the
 * movement read as focus rather than as a zoom.
 *
 * For anything that does not own its own trigger, use `Modal` directly.
 */
export function ModalButton({
  children = "Open",
  title,
  description,
  body,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "primary",
  size = "md",
  tone = "neutral",
  disabled = false,
  width = 460,
  className,
}: ModalButtonProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [origin, setOrigin] = React.useState({ tx: "0px", ty: "0px" });

  const close = React.useCallback(() => setOpen(false), []);
  const { mounted, closing, panelRef } = useOverlay({ open, onClose: close, duration: 240 });
  const { phase, message, run, reset } = useOverlayAction({ onAction: onConfirm, onClose: close });

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Measured in a layout effect: the offset has to be known before the first
  // painted frame, or the panel starts its travel from the wrong place.
  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const box = triggerRef.current.getBoundingClientRect();
    setOrigin({
      tx: `${Math.round(box.left + box.width / 2 - window.innerWidth / 2)}px`,
      ty: `${Math.round(box.top + box.height / 2 - window.innerHeight / 2)}px`,
    });
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={className}
      >
        {children}
      </Button>

      {mounted ? (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          className={cn(veilClassName, "grid place-items-center p-6")}
          style={{
            animation: closing
              ? "halo-veil-out 220ms linear both"
              : "halo-veil-in 420ms cubic-bezier(.16,1,.3,1) both",
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            tabIndex={-1}
            className={cn("rounded-panel p-8 font-sans outline-none", surfaceClassName)}
            style={
              {
                width: `min(${width}px, 100%)`,
                "--tx": origin.tx,
                "--ty": origin.ty,
                willChange: "transform, filter",
                animation: closing
                  ? "halo-dialog-out 240ms cubic-bezier(.4,0,1,1) both"
                  : "halo-dialog-in 620ms cubic-bezier(.16,1,.3,1) both",
              } as React.CSSProperties
            }
          >
            {/* The contents arrive after the panel, in reading order, so the
                dialog assembles rather than appearing all at once. */}
            <h2
              className="m-0 text-heading-m"
              style={
                closing
                  ? undefined
                  : { animation: "halo-rise 460ms cubic-bezier(.16,1,.3,1) 90ms both" }
              }
            >
              {title}
            </h2>

            <div
              className="mt-4"
              style={
                closing
                  ? undefined
                  : { animation: "halo-rise 460ms cubic-bezier(.16,1,.3,1) 150ms both" }
              }
            >
              {body ?? (
                <p className="m-0 text-pretty text-body text-text-secondary">{description}</p>
              )}
            </div>

            {message ? (
              <div
                role="alert"
                className="mt-4 rounded-chip bg-error-soft px-3.5 py-2.5 text-body-s text-error"
              >
                {message}
              </div>
            ) : null}

            <div
              className="mt-8 flex justify-end gap-3"
              style={
                closing
                  ? undefined
                  : { animation: "halo-rise 460ms cubic-bezier(.16,1,.3,1) 215ms both" }
              }
            >
              <OverlaySecondaryButton onClick={close} disabled={phase === "pending"}>
                {cancelLabel}
              </OverlaySecondaryButton>
              <OverlayAction
                label={confirmLabel}
                tone={tone}
                phase={phase}
                onClick={() => void run()}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
