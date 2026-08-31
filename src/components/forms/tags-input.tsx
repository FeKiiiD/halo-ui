import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../core/icon";
import { Field } from "./field";

export interface TagsInputProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Always controlled: the caller owns the list. */
  tags?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  bare?: boolean;
  disabled?: boolean;
  max?: number;
  className?: string;
}

/** Separators that commit a tag when pasted or typed. */
const SEPARATORS = /[,;\n]/;

/**
 * A free-form list of short strings.
 *
 * Committing is deliberately forgiving: Enter, a comma, or leaving the field
 * all commit the draft. Pasting a comma- or newline-separated list splits it
 * into several tags, which is how anyone moving a list from a spreadsheet
 * expects it to work. Backspace on an empty draft removes the last tag.
 *
 * Duplicates are silently dropped rather than raising an error — the intent is
 * unambiguous, and the tag is already there.
 */
export function TagsInput({
  label,
  hint,
  error,
  tags = [],
  onChange,
  placeholder = "Add…",
  bare = false,
  disabled = false,
  max,
  className,
}: TagsInputProps) {
  const [draft, setDraft] = React.useState("");
  const [focus, setFocus] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const full = max !== undefined && tags.length >= max;

  const commit = () => {
    const value = draft.trim();
    setDraft("");
    if (!value || full || tags.includes(value)) return;
    onChange?.([...tags, value]);
  };

  return (
    <Field
      reserveMessage={!bare}
      label={bare ? undefined : label}
      hint={hint}
      error={error}
      counter={max !== undefined ? `${tags.length} / ${max}` : undefined}
      counterAlert={full}
      className={className}
    >
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-12 flex-wrap items-center gap-2 rounded-input border px-3 py-1.5 outline-none",
          "transition-[border-color,box-shadow,background-color] duration-[220ms] ease-standard",
          disabled ? "cursor-not-allowed bg-surface-disabled opacity-50" : "cursor-text bg-surface-card",
          error
            ? "border-error"
            : focus
              ? "border-border-strong shadow-[0_0_0_3px_rgb(11_11_11/0.055)]"
              : "border-border-subtle",
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-accent py-0 pl-3 pr-1.5 text-body-s font-medium text-accent-ink"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onChange?.(tags.filter((value) => value !== tag));
              }}
              className="inline-flex cursor-pointer border-none bg-transparent p-0.5 text-accent-ink"
            >
              <Icon name="x" size={13} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={draft}
          placeholder={tags.length ? "" : placeholder}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            commit();
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (!SEPARATORS.test(text)) return;

            event.preventDefault();
            const next = [...tags];
            for (const part of text.split(SEPARATORS).map((s) => s.trim()).filter(Boolean)) {
              if (next.includes(part)) continue;
              if (max !== undefined && next.length >= max) break;
              next.push(part);
            }
            onChange?.(next);
            setDraft("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
              return;
            }
            if (event.key === "Backspace" && !draft && tags.length) {
              onChange?.(tags.slice(0, -1));
            }
          }}
          className="h-7 min-w-[90px] flex-1 border-none bg-transparent font-sans text-body text-text-primary outline-none placeholder:text-text-secondary"
        />
      </div>
    </Field>
  );
}
