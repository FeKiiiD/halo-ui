import { fileURLToPath } from "node:url";

/**
 * Asserts the chart studio's parser and per-family derivations.
 *
 * This layer lies silently. A mis-sniffed separator produces one column of
 * garbage that still renders as a perfectly convincing chart; a derivation
 * that reads the wrong series draws a real picture of the wrong numbers.
 * Nothing looks broken, so nothing gets reported.
 *
 * Three properties carry the weight:
 *
 * SEPARATORS ARE COUNTED OUTSIDE QUOTES. `"Dupont, Marie";42` has more commas
 * than semicolons if you count naively, so a French export sniffs as
 * comma-separated and the whole file parses into the wrong shape.
 *
 * A BLANK CELL IS NOT A ZERO. They are different facts, and a chart that draws
 * them the same way lies about the data it was handed.
 *
 * EXPORTED CSV MUST REIMPORT. The source never quoted, so any label containing
 * the separator produced a file that came back in a different shape than it
 * left.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/chart-data.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const chart = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  cellNumber,
  splitLine,
  sniffSeparator,
  parseChartData,
  deriveFor,
  toCsv,
  toJson,
  familyFits,
  CHART_TYPES,
  CHART_PALETTE,
} = chart;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

/* --- cell parsing -------------------------------------------------------- */

check("a plain number passes", cellNumber(42), 42);
check("a decimal passes", cellNumber("3.5"), 3.5);
check("a comma decimal parses", cellNumber("3,5"), 3.5);
check("a thin space is stripped", cellNumber("1 208,50"), 1208.5);
check("a currency sign is stripped", cellNumber("1208,50 €"), 1208.5);
check("a percent sign is stripped", cellNumber("42%"), 42);
check("a thousands dot is stripped", cellNumber("1.208,50"), 1208.5);
check("a negative parses", cellNumber("-40"), -40);

// A blank cell and a zero are different facts.
check("a blank is null, not zero", cellNumber(""), null);
check("whitespace is null", cellNumber("   "), null);
check("null is null", cellNumber(null), null);
check("text is null", cellNumber("dormant"), null);
check("a lone dash is null", cellNumber("-"), null);
check("NaN is null", cellNumber(NaN), null);
check("Infinity is null", cellNumber(Infinity), null);
check("a real zero is zero", cellNumber("0"), 0);

/* --- line splitting ------------------------------------------------------- */

check("a plain line splits", splitLine("a;b;c", ";").join("|"), "a|b|c");
check("cells are trimmed", splitLine(" a ; b ", ";").join("|"), "a|b");
check("an empty cell survives", splitLine("a;;c", ";").length, 3);

// A quoted separator is data, not a delimiter.
check("a quoted separator is kept", splitLine('"Dupont, Marie";42', ";").join("|"), "Dupont, Marie|42");
check("a doubled quote is one quote", splitLine('"Foo ""Bar"" Ltd";7', ";")[0], 'Foo "Bar" Ltd');
check("a quoted field keeps its count", splitLine('"a;b";c', ";").length, 2);
check("tabs split too", splitLine("a\tb", "\t").join("|"), "a|b");

/* --- separator sniffing --------------------------------------------------- */

check("semicolons win", sniffSeparator("a;b;c\n1;2;3"), ";");
check("commas win", sniffSeparator("a,b,c\n1,2,3"), ",");
check("tabs win", sniffSeparator("a\tb\tc"), "\t");
check("a single column defaults to comma", sniffSeparator("header\n1\n2"), ",");

/**
 * The French-export case: two commas inside quotes against one semicolon
 * outside. Counting naively picks the comma and destroys the file.
 */
check(
  "quoted commas do not beat a real semicolon",
  sniffSeparator('"Dupont, Marie";"Lyon, 2e"\n1;2'),
  ";",
);

/* --- CSV parsing ----------------------------------------------------------- */

const csv = parseChartData("Month;Visits;Spend\nJan;120;1 208,50\nFeb;95;840,00\nMar;140;1 610,20");

check("labels come from the first column", csv.labels.join(), "Jan,Feb,Mar");
check("two series are found", csv.series.length, 2);
check("the first series is named", csv.series[0].name, "Visits");
check("its values parse", csv.series[0].values.join(), "120,95,140");
check("formatted amounts parse", csv.series[1].values[0], 1208.5);
check("the separator is reported", csv.separator, ";");

