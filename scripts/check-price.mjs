import { readFileSync } from "node:fs";

/**
 * Asserts parsePrice against the strings a pricing table actually contains.
 *
 * Two real bugs lived here: "On request" parsed as zero and rendered
 * "On0request", and "1 490 €" lost the space before its currency.
 *
 * The function is extracted from its source rather than imported — the module
 * pulls in React, which will not resolve from a data URL — so this test cannot
 * pass against a stale copy.
 */
const source = readFileSync(
  new URL("../src/components/cards/pricing-card.tsx", import.meta.url),
  "utf8",
);

const found = /export function parsePrice\([\s\S]*?\n\}/.exec(source);
if (!found) {
  console.error("could not find parsePrice in pricing-card.tsx");
  process.exit(1);
}

// Strip the TypeScript signature; the body is already plain JavaScript.
const js = found[0]
  .replace("export function", "function")
  .replace(/\(\s*input: string,?\s*\)/, "(input)")
  .replace(/\):\s*\{[^}]*\}\s*\|\s*null\s*\{/, ") {");

const parsePrice = new Function(`${js}; return parsePrice;`)();

const cases = [
  ["0 €", { pre: "", value: 0, post: " €", decimals: 0 }],
  ["29 €", { pre: "", value: 29, post: " €", decimals: 0 }],
  ["1 490 €", { pre: "", value: 1490, post: " €", decimals: 0 }],
  ["29,50 €", { pre: "", value: 29.5, post: " €", decimals: 2 }],
  ["$29", { pre: "$", value: 29, post: "", decimals: 0 }],
  ["£1 200/yr", { pre: "£", value: 1200, post: "/yr", decimals: 0 }],
  // A non-breaking space, as an editor or a CMS will supply it.
  ["1 490 €", { pre: "", value: 1490, post: " €", decimals: 0 }],
  ["On request", null],
  ["Free", null],
  ["Custom pricing", null],
  ["", null],
];

let failures = 0;
for (const [input, expected] of cases) {
  const actual = parsePrice(input);
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${JSON.stringify(input).padEnd(16)} -> ${JSON.stringify(actual)}` +
      (ok ? "" : `  expected ${JSON.stringify(expected)}`),
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\nprice parsing correct");
process.exit(failures ? 1 : 0);
