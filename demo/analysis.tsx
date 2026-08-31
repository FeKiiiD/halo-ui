import * as React from "react";
import {
  BcgMatrix,
  CatchmentMap,
  CommitHistory,
  GanttChart,
  GraphMap,
  ConversationList,
  CookieConsent,
  DiagramEditor,
  ErdDiagram,
  FlowEditor,
  FlowExecutions,
  JsonViewer,
  SiteBuilder,
  ZoneMap,
  LifeCycleCurve,
  LiveWaveform,
  MessageComposer,
  MessageThread,
  PainGainMatrix,
  RaciMatrix,
  SwimlaneDiagram,
  SwotMatrix,
  VoiceButton,
  type BcgItem,
  type LifeCycleItem,
  type Commit,
  type GanttTask,
  type Link as DiagramLink,
  type Shape as DiagramShape,
  type PainGainItem,
  type RaciCode,
  type SwimEdge,
  type SwimLane,
  type SwimNode,
  type SwimPhase,
  type ErdRelation,
  type ErdTable,
  type FlowEdge,
  type FlowNode,
  type BuilderNode,
  type CatchmentPoint,
  type Execution,
  indexTypes,
  FLOW_CATEGORIES,
} from "../src";
import { Section } from "./forms";

const people = [
  { id: "1", name: "Marie Dupont", role: "Owner" },
  { id: "2", name: "Jean Bernard", role: "Chef" },
  { id: "3", name: "Alice Moreau", role: "Front of house" },
  { id: "4", name: "Paul Girard", role: "Accountant" },
];

const raciRows = [
  { id: "r1", name: "Define the reward", group: "Design" },
  { id: "r2", name: "Set the number of stamps", group: "Design" },
  { id: "r3", name: "Brief the counter staff", group: "Launch" },
  { id: "r4", name: "Publish the programme", group: "Launch" },
  { id: "r5", name: "Review the monthly figures", group: "Run" },
];

// RaciCode rather than the four letters: cycling a cell back to empty is a
// valid state, and the demo has to hold it.
const raciAssignments: Record<string, Record<string, RaciCode>> = {
  r1: { "1": "A", "2": "R", "3": "C" },
  r2: { "1": "A", "2": "C", "4": "R" },
  r3: { "1": "I", "3": "R" },
  // Deliberately missing an approver, so the checks have something to report.
  r4: { "3": "R", "2": "C" },
  r5: { "1": "A", "4": "R", "2": "I" },
};

const planning: GanttTask[] = [
  { id: "t1", name: "Interview six owners", start: "2026-09-01", end: "2026-09-11", group: "Discovery", status: "done", people: ["Marie Dupont"] },
  { id: "t2", name: "Write up the findings", start: "2026-09-12", end: "2026-09-18", group: "Discovery", status: "done", dependsOn: ["t1"], people: ["Alice Moreau"] },
  { id: "t3", name: "Card and counter screens", start: "2026-09-21", end: "2026-10-09", group: "Design", dependsOn: ["t2"], progress: 60, people: ["Alice Moreau", "Jean Bernard"] },
  { id: "t4", name: "Design review", start: "2026-10-12", end: "2026-10-12", group: "Design", dependsOn: ["t3"] },
  { id: "t5", name: "Counter app", start: "2026-10-13", end: "2026-11-13", group: "Build", dependsOn: ["t4"], progress: 20, people: ["Jean Bernard"] },
  { id: "t6", name: "Wallet passes", start: "2026-10-20", end: "2026-11-06", group: "Build", status: "late", people: ["Paul Girard"] },
  { id: "t7", name: "Pilot in two sites", start: "2026-11-16", end: "2026-12-04", group: "Launch", dependsOn: ["t5"] },
  { id: "t8", name: "Go live", start: "2026-12-08", end: "2026-12-08", group: "Launch", dependsOn: ["t7"] },
];

