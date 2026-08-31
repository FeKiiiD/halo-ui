import { fileURLToPath } from "node:url";

/**
 * Asserts the diagram geometry: anchor points, side selection, connector
 * routing, selection expansion and duplication.
 *
 * Two checks matter more than the rest.
 *
 * The elbow radius is capped at half of each adjoining leg. Without that cap a
 * short leg overshoots its own corner and the path doubles back on itself — a
 * connector that visibly reverses direction for a few pixels, which reads as a
 * rendering glitch rather than as a bug in the maths.
 *
 * Duplication must copy only the links *between* the copied shapes. A link to
 * something outside the selection, if duplicated, attaches the copy to the
 * original's neighbour — which is never what anyone means by "duplicate".
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/diagram.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const diagram = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  snap,
  newShape,
  anchorPoint,
  pickSides,
  routePath,
  bounds,
  midpoint,
  expandSelection,
  duplicateShapes,
  removeShapes,
  linkGeometry,
  resetUid,
  GRID,
} = diagram;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

const shape = (id, x, y, w = 100, h = 60, rest = {}) => ({
  id,
  type: "rect",
  x,
  y,
  w,
  h,
  ...rest,
});

/* --- snapping --------------------------------------------------------- */

check("snap rounds to the grid", snap(37), 40);
check("snap rounds down", snap(35), 32);
check("snap exactly between", snap(GRID / 2), GRID);
check("snap off still rounds", snap(37.6, false), 38);
check("snap negative", snap(-37), -40);

/* --- placement -------------------------------------------------------- */

resetUid();
const placed = newShape("rect", 200, 150);
check("newShape centres on x", placed.x, 200 - 168 / 2);
check("newShape centres on y", placed.y, 150 - 88 / 2);
check("newShape takes the spec width", placed.w, 168);
check("a note defaults to lime", newShape("note", 0, 0).fill, "lime");
check("free text has no fill", newShape("text", 0, 0).fill, "none");
check("free text is bold", newShape("text", 0, 0).bold, true);
check("a rect is not bold", newShape("rect", 0, 0).bold, false);

resetUid();
const first = newShape("rect", 0, 0).id;
const second = newShape("rect", 0, 0).id;
check("ids are unique", first === second, false);

/* --- anchors ---------------------------------------------------------- */

const a = shape("a", 100, 100, 100, 60);

check("top anchor x is the centre", anchorPoint(a, "top").x, 150);
check("top anchor y is the edge", anchorPoint(a, "top").y, 100);
check("top normal points up", anchorPoint(a, "top").ny, -1);
check("bottom anchor y", anchorPoint(a, "bottom").y, 160);
check("bottom normal points down", anchorPoint(a, "bottom").ny, 1);
check("left anchor x", anchorPoint(a, "left").x, 100);
check("left normal points left", anchorPoint(a, "left").nx, -1);
check("right anchor x", anchorPoint(a, "right").x, 200);
check("right anchor y is the centre", anchorPoint(a, "right").y, 130);

/* --- side selection --------------------------------------------------- */

const centre = shape("c", 0, 0, 100, 100);

check(
  "clearly to the right",
  pickSides(centre, shape("b", 400, 0, 100, 100)).join(),
  "right,left",
);
check("clearly to the left", pickSides(centre, shape("b", -400, 0, 100, 100)).join(), "left,right");
check("clearly below", pickSides(centre, shape("b", 0, 400, 100, 100)).join(), "bottom,top");
check("clearly above", pickSides(centre, shape("b", 0, -400, 100, 100)).join(), "top,bottom");

// A tie goes to the horizontal pair, and must not depend on float noise.
check(
  "an exact diagonal picks horizontal",
  pickSides(centre, shape("b", 300, 300, 100, 100)).join(),
  "right,left",
);
check(
  "mostly down but slightly right",
  pickSides(centre, shape("b", 40, 400, 100, 100)).join(),
  "bottom,top",
);

/* --- routing ---------------------------------------------------------- */

const from = anchorPoint(shape("a", 0, 0, 100, 60), "right");
const to = anchorPoint(shape("b", 300, 200, 100, 60), "left");

const straight = routePath(from, to, "straight");
check("straight has one segment", (straight.match(/L/g) || []).length, 1);
check("straight starts at the anchor", straight.startsWith(`M ${from.x} ${from.y}`), true);
check("straight ends at the target", straight.endsWith(`L ${to.x} ${to.y}`), true);

const curve = routePath(from, to, "curve");
check("curve is a single cubic", (curve.match(/C/g) || []).length, 1);
check("curve starts at the anchor", curve.startsWith(`M ${from.x} ${from.y}`), true);

const elbow = routePath(from, to, "elbow");
check("elbow has two rounded corners", (elbow.match(/Q/g) || []).length, 2);
check("elbow starts at the anchor", elbow.startsWith(`M ${from.x} ${from.y}`), true);
check("elbow ends at the target", elbow.trim().endsWith(`L ${to.x} ${to.y}`), true);

/**
 * The overshoot check. Every coordinate on an elbow must stay inside the
 * bounding box of its own corner points — a radius larger than half a leg
 * makes the path double back, and the excursion is small enough to look like
 * an antialiasing artefact rather than a bug.
 */
