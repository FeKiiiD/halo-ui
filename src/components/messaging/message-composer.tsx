import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { SendButton } from "../core/send-button";

export interface ComposerVariable {
  /** Inserted verbatim at the caret. */
  token: string;
  label: string;
}

export interface MessageComposerProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Resolving `false` or throwing plays the send button's failure path. */
  onSend?: (value: string) => unknown | Promise<unknown>;

  placeholder?: string;
  channel?: string;
  channels?: string[];
  onChannelChange?: (channel: string) => void;

  /** Merge fields, inserted at the caret. */
  variables?: ComposerVariable[];
  maxLength?: number;
  disabled?: boolean;
  hint?: React.ReactNode;
  segmentLabel?: (segments: number, characters: number) => string;
  className?: string;
}

/** An SMS is billed per 160-character segment. */
const SEGMENT = 160;

/**
 * The message box.
 *
 * THE CHARACTER COUNT IS NOT DECORATION — it is the cost. An SMS is billed per
 * 160-character segment, so a message at 161 characters costs twice one at 159,
 * and the composer says so before it is sent rather than after.
 *
 * Variables insert at the caret, not at the end: someone writing "Hi , your
 * card…" is placing the token mid-sentence, which is the whole point of merge
 * fields.
 */
export function MessageComposer({
  value,
  onChange,
  onSend,
  placeholder = "Write to the customer…",
  channel,
  channels,
  onChannelChange,
  variables = [],
  maxLength,
  disabled = false,
  hint,
  segmentLabel = (segments, characters) =>
    `${characters} characters · ${segments} segment${segments === 1 ? "" : "s"}`,
  className,
}: MessageComposerProps) {
  const [text, setText] = useControllableState({ value, defaultValue: "", onChange });
  const textarea = React.useRef<HTMLTextAreaElement>(null);

  const characters = text.length;
  const segments = Math.max(1, Math.ceil(characters / SEGMENT));
  const over = maxLength !== undefined && characters > maxLength;

  const insert = (token: string) => {
    const element = textarea.current;
    const at = element?.selectionStart ?? text.length;

    setText(text.slice(0, at) + token + text.slice(at));

    // After the value lands: setting selectionStart before React re-renders
    // puts the caret back where it was.
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      element.selectionStart = at + token.length;
      element.selectionEnd = at + token.length;
    });
  };

  return (
    <div className={cn("flex flex-col gap-2.5 p-3.5 font-sans", className)}>
      {variables.length || channels?.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {channels?.length ? (
            <span className="inline-flex gap-1 rounded-pill bg-mist p-0.75">
              {channels.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => onChannelChange?.(entry)}
                  aria-pressed={entry === channel}
                  className={cn(
                    "h-6.5 rounded-pill border-none px-3 font-sans text-[12.5px] text-text-primary halo-focus",
                    entry === channel ? "bg-surface-card font-medium" : "bg-transparent font-normal",
                  )}
                >
                  {entry}
                </button>
              ))}
            </span>
          ) : null}

          {variables.map((variable) => (
            <button
              key={variable.token}
              type="button"
              onClick={() => insert(variable.token)}
              // Dashed, because it is a slot to fill rather than an action.
              className="h-6.5 rounded-pill border border-dashed border-border-subtle bg-transparent px-2.5 font-sans text-[12.5px] text-text-primary hover:bg-mist halo-focus"
            >
              {variable.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2.5">
        <textarea
          ref={textarea}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className={cn(
            "min-h-[68px] flex-1 resize-none rounded-input border bg-surface-card px-3.5 py-2.5",
            "font-sans text-body-s text-text-primary outline-none placeholder:text-text-secondary",
            "transition-[border-color] duration-[150ms] ease-out focus:border-border-strong",
            over ? "border-error" : "border-border-subtle",
          )}
        />

        <SendButton
          onSend={() => onSend?.(text)}
          disabled={disabled || !text.trim() || over}
          iconOnly
        >
          Send
        </SendButton>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {hint ? <span className="text-text-secondary">{hint}</span> : null}
        <span
          className={cn(
            "ml-auto tabular-nums",
            over ? "text-error" : "text-text-secondary",
          )}
        >
          {segmentLabel(segments, characters)}
          {maxLength !== undefined ? ` · ${characters} / ${maxLength}` : ""}
        </span>
      </div>
    </div>
  );
}
