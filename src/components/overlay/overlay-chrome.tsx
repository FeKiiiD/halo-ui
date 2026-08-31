import * as React from "react";
import { cn } from "../../lib/cn";

export type OverlayTone = "neutral" | "destructive" | "success" | "info";
export type OverlaySize = "sm" | "md" | "lg" | "xl";

export const overlayWidths: Record<OverlaySize, number> = {
  sm: 420,
  md: 520,
  lg: 720,
  xl: 920,
};

/**
 * Tone drives the header chip and the primary action.
 *
 * DESTRUCTIVE LEAVES THE ACCENT ALONE. A delete confirmation whose primary
 * button is lime reads as the encouraged path — exactly the wrong signal on
 * the one action that cannot be undone. Success and info keep the accent
 * because their primary action is the one to take.
 */
export const overlayTones: Record<
  OverlayTone,
  { chip: string; action: string; actionHover: string }
> = {
  neutral: {
    chip: "bg-chip-neutral-bg text-chip-neutral-fg",
    action: "bg-accent text-accent-ink",
    actionHover: "hover:bg-accent-deep",
  },
  destructive: {
    chip: "bg-error-soft text-error",
    action: "bg-error text-paper",
    actionHover: "hover:bg-[#B9243B]",
  },
  success: {
    chip: "bg-success-soft text-success",
    action: "bg-accent text-accent-ink",
    actionHover: "hover:bg-accent-deep",
  },
  info: {
    chip: "bg-info-soft text-info",
    action: "bg-accent text-accent-ink",
    actionHover: "hover:bg-accent-deep",
  },
};

/**
 * The backdrop. 42% ink with a 6px blur — enough to push the page back without
 * hiding what the dialog is about, which matters when a confirmation refers to
 * a row still visible behind it.
 */
export const veilClassName =
  "fixed inset-0 z-900 bg-[rgb(11_11_11/0.42)] backdrop-blur-[6px]";

/** The panel surface, shared by every overlay shape. */
export const surfaceClassName =
  "border border-border-subtle bg-surface-card text-text-primary shadow-float";

export interface OverlayHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: OverlayTone;
  onClose?: () => void;
  showClose?: boolean;
  /** Draws the separating rule only once something is scrolled under it. */
  scrolled?: boolean;
  /** Counter-mode proportions. */
  counter?: boolean;
  closeLabel?: string;
  className?: string;
}

export function OverlayHeader({
  title,
  subtitle,
  icon,
  tone = "neutral",
  onClose,
  showClose = true,
  scrolled = false,
  counter = false,
  closeLabel = "Close",
  className,
}: OverlayHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 border-b transition-colors duration-[160ms] ease-out",
        counter ? "p-7" : "p-8",
        subtitle ? "pb-4" : "pb-6",
        scrolled ? "border-border-subtle" : "border-transparent",
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-chip",
            overlayTones[tone].chip,
          )}
        >
          {icon}
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <h2
          className={cn(
            "m-0 text-pretty font-semibold leading-[1.15] tracking-[-0.02em] text-text-primary",
            counter ? "text-[26px]" : "text-[22px]",
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            className={cn(
              "m-0 mt-2 text-pretty leading-[1.5] text-text-secondary",
              counter ? "text-[16px]" : "text-body-s",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {showClose && onClose ? (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="-mr-1.5 -mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border-none bg-transparent text-text-secondary transition-colors duration-[140ms] ease-out hover:bg-mist halo-focus"
        >
          <CloseGlyph />
        </button>
      ) : null}
    </div>
  );
}

function CloseGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface OverlayFooterProps {
  children: React.ReactNode;
  /** Draws the rule only when something remains scrolled below. */
  scrolled?: boolean;
  counter?: boolean;
  className?: string;
}

export function OverlayFooter({
  children,
  scrolled = false,
  counter = false,
  className,
}: OverlayFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t pt-4 transition-colors duration-[160ms] ease-out",
        counter ? "p-7" : "p-8",
        scrolled ? "border-border-subtle" : "border-transparent",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The outlined dismiss button every overlay footer uses. */
export function OverlaySecondaryButton({
  children,
  onClick,
  disabled,
  counter = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  counter?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-pill border-[1.5px] border-border-subtle bg-transparent px-5.5 font-sans font-medium",
        "text-text-primary transition-colors duration-[140ms] ease-out hover:bg-mist halo-focus",
        "disabled:cursor-not-allowed disabled:opacity-60",
        counter ? "h-14 text-[17px]" : "h-11 text-[15px]",
      )}
    >
      {children}
    </button>
  );
}
