import * as React from "react";
import { cn } from "../../lib/cn";
import {
  BLOCK_TYPES,
  codeText,
  isBoxed,
  stripTags,
  videoSrc,
  type Block,
  type BlockType,
} from "../../lib/document";
import { caretAtEdge, insertText, sanitizeHtml, selectAll } from "../../lib/rich-text";
import { Icon, type IconName } from "../core/icon";
import { WhiteboardBlock, type Whiteboard } from "../whiteboard/whiteboard-block";

export interface BlockViewProps {
  block: Block;
  readOnly?: boolean;
  focused?: boolean;
  placeholder?: string;
  /** Position in the run of consecutive numbered blocks, 1-based. */
  ordinal?: number;
  onChange: (change: Partial<Block>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  editableRef?: (element: HTMLDivElement | null) => void;
}

/** Per-type styling for the text-carrying blocks. */
const TEXT_STYLE: Partial<Record<BlockType, string>> = {
  h1: "text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] mt-4.5",
  h2: "text-[23px] font-semibold leading-[1.2] tracking-[-0.02em] mt-3.5",
  h3: "text-[18px] font-semibold leading-[1.25] tracking-[-0.01em] mt-2.5",
  p: "text-[15.5px] leading-[1.65]",
  quote: "text-[16px] leading-[1.6] italic text-text-secondary",
  bullet: "text-[15.5px] leading-[1.65]",
  numbered: "text-[15.5px] leading-[1.65]",
  todo: "text-[15.5px] leading-[1.65]",
  callout: "text-[15px] leading-[1.6]",
};

/**
 * One block.
 *
 * THE CONTENT IS WRITTEN IMPERATIVELY, ONCE. Assigning innerHTML on every
 * render would put the caret back at the start on every keystroke, so the DOM
 * is only touched when the value differs from what is already there — which is
 * never, while somebody is typing into it.
 */
export function BlockView({
  block,
  readOnly = false,
  focused = false,
  placeholder,
  ordinal,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  editableRef,
}: BlockViewProps) {
  if (isBoxed(block.type)) {
    return <BoxedBlock block={block} readOnly={readOnly} onChange={onChange} />;
  }

  if (block.type === "divider") {
    return <hr className="my-4 border-none border-t border-hairline" />;
  }

  if (block.type === "code") {
    return <CodeBlock block={block} readOnly={readOnly} onChange={onChange} onKeyDown={onKeyDown} />;
  }

  const editable = (
    <Editable
      html={block.html ?? ""}
      readOnly={readOnly}
      placeholder={focused || !stripTags(block.html) ? placeholder : undefined}
      className={cn("outline-none", TEXT_STYLE[block.type])}
      onChange={(html) => onChange({ html })}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      elementRef={editableRef}
    />
  );

  if (block.type === "quote") {
    return <blockquote className="border-l-2 border-border-strong pl-4">{editable}</blockquote>;
  }

  if (block.type === "callout") {
    return (
      <aside className="flex gap-2.5 rounded-panel bg-mist px-3.5 py-3">
        <Icon name="info" size={16} className="mt-0.5 shrink-0 text-text-secondary" />
        <span className="min-w-0 flex-1">{editable}</span>
      </aside>
    );
  }

  if (block.type === "todo") {
    return (
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(block.checked)}
          disabled={readOnly}
          onChange={(event) => onChange({ checked: event.target.checked })}
          className="mt-1 accent-text-primary"
        />
        <span className={cn("min-w-0 flex-1", block.checked && "text-text-secondary line-through")}>
          {editable}
        </span>
      </label>
    );
  }

  if (block.type === "bullet" || block.type === "numbered") {
    return (
      <div className="flex items-start gap-2.5">
        {/* The marker is drawn rather than using a real <li>: the blocks are a
            flat list, so there is no <ol> to count for us. `ordinal` is passed
            down by the editor, which is the only place that can see the run of
            consecutive numbered blocks a marker belongs to. */}
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 shrink-0 text-[15.5px] leading-[1.65] text-text-secondary",
            block.type === "numbered" && "tabular-nums",
          )}
        >
          {block.type === "bullet" ? "•" : `${ordinal ?? 1}.`}
        </span>
        <span className="min-w-0 flex-1">{editable}</span>
      </div>
    );
  }

  return editable;
}

