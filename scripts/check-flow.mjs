import { fileURLToPath } from "node:url";

/**
 * Asserts the flow's geometry, port logic and validation.
 *
 * The validation is the reason this file exists. A flow is not a drawing — it
 * runs — and the three failures that matter all look completely fine on the
 * canvas: no trigger, so nothing ever fires; a node nothing leads to, so it
 * never executes; a condition wired on one branch only, so half the traffic
 * disappears without a trace. Every one of them is otherwise found in
 * production, by the person whose customers did not get their message.
 *
 * The cycle check is the subtle one. Tracking only visited nodes reports a
 * diamond — two branches that rejoin — as a loop, which is both wrong and
 * worse than saying nothing, because it teaches people to ignore the warning.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/flow.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const flow = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  FLOW_W,
  FLOW_H,
  flowSnap,
  ports,
  outPort,
  branchLabel,
  flowEdgePath,
  indexTypes,
  defaultsFor,
  validateFlow,
  nodeHealth,
  canRun,
  runOrder,
  removeFlowNodes,
  duplicateFlowNodes,
  resetFlowUid,
} = flow;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

const types = indexTypes([
  {
    key: "t",
    label: "Triggers",
    nodes: [
      {
        type: "trigger.scan",
        kind: "trigger",
        label: "Card scanned",
        icon: "qr-code",
        note: "",
        params: [
          { key: "place", label: "Site", editor: "select", default: "All" },
          { key: "window", label: "Window", editor: "select" },
        ],
      },
    ],
  },
  {
    key: "l",
    label: "Logic",
    nodes: [{ type: "logic.if", kind: "condition", label: "Condition", icon: "git-branch", note: "" }],
  },
  {
    key: "a",
    label: "Actions",
    nodes: [{ type: "action.sms", kind: "action", label: "Send an SMS", icon: "message-square", note: "" }],
  },
]);

const node = (id, type, x = 0, y = 0) => ({ id, type, x, y });
const edge = (id, source, target, branch) => ({ id, source, target, branch });

/* --- catalog ----------------------------------------------------------- */

check("types are indexed by type key", types["logic.if"].label, "Condition");
check("a type carries its category", types["logic.if"].category, "Logic");
check("a type carries its category key", types["action.sms"].categoryKey, "a");

const defaults = defaultsFor("trigger.scan", types);
check("a param default lands in the object", defaults.place, "All");
check("a param with no default is absent", "window" in defaults, false);
check("an unknown type has no defaults", Object.keys(defaultsFor("nope", types)).length, 0);

/* --- geometry ---------------------------------------------------------- */

check("snap rounds to the 16 grid", flowSnap(41), 48);
check("snap rounds down", flowSnap(39), 32);

const p = ports({ x: 100, y: 200 });
check("the input is on the left edge", p.in.x, 100);
check("the input is vertically centred", p.in.y, 200 + FLOW_H / 2);
check("both outputs are on the right edge", p.ok.x === 100 + FLOW_W && p.err.x === 100 + FLOW_W, true);
check("success sits above failure", p.ok.y < p.err.y, true);
check("success is 18px from the top", p.ok.y, 218);
check("failure is 18px from the bottom", p.err.y, 200 + FLOW_H - 18);

check("the ok branch uses the upper port", outPort({ x: 0, y: 0 }, "ok").y, ports({ x: 0, y: 0 }).ok.y);
check("no branch at all uses the upper port", outPort({ x: 0, y: 0 }, undefined).y, ports({ x: 0, y: 0 }).ok.y);
check("the err branch uses the lower port", outPort({ x: 0, y: 0 }, "err").y, ports({ x: 0, y: 0 }).err.y);
check("the no branch uses the lower port", outPort({ x: 0, y: 0 }, "no").y, ports({ x: 0, y: 0 }).err.y);

// A condition says yes/no; anything else says ok/failed.
check("a condition labels its upper branch yes", branchLabel("ok", "condition"), "yes");
check("a condition labels its lower branch no", branchLabel("err", "condition"), "no");
check("an action labels its upper branch ok", branchLabel("ok", "action"), "ok");
check("an action labels its lower branch failed", branchLabel("err", "action"), "failed");

const path = flowEdgePath({ x: 0, y: 0 }, { x: 400, y: 100 });
check("an edge is a single cubic", (path.match(/C/g) || []).length, 1);
check("it starts at the source port", path.startsWith("M 0 0"), true);
check("it ends at the target port", path.endsWith("400 100"), true);

