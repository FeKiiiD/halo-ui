import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { readFileSync } from "node:fs";

/**
 * Asserts that every custom Tailwind scale registered in theme.css is also
 * known to cn(), so a consumer's className override actually replaces the
 * component's own class instead of merely sitting beside it.
 *
 * The merge config is re-derived from src/lib/cn.ts by evaluating its
 * extendTailwindMerge call, so this test fails if the two drift apart — it
 * cannot pass by testing a stale copy.
 */
const source = readFileSync(new URL("../src/lib/cn.ts", import.meta.url), "utf8");
const match = source.match(/extendTailwindMerge\(([\s\S]*?)\n\}\);/);
if (!match) {
  console.error("could not find the extendTailwindMerge call in src/lib/cn.ts");
  process.exit(1);
}

// The capture stops before the closing brace the regex consumed, so it is put
// back before evaluating.
const config = new Function(`return (${match[1]}\n});`)();
const twMerge = extendTailwindMerge(config);
const cn = (...inputs) => twMerge(clsx(inputs));

const cases = [
  ["px-control-px", "px-0"],
  ["h-12 px-control-px", "px-0 w-12"],
  ["h-control", "h-14"],
  ["h-control-counter", "h-10"],
  ["p-card", "p-4"],
  ["px-page", "px-2"],
  ["gap-gutter", "gap-2"],
  ["max-w-content", "max-w-full"],
  ["ease-standard", "ease-linear"],
  ["text-button", "text-[17px]"],
  ["text-display-xl", "text-body-s"],
  ["rounded-pill", "rounded-none"],
  ["rounded-card", "rounded-chip"],
  ["bg-accent", "bg-error-soft"],
  ["shadow-float", "shadow-none"],
];

let failures = 0;
for (const [earlier, later] of cases) {
  const out = cn(earlier, later);
  const loser = earlier.split(" ").at(-1);
  const ok = !out.split(" ").includes(loser);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${earlier.padEnd(22)} + ${later.padEnd(14)} -> ${out}`);
}

console.log(failures ? `\n${failures} unresolved collision(s)` : "\nall collisions resolved");
process.exit(failures ? 1 : 0);
