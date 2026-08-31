import * as React from "react";
import { cn } from "../../lib/cn";

export interface LogoBandProps {
  intro?: React.ReactNode;
  /** Customer names as type. See the note below on why not logos. */
  names?: string[];
  /** Real artwork, when it exists. Takes precedence over `names`. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The proof band under a hero: who already uses this.
 *
 * NAMES AS TYPE, NOT LOGOS, by default. A row of mismatched customer logos —
 * different weights, different colours, some with taglines — is the untidiest
 * thing on a landing page, and half of them will be too low-resolution. Set in
 * one weight at one size they read as a list, which is what they are.
 *
 * Pass `children` when you do have consistent artwork.
 */
export function LogoBand({ intro, names = [], children, className }: LogoBandProps) {
  return (
    <div className={cn("bg-surface-page px-page py-16 font-sans", className)}>
      {intro ? (
        <p className="m-0 mb-8 text-center text-body leading-[var(--lh-body)] text-text-secondary">
          {intro}
        </p>
      ) : null}

      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-8">
        {children ??
          names.map((name) => (
            <span
              key={name}
              // 75% opacity rather than a lighter colour: the names recede
              // without being a different ink from everything else on the page.
              className="flex h-6 items-center text-[17px] font-semibold tracking-[-0.02em] text-text-primary opacity-75"
            >
              {name}
            </span>
          ))}
      </div>
    </div>
  );
}
