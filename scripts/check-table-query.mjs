import { fileURLToPath } from "node:url";

/**
 * Asserts the table's filtering, sorting and saved-view logic.
 *
 * This is the code that decides what a person actually sees, and it fails
 * invisibly: a filter that drops the wrong rows looks exactly like a filter
 * that works, because the table is shorter either way.
 *
 * Three properties carry most of the weight.
 *
 * DATES PARSE IN BOTH FORMS. The source matched only DD/MM/YYYY, so an ISO
 * date — what every API returns and what a date input produces — fell through
 * to a raw string comparison. "2026-08-31" against "31/08/2026" compares
 * character by character, and every date filter on real data quietly returned
 * the wrong rows.
 *
 * INCOMPLETE RULES ARE IGNORED. A half-typed rule is the normal state of a
 * filter panel in use; a table that empties itself when a field is focused is
 * unusable.
 *
 * EMPTIES SORT LAST IN BOTH DIRECTIONS. Sending them to the top on a
 * descending sort is consistent and useless — the point of sorting descending
 * is to see the largest values, not the missing ones.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/table-query.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const q = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  dateKey,
  numberValue,
  isRuleLive,
  describeRule,
  applyFilterRules,
  applySortRules,
  normaliseView,
  isViewDirty,
  describeView,
  groupRows,
  opsFor,
  opLabel,
  VALUELESS_OPS,
} = q;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

const columns = [
  { key: "name", label: "Name", type: "text" },
  { key: "spend", label: "Spend", type: "number" },
  { key: "joined", label: "Joined", type: "date" },
  { key: "status", label: "Status", type: "enum", options: ["active", "dormant", "loyal"] },
  { key: "optin", label: "Opted in", type: "boolean" },
];

const rows = [
  { name: "Marie Dupont", spend: "1 208,50 €", joined: "2026-01-15", status: "loyal", optin: true },
  { name: "Jean Bernard", spend: "84,00 €", joined: "2026-06-02", status: "active", optin: false },
  { name: "Alice Moreau", spend: "512,30 €", joined: "2025-11-20", status: "dormant", optin: true },
  { name: "Paul Girard", spend: "", joined: "", status: "active", optin: false },
];

/* --- date parsing ------------------------------------------------------- */

check("ISO parses", dateKey("2026-08-31"), "20260831");
check("ISO with a time parses", dateKey("2026-08-31T14:30:00Z"), "20260831");
check("slashed parses", dateKey("31/08/2026"), "20260831");

// The two forms must produce the same key, or a mixed dataset sorts wrongly.
check("both forms agree", dateKey("2026-08-31") === dateKey("31/08/2026"), true);

check("keys order correctly", dateKey("2026-01-15") < dateKey("2026-06-02"), true);
check("a year boundary orders", dateKey("2025-11-20") < dateKey("2026-01-15"), true);
check("an empty date is empty", dateKey(""), "");
check("null is empty", dateKey(null), "");
check("a parseable date falls back to Date", dateKey("March 5, 2026"), "20260305");

/* --- number parsing ----------------------------------------------------- */

check("a plain number passes", numberValue(42), 42);
// The table shows "1 208,50 €" — the filter has to see 1208.5, not 0.
check("a formatted amount parses", numberValue("1 208,50 €"), 1208.5);
check("a comma decimal parses", numberValue("84,00 €"), 84);
check("a dot decimal parses", numberValue("512.30"), 512.3);
check("a thousands dot is stripped", numberValue("1.208,50"), 1208.5);
check("a negative parses", numberValue("-40"), -40);
check("an empty string is zero", numberValue(""), 0);
check("nonsense is zero", numberValue("abc"), 0);
check("NaN is zero", numberValue(NaN), 0);

/* --- live rules --------------------------------------------------------- */

check("a complete rule is live", isRuleLive({ key: "name", op: "contains", value: "x" }), true);
// The half-typed state: still live once there is a value.
check("no value is not live", isRuleLive({ key: "name", op: "contains", value: "" }), false);
check("no key is not live", isRuleLive({ key: "", op: "contains", value: "x" }), false);
check("a valueless op is live", isRuleLive({ key: "name", op: "empty" }), true);
check("an empty pair is not live", isRuleLive({ key: "spend", op: "between", value: ["", ""] }), false);
check("a half pair is live", isRuleLive({ key: "spend", op: "between", value: ["10", ""] }), true);

/* --- filtering ---------------------------------------------------------- */

const filter = (rules, match) => applyFilterRules(rows, rules, columns, match).map((r) => r.name);

check("no rules returns everything", applyFilterRules(rows, [], columns).length, 4);
// An incomplete rule must not empty the table.
check("an incomplete rule is ignored", applyFilterRules(rows, [{ key: "name", op: "contains", value: "" }], columns).length, 4);

