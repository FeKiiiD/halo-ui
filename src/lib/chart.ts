import * as React from "react";

/**
 * Shared plumbing for the chart family: scales, path geometry, sizing and the
 * reveal animation.
 *
 * NO CHART LIBRARY. Every mark is SVG this file computes, which is why the
 * charts weigh nothing and match the design system exactly rather than being
 * themed into approximate agreement with it.
 */

/**
 * The series palette lives outside the accent family, so the accent keeps its
 * call-to-action meaning. `--chart-highlight` is the one exception: it marks
 * the single series under discussion.
 */
export const seriesColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/* -------------------------------------------------------------------------
 * Formatting
 * ---------------------------------------------------------------------- */

const formatter = (decimals: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export function formatNumber(value: number, decimals = 0, locale = "fr-FR"): string {
  return formatter(decimals, locale).format(value ?? 0);
}

/**
 * Shortens a figure for an axis: 1 208 → "1,2 k", 1 400 000 → "1,4 M".
 *
 * Past ten thousand the decimal is dropped — "12 k" and "12,3 k" carry the
 * same information on an axis, and the shorter one leaves room for the label
 * beside it.
 */
export function formatCompact(value: number, locale = "fr-FR"): string {
  const magnitude = Math.abs(value ?? 0);
  if (magnitude >= 1_000_000) return `${formatNumber(value / 1_000_000, 1, locale)} M`;
  if (magnitude >= 1_000) {
    return `${formatNumber(value / 1_000, magnitude >= 10_000 ? 0 : 1, locale)} k`;
  }
  return formatNumber(value, 0, locale);
}

/* -------------------------------------------------------------------------
 * Scales
 * ---------------------------------------------------------------------- */

/**
 * Rounds a maximum up to a value that divides into readable ticks: 1, 2, 2.5
 * or 5 times a power of ten.
 *
 * An axis topping out at the data's exact maximum produces ticks like 847,
 * 1 694, 2 541 — technically correct and unreadable.
 */
export function niceMax(value: number): number {
  if (!value || value <= 0) return 1;

  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const ratio = value / magnitude;
  const step = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;

  return step * magnitude;
}

/** Evenly spaced tick values, inclusive of both ends. */
export function ticks(max: number, count = 4, min = 0): number[] {
  const span = max - min;
  return Array.from({ length: count + 1 }, (_, index) => min + (span * index) / count);
}

/* -------------------------------------------------------------------------
 * Path geometry
 * ---------------------------------------------------------------------- */

export type Point = [number, number];

/**
 * A polyline, or a smoothed curve through the points.
 *
 * THE CURVE NEVER OVERSHOOTS ITS OWN DATA. Plain Catmull-Rom smoothing lifts
 * the curve above a flat run before a drop -- measured at 3.2px on a 40px
 * range, which on a chart means drawing a value that does not exist. Each
 * control point is therefore clamped to its own segment in y, which removes
 * the overshoot entirely while keeping the curve smooth.
 *
 * Lowering the tension alone does not fix this; it only makes the lie smaller.
 */
export function linePath(points: Point[], smooth = false): string {
  if (!points.length) return "";

  if (!smooth || points.length < 3) {
    return points.map((point, index) => `${index ? "L" : "M"}${point[0]} ${point[1]}`).join(" ");
  }

  const tension = 0.18;
  const clamp = (value: number, a: number, b: number) =>
    Math.max(Math.min(a, b), Math.min(Math.max(a, b), value));

  let path = `M${points[0]![0]} ${points[0]![1]}`;

  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[index - 1] ?? points[index]!;
    const start = points[index]!;
    const end = points[index + 1]!;
    const next = points[index + 2] ?? end;

    const c1x = start[0] + (end[0] - previous[0]) * tension;
    const c2x = end[0] - (next[0] - start[0]) * tension;

    // Only y is clamped: x must stay monotonic for the curve to advance, and
    // it cannot overshoot anyway on an ordered series.
    const c1y = clamp(start[1] + (end[1] - previous[1]) * tension, start[1], end[1]);
    const c2y = clamp(end[1] - (next[1] - start[1]) * tension, start[1], end[1]);

    path += ` C${c1x} ${c1y} ${c2x} ${c2y} ${end[0]} ${end[1]}`;
  }

  return path;
}

/** The same line, closed down to a baseline so it can be filled. */
export function areaPath(points: Point[], baseY: number, smooth = false): string {
  if (!points.length) return "";
  const last = points[points.length - 1]!;
  const first = points[0]!;
  return `${linePath(points, smooth)} L${last[0]} ${baseY} L${first[0]} ${baseY} Z`;
}

/** A point on a circle, and whether the sweep between two angles is the long way. */
export function arc(
  cx: number,
  cy: number,
  radius: number,
  from: number,
  to: number,
): { x0: number; y0: number; x1: number; y1: number; large: 0 | 1 } {
  const at = (angle: number): Point => [
    cx + radius * Math.cos(angle),
    cy + radius * Math.sin(angle),
  ];
  const [x0, y0] = at(from);
  const [x1, y1] = at(to);

  return { x0, y0, x1, y1, large: to - from > Math.PI ? 1 : 0 };
}

/** One ring segment: out along the outer radius, back along the inner one. */
export function donutSlice(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  from: number,
  to: number,
): string {
  const o = arc(cx, cy, outer, from, to);
  const i = arc(cx, cy, inner, to, from);

  return [
    "M", o.x0, o.y0,
    "A", outer, outer, 0, o.large, 1, o.x1, o.y1,
    "L", i.x0, i.y0,
    "A", inner, inner, 0, o.large, 0, i.x1, i.y1,
    "Z",
  ].join(" ");
}

/* -------------------------------------------------------------------------
 * Hooks
 * ---------------------------------------------------------------------- */

/**
 * The container's width, watched.
 *
 * Charts are drawn at their real pixel width rather than scaled from a fixed
 * viewBox: a scaled chart stretches its text and its stroke widths along with
 * everything else, which is why so many charts have 0.7px axes.
 */
export function useWidth(fallback = 640): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(fallback);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(160, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);

    setWidth(Math.max(160, Math.round(element.getBoundingClientRect().width || fallback)));
    return () => observer.disconnect();
  }, [fallback]);

  return [ref, width];
}

/**
 * 0 → 1 once on mount, easing out. Drives the draw-in of every chart.
 *
 * Returns 1 immediately under `prefers-reduced-motion`: a chart that animates
 * is a chart whose values are briefly wrong, which is not a trade worth making
 * for someone who asked for stillness.
 */
export function useReveal(duration = 700, deps: React.DependencyList = []): number {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }

    let frame: number;
    let start: number | undefined;

    const step = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      setProgress(t < 1 ? 1 - Math.pow(1 - t, 3) : 1);
      if (t < 1) frame = requestAnimationFrame(step);
    };

    setProgress(0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, ...deps]);

  return progress;
}

/** Axis label styling, shared so every chart's text matches. */
export const axisTextProps = {
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  fill: "var(--chart-axis)",
} as const;
