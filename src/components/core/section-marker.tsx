import * as React from "react";
import { cn } from "../../lib/cn";

export interface SectionMarkerProps {
  className?: string;
}

/**
 * A dot and a dash above a section eyebrow. Purely decorative punctuation —
 * it inherits `currentColor`, so it takes the eyebrow's colour and needs no
 * configuration.
 */
export function SectionMarker({ className }: SectionMarkerProps) {
  return (
    <span aria-hidden="true" className={cn("mb-4 flex items-center gap-2", className)}>
      <span className="size-1.5 bg-current" />
      <span className="h-[1.5px] w-[18px] bg-current" />
    </span>
  );
}
