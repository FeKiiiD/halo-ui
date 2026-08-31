import { fileURLToPath } from "node:url";

/**
 * Asserts the ERD's SQL generation and relation geometry.
 *
 * The SQL is the point. A dump that quotes wrongly, doubles a constraint, or
 * silently drops a foreign key looks perfectly plausible in a side panel and
 * fails only when somebody runs it against a database — by which time it is
 * nobody's idea of a UI bug.
 *
 * Three properties matter most: a primary key is not also emitted as "not null
 * unique" (that is noise that makes a generated dump look machine-written), a
 * relation whose ends have been deleted emits nothing rather than a constraint
 * naming a column that is gone, and a name containing a quote cannot break out
 * of its own identifier.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/erd.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const erd = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  toSql,
  typeOf,
  columnY,
  relationPath,
  tableHeight,
  erdContentSize,
  removeTables,
  removeColumn,
  erdUid,
  resetErdUid,
  CARDINALITY_MARKS,
  TABLE_W,
  HEAD_H,
  ROW_H,
} = erd;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

const column = (id, name, type, extra = {}) => ({ id, name, type, ...extra });

const cards = {
  id: "t1",
  name: "cards",
  x: 0,
  y: 0,
  columns: [
    column("c1", "id", "uuid", { pk: true }),
    column("c2", "site_id", "uuid", { fk: true }),
    column("c3", "phone", "varchar", { unique: true }),
    column("c4", "note", "text", { nullable: true }),
  ],
};

const sites = {
  id: "t2",
  name: "sites",
  x: 400,
  y: 0,
  columns: [column("s1", "id", "uuid", { pk: true }), column("s2", "name", "varchar")],
};

const relation = {
  id: "r1",
  fromTable: "t1",
  fromColumn: "c2",
  toTable: "t2",
  toColumn: "s1",
  cardinality: "1-n",
};

/* --- types ------------------------------------------------------------- */

check("uuid maps to uuid", typeOf("uuid").sql, "uuid");
check("money maps to a numeric", typeOf("money").sql, "numeric(10,2)");
check("an enum is stored as text", typeOf("enum").sql, "text");
check("an unknown type falls back to text", typeOf("nope").sql, "text");
check("no type at all falls back to text", typeOf(undefined).sql, "text");

/* --- SQL --------------------------------------------------------------- */

const sql = toSql([cards, sites], [relation]);

check("the dump opens with a create", sql.startsWith('create table "cards" ('), true);
check("identifiers are quoted", sql.includes('"phone"'), true);
check("a nullable column has no not-null", sql.includes('"note" text\n') || sql.includes('"note" text,'), true);
check("a plain column is not null", sql.includes('"site_id" uuid not null'), true);
check("a unique column says so", sql.includes('"phone" varchar(120) not null unique'), true);

// A primary key is already not-null and unique. Repeating either is noise.
check("a pk is not also not-null", sql.includes('"id" uuid not null'), false);
check("a pk is not also unique", sql.includes('"id" uuid unique'), false);
check("the pk is a table constraint", sql.includes('primary key ("id")'), true);

check(
  "the foreign key names both ends",
  sql.includes('foreign key ("site_id") references "sites" ("id")'),
  true,
);

// Ordering follows the canvas, left to right: cards at x=0 before sites at 400.
check("tables come out in canvas order", sql.indexOf('"cards"') < sql.indexOf('"sites"'), true);

const rightToLeft = toSql([{ ...cards, x: 900 }, sites], [relation]);
check(
  "moving a table left moves it up the dump",
  rightToLeft.indexOf('"sites"') < rightToLeft.indexOf('"cards"'),
  true,
);

// A composite primary key is one constraint, not two.
const joinTable = {
  id: "t3",
  name: "card_rewards",
  x: 0,
  y: 0,
  columns: [
    column("j1", "card_id", "uuid", { pk: true, fk: true }),
    column("j2", "reward_id", "uuid", { pk: true, fk: true }),
  ],
};
const joined = toSql([joinTable], []);
check("a composite pk is one constraint", (joined.match(/primary key/g) || []).length, 1);
check("both columns are in it", joined.includes('primary key ("card_id", "reward_id")'), true);

// A dangling relation must emit nothing rather than a constraint naming a
// column that no longer exists.
const dangling = toSql([cards], [relation]);
check("a relation to a missing table is dropped", dangling.includes("foreign key"), false);
check(
  "a relation to a missing column is dropped",
  toSql([cards, sites], [{ ...relation, toColumn: "gone" }]).includes("foreign key"),
  false,
);

