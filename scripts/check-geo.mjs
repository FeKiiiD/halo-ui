import { fileURLToPath } from "node:url";

/**
 * Asserts the map arithmetic: distance, ring offsets, isochrone shape and
 * choropleth classification.
 *
 * Map maths fails silently. A distance 40% wrong still draws a plausible
 * circle; a break sequence with duplicates still paints every zone some
 * colour. Nothing on screen looks broken, so nothing gets reported.
 *
 * The two that matter:
 *
 * LONGITUDE IS NOT CONSTANT. Meridians converge, so a degree of longitude is
 * 111km at the equator and nothing at the pole. Treating it as constant — the
 * usual shortcut — makes every catchment ring an ellipse too wide by 25% in
 * Paris and 45% in Reykjavík.
 *
 * BREAKS MUST BE STRICTLY INCREASING. The obvious quantile implementation
 * produces duplicates on skewed data, which is most real data. Bucket indices
 * then jump: some colours never appear, others swallow half the map, and the
 * legend shows a range matching nothing on screen.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/geo.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const geo = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  distanceKm,
  kmPerLng,
  offsetKm,
  estimateIsochrones,
  ringToFeature,
  pointsWithin,
  ringCounts,
  classBreaks,
  classOf,
  sampleRamp,
  formatKm,
  boundsOf,
} = geo;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);
const near = (name, actual, expected, tolerance) =>
  cases.push([name, Math.abs(actual - expected) <= tolerance, true, `${actual} vs ${expected}`]);

const lyon = { lat: 45.7578, lng: 4.832 };
const paris = { lat: 48.8566, lng: 2.3522 };

/* --- distance ----------------------------------------------------------- */

check("a point is zero from itself", distanceKm(lyon, lyon), 0);
// Lyon to Paris is about 392km great-circle.
near("Lyon to Paris", distanceKm(lyon, paris), 392, 4);
near("distance is symmetric", distanceKm(paris, lyon), distanceKm(lyon, paris), 0.001);

// One degree of latitude is ~111km everywhere, including at the pole.
near("a degree of latitude at the equator", distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 111.2, 0.5);
near("a degree of latitude at 60N", distanceKm({ lat: 60, lng: 0 }, { lat: 61, lng: 0 }), 111.2, 0.5);

// A degree of LONGITUDE halves by 60° latitude. This is the one the cheap
// approximation gets wrong.
near("a degree of longitude at the equator", distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 111.3, 0.5);
near("a degree of longitude at 60N is half", distanceKm({ lat: 60, lng: 0 }, { lat: 60, lng: 1 }), 55.6, 0.5);

// Across the antimeridian: the short way round, not most of the planet.
near("across the antimeridian", distanceKm({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 }), 111.3, 1);

near("km per longitude at the equator", kmPerLng(0), 111.32, 0.01);
near("km per longitude at 60N", kmPerLng(60), 55.66, 0.01);
check("km per longitude at the pole is ~0", kmPerLng(90) < 0.001, true);

/* --- offsets ------------------------------------------------------------ */

// Bearing 0 is east (cos), PI/2 is north (sin).
const east = offsetKm(lyon, 10, 0);
near("10km east moves longitude", distanceKm(lyon, east), 10, 0.1);
check("10km east does not move latitude", Math.abs(east.lat - lyon.lat) < 1e-9, true);

const north = offsetKm(lyon, 10, Math.PI / 2);
near("10km north moves latitude", distanceKm(lyon, north), 10, 0.1);

// The pole guard: cos(lat) reaches zero and the longitude offset would diverge.
const polar = offsetKm({ lat: 90, lng: 0 }, 10, 0);
check("at the pole the longitude offset is guarded", Number.isFinite(polar.lng), true);
check("the pole does not produce NaN", Number.isFinite(polar.lat), true);

/* --- isochrones --------------------------------------------------------- */

const zones = estimateIsochrones(lyon, [20, 5, 10]);

check("one zone per requested time", zones.length, 3);
check("they come out sorted", zones.map((z) => z.minutes).join(), "5,10,20");
check("every zone is flagged estimated", zones.every((z) => z.estimated), true);
check("a ring is closed", zones[0].ring[0].join() === zones[0].ring[zones[0].ring.length - 1].join(), true);
check("a ring has 73 points", zones[0].ring.length, 73);
check("coordinates are finite", zones.every((z) => z.ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))), true);
check("coordinates are lng,lat order", Math.abs(zones[0].ring[0][0] - lyon.lng) < 5, true);

/**
 * The zones must NEST. Independent random profiles would let the 5-minute zone
 * poke outside the 20-minute one, which is nonsense — you cannot reach
 * somewhere in five minutes that you cannot reach in twenty.
 */
const radiusAt = (zone, index) => {
  const [lng, lat] = zone.ring[index];
  return distanceKm(lyon, { lat, lng });
};
let nested = true;
for (let i = 0; i < 72; i++) {
  if (radiusAt(zones[0], i) > radiusAt(zones[1], i) || radiusAt(zones[1], i) > radiusAt(zones[2], i)) {
    nested = false;
  }
}
check("zones nest at every bearing", nested, true);

// Deterministic: an estimate that reshuffles each render reads as live data.
check(
  "the same centre gives the same shape",
  JSON.stringify(estimateIsochrones(lyon, [10])) === JSON.stringify(estimateIsochrones(lyon, [10])),
  true,
);

const feature = ringToFeature(zones[0]);
check("a feature is a Polygon", feature.geometry.type, "Polygon");
check("it carries its minutes", feature.properties.minutes, 5);
check("it says it is estimated", feature.properties.estimated, true);

check("no minutes gives no zones", estimateIsochrones(lyon, []).length, 0);

/* --- points and rings --------------------------------------------------- */

