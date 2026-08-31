/**
 * Flow geometry, node defaults and validation.
 *
 * A flow is not a drawing: it runs. So unlike the diagram canvas, this one has
 * rules — a trigger to start from, ports that mean success and failure, and a
 * validation pass that says what would go wrong before anyone presses publish.
 */

export type FlowKind = "trigger" | "condition" | "action";
export type Branch = "ok" | "err" | "yes" | "no";
export type RunStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface FlowParam {
  key: string;
  label: string;
  editor: "text" | "textarea" | "number" | "select" | "toggle";
  options?: string[];
  default?: string | number | boolean;
  placeholder?: string;
  /** Shown under the field; explains what the value does, not what it is. */
  help?: string;
}

export interface FlowNodeType {
  type: string;
  kind: FlowKind;
  label: string;
  icon: string;
  note: string;
  params?: FlowParam[];
  category?: string;
  categoryKey?: string;
}

export interface FlowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  /** Overrides the type's label. */
  label?: string;
  params?: Record<string, unknown>;
  /** A disabled node is skipped at run time but stays wired in. */
  disabled?: boolean;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** Which output port it leaves from. */
  branch?: Branch;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Card size and grid, in px. */
export const FLOW_W = 196;
export const FLOW_H = 62;
export const FLOW_GRID = 16;

export const flowSnap = (value: number) => Math.round(value / FLOW_GRID) * FLOW_GRID;

export interface Port {
  x: number;
  y: number;
}

/**
 * Every node has one input and two outputs: the upper one on success, the
 * lower one on failure.
 *
 * TWO PORTS, ALWAYS. A node with a single output makes the failure path
 * invisible, and an automation whose failure path is invisible is one that
 * silently stops — which is the single most common way a flow disappoints the
 * person who built it.
 */
export function ports(node: { x: number; y: number }): { in: Port; ok: Port; err: Port } {
  return {
    in: { x: node.x, y: node.y + FLOW_H / 2 },
    ok: { x: node.x + FLOW_W, y: node.y + 18 },
    err: { x: node.x + FLOW_W, y: node.y + FLOW_H - 18 },
  };
}

export const outPort = (node: { x: number; y: number }, branch?: Branch): Port =>
  branch === "no" || branch === "err" ? ports(node).err : ports(node).ok;

/** A condition says yes/no; everything else says succeeded/failed. */
export const branchLabel = (branch: Branch | undefined, kind: FlowKind | undefined): string => {
  if (kind === "condition") return branch === "no" || branch === "err" ? "no" : "yes";
  return branch === "no" || branch === "err" ? "failed" : "ok";
};

/**
 * A cubic between two ports, leaving and arriving horizontally.
 *
 * The handle never drops below 44px, so a link between two adjacent nodes
 * still leaves the port sideways rather than cutting diagonally across the
 * card it just left.
 */
export function flowEdgePath(from: Port, to: Port): string {
  const reach = Math.max(Math.abs(to.x - from.x) * 0.5, 44);
  return `M ${from.x} ${from.y} C ${from.x + reach} ${from.y}, ${to.x - reach} ${to.y}, ${to.x} ${to.y}`;
}

/** Indexes a catalog into a type lookup. */
export function indexTypes(
  categories: { key: string; label: string; nodes: FlowNodeType[] }[],
): Record<string, FlowNodeType> {
  const out: Record<string, FlowNodeType> = {};
  for (const category of categories) {
    for (const node of category.nodes) {
      out[node.type] = { ...node, category: category.label, categoryKey: category.key };
    }
  }
  return out;
}

/** The parameter defaults for a type, as a params object. */
export function defaultsFor(
  type: string,
  types: Record<string, FlowNodeType>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const param of types[type]?.params ?? []) {
    if (param.default != null) out[param.key] = param.default;
  }
  return out;
}

let counter = 0;
export const flowUid = (prefix: string) => `${prefix}${(counter += 1).toString(36)}`;
export const resetFlowUid = () => {
  counter = 0;
};

