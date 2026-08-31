/**
 * Swimlane geometry: lane placement, phase bands and cross-lane edge routing.
 *
 * Kept out of the component so the routing can be tested without a browser —
 * a connector that doubles back looks like a rendering artefact, not like a
 * bug in the maths, so nobody reports it.
 */

export type SwimNodeKind = "step" | "start" | "end" | "decision" | "wait";

export interface SwimLane {
  id: string;
  label: string;
  note?: string;
}

export interface SwimNode {
  id: string;
  laneId: string;
  /** Position along the time axis, in px from the left of the content area. */
  x: number;
  label: string;
  kind?: SwimNodeKind;
  icon?: string;
  note?: string;
  /** Nudges the card off the lane's centre line, so two steps can share an x. */
  offset?: number;
}

export interface SwimEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
}

export interface SwimPhase {
  id: string;
  label: string;
  width?: number;
  tone?: PhaseToneName;
}

export interface SwimGraph {
  lanes: SwimLane[];
  nodes: SwimNode[];
  edges: SwimEdge[];
  phases: SwimPhase[];
}

/** Card size and the fixed lane-header column, in px. */
export const NODE_W = 176;
export const NODE_H = 52;
export const HEADER_W = 184;
export const PHASE_H = 35;

export const SWIM_GRID = 16;
export const swimSnap = (value: number) => Math.round(value / SWIM_GRID) * SWIM_GRID;

export type PhaseToneName = "lime" | "mist" | "sand" | "sky" | "rose";

/**
 * Five phase tints. The band is a color-mix on the same token as the chip
 * rather than a literal rgba, so a retheme moves both together and the band
 * stays faint against whichever surface is underneath.
 */
export const PHASE_TONES: {
  key: PhaseToneName;
  label: string;
  chip: string;
  band: string;
}[] = [
  {
    key: "lime",
    label: "Lime",
    chip: "var(--color-accent)",
    band: "color-mix(in srgb, var(--color-accent) 16%, transparent)",
  },
  {
    key: "mist",
    label: "Mint",
    chip: "var(--color-mist-strong)",
    band: "color-mix(in srgb, var(--color-mist-strong) 55%, transparent)",
  },
  {
    key: "sand",
    label: "Sand",
    chip: "var(--color-warning)",
    band: "color-mix(in srgb, var(--color-warning) 9%, transparent)",
  },
  {
    key: "sky",
    label: "Sky",
    chip: "var(--color-info)",
    band: "color-mix(in srgb, var(--color-info) 9%, transparent)",
  },
  {
    key: "rose",
    label: "Rose",
    chip: "var(--color-error)",
    band: "color-mix(in srgb, var(--color-error) 8%, transparent)",
  },
];

export const phaseTone = (name?: PhaseToneName) =>
  PHASE_TONES.find((tone) => tone.key === name) ?? null;

export const SWIM_KINDS: Record<SwimNodeKind, { icon: string; radius: number }> = {
  step: { icon: "square", radius: 12 },
  start: { icon: "play", radius: 999 },
  end: { icon: "flag", radius: 999 },
  decision: { icon: "git-branch", radius: 12 },
  wait: { icon: "hourglass", radius: 12 },
};

/** A journey has one entry and one exit; placing a second moves the first. */
export const isUniqueKind = (kind: SwimNodeKind) => kind === "start" || kind === "end";

export const laneIndexOf = (lanes: SwimLane[], id: string) =>
  Math.max(0, lanes.findIndex((lane) => lane.id === id));

export const laneTop = (lanes: SwimLane[], id: string, laneHeight: number) =>
  laneIndexOf(lanes, id) * laneHeight;

/** Top edge of a node's card, centred in its lane and then nudged. */
export const nodeTop = (lanes: SwimLane[], node: SwimNode, laneHeight: number) =>
  laneTop(lanes, node.laneId, laneHeight) + laneHeight / 2 - NODE_H / 2 + (node.offset ?? 0);

/** The lane containing a y offset, clamped to the ends. */
export function laneAt(lanes: SwimLane[], y: number, laneHeight: number): SwimLane | undefined {
  if (!lanes.length) return undefined;
  const index = Math.floor(y / laneHeight);
  return lanes[Math.max(0, Math.min(lanes.length - 1, index))];
}

/** Lays phases out left to right, each starting where the previous ended. */
export function phaseBands(phases: SwimPhase[]): (SwimPhase & { left: number; width: number })[] {
  let left = 0;
  return phases.map((phase) => {
    const width = phase.width ?? 300;
    const band = { ...phase, left, width };
    left += width;
    return band;
  });
}

/**
 * How tall the content area has to be.
 *
 * NOT SIMPLY lanes × laneHeight. A node's `offset` nudges it off its lane's
 * centre line, and a large enough offset puts the card below the last lane —
 * where it still renders, but outside the surface that scrolls, so it is
 * clipped and unreachable.
 */
export function contentHeight(
  lanes: SwimLane[],
  nodes: SwimNode[],
  laneHeight: number,
): number {
  const lanesHeight = lanes.length * laneHeight;
  const lowestCard = nodes.reduce(
    (max, node) => Math.max(max, nodeTop(lanes, node, laneHeight) + NODE_H),
    0,
  );
  return Math.max(lanesHeight, lowestCard + 12);
}

/** How wide the content area has to be to hold every node and every phase. */
export function contentWidth(nodes: SwimNode[], phases: SwimPhase[], minimum = 1200): number {
  const rightmostNode = nodes.reduce((max, node) => Math.max(max, node.x + NODE_W + 80), 0);
  const phaseEnd = phaseBands(phases).reduce((max, band) => Math.max(max, band.left + band.width), 0);
  return Math.max(minimum, rightmostNode, phaseEnd, 600);
}

