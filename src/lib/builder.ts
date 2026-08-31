/**
 * Site-builder document model: a plain tree, style resolution across
 * breakpoints, and an HTML/CSS export.
 *
 * The document is `{ id, type, props, style, responsive, children }` and
 * nothing else — serialisable, diffable, and exportable without a runtime. The
 * export is the part worth testing: markup that escapes wrongly is a hole, and
 * a cascade that resolves wrongly produces a page that looks right on the
 * screen it was built on and wrong on every other.
 */

export type BuilderType =
  | "section"
  | "container"
  | "grid"
  | "stack"
  | "divider"
  | "spacer"
  | "heading"
  | "text"
  | "eyebrow"
  | "list"
  | "quote"
  | "image"
  | "video"
  | "button"
  | "card"
  | "stat"
  | "form"
  | "nav"
  | "footer";

export type BreakpointId = "desktop" | "tablet" | "mobile";

export interface BuilderNode {
  id: string;
  type: BuilderType;
  props?: Record<string, unknown>;
  style?: React.CSSProperties;
  /** Per-breakpoint overrides, applied over `style`. */
  responsive?: Partial<Record<BreakpointId, React.CSSProperties>>;
  children?: BuilderNode[];
}

export interface Breakpoint {
  id: BreakpointId;
  label: string;
  icon: string;
  /** Frame width in the canvas. null means full width. */
  width: number | null;
  /** The max-width the exported media query uses. */
  max: number | null;
}

export const BUILDER_BREAKPOINTS: Breakpoint[] = [
  { id: "desktop", label: "Desktop", icon: "monitor", width: null, max: null },
  { id: "tablet", label: "Tablet", icon: "tablet", width: 834, max: 991 },
  { id: "mobile", label: "Mobile", icon: "smartphone", width: 390, max: 767 },
];

export interface BuilderElement {
  type: BuilderType;
  label: string;
  icon: string;
  note: string;
}

export const BUILDER_CATEGORIES: { label: string; items: BuilderElement[] }[] = [
  {
    label: "Structure",
    items: [
      { type: "section", label: "Section", icon: "square", note: "Full-width band" },
      { type: "container", label: "Container", icon: "columns-2", note: "Centred max width" },
      { type: "grid", label: "Grid", icon: "layout-grid", note: "Even columns" },
      { type: "stack", label: "Stack", icon: "rows-3", note: "Flex, one axis" },
      { type: "divider", label: "Rule", icon: "minus", note: "Separator" },
      { type: "spacer", label: "Spacer", icon: "move-vertical", note: "Adjustable breathing room" },
    ],
  },
  {
    label: "Content",
    items: [
      { type: "heading", label: "Heading", icon: "heading", note: "H1 to H4" },
      { type: "text", label: "Paragraph", icon: "type", note: "Body copy" },
      { type: "eyebrow", label: "Eyebrow", icon: "tag", note: "The line above a heading" },
      { type: "list", label: "List", icon: "list", note: "Dots or ticks" },
      { type: "quote", label: "Quote", icon: "quote", note: "Customer verbatim" },
    ],
  },
  {
    label: "Media",
    items: [
      { type: "image", label: "Image", icon: "image", note: "Photo or visual" },
      { type: "video", label: "Video", icon: "play", note: "Embed" },
    ],
  },
  {
    label: "Components",
    items: [
      { type: "button", label: "Button", icon: "mouse-pointer-click", note: "Pill, accent or ink" },
      { type: "card", label: "Card", icon: "square-stack", note: "Feature block" },
      { type: "stat", label: "Key figure", icon: "gauge", note: "Value and label" },
      { type: "form", label: "Field + button", icon: "mail", note: "Address capture" },
      { type: "nav", label: "Navigation bar", icon: "menu", note: "Logo, links, action" },
      { type: "footer", label: "Footer", icon: "panel-bottom", note: "Columns of links" },
    ],
  },
];

export const BUILDER_ELEMENTS: Record<string, BuilderElement> = Object.fromEntries(
  BUILDER_CATEGORIES.flatMap((category) => category.items.map((item) => [item.type, item])),
);

