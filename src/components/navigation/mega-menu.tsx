import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export interface MegaMedia {
  kind?: "image" | "video";
  src?: string;
  placeholder?: string;
  duration?: string;
  title?: string;
  meta?: string;
  href?: string;
}

export interface MegaItem {
  label: string;
  href?: string;
  icon?: IconName;
  description?: string;
  badge?: string;
}

export interface MegaColumn {
  title?: string;
  items: MegaItem[];
  /** Plain links without icons, for a long list of destinations. */
  plain?: boolean;
}

export interface MegaMenuProps {
  columns?: MegaColumn[];
  /** Media tiles beside the columns. */
  media?: MegaMedia[];
  /** Anything at the far right: a promo, a highlighted article. */
  right?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
  onNavigate?: (href: string | undefined) => void;
  className?: string;
}

/**
 * A media thumbnail in a menu.
 *
 * As everywhere else in the system, no artwork means a mist block naming what
 * belongs there — a menu with three broken images is worse than one with three
 * honest gaps.
 */
export function MediaTile({
  media,
  ratio = "16 / 10",
  onNavigate,
}: {
  media: MegaMedia;
  ratio?: string;
  onNavigate?: (href: string | undefined) => void;
}) {
  const video = media.kind === "video";

  return (
    <a
      href={media.href ?? "#"}
      onClick={(event) => {
        if (!onNavigate) return;
        event.preventDefault();
        onNavigate(media.href);
      }}
      className="group flex min-w-0 flex-col gap-2.5 text-inherit no-underline"
    >
      <span
        className="relative block overflow-hidden rounded-[14px] bg-mist-strong text-text-secondary"
        style={{ aspectRatio: ratio }}
      >
        {media.src ? (
          <img
            src={media.src}
            alt=""
            className="block size-full object-cover transition-transform duration-[340ms] ease-standard group-hover:scale-[1.035]"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center gap-2 p-3 text-center font-sans text-[12px]">
            <Icon name={video ? "clapperboard" : "image"} size={16} />
            {media.placeholder ?? (video ? "Video to supply" : "Image to supply")}
          </span>
        )}

        {video ? (
          <span
            aria-hidden="true"
            className="absolute bottom-3 left-3 inline-flex h-8 items-center gap-1.75 rounded-pill bg-accent py-0 pl-2.25 pr-3 font-sans text-[12px] font-medium text-accent-ink transition-transform duration-[200ms] ease-standard group-hover:-translate-y-0.5"
          >
            <Icon name="play" size={13} />
            {media.duration ?? "Play"}
          </span>
        ) : null}
      </span>

      {media.title ? (
        <span className="font-sans text-[14px] font-medium tracking-[-0.01em] text-text-primary">
          {media.title}
        </span>
      ) : null}
      {media.meta ? (
        <span className="text-pretty font-sans text-[13px] leading-[18px] text-text-secondary">
          {media.meta}
        </span>
      ) : null}
    </a>
  );
}

/** A destination with an icon chip and a line of explanation. */
function IconItem({
  item,
  onNavigate,
}: {
  item: MegaItem;
  onNavigate?: (href: string | undefined) => void;
}) {
  return (
    <a
      href={item.href ?? "#"}
      onClick={(event) => {
        if (!onNavigate) return;
        event.preventDefault();
        onNavigate(item.href);
      }}
      className="group flex items-start gap-3 rounded-xl px-3 py-2.5 no-underline transition-colors duration-[140ms] ease-standard hover:bg-mist halo-focus"
    >
      {item.icon ? (
        <span className="inline-flex size-8.5 shrink-0 items-center justify-center rounded-chip bg-mist-strong text-text-primary transition-colors duration-[140ms] ease-standard group-hover:bg-accent group-hover:text-accent-ink">
          <Icon name={item.icon} size={17} />
        </span>
      ) : null}

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 font-sans text-[14px] font-medium text-text-primary">
          {item.label}
          {item.badge ? (
            <span className="inline-flex h-4.75 items-center rounded-pill bg-accent px-1.75 text-[11px] font-medium text-accent-ink">
              {item.badge}
            </span>
          ) : null}
        </span>
        {item.description ? (
          <span className="text-pretty font-sans text-[13px] leading-[18px] text-text-secondary">
            {item.description}
          </span>
        ) : null}
      </span>
    </a>
  );
}

/** A bare link, for a column that is just a list of destinations. */
function PlainLink({
  item,
  onNavigate,
}: {
  item: MegaItem;
  onNavigate?: (href: string | undefined) => void;
}) {
  return (
    <a
      href={item.href ?? "#"}
      onClick={(event) => {
        if (!onNavigate) return;
        event.preventDefault();
        onNavigate(item.href);
      }}
      className="flex items-center gap-1.75 py-1.5 text-pretty font-sans text-[14px] font-medium text-text-primary no-underline underline-offset-4 hover:underline halo-focus"
    >
      {item.label}
      {item.badge ? (
        <span className="inline-flex h-4.5 items-center rounded-pill bg-accent px-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-accent-ink">
          {item.badge}
        </span>
      ) : null}
    </a>
  );
}

/**
 * The wide panel under a navbar link: several columns of destinations, often
 * with media beside them.
 *
 * IT IS A LAYOUT, NOT A LIST. A mega menu earns its size only by grouping —
 * columns with headings, each item explained in a line. A mega menu that is
 * one long column of labels should be a MenuDropdown instead.
 */
export function MegaMenu({
  columns = [],
  media,
  right,
  footer,
  width = 880,
  onNavigate,
  className,
}: MegaMenuProps) {
  return (
    <div
      className={cn(
        "box-border overflow-hidden rounded-panel border border-border-subtle bg-surface-card shadow-float",
        className,
      )}
      style={{ width }}
    >
      <div className="flex gap-8 p-6">
        {columns.length ? (
          <div
            className="grid flex-1 gap-6"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((column, index) => (
              <nav key={column.title ?? index} className="flex min-w-0 flex-col gap-1.5">
                {column.title ? (
                  <span className="mb-1 px-3 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    {column.title}
                  </span>
                ) : null}

                {column.items.map((item) =>
                  column.plain ? (
                    <PlainLink key={item.label} item={item} onNavigate={onNavigate} />
                  ) : (
                    <IconItem key={item.label} item={item} onNavigate={onNavigate} />
                  ),
                )}
              </nav>
            ))}
          </div>
        ) : null}

        {media?.length ? (
          <div
            className="grid shrink-0 gap-4"
            style={{
              width: 300,
              gridTemplateColumns: `repeat(${Math.min(media.length, 2)}, minmax(0, 1fr))`,
              // Keyed animation so the tiles arrive after the panel, from the
              // side the panel came from.
              animation: "halo-mega-cards 260ms var(--ease-standard) both",
            }}
          >
            {media.map((entry, index) => (
              <MediaTile key={entry.title ?? index} media={entry} onNavigate={onNavigate} />
            ))}
          </div>
        ) : null}

        {right ? <div className="w-[280px] shrink-0">{right}</div> : null}
      </div>

      {footer ? (
        <div className="border-t border-border-subtle bg-surface-alt px-6 py-4 font-sans text-[13px] text-text-secondary">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
