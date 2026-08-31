import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Icon, type IconName } from "../core/icon";
import { Modal } from "./modal";
import { OverlayAction, useOverlayAction, type OverlayPhase } from "./overlay-action";
import { OverlaySecondaryButton, type OverlaySize } from "./overlay-chrome";

export interface DialogStep {
  label: string;
  /** Replaces the dialog's title while this step is showing. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  content?: React.ReactNode;
}

export interface StepDialogProps {
  open?: boolean;
  onClose?: () => void;
  /** Fired on the last step. Resolving `false` or throwing keeps it open. */
  onFinish?: () => unknown | Promise<unknown>;

  steps: DialogStep[];
  /** Controlled step index. Omit and the dialog tracks its own. */
  step?: number;
  onStepChange?: (step: number) => void;

  title?: React.ReactNode;
  icon?: IconName;
  size?: OverlaySize;

  finishLabel?: string;
  doneLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  cancelLabel?: string;
  countLabel?: (current: number, total: number) => string;

  /** Blocks the next button while the current step is incomplete. */
  canContinue?: boolean;
  inline?: boolean;
  phase?: OverlayPhase;
}

/**
 * A short wizard in a dialog: three or four steps, always visible, always
 * reversible.
 *
 * THE RAIL IS ALWAYS SHOWN because the point of splitting a form into steps is
 * to tell the user how much is left. A wizard that hides its own length is
 * worse than one long form.
 *
 * Back on the first step is Cancel — there is nowhere further back, and a
 * disabled button in that position is a dead end the user has to work out.
 */
export function StepDialog({
  open = false,
  onClose,
  onFinish,
  steps,
  step,
  onStepChange,
  title,
  icon = "list-checks",
  size = "lg",
  finishLabel = "Finish",
  doneLabel = "Done.",
  nextLabel = "Continue",
  backLabel = "Back",
  cancelLabel = "Cancel",
  countLabel = (current, total) => `Step ${current} of ${total}`,
  canContinue = true,
  inline = false,
  phase: forcedPhase,
}: StepDialogProps) {
  const [index, setIndex] = useControllableState({
    value: step,
    defaultValue: 0,
    onChange: onStepChange,
  });

  const { phase, message, run, reset } = useOverlayAction({ onAction: onFinish, onClose });

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const current = steps[index];
  const isLast = index === steps.length - 1;
  const shownPhase = forcedPhase ?? phase;

  const rail = (
    <ol className="m-0 mb-6 flex list-none items-center p-0">
      {steps.map((entry, position) => {
        const done = position < index;
        const on = position === index;
        const last = position === steps.length - 1;

        return (
          <li
            key={entry.label}
            className={cn("flex min-w-0 items-center", last ? "flex-none" : "flex-1")}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-6.5 shrink-0 items-center justify-center rounded-full",
                  "text-[13px] font-medium tabular-nums",
                  "transition-colors duration-[220ms] ease-standard",
                  done
                    ? "border-none bg-accent text-accent-ink"
                    : on
                      ? "border-none bg-text-primary text-surface-page"
                      : "border border-border-subtle bg-surface-alt text-text-secondary",
                )}
              >
                {done ? <Icon name="check" size={14} /> : position + 1}
              </span>
              <span
                className={cn(
                  "truncate text-[13px]",
                  on ? "font-medium text-text-primary" : "font-normal text-text-secondary",
                )}
              >
                {entry.label}
              </span>
            </span>

            {last ? null : (
              <span
                className={cn(
                  "mx-3 h-px min-w-4 flex-1 transition-colors duration-[220ms] ease-standard",
                  done ? "bg-accent-deep" : "bg-border-subtle",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );

  const footer = (
    <div className="flex items-center gap-3 px-8 pb-8 pt-4">
      <span className="text-body-s tabular-nums text-text-secondary">
        {countLabel(index + 1, steps.length)}
      </span>
      <span className="flex-1" />

      <OverlaySecondaryButton
        disabled={shownPhase === "pending"}
        onClick={() => (index === 0 ? onClose?.() : setIndex(index - 1))}
      >
        {index === 0 ? cancelLabel : backLabel}
      </OverlaySecondaryButton>

      {isLast ? (
        <OverlayAction
          label={finishLabel}
          doneLabel={doneLabel}
          phase={shownPhase}
          disabled={!canContinue}
          onClick={() => void run()}
        />
      ) : (
        <OverlayAction
          label={nextLabel}
          disabled={!canContinue}
          onClick={() => setIndex(index + 1)}
        />
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      inline={inline}
      icon={icon}
      size={size}
      title={current?.title ?? title ?? current?.label ?? ""}
      subtitle={current?.subtitle}
      footer={footer}
      errorMessage={message}
      phase={shownPhase}
    >
      {rail}
      {/* Keyed on the index so React remounts the body and the entry animation
          replays on every step change. */}
      <div key={index} style={{ animation: "halo-step-in 260ms cubic-bezier(.16,1,.3,1) both" }}>
        {current?.content}
      </div>
    </Modal>
  );
}
