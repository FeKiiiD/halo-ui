/**
 * The chart studio's data layer: parsing pasted or imported tables, and
 * deriving each chart family's shape from one table.
 *
 * Pure, and tested, because it is the part that silently lies. A parser that
 * mis-sniffs a separator produces one column of garbage that still renders as
 * a chart; a derivation that reads the wrong series draws a real picture of
 * the wrong numbers.
 */

export interface Series {
  name: string;
  values: number[];
  color?: string;
  hidden?: boolean;
}

export interface ChartTable {
  labels: string[];
  series: Series[];
}

export interface ParseResult extends Partial<ChartTable> {
  error?: string;
  /** The separator that was sniffed, for the import preview to report. */
  separator?: string;
}

export type ChartFamily =
  | "line"
  | "area"
  | "bar"
  | "column"
  | "stacked"
  | "scatter"
  | "bubble"
  | "donut"
  | "funnel"
  | "gauge"
  | "heatmap"
  | "zones"
  | "catchment";

export interface ChartTypeSpec {
  type: ChartFamily;
  label: string;
  icon: string;
  /** What the table has to look like for this family to mean anything. */
  needs: string;
}

export const CHART_TYPES: ChartTypeSpec[] = [
  { type: "line", label: "Line", icon: "chart-line", needs: "One row per point" },
  { type: "area", label: "Area", icon: "chart-area", needs: "One row per point" },
  { type: "bar", label: "Bar", icon: "chart-bar", needs: "One row per category" },
  { type: "column", label: "Column", icon: "chart-column", needs: "One row per category" },
  { type: "stacked", label: "Stacked", icon: "chart-column-stacked", needs: "Several series" },
  { type: "scatter", label: "Scatter", icon: "chart-scatter", needs: "Two numeric columns" },
  { type: "bubble", label: "Bubble", icon: "circle", needs: "Three numeric columns" },
  { type: "donut", label: "Donut", icon: "chart-pie", needs: "One series, parts of a whole" },
  { type: "funnel", label: "Funnel", icon: "filter", needs: "One series, descending" },
  { type: "gauge", label: "Gauge", icon: "gauge", needs: "One value against a maximum" },
  { type: "heatmap", label: "Heatmap", icon: "grid-3x3", needs: "A grid of series by category" },
  { type: "zones", label: "Zones", icon: "map", needs: "Categories named like territories" },
  { type: "catchment", label: "Catchment", icon: "map-pin", needs: "lat and lng columns" },
];

/**
 * Series colours — the same six the chart components already use.
 *
 * `--chart-N`, not `--color-chart-N`: the latter does not exist, and a colour
 * that resolves to nothing renders a chart with axes, gridlines and no data,
 * which reads as an empty dataset rather than as a missing token.
 */
export const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/**
 * A number from a cell.
 *
 * Returns null rather than 0 for anything unparseable, because a blank cell
 * and a zero are different facts and a chart that draws them the same way is
 * lying about the data it was given.
 */
export function cellNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const text = String(value ?? "").trim();
  if (!text) return null;

  const cleaned = text
    // Spaces, narrow no-break spaces, currency and percent signs are
    // formatting, not value.
    .replace(/[\s  €$£%]/g, "")
    // A comma decimal mark implies dots are thousands separators.
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  if (!cleaned || cleaned === "-") return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Splits one delimited line, honouring quotes.
 *
 * A doubled quote inside a quoted field is an escaped quote — the CSV
 * convention. Without this, a company name like `Foo "Bar" Ltd` silently
 * splits into extra columns and every row after it is misaligned.
 */
export function splitLine(line: string, separator: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  out.push(current);
  return out.map((cell) => cell.trim());
}

/**
 * Guesses the separator from the first non-empty line.
 *
 * Counted OUTSIDE quotes. A row like `"Dupont, Marie";42` has more commas than
 * semicolons if you count naively, so the sniffer picks the comma, and the
 * whole file parses into the wrong shape — the classic way a French CSV breaks
 * in an English-defaulting tool.
 */
