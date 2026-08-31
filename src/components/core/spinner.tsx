import * as React from "react";
import { cn } from "../../lib/cn";

export interface SpinnerProps {
  /** Diameter in px. Inside a button, two less than the icon size. */
  size?: number;
  /** Ring colour. Inherits the button's own foreground by default. */
  color?: string;
  thickness?: number;
  className?: string;
}

/**
 * The processing state of a button. A ring with one quadrant knocked out —
 * never a dotted or pulsing spinner.
 */
export function Spinner({
  size = 16,
  color = "currentColor",
  thickness = 2,
  className,
}: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-full opacity-90", className)}
      style={{
        width: size,
        height: size,
        borderWidth: thickness,
        borderStyle: "solid",
        borderColor: color,
        borderTopColor: "transparent",
        animation: "halo-spin 700ms linear infinite",
      }}
    />
  );
}
