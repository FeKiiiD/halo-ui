import { fileURLToPath } from "node:url";

/**
 * Asserts the whiteboard geometry: bounds, hit testing, freehand smoothing and
 * the viewport transforms.
 *
 * A bounding box that is subtly wrong makes selection miss by a few pixels,
 * which reads as an unresponsive canvas rather than as a bug — so it is never
 * reported, only tolerated.
 *
 * The two that matter most:
 *
 * BOXES ARE NORMALISED. A rectangle dragged up and to the left must have the
 * same box as one dragged down and to the right. Without that it gets a
 * negative width, and selection, hit testing and fit-to-content all silently
 * stop working for it — for exactly half the ways a person can draw.
 *
 * THE SMOOTHED STROKE STAYS INSIDE THE POLYLINE. A spline through the samples
 * themselves overshoots on every direction change, which on a signature or a
 * circled word shows up as a wobble nobody drew.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/whiteboard.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const wb = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  shapeBounds,
  hitTest,
  boardBounds,
  shapesInRect,
  penPath,
  thinPoints,
  toBoard,
  toScreen,
  zoomAt,
  fitView,
  translateShapes,
  boardUid,
  resetBoardUid,
  HIT_MARGIN,
  DEFAULT_BOARD_VIEW,
} = wb;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);
const near = (name, actual, expected, tolerance = 0.001) =>
  cases.push([name, Math.abs(actual - expected) <= tolerance, true]);

const rect = (id, x, y, x2, y2) => ({ id, kind: "rect", x, y, x2, y2 });

/* --- bounds -------------------------------------------------------------- */

const forward = shapeBounds(rect("a", 10, 20, 110, 70));
check("a forward rect has its origin", `${forward.x},${forward.y}`, "10,20");
check("a forward rect has its size", `${forward.w},${forward.h}`, "100,50");

/**
 * The backwards case: dragged up and to the left. Half of all rectangles are
 * drawn this way, and an un-normalised box gives them a negative width.
 */
const backward = shapeBounds(rect("b", 110, 70, 10, 20));
check("a backward rect normalises its origin", `${backward.x},${backward.y}`, "10,20");
check("a backward rect has a positive width", backward.w, 100);
check("a backward rect has a positive height", backward.h, 50);
check("both directions agree", JSON.stringify(forward), JSON.stringify(backward));

// A shape with no second corner is a point, not NaN.
const degenerate = shapeBounds({ id: "c", kind: "line", x: 5, y: 5 });
check("a missing second corner is a point", `${degenerate.w},${degenerate.h}`, "0,0");

const note = shapeBounds({ id: "n", kind: "note", x: 0, y: 0 });
check("a note has a default size", `${note.w},${note.h}`, "180,110");
check("a text default is shorter", shapeBounds({ id: "t", kind: "text", x: 0, y: 0 }).h, 28);
check("an explicit size wins", shapeBounds({ id: "n", kind: "note", x: 0, y: 0, w: 50, h: 60 }).w, 50);

const stroke = shapeBounds({
  id: "p",
  kind: "pen",
  x: 0,
  y: 0,
  points: [{ x: 30, y: 40 }, { x: 10, y: 90 }, { x: 60, y: 55 }],
});
check("a stroke bounds its samples", `${stroke.x},${stroke.y}`, "10,40");
check("a stroke spans its extremes", `${stroke.w},${stroke.h}`, "50,50");
check("an empty stroke is a point", shapeBounds({ id: "p", kind: "pen", x: 3, y: 4, points: [] }).w, 0);

/* --- hit testing ---------------------------------------------------------- */

const target = rect("h", 100, 100, 200, 150);

check("inside hits", hitTest(target, { x: 150, y: 120 }), true);
check("on the edge hits", hitTest(target, { x: 100, y: 100 }), true);
check("far outside misses", hitTest(target, { x: 400, y: 400 }), false);

// The margin is what makes a hairline selectable at all.
check("just outside still hits", hitTest(target, { x: 100 - HIT_MARGIN + 1, y: 125 }), true);
check("past the margin misses", hitTest(target, { x: 100 - HIT_MARGIN - 1, y: 125 }), false);
check("a zero margin is exact", hitTest(target, { x: 99, y: 125 }, 0), false);

// A horizontal line has no height, and must still be hittable.
const hairline = { id: "l", kind: "line", x: 0, y: 50, x2: 200, y2: 50 };
check("a flat line is hittable", hitTest(hairline, { x: 100, y: 50 }), true);
check("a flat line has slack above", hitTest(hairline, { x: 100, y: 45 }), true);

/* --- board bounds and marquee ---------------------------------------------- */

const board = [rect("a", 0, 0, 50, 50), rect("b", 100, 200, 150, 260)];
const all = boardBounds(board);
check("board bounds start at the topmost left", `${all.x},${all.y}`, "0,0");
check("board bounds span everything", `${all.w},${all.h}`, "150,260");
check("an empty board has no bounds", boardBounds([]), null);

// Intersection, not containment: a marquee that only takes fully enclosed
// shapes makes selecting a long stroke nearly impossible.
check("a marquee takes what it overlaps", shapesInRect(board, { x: 25, y: 25, w: 200, h: 200 }).length, 2);
check("a marquee misses what it does not touch", shapesInRect(board, { x: 300, y: 300, w: 10, h: 10 }).length, 0);
check("a partly covered shape is taken", shapesInRect(board, { x: 40, y: 40, w: 20, h: 20 }).length, 1);
// Dragged backwards, a marquee still selects.
check("a backwards marquee works", shapesInRect(board, { x: 60, y: 60, w: -60, h: -60 }).length, 1);

