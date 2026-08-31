import type { FlowNodeType } from "../../lib/flow";

export interface FlowCategory {
  key: string;
  label: string;
  icon: string;
  nodes: FlowNodeType[];
}

/**
 * The node catalogue.
 *
 * The shape is the contract — triggers start, conditions branch, actions do —
 * and the specific nodes are a worked example for one domain. Replace the
 * whole array through the `catalog` prop rather than editing it: what an
 * automation can do is entirely a property of the product it automates.
 */
export const FLOW_CATEGORIES: FlowCategory[] = [
  {
    key: "triggers",
    label: "Triggers",
    icon: "zap",
    nodes: [
      {
        type: "trigger.scan",
        kind: "trigger",
        label: "Card scanned",
        icon: "qr-code",
        note: "A customer presents their card at the counter.",
        params: [
          {
            key: "place",
            label: "Site",
            editor: "select",
            options: ["All", "Le Bistrot du Coin", "Chez Marcel"],
            default: "All",
          },
          {
            key: "window",
            label: "Window",
            editor: "select",
            options: ["All day", "Lunch service", "Dinner service"],
            default: "All day",
          },
        ],
      },
      {
        type: "trigger.threshold",
        kind: "trigger",
        label: "Threshold reached",
        icon: "target",
        note: "The customer reaches the required number of visits.",
        params: [{ key: "visits", label: "Visits", editor: "number", default: 10 }],
      },
      {
        type: "trigger.schedule",
        kind: "trigger",
        label: "Scheduled",
        icon: "clock",
        note: "At a fixed time, daily or weekly.",
        params: [
          {
            key: "freq",
            label: "Frequency",
            editor: "select",
            options: ["Daily", "Weekly", "Monthly"],
            default: "Weekly",
          },
          { key: "time", label: "Time", editor: "text", default: "09:00" },
        ],
      },
      {
        type: "trigger.webhook",
        kind: "trigger",
        label: "Till webhook",
        icon: "webhook",
        note: "A till connector pushes a visit.",
        params: [
          {
            key: "source",
            label: "Connector",
            editor: "select",
            options: ["Zelty", "Tiller", "Lightspeed"],
            default: "Zelty",
          },
        ],
      },
    ],
  },
  {
    key: "logic",
    label: "Logic",
    icon: "git-branch",
    nodes: [
      {
        type: "logic.if",
        kind: "condition",
        label: "Condition",
        icon: "git-branch",
        note: "Two outputs: yes and no.",
        params: [
          {
            key: "field",
            label: "Field",
            editor: "select",
            options: ["Visits", "Total spent", "Last visit", "Status"],
            default: "Visits",
          },
          {
            key: "op",
            label: "Operator",
            editor: "select",
            options: ["greater than", "less than", "equal to", "is one of"],
            default: "greater than",
          },
          { key: "value", label: "Value", editor: "text", default: "10" },
        ],
      },
      {
        type: "logic.wait",
        kind: "action",
        label: "Wait",
        icon: "hourglass",
        note: "Pauses the journey.",
        params: [
          { key: "amount", label: "Duration", editor: "number", default: 30 },
          {
            key: "unit",
            label: "Unit",
            editor: "select",
            options: ["minutes", "hours", "days"],
            default: "days",
          },
        ],
      },
      {
        type: "logic.filter",
        kind: "action",
        label: "Filter",
        icon: "filter",
        note: "Only lets through cards that match.",
        params: [
          {
            key: "rule",
            label: "Rule",
            editor: "textarea",
            placeholder: "Status is dormant and total spent over 50 €",
          },
        ],
      },
    ],
  },
  {
    key: "actions",
    label: "Actions",
    icon: "play",
    nodes: [
      {
        type: "action.sms",
        kind: "action",
        label: "Send an SMS",
        icon: "message-square",
        note: "A short message, 160 characters.",
        params: [
          {
            key: "text",
            label: "Message",
            editor: "textarea",
            default: "Your next coffee is on us.",
            help: "Billed per 160-character segment.",
          },
          { key: "sender", label: "Sender", editor: "text", default: "Le Bistrot du Coin" },
        ],
      },
      {
        type: "action.reward",
        kind: "action",
        label: "Credit a reward",
        icon: "gift",
        note: "Adds the reward to the customer's card.",
        params: [
          {
            key: "reward",
            label: "Reward",
            editor: "select",
            options: ["Free coffee", "Free dessert", "20% off the set menu"],
            default: "Free coffee",
          },
          {
            key: "expiry",
            label: "Valid for",
            editor: "select",
            options: ["7 days", "30 days", "No limit"],
            default: "30 days",
          },
        ],
      },
      {
        type: "action.visit",
        kind: "action",
        label: "Credit a visit",
        icon: "plus-circle",
        note: "Increments the card's counter.",
        params: [{ key: "count", label: "Visits", editor: "number", default: 1 }],
      },
      {
        type: "action.tag",
        kind: "action",
        label: "Tag the customer",
        icon: "tag",
        note: "Sets a label used by segments.",
        params: [{ key: "tag", label: "Tag", editor: "text", default: "regular" }],
      },
    ],
  },
];
