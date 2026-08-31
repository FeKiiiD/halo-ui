import * as React from "react";
import { cn } from "../../lib/cn";
import {
  BLOCK_TYPES,
  SLASH_GROUPS,
  counts,
  duplicateBlock,
  isBoxed,
  moveBlock,
  newBlock,
  outlineOf,
  removeBlock,
  shortcutFor,
  stripTags,
  toHtml,
  toMarkdown,
  type Block,
  type BlockType,
} from "../../lib/document";
import { applyMark, caretAtEdge, markState, normaliseHref } from "../../lib/rich-text";
import { useDismissable } from "../../lib/use-dismissable";
import { CopyButton } from "../core/copy-button";
import { Icon, type IconName } from "../core/icon";
import { SaveButton } from "../core/save-button";
import { BlockView } from "./document-blocks";

export interface DocumentEditorProps {
  value: Block[];
  onChange?: (blocks: Block[]) => void;

  title?: string;
  onTitleChange?: (title: string) => void;
  titlePlaceholder?: string;
  placeholder?: string;

  readOnly?: boolean;
  outline?: boolean;
  toolbar?: boolean;

  minHeight?: number;
  maxWidth?: number;

  onSave?: (blocks: Block[]) => unknown | Promise<unknown>;
  onExport?: (kind: "html" | "markdown", text: string) => void;

  labels?: Partial<Record<string, string>>;
  className?: string;
}

/** Inline marks the floating toolbar offers. */
const MARKS: { command: "bold" | "italic" | "underline"; icon: IconName; label: string; key: string }[] = [
  { command: "bold", icon: "bold", label: "Bold", key: "B" },
  { command: "italic", icon: "italic", label: "Italic", key: "I" },
  { command: "underline", icon: "underline", label: "Underline", key: "U" },
];

/**
 * A block document editor.
 *
 * EVERY BLOCK IS A ROW IN A FLAT LIST, not a node in a tree. Nesting is the
 * thing that makes a block editor hard to reason about and easy to corrupt —
 * a list inside a quote inside a callout has no obvious backspace behaviour —
 * and a flat list means every operation is an array splice that can be
 * reasoned about and tested.
 *
 * The slash palette, the block menu and the outline all read from that one
 * array. There is no second source of truth about what the document contains.
 */
