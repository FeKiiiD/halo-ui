import { fileURLToPath } from "node:url";

/**
 * Asserts the chart maths: readable axis maxima, correct tick spacing, compact
 * formatting, and path geometry that closes properly.
 *
 * The smoothing check is the one that matters most — a curve that overshoots
 * between two points draws a value that does not exist, which is the one thing
 * a chart must never do.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/chart.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
  external: ["react"],
});

// React is only used by the hooks; stub it so the pure functions can be tested.
const stubbed = bundled.outputFiles[0].text.replace(
  /import\s+.*?\s+from\s+"react";?/g,
  "const React = { useRef: () => ({}), useState: () => [0, () => {}], useEffect: () => {} };",
);

const chart = await import(
  `data:text/javascript;base64,${Buffer.from(stubbed).toString("base64")}`
);

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

// niceMax rounds up to a value that divides cleanly.
check("niceMax(847)", chart.niceMax(847), 1000);
check("niceMax(1208)", chart.niceMax(1208), 2000);
check("niceMax(2100)", chart.niceMax(2100), 2500);
check("niceMax(4200)", chart.niceMax(4200), 5000);
check("niceMax(0)", chart.niceMax(0), 1);
check("niceMax(negative)", chart.niceMax(-5), 1);
check("niceMax(0.42)", chart.niceMax(0.42), 0.5);

// ticks span the range inclusively.
check("ticks count", chart.ticks(1000, 4).length, 5);
check("ticks first", chart.ticks(1000, 4)[0], 0);
check("ticks last", chart.ticks(1000, 4)[4], 1000);
check("ticks middle", chart.ticks(1000, 4)[2], 500);
check("ticks with min", chart.ticks(100, 2, 50)[0], 50);

// Compact formatting.
check("compact 842", chart.formatCompact(842), "842");
check("compact 1200", chart.formatCompact(1200), "1,2 k");
check("compact 12000", chart.formatCompact(12000), "12 k");
check("compact 1400000", chart.formatCompact(1400000), "1,4 M");
check("compact 0", chart.formatCompact(0), "0");

// Paths.
check("empty line", chart.linePath([]), "");
check("straight line", chart.linePath([[0, 0], [10, 10]]), "M0 0 L10 10");
check(
  "two points never smooth",
  chart.linePath([[0, 0], [10, 10]], true),
  "M0 0 L10 10",
);
check("smoothed uses curves", chart.linePath([[0, 0], [10, 5], [20, 0]], true).includes("C"), true);
check("area closes", chart.areaPath([[0, 0], [10, 10]], 20).endsWith("Z"), true);
check("area returns to base", chart.areaPath([[0, 0], [10, 10]], 20).includes("L10 20 L0 20"), true);

/**
 * THE OVERSHOOT CHECK — the one that matters most.
 *
 * The rendered curve is sampled, not just its control points: a control point
 * outside the data range does not by itself put the CURVE outside it. Each
 * cubic segment is walked at 80 steps and compared against the series' own
 * minimum and maximum.
 *
 * Plain Catmull-Rom fails this by 3.2px on a 40px range.
 */
const sampleCubic = (p0, c1, c2, p1, steps = 80) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p1;
  });

function curveRange(points) {
  const numbers = chart.linePath(points, true).match(/-?\d+(\.\d+)?/g).map(Number);
  let index = 1;
  let y = numbers[index++];
  const ys = [y];

  while (index < numbers.length) {
    index++;
    const c1y = numbers[index++];
    index++;
    const c2y = numbers[index++];
    index++;
    const endY = numbers[index++];
    ys.push(...sampleCubic(y, c1y, c2y, endY));
    y = endY;
  }

  return { min: Math.min(...ys), max: Math.max(...ys) };
}

for (const [name, points] of [
  ["flat then drop", [[0, 50], [10, 50], [20, 50], [30, 10]]],
  ["spike", [[0, 40], [10, 10], [20, 40], [30, 40]]],
  ["monotonic", [[0, 50], [10, 40], [20, 20], [30, 0]]],
  ["zigzag", [[0, 30], [10, 10], [20, 30], [30, 10]]],
]) {
  const values = points.map((point) => point[1]);
  const { min, max } = curveRange(points);
  check(`no overshoot: ${name}`, max <= Math.max(...values) + 0.01 && min >= Math.min(...values) - 0.01, true);
}

// Donut geometry.
const slice = chart.donutSlice(50, 50, 40, 24, 0, Math.PI / 2);
check("donut slice closes", slice.endsWith("Z"), true);
check("donut has two arcs", (slice.match(/A/g) ?? []).length, 2);
check("full-circle flag", chart.arc(0, 0, 10, 0, Math.PI * 1.5).large, 1);
check("small-arc flag", chart.arc(0, 0, 10, 0, Math.PI / 2).large, 0);

let failures = 0;
for (const [name, actual, expected] of cases) {
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(32)} -> ${JSON.stringify(actual)}` +
      (ok ? "" : `  expected ${JSON.stringify(expected)}`),
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\nchart maths correct");
process.exit(failures ? 1 : 0);