// Adjacent nodes: the handle must not collapse, or the curve cuts diagonally
// back across the card it just left.
const tight = flowEdgePath({ x: 0, y: 0 }, { x: 10, y: 60 });
const firstHandle = Number(tight.match(/C\s(-?\d+(?:\.\d+)?)/)[1]);
check("a short edge keeps a 44px handle", firstHandle >= 44 - 0.001, true);

/* --- validation: no trigger -------------------------------------------- */

const noTrigger = { nodes: [node("a", "action.sms")], edges: [] };
const noTriggerProblems = validateFlow(noTrigger, types);
check("a flow with no trigger is an error", noTriggerProblems[0].code, "no-trigger");
check("no trigger blocks the run", canRun(noTriggerProblems), false);

check("an empty flow reports nothing", validateFlow({ nodes: [], edges: [] }, types).length, 0);

/* --- validation: a healthy flow ---------------------------------------- */

const healthy = {
  nodes: [node("t", "trigger.scan"), node("c", "logic.if"), node("s1", "action.sms"), node("s2", "action.sms")],
  edges: [
    edge("e1", "t", "c"),
    edge("e2", "c", "s1", "ok"),
    edge("e3", "c", "s2", "no"),
  ],
};
const healthyProblems = validateFlow(healthy, types);
check("a fully wired flow reports nothing", healthyProblems.length, 0);
check("a healthy flow can run", canRun(healthyProblems), true);

/* --- validation: unreachable ------------------------------------------- */

const orphaned = {
  nodes: [node("t", "trigger.scan"), node("a", "action.sms"), node("lost", "action.sms")],
  edges: [edge("e1", "t", "a")],
};
const orphanProblems = validateFlow(orphaned, types);
const unreachable = orphanProblems.find((problem) => problem.code === "unreachable");
check("an unreachable node is reported", Boolean(unreachable), true);
check("it names the node", unreachable.nodeIds.join(), "lost");
check("it is a warning, not an error", unreachable.level, "warning");
check("an unreachable node does not block the run", canRun(orphanProblems), true);

/* --- validation: half-wired condition ---------------------------------- */

const halfWired = {
  nodes: [node("t", "trigger.scan"), node("c", "logic.if"), node("s", "action.sms")],
  edges: [edge("e1", "t", "c"), edge("e2", "c", "s", "ok")],
};
const half = validateFlow(halfWired, types).find((problem) => problem.code === "condition-half-wired");
check("a half-wired condition is reported", Boolean(half), true);
check("it names the condition", half.nodeIds.join(), "c");

// Both branches wired: nothing to say.
check(
  "a fully wired condition is fine",
  validateFlow(healthy, types).some((problem) => problem.code === "condition-half-wired"),
  false,
);

// A condition with NO outputs at all is not half-wired — it is unreachable
// downstream, which is a different complaint.
const noOutputs = {
  nodes: [node("t", "trigger.scan"), node("c", "logic.if")],
  edges: [edge("e1", "t", "c")],
};
check(
  "a condition with no outputs is not half-wired",
  validateFlow(noOutputs, types).some((problem) => problem.code === "condition-half-wired"),
  false,
);

/* --- validation: cycles ------------------------------------------------ */

const looped = {
  nodes: [node("t", "trigger.scan"), node("a", "action.sms"), node("b", "action.sms")],
  edges: [edge("e1", "t", "a"), edge("e2", "a", "b"), edge("e3", "b", "a")],
};
const loopProblems = validateFlow(looped, types);
const cycle = loopProblems.find((problem) => problem.code === "cycle");
check("a loop is reported", Boolean(cycle), true);
check("a loop is an error", cycle.level, "error");
check("a loop blocks the run", canRun(loopProblems), false);

/**
 * A diamond is NOT a cycle. Two branches that split and rejoin visit the
 * rejoining node twice, so tracking only visited nodes reports it as a loop —
 * wrong, and worse than silence, because a warning that fires on correct flows
 * teaches people to ignore the warning.
 */
const diamond = {
  nodes: [
    node("t", "trigger.scan"),
    node("c", "logic.if"),
    node("l", "action.sms"),
    node("r", "action.sms"),
    node("join", "action.sms"),
  ],
  edges: [
    edge("e1", "t", "c"),
    edge("e2", "c", "l", "ok"),
    edge("e3", "c", "r", "no"),
    edge("e4", "l", "join"),
    edge("e5", "r", "join"),
  ],
};
check(
  "a diamond is not a cycle",
  validateFlow(diamond, types).some((problem) => problem.code === "cycle"),
  false,
);
check("a diamond reports nothing at all", validateFlow(diamond, types).length, 0);