/** Removes nodes and every edge that touched them. */
export function removeFlowNodes(graph: FlowGraph, ids: string[]): FlowGraph {
  return {
    nodes: graph.nodes.filter((node) => !ids.includes(node.id)),
    edges: graph.edges.filter(
      (edge) => !ids.includes(edge.source) && !ids.includes(edge.target),
    ),
  };
}

/** Copies nodes and only the edges between them. */
export function duplicateFlowNodes(
  graph: FlowGraph,
  ids: string[],
  offset = 24,
): { graph: FlowGraph; created: string[] } {
  const remap = new Map<string, string>();

  const copies = graph.nodes
    .filter((node) => ids.includes(node.id))
    .map((node) => {
      const copy = { ...node, id: flowUid("n"), x: node.x + offset, y: node.y + offset };
      remap.set(node.id, copy.id);
      return copy;
    });

  const inner = graph.edges
    .filter((edge) => remap.has(edge.source) && remap.has(edge.target))
    .map((edge) => ({
      ...edge,
      id: flowUid("e"),
      source: remap.get(edge.source)!,
      target: remap.get(edge.target)!,
    }));

  return {
    graph: { nodes: [...graph.nodes, ...copies], edges: [...graph.edges, ...inner] },
    created: copies.map((copy) => copy.id),
  };
}

export type ProblemLevel = "error" | "warning";

export interface FlowProblem {
  level: ProblemLevel;
  code:
    | "no-trigger"
    | "many-triggers"
    | "unreachable"
    | "dead-end"
    | "cycle"
    | "trigger-has-input"
    | "condition-half-wired";
  message: string;
  /** Nodes the problem points at, so the canvas can mark them. */
  nodeIds: string[];
}

/**
 * Everything wrong with a flow, worst first.
 *
 * THIS IS THE PART THE SOURCE DID NOT HAVE, and it is the difference between a
 * drawing and an automation. A flow with no trigger never fires; a node with
 * nothing leading to it never runs; a condition wired on one branch only
 * silently drops half its traffic. All three look completely fine on the
 * canvas, and all three are found the hard way — in production, by the person
 * whose customers did not get their message.
 *
 * Errors mean it cannot run. Warnings mean it runs but probably not as
 * intended, so they never block publishing.
 */
export function validateFlow(
  graph: FlowGraph,
  types: Record<string, FlowNodeType>,
): FlowProblem[] {
  const problems: FlowProblem[] = [];
  const { nodes, edges } = graph;

  if (!nodes.length) return problems;

  const kindOf = (node: FlowNode) => types[node.type]?.kind;
  const triggers = nodes.filter((node) => kindOf(node) === "trigger");

  if (!triggers.length) {
    problems.push({
      level: "error",
      code: "no-trigger",
      message: "Nothing starts this flow. Add a trigger.",
      nodeIds: [],
    });
  }

  if (triggers.length > 1) {
    problems.push({
      level: "warning",
      code: "many-triggers",
      message: `${triggers.length} triggers start this flow independently.`,
      nodeIds: triggers.map((node) => node.id),
    });
  }

  // A trigger with something wired into it: the incoming edge never fires,
  // because a trigger is where a run begins.
  const triggersWithInput = triggers.filter((node) =>
    edges.some((edge) => edge.target === node.id),
  );
  if (triggersWithInput.length) {
    problems.push({
      level: "warning",
      code: "trigger-has-input",
      message: "A trigger has something wired into it; that link never fires.",
      nodeIds: triggersWithInput.map((node) => node.id),
    });
  }

  // Reachability from every trigger.
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const reached = new Set<string>();
  const queue = triggers.map((node) => node.id);
  while (queue.length) {
    const id = queue.shift()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const next of outgoing.get(id) ?? []) queue.push(next);
  }

  const unreachable = nodes.filter((node) => !reached.has(node.id));
  if (unreachable.length && triggers.length) {
    problems.push({
      level: "warning",
      code: "unreachable",
      message: `${unreachable.length} node${unreachable.length === 1 ? "" : "s"} nothing leads to.`,
      nodeIds: unreachable.map((node) => node.id),
    });
  }

  // A condition wired on one branch only. Not an error — "do nothing on no" is
  // a real design — but it is the shape of an accidental drop, so it is worth
  // saying out loud.
  const halfWired = nodes.filter((node) => {
    if (kindOf(node) !== "condition") return false;
    const out = edges.filter((edge) => edge.source === node.id);
    if (!out.length) return false;

    const hasYes = out.some((edge) => edge.branch !== "no" && edge.branch !== "err");
    const hasNo = out.some((edge) => edge.branch === "no" || edge.branch === "err");
    return hasYes !== hasNo;
  });

  if (halfWired.length) {
    problems.push({
      level: "warning",
      code: "condition-half-wired",
      message: "A condition has only one branch wired; the other drops silently.",
      nodeIds: halfWired.map((node) => node.id),
    });
  }

  // A cycle: depth-first, tracking the current path rather than only visited
  // nodes — a diamond is not a cycle, and marking it as one would be worse
  // than saying nothing.
  const inPath = new Set<string>();
  const settled = new Set<string>();
  const cyclic = new Set<string>();

  const walk = (id: string) => {
    if (inPath.has(id)) {
      cyclic.add(id);
      return;
    }
    if (settled.has(id)) return;

    inPath.add(id);
    for (const next of outgoing.get(id) ?? []) walk(next);
    inPath.delete(id);
    settled.add(id);
  };

  for (const node of nodes) walk(node.id);

  if (cyclic.size) {
    problems.push({
      level: "error",
      code: "cycle",
      message: "This flow loops back on itself and would never finish.",
      nodeIds: [...cyclic],
    });
  }

  const order: Record<ProblemLevel, number> = { error: 0, warning: 1 };
  return problems.sort((a, b) => order[a.level] - order[b.level]);
}