export function sniffSeparator(text: string): string {
  const line = text.split(/\r?\n/).find((entry) => entry.trim()) ?? "";

  const countOutsideQuotes = (separator: string) => {
    let count = 0;
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        // A doubled quote is data, not a delimiter change.
        if (quoted && line[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && char === separator) count++;
    }
    return count;
  };

  const candidates: [string, number][] = [
    [";", countOutsideQuotes(";")],
    ["\t", countOutsideQuotes("\t")],
    [",", countOutsideQuotes(",")],
  ];

  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0]![1] ? candidates[0]![0] : ",";
}

/**
 * Reads CSV, TSV, a pasted spreadsheet range, or JSON into one table.
 *
 * The first column becomes the category axis when it is not numeric — which
 * is what a spreadsheet paste almost always looks like, and guessing it saves
 * a mapping step nobody wants to do.
 */
export function parseChartData(raw: string): ParseResult {
  const text = String(raw ?? "").trim();
  if (!text) return { error: "Nothing to import." };

  if (text[0] === "[" || text[0] === "{") return parseJsonTable(text);

  const separator = sniffSeparator(text);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    return { error: "A header row and at least one data row are needed." };
  }

  const head = splitLine(lines[0]!, separator);
  const rows = lines.slice(1).map((line) => splitLine(line, separator));

  // If any first cell is non-numeric, the column is labels rather than data.
  const firstIsLabel = rows.some((row) => cellNumber(row[0]) == null);

  const labels = rows.map((row, index) => (firstIsLabel ? (row[0] ?? "") : String(index + 1)));

  const series = head
    .map((name, column) => ({ name: name || `Series ${column + 1}`, column }))
    .filter((entry) => (firstIsLabel ? entry.column > 0 : true))
    // A column with no number in it anywhere is a second text column, not a
    // series. The source's filter ended in `|| true` and so never removed
    // anything: a notes column arrived as a flat line at zero. Tested by
    // column index rather than by name, because two columns may share one.
    .filter((entry) => rows.some((row) => cellNumber(row[entry.column]) != null))
    .map((entry) => ({
      name: entry.name,
      values: rows.map((row) => cellNumber(row[entry.column]) ?? 0),
    }));

  if (!series.length) return { error: "No numeric column found." };

  return { labels, series, separator };
}

function parseJsonTable(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    return { error: `Invalid JSON: ${(cause as Error).message}` };
  }

  // Already in the studio's own shape.
  const shaped = data as Partial<ChartTable>;
  if (Array.isArray(shaped?.series) && Array.isArray(shaped?.labels)) {
    return { labels: shaped.labels, series: shaped.series };
  }

  const list = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : Array.isArray((data as { rows?: unknown }).rows)
      ? ((data as { rows: Record<string, unknown>[] }).rows)
      : null;

  if (!list?.length) return { error: "The JSON needs an array of objects." };

  // Union of keys across every row: a sparse first record must not decide the
  // column set for the whole file.
  const keys: string[] = [];
  for (const row of list) {
    for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key);
  }

  const numeric = keys.filter((key) => list.some((row) => cellNumber(row[key]) != null));
  const labelKey = keys.find((key) => !numeric.includes(key)) ?? keys[0]!;

  return {
    labels: list.map((row, index) => String(row[labelKey] ?? index + 1)),
    series: numeric
      .filter((key) => key !== labelKey)
      .map((key) => ({ name: key, values: list.map((row) => cellNumber(row[key]) ?? 0) })),
  };
}

/**
 * The same table, read the way each family needs it.
 *
 * ONE TABLE, TWELVE READINGS. Switching chart type must never ask anyone to
 * re-enter their figures — that is the entire reason a studio exists rather
 * than twelve separate chart editors.
 */
