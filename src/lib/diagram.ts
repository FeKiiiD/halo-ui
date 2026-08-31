/**
 * Free-form diagramming geometry: shapes, anchors and connector routing.
 *
 * This is the calculation, kept out of the canvas component so the canvas is
 * only about gestures — and so the routing can be tested without a browser,
 * which is the only way anyone finds out a connector is subtly wrong.
 */

export type ShapeType =
  | "rect"
  | "round"
  | "pill"
  | "ellipse"
  | "diamond"
  | "parallelogram"
  | "hexagon"
  | "note"
  | "text"
  | "frame";

export type FillName =
  | "paper"
  | "mist"
  | "lime"
  | "ink"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "none";

export type LinkStyle = "elbow" | "curve" | "straight";
export type Side = "top" | "right" | "bottom" | "left";

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  fill?: FillName;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  fontSize?: number;
  bold?: boolean;
  /** Members of a group select and move together. */
  group?: string;
  locked?: boolean;
}

export interface Link {
  id: string;
  from: string;
  to: string;
  style?: LinkStyle;
  /** Pins the connector to a side instead of choosing one. */
  fromSide?: Side;
  toSide?: Side;
  label?: string;
  dashed?: boolean;
}

export interface Diagram {
  shapes: Shape[];
  links: Link[];
}

export interface Anchor {
  x: number;
  y: number;
  /** Outward normal, used to bend a curve away from the shape. */
  nx: number;
  ny: number;
}

export const GRID = 8;

export const snap = (value: number, on = true): number =>
  on ? Math.round(value / GRID) * GRID : Math.round(value);

export interface ShapeSpec {
  label: string;
  icon: string;
  w: number;
  h: number;
  css?: React.CSSProperties;
  /** Extra inset for a clipped silhouette, so text stays inside the outline. */
  pad?: number;
  fill?: FillName;
  align?: Shape["align"];
  valign?: Shape["valign"];
  /** No outline and no fill — a text label rather than a box. */
  bare?: boolean;
  /** Painted behind everything: a frame groups visually, not structurally. */
  back?: boolean;
  dashed?: boolean;
}

/**
 * Every silhouette is CSS. Shapes are HTML boxes rather than SVG paths, so the
 * text inside wraps, selects and edits like text — which is what a diagram is
 * mostly made of.
 */
