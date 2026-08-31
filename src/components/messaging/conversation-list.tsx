import * as React from "react";
import { cn } from "../../lib/cn";
import { normalize } from "../../lib/use-dismissable";
import { Icon, type IconName } from "../core/icon";
import { SearchField } from "../forms/search-field";

export interface Conversation {
  id: string;
  name: string;
  preview?: string;
  time?: string;
  unread?: number;
  /** Shown in place of the preview. */
  typing?: boolean;
  /** A short qualifier beside the name. */
  tag?: string;
  channel?: IconName;
  initials?: string;
}

export interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect?: (id: string) => void;

  query?: string;
  onQuery?: (value: string) => void;
  search?: boolean;

  title?: React.ReactNode;
  height?: number | string;
  emptyLabel?: string;
  typingLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * The left column of a messaging view.
 *
 * UNREAD IS MARKED THREE TIMES — an accent avatar, a bolder name, and a count.
 * That is deliberate redundancy: this list is scanned rather than read, and one
 * signal is easy to miss in a column of twenty rows.
 *
 * The active row is marked by a fill and a 2px rule on its inner edge, not by
 * the accent: the accent is already doing the unread job here.
 */
export function ConversationList({
  conversations,
  activeId,
  onSelect,
  query,
  onQuery,
  search = true,
  title = "Messages",
  height = 440,
  emptyLabel = "No conversations.",
  typingLabel = "typing…",
  searchPlaceholder = "Search…",
  className,
}: ConversationListProps) {
  const [ownQuery, setOwnQuery] = React.useState("");

  const currentQuery = query ?? ownQuery;
  const setQuery = (value: string) => (onQuery ? onQuery(value) : setOwnQuery(value));

  const shown = currentQuery
    ? conversations.filter((conversation) =>
        normalize(`${conversation.name} ${conversation.preview ?? ""}`).includes(
          normalize(currentQuery),
        ),
      )
    : conversations;

  const unreadTotal = conversations.reduce((sum, conversation) => sum + (conversation.unread ?? 0), 0);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
        <span className="text-[15px] font-medium tracking-[-0.015em] text-text-primary">{title}</span>
        {unreadTotal ? (
          <span className="inline-flex h-5 items-center rounded-pill bg-accent px-2 text-[11.5px] font-medium tabular-nums text-accent-ink">
            {unreadTotal}
          </span>
        ) : null}
      </div>

      {search ? (
        <div className="px-4 pb-3">
          <SearchField
            value={currentQuery}
            onChange={setQuery}
            size="sm"
            fullWidth
            placeholder={searchPlaceholder}
          />
        </div>
      ) : null}

      <div className="overflow-y-auto border-t border-border-subtle" style={{ height }}>
        {shown.length === 0 ? (
          <div className="px-4 py-6 text-center text-body-s text-text-secondary">{emptyLabel}</div>
        ) : null}

        {shown.map((conversation) => {
          const active = conversation.id === activeId;

          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect?.(conversation.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border-subtle",
                "border-l-2 px-4 py-3 text-left halo-focus",
                "transition-colors duration-[140ms] ease-standard",
                active ? "border-l-ink bg-mist" : "border-l-transparent bg-transparent hover:bg-surface-alt",
              )}
            >
              {/* Not chip-neutral-bg: that token flips to the accent in dark
                  mode by design, which would make every avatar look unread.
                  A read avatar is explicitly the sunken surface in both
                  régimes, so the accent keeps meaning "unread". */}
              <span
                className={cn(
                  "inline-flex size-9.5 items-center justify-center rounded-full text-[13px] font-semibold",
                  conversation.unread
                    ? "bg-accent text-accent-ink"
                    : "bg-surface-sunken text-text-primary",
                )}
              >
                {conversation.initials ?? initialsOf(conversation.name)}
              </span>

              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-1.75">
                  <span
                    className={cn(
                      "truncate text-[14px] text-text-primary",
                      conversation.unread ? "font-semibold" : "font-medium",
                    )}
                  >
                    {conversation.name}
                  </span>
                  {conversation.tag ? (
                    <span className="inline-flex h-4.5 shrink-0 items-center rounded-pill bg-mist-strong px-1.75 text-[11px] text-text-primary">
                      {conversation.tag}
                    </span>
                  ) : null}
                </span>

                {conversation.typing ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-primary">
                    <span className="inline-flex items-center gap-0.75">
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          className="size-1 rounded-full bg-text-primary"
                          style={{
                            animation: `halo-typing 1s ease-in-out ${index * 140}ms infinite`,
                          }}
                        />
                      ))}
                    </span>
                    <span className="truncate italic">{typingLabel}</span>
                  </span>
                ) : (
                  <span className="flex min-w-0 items-center gap-1.25 text-[12.5px] text-text-secondary">
                    {conversation.channel ? (
                      <span className="inline-flex shrink-0">
                        <Icon name={conversation.channel} size={13} />
                      </span>
                    ) : null}
                    <span className="truncate">{conversation.preview}</span>
                  </span>
                )}
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11.5px] tabular-nums text-text-secondary">
                  {conversation.time}
                </span>
                {conversation.unread ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-ink px-1.5 text-[11.5px] font-medium tabular-nums text-paper">
                    {conversation.unread}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