const graphNodes = [
  { id: "card", label: "Loyalty card", group: 0, size: 3, meta: "Core object", body: "One card per customer per programme. Holds the stamp count and nothing else — the history lives on the visits.", stats: [{ label: "Live", value: "1 208" }, { label: "Active", value: "842" }] },
  { id: "customer", label: "Customer", group: 1, meta: "Core object", body: "Identified by phone number. No account, no password: the counter is not the place to reset one." },
  { id: "visit", label: "Visit", group: 1, meta: "Event", body: "Append-only. A correction is a second visit with a negative stamp, never an edit." },
  { id: "reward", label: "Reward", group: 2, meta: "Core object" },
  { id: "programme", label: "Programme", group: 0, size: 2, meta: "Configuration", body: "Stamps required, what the reward is, which sites honour it." },
  { id: "site", label: "Site", group: 3, meta: "Configuration" },
  { id: "staff", label: "Counter staff", group: 3 },
  { id: "sms", label: "SMS", group: 4, meta: "Channel", body: "Billed per 160-character segment." },
  { id: "wallet", label: "Wallet pass", group: 4, meta: "Channel" },
  { id: "receipt", label: "Receipt", group: 2 },
];

const graphLinks = [
  { source: "customer", target: "card" },
  { source: "card", target: "programme" },
  { source: "card", target: "visit" },
  { source: "visit", target: "site" },
  { source: "visit", target: "staff" },
  { source: "card", target: "reward" },
  { source: "reward", target: "receipt" },
  { source: "programme", target: "site" },
  { source: "customer", target: "sms" },
  { source: "customer", target: "wallet" },
  { source: "wallet", target: "card" },
  { source: "reward", target: "sms" },
];

const commits: Commit[] = [
  { id: "c1", title: "Cap the stamp count at the programme maximum", sha: "8f2a1c4", author: "Jean Bernard", time: "2 hours ago", branch: "main", lane: 0, head: true, message: "A card could be credited past its own target, which made the reward fire twice.", files: 3, added: 41, removed: 12, changes: [ { name: "src/loyalty/credit.ts", added: 28, removed: 9 }, { name: "src/loyalty/credit.test.ts", status: "added", added: 13 }, { name: "CHANGELOG.md", removed: 3 } ] },
  { id: "c2", title: "Merge wallet passes", sha: "3d90b77", author: "Marie Dupont", time: "5 hours ago", branch: "main", lane: 0, mergeFrom: 1, files: 9, added: 302, removed: 18 },
  { id: "c3", title: "Sign the pass bundle before upload", sha: "b71e0a2", author: "Paul Girard", time: "Yesterday", branch: "wallet", lane: 1, files: 2, added: 64, removed: 4 },
  { id: "c4", title: "Generate an Apple Wallet pass per card", sha: "5c48fe1", author: "Paul Girard", time: "Yesterday", branch: "wallet", lane: 1, branchFrom: 0, files: 7, added: 238, removed: 14 },
  { id: "c5", title: "Round the redemption rate to one decimal", sha: "a02d5b9", author: "Alice Moreau", time: "2 days ago", branch: "main", lane: 0, files: 1, added: 4, removed: 4 },
  { id: "c6", title: "Release 2.4", sha: "e14c73f", author: "Marie Dupont", time: "3 days ago", branch: "main", lane: 0, tag: "v2.4", files: 2, added: 11, removed: 2 },
  { id: "c7", title: "Read the counter tablet's offline queue on reconnect", sha: "77b3ad0", author: "Jean Bernard", time: "4 days ago", branch: "main", lane: 0, files: 5, added: 156, removed: 31 },
];

const diagramShapes: DiagramShape[] = [
  { id: "d1", type: "pill", x: 64, y: 40, w: 168, h: 64, text: "Customer pays", fill: "mist", align: "center", valign: "middle", fontSize: 15 },
  { id: "d2", type: "diamond", x: 64, y: 168, w: 176, h: 116, text: "Card already added?", fill: "paper", align: "center", valign: "middle", fontSize: 14 },
  { id: "d3", type: "rect", x: 320, y: 176, w: 168, h: 88, text: "Credit one stamp", fill: "paper", align: "center", valign: "middle", fontSize: 15 },
  { id: "d4", type: "rect", x: 64, y: 340, w: 168, h: 88, text: "Scan the phone number", fill: "paper", align: "center", valign: "middle", fontSize: 15 },
  { id: "d5", type: "diamond", x: 320, y: 320, w: 176, h: 116, text: "Tenth stamp?", fill: "paper", align: "center", valign: "middle", fontSize: 14 },
  { id: "d6", type: "round", x: 576, y: 328, w: 168, h: 88, text: "Reward is ready", fill: "lime", align: "center", valign: "middle", fontSize: 15 },
  { id: "d7", type: "note", x: 576, y: 88, w: 156, h: 128, text: "Three seconds at the counter, nothing to download.", fill: "lime", align: "left", valign: "middle", fontSize: 14 },
];

