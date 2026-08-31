import * as React from "react";
import { cn } from "../../lib/cn";
import {
  applyMark,
  insertText,
  isEmptyHtml,
  markState,
  normaliseHref,
  sanitizeHtml,
  textLength,
  type RichCommand,
} from "../../lib/rich-text";
import { Icon, type IconName } from "../core/icon";
import { Field } from "./field";

export interface RichTextEditorProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  warning?: React.ReactNode;
  success?: React.ReactNode;
  help?: string;

  /** HTML. It is sanitised on the way in and on the way out. */
  value?: string;
  onChange?: (html: string) => void;
  onBlur?: () => void;

  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  /** Counted in visible characters, not in markup. */
  maxLength?: number;

  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  id?: string;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

interface Tool {
  command?: RichCommand;
  icon?: IconName;
  label?: string;
  key?: string;
  separator?: true;
}

const TOOLS: Tool[] = [
  { command: "bold", icon: "bold", label: "Bold", key: "B" },
  { command: "italic", icon: "italic", label: "Italic", key: "I" },
  { command: "underline", icon: "underline", label: "Underline", key: "U" },
  { separator: true },
  { command: "insertUnorderedList", icon: "list", label: "Bulleted list" },
  { command: "insertOrderedList", icon: "list-ordered", label: "Numbered list" },
  { separator: true },
  { command: "createLink", icon: "link", label: "Link" },
  { command: "removeFormat", icon: "eraser", label: "Clear formatting" },
];

/** Commands whose pressed state is meaningful. */
const STATEFUL: RichCommand[] = [
  "bold",
  "italic",
  "underline",
  "insertUnorderedList",
  "insertOrderedList",
];

/**
 * A small rich-text field.
 *
 * THE VALUE IS SANITISED IN BOTH DIRECTIONS. It is HTML, and it is assigned to
 * innerHTML — so whether it arrived from these keystrokes or from a record
 * somebody else can write to, it is cleaned before it is rendered and before
 * it is handed back. The source assigned it raw.
 *
 * The link prompt is a panel, not window.prompt: a browser dialog cannot be
 * styled, cannot be tested, and on mobile takes over the screen for what is a
 * one-field question.
 */
