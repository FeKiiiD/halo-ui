/**
 * The document model: block types, serialisation to HTML and Markdown, and the
 * counting a writer sees.
 *
 * Pure, because an export is the one artefact of an editor that leaves the
 * application. Markup that escapes wrongly is a hole in whatever renders it,
 * and a word count that reads markup as words is wrong in a way nobody
 * verifies.
 */

import { escapeHtml, htmlToText } from "./rich-text";

export type BlockType =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "callout"
  | "bullet"
  | "numbered"
  | "todo"
  | "code"
  | "divider"
  | "image"
  | "video"
  | "embed"
  | "table"
  | "gallery"
  | "kpis"
  | "signature"
  | "board";

export interface DocColumn {
  key: string;
  label?: string;
}

export interface DocKpi {
  label?: string;
  value?: string | number;
  unit?: string;
  /** Percentage change. Signed on output. */
  delta?: number;
}

export interface DocPerson {
  name?: string;
  role?: string;
  email?: string;
  /** ISO date. Absent means the signature is still pending. */
  signedAt?: string;
}

export interface DocImage {
  src?: string;
  alt?: string;
}

export interface Block {
  id: string;
  type: BlockType;
  /** Inline HTML, for the text-carrying types. */
  html?: string;
  caption?: string;
  checked?: boolean;

  src?: string;
  lang?: string;

  columns?: DocColumn[];
  rows?: Record<string, unknown>[];
  images?: DocImage[];
  gridColumns?: number;
  kpis?: DocKpi[];
  people?: DocPerson[];
  shapes?: { text?: string }[];
}

export interface BlockSpec {
  label: string;
  icon: string;
  tag: string;
  hint?: string;
}

export const BLOCK_TYPES: Record<BlockType, BlockSpec> = {
  p: { label: "Text", icon: "type", tag: "p", hint: "Body copy" },
  h1: { label: "Heading 1", icon: "heading-1", tag: "h1" },
  h2: { label: "Heading 2", icon: "heading-2", tag: "h2" },
  h3: { label: "Heading 3", icon: "heading-3", tag: "h3" },
  quote: { label: "Quote", icon: "quote", tag: "blockquote" },
  callout: { label: "Callout", icon: "info", tag: "aside", hint: "Something to remember" },
  bullet: { label: "Bulleted list", icon: "list", tag: "li" },
  numbered: { label: "Numbered list", icon: "list-ordered", tag: "li" },
  todo: { label: "To-do", icon: "square-check", tag: "li" },
  code: { label: "Code", icon: "code", tag: "pre" },
  divider: { label: "Divider", icon: "minus", tag: "hr" },
  image: { label: "Image", icon: "image", tag: "figure" },
  video: { label: "Video", icon: "play", tag: "figure" },
  embed: { label: "Embed", icon: "frame", tag: "figure" },
  table: { label: "Table", icon: "table-2", tag: "table" },
  gallery: { label: "Gallery", icon: "images", tag: "figure" },
  kpis: { label: "Key figures", icon: "gauge", tag: "figure" },
  signature: { label: "Signatures", icon: "pen-tool", tag: "section" },
  board: { label: "Whiteboard", icon: "pencil-ruler", tag: "figure" },
};

/** Groups for the slash palette, in the order they are usually reached for. */
export const SLASH_GROUPS: { label: string; items: BlockType[] }[] = [
  { label: "Text", items: ["p", "h1", "h2", "h3", "quote", "callout"] },
  { label: "Lists", items: ["bullet", "numbered", "todo"] },
  { label: "Media", items: ["image", "video", "embed", "gallery", "board"] },
  { label: "Data", items: ["table", "kpis", "code"] },
  { label: "Document", items: ["divider", "signature"] },
];

