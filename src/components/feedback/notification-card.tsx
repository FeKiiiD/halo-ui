import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export interface NotificationActor {
  name: string;
  /** Falls back to initials when absent — no photography ships with the system. */
  src?: string;
}

export interface NotificationWorkspace {
  label: string;
  /** Any CSS colour for the workspace pip. Defaults to ink. */
  color?: string;
}

export interface NotificationAttachment {
  name: string;
  icon?: IconName;
  /** A size, a page count, a duration. */
  meta?: string;
}

export type NotificationMarker = "online" | "invite" | "verified";

export interface NotificationCardProps {
  actor?: NotificationActor;
  /** The verb: "commented on", "credited". */
  action?: string;
  /** What was acted on. */
  object?: React.ReactNode;
  time?: React.ReactNode;
  workspace?: NotificationWorkspace;
  attachment?: NotificationAttachment;
  actions?: React.ReactNode;
  marker?: NotificationMarker;
  status?: "unread" | "read" | "done";
  onDismiss?: () => void;
  onClick?: () => void;
  dismissLabel?: string;
  unreadLabel?: string;
  className?: string;
}

const markers: Record<NotificationMarker, { className: string; icon: IconName | null }> = {
  online: { className: "bg-success", icon: null },
  invite: { className: "bg-info", icon: "plus" },
  verified: { className: "bg-info", icon: "check" },
};

/** First letters of the first two words. */
function initials(name: string | undefined): string {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/**
 * One line of activity: who did what to which record, when, and where.
 *
 * The sentence is assembled from parts rather than taking a formatted string,
 * so the actor and the object can be emphasised without the caller shipping
 * markup — and so the same card works whatever language the app is in.
 *
 * The dismiss button appears on hover only. A row of always-visible crosses
 * turns a feed into a list of things to close.
 */
export function NotificationCard({
  actor,
  action,
  object,
  time,
  workspace,
  attachment,
  actions,
  marker,
  status = "unread",
  onDismiss,
  onClick,
  dismissLabel = "Dismiss",
  unreadLabel = "Unread",
  className,
}: NotificationCardProps) {
  const done = status === "done";
  const pip = marker ? markers[marker] : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex items-start gap-3 rounded-card border bg-surface-card p-4 font-sans",
        "transition-[border-color,opacity] duration-[180ms] ease-standard",
        onClick ? "cursor-pointer hover:border-border-strong" : "cursor-default",
        "border-border-subtle",
        done && "opacity-55",
        className,
      )}
    >
      <span className="relative shrink-0">
        <span className="inline-flex size-9.5 items-center justify-center overflow-hidden rounded-full bg-mist-strong text-[13px] font-semibold tracking-[-0.01em] text-ink">
          {actor?.src ? (
            <img src={actor.src} alt="" width={38} height={38} className="block object-cover" />
          ) : (
            initials(actor?.name)
          )}
        </span>

        {pip ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -bottom-px -right-0.5 inline-flex size-3.75 items-center justify-center rounded-full",
              "border-2 border-surface-card text-paper",
              pip.className,
            )}
          >
            {pip.icon ? <Icon name={pip.icon} size={9} strokeWidth={3} /> : null}
          </span>
        ) : null}
      </span>

      <div className={cn("flex min-w-0 flex-1 flex-col gap-0.75", onDismiss && "pr-5")}>
        <span className="text-pretty text-body-s leading-[1.45] text-text-secondary">
          <strong className="font-semibold text-text-primary">{actor?.name}</strong>
          {action ? ` ${action} ` : " "}
          {object ? <strong className="font-semibold text-text-primary">{object}</strong> : null}
        </span>

        <span className="flex items-center gap-1.75 text-[12.5px] text-text-secondary">
          {time}
          {workspace ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[8.5px] font-bold text-accent"
                  style={{ background: workspace.color ?? "var(--color-ink)" }}
                >
                  {initials(workspace.label)[0]}
                </span>
                <span className="truncate">{workspace.label}</span>
              </span>
            </>
          ) : null}
        </span>

        {attachment ? (
          <span className="mt-2.25 inline-flex max-w-full items-center gap-2 self-start rounded-xl border border-border-subtle bg-surface-page px-3 py-2 text-[13px] text-text-primary">
            <Icon name={attachment.icon ?? "paperclip"} size={14} />
            <span className="truncate">{attachment.name}</span>
            {attachment.meta ? (
              <span className="shrink-0 text-text-secondary">({attachment.meta})</span>
            ) : null}
          </span>
        ) : null}

        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      {status === "unread" ? (
        <span
          aria-label={unreadLabel}
          className={cn(
            "absolute top-4.5 size-1.75 rounded-full bg-accent-deep",
            onDismiss ? "right-9.5" : "right-3.5",
          )}
        />
      ) : null}

      {onDismiss ? (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={(event) => {
            // The card itself may be clickable; dismissing must not also open it.
            event.stopPropagation();
            onDismiss();
          }}
          className={cn(
            "absolute right-2.5 top-3 inline-flex size-6 items-center justify-center rounded-lg border-none bg-transparent",
            "cursor-pointer text-text-secondary opacity-0 transition-[opacity,color] duration-[140ms] ease-standard",
            "group-hover:opacity-100 hover:text-text-primary",
            // Keyboard users never hover, so focus has to reveal it too.
            "focus-visible:opacity-100 halo-focus",
          )}
        >
          <Icon name="x" size={15} strokeWidth={1.9} />
        </button>
      ) : null}
    </div>
  );
}