const points = [
  { id: "a", ...offsetKm(lyon, 0.5, 0) },
  { id: "b", ...offsetKm(lyon, 1.8, 1) },
  { id: "c", ...offsetKm(lyon, 3.5, 2) },
  { id: "d", ...offsetKm(lyon, 12, 3) },
];

check("within 2km takes two", pointsWithin(lyon, points, 2).length, 2);
check("it reports the distance", pointsWithin(lyon, points, 2)[0].km < 0.6, true);
check("it keeps the original fields", pointsWithin(lyon, points, 2)[0].id, "a");
check("a zero radius takes nothing", pointsWithin(lyon, points, 0).length, 0);

// Bands, not cumulative totals: a point counted in every ring it falls inside
// makes the outer rings look busier than they are.
const counts = ringCounts(lyon, points, [1, 2.5, 5]);
check("the inner band", counts[0], 1);
check("the middle band excludes the inner", counts[1], 1);
check("the outer band excludes both", counts[2], 1);
check("a point beyond every ring is uncounted", counts.reduce((a, b) => a + b, 0), 3);

/* --- choropleth breaks --------------------------------------------------- */

const even = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

check("quantile gives steps-1 breaks", classBreaks(even, 4).length, 3);
check("linear gives steps-1 breaks", classBreaks(even, 4, "linear").length, 3);
check("linear breaks are evenly spaced", classBreaks(even, 3, "linear").join(), "4,7");

const increasing = (list) => list.every((value, i) => i === 0 || value > list[i - 1]);
check("quantile breaks increase", increasing(classBreaks(even, 5)), true);
check("linear breaks increase", increasing(classBreaks(even, 5, "linear")), true);

/**
 * The skew case. Sixty per cent of the values are 1, so a naive quantile puts
 * several breaks on 1 — duplicates that make bucket indices jump.
 */
const skewed = [1, 1, 1, 1, 1, 1, 2, 3, 40, 100];
const skewBreaks = classBreaks(skewed, 5);
check("skewed breaks still increase", increasing(skewBreaks), true);
check("skewed breaks have no duplicates", new Set(skewBreaks).size, skewBreaks.length);
check("skewed breaks stay inside the data", skewBreaks.every((b) => b > 1 && b <= 100), true);

// Every value identical: no break can separate anything, so there are none.
check("a flat dataset has no breaks", classBreaks([5, 5, 5, 5], 4).length, 0);
check("one value has no breaks", classBreaks([7], 4).length, 0);
check("no values gives no breaks", classBreaks([], 4).length, 0);
check("fewer than two steps gives no breaks", classBreaks(even, 1).length, 0);
check("non-numeric values are ignored", classBreaks([1, NaN, 5, undefined, 10], 3).every(Number.isFinite), true);

/* --- classification ------------------------------------------------------ */

const breaks = [3, 6, 9];

check("below the first break is class 0", classOf(1, breaks), 0);
check("exactly on a break stays below it", classOf(3, breaks), 0);
check("just past a break moves up", classOf(3.1, breaks), 1);
check("between breaks", classOf(7, breaks), 2);
// The maximum must land in the last class, not one past the end of the ramp.
check("above every break is the last class", classOf(100, breaks), 3);
check("a null value has no class", classOf(null, breaks), null);
check("undefined has no class", classOf(undefined, breaks), null);
check("NaN has no class", classOf(NaN, breaks), null);
check("with no breaks everything is class 0", classOf(50, []), 0);

/* --- ramp sampling ------------------------------------------------------- */

const ramp = ["#111", "#333", "#555", "#777", "#999", "#bbb", "#ddd"];

check("sampling keeps the count", sampleRamp(ramp, 3).length, 3);
// Sampled, not sliced: slicing the first three throws away the dark end and
// leaves a map with no contrast.
check("sampling keeps the first stop", sampleRamp(ramp, 3)[0], "#111");
check("sampling keeps the last stop", sampleRamp(ramp, 3)[2], "#ddd");
check("sampling spans the middle", sampleRamp(ramp, 3)[1], "#777");
check("one class takes the darkest", sampleRamp(ramp, 1)[0], "#ddd");
check("more classes than stops still fills", sampleRamp(ramp, 10).length, 10);
check("an empty ramp gives nothing", sampleRamp([], 3).length, 0);

/* --- formatting ---------------------------------------------------------- */

check("under a km is metres", formatKm(0.4), "400 m");
check("a short distance keeps a decimal", formatKm(2.35), "2.4 km");
check("a long distance rounds", formatKm(42.7), "43 km");
check("exactly one km is km", formatKm(1), "1 km");

/* --- bounds -------------------------------------------------------------- */

const box = boundsOf([lyon, paris]);
check("bounds hold the southern point", box.south < lyon.lat, true);
check("bounds hold the northern point", box.north > paris.lat, true);
check("bounds hold the western point", box.west < paris.lng, true);
check("bounds hold the eastern point", box.east > lyon.lng, true);
check("no points gives no bounds", boundsOf([]), null);

// A single point has no span. Padding by a fraction of zero fits the map to
// nothing and zooms to maximum.
const single = boundsOf([lyon]);
check("a single point still gets a box", single.north > single.south, true);
check("its box is small but real", single.north - single.south < 0.01, true);

/* --- report -------------------------------------------------------------- */

let failed = 0;
for (const [name, actual, expected, detail] of cases) {
  const ok = Object.is(actual, expected);
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(46)} -> ${JSON.stringify(actual)}${
      ok ? "" : `   expected ${JSON.stringify(expected)}${detail ? ` (${detail})` : ""}`
    }`,
  );
}

console.log(`\n${cases.length - failed}/${cases.length} geo checks passed`);
if (failed) process.exit(1);
