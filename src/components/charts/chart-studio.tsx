import * as React from "react";
import { cn } from "../../lib/cn";
import {
  CHART_PALETTE,
  CHART_TYPES,
  cellNumber,
  deriveFor,
  familyFits,
  parseChartData,
  toCsv,
  toJson,
  type ChartFamily,
  type Series,
} from "../../lib/chart-data";
import { CopyButton } from "../core/copy-button";
import { Icon, type IconName } from "../core/icon";
import { BarChart } from "./bar-chart";
import { ChartFrame } from "./chart-frame";
import { DonutChart } from "./donut-chart";
import { FunnelChart } from "./funnel-chart";
import { GaugeChart } from "./gauge-chart";
import { HeatmapChart } from "./heatmap-chart";
import { LineChart } from "./line-chart";
import { ScatterChart } from "./scatter-chart";

export interface ChartStudioProps {
  labels?: string[];
  series?: Series[];
  type?: ChartFamily;

  title?: string;
  eyebrow?: React.ReactNode;

  height?: number;
  editable?: boolean;

  onChange?: (next: { type: ChartFamily; title: string; labels: string[]; series: Series[] }) => void;
  onExport?: (kind: "csv" | "json", text: string) => void;

  labels_?: Partial<Record<string, string>>;
  className?: string;
}

/** Families the studio can actually render. Maps and zones need Leaflet, so
 *  they are left to the map components rather than embedded here. */
const RENDERABLE: ChartFamily[] = [
  "line",
  "area",
  "bar",
  "column",
  "stacked",
  "scatter",
  "bubble",
  "donut",
  "funnel",
  "gauge",
  "heatmap",
];

/**
 * One table, eleven readings of it.
 *
 * SWITCHING FAMILY NEVER ASKS FOR THE FIGURES AGAIN. That is the entire reason
 * a studio exists rather than eleven separate chart editors: the data is
 * entered or imported once, and each family reads the same table its own way.
 *
 * A family that cannot say anything about the current table is disabled rather
 * than hidden — knowing that a scatter needs a second numeric column is more
 * useful than the option quietly not being there.
 */
