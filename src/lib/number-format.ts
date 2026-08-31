/**
 * Number formatting for the fields that accept typed figures.
 *
 * The convention here is French: a narrow space every three digits, a comma
 * for the decimal separator — `1 208,50`. It is a deliberate default rather
 * than a locale lookup, because the separators have to match what the user is
 * typing character by character; switching them from a runtime locale would
 * make the parser and the formatter disagree mid-keystroke.
 *
 * To localise, pass a different `separators` set through — both functions take
 * one and the field components thread it through.
 */

export interface NumberSeparators {
  /** Inserted every three integer digits. */
  group: string;
  /** Typed and displayed between the integer and decimal parts. */
  decimal: string;
}

export const frenchSeparators: NumberSeparators = { group: " ", decimal: "," };
export const englishSeparators: NumberSeparators = { group: ",", decimal: "." };

/** Groups the integer digits: "1208" → "1 208". */
export function groupDigits(digits: string, separator = frenchSeparators.group): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Parses a formatted string back to a number, or null when it is not one.
 *
 * Everything that is not a digit, a leading sign, or a decimal separator is
 * discarded -- grouping spaces of any width, currency symbols, stray letters.
 *
 * BOTH "," AND "." ARE ACCEPTED AS THE DECIMAL POINT by default, because data
 * arrives from two directions: a user typing "1208,5" in a French field, and
 * JSON from an API carrying 1208.5. Treating the API's point as a thousands
 * separator turned 1208.5 into 12085 in a table of money -- a silent factor of
 * ten.
 *
 * Pass `strict` when the input is known to be user-typed and a "." really is a
 * grouping character.
 */
export function parseNumber(
  input: string,
  separators: NumberSeparators = frenchSeparators,
  options: { strict?: boolean } = {},
): number | null {
  const { strict = false } = options;

  // Built by scanning rather than by regex: the decimal separator is a
  // runtime value, and interpolating it into a character class silently
  // mis-escapes for "," and "." -- which turned "1 208,50" into 120850.
  let cleaned = "";
  for (const char of input) {
    if (char >= "0" && char <= "9") {
      cleaned += char;
    } else if (char === "-" && cleaned === "") {
      cleaned += char;
    } else if (!cleaned.includes(".")) {
      const isDecimal = strict
        ? char === separators.decimal
        : char === separators.decimal || char === "." || char === ",";
      if (isDecimal) cleaned += ".";
    }
  }

  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Reformats raw typed input as the user types: keeps only digits and at most
 * one decimal separator, groups the integer part, and truncates the decimals.
 *
 * It never rejects a keystroke outright — a half-typed "1 2" has to survive
 * long enough to become "1 208".
 */
export function formatTyped(
  raw: string,
  options: {
    decimals?: number;
    grouping?: boolean;
    separators?: NumberSeparators;
  } = {},
): string {
  const { decimals = 0, grouping = true, separators = frenchSeparators } = options;

  if (!decimals) {
    const digits = raw.replace(/\D/g, "");
    return grouping ? groupDigits(digits, separators.group) : digits;
  }

  // Keep digits and the first decimal separator only.
  const kept = raw.replace(new RegExp(`[^\\d\\${separators.decimal}]`, "g"), "");
  const [integer = "", ...rest] = kept.split(separators.decimal);
  const fraction = rest.join("");

  const head = grouping ? groupDigits(integer, separators.group) : integer;
  return rest.length > 0 ? head + separators.decimal + fraction.slice(0, decimals) : head;
}

/** Renders a number as a display string in the same convention. */
export function formatNumber(
  value: number,
  options: {
    decimals?: number;
    grouping?: boolean;
    separators?: NumberSeparators;
  } = {},
): string {
  const { decimals = 0, grouping = true, separators = frenchSeparators } = options;

  const fixed = value.toFixed(decimals);
  const [integer = "", fraction] = fixed.split(".");
  const head = grouping ? groupDigits(integer, separators.group) : integer;

  return fraction ? head + separators.decimal + fraction : head;
}
