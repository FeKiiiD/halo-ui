import * as React from "react";
import { cn } from "../../lib/cn";
import { Button, type ButtonProps } from "../core/button";

export interface SpotlightCardCta {
  label: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
}

export interface SpotlightCardProps {
  icon?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  cta?: SpotlightCardCta;

  tone?: "ink" | "light";
  /** Which colour the glow is. */
  glow?: "accent" | "halo" | "paper";
  /** Glow diameter in px. */
  radius?: number;
  /** 0–1. Past about 0.4 it stops being a glow and becomes a wash. */
  intensity?: number;

  href?: string;
  onClick?: () => void;
  className?: string;
}

const glowColours = {
  accent: "217 248 79",
  halo: "59 208 126",
  paper: "255 255 255",
} as const;

/**
 * A card with a glow that follows the pointer.
 *
 * A DARK-RÉGIME DEVICE. On ink the lime glow reads as attention; on white it
 * would be mud, which is why `tone="light"` exists but is not the default.
 *
 * Three things keep it from being a gimmick: it is pointer-only (touch gets
 * nothing, since there is no hover to track), it stops entirely under
 * `prefers-reduced-motion`, and the border lifts with it so the card responds
 * as one object rather than growing a detached blob.
 */
export function SpotlightCard({
  icon,
  eyebrow,
  title,
  body,
  children,
  footer,
  cta,
  tone = "ink",
  glow = "accent",
  radius = 320,
  intensity = 0.3,
  href,
  onClick,
  className,
}: SpotlightCardProps) {
  const ref = React.useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const dark = tone !== "light";
  const Tag = (href ? "a" : "article") as "a";

  return (
    <Tag
      ref={ref}
      href={href}
      onClick={onClick}
      onPointerMove={(event) => {
        // Touch reports a position too, but there is no hover to follow — the
        // glow would stick where the finger last landed.
        if (reduced || event.pointerType === "touch" || !ref.current) return;
        const box = ref.current.getBoundingClientRect();
        setPosition({ x: event.clientX - box.left, y: event.clientY - box.top });
      }}
      onPointerLeave={() => setPosition(null)}
      className={cn(
        "relative isolate flex flex-col overflow-hidden rounded-card border p-card font-sans no-underline",
        "transition-colors duration-[260ms] ease-standard",
        dark
          ? cn("bg-ink", position ? "border-[#2E2E2E]" : "border-ink-hairline")
          : "border-border-subtle bg-surface-card",
        (href || onClick) && "cursor-pointer",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-[300ms] ease-standard"
        style={{
          opacity: position ? 1 : 0,
          background: position
            ? `radial-gradient(${radius}px circle at ${position.x}px ${position.y}px, rgb(${glowColours[glow]} / ${intensity}), rgb(${glowColours[glow]} / 0.06) 45%, transparent 70%)`
            : "transparent",
        }}
      />

      <span className="relative z-1 flex flex-col">
        {icon ? <span className="mb-6">{icon}</span> : null}

        {eyebrow ? (
          <span
            className={cn(
              "mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]",
              dark ? "text-accent" : "text-text-secondary",
            )}
          >
            {eyebrow}
          </span>
        ) : null}

        <span
          className={cn("max-w-[18ch] text-heading-s", dark ? "text-paper" : "text-text-primary")}
        >
          {title}
        </span>

        {body ? (
          <span
            className={cn(
              "mt-3 text-pretty text-body-s leading-[var(--lh-body-s)]",
              dark ? "text-text-muted-dark" : "text-text-secondary",
            )}
          >
            {body}
          </span>
        ) : null}

        {children ? <span className="mt-6 block">{children}</span> : null}

        {footer ? (
          <span
            className={cn(
              "mt-4 text-[12.5px]",
              dark ? "text-text-muted-dark" : "text-text-secondary",
            )}
          >
            {footer}
          </span>
        ) : null}

        {cta ? (
          <span className="mt-6">
            <Button
              variant={cta.variant ?? "primary"}
              size="sm"
              onDark={dark && cta.variant !== "primary"}
              onClick={cta.onClick}
            >
              {cta.label}
            </Button>
          </span>
        ) : null}
      </span>
    </Tag>
  );
}
