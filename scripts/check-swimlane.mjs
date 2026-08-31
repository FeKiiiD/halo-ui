import { fileURLToPath } from "node:url";

/**
 * Asserts the swimlane geometry: lane placement, phase bands, marquee hits,
 * group moves and edge routing.
 *
 * The backward edge is the check that matters. When the target sits left of
 * the source, a midpoint route turns behind the source's own exit — the
 * connector runs forward, doubles back through both cards and arrives from the
 * wrong side. On a journey that loops (a rejected payment returning to the
 * counter) that is the common case, and it reads as a rendering artefact
 * rather than as wrong geometry, so it never gets reported.
 *
 * The group move is the second. The lane shift has to apply as a delta: three
 * steps dragged down together from three different lanes must stay three lanes
 * apart, not collapse onto the lane under the pointer.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/swimlane.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const swim = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  NODE_W,
  NODE_H,
  swimSnap,
  laneIndexOf,
  laneTop,
  nodeTop,
  laneAt,
  phaseBands,
  contentWidth,
  contentHeight,
  swimEdgePath,
  moveNodes,
  nodesInBand,
  removeSwimNodes,
  removeLane,
  phaseTone,
  isUniqueKind,
} = swim;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

const LANE_H = 108;
const lanes = [
  { id: "a", label: "Customer" },
  { id: "b", label: "Counter" },
  { id: "c", label: "Platform" },
];
const node = (id, laneId, x, rest = {}) => ({ id, laneId, x, label: id, ...rest });

/* --- snapping and lanes ------------------------------------------------ */

check("snap to the 16 grid", swimSnap(41), 48);
check("snap rounds down", swimSnap(39), 32);
check("snap is exact on the grid", swimSnap(32), 32);

check("first lane index", laneIndexOf(lanes, "a"), 0);
check("third lane index", laneIndexOf(lanes, "c"), 2);
check("an unknown lane clamps to the first", laneIndexOf(lanes, "nope"), 0);

check("first lane top", laneTop(lanes, "a", LANE_H), 0);
check("second lane top", laneTop(lanes, "b", LANE_H), 108);

// A card is centred in its lane, so its top is half a lane minus half a card.
check("a card centres in its lane", nodeTop(lanes, node("n", "a", 0), LANE_H), (LANE_H - NODE_H) / 2);
check(
  "an offset nudges it off centre",
  nodeTop(lanes, node("n", "a", 0, { offset: 20 }), LANE_H),
  (LANE_H - NODE_H) / 2 + 20,
);

check("laneAt inside the first lane", laneAt(lanes, 10, LANE_H).id, "a");
check("laneAt inside the second", laneAt(lanes, 150, LANE_H).id, "b");
check("laneAt above the top clamps", laneAt(lanes, -50, LANE_H).id, "a");
check("laneAt below the bottom clamps", laneAt(lanes, 9999, LANE_H).id, "c");
check("laneAt with no lanes is undefined", laneAt([], 10, LANE_H), undefined);

/* --- phases ------------------------------------------------------------ */

const phases = [
  { id: "p1", label: "Before", width: 200 },
  { id: "p2", label: "During" },
  { id: "p3", label: "After", width: 150 },
];
const bands = phaseBands(phases);

check("the first band starts at zero", bands[0].left, 0);
check("the second starts where the first ended", bands[1].left, 200);
check("an unset width defaults to 300", bands[1].width, 300);
check("the third follows the second", bands[2].left, 500);
check("no phases means no bands", phaseBands([]).length, 0);

check("a known tone resolves", phaseTone("lime").key, "lime");
check("an unknown tone is null", phaseTone("puce"), null);
check(
  "a tone band is a color-mix, not an rgba",
  phaseTone("sand").band.startsWith("color-mix("),
  true,
);

/* --- content width ----------------------------------------------------- */

check("content is at least the minimum", contentWidth([], [], 1200), 1200);
check(
  "a far right node widens the content",
  contentWidth([node("n", "a", 2000)], [], 1200),
  2000 + NODE_W + 80,
);
check(
  "long phases widen the content",
  contentWidth([], [{ id: "p", label: "x", width: 3000 }], 1200),
  3000,
);

/* --- content height ---------------------------------------------------- */

check(
  "with no offsets the height is the lanes",
  contentHeight(lanes, [node("n", "a", 0)], LANE_H),
  3 * LANE_H,
);
check(
  "a card nudged past the last lane extends the surface",
  contentHeight(lanes, [node("n", "c", 0, { offset: 120 })], LANE_H) > 3 * LANE_H,
  true,
);
check(
  "the extended surface clears the card",
  contentHeight(lanes, [node("n", "c", 0, { offset: 120 })], LANE_H) >=
    nodeTop(lanes, node("n", "c", 0, { offset: 120 }), LANE_H) + NODE_H,
  true,
);
check("no nodes still gives the lanes", contentHeight(lanes, [], LANE_H), 3 * LANE_H);

/* --- edge routing ------------------------------------------------------ */

const coords = (path) => (path.match(/-?\d+(\.\d+)?/g) || []).map(Number);
const xsOf = (path) => {
  const numbers = coords(path);
  return numbers.filter((_, index) => index % 2 === 0);
};

// Same lane, target to the right: a straight run.
const straight = swimEdgePath({ x: 0, top: 0 }, { x: 300, top: 0 });
check("a level forward edge is straight", (straight.match(/L/g) || []).length, 1);
check("it leaves the right of the source", straight.startsWith(`M ${NODE_W} 26`), true);

