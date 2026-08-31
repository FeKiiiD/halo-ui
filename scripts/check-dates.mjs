import { fileURLToPath } from "node:url";

/**
 * Asserts the date helpers against the cases that actually bite: the timezone
 * trap that toISOString() falls into, months of unequal length, and the loose
 * time formats people really type.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/date.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});
const d = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const cases = [
  // The whole reason fromIso builds at noon: a date must survive a round trip
  // regardless of the machine's offset.
  ["round trip", () => d.toIso(d.fromIso("2026-03-05")), "2026-03-05"],
  ["round trip, new year", () => d.toIso(d.fromIso("2026-01-01")), "2026-01-01"],
  ["round trip, leap day", () => d.toIso(d.fromIso("2024-02-29")), "2024-02-29"],

  ["fromIso rejects junk", () => d.fromIso("not a date"), null],
  ["fromIso rejects empty", () => d.fromIso(""), null],

  // Month arithmetic must clamp, not roll over.
  ["31 Jan + 1 month", () => d.addToIso("2026-01-31", 1, "month"), "2026-02-28"],
  ["31 Mar - 1 month", () => d.addToIso("2026-03-31", -1, "month"), "2026-02-28"],
  ["29 Feb + 1 year", () => d.addToIso("2024-02-29", 1, "year"), "2025-02-28"],
  ["day arithmetic crosses month", () => d.addToIso("2026-01-31", 1, "day"), "2026-02-01"],
  ["day arithmetic crosses year", () => d.addToIso("2026-12-31", 1, "day"), "2027-01-01"],

  // Typed input
  ["parses DD/MM/YYYY", () => d.parseTypedDate("05/03/2026"), "2026-03-05"],
  ["parses D/M/YYYY", () => d.parseTypedDate("5/3/2026"), "2026-03-05"],
  ["rejects 31 February", () => d.parseTypedDate("31/02/2026"), null],
  ["rejects 32nd", () => d.parseTypedDate("32/01/2026"), null],
  ["rejects month 13", () => d.parseTypedDate("01/13/2026"), null],
  ["formats for display", () => d.formatIsoDate("2026-03-05"), "05/03/2026"],
  ["formats nothing as empty", () => d.formatIsoDate(undefined), ""],

  // Grid shape: March 2026 starts on a Sunday, so Monday-first needs 6 blanks.
  ["grid offset", () => d.monthGrid({ year: 2026, month: 2 }).slice(0, 6).every((c) => c === null), true],
  ["grid first day", () => d.monthGrid({ year: 2026, month: 2 })[6], "2026-03-01"],
  ["grid length", () => d.monthGrid({ year: 2026, month: 2 }).length, 37],
  ["february 2024 has 29", () => d.monthGrid({ year: 2024, month: 1 }).filter(Boolean).length, 29],

  // Bounds
  ["within, inclusive", () => d.isWithin("2026-03-05", "2026-03-05", "2026-03-10"), true],
  ["outside below", () => d.isWithin("2026-03-01", "2026-03-05", undefined), false],
  ["outside above", () => d.isWithin("2026-03-20", undefined, "2026-03-10"), false],

  // Time
  ["time slots count", () => d.timeSlots("09:00", "10:00", 15).length, 5],
  ["time slots first", () => d.timeSlots("09:00", "10:00", 15)[0], "09:00"],
  ["parses 9", () => d.parseTypedTime("9"), "09:00"],
  ["parses 9h30", () => d.parseTypedTime("9h30"), "09:30"],
  ["parses 9:30", () => d.parseTypedTime("9:30"), "09:30"],
  ["parses 09.05", () => d.parseTypedTime("09.05"), "09:05"],
  ["rejects hour 25", () => d.parseTypedTime("25:00"), null],
  ["rejects minute 61", () => d.parseTypedTime("10:61"), null],
];

let failures = 0;
for (const [name, run, expected] of cases) {
  const actual = run();
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(28)} -> ${JSON.stringify(actual)}` +
      (ok ? "" : `  expected ${JSON.stringify(expected)}`),
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\ndate helpers correct");
process.exit(failures ? 1 : 0);