const diagramLinks: DiagramLink[] = [
  { id: "dl1", from: "d1", to: "d2", style: "elbow" },
  { id: "dl2", from: "d2", to: "d3", style: "elbow", label: "yes" },
  { id: "dl3", from: "d2", to: "d4", style: "elbow", label: "no" },
  { id: "dl4", from: "d4", to: "d3", style: "elbow" },
  { id: "dl5", from: "d3", to: "d5", style: "elbow" },
  { id: "dl6", from: "d5", to: "d6", style: "elbow", label: "yes" },
];

const swimLanes: SwimLane[] = [
  { id: "sl1", label: "Customer", note: "At the counter" },
  { id: "sl2", label: "Counter staff", note: "Tablet in hand" },
  { id: "sl3", label: "Platform", note: "Automatic" },
];

const swimPhases: SwimPhase[] = [
  { id: "sp1", label: "Arrival", width: 200, tone: "mist" },
  { id: "sp2", label: "Payment", width: 380, tone: "lime" },
  { id: "sp3", label: "After", width: 420, tone: "sky" },
];

const swimNodes: SwimNode[] = [
  { id: "sn1", laneId: "sl1", x: 32, label: "Walks in", kind: "start", icon: "play" },
  { id: "sn2", laneId: "sl2", x: 224, label: "Offer the card", kind: "step", icon: "message-square" },
  { id: "sn3", laneId: "sl1", x: 224, label: "Shows the phone", kind: "step", icon: "qr-code" },
  { id: "sn4", laneId: "sl3", x: 416, label: "Find the card", kind: "step", icon: "search" },
  { id: "sn5", laneId: "sl3", x: 608, label: "Tenth visit?", kind: "decision", icon: "git-branch" },
  { id: "sn6", laneId: "sl2", x: 800, label: "Announce the reward", kind: "step", icon: "gift" },
  { id: "sn7", laneId: "sl3", x: 800, label: "Send an SMS", kind: "step", icon: "send" },
  { id: "sn8", laneId: "sl1", x: 992, label: "Leaves", kind: "end", icon: "flag" },
];

const swimEdges: SwimEdge[] = [
  { id: "se1", source: "sn1", target: "sn2" },
  { id: "se2", source: "sn2", target: "sn3" },
  { id: "se3", source: "sn3", target: "sn4" },
  { id: "se4", source: "sn4", target: "sn5" },
  { id: "se5", source: "sn5", target: "sn6" },
  { id: "se6", source: "sn5", target: "sn7" },
  { id: "se7", source: "sn6", target: "sn8" },
  // A loop back: the card was not recognised, so the counter asks again.
  { id: "se8", source: "sn4", target: "sn2", dashed: true },
];

const erdTables: ErdTable[] = [
  {
    id: "et1", name: "sites", x: 40, y: 40,
    columns: [
      { id: "ec1", name: "id", type: "uuid", pk: true },
      { id: "ec2", name: "name", type: "varchar" },
      { id: "ec3", name: "city", type: "varchar" },
      { id: "ec4", name: "created_at", type: "timestamp" },
    ],
  },
  {
    id: "et2", name: "cards", x: 400, y: 40,
    columns: [
      { id: "ec5", name: "id", type: "uuid", pk: true },
      { id: "ec6", name: "site_id", type: "uuid", fk: true },
      { id: "ec7", name: "phone", type: "varchar", unique: true },
      { id: "ec8", name: "added_at", type: "timestamp" },
    ],
  },
  {
    id: "et3", name: "visits", x: 760, y: 40,
    columns: [
      { id: "ec9", name: "id", type: "uuid", pk: true },
      { id: "ec10", name: "card_id", type: "uuid", fk: true },
      { id: "ec11", name: "amount", type: "money", nullable: true },
      { id: "ec12", name: "at", type: "timestamp" },
    ],
  },
  {
    id: "et4", name: "rewards", x: 400, y: 260,
    columns: [
      { id: "ec13", name: "id", type: "uuid", pk: true },
      { id: "ec14", name: "site_id", type: "uuid", fk: true },
      { id: "ec15", name: "label", type: "varchar" },
      { id: "ec16", name: "threshold", type: "int" },
    ],
  },
];