export function RichTextEditor({
  label = "Text",
  hint,
  error,
  warning,
  success,
  help,
  value = "",
  onChange,
  onBlur,
  placeholder = "Write your message…",
  minHeight = 140,
  maxHeight = 320,
  maxLength,
  disabled = false,
  readOnly = false,
  required = false,
  id,
  labels,
  className,
}: RichTextEditorProps) {
  const text = {
    linkPrompt: "Link address",
    linkApply: "Add",
    linkCancel: "Cancel",
    ...labels,
  };

  const body = React.useRef<HTMLDivElement>(null);
  const [focused, setFocused] = React.useState(false);
  const [active, setActive] = React.useState<Partial<Record<RichCommand, boolean>>>({});
  const [linking, setLinking] = React.useState(false);
  const [href, setHref] = React.useState("");
  const savedRange = React.useRef<Range | null>(null);

  const fieldId = id ?? `rt-${String(label).replace(/\s+/g, "-").toLowerCase()}`;
  const count = textLength(value);
  const over = maxLength != null && count > maxLength;
  const empty = isEmptyHtml(value);

  // Written imperatively, and only when it actually differs: assigning on
  // every render would reset the caret to the start on every keystroke.
  React.useEffect(() => {
    const element = body.current;
    if (!element) return;

    const clean = sanitizeHtml(value);
    if (element.innerHTML !== clean) element.innerHTML = clean;
  }, [value]);

  const refreshState = () => {
    const next: Partial<Record<RichCommand, boolean>> = {};
    for (const command of STATEFUL) next[command] = markState(command);
    setActive(next);
  };

  const emit = () => {
    if (!body.current) return;
    onChange?.(sanitizeHtml(body.current.innerHTML));
  };

  const run = (command: RichCommand) => {
    if (disabled || readOnly) return;
    body.current?.focus();

    if (command === "createLink") {
      // The selection is lost the moment focus moves to the link input, so it
      // is captured here and restored before the command runs.
      const selection = window.getSelection();
      savedRange.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      setHref("");
      setLinking(true);
      return;
    }

    applyMark(command);
    refreshState();
    emit();
  };

  const applyLink = () => {
    const target = normaliseHref(href);
    setLinking(false);
    if (!target) return;

    body.current?.focus();

    if (savedRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange.current);
    }

    applyMark("createLink", target);
    // The sanitiser drops an unsafe href, so a javascript: address entered
    // here simply produces a link with no destination rather than a live one.
    emit();
    refreshState();
  };

  const toolbarButton = (tool: Tool, index: number) => {
    if (tool.separator) {
      return (
        <span
          key={`sep-${index}`}
          aria-hidden="true"
          className="mx-0.5 h-4.5 w-px shrink-0 bg-hairline"
        />
      );
    }

    const on = Boolean(tool.command && active[tool.command]);

    return (
      <button
        key={tool.command}
        type="button"
        title={`${tool.label}${tool.key ? ` (Ctrl+${tool.key})` : ""}`}
        aria-label={tool.label}
        aria-pressed={on}
        disabled={disabled || readOnly}
        // The selection survives only if the button never takes focus.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => tool.command && run(tool.command)}
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border-none halo-focus",
          "transition-colors duration-[140ms] ease-standard",
          on
            ? "bg-action-secondary-bg text-action-secondary-fg"
            : "bg-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary",
          (disabled || readOnly) && "opacity-40",
        )}
      >
        <Icon name={tool.icon!} size={14} />
      </button>
    );
  };

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      warning={warning}
      success={success}
      help={help}
      htmlFor={fieldId}
      required={required}
      counter={maxLength != null ? `${count} / ${maxLength}` : undefined}
      counterAlert={over}
      className={className}
    >
      <div
        className={cn(
          "overflow-hidden rounded-input border bg-surface-card",
          "transition-[border-color] duration-[150ms] ease-out",
          error || over
            ? "border-error"
            : warning
              ? "border-warning"
              : success
                ? "border-success"
                : focused
                  ? "border-border-strong"
                  : "border-border-subtle",
          disabled && "opacity-60",
        )}
      >
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-hairline px-1.5 py-1">
            {TOOLS.map(toolbarButton)}
          </div>
        ) : null}

        <div className="relative">
          <div
            ref={body}
            id={fieldId}
            role="textbox"
            aria-multiline="true"
            aria-required={required || undefined}
            contentEditable={!disabled && !readOnly}
            suppressContentEditableWarning
            onInput={emit}
            onKeyUp={refreshState}
            onMouseUp={refreshState}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              emit();
              onBlur?.();
            }}
            onPaste={(event) => {
              // Plain text only: pasting from a word processor otherwise
              // carries in fonts, colours and background shading that no
              // amount of sanitising makes belong in this document.
              event.preventDefault();
              const pasted = event.clipboardData.getData("text/plain");
              // insertText from the lib, which uses the Range API: inserting a
              // text node is unambiguous, and doing it directly means a paste
              // can never carry markup in with it.
              if (pasted && insertText(pasted)) emit();
            }}
            className={cn(
              "w-full overflow-y-auto px-3.5 py-2.5 font-sans text-body-s leading-[var(--lh-body-s)] text-text-primary outline-none",
              "[&_a]:text-text-primary [&_a]:underline",
              "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
            )}
            style={{ minHeight, maxHeight }}
          />

          {empty && !focused ? (
            <span className="pointer-events-none absolute left-3.5 top-2.5 select-none text-body-s text-text-secondary">
              {placeholder}
            </span>
          ) : null}
        </div>

        {linking ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-surface-alt px-3 py-2">
            <input
              autoFocus
              value={href}
              onChange={(event) => setHref(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
                if (event.key === "Escape") setLinking(false);
              }}
              placeholder="example.com"
              aria-label={text.linkPrompt}
              className="h-8 min-w-0 flex-1 rounded-input border border-border-subtle bg-surface-card px-2.5 font-sans text-[13px] text-text-primary outline-none focus:border-border-strong"
            />
            <button
              type="button"
              onClick={applyLink}
              className="inline-flex h-8 items-center rounded-pill border-none bg-accent px-3 font-sans text-[13px] font-medium text-accent-ink halo-focus"
            >
              {text.linkApply}
            </button>
            <button
              type="button"
              onClick={() => setLinking(false)}
              className="inline-flex h-8 items-center rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary halo-focus"
            >
              {text.linkCancel}
            </button>
          </div>
        ) : null}
      </div>
    </Field>
  );
}
