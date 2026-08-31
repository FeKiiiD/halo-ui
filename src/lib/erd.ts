/**
 * Entity-relationship geometry and SQL generation.
 *
 * The SQL is the part worth testing without a browser: a dump that quotes
 * wrongly, orders constraints wrongly, or silently drops a foreign key looks
 * perfectly plausible on screen and fails only when someone runs it.
 */

export type ColumnTypeKey =
  | "uuid"
  | "int"
  | "text"
  | "varchar"
  | "bool"
  | "money"
  | "date"
  | "timestamp"
  | "json"
  | "enum";

export interface ColumnType {
  key: ColumnTypeKey;
  label: string;
  icon: string;
  sql: string;
}

export const COLUMN_TYPES: ColumnType[] = [
  { key: "uuid", label: "uuid", icon: "fingerprint", sql: "uuid" },
  { key: "int", label: "integer", icon: "hash", sql: "integer" },
  { key: "text", label: "text", icon: "type", sql: "text" },
  { key: "varchar", label: "short text", icon: "type", sql: "varchar(120)" },
  { key: "bool", label: "boolean", icon: "toggle-left", sql: "boolean" },
  { key: "money", label: "amount", icon: "coins", sql: "numeric(10,2)" },
  { key: "date", label: "date", icon: "calendar", sql: "date" },
  { key: "timestamp", label: "timestamp", icon: "clock", sql: "timestamptz" },
  { key: "json", label: "json", icon: "braces", sql: "jsonb" },
  { key: "enum", label: "enum", icon: "list", sql: "text" },
];

/** Falls back to text: an unknown type must still emit valid SQL. */
export const typeOf = (key?: string): ColumnType =>
  COLUMN_TYPES.find((type) => type.key === key) ?? COLUMN_TYPES[2]!;

export interface ErdColumn {
  id: string;
  name: string;
  type: ColumnTypeKey;
  pk?: boolean;
  fk?: boolean;
  unique?: boolean;
  nullable?: boolean;
  /** Emitted verbatim after `default`. */
  default?: string;
  note?: string;
}

export interface ErdTable {
  id: string;
  name: string;
  kind?: "table" | "view";
  note?: string;
  x: number;
  y: number;
  columns: ErdColumn[];
}

export type Cardinality = "1-1" | "1-n" | "n-n";

export interface ErdRelation {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  cardinality?: Cardinality;
  onDelete?: "cascade" | "set null" | "restrict" | "no action";
}

export interface ErdGraph {
  tables: ErdTable[];
  relations: ErdRelation[];
}

/** Card width, header height and row height, in px. */
export const TABLE_W = 232;
export const HEAD_H = 38;
export const ROW_H = 30;

/**
 * The mark at each end, [from, to].
 *
 * THE FROM END IS THE CHILD. A relation is drawn from the column holding the
 * foreign key to the column it references, so in a one-to-many the *from* side
 * is the many — reading "1-n" left to right as [from, to] puts the marks the
 * wrong way round and inverts the meaning of every relation on the canvas.
 */
export const CARDINALITY_MARKS: Record<Cardinality, [string, string]> = {
  "1-1": ["1", "1"],
  "1-n": ["n", "1"],
  "n-n": ["n", "n"],
};

let counter = 0;

/** A counter, not Math.random: ids must not collide and must be testable. */
export const erdUid = (prefix: string): string => `${prefix}${(counter += 1).toString(36)}`;

export const resetErdUid = (): void => {
  counter = 0;
};

export const tableHeight = (table: ErdTable): number =>
  HEAD_H + table.columns.length * ROW_H + 6;

/** Vertical centre of a column's row, in canvas coordinates. */
export function columnY(table: ErdTable, columnId: string): number {
  const index = table.columns.findIndex((column) => column.id === columnId);
  // A missing column anchors to the first row rather than to NaN — a dangling
  // relation should draw somewhere sensible until it is cleaned up.
  return table.y + HEAD_H + Math.max(0, index) * ROW_H + ROW_H / 2 + 3;
}

export interface RelationGeometry {
  d: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  rightward: boolean;
}

/**
 * A relation drawn as a cubic between two column rows.
 *
 * The handles leave HORIZONTALLY from whichever side faces the other table, so
 * a relation reads as coming out of a row rather than out of a corner. The
 * handle length never drops below 28px: between two adjacent tables a shorter
 * handle makes the curve leave diagonally, which reads as pointing at the row
 * above or below.
 */
