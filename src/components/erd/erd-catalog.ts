import { erdUid, type ColumnTypeKey, type ErdColumn, type ErdTable } from "../../lib/erd";

export interface ErdCatalogItem {
  type: "table" | "view";
  label: string;
  icon: string;
  note: string;
  /** [name, type, extra] — kept terse because a catalog is mostly data. */
  columns: [string, ColumnTypeKey, Partial<ErdColumn>?][];
}

export interface ErdCatalogGroup {
  key: string;
  label: string;
  icon: string;
  items: ErdCatalogItem[];
}

export const makeColumn = (
  name: string,
  type: ColumnTypeKey,
  extra: Partial<ErdColumn> = {},
): ErdColumn => ({ id: erdUid("c"), name, type, ...extra });

/** Turns a catalog entry into a table placed on the canvas. */
export const makeTable = (spec: ErdCatalogItem, x: number, y: number): ErdTable => ({
  id: erdUid("t"),
  name: spec.label,
  kind: spec.type === "view" ? "view" : "table",
  note: spec.note,
  x,
  y,
  columns: (spec.columns.length ? spec.columns : ([["id", "uuid", { pk: true }]] as const)).map(
    ([name, type, extra]) => makeColumn(name, type as ColumnTypeKey, extra),
  ),
});

/**
 * The table palette.
 *
 * The second group is the grammar — a blank table, a join table, a view. The
 * first is a worked example for one domain; replace it wholesale through the
 * `catalog` prop rather than editing it.
 */
export const ERD_CATEGORIES: ErdCatalogGroup[] = [
  {
    key: "tables",
    label: "Example tables",
    icon: "database",
    items: [
      {
        type: "table",
        label: "sites",
        icon: "store",
        note: "One restaurant, one programme.",
        columns: [
          ["id", "uuid", { pk: true }],
          ["name", "varchar"],
          ["city", "varchar"],
          ["created_at", "timestamp"],
        ],
      },
      {
        type: "table",
        label: "cards",
        icon: "credit-card",
        note: "The card added to the phone.",
        columns: [
          ["id", "uuid", { pk: true }],
          ["site_id", "uuid", { fk: true }],
          ["phone", "varchar", { unique: true }],
          ["added_at", "timestamp"],
        ],
      },
      {
        type: "table",
        label: "visits",
        icon: "plus-circle",
        note: "One credited visit.",
        columns: [
          ["id", "uuid", { pk: true }],
          ["card_id", "uuid", { fk: true }],
          ["amount", "money", { nullable: true }],
          ["at", "timestamp"],
        ],
      },
      {
        type: "table",
        label: "rewards",
        icon: "gift",
        note: "What the customer collects.",
        columns: [
          ["id", "uuid", { pk: true }],
          ["site_id", "uuid", { fk: true }],
          ["label", "varchar"],
          ["threshold", "int"],
        ],
      },
      {
        type: "table",
        label: "messages",
        icon: "send",
        note: "Reminders sent.",
        columns: [
          ["id", "uuid", { pk: true }],
          ["card_id", "uuid", { fk: true }],
          ["body", "text"],
          ["sent_at", "timestamp", { nullable: true }],
        ],
      },
    ],
  },
  {
    key: "blank",
    label: "Structures",
    icon: "table",
    items: [
      {
        type: "table",
        label: "new_table",
        icon: "table",
        note: "Two columns, to fill in.",
        columns: [
          ["id", "uuid", { pk: true }],
          ["created_at", "timestamp"],
        ],
      },
      {
        type: "table",
        label: "join_table",
        icon: "link",
        note: "Two foreign keys, composite primary key.",
        columns: [
          ["left_id", "uuid", { pk: true, fk: true }],
          ["right_id", "uuid", { pk: true, fk: true }],
        ],
      },
      {
        type: "view",
        label: "stats_view",
        icon: "eye",
        note: "Read-only view.",
        columns: [
          ["site_id", "uuid"],
          ["visits", "int"],
          ["cards", "int"],
        ],
      },
    ],
  },
];