let counter = 0;
export const builderUid = () => `e${(counter += 1).toString(36)}`;
export const resetBuilderUid = () => {
  counter = 0;
};

/** Only these can hold children; everything else is a leaf. */
const CONTAINERS: BuilderType[] = ["section", "container", "grid", "stack", "footer", "nav"];

export const canHoldChildren = (type: BuilderType) => CONTAINERS.includes(type);

/**
 * A new node with the defaults its type needs to look finished.
 *
 * A freshly dropped element that renders as an empty box teaches nothing about
 * what it is, so every type arrives with real placeholder content and the
 * spacing the design system would give it.
 */
export function newNode(type: BuilderType): BuilderNode {
  const base: BuilderNode = { id: builderUid(), type, props: {}, style: {}, children: [] };

  switch (type) {
    case "section":
      return { ...base, style: { paddingTop: 120, paddingBottom: 120, background: "var(--color-surface-page)" } };
    case "container":
      return { ...base, style: { maxWidth: 1120, marginLeft: "auto", marginRight: "auto", paddingLeft: 24, paddingRight: 24 } };
    case "grid":
      return { ...base, style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 } };
    case "stack":
      return { ...base, style: { display: "flex", flexDirection: "column", gap: 16 } };
    case "divider":
      return { ...base, style: { height: 1, background: "var(--color-border-subtle)" } };
    case "spacer":
      return { ...base, style: { height: 48 } };
    case "heading":
      return {
        ...base,
        props: { text: "A heading that says the thing", tag: "h2" },
        style: { fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0 },
      };
    case "text":
      return {
        ...base,
        props: { text: "A paragraph of body copy, long enough to show how it wraps and how it breathes." },
        style: { fontSize: 17, lineHeight: 1.55, margin: 0, color: "var(--color-text-secondary)" },
      };
    case "eyebrow":
      return {
        ...base,
        props: { text: "Eyebrow" },
        style: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, color: "var(--color-text-secondary)" },
      };
    case "list":
      return {
        ...base,
        props: { items: ["Three seconds at the counter", "Nothing to download", "Works on the tablet you own"], marker: "check" },
        style: { fontSize: 16, lineHeight: 1.5 },
      };
    case "quote":
      return {
        ...base,
        props: { text: "It takes three seconds and the customers actually use it.", author: "Marie, Le Bistrot du Coin" },
        style: { fontSize: 22, lineHeight: 1.4, fontStyle: "italic" },
      };
    case "image":
      return { ...base, props: { alt: "" }, style: { width: "100%", height: 280, borderRadius: 16 } };
    case "video":
      return { ...base, style: { width: "100%", height: 360, borderRadius: 16 } };
    case "button":
      return {
        ...base,
        props: { text: "Get started", href: "#", variant: "primary" },
        // A total pill, always: the one shape rule the system never breaks.
        style: { height: 48, paddingLeft: 26, paddingRight: 26, borderRadius: 999, fontSize: 16, fontWeight: 500 },
      };
    case "card":
      return {
        ...base,
        props: { title: "A feature", body: "One sentence on what it does for the person reading." },
        // No shadow and no border: cards separate by value alone.
        style: { padding: 28, borderRadius: 20, background: "var(--color-surface-card)" },
      };
    case "stat":
      return {
        ...base,
        props: { value: "1 208", label: "cards in circulation" },
        style: { display: "flex", flexDirection: "column", gap: 4 },
      };
    case "form":
      return {
        ...base,
        props: { placeholder: "your@email.com", cta: "Request a demo" },
        style: { display: "flex", gap: 8 },
      };
    case "nav":
      return {
        ...base,
        style: { display: "flex", alignItems: "center", gap: 24, paddingTop: 20, paddingBottom: 20 },
      };
    case "footer":
      return {
        ...base,
        style: { display: "flex", gap: 48, paddingTop: 64, paddingBottom: 64, background: "var(--color-surface-alt)" },
      };
    default:
      return base;
  }
}

/* --- tree helpers ------------------------------------------------------- */