check("contains", filter([{ key: "name", op: "contains", value: "mar" }]).join(), "Marie Dupont");
check("contains is case-insensitive", filter([{ key: "name", op: "contains", value: "MARIE" }]).join(), "Marie Dupont");
check("does not contain", filter([{ key: "name", op: "not_contains", value: "a" }]).length, 0);
check("is exactly", filter([{ key: "status", op: "is", value: "active" }]).length, 2);
check("starts with", filter([{ key: "name", op: "starts", value: "Paul" }]).join(), "Paul Girard");

check("is empty", filter([{ key: "spend", op: "empty" }]).join(), "Paul Girard");
check("is set", filter([{ key: "spend", op: "filled" }]).length, 3);
check("is true", filter([{ key: "optin", op: "true" }]).length, 2);
check("is false", filter([{ key: "optin", op: "false" }]).length, 2);

// Numbers come from formatted cells.
check("greater than reads a formatted amount", filter([{ key: "spend", op: "gt", value: "500" }]).sort().join(), "Alice Moreau,Marie Dupont");
check("less than", filter([{ key: "spend", op: "lt", value: "100" }]).join(), "Jean Bernard");
check("equals", filter([{ key: "spend", op: "eq", value: "84" }]).join(), "Jean Bernard");
check("between", filter([{ key: "spend", op: "between", value: ["100", "600"] }]).join(), "Alice Moreau");
// Bounds the wrong way round should still mean the same range.
check("between tolerates reversed bounds", filter([{ key: "spend", op: "between", value: ["600", "100"] }]).join(), "Alice Moreau");

check("one of", filter([{ key: "status", op: "in", value: ["loyal", "dormant"] }]).sort().join(), "Alice Moreau,Marie Dupont");
check("not one of", filter([{ key: "status", op: "not_in", value: ["active"] }]).sort().join(), "Alice Moreau,Marie Dupont");

/**
 * The date cases. These are the ones the source got wrong: the rows carry ISO
 * dates, which never matched the slashed pattern.
 */
check("after an ISO date", filter([{ key: "joined", op: "after", value: "2026-01-01" }]).sort().join(), "Jean Bernard,Marie Dupont");
check("before an ISO date", filter([{ key: "joined", op: "before", value: "2026-01-01" }]).join(), "Alice Moreau");
check("between two dates", filter([{ key: "joined", op: "between", value: ["2026-01-01", "2026-03-01"] }]).join(), "Marie Dupont");
// A slashed bound against ISO data must work too — the panel produces one form
// and the API the other.
check("a slashed bound matches ISO rows", filter([{ key: "joined", op: "after", value: "01/01/2026" }]).sort().join(), "Jean Bernard,Marie Dupont");

check("match all is AND", filter([
  { key: "status", op: "is", value: "active" },
  { key: "optin", op: "true" },
], "all").length, 0);

check("match any is OR", filter([
  { key: "name", op: "starts", value: "Marie" },
  { key: "name", op: "starts", value: "Paul" },
], "any").sort().join(), "Marie Dupont,Paul Girard");

/* --- sorting ------------------------------------------------------------- */

const sorted = (rules, nullsLast) => applySortRules(rows, rules, columns, nullsLast).map((r) => r.name);

check("no rules leaves the order", applySortRules(rows, [], columns).map((r) => r.name).join(), rows.map((r) => r.name).join());
// The caller's array must not be reordered under them.
check("sorting does not mutate", (() => { const before = rows.map((r) => r.name).join(); applySortRules(rows, [{ key: "name", dir: "asc" }], columns); return rows.map((r) => r.name).join() === before; })(), true);

check("text ascending", sorted([{ key: "name", dir: "asc" }])[0], "Alice Moreau");
check("text descending", sorted([{ key: "name", dir: "desc" }])[0], "Paul Girard");

// A formatted amount must sort by its value, not its string.
check("numbers sort by value", sorted([{ key: "spend", dir: "desc" }])[0], "Marie Dupont");
check("numbers ascending", sorted([{ key: "spend", dir: "asc" }])[0], "Jean Bernard");

check("dates ascending", sorted([{ key: "joined", dir: "asc" }])[0], "Alice Moreau");
check("dates descending", sorted([{ key: "joined", dir: "desc" }])[0], "Jean Bernard");

// Empties last in BOTH directions: descending is for seeing the largest
// values, not the missing ones.
check("empties sort last ascending", sorted([{ key: "spend", dir: "asc" }])[3], "Paul Girard");
check("empties sort last descending", sorted([{ key: "spend", dir: "desc" }])[3], "Paul Girard");
check("nullsLast off puts them first", sorted([{ key: "spend", dir: "asc" }], false)[0], "Paul Girard");