/**
 * A contenteditable line.
 *
 * Sanitised on the way in and on the way out, like every other place this
 * library assigns innerHTML.
 */
function Editable({
  html,
  readOnly,
  placeholder,
  className,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  elementRef,
}: {
  html: string;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  onChange: (html: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  elementRef?: (element: HTMLDivElement | null) => void;
}) {
  const own = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const element = own.current;
    if (!element) return;

    const clean = sanitizeHtml(html);
    // Only when it differs: assigning unconditionally moves the caret.
    if (element.innerHTML !== clean) element.innerHTML = clean;
  }, [html]);

  const empty = !stripTags(html);

  return (
    <div className="relative">
      <div
        ref={(element) => {
          own.current = element;
          elementRef?.(element);
        }}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        onInput={(event) => onChange(sanitizeHtml(event.currentTarget.innerHTML))}
        onFocus={onFocus}
        onBlur={(event) => {
          onChange(sanitizeHtml(event.currentTarget.innerHTML));
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          // Plain text only: a paste from a word processor otherwise carries
          // in fonts, colours and shading that belong to the other document.
          event.preventDefault();
          const pasted = event.clipboardData.getData("text/plain");
          if (pasted && insertText(pasted) && own.current) {
            onChange(sanitizeHtml(own.current.innerHTML));
          }
        }}
        className={cn("min-h-[1.5em] w-full whitespace-pre-wrap break-words", className)}
      />

      {empty && placeholder ? (
        <span
          className={cn(
            "pointer-events-none absolute left-0 top-0 select-none text-text-secondary",
            TEXT_STYLE.p,
          )}
        >
          {placeholder}
        </span>
      ) : null}
    </div>
  );
}