export interface NodeHealth {
  tone: "error" | "warning";
  text: string;
}

/**
 * What is wrong with ONE node, for the badge on its card.
 *
 * Separate from validateFlow because the two answer different questions: this
 * one is "why is this card marked", which has to fit in a tooltip; the other
 * is "can I publish", which is a list. A missing parameter is checked first —
 * it is the most common fault and the easiest to fix.
 */
export function nodeHealth(
  node: FlowNode,
  graph: FlowGraph,
  types: Record<string, FlowNodeType>,
): NodeHealth | null {
  const type = types[node.type];
  if (!type) return { tone: "error", text: "Unknown node type." };

  const missing = (type.params ?? []).filter((param) => {
    const value = node.params?.[param.key];
    return value == null || value === "";
  });

  if (missing.length) {
    return {
      tone: "warning",
      text:
        missing.length > 1
          ? `${missing.length} parameters to fill in`
          : `“${missing[0]!.label}” to fill in`,
    };
  }

  const hasIn = graph.edges.some((edge) => edge.target === node.id);
  const hasOut = graph.edges.some((edge) => edge.source === node.id);

  // A trigger legitimately has no input; everything else needs one.
  if (type.kind === "trigger") return hasOut ? null : { tone: "error", text: "This trigger leads nowhere." };
  if (!hasIn && !hasOut) return { tone: "error", text: "Nothing reaches or leaves this node." };
  if (!hasIn) return { tone: "error", text: "Nothing reaches this node." };
  if (!hasOut) return { tone: "warning", text: "This node leads nowhere." };

  return null;
}

/** True when nothing blocks a run. Warnings never block. */
export const canRun = (problems: FlowProblem[]) =>
  !problems.some((problem) => problem.level === "error");

/**
 * The nodes a run would touch, in order, following only wired branches.
 *
 * Used to animate a dry run: a flow whose shape you cannot watch is one you
 * have to reason about entirely in your head.
 */
export function runOrder(graph: FlowGraph, types: Record<string, FlowNodeType>): string[] {
  const triggers = graph.nodes.filter((node) => types[node.type]?.kind === "trigger");
  const seen = new Set<string>();
  const order: string[] = [];

  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);

    for (const edge of graph.edges.filter((entry) => entry.source === id)) walk(edge.target);
  };

  for (const trigger of triggers) walk(trigger.id);
  return order;
}
