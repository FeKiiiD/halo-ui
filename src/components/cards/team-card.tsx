import * as React from "react";
import { cn } from "../../lib/cn";
import { Button, type ButtonProps } from "../core/button";
import { Icon } from "../core/icon";

export interface Person {
  name?: string;
  src?: string;
  /** Overrides the initials derived from the name. */
  initials?: string;
}

export interface AvatarStackProps {
  people: Person[];
  size?: "sm" | "md" | "lg";
  /** Faces shown before the rest collapse into a "+n" chip. */
  max?: number;
  /** The ring colour must match what the stack sits on, or it reads as a halo. */
  ring?: "surface" | "ink" | "mist";
  tone?: "light" | "dark";
  className?: string;
}

const avatarSizes = { sm: 26, md: 32, lg: 40 } as const;

function initialsOf(name: string | undefined): string {
  return String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * Overlapping faces.
 *
 * The ring is a box-shadow rather than a border so it does not add to the
 * element's size — the overlap maths stays exact regardless of ring width. Its
 * colour has to match the surface behind the stack; on the wrong ground it
 * reads as a glow around each face.
 *
 * z-index descends left to right so the first face sits on top, which is the
 * order the eye reads them in.
 */
export function AvatarStack({
  people,
  size = "md",
  max = 4,
  ring = "surface",
  tone = "light",
  className,
}: AvatarStackProps) {
  const px = avatarSizes[size];
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  const ringColour =
    ring === "ink" ? "var(--color-ink)" : ring === "mist" ? "var(--color-mist)" : "var(--color-surface-card)";

  return (
    <span className={cn("inline-flex items-center", className)}>
      {shown.map((person, index) => (
        <span
          key={person.name ?? index}
          title={person.name}
          className={cn(
            "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
            "font-sans font-semibold tracking-[-0.01em]",
            person.src
              ? "bg-mist-strong"
              : tone === "dark"
                ? "bg-accent text-accent-ink"
                : "bg-chip-neutral-bg text-chip-neutral-fg",
          )}
          style={{
            width: px,
            height: px,
            marginLeft: index ? -Math.round(px * 0.28) : 0,
            zIndex: shown.length - index,
            boxShadow: `0 0 0 2px ${ringColour}`,
            fontSize: Math.round(px * 0.38),
          }}
        >
          {person.src ? (
            <img
              src={person.src}
              alt={person.name ?? ""}
              className="block size-full object-cover"
            />
          ) : (
            person.initials ?? initialsOf(person.name)
          )}
        </span>
      ))}

      {rest > 0 ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full font-sans font-medium tabular-nums",
            tone === "dark" ? "bg-white/[0.14] text-paper" : "bg-mist-strong text-text-primary",
          )}
          style={{
            width: px,
            height: px,
            marginLeft: -Math.round(px * 0.28),
            zIndex: 0,
            boxShadow: `0 0 0 2px ${ringColour}`,
            fontSize: Math.round(px * 0.34),
          }}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

export interface TeamCardCta {
  label: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
}

export interface TeamCardProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;

  people?: Person[];
  max?: number;
  size?: AvatarStackProps["size"];
  /** A line beside the stack: "and 4 others". */
  caption?: React.ReactNode;

  /** The dashed add button at the end of the row. */
  action?: { label: string; onClick?: () => void };
  cta?: TeamCardCta;
  inverted?: boolean;
  className?: string;
}

/**
 * Who is on something: a team, a shift, a shared programme.
 *
 * The add button is dashed rather than solid — it is an empty slot inviting
 * someone in, not an action competing with the card's own call to action.
 */
export function TeamCard({
  eyebrow,
  title,
  body,
  people = [],
  max = 4,
  size = "md",
  caption,
  action,
  cta,
  inverted = false,
  className,
}: TeamCardProps) {
  const primary = inverted ? "text-paper" : "text-text-primary";
  const muted = inverted ? "text-text-muted-dark" : "text-text-secondary";

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-card p-card font-sans",
        inverted ? "bg-ink" : "bg-surface-card",
        className,
      )}
    >
      {eyebrow ? (
        <span
          className={cn(
            "text-[12px] font-semibold uppercase tracking-[0.08em]",
            inverted ? "text-accent" : "text-text-secondary",
          )}
        >
          {eyebrow}
        </span>
      ) : null}

      <span className={cn("max-w-[20ch] text-heading-s", primary)}>{title}</span>

      {body ? (
        <span className={cn("text-pretty text-body-s leading-[var(--lh-body-s)]", muted)}>
          {body}
        </span>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-4">
        <AvatarStack
          people={people}
          max={max}
          size={size}
          tone={inverted ? "dark" : "light"}
          ring={inverted ? "ink" : "surface"}
        />

        {caption ? <span className={cn("text-[13px]", muted)}>{caption}</span> : null}

        {action ? (
          <span className="ml-auto">
            <button
              type="button"
              onClick={action.onClick}
              aria-label={action.label}
              className={cn(
                "inline-flex size-8.5 items-center justify-center rounded-full border border-dashed bg-transparent halo-focus",
                inverted ? "border-[#2E2E2E]" : "border-border-subtle",
                primary,
              )}
            >
              <Icon name="plus" size={16} />
            </button>
          </span>
        ) : null}
      </div>

      {cta ? (
        <div className="mt-2">
          <Button
            variant={cta.variant ?? (inverted ? "primary" : "secondary")}
            size="sm"
            onDark={inverted && cta.variant !== "primary"}
            onClick={cta.onClick}
          >
            {cta.label}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
