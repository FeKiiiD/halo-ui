/**
 * Whiteboard geometry: shape bounds, hit testing, freehand smoothing and
 * viewport transforms.
 *
 * Kept pure so the maths can be checked without a browser. A bounding box that
 * is subtly wrong makes selection miss by a few pixels — which reads as an
 * unresponsive canvas rather than as a bug, so it never gets reported.
 */

export type ShapeKind = "pen" | "rect" | "ellipse" | "arrow" | "line" | "text" | "note";

export interface BoardPoint {
  x: number;
  y: number;
}

export interface BoardShape {
  id: string;
  kind: ShapeKind;
  /** Origin, or the first corner of a two-point shape. */
  x: number;
  y: number;
  /** The opposite corner, for rect, ellipse, arrow and line. */
  x2?: number;
  y2?: number;
  /** Explicit size, for text and notes. */
  w?: number;
  h?: number;
  /** The stroke, for a freehand path. */
  points?: BoardPoint[];
  text?: string;
  stroke?: string;
  fill?: string | null;
  width?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardView {
  x: number;
  y: number;
  /** Zoom. 1 is actual size. */
  z: number;
}

export const DEFAULT_BOARD_VIEW: BoardView = { x: 0, y: 0, z: 1 };

/** Default sizes for the shapes that carry text. */
const NOTE_W = 180;
const NOTE_H = 110;
const TEXT_H = 28;

let counter = 0;
export const boardUid = () => `s${(counter += 1).toString(36)}`;
export const resetBoardUid = () => {
  counter = 0;
};

/**
 * The axis-aligned box a shape occupies.
 *
 * NORMALISED, so a rectangle dragged up and to the left has the same box as
 * one dragged down and to the right. Without that, every shape drawn
 * "backwards" gets a negative width, and selection, hit testing and the
 * fit-to-content bounds all silently stop working for it.
 */
export function shapeBounds(shape: BoardShape): Rect {
  if (shape.kind === "pen") {
    const points = shape.points ?? [];
    if (!points.length) return { x: shape.x, y: shape.y, w: 0, h: 0 };

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  if (shape.kind === "text" || shape.kind === "note") {
    return {
      x: shape.x,
      y: shape.y,
      w: shape.w ?? NOTE_W,
      h: shape.h ?? (shape.kind === "note" ? NOTE_H : TEXT_H),
    };
  }

  const x2 = shape.x2 ?? shape.x;
  const y2 = shape.y2 ?? shape.y;

  return {
    x: Math.min(shape.x, x2),
    y: Math.min(shape.y, y2),
    w: Math.abs(x2 - shape.x),
    h: Math.abs(y2 - shape.y),
  };
}

/** Slack around a shape's box, in px, so thin shapes stay clickable. */
export const HIT_MARGIN = 8;

/**
 * Whether a point lands on a shape.
 *
 * The margin is what makes a 1px line selectable at all: without it, hitting a
 * hairline exactly is a test of mouse precision rather than of intent.
 */
export function hitTest(shape: BoardShape, point: BoardPoint, margin = HIT_MARGIN): boolean {
  const box = shapeBounds(shape);
  return (
    point.x >= box.x - margin &&
    point.x <= box.x + box.w + margin &&
    point.y >= box.y - margin &&
    point.y <= box.y + box.h + margin
  );
}

/** The box holding every shape, or null when there are none. */
export function boardBounds(shapes: BoardShape[]): Rect | null {
  if (!shapes.length) return null;

  const boxes = shapes.map(shapeBounds);
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));

  return {
    x,
    y,
    w: Math.max(...boxes.map((box) => box.x + box.w)) - x,
    h: Math.max(...boxes.map((box) => box.y + box.h)) - y,
  };
}

/** Shapes whose box intersects a marquee. */
export function shapesInRect(shapes: BoardShape[], rect: Rect): BoardShape[] {
  const left = Math.min(rect.x, rect.x + rect.w);
  const right = Math.max(rect.x, rect.x + rect.w);
  const top = Math.min(rect.y, rect.y + rect.h);
  const bottom = Math.max(rect.y, rect.y + rect.h);

  return shapes.filter((shape) => {
    const box = shapeBounds(shape);
    // Intersection, not containment: a marquee that only takes fully enclosed
    // shapes makes selecting a long stroke nearly impossible.
    return box.x < right && box.x + box.w > left && box.y < bottom && box.y + box.h > top;
  });
}

