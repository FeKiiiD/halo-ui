import * as React from "react";
import { cn } from "../../lib/cn";

export interface BlobProps {
  /** Diameter in px. The system uses 360–480. */
  size?: number;
  /** Any CSS colour. Defaults to the sunken surface so it follows the theme. */
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A flat circle sitting behind a product visual, usually partly off-canvas.
 *
 * Flat is the whole point: no border, no shadow, no gradient. It is absolutely
 * positioned at z-0, so the parent needs `relative` and the content above it
 * needs a stacking context of its own. Position it with `className`.
 */
export function Blob({ size = 420, color, className, style }: BlobProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-0 rounded-full",
        !color && "bg-surface-sunken",
        className,
      )}
      style={{ width: size, height: size, ...(color ? { background: color } : null), ...style }}
    />
  );
}