/* --- freehand -------------------------------------------------------------- */

check("no points draws nothing", penPath([]), "");
// A single tap still has to paint a dot.
check("one point draws a dot", penPath([{ x: 5, y: 6 }]), "M5 6l0 0");
check("a stroke opens with a move", penPath([{ x: 0, y: 0 }, { x: 10, y: 10 }]).startsWith("M0 0"), true);
check("each segment is a quadratic", (penPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]).match(/Q/g) || []).length, 2);

/**
 * The overshoot check. A hard direction change — up then straight back down —
 * is where a naive spline bulges outside the path the hand drew.
 */
const spike = [
  { x: 0, y: 100 },
  { x: 50, y: 0 },
  { x: 100, y: 100 },
];
const numbers = (penPath(spike).match(/-?\d+(\.\d+)?/g) || []).map(Number);
const ys = numbers.filter((_, index) => index % 2 === 1);
check("the smoothed stroke never rises above its samples", Math.min(...ys) >= 0, true);
check("nor falls below them", Math.max(...ys) <= 100, true);
check("every coordinate is finite", numbers.every(Number.isFinite), true);

/* --- thinning --------------------------------------------------------------- */

const dense = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0 },
  { x: 1, y: 0 },
  { x: 40, y: 0 },
  { x: 40.5, y: 0 },
  { x: 80, y: 0 },
];
const thin = thinPoints(dense, 2);
check("near-duplicates are dropped", thin.length < dense.length, true);
check("the first sample is kept", `${thin[0].x}`, "0");
// Dropping the last sample shortens the visible stroke by however far the hand
// travelled since the previous kept point.
check("the last sample is always kept", `${thin[thin.length - 1].x}`, "80");
check("a short stroke is untouched", thinPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }], 2).length, 2);
check("a distant run survives", thinPoints([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], 2).length, 3);

/* --- viewport ---------------------------------------------------------------- */

const view = { x: 100, y: 50, z: 2 };

check("screen to board undoes the offset", JSON.stringify(toBoard({ x: 100, y: 50 }, view)), '{"x":0,"y":0}');
check("screen to board undoes the zoom", toBoard({ x: 300, y: 50 }, view).x, 100);

// The round trip has to be exact, or dragging drifts a little on every frame.
const roundTrip = toScreen(toBoard({ x: 421, y: 137 }, view), view);
near("the round trip is exact in x", roundTrip.x, 421);
near("the round trip is exact in y", roundTrip.y, 137);

/**
 * Zoom about the pointer. The point under the cursor must not move, or the
 * content shoots away from wherever you are looking.
 */
const anchor = { x: 400, y: 300 };
const zoomed = zoomAt(view, 1.5, anchor);
const before = toBoard(anchor, view);
const after = toBoard(anchor, zoomed);
near("the anchored point stays put in x", after.x, before.x);
near("the anchored point stays put in y", after.y, before.y);
check("the zoom applied", zoomed.z, 3);

check("zoom clamps at the top", zoomAt({ x: 0, y: 0, z: 4 }, 2, anchor).z, 4);
check("zoom clamps at the bottom", zoomAt({ x: 0, y: 0, z: 0.2 }, 0.5, anchor).z, 0.2);

const fitted = fitView({ x: 0, y: 0, w: 200, h: 100 }, { width: 600, height: 400 });
check("fit zooms in on a small box", fitted.z > 1, true);
check("fit centres the box in x", Math.abs(toScreen({ x: 100, y: 50 }, fitted).x - 300) < 0.001, true);
check("fit centres the box in y", Math.abs(toScreen({ x: 100, y: 50 }, fitted).y - 200) < 0.001, true);
check("fit clamps its zoom", fitView({ x: 0, y: 0, w: 1, h: 1 }, { width: 600, height: 400 }).z, 4);
// A zero-sized box must not zoom to the maximum on nothing.
check("a zero box centres at actual size", fitView({ x: 10, y: 10, w: 0, h: 0 }, { width: 600, height: 400 }).z, 1);
check("no box gives the default view", JSON.stringify(fitView(null, { width: 600, height: 400 })), JSON.stringify(DEFAULT_BOARD_VIEW));

/* --- moving -------------------------------------------------------------------- */

const moved = translateShapes(board, ["a"], 10, 20);
check("the origin moves", `${moved[0].x},${moved[0].y}`, "10,20");
// Both corners move, or a dragged rectangle stretches instead of moving.
check("the far corner moves too", `${moved[0].x2},${moved[0].y2}`, "60,70");
check("its size is unchanged", shapeBounds(moved[0]).w, shapeBounds(board[0]).w);
check("an unselected shape stays", moved[1].x, 100);

const movedPen = translateShapes(
  [{ id: "p", kind: "pen", x: 0, y: 0, points: [{ x: 5, y: 5 }] }],
  ["p"],
  10,
  10,
);
check("a stroke's samples move", `${movedPen[0].points[0].x},${movedPen[0].points[0].y}`, "15,15");

/* --- ids ---------------------------------------------------------------------- */

resetBoardUid();
check("ids do not collide", boardUid() === boardUid(), false);
check("ids carry their prefix", boardUid().startsWith("s"), true);

/* --- report -------------------------------------------------------------------- */

let failed = 0;
for (const [name, actual, expected] of cases) {
  const ok = Object.is(actual, expected);
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(48)} -> ${JSON.stringify(actual)}${
      ok ? "" : `   expected ${JSON.stringify(expected)}`
    }`,
  );
}

console.log(`\n${cases.length - failed}/${cases.length} whiteboard checks passed`);
if (failed) process.exit(1);
