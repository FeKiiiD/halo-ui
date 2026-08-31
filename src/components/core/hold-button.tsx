import * as React from "react";
import { cn } from "../../lib/cn";
import { useHold } from "../../lib/use-hold";
import { playSuccess } from "../../lib/feedback-sound";
import { actionSizing, type ActionButtonSize } from "./action-button-shell";

export interface HoldButtonProps {
  children?: React.ReactNode;
  /** Shown while the press is being held. Defaults to the idle label. */
  holdingLabel?: React.ReactNode;
  doneLabel?: React.ReactNode;
  /** How long the press must be held, in ms. */
  duration?: number;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconLeft?: React.ReactNode;
  onConfirm?: () => void;
  className?: string;
}

/**
 * Press and hold to confirm — the gesture for anything irreversible, and for
 * anything triggered at a counter where a stray tap is likely.
 *
 * The accent fills the button left to right as the press is held. Releasing
 * early retracts it over 180ms, which is deliberately visible: an accidental
 * release should look like a cancellation, not a glitch.
 *
 * The label flips to ink past the halfway mark, when the fill has covered
 * enough of the button that white text would start to disappear into it.
 */
export function HoldButton({
  children = "Hold to confirm",
  holdingLabel,
  doneLabel = "Confirmed.",
  duration = 1200,
  size = "md",
  disabled = false,
  fullWidth = false,
  iconLeft,
  onConfirm,
  className,
}: HoldButtonProps) {
  const g = actionSizing[size];
  const [done, setDone] = React.useState(false);

  const { progress, handlers } = useHold({
    duration,
    disabled: disabled || done,
    onComplete: () => {
      playSuccess();
      setDone(true);
      onConfirm?.();
    },
  });

  React.useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(id);
  }, [done]);

  const filled = done ? 1 : progress;
  const label = done ? doneLabel : filled > 0 ? (holdingLabel ?? children) : children;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={typeof children === "string" ? children : undefined}
      {...handlers}
      className={cn(
        "relative isolate inline-flex items-center justify-center gap-2 overflow-hidden",
        "font-sans font-medium leading-[1] whitespace-nowrap halo-focus rounded-pill",
        "select-none touch-none transition-colors duration-[120ms] ease-standard",
        "disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:text-text-secondary",
        !disabled && "bg-ink",
        // Past the midpoint the fill is under the text, so the label inverts.
        !disabled && (filled > 0.52 ? "text-ink" : "text-paper"),
        done ? "cursor-default" : filled > 0 ? "cursor-grabbing" : "cursor-pointer",
        g.box,
        g.text,
        fullWidth && "flex w-full",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-0 -z-10 origin-left", done ? "bg-accent" : "bg-accent-deep")}
        style={{
          transform: `scaleX(${filled})`,
          // Only animate the retraction: during the hold the transform is
          // already driven frame by frame, and a transition would lag it.
          transition: filled === 0 ? "transform var(--dur-base) var(--ease-standard)" : "none",
        }}
      />
      {iconLeft}
      {label}
    </button>
  );
}