const erdRelations: ErdRelation[] = [
  { id: "er1", fromTable: "et2", fromColumn: "ec6", toTable: "et1", toColumn: "ec1", cardinality: "1-n" },
  { id: "er2", fromTable: "et3", fromColumn: "ec10", toTable: "et2", toColumn: "ec5", cardinality: "1-n" },
  { id: "er3", fromTable: "et4", fromColumn: "ec14", toTable: "et1", toColumn: "ec1", cardinality: "1-n", onDelete: "cascade" },
];

const flowNodes: FlowNode[] = [
  { id: "fn1", type: "trigger.scan", x: 32, y: 32, params: { place: "All", window: "All day" } },
  { id: "fn2", type: "action.visit", x: 272, y: 32, params: { count: 1 } },
  { id: "fn3", type: "logic.if", x: 512, y: 32, params: { field: "Visits", op: "greater than", value: "9" } },
  { id: "fn4", type: "action.reward", x: 752, y: 0, params: { reward: "Free coffee", expiry: "30 days" } },
  { id: "fn5", type: "action.sms", x: 752, y: 144, params: { text: "One more visit and your coffee is on us.", sender: "Le Bistrot du Coin" } },
  // Deliberately left unwired, so the problems panel has something real to say.
  { id: "fn6", type: "action.tag", x: 512, y: 240, params: { tag: "regular" } },
];

const flowEdges: FlowEdge[] = [
  { id: "fe1", source: "fn1", target: "fn2", branch: "ok" },
  { id: "fe2", source: "fn2", target: "fn3", branch: "ok" },
  { id: "fe3", source: "fn3", target: "fn4", branch: "ok" },
  { id: "fe4", source: "fn3", target: "fn5", branch: "no" },
];

const page: BuilderNode[] = [
  {
    id: "pg1", type: "section",
    style: { paddingTop: 72, paddingBottom: 72, background: "var(--color-surface-page)" },
    responsive: { mobile: { paddingTop: 40, paddingBottom: 40 } },
    children: [
      {
        id: "pg2", type: "container",
        style: { maxWidth: 900, marginLeft: "auto", marginRight: "auto", paddingLeft: 24, paddingRight: 24, display: "flex", flexDirection: "column", gap: 20 },
        children: [
          { id: "pg3", type: "eyebrow", props: { text: "Loyalty, without the app" }, style: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, color: "var(--color-text-secondary)" } },
          {
            id: "pg4", type: "heading",
            props: { text: "Three seconds at the counter.", tag: "h1" },
            style: { fontSize: 52, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 },
            responsive: { mobile: { fontSize: 32 } },
          },
          { id: "pg5", type: "text", props: { text: "Your customer shows a phone number. The card is credited. Nothing to download, nothing to install, and it runs on the tablet you already own." }, style: { fontSize: 18, lineHeight: 1.55, margin: 0, maxWidth: 620, color: "var(--color-text-secondary)" } },
          { id: "pg6", type: "button", props: { text: "See it work", href: "#", variant: "primary" }, style: { height: 48, paddingLeft: 26, paddingRight: 26, borderRadius: 999, fontSize: 16, fontWeight: 500, alignSelf: "flex-start" } },
        ],
      },
    ],
  },
  {
    id: "pg7", type: "section",
    style: { paddingTop: 64, paddingBottom: 64, background: "var(--color-surface-alt)" },
    children: [
      {
        id: "pg8", type: "container",
        style: { maxWidth: 900, marginLeft: "auto", marginRight: "auto", paddingLeft: 24, paddingRight: 24 },
        children: [
          {
            id: "pg9", type: "grid",
            style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 },
            responsive: { mobile: { gridTemplateColumns: "1fr" } },
            children: [
              { id: "pg10", type: "card", props: { title: "At the counter", body: "A phone number, and it is done.", icon: "qr-code" }, style: { padding: 24, borderRadius: 20, background: "var(--color-surface-card)" } },
              { id: "pg11", type: "card", props: { title: "In the wallet", body: "The pass updates itself.", icon: "wallet" }, style: { padding: 24, borderRadius: 20, background: "var(--color-surface-card)" } },
              { id: "pg12", type: "card", props: { title: "On the reward", body: "Said out loud, not buried in an app.", icon: "gift", inverted: true }, style: { padding: 24, borderRadius: 20 } },
            ],
          },
        ],
      },
    ],
  },
];