// Different lanes, target to the right: turns at the midpoint.
const forward = swimEdgePath({ x: 0, top: 0 }, { x: 400, top: 108 });
check("a forward edge has two corners", (forward.match(/Q/g) || []).length, 2);
check("a forward edge ends at the target's left", forward.trim().endsWith("L 400 134"), true);
check(
  "a forward edge never runs left of its exit",
  Math.min(...xsOf(forward)) >= NODE_W - 0.001,
  true,
);
check(
  "a forward edge never overshoots its target",
  Math.max(...xsOf(forward)) <= 400 + 0.001,
  true,
);

/**
 * The backward case. The source starts at x=600, the target at x=100 — the
 * target's left edge is behind the source's right edge, so there is no
 * midpoint to turn at.
 */
const backward = swimEdgePath({ x: 600, top: 0 }, { x: 100, top: 108 });
const backXs = xsOf(backward);

check("a backward edge still leaves the right of the source", backward.startsWith("M 776 26"), true);
check("a backward edge ends at the target's left", backward.trim().endsWith("L 100 134"), true);
check("a backward edge routes around, not through", (backward.match(/Q/g) || []).length, 4);

// It may run right of its exit (the detour out) and left of its target (the
// detour back), but never past either card's far side.
check(
  "the detour out stays near the source",
  Math.max(...backXs) <= 600 + NODE_W + 40 + 0.001,
  true,
);
check("the detour back stays near the target", Math.min(...backXs) >= 100 - 40 - 0.001, true);
check("every backward coordinate is finite", coords(backward).every(Number.isFinite), true);

// The whole detour must pass BELOW both cards, never through them.
const backYs = (() => {
  const numbers = coords(backward);
  return numbers.filter((_, index) => index % 2 === 1);
})();
check("the detour drops below both cards", Math.max(...backYs) > 134 + NODE_H / 2, true);

// A level backward edge is still a detour, not a straight line through both.
const levelBack = swimEdgePath({ x: 600, top: 0 }, { x: 100, top: 0 });
check("a level backward edge is not straight", (levelBack.match(/Q/g) || []).length, 4);

/* --- group moves ------------------------------------------------------- */

const graph = {
  lanes,
  nodes: [node("n1", "a", 100), node("n2", "b", 200), node("n3", "c", 300)],
  edges: [{ id: "e1", source: "n1", target: "n2" }],
  phases: [],
};

// Drag n1 from lane a to lane b: one lane down, +64 across.
const moved = moveNodes(graph, {
  draggedId: "n1",
  group: ["n1", "n2"],
  x: 164,
  laneId: "b",
  startX: 100,
  startLaneId: "a",
});

check("the dragged node lands where dropped", moved.find((n) => n.id === "n1").x, 164);
check("the dragged node changes lane", moved.find((n) => n.id === "n1").laneId, "b");
// 264 snapped to the 16 grid. A grouped node lands on the grid like any
// other — it is not exempt because it was moved indirectly.
check("a grouped node moves by the same delta", moved.find((n) => n.id === "n2").x, swimSnap(264));
check("a grouped node shifts by the same lane delta", moved.find((n) => n.id === "n2").laneId, "c");
check("an ungrouped node is untouched", moved.find((n) => n.id === "n3").x, 300);

// A group dragged past the last lane clamps rather than falling off.
const clamped = moveNodes(graph, {
  draggedId: "n1",
  group: ["n1", "n3"],
  x: 100,
  laneId: "c",
  startX: 100,
  startLaneId: "a",
});
check("a grouped node clamps at the last lane", clamped.find((n) => n.id === "n3").laneId, "c");

// x never goes negative.
const pushedLeft = moveNodes(graph, {
  draggedId: "n2",
  group: ["n2", "n1"],
  x: 0,
  laneId: "b",
  startX: 200,
  startLaneId: "b",
});
check("a node cannot be dragged past zero", pushedLeft.find((n) => n.id === "n1").x, 0);

/* --- marquee ----------------------------------------------------------- */

// Down to 160: n2 sits in the second lane, whose card top is 136.
const hits = nodesInBand(graph, { x1: 50, y1: 0, x2: 400, y2: 160 }, LANE_H);
check("the marquee takes the lanes it covers", hits.sort().join(), "n1,n2");
check("an empty marquee takes nothing", nodesInBand(graph, { x1: 0, y1: 0, x2: 1, y2: 1 }, LANE_H).length, 0);

/* --- removal ----------------------------------------------------------- */

const withoutNode = removeSwimNodes(graph, ["n1"]);
check("the node is gone", withoutNode.nodes.length, 2);
check("its edge is gone too", withoutNode.edges.length, 0);

const withoutLane = removeLane(graph, "a");
check("the lane is gone", withoutLane.lanes.length, 2);
check("the step standing in it went with it", withoutLane.nodes.length, 2);
check("its edge went too", withoutLane.edges.length, 0);
check("the last lane cannot be removed", Object.keys(removeLane({ ...graph, lanes: [lanes[0]] }, "a")).length, 0);

/* --- kinds ------------------------------------------------------------- */

check("start is unique", isUniqueKind("start"), true);
check("end is unique", isUniqueKind("end"), true);
check("a step is not unique", isUniqueKind("step"), false);

/* --- report ------------------------------------------------------------ */

let failed = 0;
for (const [name, actual, expected] of cases) {
  const ok = Object.is(actual, expected);
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(46)} -> ${JSON.stringify(actual)}${
      ok ? "" : `   expected ${JSON.stringify(expected)}`
    }`,
  );
}

console.log(`\n${cases.length - failed}/${cases.length} swimlane geometry checks passed`);
if (failed) process.exit(1);
