import * as React from "react";
import { cn } from "../../lib/cn";
import type { IconName } from "../core/icon";
import { Modal } from "./modal";
import type { OverlayPhase } from "./overlay-action";
import type { OverlayTone } from "./overlay-chrome";

export interface ConfirmDialogProps {
  open?: boolean;
  onClose?: () => void;
  /** Resolving `false` or throwing keeps the dialog open and shows the error. */
  onConfirm?: () => unknown | Promise<unknown>;

  title?: React.ReactNode;
  /** The question itself, as the subtitle. */
  question?: React.ReactNode;
  /** A paragraph of context, when the question needs it. */
  detail?: React.ReactNode;
  /** What will happen, as a list. Tinted red on a destructive dialog. */
  consequences?: string[];

  confirmLabel?: string;
  cancelLabel?: string;
  doneLabel?: React.ReactNode;

  tone?: OverlayTone;
  icon?: IconName;

  hold?: boolean;
  holdLabel?: string;
  holdDuration?: number;

  counter?: boolean;
  phase?: OverlayPhase;
  errorMessage?: string | null;
  inline?: boolean;
}

/**
 * One question and two buttons. Anything longer belongs in a Modal.
 *
 * NO CLOSE BUTTON: a confirmation has exactly two answers, and a third way out
 * in the corner makes the question feel optional. Escape and the backdrop still
 * cancel, which is the same answer as the cancel button.
 *
 * Use `hold` for anything irreversible — deleting a programme, refunding a
 * transaction. The gesture is the point: a hold cannot be triggered by a
 * mis-click on a dialog that appeared under the cursor.
 */
export function ConfirmDialog({
  open = false,
  onClose,
  onConfirm,
  title = "Confirm this action.",
  question,
  detail,
  consequences,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  doneLabel,
  tone = "neutral",
  icon,
  hold = false,
  holdLabel,
  holdDuration = 1600,
  counter = false,
  phase,
  errorMessage,
  inline = false,
}: ConfirmDialogProps) {
  const glyph: IconName =
    icon ??
    (tone === "destructive"
      ? "triangle-alert"
      : tone === "success"
        ? "circle-check"
        : "circle-help");

  const hasBody = Boolean(detail || consequences?.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      inline={inline}
      icon={glyph}
      tone={tone}
      size="sm"
      title={title}
      subtitle={question}
      primaryLabel={hold ? undefined : confirmLabel}
      doneLabel={doneLabel}
      secondaryLabel={cancelLabel}
      onPrimary={onConfirm}
      hold={hold}
      holdLabel={holdLabel ?? `Hold to ${confirmLabel.toLowerCase()}`}
      holdDuration={holdDuration}
      counter={counter}
      phase={phase}
      errorMessage={errorMessage}
      showClose={false}
    >
      {hasBody ? (
        <div className="flex flex-col gap-3">
          {detail ? (
            <p
              className={cn(
                "m-0 text-pretty leading-[1.55] text-text-secondary",
                counter ? "text-[16px]" : "text-body-s",
              )}
            >
              {detail}
            </p>
          ) : null}

          {consequences?.length ? (
            <ul
              className={cn(
                "m-0 flex list-none flex-col gap-2 rounded-chip p-4",
                tone === "destructive"
                  ? "bg-error-soft text-error"
                  : "bg-surface-alt text-text-primary",
              )}
            >
              {consequences.map((line) => (
                <li key={line} className="flex gap-2.5 text-body-s leading-[1.45]">
                  {/* A square rather than a disc: the system has no bulleted
                      lists, and a square reads as a marker rather than as
                      decoration. */}
                  <span
                    aria-hidden="true"
                    className="mt-1.75 size-1.5 shrink-0 rounded-[1px] bg-current"
                  />
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