function coordsOf(path) {
  return (path.match(/-?\d+(\.\d+)?/g) || []).map(Number);
}

function pairsOf(path) {
  const numbers = coordsOf(path);
  const points = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
  return points;
}

// Two shapes almost touching: the midpoint legs are only a few px long, which
// is exactly the case an uncapped radius breaks.
const tightFrom = anchorPoint(shape("a", 0, 0, 100, 60), "right");
const tightTo = anchorPoint(shape("b", 108, 8, 100, 60), "left");
const tight = routePath(tightFrom, tightTo, "elbow");

const xs = pairsOf(tight).map(([x]) => x);
const ys = pairsOf(tight).map(([, y]) => y);

check(
  "a tight elbow never runs left of its start",
  Math.min(...xs) >= Math.min(tightFrom.x, tightTo.x) - 0.001,
  true,
);
check(
  "a tight elbow never runs right of its end",
  Math.max(...xs) <= Math.max(tightFrom.x, tightTo.x) + 0.001,
  true,
);
check(
  "a tight elbow stays within its y span",
  Math.min(...ys) >= Math.min(tightFrom.y, tightTo.y) - 0.001 &&
    Math.max(...ys) <= Math.max(tightFrom.y, tightTo.y) + 0.001,
  true,
);

// Degenerate: both anchors at the same point must not produce NaN.
const same = anchorPoint(shape("a", 0, 0, 100, 60), "right");
check("a zero-length elbow is finite", coordsOf(routePath(same, same, "elbow")).every(Number.isFinite), true);
check("a zero-length curve is finite", coordsOf(routePath(same, same, "curve")).every(Number.isFinite), true);

/* --- bounds and midpoint ---------------------------------------------- */

const spread = [shape("a", 10, 20, 100, 60), shape("b", 200, 5, 50, 200)];
check("bounds x", bounds(spread).x, 10);
check("bounds y", bounds(spread).y, 5);
check("bounds width spans both", bounds(spread).w, 240);
check("bounds height spans both", bounds(spread).h, 200);
check("bounds of nothing is null", bounds([]), null);
check("midpoint x", midpoint({ x: 0, y: 0 }, { x: 10, y: 40 }).x, 5);
check("midpoint y", midpoint({ x: 0, y: 0 }, { x: 10, y: 40 }).y, 20);

/* --- grouping --------------------------------------------------------- */

const grouped = [
  shape("a", 0, 0, 10, 10, { group: "g1" }),
  shape("b", 20, 0, 10, 10, { group: "g1" }),
  shape("c", 40, 0, 10, 10),
  shape("d", 60, 0, 10, 10, { group: "g2" }),
];

check("selecting one member takes the group", expandSelection(["a"], grouped).sort().join(), "a,b");
check("an ungrouped shape stays alone", expandSelection(["c"], grouped).join(), "c");
check(
  "two groups both expand",
  expandSelection(["a", "d"], grouped).sort().join(),
  "a,b,d",
);
check("expanding nothing gives nothing", expandSelection([], grouped).length, 0);

/* --- duplication ------------------------------------------------------ */

const source = {
  shapes: [shape("a", 0, 0), shape("b", 200, 0), shape("outside", 400, 0)],
  links: [
    { id: "l1", from: "a", to: "b" },
    { id: "l2", from: "b", to: "outside" },
  ],
};

const { diagram: duplicated, created } = duplicateShapes(["a", "b"], source);

check("two shapes were copied", created.length, 2);
check("the originals are still there", duplicated.shapes.length, 5);
check("the inner link was copied", duplicated.links.length, 3);
check(
  "the copied link joins the copies",
  duplicated.links.filter((link) => created.includes(link.from) && created.includes(link.to)).length,
  1,
);
check(
  "no copied link escapes the selection",
  duplicated.links.some((link) => created.includes(link.from) && link.to === "outside"),
  false,
);
check(
  "copies are offset",
  duplicated.shapes.find((s) => s.id === created[0]).x,
  24,
);

/* --- removal ---------------------------------------------------------- */

const pruned = removeShapes(["b"], source);
check("the shape is gone", pruned.shapes.length, 2);
check("both of its links are gone", pruned.links.length, 0);
check("removing nothing changes nothing", removeShapes([], source).links.length, 2);

/* --- link geometry ---------------------------------------------------- */

const byId = { a: shape("a", 0, 0, 100, 60), b: shape("b", 300, 0, 100, 60) };

check(
  "an unpinned link faces its target",
  linkGeometry({ id: "l", from: "a", to: "b" }, byId).from.x,
  100,
);
check(
  "a pinned side is honoured",
  linkGeometry({ id: "l", from: "a", to: "b", fromSide: "top" }, byId).from.y,
  0,
);
check("a dangling link resolves to null", linkGeometry({ id: "l", from: "a", to: "gone" }, byId), null);

/* --- report ----------------------------------------------------------- */

let failed = 0;
for (const [name, actual, expected] of cases) {
  const ok = Object.is(actual, expected);
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(42)} -> ${JSON.stringify(actual)}${
      ok ? "" : `   expected ${JSON.stringify(expected)}`
    }`,
  );
}

console.log(`\n${cases.length - failed}/${cases.length} diagram geometry checks passed`);
if (failed) process.exit(1);