// Natural ordering: "item 2" before "item 10".
const numbered = [{ label: "item 10" }, { label: "item 2" }, { label: "item 1" }];
check(
  "text sorts naturally",
  applySortRules(numbered, [{ key: "label", dir: "asc" }], [{ key: "label", label: "L", type: "text" }])
    .map((r) => r.label)
    .join(),
  "item 1,item 2,item 10",
);

// A second rule breaks ties from the first.
const tied = [
  { group: "a", name: "z" },
  { group: "a", name: "b" },
  { group: "b", name: "a" },
];
check(
  "a second rule breaks the tie",
  applySortRules(tied, [{ key: "group", dir: "asc" }, { key: "name", dir: "asc" }], [])
    .map((r) => r.name)
    .join(),
  "b,z,a",
);

/* --- views ---------------------------------------------------------------- */

const viewA = { hidden: ["spend"], filters: [{ key: "status", op: "is", value: "active" }], sort: { key: "name", dir: "asc" } };

check("a config equals itself", normaliseView(viewA) === normaliseView({ ...viewA }), true);
// Key order and rule ids vary without meaning anything: a naive JSON compare
// marks the view dirty every time a rule is rebuilt.
check(
  "rule ids are ignored",
  normaliseView(viewA) ===
    normaliseView({ ...viewA, filters: [{ id: "xyz", key: "status", op: "is", value: "active" }] }),
  true,
);
check(
  "hidden column order is ignored",
  normaliseView({ hidden: ["a", "b"] }) === normaliseView({ hidden: ["b", "a"] }),
  true,
);
check(
  "an incomplete filter does not count as a change",
  normaliseView(viewA) ===
    normaliseView({ ...viewA, filters: [...viewA.filters, { key: "name", op: "contains", value: "" }] }),
  true,
);
// Filter order is kept: "any of A then B" reads differently from B then A.
check(
  "filter order is significant",
  normaliseView({ filters: [{ key: "a", op: "is", value: "1" }, { key: "b", op: "is", value: "2" }] }) ===
    normaliseView({ filters: [{ key: "b", op: "is", value: "2" }, { key: "a", op: "is", value: "1" }] }),
  false,
);

const saved = { id: "v1", name: "Active", config: viewA };
check("an unchanged view is clean", isViewDirty(saved, viewA), false);
check("a changed view is dirty", isViewDirty(saved, { ...viewA, hidden: [] }), true);
check("no view is never dirty", isViewDirty(null, viewA), false);

check("a description lists what is set", describeView(viewA, columns), "1 column hidden · 1 filter · sorted by Name ↑");
check("an empty config says so", describeView({}, columns), "All columns, no filter");
check("plural columns", describeView({ hidden: ["a", "b"] }, columns).startsWith("2 columns hidden"), true);

/* --- descriptions ---------------------------------------------------------- */

check("a rule reads as a sentence", describeRule({ key: "status", op: "in", value: ["active", "loyal"] }, columns), "Status is one of active, loyal");
check("a between rule uses an arrow", describeRule({ key: "spend", op: "between", value: ["10", "20"] }, columns), "Spend between 10 → 20");
check("a valueless rule has no tail", describeRule({ key: "spend", op: "empty" }, columns), "Spend is empty");
check("a missing value shows an ellipsis", describeRule({ key: "name", op: "contains", value: "" }, columns), "Name contains …");
check("last_days names its unit", describeRule({ key: "joined", op: "last_days", value: "30" }, columns), "Joined in the last 30 days");
check("an unknown column falls back to its key", describeRule({ key: "ghost", op: "is", value: "x" }, columns), "ghost is exactly x");

/* --- operators -------------------------------------------------------------- */

check("text ops are the default", opsFor(undefined)[0][0], "contains");
check("number ops start at equals", opsFor("number")[0][0], "eq");
check("boolean has two ops", opsFor("boolean").length, 2);
check("an op has a label", opLabel("date", "after"), "after");
check("empty is valueless", VALUELESS_OPS.includes("empty"), true);
check("contains is not valueless", VALUELESS_OPS.includes("contains"), false);

/* --- grouping ---------------------------------------------------------------- */

const board = groupRows(rows, "status", [
  { id: "active", label: "Active" },
  { id: "loyal", label: "Loyal" },
  { id: "gone", label: "Gone" },
]);
check("rows land in their column", board[0].rows.length, 2);
check("a single match", board[1].rows.length, 1);
check("an empty column stays", board[2].rows.length, 0);
check("every column is kept", board.length, 3);

/* --- report -------------------------------------------------------------------- */

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

console.log(`\n${cases.length - failed}/${cases.length} table query checks passed`);
if (failed) process.exit(1);
