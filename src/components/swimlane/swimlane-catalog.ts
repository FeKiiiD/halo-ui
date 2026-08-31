import type { SwimNodeKind } from "../../lib/swimlane";

export interface SwimCatalogItem {
  type: SwimNodeKind;
  label: string;
  icon: string;
  note: string;
}

export interface SwimCatalogGroup {
  key: string;
  label: string;
  icon: string;
  items: SwimCatalogItem[];
}

/**
 * The step palette, grouped by intent.
 *
 * The first two groups are the grammar of a journey — milestones and step
 * kinds. The rest are worked examples for a specific domain: replace them
 * wholesale via the `catalog` prop rather than editing them, since what a lane
 * can hold is entirely a property of the process being drawn.
 */
export const SWIM_CATEGORIES: SwimCatalogGroup[] = [
  {
    key: "flow",
    label: "Milestones",
    icon: "flag",
    items: [
      { type: "start", label: "Start", icon: "play", note: "Opens the journey in this lane." },
      { type: "end", label: "End", icon: "flag", note: "Closes the journey." },
    ],
  },
  {
    key: "steps",
    label: "Steps",
    icon: "square",
    items: [
      { type: "step", label: "Action", icon: "square", note: "What the lane's actor does." },
      { type: "decision", label: "Decision", icon: "git-branch", note: "Two possible continuations." },
      { type: "wait", label: "Wait", icon: "hourglass", note: "The journey pauses here." },
    ],
  },
  {
    key: "counter",
    label: "Counter",
    icon: "store",
    items: [
      { type: "step", label: "Offer the card", icon: "message-square", note: "“Do you have the card?”" },
      { type: "step", label: "Scan the QR", icon: "qr-code", note: "Three seconds, nothing to download." },
      { type: "step", label: "Credit a visit", icon: "plus-circle", note: "Increments the counter." },
      { type: "step", label: "Announce the reward", icon: "gift", note: "Said out loud." },
    ],
  },
  {
    key: "platform",
    label: "Platform",
    icon: "server",
    items: [
      { type: "step", label: "Find the card", icon: "search", note: "By phone number or id." },
      { type: "step", label: "Send an SMS", icon: "send", note: "A reminder or a confirmation." },
      { type: "step", label: "Write to the till", icon: "webhook", note: "Through the connector." },
      { type: "step", label: "Export", icon: "download", note: "A CSV file." },
    ],
  },
];
