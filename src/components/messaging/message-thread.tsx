import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export interface Message {
  id?: string;
  text?: string;
  from?: "me" | "them";
  time?: string;
  status?: MessageStatus;
  /** Renders as a dated divider instead of a bubble. */
  day?: string;
}

export interface MessageThreadProps {
  messages: Message[];
  typing?: boolean;
  typingLabel?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  height?: number | string;
  emptyLabel?: string;
  statusLabels?: Partial<Record<MessageStatus, string>>;
  className?: string;
}

const statusMeta: Record<MessageStatus, { icon: IconName; label: string }> = {
  sending: { icon: "clock", label: "Sending…" },
  sent: { icon: "check", label: "Sent" },
  delivered: { icon: "check-check", label: "Delivered" },
  read: { icon: "check-check", label: "Read" },
  failed: { icon: "circle-alert", label: "Failed" },
};

function Bubble({
  message,
  statusLabels,
}: {
  message: Message;
  statusLabels?: Partial<Record<MessageStatus, string>>;
}) {
  const mine = message.from === "me";
  const failed = message.status === "failed";
  const status = message.status ? statusMeta[message.status] : null;

  return (
    <div
      className={cn("flex", mine ? "justify-end" : "justify-start")}
      style={{ animation: "halo-message-in 220ms var(--ease-standard) both" }}
    >
      <div
        className={cn(
          "flex max-w-[76%] flex-col gap-1",
          mine ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "whitespace-pre-wrap text-pretty rounded-[18px] px-3.5 py-2.5 font-sans text-body-s leading-[var(--lh-body-s)]",
            // The tail corner marks the sender without needing a name on every
            // bubble.
            mine ? "rounded-br-[6px]" : "rounded-bl-[6px]",
            failed
              ? "bg-error-soft text-error"
              : mine
                ? "bg-ink text-paper"
                : "bg-mist text-text-primary",
          )}
        >
          {message.text}
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.25 font-sans text-[11.5px] tabular-nums",
            failed ? "text-error" : "text-text-secondary",
          )}
        >
          {message.time}
          {mine && status ? (
            <>
              <span className={cn("inline-flex", message.status === "read" && "text-success")}>
                <Icon name={status.icon} size={13} />
              </span>
              {statusLabels?.[message.status!] ?? status.label}
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/**
 * A conversation, oldest at the top.
 *
 * IT ALWAYS LANDS ON THE NEWEST MESSAGE. A thread that opens mid-scroll makes
 * the user hunt for what just arrived — which is the only thing they opened it
 * for.
 *
 * Day dividers are entries in the same array rather than a separate prop: they
 * belong in the sequence, and interleaving them at render time means computing
 * the same boundaries twice.
 */
export function MessageThread({
  messages,
  typing = false,
  typingLabel,
  header,
  footer,
  height = 380,
  emptyLabel = "No messages yet.",
  statusLabels,
  className,
}: MessageThreadProps) {
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages.length, typing]);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      {header ? (
        <div className="border-b border-border-subtle px-4.5 py-3.5">{header}</div>
      ) : null}

      <div ref={box} className="flex flex-col gap-3 overflow-y-auto p-4.5" style={{ height }}>
        {messages.length === 0 ? (
          <span className="m-auto text-body-s text-text-secondary">{emptyLabel}</span>
        ) : null}

        {messages.map((message, index) =>
          message.day ? (
            <div key={`day-${index}`} className="my-1.5 flex items-center gap-2.5">
              <span className="h-px flex-1 bg-border-subtle" />
              <span className="text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
                {message.day}
              </span>
              <span className="h-px flex-1 bg-border-subtle" />
            </div>
          ) : (
            <Bubble key={message.id ?? index} message={message} statusLabels={statusLabels} />
          ),
        )}

        {typing ? (
          <div
            className="flex flex-col items-start gap-1"
            style={{ animation: "halo-message-in 220ms var(--ease-standard) both" }}
          >
            <div className="inline-flex gap-1 rounded-[18px] rounded-bl-[6px] bg-mist px-3.5 py-3">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="size-1.5 rounded-full bg-text-secondary"
                  style={{ animation: `halo-typing 1s ease-in-out ${index * 140}ms infinite` }}
                />
              ))}
            </div>
            {typingLabel ? (
              <span className="font-sans text-[11.5px] text-text-secondary">{typingLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {footer ? <div className="border-t border-border-subtle">{footer}</div> : null}
    </div>
  );
}
