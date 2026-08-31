import * as React from "react";
import { useAsyncVerdict } from "../../lib/use-async-verdict";
import {
  ActionButtonShell,
  VerdictBody,
  VerdictCross,
  actionSizing,
  type ActionButtonSize,
  type ActionButtonVariant,
} from "./action-button-shell";

export interface SearchButtonProps {
  children?: React.ReactNode;
  searchingLabel?: string;
  /** Overrides the result-count label entirely. */
  successLabel?: string;
  errorLabel?: string;
  /**
   * Resolving a number reports it as a result count; any other truthy value
   * reports a plain completion.
   */
  onSearch?: () => unknown | Promise<unknown>;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
  className?: string;
}

/** The three lines the lens sweeps across: x, y, length. */
const lines: [number, number, number][] = [
  [5.4, 6.2, 9.2],
  [5.4, 9.4, 7.4],
  [5.4, 12.6, 8.4],
];

/**
 * Runs a search or an analysis, with a lens sweeping across lines of text and
 * magnifying each as it passes.
 *
 * The busy phase floors at 1100ms — long enough for one full sweep, because
 * half a sweep reads as a stutter.
 */
export function SearchButton({
  children = "Analyse",
  searchingLabel = "Analysing…",
  successLabel,
  errorLabel = "Search unavailable.",
  onSearch,
  variant = "secondary",
  size = "md",
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  minWidth = 220,
  className,
}: SearchButtonProps) {
  const g = actionSizing[size];
  const { phase, result, run } = useAsyncVerdict({
    onAction: onSearch,
    minBusy: 1100,
    successHold: 2400,
  });

  const busy = phase === "busy";
  const label = typeof children === "string" ? children : "Search";
  const done =
    successLabel ?? (typeof result === "number" ? `${result} results.` : "Analysis complete.");

  return (
    <ActionButtonShell
      phase={phase}
      variant={variant}
      size={size}
      disabled={disabled}
      fullWidth={fullWidth}
      iconOnly={iconOnly}
      minWidth={minWidth}
      label={label}
      onClick={() => void run()}
      className={className}
    >
      {phase === "idle" || busy ? (
        <span className="inline-flex items-center gap-2">
          <svg
            width={g.icon}
            height={g.icon}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="overflow-visible"
          >
            {/* The lines only exist while searching — at rest this is just a
                magnifier, not a document. */}
            {busy
              ? lines.map(([x, y, width], index) => (
                  <path
                    key={index}
                    d={`M${x} ${y}h${width}`}
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    style={{
                      transformOrigin: `${x}px ${y}px`,
                      animation: `halo-search-line 1200ms ease-in-out ${index * 380}ms infinite`,
                    }}
                  />
                ))
              : null}

            {/* Two nested transforms: the lens travels, and magnifies as it goes. */}
            <g
              style={{
                transformOrigin: "10px 10px",
                ...(busy ? { animation: "halo-search-sweep 1200ms ease-in-out infinite" } : null),
              }}
            >
              <g
                style={{
                  transformOrigin: "10px 10px",
                  ...(busy ? { animation: "halo-search-zoom 1200ms ease-in-out infinite" } : null),
                }}
              >
                <circle
                  cx="9.6"
                  cy="9.4"
                  r="4.4"
                  fill={busy ? "rgb(217 248 79 / 0.16)" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path d="M12.9 12.7 16.6 16.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </g>
            </g>
          </svg>
          {iconOnly ? null : <span>{busy ? searchingLabel : children}</span>}
        </span>
      ) : null}

      {/* Success draws a tick inside the lens rather than replacing it: the
          result belongs to the search, not to a generic confirmation. */}
      {phase === "success" ? (
        <VerdictBody>
          <svg width={g.icon} height={g.icon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle
              cx="9.6"
              cy="9.4"
              r="4.4"
              stroke="currentColor"
              strokeWidth="1.6"
              style={{
                strokeDasharray: 28,
                strokeDashoffset: 28,
                animation: "halo-draw 300ms var(--ease-standard) forwards",
              }}
            />
            <path
              d="M7.7 9.5 9.3 11.1 12 7.9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 12,
                strokeDashoffset: 12,
                animation: "halo-draw 240ms var(--ease-standard) 240ms forwards",
              }}
            />
            <path
              d="M12.9 12.7 16.6 16.4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              style={{
                strokeDasharray: 6,
                strokeDashoffset: 6,
                animation: "halo-draw 180ms var(--ease-standard) 400ms forwards",
              }}
            />
          </svg>
          {iconOnly ? null : done}
        </VerdictBody>
      ) : null}

      {phase === "error" ? (
        <VerdictBody duration={260}>
          <VerdictCross size={g.icon} />
          {iconOnly ? null : errorLabel}
        </VerdictBody>
      ) : null}
    </ActionButtonShell>
  );
}