export function DocumentEditor({
  value,
  onChange,
  title,
  onTitleChange,
  titlePlaceholder = "Untitled",
  placeholder = "Write, or press / for a block",
  readOnly = false,
  outline: showOutline = true,
  toolbar = true,
  minHeight = 360,
  maxWidth = 720,
  onSave,
  onExport,
  labels,
  className,
}: DocumentEditorProps) {
  const text = {
    export: "Export",
    html: "HTML",
    markdown: "Markdown",
    contents: "Contents",
    words: "words",
    minutes: "min read",
    duplicate: "Duplicate",
    delete: "Delete",
    moveUp: "Move up",
    moveDown: "Move down",
    turnInto: "Turn into",
    addBelow: "Add a block below",
    empty: "Nothing yet.",
    link: "Link",
    ...labels,
  };

  const blocks = value.length ? value : [newBlock("p")];

  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [palette, setPalette] = React.useState<{ id: string; query: string } | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [exported, setExported] = React.useState<{ kind: "html" | "markdown"; body: string } | null>(null);
  const [marks, setMarks] = React.useState<Record<string, boolean>>({});
  const [linking, setLinking] = React.useState(false);
  const [href, setHref] = React.useState("");

  const editables = React.useRef<Record<string, HTMLDivElement | null>>({});
  const savedRange = React.useRef<Range | null>(null);
  const menuRef = useDismissable<HTMLDivElement>(Boolean(menuFor), () => setMenuFor(null));
  const paletteRef = useDismissable<HTMLDivElement>(Boolean(palette), () => setPalette(null));

  const stats = React.useMemo(() => counts(blocks), [blocks]);

  /**
   * The number each numbered block shows.
   *
   * Computed here because this is the only place that can see the run a marker
   * belongs to. A counter resets on any block that is not numbered, so two
   * numbered sections separated by a heading each start at 1 — the same rule
   * the Markdown export follows, and for the same reason.
   */
  const ordinals = React.useMemo(() => {
    const out: Record<string, number> = {};
    let run = 0;

    for (const block of blocks) {
      if (block.type === "numbered") {
        run += 1;
        out[block.id] = run;
      } else {
        run = 0;
      }
    }
    return out;
  }, [blocks]);
  const headings = React.useMemo(() => outlineOf(blocks), [blocks]);

  const emit = (next: Block[]) => onChange?.(next.length ? next : [newBlock("p")]);

  const patch = (id: string, change: Partial<Block>) =>
    emit(blocks.map((block) => (block.id === id ? { ...block, ...change } : block)));

  /** Puts the caret into a block once React has rendered it. */
  const focusBlock = (id: string, atStart = false) => {
    requestAnimationFrame(() => {
      const element = editables.current[id];
      if (!element) return;
      element.focus();

      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(atStart);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  };

  const insertAfter = (id: string, type: BlockType = "p") => {
    const index = blocks.findIndex((block) => block.id === id);
    const created = newBlock(type);
    const next = [...blocks];
    next.splice(index + 1, 0, created);
    emit(next);
    setFocusId(created.id);
    focusBlock(created.id);
    return created;
  };

  const turnInto = (id: string, type: BlockType) => {
    patch(id, { type });
    setPalette(null);
    // A boxed block has no text to type into, so the caret stays put.
    if (!isBoxed(type) && type !== "divider") focusBlock(id);
  };

  const keyDown = (block: Block, event: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;

    const element = editables.current[block.id];
    const plain = stripTags(block.html);

    // The slash palette opens on an empty block, so it can never be confused
    // with a slash somebody is typing inside a sentence.
    if (event.key === "/" && !plain) {
      setPalette({ id: block.id, query: "" });
      return;
    }

    if (palette?.id === block.id) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPalette(null);
        return;
      }
      if (event.key === "Backspace" && !palette.query) setPalette(null);
    }

    if (event.key === "Enter" && !event.shiftKey && !isBoxed(block.type)) {
      event.preventDefault();

      // Enter on an empty list item leaves the list rather than making
      // another empty one — the way every editor behaves.
      if (
        (block.type === "bullet" || block.type === "numbered" || block.type === "todo") &&
        !plain
      ) {
        patch(block.id, { type: "p" });
        return;
      }

      // A new block inherits a list type and nothing else: continuing a list
      // is expected, continuing a heading is not.
      const inherit =
        block.type === "bullet" || block.type === "numbered" || block.type === "todo"
          ? block.type
          : "p";
      insertAfter(block.id, inherit);
      return;
    }

    if (event.key === "Backspace" && element) {
      const edge = caretAtEdge(element);
      if (!edge.start) return;

      const index = blocks.findIndex((entry) => entry.id === block.id);

      // Backspace at the start of a styled block turns it back into a
      // paragraph before it removes anything: one press to undo the style,
      // a second to merge.
      if (block.type !== "p") {
        event.preventDefault();
        patch(block.id, { type: "p" });
        return;
      }

      if (index > 0 && !plain) {
        event.preventDefault();
        const previous = blocks[index - 1]!;
        emit(blocks.filter((entry) => entry.id !== block.id));
        setFocusId(previous.id);
        focusBlock(previous.id, false);
      }
      return;
    }

    if (event.key === "ArrowUp" && element && caretAtEdge(element).start) {
      const index = blocks.findIndex((entry) => entry.id === block.id);
      const previous = blocks[index - 1];
      if (previous) {
        event.preventDefault();
        focusBlock(previous.id, false);
      }
      return;
    }

    if (event.key === "ArrowDown" && element && caretAtEdge(element).end) {
      const index = blocks.findIndex((entry) => entry.id === block.id);
      const next = blocks[index + 1];
      if (next) {
        event.preventDefault();
        focusBlock(next.id, true);
      }
      return;
    }

    // The Markdown openers, applied on the space that completes them.
    if (event.key === " " || event.key === "`" || event.key === "-") {
      requestAnimationFrame(() => {
        const current = editables.current[block.id];
        if (!current) return;
        const typed = current.textContent ?? "";
        const shortcut = shortcutFor(typed);
        if (shortcut) {
          patch(block.id, { type: shortcut, html: "" });
          if (current) current.innerHTML = "";
        }
      });
    }
  };

  const refreshMarks = () => {
    setMarks({
      bold: markState("bold"),
      italic: markState("italic"),
      underline: markState("underline"),
    });
  };

  const runMark = (command: "bold" | "italic" | "underline") => {
    applyMark(command);
    refreshMarks();
    const id = focusId;
    if (id && editables.current[id]) patch(id, { html: editables.current[id]!.innerHTML });
  };

  const applyLink = () => {
    const target = normaliseHref(href);
    setLinking(false);
    if (!target) return;

    if (savedRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange.current);
    }

    applyMark("createLink", target);
    const id = focusId;
    // The sanitiser drops an unsafe href, so a javascript: address produces a
    // link with no destination rather than a live one.
    if (id && editables.current[id]) patch(id, { html: editables.current[id]!.innerHTML });
  };

  const doExport = (kind: "html" | "markdown") => {
    const body = kind === "html" ? toHtml(blocks) : toMarkdown(blocks);
    if (onExport) onExport(kind, body);
    else setExported({ kind, body });
  };

  /* --- render ------------------------------------------------------------- */

  const paletteItems = palette
    ? SLASH_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((type) => {
          const query = palette.query.toLowerCase();
          if (!query) return true;
          const spec = BLOCK_TYPES[type];
          return (
            spec.label.toLowerCase().includes(query) ||
            (spec.hint ?? "").toLowerCase().includes(query) ||
            type.includes(query)
          );
        }),
      })).filter((group) => group.items.length)
    : [];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
          <span className="mr-auto text-[12.5px] tabular-nums text-text-secondary">
            {stats.words} {text.words} · {stats.minutes} {text.minutes}
          </span>

          {!readOnly ? (
            <>
              <span className="inline-flex gap-0.5 rounded-pill bg-mist p-0.75">
                {MARKS.map((mark) => (
                  <button
                    key={mark.command}
                    type="button"
                    title={`${mark.label} (⌘${mark.key})`}
                    aria-label={mark.label}
                    aria-pressed={Boolean(marks[mark.command])}
                    // The selection survives only if the button never focuses.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runMark(mark.command)}
                    className={cn(
                      "inline-flex size-6.5 items-center justify-center rounded-pill border-none halo-focus",
                      marks[mark.command]
                        ? "bg-surface-card text-text-primary"
                        : "bg-transparent text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <Icon name={mark.icon} size={13} />
                  </button>
                ))}

                <button
                  type="button"
                  title={text.link}
                  aria-label={text.link}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    const selection = window.getSelection();
                    savedRange.current = selection?.rangeCount
                      ? selection.getRangeAt(0).cloneRange()
                      : null;
                  }}
                  onClick={() => {
                    setHref("");
                    setLinking(true);
                  }}
                  className="inline-flex size-6.5 items-center justify-center rounded-pill border-none bg-transparent text-text-secondary hover:text-text-primary halo-focus"
                >
                  <Icon name="link" size={13} />
                </button>
              </span>

              <span className="inline-flex gap-1">
                {(["html", "markdown"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => doExport(kind)}
                    className="inline-flex h-7.5 items-center rounded-pill border border-border-subtle bg-transparent px-2.75 font-sans text-[12.5px] text-text-secondary hover:bg-surface-alt hover:text-text-primary halo-focus"
                  >
                    {kind === "html" ? text.html : text.markdown}
                  </button>
                ))}
              </span>

              {onSave ? (
                <SaveButton variant="primary" size="md" minWidth={132} onSave={() => onSave(blocks)} />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {linking ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-alt px-4 py-2">
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
            aria-label="Link address"
            className="h-8 min-w-0 flex-1 rounded-input border border-border-subtle bg-surface-card px-2.5 font-sans text-[13px] text-text-primary outline-none focus:border-border-strong"
          />
          <button
            type="button"
            onClick={applyLink}
            className="inline-flex h-8 items-center rounded-pill border-none bg-accent px-3 font-sans text-[13px] font-medium text-accent-ink halo-focus"
          >
            {text.link}
          </button>
        </div>
      ) : null}

      <div className="flex items-stretch">
        {showOutline && headings.length ? (
          <nav className="hidden w-52 shrink-0 flex-col gap-1 border-r border-hairline p-3.5 lg:flex">
            <span className="mb-1 text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
              {text.contents}
            </span>
            {headings.map((heading) => (
              <button
                key={heading.id}
                type="button"
                onClick={() => focusBlock(heading.id)}
                className="truncate rounded-md border-none bg-transparent py-0.5 text-left font-sans text-[12.5px] text-text-secondary hover:text-text-primary halo-focus"
                style={{ paddingLeft: (heading.level - 1) * 10 }}
              >
                {heading.text}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6" style={{ minHeight }}>
          <div className="mx-auto flex flex-col gap-1.5" style={{ maxWidth }}>
            {onTitleChange !== undefined ? (
              <input
                value={title ?? ""}
                readOnly={readOnly}
                onChange={(event) => onTitleChange?.(event.target.value)}
                placeholder={titlePlaceholder}
                aria-label="Document title"
                className="mb-2 w-full border-none bg-transparent font-sans text-[34px] font-semibold tracking-[-0.03em] text-text-primary outline-none placeholder:text-text-secondary"
              />
            ) : null}

            {blocks.map((block) => (
              <div
                key={block.id}
                onMouseEnter={() => setHoverId(block.id)}
                onMouseLeave={() => setHoverId((current) => (current === block.id ? null : current))}
                className="group relative"
              >
                {!readOnly && (hoverId === block.id || menuFor === block.id) ? (
                  <span className="absolute -left-16 top-0.5 hidden items-center gap-0.5 lg:inline-flex">
                    <button
                      type="button"
                      aria-label={text.addBelow}
                      title={text.addBelow}
                      onClick={() => insertAfter(block.id)}
                      className="inline-flex size-6 items-center justify-center rounded-md border-none bg-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary halo-focus"
                    >
                      <Icon name="plus" size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Block options"
                      onClick={() => setMenuFor(menuFor === block.id ? null : block.id)}
                      className="inline-flex size-6 cursor-grab items-center justify-center rounded-md border-none bg-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary halo-focus"
                    >
                      <Icon name="grip-vertical" size={13} />
                    </button>
                  </span>
                ) : null}

                <BlockView
                  block={block}
                  readOnly={readOnly}
                  focused={focusId === block.id}
                  ordinal={ordinals[block.id]}
                  placeholder={block.type === "p" ? placeholder : BLOCK_TYPES[block.type].label}
                  onChange={(change) => patch(block.id, change)}
                  onFocus={() => {
                    setFocusId(block.id);
                    refreshMarks();
                  }}
                  onBlur={() => setFocusId((current) => (current === block.id ? null : current))}
                  onKeyDown={(event) => keyDown(block, event)}
                  editableRef={(element) => {
                    editables.current[block.id] = element;
                  }}
                />

                {menuFor === block.id ? (
                  <div
                    ref={menuRef}
                    role="menu"
                    className="absolute -left-14 top-8 z-50 w-52 rounded-panel border border-border-subtle bg-surface-card p-1.25 shadow-float"
                  >
                    <MenuItem
                      icon="chevron-up"
                      label={text.moveUp!}
                      onClick={() => {
                        emit(moveBlock(blocks, block.id, -1));
                        setMenuFor(null);
                      }}
                    />
                    <MenuItem
                      icon="chevron-down"
                      label={text.moveDown!}
                      onClick={() => {
                        emit(moveBlock(blocks, block.id, 1));
                        setMenuFor(null);
                      }}
                    />
                    <MenuItem
                      icon="copy"
                      label={text.duplicate!}
                      onClick={() => {
                        emit(duplicateBlock(blocks, block.id));
                        setMenuFor(null);
                      }}
                    />
                    <span className="mx-1.5 my-1 block h-px bg-hairline" />
                    <MenuItem
                      icon="trash-2"
                      label={text.delete!}
                      tone="error"
                      onClick={() => {
                        emit(removeBlock(blocks, block.id));
                        setMenuFor(null);
                      }}
                    />
                  </div>
                ) : null}

                {palette?.id === block.id ? (
                  <div
                    ref={paletteRef}
                    role="listbox"
                    className="absolute left-0 top-8 z-50 max-h-72 w-64 overflow-y-auto rounded-panel border border-border-subtle bg-surface-card p-1.25 shadow-float"
                  >
                    <input
                      autoFocus
                      value={palette.query}
                      onChange={(event) =>
                        setPalette({ id: block.id, query: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setPalette(null);
                      }}
                      placeholder="Search a block…"
                      aria-label="Search a block"
                      className="mb-1 h-8 w-full rounded-input border border-border-subtle bg-surface-page px-2.5 font-sans text-[13px] text-text-primary outline-none"
                    />

                    {paletteItems.length === 0 ? (
                      <span className="block px-2 py-2 text-[12.5px] text-text-secondary">
                        Nothing matches.
                      </span>
                    ) : null}

                    {paletteItems.map((group) => (
                      <div key={group.label}>
                        <span className="block px-2 pb-0.5 pt-1.5 text-[11px] uppercase tracking-[0.06em] text-text-secondary">
                          {group.label}
                        </span>
                        {group.items.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => turnInto(block.id, type)}
                            className="flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left font-sans text-[13px] text-text-primary hover:bg-mist halo-focus"
                          >
                            <Icon name={BLOCK_TYPES[type].icon as IconName} size={14} />
                            <span className="min-w-0 flex-1 truncate">{BLOCK_TYPES[type].label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {exported ? (
        <div className="border-t border-hairline">
          <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
            <span className="mr-auto text-[13.5px] font-medium text-text-primary">
              {exported.kind === "html" ? text.html : text.markdown}
            </span>
            <CopyButton value={exported.body} iconOnly />
            <button
              type="button"
              aria-label="Close"
              onClick={() => setExported(null)}
              className="inline-flex size-7 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:bg-surface-alt halo-focus"
            >
              <Icon name="x" size={13} />
            </button>
          </div>

          <pre className="m-0 max-h-64 overflow-auto p-4 font-mono text-[12px] leading-[1.55] text-text-primary">
            {exported.body}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  tone?: "error";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-lg border-none bg-transparent px-2.5 text-left font-sans text-[13px] hover:bg-mist halo-focus",
        tone === "error" ? "text-error" : "text-text-primary",
      )}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}