export function walk(
  nodes: BuilderNode[],
  visit: (node: BuilderNode, parent: BuilderNode | null, index: number) => void,
  parent: BuilderNode | null = null,
): void {
  nodes.forEach((node, index) => {
    visit(node, parent, index);
    if (node.children) walk(node.children, visit, node);
  });
}

export function findNode(nodes: BuilderNode[], id: string): BuilderNode | null {
  let hit: BuilderNode | null = null;
  walk(nodes, (node) => {
    if (node.id === id) hit = node;
  });
  return hit;
}

export function parentOf(nodes: BuilderNode[], id: string): BuilderNode | null {
  let hit: BuilderNode | null = null;
  walk(nodes, (node, parent) => {
    if (node.id === id) hit = parent;
  });
  return hit;
}

export function mapTree(
  nodes: BuilderNode[],
  transform: (node: BuilderNode) => BuilderNode,
): BuilderNode[] {
  return nodes.map((node) => {
    const next = transform(node);
    return next.children ? { ...next, children: mapTree(next.children, transform) } : next;
  });
}

export function removeNode(nodes: BuilderNode[], id: string): BuilderNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => (node.children ? { ...node, children: removeNode(node.children, id) } : node));
}

export function insertInto(
  nodes: BuilderNode[],
  parentId: string | null,
  node: BuilderNode,
  index?: number,
): BuilderNode[] {
  if (!parentId) {
    const out = [...nodes];
    out.splice(index ?? out.length, 0, node);
    return out;
  }

  return nodes.map((entry) => {
    if (entry.id === parentId) {
      const kids = [...(entry.children ?? [])];
      kids.splice(index ?? kids.length, 0, node);
      return { ...entry, children: kids };
    }
    return entry.children
      ? { ...entry, children: insertInto(entry.children, parentId, node, index) }
      : entry;
  });
}

/** A deep copy with fresh ids throughout — a clone sharing ids is not a copy. */
export function cloneNode(node: BuilderNode): BuilderNode {
  return {
    ...node,
    id: builderUid(),
    children: (node.children ?? []).map(cloneNode),
  };
}

/**
 * True when `id` is `ancestorId` or sits inside it.
 *
 * Used to refuse a drop of a node into its own subtree, which would detach
 * that whole branch from the document and lose it.
 */
export function isInSubtree(nodes: BuilderNode[], id: string, ancestorId: string): boolean {
  if (id === ancestorId) return true;
  const ancestor = findNode(nodes, ancestorId);
  if (!ancestor) return false;

  let found = false;
  walk(ancestor.children ?? [], (node) => {
    if (node.id === id) found = true;
  });
  return found;
}

/* --- style resolution --------------------------------------------------- */

const ORDER: BreakpointId[] = ["desktop", "tablet", "mobile"];

/**
 * The style a node has at a breakpoint.
 *
 * SMALLER SCREENS INHERIT FROM LARGER ONES, as in every cascade-based builder:
 * a tablet override also applies on mobile unless mobile overrides it again.
 * Resolving each breakpoint independently would make every mobile tweak
 * require restating the tablet one, and the two would drift.
 */
export function resolveStyle(node: BuilderNode, breakpoint: BreakpointId): React.CSSProperties {
  const at = ORDER.indexOf(breakpoint);
  let out: React.CSSProperties = { ...(node.style ?? {}) };

  for (let i = 1; i <= at; i++) {
    out = { ...out, ...(node.responsive?.[ORDER[i]!] ?? {}) };
  }
  return out;
}

/** Properties that take a bare number in CSS rather than px. */
const UNITLESS = new Set([
  "fontWeight",
  "lineHeight",
  "opacity",
  "zIndex",
  "flexGrow",
  "flexShrink",
  "order",
  "gridColumn",
  "gridRow",
]);

const cssValue = (key: string, value: unknown) =>
  typeof value === "number" && !UNITLESS.has(key) ? `${value}px` : String(value);

const kebab = (key: string) => key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