/** Markdown-style openers, applied as the trigger is typed. */
export const SHORTCUTS: [RegExp, BlockType][] = [
  [/^#\s$/, "h1"],
  [/^##\s$/, "h2"],
  [/^###\s$/, "h3"],
  [/^[-*]\s$/, "bullet"],
  [/^1\.\s$/, "numbered"],
  [/^\[\]\s$/, "todo"],
  [/^\[ \]\s$/, "todo"],
  [/^>\s$/, "quote"],
  [/^```$/, "code"],
  [/^---$/, "divider"],
  [/^!\s$/, "callout"],
];

let counter = 0;

/**
 * A new block.
 *
 * A counter rather than Date.now(): two blocks created in the same
 * millisecond — which is what pasting a list does — would otherwise share an
 * id, and React would reuse one DOM node for both.
 */
export const newBlock = (type: BlockType = "p", html = ""): Block => ({
  id: `b${(counter += 1).toString(36)}`,
  type,
  html,
});

export const resetBlockUid = () => {
  counter = 0;
};

export const isList = (type: BlockType) =>
  type === "bullet" || type === "numbered" || type === "todo";

export const isMedia = (type: BlockType) =>
  type === "image" || type === "video" || type === "embed";

/** Types rendered as a self-contained box rather than as a line of text. */
export const isBoxed = (type: BlockType) =>
  isMedia(type) ||
  type === "signature" ||
  type === "table" ||
  type === "gallery" ||
  type === "board" ||
  type === "kpis";

/**
 * The visible text of a block's inline HTML.
 *
 * Delegates to htmlToText, which decodes every entity it introduced. The
 * source decoded `&amp;` but not `&lt;` or `&gt;`, so a document containing
 * escaped markup had it reappear as live tags in the plain-text output — and
 * the word count then counted the tags.
 */
export const stripTags = (html?: string): string => htmlToText(html ?? "");

/** Everything a reader would read, one block per line. */
export function plainText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "divider":
          return "---";
        case "signature":
          return [
            stripTags(block.caption),
            ...(block.people ?? []).map((person) => `${person.name ?? ""} ${person.email ?? ""}`),
          ]
            .join(" ")
            .trim();
        case "gallery":
          return [stripTags(block.caption), ...(block.images ?? []).map((image) => image.alt ?? "")]
            .join(" ")
            .trim();
        case "board":
          return [stripTags(block.caption), ...(block.shapes ?? []).map((shape) => shape.text ?? "")]
            .join(" ")
            .trim();
        case "kpis":
          return [
            stripTags(block.caption),
            ...(block.kpis ?? []).map((kpi) => `${kpi.label ?? ""} ${kpi.value ?? ""}`),
          ]
            .join(" ")
            .trim();
        case "table":
          return [
            stripTags(block.caption),
            ...(block.rows ?? []).map((row) =>
              Object.values(row)
                .filter((cell) => typeof cell !== "object")
                .join(" "),
            ),
          ]
            .join(" ")
            .trim();
        default:
          return isMedia(block.type) ? stripTags(block.caption) : stripTags(block.html);
      }
    })
    .join("\n");
}

/**
 * Words, characters and a reading time.
 *
 * 220 words a minute, floored at one: "0 min read" on a document that has
 * something in it is worse than a rounded-up estimate.
 */
export function counts(blocks: Block[]): { words: number; chars: number; minutes: number } {
  const text = plainText(blocks).trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  return { words, chars: text.length, minutes: Math.max(1, Math.round(words / 220)) };
}

/** The headings, for a table of contents. */
export function outlineOf(blocks: Block[]): { id: string; level: number; text: string }[] {
  return blocks
    .filter((block) => block.type === "h1" || block.type === "h2" || block.type === "h3")
    .map((block) => ({
      id: block.id,
      level: Number(block.type.slice(1)),
      text: stripTags(block.html) || BLOCK_TYPES[block.type].label,
    }));
}

/**
 * A video URL turned into something embeddable.
 *
 * YouTube and Vimeo get their embed form; anything else is played as a file.
 * A watch URL in an iframe renders YouTube's "refused to connect" page, which
 * looks like a bug in the document rather than in the link.
 */
export function videoSrc(url?: string): { kind: "iframe" | "file"; src: string } | null {
  const value = String(url ?? "");

  const youtube = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (youtube) return { kind: "iframe", src: `https://www.youtube.com/embed/${youtube[1]}` };

  const vimeo = value.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };

  return value ? { kind: "file", src: value } : null;
}

/* --- export --------------------------------------------------------------- */

/**
 * A code block's source, as the author typed it.
 *
 * A code block is stored as escaped HTML, so it is decoded rather than
 * stripped: `&lt;div&gt;` is a div the author wrote and wants to see, not
 * markup to remove. Line breaks survive because a snippet without them is not
 * a snippet.
 */
export const codeText = (html?: string): string =>
  String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Numeric entities: a pasted snippet carries &#10; for its newlines, and
    // showing that literally makes the block look like it holds markup rather
    // than the code somebody pasted.
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Last, or an entity the author escaped would be decoded twice.
    .replace(/&amp;/gi, "&");

/** An attribute value. Quotes included, because forgetting them is the bug. */
const attr = (value: unknown) => `"${escapeHtml(String(value ?? ""))}"`;

/**
 * The document as HTML a CMS would store.
 *
 * ATTRIBUTES ARE ESCAPED. The source interpolated `src` and `caption` straight
 * into `src="…"` and `alt="…"`, so an image whose URL or caption contained a
 * quote closed the attribute and everything after it became markup — the same
 * hole as anywhere else that builds HTML by concatenation, and here the values
 * are whatever an author typed or pasted.
 *
 * Consecutive list blocks fold into one ul/ol: a document with five bullets
 * should export as one list, not five.
 */
export function toHtml(blocks: Block[]): string {
  const out: string[] = [];
  let openList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (openList) {
      out.push(`</${openList}>`);
      openList = null;
    }
  };

  for (const block of blocks) {
    const type = block.type;

    if (isList(type)) {
      const tag = type === "numbered" ? "ol" : "ul";
      if (openList !== tag) {
        closeList();
        out.push(`<${tag}${type === "todo" ? ' class="todo"' : ""}>`);
        openList = tag;
      }

      out.push(
        type === "todo"
          ? `<li><input type="checkbox"${block.checked ? " checked" : ""} disabled> ${block.html ?? ""}</li>`
          : `<li>${block.html ?? ""}</li>`,
      );
      continue;
    }

    closeList();

    switch (type) {
      case "divider":
        out.push("<hr>");
        break;

      case "code":
        // codeText, not stripTags: a code block holds source, and stripping
        // tags from it deletes the very thing it is showing — a snippet of
        // HTML comes out as its own text content. It is decoded to what the
        // author typed, then escaped once so it renders rather than executes.
        out.push(`<pre><code>${escapeHtml(codeText(block.html))}</code></pre>`);
        break;

      case "callout":
        out.push(`<aside class="callout">${block.html ?? ""}</aside>`);
        break;

      case "image":
        out.push(
          `<figure><img src=${attr(block.src)} alt=${attr(stripTags(block.caption))}>` +
            (block.caption ? `<figcaption>${block.caption}</figcaption>` : "") +
            "</figure>",
        );
        break;

      case "video":
      case "embed": {
        const video = type === "video" ? videoSrc(block.src) : { kind: "iframe" as const, src: block.src ?? "" };
        out.push(
          "<figure>" +
            (video?.kind === "file"
              ? `<video src=${attr(video.src)} controls></video>`
              : `<iframe src=${attr(video?.src ?? "")} frameborder="0" allowfullscreen></iframe>`) +
            (block.caption ? `<figcaption>${block.caption}</figcaption>` : "") +
            "</figure>",
        );
        break;
      }

      case "kpis": {
        const cells = (block.kpis ?? [])
          .map(
            (kpi) =>
              `<li><strong>${escapeHtml(String(kpi.value ?? ""))}${kpi.unit ? ` ${escapeHtml(kpi.unit)}` : ""}</strong> ` +
              `${escapeHtml(kpi.label ?? "")}` +
              (kpi.delta != null ? ` (${kpi.delta > 0 ? "+" : ""}${kpi.delta} %)` : "") +
              "</li>",
          )
          .join("\n");

        out.push(
          `<figure class="kpis">\n<ul>\n${cells}\n</ul>` +
            (block.caption ? `\n<figcaption>${block.caption}</figcaption>` : "") +
            "\n</figure>",
        );
        break;
      }

      case "board":
        out.push(
          `<figure data-board=${attr((block.shapes ?? []).length)}>` +
            (block.caption ? `<figcaption>${block.caption}</figcaption>` : "") +
            "</figure>",
        );
        break;

      case "gallery": {
        const cells = (block.images ?? [])
          .map(
            (image) =>
              `<figure><img src=${attr(image.src)} alt=${attr(image.alt)}>` +
              (image.alt ? `<figcaption>${escapeHtml(image.alt)}</figcaption>` : "") +
              "</figure>",
          )
          .join("\n");

        out.push(
          `<figure class="gallery" data-columns=${attr(block.gridColumns ?? 3)}>\n${cells}` +
            (block.caption ? `\n<figcaption>${block.caption}</figcaption>` : "") +
            "\n</figure>",
        );
        break;
      }

      case "table": {
        const columns = block.columns ?? [];
        const head = `<tr>${columns.map((column) => `<th>${escapeHtml(column.label ?? column.key)}</th>`).join("")}</tr>`;
        const body = (block.rows ?? [])
          .map(
            (row) =>
              `<tr>${columns
                .map((column) => `<td>${escapeHtml(row[column.key] == null ? "" : String(row[column.key]))}</td>`)
                .join("")}</tr>`,
          )
          .join("\n");

        out.push(
          "<table>" +
            (block.caption ? `<caption>${block.caption}</caption>` : "") +
            `<thead>${head}</thead><tbody>\n${body}\n</tbody></table>`,
        );
        break;
      }

      case "signature": {
        const rows = (block.people ?? [])
          .map(
            (person) =>
              `<li><span class="name">${escapeHtml(person.name ?? "")}</span>` +
              (person.role ? `<span class="role">${escapeHtml(person.role)}</span>` : "") +
              (person.email ? `<a href=${attr(`mailto:${person.email}`)}>${escapeHtml(person.email)}</a>` : "") +
              (person.signedAt
                ? `<time datetime=${attr(person.signedAt)}>signed ${escapeHtml(person.signedAt)}</time>`
                : '<span class="pending">pending</span>') +
              "</li>",
          )
          .join("\n");

        out.push(
          '<section class="signatures">' +
            (block.caption ? `<h4>${block.caption}</h4>` : "") +
            `<ul>\n${rows}\n</ul></section>`,
        );
        break;
      }

      default: {
        const tag = (BLOCK_TYPES[type] ?? BLOCK_TYPES.p).tag;
        out.push(`<${tag}>${block.html ?? ""}</${tag}>`);
      }
    }
  }

  closeList();
  return out.join("\n");
}

/** Inline HTML reduced to Markdown's marks. */
const inlineMarkdown = (html?: string): string =>
  String(html ?? "")
    .replace(/<(b|strong)>(.*?)<\/\1>/gi, "**$2**")
    .replace(/<(i|em)>(.*?)<\/\1>/gi, "*$2*")
    .replace(/<code>(.*?)<\/code>/gi, "`$1`")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

/**
 * The document as Markdown.
 *
 * THE ORDERED COUNTER RESETS ON ANY NON-LIST BLOCK. The source reset it only
 * in the `default` branch, so a numbered list interrupted by a heading — which
 * is what a document with several numbered sections looks like — carried on
 * counting from where the previous list stopped, and the second list started
 * at 4.
 */
export function toMarkdown(blocks: Block[]): string {
  let ordered = 0;

  return blocks
    .map((block) => {
      if (block.type !== "numbered") ordered = 0;

      switch (block.type) {
        case "h1":
          return `# ${inlineMarkdown(block.html)}`;
        case "h2":
          return `## ${inlineMarkdown(block.html)}`;
        case "h3":
          return `### ${inlineMarkdown(block.html)}`;
        case "quote":
          return `> ${inlineMarkdown(block.html)}`;
        case "callout":
          return `> [!note] ${inlineMarkdown(block.html)}`;
        case "bullet":
          return `- ${inlineMarkdown(block.html)}`;
        case "todo":
          return `- [${block.checked ? "x" : " "}] ${inlineMarkdown(block.html)}`;
        case "numbered":
          ordered += 1;
          return `${ordered}. ${inlineMarkdown(block.html)}`;
        case "code":
          return `\`\`\`${block.lang && block.lang !== "text" ? block.lang : ""}\n${codeText(block.html)}\n\`\`\``;
        case "divider":
          return "---";
        case "image":
          return `![${block.caption ?? ""}](${block.src ?? ""})`;
        case "video":
        case "embed":
          return `[${block.caption ?? block.src ?? ""}](${block.src ?? ""})`;

        case "kpis":
          return (
            (block.caption ? `**${block.caption}**\n\n` : "") +
            (block.kpis ?? [])
              .map(
                (kpi) =>
                  `- **${kpi.value ?? ""}${kpi.unit ? ` ${kpi.unit}` : ""}** ${kpi.label ?? ""}` +
                  (kpi.delta != null ? ` (${kpi.delta > 0 ? "+" : ""}${kpi.delta} %)` : ""),
              )
              .join("\n")
          );

        case "board":
          return `> Whiteboard${block.caption ? ` — ${block.caption}` : ""} (${(block.shapes ?? []).length} objects)`;

        case "gallery":
          return (
            (block.caption ? `**${block.caption}**\n\n` : "") +
            (block.images ?? []).map((image) => `![${image.alt ?? ""}](${image.src ?? ""})`).join("\n")
          );

        case "table": {
          const columns = block.columns ?? [];
          const line = (cells: string[]) => `| ${cells.join(" | ")} |`;

          return (
            (block.caption ? `**${block.caption}**\n\n` : "") +
            [line(columns.map((column) => column.label ?? column.key)), line(columns.map(() => "---"))]
              .concat(
                (block.rows ?? []).map((row) =>
                  line(columns.map((column) => (row[column.key] == null ? "" : String(row[column.key])))),
                ),
              )
              .join("\n")
          );
        }

        case "signature":
          return (
            (block.caption ? `**${block.caption}**\n\n` : "") +
            (block.people ?? [])
              .map(
                (person) =>
                  `- ${person.name ?? ""}${person.role ? ` — ${person.role}` : ""}` +
                  `${person.email ? ` <${person.email}>` : ""}` +
                  (person.signedAt ? ` · signed ${person.signedAt}` : " · pending"),
              )
              .join("\n")
          );

        default:
          return inlineMarkdown(block.html);
      }
    })
    .join("\n\n");
}

/* --- editing ---------------------------------------------------------------- */

/** Moves a block by one position, returning the same array when it cannot. */
export function moveBlock(blocks: Block[], id: string, delta: number): Block[] {
  const index = blocks.findIndex((block) => block.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= blocks.length) return blocks;

  const next = [...blocks];
  next.splice(target, 0, next.splice(index, 1)[0]!);
  return next;
}

/** Removes a block, never leaving the document with none to type in. */
export function removeBlock(blocks: Block[], id: string): Block[] {
  const next = blocks.filter((block) => block.id !== id);
  return next.length ? next : [newBlock("p")];
}

/** A copy placed directly after the original. */
export function duplicateBlock(blocks: Block[], id: string): Block[] {
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) return blocks;

  const next = [...blocks];
  next.splice(index + 1, 0, { ...blocks[index]!, id: newBlock().id });
  return next;
}

/** Whether typing `text` in a block should convert it. */
export function shortcutFor(text: string): BlockType | null {
  for (const [pattern, type] of SHORTCUTS) {
    if (pattern.test(text)) return type;
  }
  return null;
}