export function deriveFor(family: ChartFamily, labels: string[], series: Series[]) {
  const visible = series.filter((entry) => !entry.hidden);
  const first = visible[0] ?? { name: "", values: [] };

  if (family === "scatter" || family === "bubble") {
    const [x, y, radius] = visible;
    if (!x || !y) return { points: [], missing: true };

    return {
      points: labels.map((label, index) => ({
        x: x.values[index] ?? 0,
        y: y.values[index] ?? 0,
        label,
        rValue: family === "bubble" && radius ? (radius.values[index] ?? 0) : undefined,
        rLabel: family === "bubble" && radius ? radius.name : undefined,
        group: index % 6,
      })),
      xLabel: x.name,
      yLabel: y.name,
    };
  }

  if (family === "donut") {
    return {
      data: labels.map((label, index) => ({
        label,
        value: first.values[index] ?? 0,
        color: CHART_PALETTE[index % CHART_PALETTE.length],
      })),
    };
  }

  if (family === "funnel") {
    return { steps: labels.map((label, index) => ({ label, value: first.values[index] ?? 0 })) };
  }

  if (family === "gauge") {
    // The last value, against the largest ever seen — a gauge needs a ceiling,
    // and the series' own maximum is the only one the data supplies.
    const value = first.values.length ? first.values[first.values.length - 1]! : 0;
    return { value, max: Math.max(value, ...first.values, 1), label: first.name };
  }

  if (family === "zones") {
    const source = visible[0];
    if (!source) return { values: {}, missing: true };

    const values: Record<string, number> = {};
    labels.forEach((label, index) => {
      const value = source.values[index];
      if (value != null) values[label] = value;
    });
    return { values, label: source.name };
  }

  if (family === "catchment") {
    // Columns matched by name, so an imported file works with no mapping step.
    const pick = (pattern: RegExp) =>
      visible.find((entry) => pattern.test(entry.name.toLowerCase()));

    const lat = pick(/^lat/);
    const lng = pick(/^(lng|lon|long)/);
    const weight = pick(/poids|weight|visits|visites|passages|amount|montant/);

    if (!lat || !lng) return { points: [], missing: true };

    const points = labels
      .map((label, index) => ({
        lat: lat.values[index]!,
        lng: lng.values[index]!,
        label,
        weight: weight ? weight.values[index] : 1,
      }))
      // 0,0 is in the Atlantic: a row of zeroes is a missing coordinate, not a
      // customer, and plotting it drags the whole map off the venue.
      .filter(
        (point) =>
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lng) &&
          (point.lat !== 0 || point.lng !== 0),
      );

    const center = points.length
      ? {
          lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
          lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
        }
      : undefined;

    return { points, center };
  }

  if (family === "heatmap") {
    return {
      rows: visible.map((entry) => entry.name),
      cols: labels,
      values: visible.map((entry) => labels.map((_, index) => entry.values[index] ?? null)),
    };
  }

  return { series: visible, labels };
}

/**
 * Quotes a CSV cell when it needs it.
 *
 * The source did not, so a label containing the separator — a company name
 * with a comma, any French decimal under a semicolon export — produced a file
 * that reimported into a different shape than it left.
 */
function csvCell(value: unknown, separator: string): string {
  const text = value == null ? "" : String(value);
  if (text.includes(separator) || text.includes('"') || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(labels: string[], series: Series[], separator = ";"): string {
  const head = ["Category", ...series.map((entry) => entry.name)]
    .map((cell) => csvCell(cell, separator))
    .join(separator);

  const rows = labels.map((label, index) =>
    [label, ...series.map((entry) => entry.values[index] ?? "")]
      .map((cell) => csvCell(cell, separator))
      .join(separator),
  );

  return [head, ...rows].join("\n");
}

export const toJson = (labels: string[], series: Series[]): string =>
  JSON.stringify(
    {
      labels,
      series: series.map(({ name, values, color }) => ({ name, values, color })),
    },
    null,
    2,
  );

/** Whether a family can say anything at all about this table. */
export function familyFits(family: ChartFamily, series: Series[]): boolean {
  const visible = series.filter((entry) => !entry.hidden);

  if (family === "scatter") return visible.length >= 2;
  if (family === "bubble") return visible.length >= 3;
  if (family === "stacked") return visible.length >= 2;
  if (family === "catchment") {
    return (
      visible.some((entry) => /^lat/.test(entry.name.toLowerCase())) &&
      visible.some((entry) => /^(lng|lon|long)/.test(entry.name.toLowerCase()))
    );
  }
  return visible.length >= 1;
}
