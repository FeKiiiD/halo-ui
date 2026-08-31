import * as React from "react";
import { cn } from "../../lib/cn";
import type { VerdictPhase } from "../../lib/use-async-verdict";

export type ActionButtonSize = "md" | "counter";
export type ActionButtonVariant = "primary" | "secondary";

export const actionSizing: Record<
  ActionButtonSize,
  { box: string; text: string; icon: number; square: string }
> = {
  md: { box: "h-12 px-control-px", text: "text-button", icon: 20, square: "w-12" },
  counter: { box: "h-14 px-9", text: "text-[17px]", icon: 22, square: "w-14" },
};

export interface ActionButtonShellProps {
  phase: VerdictPhase;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  /** Stops a label swap from resizing the button mid-choreography. */
  minWidth?: number;
  /** Overrides the pill — the only reason is embedding in a segmented control. */
  radius?: string;
  className?: string;
  children: React.ReactNode;
  /** Accessible name when there is no visible label. */
  label?: string;
}

/**
 * The chrome every choreographed button shares: the pill, the phase colours,
 * the shake on error, and the busy/locked semantics. Each button supplies only
 * its own glyph animation.
 *
 * THE PHASE PALETTE, which is the same in all of them:
 * - busy keeps the idle fill; the glyph carries the motion, not the button
 * - success flips to the accent, ink text — this is one of the four places
 *   the accent is allowed
 * - error goes to the soft error tint with error text, and shakes once
 */
export const ActionButtonShell = React.forwardRef<HTMLButtonElement, ActionButtonShellProps & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function ActionButtonShell(
    {
      phase,
      variant = "secondary",
      size = "md",
      disabled = false,
      fullWidth = false,
      iconOnly = false,
      minWidth,
      radius,
      className,
      children,
      label,
      ...rest
    },
    ref,
  ) {
    const g = actionSizing[size];
    const idle = phase === "idle";
    const busy = phase === "busy";

    const fill = disabled
      ? "bg-surface-disabled text-text-secondary"
      : phase === "error"
        ? "bg-error-soft text-error"
        : phase === "success"
          ? "bg-accent text-accent-ink"
          : variant === "primary"
            ? cn("bg-accent text-accent-ink", idle && "hover:bg-accent-deep")
            : cn("bg-ink text-paper", idle && "hover:bg-ink-hairline");

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || !idle}
        aria-busy={busy}
        // The label changes as the phase advances, so it has to be announced.
        aria-live="polite"
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
          "font-sans font-medium leading-[1] halo-focus",
          "transition-[background-color,color] duration-[180ms] ease-standard",
          "disabled:cursor-not-allowed",
          busy && "cursor-progress",
          !idle && !busy && "cursor-default",
          g.box,
          g.text,
          iconOnly ? cn("px-0", g.square) : fullWidth && "flex w-full",
          fill,
          className,
        )}
        style={{
          borderRadius: radius ?? "var(--radius-pill)",
          ...(iconOnly || fullWidth ? null : { minWidth }),
          ...(phase === "error"
            ? { animation: "halo-shake 460ms var(--ease-standard) 1" }
            : null),
        }}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

/** The drawn tick shown on success, shared by every choreographed button. */
export function VerdictCheck({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 10.6 8 14.5 16 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 26,
          strokeDashoffset: 26,
          animation: "halo-draw 340ms var(--ease-standard) 120ms forwards",
        }}
      />
    </svg>
  );
}

/** The drawn cross shown on error. Two strokes, the second trailing by 140ms. */
export function VerdictCross({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5.5 5.5 14.5 14.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        style={{
          strokeDasharray: 14,
          strokeDashoffset: 14,
          animation: "halo-draw 200ms var(--ease-standard) forwards",
        }}
      />
      <path
        d="M14.5 5.5 5.5 14.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        style={{
          strokeDasharray: 14,
          strokeDashoffset: 14,
          animation: "halo-draw 200ms var(--ease-standard) 140ms forwards",
        }}
      />
    </svg>
  );
}

/** Wraps the verdict content in its pop-in. */
export function VerdictBody({
  children,
  duration = 320,
}: {
  children: React.ReactNode;
  duration?: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{ animation: `halo-pop ${duration}ms var(--ease-standard) both` }}
    >
      {children}
    </span>
  );
}

export interface ConfettiPiece {
  dx: number;
  dy: number;
  rotate: string;
  color: string;
}

/**
 * The burst that marks a genuine win. Each particle carries its own trajectory
 * as custom properties, which is what lets one keyframe serve the whole burst.
 *
 * Reserved for moments that deserve it — a reward credited, a message sent —
 * never for an ordinary save.
 */
export function Confetti({ pieces }: { pieces: ConfettiPiece[] }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className={cn(
            "absolute left-1/2 top-1/2",
            index % 4 === 0 ? "rounded-full" : "rounded-[1px]",
          )}
          style={
            {
              width: index % 3 === 0 ? 4 : 6,
              height: index % 3 === 0 ? 8 : 4,
              background: piece.color,
              "--dx": `${piece.dx}px`,
              "--dy": `${piece.dy}px`,
              "--r": piece.rotate,
              animation: `halo-spark ${620 + index * 26}ms var(--ease-standard) ${index * 18}ms forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