// Lyon, and a scatter of customers around it.
const venue = { lat: 45.7578, lng: 4.832 };

const customers: CatchmentPoint[] = (() => {
  // A fixed pseudo-random walk: the demo must look the same on every load.
  let state = 4242;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;

  return Array.from({ length: 48 }, (_, index) => {
    const angle = random() * Math.PI * 2;
    // Squared, so most customers sit near the venue rather than in a ring.
    const km = random() ** 2 * 6;
    return {
      id: String(index),
      label: `Card ${1000 + index}`,
      lat: venue.lat + (km / 111.32) * Math.sin(angle),
      lng: venue.lng + (km / (111.32 * Math.cos((venue.lat * Math.PI) / 180))) * Math.cos(angle),
      weight: 1 + Math.floor(random() * 12),
    };
  });
})();

// Four arrondissement-ish blocks around the venue, as a minimal FeatureCollection.
const zoneShapes = {
  type: "FeatureCollection" as const,
  features: [
    ["r1", "Presqu'île", 0.0, 0.0, 412],
    ["r2", "Croix-Rousse", 0.02, -0.005, 168],
    ["r3", "Part-Dieu", -0.004, 0.028, 903],
    ["r4", "Guillotière", -0.022, 0.012, 241],
  ].map(([code, name, dLat, dLng]) => ({
    type: "Feature" as const,
    properties: { code, name },
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [venue.lng + (dLng as number) - 0.012, venue.lat + (dLat as number) - 0.009],
          [venue.lng + (dLng as number) + 0.012, venue.lat + (dLat as number) - 0.009],
          [venue.lng + (dLng as number) + 0.012, venue.lat + (dLat as number) + 0.009],
          [venue.lng + (dLng as number) - 0.012, venue.lat + (dLat as number) + 0.009],
          [venue.lng + (dLng as number) - 0.012, venue.lat + (dLat as number) - 0.009],
        ],
      ],
    },
  })),
};

const zoneValues: Record<string, number> = { r1: 412, r2: 168, r3: 903, r4: 241 };

const flowRuns: Execution[] = [
  {
    id: "run1",
    at: new Date(Date.now() - 4 * 60_000).toISOString(),
    status: "error",
    trigger: "Marie Dupont · 07 81 …",
    ms: 1840,
    steps: [
      { nodeId: "fn1", status: "ok", ms: 12, items: 1 },
      { nodeId: "fn2", status: "ok", ms: 96, items: 1 },
      { nodeId: "fn3", status: "ok", ms: 8, items: 1 },
      {
        nodeId: "fn4", status: "error", ms: 1724,
        error: "The reward could not be credited: the card already holds an unredeemed reward.",
        input: { card_id: "crd_8412", reward: "Free coffee", visits: 10 },
        output: { error: "duplicate_reward", existing: { id: "rwd_2291", issued: "2026-08-14" } },
      },
      { nodeId: "fn5", status: "skipped" },
    ],
  },
  {
    id: "run2",
    at: new Date(Date.now() - 22 * 60_000).toISOString(),
    status: "ok",
    trigger: "Jean Bernard · 06 44 …",
    ms: 412,
    steps: [
      { nodeId: "fn1", status: "ok", ms: 9, items: 1 },
      { nodeId: "fn2", status: "ok", ms: 88, items: 1 },
      { nodeId: "fn3", status: "ok", ms: 6, items: 1 },
      { nodeId: "fn5", status: "ok", ms: 309, items: 1, input: { phone: "06 44 …", body: "One more visit and your coffee is on us." }, output: { segments: 1, delivered: true } },
      { nodeId: "fn4", status: "skipped" },
    ],
  },
  {
    id: "run3",
    at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    status: "ok",
    trigger: "Alice Moreau · 07 12 …",
    ms: 388,
    steps: [
      { nodeId: "fn1", status: "ok", ms: 11, items: 1 },
      { nodeId: "fn2", status: "ok", ms: 91, items: 1 },
      { nodeId: "fn3", status: "ok", ms: 7, items: 1 },
      { nodeId: "fn5", status: "ok", ms: 279, items: 1 },
      { nodeId: "fn4", status: "skipped" },
    ],
  },
];

