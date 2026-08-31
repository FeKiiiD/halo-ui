import { fileURLToPath } from "node:url";

/**
 * Asserts the number formatting helpers against the cases that actually occur:
 * typing digit by digit, pasting from a spreadsheet, and round-tripping a
 * formatted value back to a number.
 *
 * The module is TypeScript, so it is transpiled by stripping the type syntax
 * rather than pulling in a build step for one file.
 */
const here = new URL("../src/lib/number-format.ts", import.meta.url);

// esbuild (already present via tsup) does the transpile: stripping TypeScript
// with regexes breaks on the first typed object literal.
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(here)],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});
const module = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);


const cases = [
  // typing an integer, digit by digit
  ["formatTyped", ["1"], "1"],
  ["formatTyped", ["12"], "12"],
  ["formatTyped", ["1208"], "1 208"],
  ["formatTyped", ["1208500"], "1 208 500"],
  // letters are dropped, not rejected
  ["formatTyped", ["12a08"], "1 208"],
  // decimals: the separator survives while the fraction is still empty
  ["formatTyped", ["12,", { decimals: 2 }], "12,"],
  ["formatTyped", ["12,5", { decimals: 2 }], "12,5"],
  ["formatTyped", ["1208,50", { decimals: 2 }], "1 208,50"],
  // extra decimals are truncated, not rounded
  ["formatTyped", ["12,509", { decimals: 2 }], "12,50"],
  // grouping off
  ["formatTyped", ["1208", { grouping: false }], "1208"],

  // parsing back
  ["parseNumber", ["1 208"], 1208],
  ["parseNumber", ["1 208,50"], 1208.5],
  ["parseNumber", ["-42"], -42],
  ["parseNumber", [""], null],
  ["parseNumber", ["-"], null],
  ["parseNumber", ["abc"], null],
  // a non-breaking space, as pasted from a spreadsheet
  ["parseNumber", ["1\u00a0208"], 1208],
  // a narrow no-break space, as produced by Intl
  ["parseNumber", ["1\u202f208"], 1208],

  // JSON from an API carries a full stop, whatever the display locale.
  // Treating it as a thousands separator turned 1208.5 into 12085 in a table
  // of money — a silent factor of ten.
  ["parseNumber", ["1208.5"], 1208.5],
  ["parseNumber", ["2410.9"], 2410.9],
  ["parseNumber", ["0.05"], 0.05],
  ["parseNumber", ["-42.75"], -42.75],
  // Both conventions round-trip to the same number.
  ["parseNumber", ["1208,5"], 1208.5],

  // rendering
  ["formatNumber", [1208], "1 208"],
  ["formatNumber", [1208.5, { decimals: 2 }], "1 208,50"],
  ["formatNumber", [0, { decimals: 2 }], "0,00"],
];

let failures = 0;
for (const [fn, args, expected] of cases) {
  const actual = module[fn](...args);
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${fn}(${args.map((a) => JSON.stringify(a)).join(", ")}) -> ${JSON.stringify(actual)}` +
      (ok ? "" : `  expected ${JSON.stringify(expected)}`),
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\nnumber formatting correct");
process.exit(failures ? 1 : 0);