// A node pointing at itself is a cycle.
const selfLoop = {
  nodes: [node("t", "trigger.scan"), node("a", "action.sms")],
  edges: [edge("e1", "t", "a"), edge("e2", "a", "a")],
};
check(
  "a self-loop is a cycle",
  validateFlow(selfLoop, types).some((problem) => problem.code === "cycle"),
  true,
);

/* --- validation: triggers ---------------------------------------------- */

const twoTriggers = {
  nodes: [node("t1", "trigger.scan"), node("t2", "trigger.scan"), node("a", "action.sms")],
  edges: [edge("e1", "t1", "a"), edge("e2", "t2", "a")],
};
const many = validateFlow(twoTriggers, types).find((problem) => problem.code === "many-triggers");
check("two triggers are reported", Boolean(many), true);
check("two triggers are only a warning", many.level, "warning");
check("two triggers still run", canRun(validateFlow(twoTriggers, types)), true);

const feedIntoTrigger = {
  nodes: [node("t", "trigger.scan"), node("a", "action.sms")],
  edges: [edge("e1", "t", "a"), edge("e2", "a", "t")],
};
check(
  "wiring into a trigger is reported",
  validateFlow(feedIntoTrigger, types).some((problem) => problem.code === "trigger-has-input"),
  true,
);

// Errors sort before warnings.
const mixed = validateFlow(
  { nodes: [node("a", "action.sms"), node("b", "action.sms")], edges: [edge("e", "a", "b")] },
  types,
);
check("errors come first", mixed[0].level, "error");

/* --- per-node health --------------------------------------------------- */

// A missing parameter is checked before wiring: it is the most common fault
// and the easiest to fix, so it is the one the badge should name.
const missingParam = { id: "t", type: "trigger.scan", x: 0, y: 0, params: {} };
// Only one is missing here, so the badge names it rather than counting.
check(
  "a single missing parameter is named",
  nodeHealth(
    { ...missingParam, params: { place: "All" } },
    { nodes: [missingParam], edges: [] },
    types,
  ).text,
  "“Window” to fill in",
);
check(
  "several missing parameters are counted",
  nodeHealth({ ...missingParam, params: {} }, { nodes: [missingParam], edges: [] }, types).text,
  "2 parameters to fill in",
);
check(
  "a filled trigger with no output is an error",
  nodeHealth(
    { ...missingParam, params: { place: "All", window: "Any" } },
    { nodes: [missingParam], edges: [] },
    types,
  ).tone,
  "error",
);

const wiredTrigger = { id: "t", type: "trigger.scan", x: 0, y: 0, params: { place: "All", window: "Any" } };
const sms = { id: "s", type: "action.sms", x: 0, y: 0 };
const wired = { nodes: [wiredTrigger, sms], edges: [edge("e", "t", "s")] };
check("a wired trigger is healthy", nodeHealth(wiredTrigger, wired, types), null);
check("a terminal action leads nowhere", nodeHealth(sms, wired, types).tone, "warning");
check(
  "an isolated node is an error",
  nodeHealth(sms, { nodes: [sms], edges: [] }, types).text,
  "Nothing reaches or leaves this node.",
);
check(
  "an unknown type is an error",
  nodeHealth({ id: "x", type: "nope", x: 0, y: 0 }, { nodes: [], edges: [] }, types).tone,
  "error",
);

/* --- run order --------------------------------------------------------- */

const order = runOrder(healthy, types);
check("the run starts at the trigger", order[0], "t");
check("it follows the wiring", order.join(), "t,c,s1,s2");
check("a node is visited once", runOrder(diamond, types).filter((id) => id === "join").length, 1);
check("an unreachable node is not in the order", runOrder(orphaned, types).includes("lost"), false);
check("no trigger means no run", runOrder(noTrigger, types).length, 0);

/* --- editing ----------------------------------------------------------- */

const pruned = removeFlowNodes(healthy, ["c"]);
check("the node is gone", pruned.nodes.length, 3);
check("every edge touching it is gone", pruned.edges.length, 0);

resetFlowUid();
const { graph: duplicated, created } = duplicateFlowNodes(healthy, ["c", "s1"]);
check("both nodes were copied", created.length, 2);
check("the inner edge came with them", duplicated.edges.length, 4);
check(
  "no copied edge escapes the selection",
  duplicated.edges.some((entry) => created.includes(entry.source) && entry.target === "s2"),
  false,
);
check("copies are offset", duplicated.nodes.find((n) => n.id === created[0]).x, 24);

/* --- report ------------------------------------------------------------ */

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

console.log(`\n${cases.length - failed}/${cases.length} flow checks passed`);
if (failed) process.exit(1);