// on delete is passed through only when set.
check(
  "on delete is emitted when set",
  toSql([cards, sites], [{ ...relation, onDelete: "cascade" }]).includes("on delete cascade"),
  true,
);
check("on delete is absent otherwise", sql.includes("on delete"), false);

// A view is a comment, not a create table — the columns are not known.
const view = toSql([{ ...sites, kind: "view", name: "stats" }], []);
check("a view does not emit a create table", view.includes("create table"), false);
check("a view is commented out", view.includes("-- view: stats"), true);

// An identifier containing a double quote must not break out of its own name.
const nasty = toSql(
  [{ ...sites, name: 'we"ird', columns: [column("s1", 'ba"d', "text")] }],
  [],
);
check("a quote in a table name is doubled", nasty.includes('create table "we""ird"'), true);
check("a quote in a column name is doubled", nasty.includes('"ba""d"'), true);

check("an empty diagram gives an empty dump", toSql([], []), "");

/* --- cardinality ------------------------------------------------------- */

// A relation runs FROM the column holding the foreign key TO the one it
// references, so in a one-to-many the from end is the many. Reading "1-n"
// left to right as [from, to] inverts every relation on the canvas.
check("a one-to-many marks the child end n", CARDINALITY_MARKS["1-n"][0], "n");
check("a one-to-many marks the parent end 1", CARDINALITY_MARKS["1-n"][1], "1");
check("a one-to-one is 1 on both ends", CARDINALITY_MARKS["1-1"].join(), "1,1");
check("a many-to-many is n on both ends", CARDINALITY_MARKS["n-n"].join(), "n,n");

/* --- geometry ---------------------------------------------------------- */

check("a table's height counts its rows", tableHeight(cards), HEAD_H + 4 * ROW_H + 6);
check("the first column sits under the header", columnY(cards, "c1"), HEAD_H + ROW_H / 2 + 3);
check("the third column is two rows down", columnY(cards, "c3"), HEAD_H + 2 * ROW_H + ROW_H / 2 + 3);
check("a missing column anchors to the first row", columnY(cards, "gone"), columnY(cards, "c1"));
check("a table's y offsets its columns", columnY({ ...cards, y: 100 }, "c1"), 100 + HEAD_H + ROW_H / 2 + 3);

const forward = relationPath(cards, sites, "c2", "s1");
check("a rightward relation leaves the right edge", forward.ax, TABLE_W);
check("a rightward relation enters the left edge", forward.bx, 400);
check("it knows it is rightward", forward.rightward, true);
check("it is a single cubic", (forward.d.match(/C/g) || []).length, 1);

const backward = relationPath({ ...cards, x: 900 }, sites, "c2", "s1");
check("a leftward relation leaves the left edge", backward.ax, 900);
check("a leftward relation enters the right edge", backward.bx, 400 + TABLE_W);
check("it knows it is leftward", backward.rightward, false);

// Two adjacent tables: the handle must not collapse, or the curve leaves
// diagonally and appears to point at the row above.
const adjacent = relationPath(cards, { ...sites, x: TABLE_W }, "c2", "s1");
const handles = adjacent.d.match(/C\s(-?\d+(?:\.\d+)?)/);
check("a touching relation keeps a 28px handle", Number(handles[1]) >= TABLE_W + 28 - 0.001, true);

const size = erdContentSize([cards, sites], 800, 400);
// The minimum wins here: 400+232+80 is 712, under the 800 floor.
check("content width respects the floor", size.width, 800);
check(
  "a table past the floor widens the content",
  erdContentSize([{ ...sites, x: 2000 }], 800, 400).width,
  2000 + TABLE_W + 80,
);
check("content height clears the tallest table", size.height, 400);
check("content is at least the minimum", erdContentSize([], 800, 400).width, 800);

/* --- removal ----------------------------------------------------------- */

const graph = { tables: [cards, sites], relations: [relation] };

const withoutTable = removeTables(graph, ["t2"]);
check("the table is gone", withoutTable.tables.length, 1);
check("its relation went with it", withoutTable.relations.length, 0);

const withoutColumn = removeColumn(graph, "t1", "c2");
check("the column is gone", withoutColumn.tables[0].columns.length, 3);
check("the relation through it is gone", withoutColumn.relations.length, 0);
check(
  "an unrelated column leaves the relation alone",
  removeColumn(graph, "t1", "c4").relations.length,
  1,
);

/* --- ids --------------------------------------------------------------- */

resetErdUid();
const a = erdUid("t");
const b = erdUid("t");
check("ids do not collide", a === b, false);
check("ids carry their prefix", a.startsWith("t"), true);

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

console.log(`\n${cases.length - failed}/${cases.length} ERD checks passed`);
if (failed) process.exit(1);