/** A code block. Monospace, with its language named. */
function CodeBlock({
  block,
  readOnly,
  onChange,
  onKeyDown,
}: {
  block: Block;
  readOnly?: boolean;
  onChange: (change: Partial<Block>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const source = codeText(block.html);

  return (
    <div className="overflow-hidden rounded-panel border border-border-subtle bg-surface-alt">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-1.5">
        <Icon name="code" size={12} className="text-text-secondary" />
        <input
          value={block.lang ?? "text"}
          disabled={readOnly}
          onChange={(event) => onChange({ lang: event.target.value })}
          aria-label="Language"
          className="w-24 border-none bg-transparent font-mono text-[11.5px] text-text-secondary outline-none"
        />
      </div>

      <textarea
        value={source}
        readOnly={readOnly}
        spellCheck={false}
        // A textarea, not contenteditable: code is plain text, and every
        // browser already handles tabs, newlines and undo in one correctly.
        onChange={(event) => onChange({ html: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            const target = event.currentTarget;
            const at = target.selectionStart;
            const next = `${source.slice(0, at)}  ${source.slice(target.selectionEnd)}`;
            onChange({ html: next });
            requestAnimationFrame(() => target.setSelectionRange(at + 2, at + 2));
            return;
          }
          onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLDivElement>);
        }}
        rows={Math.max(3, source.split("\n").length)}
        className="w-full resize-y border-none bg-transparent px-3 py-2.5 font-mono text-[13px] leading-[1.55] text-text-primary outline-none"
      />
    </div>
  );
}

/** The self-contained blocks: media, tables, figures. */
function BoxedBlock({
  block,
  readOnly,
  onChange,
}: {
  block: Block;
  readOnly?: boolean;
  onChange: (change: Partial<Block>) => void;
}) {
  const caption = (
    <Editable
      html={block.caption ?? ""}
      readOnly={readOnly}
      placeholder={readOnly ? undefined : "Caption"}
      className={cn(
        "text-[12.5px] text-text-secondary outline-none",
        block.type === "signature" || block.type === "kpis"
          ? "text-left uppercase tracking-[0.06em]"
          : "text-center",
      )}
      onChange={(html) => onChange({ caption: html })}
    />
  );

  /**
   * A caption sits below a figure and above a titled section.
   *
   * Under a signature block it reads as belonging to the last signatory rather
   * than to the block — "Approved by" printed beneath two names says the wrong
   * thing entirely.
   */
  const captionFirst = block.type === "signature" || block.type === "kpis";

  const frame = (children: React.ReactNode) => (
    <figure className="my-2 flex flex-col gap-2">
      {captionFirst && (block.caption || !readOnly) ? caption : null}
      {children}
      {!captionFirst && (block.caption || !readOnly) ? caption : null}
    </figure>
  );

  switch (block.type) {
    case "image":
      return frame(
        block.src ? (
          <img
            src={block.src}
            alt={stripTags(block.caption)}
            className="w-full rounded-panel object-cover"
          />
        ) : (
          <Placeholder icon="image" label="No image yet" />
        ),
      );

    case "video":
    case "embed": {
      const video = block.type === "video" ? videoSrc(block.src) : block.src ? { kind: "iframe" as const, src: block.src } : null;

      return frame(
        video ? (
          video.kind === "file" ? (
            <video src={video.src} controls className="w-full rounded-panel" />
          ) : (
            <iframe
              src={video.src}
              title={stripTags(block.caption) || "Embed"}
              allowFullScreen
              className="aspect-video w-full rounded-panel border-none"
            />
          )
        ) : (
          <Placeholder icon="play" label="No video yet" />
        ),
      );
    }

    case "gallery":
      return frame(
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${block.gridColumns ?? 3}, minmax(0, 1fr))` }}
        >
          {(block.images ?? []).map((image, index) => (
            <img
              key={index}
              src={image.src}
              alt={image.alt ?? ""}
              className="aspect-square w-full rounded-[10px] object-cover"
            />
          ))}
          {!(block.images ?? []).length ? <Placeholder icon="images" label="No images yet" /> : null}
        </div>,
      );

    case "kpis":
      return frame(
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {(block.kpis ?? []).map((kpi, index) => (
            <div
              key={index}
              className="flex flex-col gap-1 rounded-panel border border-border-subtle bg-surface-alt px-3.5 py-3"
            >
              <span className="text-[12px] text-text-secondary">{kpi.label}</span>
              <span className="flex items-baseline gap-1.5">
                <strong className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
                  {kpi.value}
                </strong>
                {kpi.unit ? (
                  <span className="text-[13px] text-text-secondary">{kpi.unit}</span>
                ) : null}
                {kpi.delta != null ? (
                  <span
                    className={cn(
                      "ml-auto text-[12px] tabular-nums",
                      kpi.delta > 0 ? "text-success" : kpi.delta < 0 ? "text-error" : "text-text-secondary",
                    )}
                  >
                    {kpi.delta > 0 ? "+" : ""}
                    {kpi.delta} %
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>,
      );

    case "table": {
      const columns = block.columns ?? [];
      return frame(
        <div className="overflow-x-auto rounded-panel border border-border-subtle">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-hairline bg-surface-alt">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 py-2 text-left font-medium text-text-secondary"
                  >
                    {column.label ?? column.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(block.rows ?? []).map((row, index) => (
                <tr key={index} className="border-b border-hairline last:border-b-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2 text-text-primary">
                      {row[column.key] == null ? "" : String(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }

    case "signature":
      return frame(
        <div className="flex flex-col gap-2 rounded-panel border border-border-subtle p-3.5">
          {(block.people ?? []).map((person, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 text-[13.5px]">
              <span className="font-medium text-text-primary">{person.name}</span>
              {person.role ? (
                <span className="text-text-secondary">{person.role}</span>
              ) : null}
              {person.email ? (
                <span className="text-text-secondary">{person.email}</span>
              ) : null}

              {/* Signed or pending, in words: a document that hides which is
                  which is the one thing a signature block must not do. */}
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1.25 text-[12px]",
                  person.signedAt ? "text-success" : "text-warning",
                )}
              >
                <Icon name={person.signedAt ? "check" : "clock"} size={12} />
                {person.signedAt ? `signed ${person.signedAt}` : "pending"}
              </span>
            </div>
          ))}
        </div>,
      );

    case "board":
      return frame(
        <WhiteboardBlock
          value={{ shapes: (block.shapes as Whiteboard["shapes"]) ?? [] }}
          readOnly={readOnly}
          onChange={(next) => onChange({ shapes: next.shapes })}
          height={240}
        />,
      );

    default:
      return frame(<Placeholder icon="square" label={BLOCK_TYPES[block.type].label} />);
  }
}

function Placeholder({ icon, label }: { icon: IconName; label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 rounded-panel border border-dashed border-border-subtle bg-surface-alt text-body-s text-text-secondary">
      <Icon name={icon} size={16} />
      {label}
    </div>
  );
}

export { caretAtEdge, selectAll };