/**
 * A freehand stroke as a smoothed path.
 *
 * Each segment is a quadratic whose control point is the previous sample and
 * whose end is the midpoint of the pair. That keeps the curve inside the
 * polyline the hand actually drew — a spline through the samples themselves
 * overshoots on every direction change, which on a signature or a circled word
 * is immediately visible as a wobble that was never drawn.
 */
export function penPath(points: BoardPoint[]): string {
  if (!points.length) return "";

  const first = points[0]!;
  // A single tap still has to paint something, or a dot cannot be drawn.
  if (points.length < 2) return `M${first.x} ${first.y}l0 0`;

  let d = `M${first.x} ${first.y}`;

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    d += `Q${previous.x} ${previous.y} ${(previous.x + current.x) / 2} ${(previous.y + current.y) / 2}`;
  }

  return d;
}

/**
 * Drops samples closer than `tolerance` to the previous kept one.
 *
 * A pointer emits far more samples than a stroke needs, and every one is
 * stored, serialised and re-rendered forever. Thinning at capture keeps a
 * board that has been drawn on for an hour from becoming slow to open.
 */
export function thinPoints(points: BoardPoint[], tolerance = 2): BoardPoint[] {
  if (points.length < 3) return points;

  const out: BoardPoint[] = [points[0]!];

  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1]!;
    const point = points[i]!;
    if (Math.hypot(point.x - last.x, point.y - last.y) >= tolerance) out.push(point);
  }

  // The final sample is always kept: dropping it shortens the visible stroke
  // by however far the hand travelled since the last kept point.
  out.push(points[points.length - 1]!);
  return out;
}

/** Screen point to board coordinates. */
export const toBoard = (point: BoardPoint, view: BoardView): BoardPoint => ({
  x: (point.x - view.x) / view.z,
  y: (point.y - view.y) / view.z,
});

/** Board point to screen coordinates. */
export const toScreen = (point: BoardPoint, view: BoardView): BoardPoint => ({
  x: point.x * view.z + view.x,
  y: point.y * view.z + view.y,
});

/**
 * Zooms about a fixed screen point.
 *
 * Zooming about the origin instead makes the content shoot away from wherever
 * the pointer is, which on an unbounded canvas means losing your place.
 */
export function zoomAt(view: BoardView, factor: number, at: BoardPoint, min = 0.2, max = 4): BoardView {
  const z = Math.max(min, Math.min(max, view.z * factor));
  return {
    z,
    x: at.x - ((at.x - view.x) / view.z) * z,
    y: at.y - ((at.y - view.y) / view.z) * z,
  };
}

/** A view that fits `rect` into a viewport, with padding. */
export function fitView(
  rect: Rect | null,
  viewport: { width: number; height: number },
  padding = 40,
): BoardView {
  if (!rect || rect.w <= 0 || rect.h <= 0) {
    // A single shape, or none: centre at actual size rather than zooming to
    // the maximum on a zero-sized box.
    return rect
      ? { z: 1, x: viewport.width / 2 - rect.x, y: viewport.height / 2 - rect.y }
      : DEFAULT_BOARD_VIEW;
  }

  const z = Math.max(
    0.2,
    Math.min(4, Math.min((viewport.width - padding * 2) / rect.w, (viewport.height - padding * 2) / rect.h)),
  );

  return {
    z,
    x: viewport.width / 2 - (rect.x + rect.w / 2) * z,
    y: viewport.height / 2 - (rect.y + rect.h / 2) * z,
  };
}

/** Moves shapes by a delta, whatever their kind. */
export function translateShapes(shapes: BoardShape[], ids: string[], dx: number, dy: number): BoardShape[] {
  return shapes.map((shape) => {
    if (!ids.includes(shape.id)) return shape;

    if (shape.kind === "pen") {
      return {
        ...shape,
        x: shape.x + dx,
        y: shape.y + dy,
        points: (shape.points ?? []).map((point) => ({ x: point.x + dx, y: point.y + dy })),
      };
    }

    return {
      ...shape,
      x: shape.x + dx,
      y: shape.y + dy,
      // Both corners move, or a dragged rectangle stretches instead of moving.
      ...(shape.x2 != null ? { x2: shape.x2 + dx } : {}),
      ...(shape.y2 != null ? { y2: shape.y2 + dy } : {}),
    };
  });
}
