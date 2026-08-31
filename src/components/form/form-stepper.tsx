import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../core/icon";

export interface FormStep {
  label: string;
  /** A line of explanation. Vertical orientation only — horizontal has no room. */
  hint?: string;
}

export interface FormStepperProps {
  steps: FormStep[];
  /** 0-indexed. */
  current?: number;
  /** Omit to make the rail purely indicative. */
  onStepClick?: (index: number) => void;
  orientation?: "vertical" | "horizontal";
  showCount?: boolean;
  countLabel?: (current: number, total: number) => string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Where the user is in a multi-step form, and how much is left.
 *
 * ONLY COMPLETED STEPS ARE CLICKABLE. Jumping forward past an incomplete step
 * lands the user on a screen that cannot validate, so the rail simply refuses
 * — going back to change an answer is always allowed.
 *
 * The count line is not decoration: "Step 2 of 5" is the only thing that tells
 * someone how much of their afternoon this will take.
 */
export function FormStepper({
  steps,
  current = 0,
  onStepClick,
  orientation = "vertical",
  showCount = true,
  countLabel = (index, total) => `Step ${index} of ${total}`,
  ariaLabel = "Steps",
  className,
}: FormStepperProps) {
  const vertical = orientation === "vertical";

  return (
    <nav aria-label={ariaLabel} className={cn("font-sans", className)}>
      {showCount ? (
        <p className="m-0 mb-4 text-body-s tabular-nums text-text-secondary">
          {countLabel(Math.min(current + 1, steps.length), steps.length)}
        </p>
      ) : null}

      <ol
        className={cn(
          "m-0 flex list-none p-0",
          vertical ? "flex-col items-stretch" : "flex-row items-center",
        )}
      >
        {steps.map((step, index) => {
          const done = index < current;
          const on = index === current;
          const reachable = done && Boolean(onStepClick);
          const last = index === steps.length - 1;

          return (
            <li
              key={step.label}
              className={cn(
                "flex min-w-0",
                vertical ? "flex-col items-stretch" : "flex-row items-center",
                vertical || last ? "flex-none" : "flex-1",
              )}
            >
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onStepClick?.(index)}
                aria-current={on ? "step" : undefined}
                className={cn(
                  "flex min-w-0 gap-2.5 border-none bg-transparent text-left halo-focus",
                  vertical ? "w-full items-start py-2.5" : "w-auto items-center",
                  reachable ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full",
                    "text-[13px] font-medium tabular-nums",
                    "transition-colors duration-[220ms] ease-standard",
                    done
                      ? "border-none bg-accent text-accent-ink"
                      : on
                        ? "border-none bg-text-primary text-surface-page"
                        : "border border-border-subtle bg-transparent text-text-secondary",
                  )}
                >
                  {done ? <Icon name="check" size={15} /> : index + 1}
                </span>

                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "text-body-s",
                      on ? "font-medium" : "font-normal",
                      on || done ? "text-text-primary" : "text-text-secondary",
                      vertical ? "whitespace-normal" : "truncate",
                    )}
                  >
                    {step.label}
                  </span>
                  {vertical && step.hint ? (
                    <span className="mt-0.5 text-[12px] leading-[1.45] text-text-secondary">
                      {step.hint}
                    </span>
                  ) : null}
                </span>
              </button>

              {/* The connector is filled behind a completed step, so the rail
                  reads as a progress bar as much as a list. */}
              {last ? null : vertical ? (
                <span
                  className={cn("ml-3.5 h-3.5 w-px", done ? "bg-accent-deep" : "bg-border-subtle")}
                />
              ) : (
                <span
                  className={cn(
                    "mx-3 h-px min-w-4 flex-1",
                    done ? "bg-accent-deep" : "bg-border-subtle",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