export function ChartStudio({
  labels: labelsProp,
  series: seriesProp,
  type: typeProp = "line",
  title: titleProp = "Chart",
  eyebrow,
  height = 320,
  editable = true,
  onChange,
  onExport,
  className,
}: ChartStudioProps) {
  const [labels, setLabels] = React.useState<string[]>(labelsProp ?? []);
  const [series, setSeries] = React.useState<Series[]>(() =>
    (seriesProp ?? []).map((entry, index) => ({
      color: CHART_PALETTE[index % CHART_PALETTE.length],
      ...entry,
    })),
  );

  const [family, setFamily] = React.useState<ChartFamily>(typeProp);
  const [title, setTitle] = React.useState(titleProp);
  const [tab, setTab] = React.useState<"data" | "type" | "options">("data");
  const [importing, setImporting] = React.useState(false);
  const [options, setOptions] = React.useState({
    smooth: true,
    area: false,
    legend: true,
    trend: false,
    yTicks: 4,
    radius: 8,
  });

  const notify = React.useRef(onChange);
  notify.current = onChange;
  React.useEffect(() => {
    notify.current?.({ type: family, title, labels, series });
  }, [family, title, labels, series]);

  const derived = deriveFor(family, labels, series);
  const visible = series.filter((entry) => !entry.hidden);

  /* --- editing ------------------------------------------------------------ */

  const setCell = (seriesIndex: number, rowIndex: number, value: string) =>
    setSeries((current) =>
      current.map((entry, index) =>
        index === seriesIndex
          ? {
              ...entry,
              values: entry.values.map((existing, row) =>
                row === rowIndex ? (cellNumber(value) ?? 0) : existing,
              ),
            }
          : entry,
      ),
    );

  const addRow = () => {
    setLabels((current) => [...current, `Row ${current.length + 1}`]);
    setSeries((current) => current.map((entry) => ({ ...entry, values: [...entry.values, 0] })));
  };

  const removeRow = (rowIndex: number) => {
    setLabels((current) => current.filter((_, index) => index !== rowIndex));
    setSeries((current) =>
      current.map((entry) => ({
        ...entry,
        values: entry.values.filter((_, index) => index !== rowIndex),
      })),
    );
  };

  const addSeries = () =>
    setSeries((current) => [
      ...current,
      {
        name: `Series ${current.length + 1}`,
        values: labels.map(() => 0),
        color: CHART_PALETTE[current.length % CHART_PALETTE.length],
      },
    ]);

  const patchSeries = (index: number, change: Partial<Series>) =>
    setSeries((current) => current.map((entry, at) => (at === index ? { ...entry, ...change } : entry)));

  const moveSeries = (index: number, delta: number) =>
    setSeries((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      next.splice(target, 0, next.splice(index, 1)[0]!);
      return next;
    });

  const applyImport = (next: { labels: string[]; series: Series[] }) => {
    setLabels(next.labels);
    setSeries(
      next.series.map((entry, index) => ({
        color: CHART_PALETTE[index % CHART_PALETTE.length],
        ...entry,
      })),
    );
    setImporting(false);
  };

  /* --- the chart ---------------------------------------------------------- */

  const chart = () => {
    if (!visible.length) {
      return (
        <div className="flex items-center justify-center text-body-s text-text-secondary" style={{ height }}>
          Add a series to see the chart.
        </div>
      );
    }

    switch (family) {
      case "line":
      case "area":
        return (
          <LineChart
            series={visible}
            labels={labels}
            height={height}
            area={family === "area" || options.area}
            smooth={options.smooth}
            yTicks={options.yTicks}
          />
        );

      case "bar":
      case "column":
      case "stacked":
        return (
          <BarChart
            series={visible}
            labels={labels}
            height={height}
            layout={family === "bar" ? "horizontal" : "vertical"}
            stacked={family === "stacked"}
            yTicks={options.yTicks}
          />
        );

      case "scatter":
      case "bubble": {
        const data = derived as { points: unknown[]; missing?: boolean; xLabel?: string; yLabel?: string };
        if (data.missing) return <Unfit family={family} height={height} />;
        return (
          <ScatterChart
            points={data.points as never}
            height={height}
            xLabel={data.xLabel}
            yLabel={data.yLabel}
            radius={options.radius}
            trend={options.trend}
          />
        );
      }

      case "donut":
        return (
          <DonutChart
            data={(derived as { data: never[] }).data}
            legend={options.legend ? "right" : "none"}
          />
        );

      case "funnel":
        return <FunnelChart steps={(derived as { steps: never[] }).steps} height={height} />;

      case "gauge": {
        const data = derived as { value: number; max: number; label: string };
        return <GaugeChart value={data.value} max={data.max} label={data.label} />;
      }

      case "heatmap": {
        const data = derived as { rows: string[]; cols: string[]; values: (number | null)[][] };
        return <HeatmapChart rows={data.rows} cols={data.cols} values={data.values} />;
      }

      default:
        return <Unfit family={family} height={height} />;
    }
  };

  /* --- render -------------------------------------------------------------- */

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-3">
        <span className="mr-auto flex min-w-0 flex-col">
          {eyebrow ? (
            <span className="text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
              {eyebrow}
            </span>
          ) : null}
          {editable ? (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="Chart title"
              className="-ml-1 w-full rounded-md border border-transparent bg-transparent px-1 font-sans text-[16px] font-semibold tracking-[-0.01em] text-text-primary outline-none hover:border-border-subtle focus:border-border-strong"
            />
          ) : (
            <span className="text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
              {title}
            </span>
          )}
        </span>

        {editable ? (
          <>
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt halo-focus"
            >
              <Icon name="upload" size={13} />
              Import
            </button>

            <span className="inline-flex gap-1">
              {(["csv", "json"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() =>
                    onExport?.(kind, kind === "csv" ? toCsv(labels, series) : toJson(labels, series))
                  }
                  className="inline-flex h-7.5 items-center rounded-pill border border-border-subtle bg-transparent px-2.75 font-sans text-[12.5px] uppercase text-text-secondary hover:bg-surface-alt hover:text-text-primary halo-focus"
                >
                  {kind}
                </button>
              ))}
            </span>
          </>
        ) : null}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1 p-4">
          <ChartFrame>{chart()}</ChartFrame>
        </div>

        {editable ? (
          <div className="flex w-full shrink-0 flex-col border-t border-hairline lg:w-80 lg:border-l lg:border-t-0">
            <div className="flex gap-1 border-b border-hairline p-2">
              {(["data", "type", "options"] as const).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setTab(entry)}
                  aria-pressed={tab === entry}
                  className={cn(
                    "h-7 flex-1 rounded-pill border-none font-sans text-[12.5px] capitalize halo-focus",
                    tab === entry
                      ? "bg-text-primary text-surface-page"
                      : "bg-transparent text-text-primary hover:bg-surface-alt",
                  )}
                >
                  {entry}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              {tab === "type" ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {CHART_TYPES.filter((spec) => RENDERABLE.includes(spec.type)).map((spec) => {
                    const fits = familyFits(spec.type, series);
                    const on = family === spec.type;

                    return (
                      <button
                        key={spec.type}
                        type="button"
                        // Disabled, not hidden: knowing a scatter wants a
                        // second numeric column beats the option vanishing.
                        disabled={!fits}
                        title={fits ? spec.needs : `Needs: ${spec.needs}`}
                        onClick={() => setFamily(spec.type)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-[10px] border px-1 py-2 font-sans text-[11.5px] halo-focus",
                          "transition-colors duration-[140ms] ease-standard",
                          on
                            ? "border-accent-deep bg-accent text-accent-ink"
                            : "border-border-subtle bg-transparent text-text-primary hover:bg-surface-alt",
                          !fits && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <Icon name={spec.icon as IconName} size={15} />
                        <span className="w-full truncate text-center">{spec.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : tab === "options" ? (
                <div className="flex flex-col gap-3">
                  <Toggle
                    on={options.smooth}
                    onChange={(value) => setOptions((current) => ({ ...current, smooth: value }))}
                    label="Smoothed line"
                  />
                  <Toggle
                    on={options.area}
                    onChange={(value) => setOptions((current) => ({ ...current, area: value }))}
                    label="Filled area"
                  />
                  <Toggle
                    on={options.legend}
                    onChange={(value) => setOptions((current) => ({ ...current, legend: value }))}
                    label="Legend"
                  />
                  <Toggle
                    on={options.trend}
                    onChange={(value) => setOptions((current) => ({ ...current, trend: value }))}
                    label="Trend line"
                  />

                  <label className="flex items-center gap-2">
                    <span className="flex-1 text-[12.5px] text-text-secondary">Y gridlines</span>
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={options.yTicks}
                      onChange={(event) =>
                        setOptions((current) => ({ ...current, yTicks: Number(event.target.value) }))
                      }
                      className="h-7 w-16 rounded-md border border-border-subtle bg-surface-page px-2 text-right font-sans text-[12.5px] tabular-nums text-text-primary outline-none focus:border-border-strong"
                    />
                  </label>
                </div>
              ) : (
                <DataGrid
                  labels={labels}
                  series={series}
                  onLabel={(index, value) =>
                    setLabels((current) => current.map((entry, at) => (at === index ? value : entry)))
                  }
                  onCell={setCell}
                  onAddRow={addRow}
                  onRemoveRow={removeRow}
                  onAddSeries={addSeries}
                  onPatchSeries={patchSeries}
                  onMoveSeries={moveSeries}
                  onRemoveSeries={(index) =>
                    setSeries((current) => current.filter((_, at) => at !== index))
                  }
                />
              )}
            </div>
          </div>
        ) : null}
      </div>

      {importing ? <ImportPanel onClose={() => setImporting(false)} onApply={applyImport} /> : null}
    </div>
  );
}

function Unfit({ family, height }: { family: ChartFamily; height: number }) {
  const spec = CHART_TYPES.find((entry) => entry.type === family);
  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 text-center"
      style={{ height }}
    >
      <Icon name="triangle-alert" size={18} className="text-warning" />
      <span className="text-body-s text-text-secondary">
        This table cannot make a {spec?.label.toLowerCase()}.
      </span>
      <span className="text-[12px] text-text-secondary opacity-75">{spec?.needs}</span>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-text-primary">
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-text-primary"
      />
      {label}
    </label>
  );
}

/** The editable table. */
function DataGrid({
  labels,
  series,
  onLabel,
  onCell,
  onAddRow,
  onRemoveRow,
  onAddSeries,
  onPatchSeries,
  onMoveSeries,
  onRemoveSeries,
}: {
  labels: string[];
  series: Series[];
  onLabel: (index: number, value: string) => void;
  onCell: (seriesIndex: number, rowIndex: number, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onAddSeries: () => void;
  onPatchSeries: (index: number, change: Partial<Series>) => void;
  onMoveSeries: (index: number, delta: number) => void;
  onRemoveSeries: (index: number) => void;
}) {
  const cell =
    "h-7 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 font-sans text-[12.5px] text-text-primary outline-none hover:border-border-subtle focus:border-border-strong";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {series.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: entry.color ?? CHART_PALETTE[index % CHART_PALETTE.length] }}
            />

            <input
              value={entry.name}
              onChange={(event) => onPatchSeries(index, { name: event.target.value })}
              aria-label="Series name"
              className={cn(cell, "flex-1")}
            />

            <button
              type="button"
              aria-label={entry.hidden ? "Show this series" : "Hide this series"}
              title={entry.hidden ? "Show" : "Hide"}
              onClick={() => onPatchSeries(index, { hidden: !entry.hidden })}
              className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-text-secondary hover:bg-surface-alt halo-focus"
            >
              <Icon name={entry.hidden ? "eye-off" : "eye"} size={12} />
            </button>

            <button
              type="button"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => onMoveSeries(index, -1)}
              className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-text-secondary hover:bg-surface-alt disabled:opacity-30 halo-focus"
            >
              <Icon name="chevron-up" size={12} />
            </button>

            <button
              type="button"
              aria-label="Remove this series"
              onClick={() => onRemoveSeries(index)}
              className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-text-secondary hover:bg-surface-alt hover:text-error halo-focus"
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddSeries}
          className="inline-flex h-7.5 items-center gap-1.5 self-start rounded-pill border border-border-subtle bg-transparent px-2.75 font-sans text-[12.5px] text-text-primary hover:bg-surface-alt halo-focus"
        >
          <Icon name="plus" size={12} />
          Series
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-1 pb-1 text-left text-[11px] font-normal text-text-secondary">
                Category
              </th>
              {series.map((entry, index) => (
                <th
                  key={index}
                  className="px-1 pb-1 text-right text-[11px] font-normal text-text-secondary"
                >
                  <span className="block max-w-20 truncate">{entry.name}</span>
                </th>
              ))}
              <th className="w-6" />
            </tr>
          </thead>

          <tbody>
            {labels.map((label, rowIndex) => (
              <tr key={rowIndex}>
                <td className="p-0">
                  <input
                    value={label}
                    onChange={(event) => onLabel(rowIndex, event.target.value)}
                    aria-label="Category"
                    className={cell}
                  />
                </td>

                {series.map((entry, seriesIndex) => (
                  <td key={seriesIndex} className="p-0">
                    <input
                      value={String(entry.values[rowIndex] ?? "")}
                      inputMode="decimal"
                      onChange={(event) => onCell(seriesIndex, rowIndex, event.target.value)}
                      aria-label={`${entry.name} at ${label}`}
                      className={cn(cell, "text-right tabular-nums")}
                    />
                  </td>
                ))}

                <td className="p-0">
                  <button
                    type="button"
                    aria-label="Remove this row"
                    onClick={() => onRemoveRow(rowIndex)}
                    className="inline-flex size-6 items-center justify-center rounded-md border-none bg-transparent text-text-secondary hover:bg-surface-alt hover:text-error halo-focus"
                  >
                    <Icon name="x" size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={onAddRow}
        className="inline-flex h-7.5 items-center gap-1.5 self-start rounded-pill border border-border-subtle bg-transparent px-2.75 font-sans text-[12.5px] text-text-primary hover:bg-surface-alt halo-focus"
      >
        <Icon name="plus" size={12} />
        Row
      </button>
    </div>
  );
}

/**
 * The import panel.
 *
 * IT PREVIEWS BEFORE IT APPLIES. Pasting a range and having the chart change
 * under you, wrongly, with the old data already gone, is the worst outcome —
 * so the parse result is shown first and Apply is disabled until it succeeds.
 */
function ImportPanel({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (next: { labels: string[]; series: Series[] }) => void;
}) {
  const [raw, setRaw] = React.useState("");

  const parsed = React.useMemo(() => (raw.trim() ? parseChartData(raw) : null), [raw]);
  const ok = Boolean(parsed && !parsed.error && parsed.labels && parsed.series);

  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const readFile = (file: File) => {
    // .xlsx is a zip archive: half-parsing it would produce convincing
    // nonsense, so it is refused with the instruction instead.
    if (/\.xlsx?$/i.test(file.name)) {
      setRaw("");
      window.alert("Export the sheet as CSV first — a spreadsheet file cannot be read directly.");
      return;
    }
    void file.text().then(setRaw);
  };

  return (
    <div className="border-t border-hairline bg-surface-alt p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="mr-auto text-[13.5px] font-medium text-text-primary">
            Import a table
          </span>
          <label className="inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-pill border border-border-subtle bg-surface-card px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt">
            <Icon name="file-up" size={13} />
            Choose a file
            <input
              type="file"
              accept=".csv,.tsv,.txt,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
              }}
            />
          </label>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:bg-surface-card halo-focus"
          >
            <Icon name="x" size={13} />
          </button>
        </div>

        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={6}
          placeholder={"Paste a range, CSV, TSV or JSON.\n\nMonth;Visits\nJan;120\nFeb;95"}
          aria-label="Data to import"
          className="w-full resize-y rounded-panel border border-border-subtle bg-surface-card p-3 font-mono text-[12.5px] leading-[1.5] text-text-primary outline-none focus:border-border-strong placeholder:text-text-secondary"
        />

        {parsed?.error ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-error">
            <Icon name="circle-alert" size={12} />
            {parsed.error}
          </span>
        ) : ok ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-success">
            <Icon name="check" size={12} />
            {parsed!.labels!.length} rows, {parsed!.series!.length} series
            {parsed!.separator ? ` · separator "${parsed!.separator === "\t" ? "tab" : parsed!.separator}"` : ""}
          </span>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!ok}
            onClick={() =>
              ok && onApply({ labels: parsed!.labels!, series: parsed!.series! })
            }
            className={cn(
              "inline-flex h-8 items-center rounded-pill border-none px-4 font-sans text-[13px] font-medium halo-focus",
              ok
                ? "bg-accent text-accent-ink"
                : "cursor-not-allowed bg-surface-disabled text-text-secondary",
            )}
          >
            Replace the data
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-pill border border-border-subtle bg-transparent px-3.5 font-sans text-[13px] text-text-primary hover:bg-surface-card halo-focus"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