export function styleToCss(style?: React.CSSProperties): string {
  return Object.entries(style ?? {})
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => `${kebab(key)}:${cssValue(key, value)}`)
    .join(";");
}

/* --- export ------------------------------------------------------------- */

/**
 * Escapes for both text and attribute contexts.
 *
 * QUOTES ARE NOT OPTIONAL. The source escaped only & < >, so a heading or an
 * alt text containing a double quote closed its own attribute and everything
 * after it became markup — a page that renders as garbage at best, and an
 * injection hole at worst, since the text comes from whoever typed it.
 */
const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

function nodeHtml(node: BuilderNode, depth: number): string {
  const pad = "  ".repeat(depth);
  const cls = `hl-${node.type} ${node.id}`;
  const props = node.props ?? {};
  const kids = (node.children ?? []).map((child) => nodeHtml(child, depth + 1)).join("\n");

  switch (node.type) {
    case "heading": {
      const tag = String(props.tag ?? "h2");
      // The tag is from a fixed set, but it lands in markup, so it is checked
      // rather than trusted.
      const safe = ["h1", "h2", "h3", "h4"].includes(tag) ? tag : "h2";
      return `${pad}<${safe} class="${cls}">${escapeHtml(props.text)}</${safe}>`;
    }
    case "eyebrow":
    case "text":
      return `${pad}<p class="${cls}">${escapeHtml(props.text)}</p>`;
    case "quote":
      return `${pad}<blockquote class="${cls}">${escapeHtml(props.text)}${
        props.author ? `<cite>${escapeHtml(props.author)}</cite>` : ""
      }</blockquote>`;
    case "list": {
      const items = (props.items as string[] | undefined) ?? [];
      return `${pad}<ul class="${cls}">\n${items
        .map((item) => `${pad}  <li>${escapeHtml(item)}</li>`)
        .join("\n")}\n${pad}</ul>`;
    }
    case "image":
      return `${pad}<img class="${cls}" src="${escapeHtml(props.src)}" alt="${escapeHtml(props.alt)}">`;
    case "video":
      return `${pad}<iframe class="${cls}" src="${escapeHtml(props.src)}" title="Video" allowfullscreen></iframe>`;
    case "button":
      return `${pad}<a class="${cls}" href="${escapeHtml(props.href ?? "#")}">${escapeHtml(props.text)}</a>`;
    case "divider":
    case "spacer":
      return `${pad}<div class="${cls}"></div>`;
    case "stat":
      return `${pad}<div class="${cls}"><strong>${escapeHtml(props.value)}</strong><span>${escapeHtml(props.label)}</span></div>`;
    case "card":
      return `${pad}<article class="${cls}"><h3>${escapeHtml(props.title)}</h3><p>${escapeHtml(props.body)}</p></article>`;
    case "form":
      return `${pad}<form class="${cls}"><input placeholder="${escapeHtml(props.placeholder)}"><button type="submit">${escapeHtml(props.cta)}</button></form>`;
    default:
      return `${pad}<div class="${cls}">${kids ? `\n${kids}\n${pad}` : ""}</div>`;
  }
}

/**
 * The document as a standalone HTML page.
 *
 * Rules are emitted per node id, and the breakpoint overrides as max-width
 * media queries in the same order the canvas resolves them — so the exported
 * page cascades exactly the way the preview did.
 */
export function exportHtml(tree: BuilderNode[], title?: string): string {
  const rules: string[] = [];

  walk(tree, (node) => {
    const base = styleToCss(node.style);
    if (base) rules.push(`.${node.id}{${base}}`);

    for (const breakpoint of BUILDER_BREAKPOINTS) {
      if (breakpoint.max == null) continue;
      const css = styleToCss(node.responsive?.[breakpoint.id]);
      if (css) rules.push(`@media (max-width:${breakpoint.max}px){.${node.id}{${css}}}`);
    }
  });

  const body = tree.map((node) => nodeHtml(node, 2)).join("\n");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(title ?? "Page")}</title>`,
    "  <style>",
    rules.map((rule) => `    ${rule}`).join("\n"),
    "  </style>",
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
  ].join("\n");
}