/** Corner radius on a routed edge. */
const CORNER = 12;
/** How far past a card a backward edge runs before turning. */
const DETOUR = 34;

/**
 * Routes an edge from the right of `a` to the left of `b`.
 *
 * A BACKWARD EDGE CANNOT TURN AT THE MIDPOINT. When the target sits to the
 * left of the source, the midpoint is behind the source's own exit, so a
 * midpoint route runs forward, doubles back through both cards and arrives
 * from the wrong side. Those edges detour below the lanes instead and come
 * back to the target's left edge, which is the only reading that stays
 * unambiguous when a journey loops.
 */
export function swimEdgePath(
  from: { x: number; top: number },
  to: { x: number; top: number },
): string {
  const x1 = from.x + NODE_W;
  const y1 = from.top + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.top + NODE_H / 2;

  // Same line: a straight run.
  if (Math.abs(y1 - y2) < 2 && x2 >= x1) return `M ${x1} ${y1} L ${x2} ${y2}`;

  if (x2 >= x1) {
    // Forward: out, across at the midpoint, in.
    const mid = (x1 + x2) / 2;
    const direction = Math.sign(y2 - y1);

    return (
      `M ${x1} ${y1} L ${mid} ${y1}` +
      ` Q ${mid + 10} ${y1} ${mid + 10} ${y1 + direction * CORNER}` +
      ` L ${mid + 10} ${y2 - direction * CORNER}` +
      ` Q ${mid + 10} ${y2} ${mid + 22} ${y2}` +
      ` L ${x2} ${y2}`
    );
  }

  // Backward: out to the right, down below both cards, back to the left of
  // the target, then up into it.
  const out = x1 + DETOUR;
  const back = x2 - DETOUR;
  const below = Math.max(y1, y2) + NODE_H / 2 + 18;

  return (
    `M ${x1} ${y1} L ${out - CORNER} ${y1}` +
    ` Q ${out} ${y1} ${out} ${y1 + CORNER}` +
    ` L ${out} ${below - CORNER}` +
    ` Q ${out} ${below} ${out - CORNER} ${below}` +
    ` L ${back + CORNER} ${below}` +
    ` Q ${back} ${below} ${back} ${below - CORNER}` +
    ` L ${back} ${y2 + CORNER}` +
    ` Q ${back} ${y2} ${back + CORNER} ${y2}` +
    ` L ${x2} ${y2}`
  );
}

/**
 * Moves a set of nodes by the drag applied to one of them.
 *
 * The lane shift is applied as a DELTA, not as an assignment: dragging three
 * steps from three different lanes down by one must keep them three lanes
 * apart, not collapse them all onto the lane under the pointer.
 */
export function moveNodes(
  graph: SwimGraph,
  options: {
    draggedId: string;
    group: string[];
    /** Snapped x the dragged node lands on. */
    x: number;
    /** Lane the dragged node lands in. */
    laneId: string;
    /** Where the dragged node started, for the delta. */
    startX: number;
    startLaneId: string;
  },
): SwimNode[] {
  const { lanes } = graph;
  const dx = options.x - options.startX;
  const laneShift = laneIndexOf(lanes, options.laneId) - laneIndexOf(lanes, options.startLaneId);

  return graph.nodes.map((node) => {
    if (!options.group.includes(node.id)) return node;

    if (node.id === options.draggedId) {
      return { ...node, x: Math.max(0, options.x), laneId: options.laneId };
    }

    const index = Math.max(
      0,
      Math.min(lanes.length - 1, laneIndexOf(lanes, node.laneId) + laneShift),
    );
    return {
      ...node,
      x: Math.max(0, swimSnap(node.x + dx)),
      laneId: lanes[index]?.id ?? node.laneId,
    };
  });
}

/** Nodes whose cards intersect a marquee, in content coordinates. */
export function nodesInBand(
  graph: SwimGraph,
  band: { x1: number; y1: number; x2: number; y2: number },
  laneHeight: number,
): string[] {
  const left = Math.min(band.x1, band.x2);
  const right = Math.max(band.x1, band.x2);
  const top = Math.min(band.y1, band.y2);
  const bottom = Math.max(band.y1, band.y2);

  return graph.nodes
    .filter((node) => {
      const y = nodeTop(graph.lanes, node, laneHeight);
      return node.x + NODE_W > left && node.x < right && y + NODE_H > top && y < bottom;
    })
    .map((node) => node.id);
}

/** Removes nodes and every edge that touched them. */
export function removeSwimNodes(graph: SwimGraph, ids: string[]): Partial<SwimGraph> {
  return {
    nodes: graph.nodes.filter((node) => !ids.includes(node.id)),
    edges: graph.edges.filter(
      (edge) => !ids.includes(edge.source) && !ids.includes(edge.target),
    ),
  };
}

/** Removes a lane and everything standing in it. */
export function removeLane(graph: SwimGraph, laneId: string): Partial<SwimGraph> {
  // Never leave a diagram with no lane: there would be nowhere to drop a step.
  if (graph.lanes.length <= 1) return {};

  const orphaned = graph.nodes.filter((node) => node.laneId === laneId).map((node) => node.id);

  return {
    lanes: graph.lanes.filter((lane) => lane.id !== laneId),
    ...removeSwimNodes(graph, orphaned),
  };
}