// A purely numeric first column is data, not labels.
const numericFirst = parseChartData("A;B\n1;10\n2;20");
check("a numeric first column stays a series", numericFirst.series.length, 2);
check("labels fall back to row numbers", numericFirst.labels.join(), "1,2");

/**
 * A text column that is not the first one. The source's filter ended in
 * `|| true`, so it never dropped anything and a notes column arrived as a flat
 * line at zero — a series that looks like real data reading zero everywhere.
 */
const withNotes = parseChartData("Month;Visits;Note\nJan;120;busy\nFeb;95;quiet");
check("a text column is not a series", withNotes.series.length, 1);
check("the numeric column survives", withNotes.series[0].name, "Visits");

// Duplicate column names must not collapse into one series.
const duplicated = parseChartData("Month;Visits;Visits\nJan;1;2\nFeb;3;4");
check("duplicate names stay separate", duplicated.series.length, 2);
check("each keeps its own column", duplicated.series[1].values.join(), "2,4");

check("an empty input errors", parseChartData("").error != null, true);
check("a header alone errors", parseChartData("A;B").error != null, true);
check("a text-only table errors", parseChartData("A;B\nx;y").error != null, true);

/* --- JSON parsing ---------------------------------------------------------- */

const fromRows = parseChartData('[{"month":"Jan","visits":120},{"month":"Feb","visits":95}]');
check("an array of objects parses", fromRows.series.length, 1);
check("the text key becomes labels", fromRows.labels.join(), "Jan,Feb");
check("the numeric key becomes a series", fromRows.series[0].name, "visits");

// A sparse first record must not decide the column set.
const sparse = parseChartData('[{"a":"x"},{"a":"y","b":5}]');
check("keys are unioned across rows", sparse.series.length, 1);
check("the later key is found", sparse.series[0].name, "b");

const shaped = parseChartData('{"labels":["A"],"series":[{"name":"S","values":[1]}]}');
check("the studio's own shape passes through", shaped.series[0].name, "S");

check("a rows wrapper is unwrapped", parseChartData('{"rows":[{"a":"x","b":1}]}').series.length, 1);
check("invalid JSON errors", parseChartData("{oops").error.startsWith("Invalid JSON"), true);
check("an empty array errors", parseChartData("[]").error != null, true);

/* --- derivations ------------------------------------------------------------ */

const labels = ["Jan", "Feb", "Mar"];
const series = [
  { name: "lat", values: [45.75, 45.76, 0] },
  { name: "lng", values: [4.83, 4.84, 0] },
  { name: "visits", values: [10, 20, 30] },
];

const line = deriveFor("line", labels, [series[2]]);
check("a line keeps its series", line.series.length, 1);
check("a line keeps its labels", line.labels.join(), "Jan,Feb,Mar");

const donut = deriveFor("donut", labels, [series[2]]);
check("a donut makes one slice per label", donut.data.length, 3);
check("slices carry their value", donut.data[1].value, 20);
check("slices carry a colour", donut.data[0].color, CHART_PALETTE[0]);

const gauge = deriveFor("gauge", labels, [series[2]]);
// The last value against the series' own maximum: a gauge needs a ceiling and
// that is the only one the data supplies.
check("a gauge reads the last value", gauge.value, 30);
check("its maximum covers the series", gauge.max, 30);
check("an empty series gauges to zero", deriveFor("gauge", [], [{ name: "x", values: [] }]).value, 0);
check("its maximum is never zero", deriveFor("gauge", [], [{ name: "x", values: [] }]).max, 1);

const scatter = deriveFor("scatter", labels, [series[0], series[2]]);
check("a scatter pairs two series", scatter.points.length, 3);
check("x comes from the first", scatter.points[0].x, 45.75);
check("y comes from the second", scatter.points[0].y, 10);
check("axes are named", `${scatter.xLabel},${scatter.yLabel}`, "lat,visits");
// One series cannot make a scatter, and saying so beats drawing a line of dots.
check("one series cannot scatter", deriveFor("scatter", labels, [series[0]]).missing, true);

