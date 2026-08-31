import * as React from "react";
import { cn } from "../../lib/cn";

export interface MatrixFrameProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A count or summary, at the far right of the header. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Notes under the body: gaps, warnings, a legend. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Removes the body padding, for a matrix that draws its own grid. */
  bare?: boolean;
  className?: string;
}

/**
 * The shell the strategy matrices share: a titled card with a hairline under
 * the header.
 *
 * These are analysis tools rather than product UI — a SWOT, a RACI, a BCG grid.
 * They appear inside a document or a report, which is why they carry a border
 * and a title rather than sitting on the page like a card.
 */
export function MatrixFrame({
  title,
  subtitle,
  meta,
  actions,
  footer,
  children,
  bare = false,
  className,
}: MatrixFrameProps) {
  const hasHeader = Boolean(title || subtitle || meta || actions);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-3.5">
          <span className="mr-auto flex min-w-0 flex-col">
            {title ? (
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
                {title}
              </span>
            ) : null}
            {subtitle ? (
              <span className="text-[13px] text-text-secondary">{subtitle}</span>
            ) : null}
          </span>

          {meta ? (
            <span className="text-[13px] tabular-nums text-text-secondary">{meta}</span>
          ) : null}
          {actions ? <span className="inline-flex items-center gap-2">{actions}</span> : null}
        </div>
      ) : null}

      <div className={bare ? undefined : "p-4"}>{children}</div>

      {footer ? (
        <div className="border-t border-hairline bg-surface-alt px-4 py-3">{footer}</div>
      ) : null}
    </div>
  );
}

/** First letters of the first two words: "Marie Dupont" → "MD". */
export function initialsOf(name: string | undefined): string {
  return (name || "?")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

export interface MatrixAvatarProps {
  name?: string;
  src?: string;
  size?: number;
  className?: string;
}

/** A person in a matrix header or cell. */
export function MatrixAvatar({ name, src, size = 28, className }: MatrixAvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        // Not text-ink: mist-strong follows the theme and goes dark, so a
        // fixed dark ink left every avatar unreadable in the dark régime.
        "bg-surface-sunken font-semibold text-text-primary",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.41) }}
    >
      {src ? (
        <img src={src} alt="" width={size} height={size} className="block object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