export function AnalysisSheet() {
  const [bcg, setBcg] = React.useState<BcgItem[]>([
    { id: "1", label: "Lunch", share: 1.6, growth: 4, value: 182000, margin: 22, trend: 3 },
    { id: "2", label: "Dinner", share: 1.2, growth: 14, value: 264000, margin: 31, trend: 18 },
    { id: "3", label: "Delivery", share: 0.4, growth: 16, value: 61000, margin: 11, trend: 42 },
    { id: "4", label: "Catering", share: 0.3, growth: 3, value: 24000, margin: 18, trend: -6 },
  ]);

  const [painGain, setPainGain] = React.useState<PainGainItem[]>([
    { id: "1", label: "Stamp card", pain: 2, gain: 8.5 },
    { id: "2", label: "Automatic reminders", pain: 4, gain: 9 },
    { id: "3", label: "Mobile app", pain: 9, gain: 6 },
    { id: "4", label: "Printed flyers", pain: 3, gain: 2 },
    { id: "5", label: "Loyalty tiers", pain: 7, gain: 7.5 },
  ]);

  const [lifecycle, setLifecycle] = React.useState<LifeCycleItem[]>([
    { id: "1", label: "Paper cards", at: 88, value: 12000, growth: -14, players: 40, since: "2012" },
    { id: "2", label: "Phone wallets", at: 44, value: 264000, growth: 22, players: 12, since: "2021" },
    { id: "3", label: "QR at the counter", at: 20, value: 61000, growth: 68, players: 4, since: "2025" },
  ]);

  const [swot, setSwot] = React.useState({
    strengths: [
      { text: "Three seconds at the counter, nothing to download.", weight: 3 },
      { text: "Runs on a tablet the restaurant already owns.", weight: 2 },
    ] as { text: string; weight?: number }[],
    weaknesses: [{ text: "No offline mode during a service.", weight: 2 }],
    opportunities: [{ text: "Groups running several sites want one card.", weight: 3 }],
    threats: [{ text: "Delivery platforms bundling their own loyalty.", weight: 3 }],
  });

  const [assignments, setAssignments] = React.useState(raciAssignments);
  const [tasks, setTasks] = React.useState(planning);
  const [pageTree, setPageTree] = React.useState(page);
  const [flow, setFlow] = React.useState({ nodes: flowNodes, edges: flowEdges });
  const [erd, setErd] = React.useState({ tables: erdTables, relations: erdRelations });
  const [swim, setSwim] = React.useState({
    lanes: swimLanes,
    nodes: swimNodes,
    edges: swimEdges,
    phases: swimPhases,
  });
  const [micError, setMicError] = React.useState<string | null>(null);
  const [conversation, setConversation] = React.useState("1");
  const [draft, setDraft] = React.useState("");
  const [channel, setChannel] = React.useState("SMS");

  return (
    <div className="flex flex-col gap-16">
      <Section
        title="Strategy"
        note="Analysis tools rather than product UI — they appear inside a document or a report. Drag the bubbles: the BCG and pain/gain plots commit once on release, not on every frame."
      >
        <SwotMatrix
          editable
          weights
          strengths={swot.strengths}
          weaknesses={swot.weaknesses}
          opportunities={swot.opportunities}
          threats={swot.threats}
          onAdd={(quadrant, text) =>
            setSwot((current) => ({ ...current, [quadrant]: [...current[quadrant], { text }] }))
          }
          onRemove={(quadrant, item) =>
            setSwot((current) => ({
              ...current,
              [quadrant]: current[quadrant].filter((entry) => entry !== item),
            }))
          }
        />

        <BcgMatrix
          items={bcg}
          onChange={(id, position) =>
            setBcg((current) =>
              current.map((item) => (item.id === id ? { ...item, ...position } : item)),
            )
          }
        />

        <PainGainMatrix
          items={painGain}
          onChange={(id, position) =>
            setPainGain((current) =>
              current.map((item) => (item.id === id ? { ...item, ...position } : item)),
            )
          }
        />

        <LifeCycleCurve
          items={lifecycle}
          onChange={(id, at) =>
            setLifecycle((current) =>
              current.map((item) => (item.id === id ? { ...item, at } : item)),
            )
          }
        />

        <RaciMatrix
          editable
          people={people}
          rows={raciRows}
          assignments={assignments}
          onChange={(rowId, personId, code) =>
            setAssignments((current) => ({
              ...current,
              [rowId]: { ...current[rowId], [personId]: code },
            }))
          }
        />
      </Section>

      <Section
        title="Planning"
        note="Press Edit, then drag a bar to move it, either end to stretch it, or the dot on its right edge onto another row to draw a dependency. Nothing commits until you save."
      >
        <GanttChart
          title="Loyalty programme"
          tasks={tasks}
          today="2026-10-27"
          onSave={setTasks}
        />
      </Section>

      <Section
        title="Relations"
        note="A force layout. Hovering a node lights its neighbourhood and dims the rest — a graph this size is unreadable otherwise. The selected node is the only lime element on screen."
      >
        <GraphMap
          title="Model"
          nodes={graphNodes}
          links={graphLinks}
          groups={["Core", "People", "Rewards", "Places", "Channels"]}
          height={460}
        />
      </Section>

      <Section
        title="Version history"
        note="The whole row is the target, not the 8px dot. Tick two commits to compare them; picking a third drops the older rather than refusing the click."
      >
        <CommitHistory
          title="Repository"
          commits={commits}
          activeBranch="main"
          onCompare={() => undefined}
          onRestore={() => undefined}
        />
      </Section>

      <Section
        title="Voice"
        note="Press to record, press again to stop. A refused microphone falls back to a synthetic signal — a control that freezes flat reads as broken rather than as blocked — and reports the refusal separately."
      >
        <div className="flex flex-wrap items-center gap-4">
          <VoiceButton
            shortcut="⌘K"
            onRecord={() => new Promise((resolve) => setTimeout(resolve, 1400))}
            onMicError={() => setMicError("The browser refused the microphone — showing a synthetic signal.")}
          />
          <VoiceButton
            iconOnly
            onRecord={() => new Promise((_, reject) => setTimeout(reject, 900))}
          />
        </div>

        {micError ? (
          <span className="text-body-s text-text-secondary">{micError}</span>
        ) : null}

        <div className="rounded-card border border-border-subtle bg-surface-card p-card">
          <LiveWaveform active bars={64} height={56} />
        </div>
      </Section>

      <Section
        title="Diagramming"
        note="No node types and no execution order — anything links to anything. Drop a shape from the palette, double-click to write, drag a lime dot between two shapes to connect them. Saves and publishes are recorded as a lane graph."
      >
        <DiagramEditor
          title="How a stamp is credited"
          shapes={diagramShapes}
          links={diagramLinks}
          height={470}
          onSave={() => new Promise((resolve) => setTimeout(resolve, 700))}
        />
      </Section>

      <Section
        title="Swimlanes"
        note="The two axes mean different things. Drag a step sideways to move it in time; drag it up or down to hand it to another actor — a handoff is a vertical move, which is the whole point of the diagram. The dashed edge loops backward and routes below the lanes rather than through them."
      >
        <SwimlaneDiagram
          title="A visit, end to end"
          subtitle="Who does what, and when it changes hands"
          lanes={swim.lanes}
          nodes={swim.nodes}
          edges={swim.edges}
          phases={swim.phases}
          onChange={setSwim}
          height={420}
          onSave={() => new Promise((resolve) => setTimeout(resolve, 700))}
        />
      </Section>

      <Section
        title="Schema"
        note="The SQL is the output, not the diagram. Tables are emitted in the order they sit on the canvas — left to right — so the dump and the drawing can be read side by side. A relation is drawn from a column, because which column carries the key is the entire content of a foreign key."
      >
        <ErdDiagram
          title="Loyalty schema"
          subtitle="Four tables, three foreign keys"
          tables={erd.tables}
          relations={erd.relations}
          onChange={setErd}
          height={440}
          onSave={() => new Promise((resolve) => setTimeout(resolve, 700))}
        />
      </Section>

      <Section
        title="Automation"
        note="A flow is not a drawing — it runs. The problems panel reports what would go wrong before anyone publishes: nothing to start it, a step nothing leads to, a condition wired on one branch only. All three look fine on the canvas. Errors block the test run; warnings never do."
      >
        <FlowEditor
          title="Credit a visit"
          subtitle="From the scan to the reward"
          nodes={flow.nodes}
          edges={flow.edges}
          onChange={setFlow}
          height={430}
          onSave={() => new Promise((resolve) => setTimeout(resolve, 700))}
        />

        <FlowExecutions
          nodes={flow.nodes}
          edges={flow.edges}
          types={indexTypes(FLOW_CATEGORIES)}
          executions={flowRuns}
          height={340}
          onRetry={() => undefined}
          className="rounded-card border border-border-subtle bg-surface-card"
        />
      </Section>

      <Section
        title="Page builder"
        note="What the canvas shows is what the export renders — no placeholders. Switch to the tablet or mobile frame and a style change lands on that breakpoint alone; smaller screens inherit from larger ones, so a mobile tweak never has to restate the tablet one. Export produces a standalone HTML page."
      >
        <SiteBuilder
          title="Landing page"
          value={pageTree}
          onChange={setPageTree}
          height={520}
          onSave={() => new Promise((resolve) => setTimeout(resolve, 700))}
        />
      </Section>

      <Section
        title="Maps"
        note="Geography is loaded, never drawn — a freehand map of a city is always wrong, and wrong in a way that looks convincing. Leaflet is an optional peer dependency, so a project that shows no maps never pays for one, and it is never fetched from a CDN. Switch to Time: with no routing service the reach areas are modelled, and the map says so rather than passing an estimate off as data."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <CatchmentMap
            center={venue}
            place="Le Bistrot du Coin"
            points={customers}
            rings={[1, 2.5, 5]}
            height={380}
          />

          <ZoneMap
            title="Cards by district"
            shapes={zoneShapes}
            values={zoneValues}
            legendLabel="Cards in circulation"
            height={380}
          />
        </div>
      </Section>

      <Section
        title="Messaging"
        note="An SMS is billed per 160-character segment, so the count in the composer is the cost, not decoration."
      >
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ConversationList
            conversations={[
              {
                id: "1",
                name: "Marie Dupont",
                preview: "Thanks, see you Thursday.",
                time: "12:04",
                channel: "message-square",
                tag: "Regular",
              },
              {
                id: "2",
                name: "Jean Bernard",
                preview: "Is the card still valid?",
                time: "11:20",
                unread: 2,
                channel: "mail",
              },
              { id: "3", name: "Alice Moreau", typing: true, time: "10:58", channel: "wallet" },
              {
                id: "4",
                name: "Paul Girard",
                preview: "Could I get a receipt?",
                time: "Yesterday",
                channel: "mail",
              },
            ]}
            activeId={conversation}
            onSelect={setConversation}
          />

          <MessageThread
            messages={[
              { day: "Thursday" },
              { id: "1", from: "them", text: "Hi — is my card still valid?", time: "11:18" },
              {
                id: "2",
                from: "me",
                text: "It is. You have 7 of 10 stamps, and it does not expire.",
                time: "11:20",
                status: "read",
              },
              { id: "3", from: "them", text: "Perfect, thanks.", time: "11:21" },
              { day: "Today" },
              {
                id: "4",
                from: "me",
                text: "Your reward is ready — the next visit is on us.",
                time: "12:02",
                status: "delivered",
              },
              { id: "5", from: "me", text: "This one did not go through.", time: "12:03", status: "failed" },
            ]}
            typing
            typingLabel="Marie is typing"
            footer={
              <MessageComposer
                value={draft}
                onChange={setDraft}
                channel={channel}
                channels={["SMS", "Email", "Card"]}
                onChannelChange={setChannel}
                variables={[
                  { token: "{{first_name}}", label: "First name" },
                  { token: "{{stamps}}", label: "Stamps" },
                ]}
                onSend={() => new Promise((resolve) => setTimeout(resolve, 900))}
                hint="Sent from the restaurant's number."
              />
            }
          />
        </div>
      </Section>

      <Section
        title="Data and consent"
        note="Search in the JSON viewer highlights rather than filters: removing non-matching rows destroys the structure that makes a match meaningful."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <JsonViewer
            value={{
              programme: {
                id: "prg_8412",
                name: "Autumn card",
                published: true,
                stamps: { required: 10, credited: 7 },
                reward: { type: "free_cover", value: null },
                sites: ["Le Bistrot du Coin", "Chez Marcel"],
                created: "2026-03-05T09:12:00Z",
              },
              stats: { cards: 1208, active: 842, redeemed: 96, rate: 0.114 },
            }}
            onCopyPath={() => undefined}
          />

          <CookieConsent position="inline" view="panel" tone="card" />
        </div>

        <CookieConsent position="inline" />
      </Section>
    </div>
  );
}
