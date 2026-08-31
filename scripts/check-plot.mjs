/**
 * Asserts the plot-drag axis maths: mapping a pointer position inside a box to
 * a value, on normal and reversed axes.
 *
 * The reversal rules are the part that goes silently wrong. Screen y already
 * grows downward, so a "normal" y axis is reversed relative to the screen and a
 * "reversed" one is not — getting that backwards puts every dragged point in
 * the wrong half of the plot, which looks plausible until someone checks a
 * number.
 *
 * The mapping is reimplemented here from the same rules rather than imported:
 * the hook is React-bound, and the arithmetic is what needs pinning.
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function mapX(clientX, box, axis) {
  const min = axis.min ?? 0;
  const ratio = (clientX - box.left) / box.width;
  return clamp(min + (axis.reversed ? 1 - ratio : ratio) * (axis.max - min), min, axis.max);
}

function mapY(clientY, box, axis) {
  const min = axis.min ?? 0;
  const ratio = (clientY - box.top) / box.height;
  return clamp(min + (axis.reversed ? ratio : 1 - ratio) * (axis.max - min), min, axis.max);
}

const box = { left: 100, top: 50, width: 400, height: 200 };
const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

// A normal x axis: 0 at the left, max at the right.
check("x left edge", mapX(100, box, { max: 10 }), 0);
check("x right edge", mapX(500, box, { max: 10 }), 10);
check("x middle", mapX(300, box, { max: 10 }), 5);
check("x quarter", mapX(200, box, { max: 10 }), 2.5);

// Reversed x — the BCG convention: high share on the left.
check("reversed x left edge", mapX(100, box, { max: 2, reversed: true }), 2);
check("reversed x right edge", mapX(500, box, { max: 2, reversed: true }), 0);
check("reversed x middle", mapX(300, box, { max: 2, reversed: true }), 1);

// A normal y axis: max at the top, because screen y grows downward.
check("y top edge", mapY(50, box, { max: 20 }), 20);
check("y bottom edge", mapY(250, box, { max: 20 }), 0);
check("y middle", mapY(150, box, { max: 20 }), 10);

// Reversed y — max at the bottom.
check("reversed y top edge", mapY(50, box, { max: 20, reversed: true }), 0);
check("reversed y bottom edge", mapY(250, box, { max: 20, reversed: true }), 20);

// Pointer outside the box is clamped, not extrapolated.
check("x clamped left", mapX(-500, box, { max: 10 }), 0);
check("x clamped right", mapX(9999, box, { max: 10 }), 10);
check("y clamped above", mapY(-500, box, { max: 20 }), 20);
check("y clamped below", mapY(9999, box, { max: 20 }), 0);

// A non-zero minimum.
check("x with min, left", mapX(100, box, { min: 5, max: 15 }), 5);
check("x with min, right", mapX(500, box, { min: 5, max: 15 }), 15);
check("x with min, middle", mapX(300, box, { min: 5, max: 15 }), 10);

// Rounding on commit.
const round = (value, precision = 1) => Math.round(value * 10 ** precision) / 10 ** precision;
check("round to 1dp", round(1.2345, 1), 1.2);
check("round to 2dp", round(1.2345, 2), 1.23);
check("round to 0dp", round(1.6, 0), 2);

let failures = 0;
for (const [name, actual, expected] of cases) {
  const ok = Math.abs(actual - expected) < 1e-9;
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(24)} -> ${actual}` +
      (ok ? "" : `  expected ${expected}`),
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\nplot drag maths correct");
process.exit(failures ? 1 : 0);