export const SHAPES: Record<ShapeType, ShapeSpec> = {
  rect: { label: "Rectangle", icon: "square", w: 168, h: 88 },
  round: { label: "Rounded", icon: "squircle", w: 168, h: 88, css: { borderRadius: 16 } },
  pill: { label: "Terminator", icon: "rectangle-horizontal", w: 168, h: 64, css: { borderRadius: 999 } },
  ellipse: { label: "Ellipse", icon: "circle", w: 152, h: 108, css: { borderRadius: "50%" } },
  diamond: {
    label: "Decision",
    icon: "diamond",
    w: 168,
    h: 112,
    css: { clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" },
    pad: 26,
  },
  parallelogram: {
    label: "Data",
    icon: "parentheses",
    w: 180,
    h: 84,
    css: { clipPath: "polygon(14% 0,100% 0,86% 100%,0 100%)" },
    pad: 26,
  },
  hexagon: {
    label: "Preparation",
    icon: "hexagon",
    w: 180,
    h: 88,
    css: { clipPath: "polygon(12% 0,88% 0,100% 50%,88% 100%,12% 100%,0 50%)" },
    pad: 24,
  },
  note: {
    label: "Sticky note",
    icon: "sticky-note",
    w: 148,
    h: 132,
    css: { borderRadius: "2px 18px 2px 2px" },
    fill: "lime",
    align: "left",
  },
  text: { label: "Text", icon: "type", w: 200, h: 44, bare: true, align: "left" },
  frame: {
    label: "Frame",
    icon: "group",
    w: 340,
    h: 220,
    css: { borderRadius: 14 },
    back: true,
    dashed: true,
    align: "left",
    valign: "top",
  },
};

export const SHAPE_GROUPS: { label: string; items: ShapeType[] }[] = [
  { label: "Shapes", items: ["rect", "round", "pill", "ellipse"] },
  { label: "Flowchart", items: ["diamond", "parallelogram", "hexagon"] },
  { label: "Annotation", items: ["note", "text", "frame"] },
];

/**
 * Fills read from semantic tokens, so a diagram inverts with the theme rather
 * than going grey. `lime` is the one fixed pair: the accent always takes ink
 * text, in both régimes.
 */
export const FILLS: Record<FillName, { label: string; bg: string; fg: string; line: string }> = {
  paper: {
    label: "White",
    bg: "var(--color-surface-card)",
    fg: "var(--color-text-primary)",
    line: "var(--color-border-strong)",
  },
  mist: {
    label: "Mint",
    bg: "var(--color-mist)",
    fg: "var(--color-text-primary)",
    line: "var(--color-mist-strong)",
  },
  lime: {
    label: "Lime",
    bg: "var(--color-accent)",
    fg: "var(--color-accent-ink)",
    line: "var(--color-accent-deep)",
  },
  ink: {
    label: "Ink",
    bg: "var(--color-text-primary)",
    fg: "var(--color-surface-page)",
    line: "var(--color-text-primary)",
  },
  success: {
    label: "Green",
    bg: "var(--color-success-soft)",
    fg: "var(--color-text-primary)",
    line: "var(--color-success)",
  },
  warning: {
    label: "Amber",
    bg: "var(--color-warning-soft)",
    fg: "var(--color-text-primary)",
    line: "var(--color-warning)",
  },
  error: {
    label: "Red",
    bg: "var(--color-error-soft)",
    fg: "var(--color-text-primary)",
    line: "var(--color-error)",
  },
  info: {
    label: "Blue",
    bg: "var(--color-info-soft)",
    fg: "var(--color-text-primary)",
    line: "var(--color-info)",
  },
  none: { label: "No fill", bg: "transparent", fg: "var(--color-text-primary)", line: "transparent" },
};

export const FILL_ORDER: FillName[] = [
  "paper",
  "mist",
  "lime",
  "ink",
  "success",
  "warning",
  "error",
  "info",
  "none",
];

export const LINK_STYLES: Record<LinkStyle, { label: string; icon: string }> = {
  elbow: { label: "Elbow", icon: "spline" },
  curve: { label: "Curve", icon: "waypoints" },
  straight: { label: "Straight", icon: "minus" },
};

let counter = 0;

/**
 * Ids are a counter, not Math.random: two shapes created in the same
 * millisecond must not collide, and a deterministic sequence is testable.
 */
export const uid = (prefix: string): string => `${prefix}${(counter += 1).toString(36)}`;

/** Only for tests, so an expected id sequence can start from a known point. */
export const resetUid = (): void => {
  counter = 0;
};

export function newShape(type: ShapeType, x: number, y: number): Shape {
  const spec = SHAPES[type] ?? SHAPES.rect;

  return {
    id: uid("s"),
    type,
    // Centred on the pointer: you place a shape where you clicked, not with
    // its corner there.
    x: Math.round(x - spec.w / 2),
    y: Math.round(y - spec.h / 2),
    w: spec.w,
    h: spec.h,
    text: "",
    fill: spec.fill ?? (spec.bare ? "none" : "paper"),
    align: spec.align ?? "center",
    valign: spec.valign ?? "middle",
    fontSize: type === "text" ? 17 : 15,
    bold: type === "text",
  };
}

export const boxOf = (shape: Shape) => ({
  x: shape.x,
  y: shape.y,
  w: shape.w,
  h: shape.h,
  cx: shape.x + shape.w / 2,
  cy: shape.y + shape.h / 2,
});

export function anchorPoint(shape: Shape, side: Side): Anchor {
  const box = boxOf(shape);

  if (side === "top") return { x: box.cx, y: box.y, nx: 0, ny: -1 };
  if (side === "bottom") return { x: box.cx, y: box.y + box.h, nx: 0, ny: 1 };
  if (side === "left") return { x: box.x, y: box.cy, nx: -1, ny: 0 };
  return { x: box.x + box.w, y: box.cy, nx: 1, ny: 0 };
}

/**
 * With no side pinned, pick the pair facing each other — the choice a person
 * would make. Whichever axis separates the two shapes more decides.
 */
export function pickSides(a: Shape, b: Shape): [Side, Side] {
  const from = boxOf(a);
  const to = boxOf(b);
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? ["right", "left"] : ["left", "right"];
  }
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

/** Corner radius on an elbow. */
const ELBOW_RADIUS = 10;

export function routePath(p: Anchor, q: Anchor, style: LinkStyle = "elbow"): string {
  if (style === "straight") return `M ${p.x} ${p.y} L ${q.x} ${q.y}`;

  if (style === "curve") {
    // The handle length grows with distance but never collapses, so a curve
    // between two touching shapes still leaves its anchor perpendicular.
    const reach = Math.max(40, Math.hypot(q.x - p.x, q.y - p.y) * 0.35);
    return (
      `M ${p.x} ${p.y}` +
      ` C ${p.x + p.nx * reach} ${p.y + p.ny * reach},` +
      ` ${q.x + q.nx * reach} ${q.y + q.ny * reach},` +
      ` ${q.x} ${q.y}`
    );
  }

  // Elbow: out along the anchor's normal, across at the midpoint, then in.
  const points: { x: number; y: number }[] = [{ x: p.x, y: p.y }];

  if (p.nx !== 0) {
    const mx = (p.x + q.x) / 2;
    points.push({ x: mx, y: p.y }, { x: mx, y: q.y });
  } else {
    const my = (p.y + q.y) / 2;
    points.push({ x: p.x, y: my }, { x: q.x, y: my });
  }
  points.push({ x: q.x, y: q.y });

  // Rounded corners, so it does not read as a wiring diagram. The radius is
  // capped at half of each adjoining leg, or a short leg would overshoot its
  // own corner and the path would double back.
  let d = `M ${points[0]!.x} ${points[0]!.y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1]!;
    const corner = points[i]!;
    const after = points[i + 1]!;

    const inVector = { x: corner.x - before.x, y: corner.y - before.y };
    const outVector = { x: after.x - corner.x, y: after.y - corner.y };
    const inLength = Math.hypot(inVector.x, inVector.y) || 1;
    const outLength = Math.hypot(outVector.x, outVector.y) || 1;
    const radius = Math.min(ELBOW_RADIUS, inLength / 2, outLength / 2);

    d += ` L ${corner.x - (inVector.x / inLength) * radius} ${corner.y - (inVector.y / inLength) * radius}`;
    d += ` Q ${corner.x} ${corner.y} ${corner.x + (outVector.x / outLength) * radius} ${corner.y + (outVector.y / outLength) * radius}`;
  }

  const last = points[points.length - 1]!;
  return `${d} L ${last.x} ${last.y}`;
}

export const midpoint = (p: { x: number; y: number }, q: { x: number; y: number }) => ({
  x: (p.x + q.x) / 2,
  y: (p.y + q.y) / 2,
});

export function bounds(shapes: Shape[]): { x: number; y: number; w: number; h: number } | null {
  if (!shapes.length) return null;

  const x1 = Math.min(...shapes.map((shape) => shape.x));
  const y1 = Math.min(...shapes.map((shape) => shape.y));
  const x2 = Math.max(...shapes.map((shape) => shape.x + shape.w));
  const y2 = Math.max(...shapes.map((shape) => shape.y + shape.h));

  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export interface Alignment {
  id: string;
  icon: string;
  label: string;
  apply: (shape: Shape, box: { x: number; y: number; w: number; h: number }) => Partial<Shape>;
}

export const ALIGNMENTS: Alignment[] = [
  { id: "left", icon: "align-start-vertical", label: "Align left", apply: (_, box) => ({ x: box.x }) },
  {
    id: "hcenter",
    icon: "align-center-vertical",
    label: "Centre horizontally",
    apply: (shape, box) => ({ x: Math.round(box.x + box.w / 2 - shape.w / 2) }),
  },
  {
    id: "right",
    icon: "align-end-vertical",
    label: "Align right",
    apply: (shape, box) => ({ x: box.x + box.w - shape.w }),
  },
  { id: "top", icon: "align-start-horizontal", label: "Align top", apply: (_, box) => ({ y: box.y }) },
  {
    id: "vcenter",
    icon: "align-center-horizontal",
    label: "Centre vertically",
    apply: (shape, box) => ({ y: Math.round(box.y + box.h / 2 - shape.h / 2) }),
  },
  {
    id: "bottom",
    icon: "align-end-horizontal",
    label: "Align bottom",
    apply: (shape, box) => ({ y: box.y + box.h - shape.h }),
  },
];

/**
 * Selecting one member of a group selects the whole group — that is what
 * grouping is for.
 */
export function expandSelection(ids: string[], shapes: Shape[]): string[] {
  const groups = new Set(
    shapes.filter((shape) => ids.includes(shape.id) && shape.group).map((shape) => shape.group),
  );

  return [
    ...new Set([
      ...ids,
      ...shapes.filter((shape) => shape.group && groups.has(shape.group)).map((shape) => shape.id),
    ]),
  ];
}

/**
 * Copies shapes and the links *between* them. A link to something outside the
 * selection is dropped rather than duplicated: it would otherwise attach the
 * copy to the original's neighbour, which nobody means by "duplicate".
 */
export function duplicateShapes(
  ids: string[],
  diagram: Diagram,
  offset = 24,
): { diagram: Diagram; created: string[] } {
  const remap = new Map<string, string>();

  const copies = diagram.shapes
    .filter((shape) => ids.includes(shape.id))
    .map((shape) => {
      const copy = { ...shape, id: uid("s"), x: shape.x + offset, y: shape.y + offset };
      remap.set(shape.id, copy.id);
      return copy;
    });

  const innerLinks = diagram.links
    .filter((link) => remap.has(link.from) && remap.has(link.to))
    .map((link) => ({
      ...link,
      id: uid("l"),
      from: remap.get(link.from)!,
      to: remap.get(link.to)!,
    }));

  return {
    diagram: {
      shapes: [...diagram.shapes, ...copies],
      links: [...diagram.links, ...innerLinks],
    },
    created: copies.map((copy) => copy.id),
  };
}

/** Removes shapes and every link that touched them. */
export function removeShapes(ids: string[], diagram: Diagram): Diagram {
  return {
    shapes: diagram.shapes.filter((shape) => !ids.includes(shape.id)),
    links: diagram.links.filter(
      (link) => !ids.includes(link.from) && !ids.includes(link.to) && !ids.includes(link.id),
    ),
  };
}

/** Resolves both ends of a link to points, choosing sides when unpinned. */
export function linkGeometry(
  link: Link,
  byId: Record<string, Shape>,
): { from: Anchor; to: Anchor } | null {
  const a = byId[link.from];
  const b = byId[link.to];
  if (!a || !b) return null;

  const [autoFrom, autoTo] = pickSides(a, b);
  return {
    from: anchorPoint(a, link.fromSide ?? autoFrom),
    to: anchorPoint(b, link.toSide ?? autoTo),
  };
}