const bubble = deriveFor("bubble", labels, series);
check("a bubble reads a third series", bubble.points[0].rValue, 10);
check("the radius series is named", bubble.points[0].rLabel, "visits");

const heat = deriveFor("heatmap", labels, [series[2]]);
check("a heatmap rows by series", heat.rows.join(), "visits");
check("it columns by label", heat.cols.join(), "Jan,Feb,Mar");
check("a missing cell stays null", deriveFor("heatmap", ["a", "b"], [{ name: "s", values: [1] }]).values[0][1], null);

const zones = deriveFor("zones", labels, [series[2]]);
check("zones key by label", Object.keys(zones.values).join(), "Jan,Feb,Mar");
check("zones carry the value", zones.values.Feb, 20);
check("no series means nothing to paint", deriveFor("zones", labels, []).missing, true);

/**
 * The catchment case. 0,0 is in the Atlantic — a row of zeroes is a missing
 * coordinate, not a customer, and plotting it drags the map off the venue and
 * the computed centre with it.
 */
const catchment = deriveFor("catchment", labels, series);
check("lat and lng are matched by name", catchment.points.length, 2);
check("a null island row is dropped", catchment.points.every((p) => p.lat !== 0), true);
check("the weight column is matched", catchment.points[0].weight, 10);
check("the centre averages the real points", Math.abs(catchment.center.lat - 45.755) < 0.001, true);
check("no coordinates means missing", deriveFor("catchment", labels, [series[2]]).missing, true);

// A hidden series is excluded everywhere.
const hidden = deriveFor("line", labels, [{ ...series[2], hidden: true }, series[0]]);
check("a hidden series is excluded", hidden.series.length, 1);
check("the visible one remains", hidden.series[0].name, "lat");

/* --- export ------------------------------------------------------------------ */

const exported = toCsv(["Jan", "Feb"], [{ name: "Visits", values: [1, 2] }]);
check("the header names the category column", exported.split("\n")[0], "Category;Visits");
check("a row carries its label", exported.split("\n")[1], "Jan;1");

/**
 * The round trip. A label containing the separator must survive export and
 * reimport — the source never quoted, so it did not.
 */
const risky = toCsv(["Lyon; 2e", 'Say "hi"'], [{ name: "Visits", values: [1, 2] }]);
check("a separator in a label is quoted", risky.includes('"Lyon; 2e"'), true);
check("a quote in a label is doubled", risky.includes('"Say ""hi"""'), true);

const round = parseChartData(risky);
check("the round trip keeps the row count", round.labels.length, 2);
check("the round trip keeps the label", round.labels[0], "Lyon; 2e");
check("the round trip keeps the quote", round.labels[1], 'Say "hi"');
check("the round trip keeps the values", round.series[0].values.join(), "1,2");

const json = JSON.parse(toJson(["A"], [{ name: "S", values: [1], color: "red", hidden: true }]));
check("JSON keeps the labels", json.labels.join(), "A");
check("JSON keeps the colour", json.series[0].color, "red");
// hidden is view state, not data: it must not travel with an export.
check("JSON drops the hidden flag", "hidden" in json.series[0], false);

/* --- fitness ------------------------------------------------------------------ */

check("a line fits one series", familyFits("line", [series[2]]), true);
check("a scatter needs two", familyFits("scatter", [series[2]]), false);
check("a scatter fits two", familyFits("scatter", [series[0], series[2]]), true);
check("a bubble needs three", familyFits("bubble", [series[0], series[2]]), false);
check("a bubble fits three", familyFits("bubble", series), true);
check("stacked needs two", familyFits("stacked", [series[2]]), false);
check("catchment needs coordinates", familyFits("catchment", [series[2]]), false);
check("catchment fits with them", familyFits("catchment", series), true);
// Hidden series do not count towards fitness.
check("a hidden series does not count", familyFits("scatter", [series[0], { ...series[2], hidden: true }]), false);

check("every family has a spec", CHART_TYPES.length, 13);
check("a spec says what it needs", CHART_TYPES[0].needs.length > 0, true);

/* --- report --------------------------------------------------------------------- */

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

console.log(`\n${cases.length - failed}/${cases.length} chart data checks passed`);
if (failed) process.exit(1);