export function relationPath(
  from: ErdTable,
  to: ErdTable,
  fromColumn: string,
  toColumn: string,
): RelationGeometry {
  const ay = columnY(from, fromColumn);
  const by = columnY(to, toColumn);

  const rightward = to.x >= from.x;
  const ax = rightward ? from.x + TABLE_W : from.x;
  const bx = rightward ? to.x : to.x + TABLE_W;

  const reach = Math.max(28, Math.abs(bx - ax) / 2);
  const c1 = ax + (rightward ? reach : -reach);
  const c2 = bx - (rightward ? reach : -reach);

  return {
    d: `M ${ax} ${ay} C ${c1} ${ay}, ${c2} ${by}, ${bx} ${by}`,
    ax,
    ay,
    bx,
    by,
    rightward,
  };
}

export function erdContentSize(
  tables: ErdTable[],
  minWidth: number,
  minHeight: number,
): { width: number; height: number } {
  return {
    width: Math.max(minWidth, ...tables.map((table) => table.x + TABLE_W + 80)),
    height: Math.max(minHeight, ...tables.map((table) => table.y + tableHeight(table) + 80)),
  };
}

/** Removes tables and every relation that touched them. */
export function removeTables(graph: ErdGraph, ids: string[]): ErdGraph {
  return {
    tables: graph.tables.filter((table) => !ids.includes(table.id)),
    relations: graph.relations.filter(
      (relation) => !ids.includes(relation.fromTable) && !ids.includes(relation.toTable),
    ),
  };
}

/** Removes a column and every relation that referenced it. */
export function removeColumn(graph: ErdGraph, tableId: string, columnId: string): ErdGraph {
  return {
    tables: graph.tables.map((table) =>
      table.id === tableId
        ? { ...table, columns: table.columns.filter((column) => column.id !== columnId) }
        : table,
    ),
    relations: graph.relations.filter(
      (relation) =>
        !(relation.fromTable === tableId && relation.fromColumn === columnId) &&
        !(relation.toTable === tableId && relation.toColumn === columnId),
    ),
  };
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * A CREATE TABLE dump, in the order the tables sit on the canvas.
 *
 * Left to right, then top to bottom — reading order. A dump ordered by
 * insertion is unreadable next to the diagram it came from, and the whole
 * point of generating it here rather than in a migration tool is that the two
 * can be compared side by side.
 *
 * This does NOT topologically sort by dependency: foreign keys are emitted
 * inline, so a forward reference is a real limitation of the output. It is
 * left visible rather than silently reordered, because reordering would make
 * the dump stop matching the drawing.
 */
export function toSql(tables: ErdTable[], relations: ErdRelation[]): string {
  const out: string[] = [];

  const ordered = [...tables].sort((a, b) => a.x - b.x || a.y - b.y);

  for (const table of ordered) {
    if (table.kind === "view") {
      out.push(`-- view: ${table.name}\n-- create view ${quote(table.name)} as select …`);
      continue;
    }

    const lines = table.columns.map((column) => {
      const bits = [`  ${quote(column.name)}`, typeOf(column.type).sql];

      // A primary key is already not-null and unique; saying so again is
      // noise that makes a generated dump look machine-written.
      if (!column.nullable && !column.pk) bits.push("not null");
      if (column.unique && !column.pk) bits.push("unique");
      if (column.default) bits.push(`default ${column.default}`);

      return bits.join(" ");
    });

    const primary = table.columns.filter((column) => column.pk);
    if (primary.length) {
      lines.push(`  primary key (${primary.map((column) => quote(column.name)).join(", ")})`);
    }

    for (const relation of relations.filter((entry) => entry.fromTable === table.id)) {
      const target = tables.find((entry) => entry.id === relation.toTable);
      const fromColumn = table.columns.find((column) => column.id === relation.fromColumn);
      const toColumn = target?.columns.find((column) => column.id === relation.toColumn);

      // A relation whose ends no longer exist emits nothing rather than a
      // constraint naming a column that is gone.
      if (!target || !fromColumn || !toColumn) continue;

      lines.push(
        `  foreign key (${quote(fromColumn.name)}) references ${quote(target.name)} (${quote(toColumn.name)})` +
          (relation.onDelete ? ` on delete ${relation.onDelete}` : ""),
      );
    }

    out.push(`create table ${quote(table.name)} (\n${lines.join(",\n")}\n);`);
  }

  return out.join("\n\n");
}
