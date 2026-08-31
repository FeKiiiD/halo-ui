import * as React from "react";
import { cn } from "../../lib/cn";
import { Button, type ButtonProps } from "../core/button";
import { Icon } from "../core/icon";

export interface MediaCardCta {
  label: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
}

export interface MediaCardProps {
  kind?: "image" | "video";
  src?: string;
  /** Names what belongs in the frame when no `src` is given. */
  placeholder?: string;
  /** Shown on the play pill: "2 min". */
  duration?: string;

  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  meta?: React.ReactNode;
  tags?: string[];
  cta?: MediaCardCta;

  /** `top` stacks, `side` puts the thumb left, `overlay` writes over it. */
  layout?: "top" | "side" | "overlay";
  ratio?: string;

  href?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * The frame. No photography ships with the system, so a card without a `src`
 * renders a mist block naming what belongs there — an honest gap rather than
 * invented artwork or a broken image icon.
 */
function Thumb({
  kind,
  src,
  placeholder,
  duration,
  ratio,
  rounded,
}: {
  kind: "image" | "video";
  src?: string;
  placeholder?: string;
  duration?: string;
  ratio: string;
  rounded: boolean;
}) {
  const video = kind === "video";

  return (
    <span
      className={cn(
        "relative block overflow-hidden bg-mist-strong text-text-secondary",
        rounded ? "rounded-[14px]" : "rounded-none",
      )}
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          // A slow, small zoom on hover — the one scale transform in the
          // system, and only on imagery, where it reads as depth rather than
          // as a control moving.
          className="block size-full object-cover transition-transform duration-[340ms] ease-standard group-hover:scale-[1.035]"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center gap-2 p-3 text-center font-sans text-[12.5px]">
          <Icon name={video ? "clapperboard" : "image"} size={16} />
          {placeholder ?? (video ? "Video to supply" : "Image to supply")}
        </span>
      )}

      {video ? (
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-3 inline-flex h-8.5 items-center gap-1.75 rounded-pill bg-accent py-0 pl-2.5 pr-3.25 font-sans text-[12.5px] font-medium text-accent-ink transition-transform duration-[200ms] ease-standard group-hover:-translate-y-0.5"
        >
          <Icon name="play" size={14} />
          {duration ?? "Play"}
        </span>
      ) : null}
    </span>
  );
}

/**
 * A card built around an image or a video.
 *
 * The overlay layout writes over the image behind a bottom-up gradient, which
 * is the only place in the system where text sits on imagery — and the reason
 * the gradient reaches 94% opacity at the foot rather than stopping at a
 * decorative 60%.
 */
export function MediaCard({
  kind = "image",
  src,
  placeholder,
  duration,
  eyebrow,
  title,
  body,
  meta,
  tags,
  cta,
  layout = "top",
  ratio = "16 / 10",
  href,
  onClick,
  className,
}: MediaCardProps) {
  const overlay = layout === "overlay";
  const side = layout === "side";
  const Tag = (href ? "a" : "article") as "a";

  return (
    <Tag
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex overflow-hidden rounded-card font-sans no-underline",
        side ? "flex-row items-center" : "flex-col items-stretch",
        overlay ? "gap-0 bg-ink p-0" : "gap-4 bg-surface-card p-4",
        (href || onClick) && "cursor-pointer",
        className,
      )}
    >
      <span className={cn("block", side ? "basis-2/5" : "flex-none")}>
        <Thumb
          kind={kind}
          src={src}
          placeholder={placeholder}
          duration={duration}
          ratio={overlay ? "4 / 3" : ratio}
          rounded={!overlay}
        />
      </span>

      <span
        // The overlay gradient is written as a style rather than utilities:
        // three stops with explicit positions is one declaration, and Tailwind
        // needs four classes to say the same thing less clearly.
        style={
          overlay
            ? {
                backgroundImage:
                  "linear-gradient(to top, rgb(11 11 11 / 0.94) 0%, rgb(11 11 11 / 0.74) 58%, rgb(11 11 11 / 0) 100%)",
              }
            : undefined
        }
        className={cn(
          "flex min-w-0 flex-col gap-1.5",
          overlay
            ? "absolute inset-x-0 bottom-0 p-6"
            : side
              ? "static pr-2"
              : "static px-2 pb-2",
        )}
      >
        {eyebrow ? (
          <span
            className={cn(
              "text-[11.5px] font-semibold uppercase tracking-[0.08em]",
              overlay ? "text-accent" : "text-text-secondary",
            )}
          >
            {eyebrow}
          </span>
        ) : null}

        <span className={cn("text-heading-s", overlay ? "text-paper" : "text-text-primary")}>
          {title}
        </span>

        {body ? (
          <span
            className={cn(
              "text-pretty text-body-s leading-[var(--lh-body-s)]",
              overlay ? "text-text-muted-dark" : "text-text-secondary",
            )}
          >
            {body}
          </span>
        ) : null}

        {tags?.length ? (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex h-6 items-center rounded-pill px-2.5 text-[12px] font-medium",
                  overlay ? "bg-white/[0.14] text-paper" : "bg-mist text-text-primary",
                )}
              >
                {tag}
              </span>
            ))}
          </span>
        ) : null}

        {meta ? (
          <span
            className={cn(
              "mt-0.5 text-[12.5px]",
              overlay ? "text-text-muted-dark" : "text-text-secondary",
            )}
          >
            {meta}
          </span>
        ) : null}

        {cta ? (
          <span className="mt-4">
            <Button
              variant={cta.variant ?? (overlay ? "primary" : "texted")}
              size="sm"
              onDark={overlay}
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
