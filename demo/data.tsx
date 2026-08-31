import * as React from "react";
import {
  BarChart,
  Button,
  ChartFrame,
  ChartStudio,
  DataTable,
  DetailPanel,
  FilterPanel,
  KanbanBoard,
  PanelField,
  PanelSection,
  SavedViews,
  SortPanel,
  applyFilterRules,
  applySortRules,
  type FilterRule,
  type SortRule,
  type SavedView,
  DonutChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  Icon,
  KpiTile,
  LineChart,
  ScatterChart,
  Sparkline,
  StatCard,
  SubTable,
  TablePagination,
  TableToolbar,
  type Column,
  type SortState,
} from "../src";
import { Section } from "./forms";

function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={
        cols === 4
          ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          : cols === 3
            ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            : "grid gap-6 lg:grid-cols-2"
      }
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------------- */

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

const covers = [820, 910, 870, 1040, 1120, 1080, 1240, 1190, 1208];
const previous = [760, 800, 830, 890, 940, 980, 1010, 1050, 1090];

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = ["9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"];

/** A plausible service pattern: two peaks a day, quiet Mondays, busy weekends. */
const affluence = weekdays.map((_, day) =>
  hours.map((_, hour) => {
    const lunch = Math.exp(-((hour - 3) ** 2) / 2) * 90;
    const dinner = Math.exp(-((hour - 10) ** 2) / 3) * 120;
    const weekend = day >= 4 ? 1.4 : day === 0 ? 0.5 : 1;
    return Math.round((lunch + dinner) * weekend);
  }),
);

interface CustomerRow extends Record<string, unknown> {
  id: string;
  customer: { label: string; secondary: string; type: "person" };
  visits: number;
  spend: string;
  last: string;
  status: string;
  trend: number;
  history: number[];
}

const customers: CustomerRow[] = [
  {
    id: "1",
    customer: { label: "Marie Dupont", secondary: "marie@example.fr", type: "person" },
    visits: 42,
    spend: "1208.5",
    last: "2026-09-14",
    status: "Regular",
    trend: 12,
    history: [4, 5, 4, 6, 7, 6, 8],
  },
  {
    id: "2",
    customer: { label: "Jean Bernard", secondary: "jean@example.fr", type: "person" },
    visits: 18,
    spend: "412",
    last: "2026-09-02",
    status: "Occasional",
    trend: -4,
    history: [3, 3, 2, 3, 2, 2, 1],
  },
  {
    id: "3",
    customer: { label: "Alice Moreau", secondary: "alice@example.fr", type: "person" },
    visits: 67,
    spend: "2410.9",
    last: "2026-09-15",
    status: "Loyal",
    trend: 21,
    history: [6, 7, 8, 8, 9, 11, 12],
  },
  {
    id: "4",
    customer: { label: "Paul Girard", secondary: "paul@example.fr", type: "person" },
    visits: 5,
    spend: "96",
    last: "2026-07-22",
    status: "Lapsed",
    trend: -38,
    history: [3, 2, 2, 1, 1, 0, 0],
  },
];

const columns: Column[] = [
  { key: "customer", label: "Customer", type: "record", sortable: true, width: 240 },
  { key: "visits", label: "Visits", type: "number", sortable: true, align: "right", width: 90 },
  { key: "spend", label: "Spend", type: "amount", sortable: true, align: "right", width: 130 },
  { key: "last", label: "Last visit", type: "date", sortable: true, width: 120 },
  {
    key: "status",
    label: "Status",
    type: "select",
    width: 130,
    tones: { Loyal: "success", Regular: "accent", Occasional: "neutral", Lapsed: "error" },
  },
  { key: "trend", label: "Trend", type: "trend", align: "right", width: 110 },
  { key: "history", label: "History", type: "sparkline", width: 130 },
];

/* -------------------------------------------------------------------------
 * Sheet
 * ---------------------------------------------------------------------- */

const queryColumns = [
  { key: "customer", label: "Customer", type: "text" as const },
  { key: "visits", label: "Visits", type: "number" as const },
  { key: "spend", label: "Spend", type: "number" as const },
  { key: "last", label: "Last visit", type: "date" as const },
  { key: "status", label: "Status", type: "enum" as const, options: ["Loyal", "Regular", "Occasional", "Lapsed"] },
];

// The rows flattened for querying: the table renders a record object in the
// customer column, and a filter cannot compare against an object.
const queryRows = customers.map((row) => ({
  ...row,
  customer: row.customer.label,
}));

const builtinViews: SavedView[] = [
  { id: "all", name: "Everyone", builtin: true, config: {} },
  {
    id: "lapsed",
    name: "Lapsed",
    config: { filters: [{ id: "f1", key: "status", op: "is" as const, value: "Lapsed" }] },
  },
];

function TableQuerySheet() {
  const [rules, setRules] = React.useState<FilterRule[]>([
    { id: "f1", key: "visits", op: "gt", value: "10" },
  ]);
  const [match, setMatch] = React.useState<"all" | "any">("all");
  const [sort, setSort] = React.useState<SortRule[]>([{ key: "spend", dir: "desc" }]);
  const [views, setViews] = React.useState(builtinViews);
  const [activeView, setActiveView] = React.useState("all");
  const [detail, setDetail] = React.useState<(typeof queryRows)[number] | null>(null);
  const [moved, setMoved] = React.useState<Record<string, string>>({});

  const config = { filters: rules, match, sort };

  // Card moves are an edit to the row, so they apply before filtering — the
  // board and the table are two views of one list, not two lists.
  const live = queryRows.map((row) =>
    moved[row.id] ? { ...row, status: moved[row.id]! } : row,
  );
  const filtered = applyFilterRules(live, rules, queryColumns, match);
  const shown = applySortRules(filtered, sort, queryColumns);

  return (
    <div className="flex flex-col gap-6">
      <SavedViews
        views={views}
        activeId={activeView}
        config={config}
        columns={queryColumns}
        onSelect={(view) => {
          setActiveView(view.id);
          setRules((view.config.filters as FilterRule[]) ?? []);
          setSort((view.config.sort as SortRule[]) ?? []);
        }}
        onSave={(view) =>
          setViews((current) => current.map((entry) => (entry.id === view.id ? view : entry)))
        }
        onCreate={(name, next) =>
          setViews((current) => [...current, { id: name, name, config: next }])
        }
        onDelete={(view) =>
          setViews((current) => current.filter((entry) => entry.id !== view.id))
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <FilterPanel
          inline
          columns={queryColumns}
          rules={rules}
          onChange={setRules}
          match={match}
          onMatchChange={setMatch}
          resultCount={shown.length}
          totalCount={queryRows.length}
        />

        <SortPanel
          inline
          columns={queryColumns}
          rules={sort}
          onChange={setSort}
          presets={[
            { label: "Biggest spenders", rules: [{ key: "spend", dir: "desc" }] },
            { label: "Most recent", rules: [{ key: "last", dir: "desc" }] },
          ]}
        />
      </div>

      <div className="flex items-stretch overflow-hidden rounded-card border border-border-subtle">
        <div className="min-w-0 flex-1">
          <DataTable
            columns={columns.slice(0, 5)}
            rows={shown.map((row) => ({
              ...row,
              customer: customers.find((entry) => entry.id === row.id)!.customer,
            }))}
            onRowClick={(row) => setDetail(shown.find((entry) => entry.id === row.id) ?? null)}
          />
        </div>

        <DetailPanel
          open={Boolean(detail)}
          onClose={() => setDetail(null)}
          eyebrow="Customer"
          title={detail?.customer}
          subtitle={detail?.status}
          width={300}
          footer={
            <Button size="sm" variant="outlined" fullWidth>
              Open the card
            </Button>
          }
        >
          <PanelSection title="Activity">
            <PanelField label="Visits">{detail?.visits}</PanelField>
            <PanelField label="Spend">{detail?.spend}</PanelField>
            <PanelField label="Last visit">{detail?.last}</PanelField>
          </PanelSection>
        </DetailPanel>
      </div>

      <KanbanBoard
        rows={shown}
        groupBy="status"
        columns={[
          { value: "Loyal", label: "Loyal", tone: "success" },
          { value: "Regular", label: "Regular", tone: "accent", limit: 3 },
          { value: "Occasional", label: "Occasional" },
          { value: "Lapsed", label: "Lapsed", tone: "error" },
        ]}
        card={{ title: "customer", subtitle: "last", fields: [{ key: "visits", label: "visits" }, { key: "spend" }] }}
        onCardMove={(row, to) => setMoved((current) => ({ ...current, [row.id]: to }))}
        height={340}
      />
    </div>
  );
}


const studioLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const studioSeries = [
  { name: "Cards added", values: [42, 58, 71, 64, 89, 112] },
  { name: "Rewards claimed", values: [8, 14, 19, 17, 26, 34] },
  { name: "Visits", values: [310, 402, 488, 451, 604, 742] },
];


export function DataSheet() {
  const [sort, setSort] = React.useState<SortState | null>({ key: "visits", dir: "desc" });
  const [selected, setSelected] = React.useState<unknown[]>([]);
  const [search, setSearch] = React.useState("");
  const [density, setDensity] = React.useState<"compact" | "regular" | "comfy" | "counter">("regular");
  const [hiddenColumns, setHiddenColumns] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [hiddenSeries, setHiddenSeries] = React.useState<string[]>([]);

  const toggleSeries = (name: string) =>
    setHiddenSeries((current) =>
      current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name],
    );

  const visibleColumns = columns.filter((column) => !hiddenColumns.includes(column.key));

  return (
    <div className="flex flex-col gap-16">
      <Section
        title="Tiles"
        note="The dashboard's smallest unit: one figure, its movement, its shape over the period. Four across is the constraint that shapes it."
      >
        <Grid cols={4}>
          <KpiTile
            label="Covers won back"
            value="1 208"
            delta={18}
            series={covers}
            accent
          />
          <KpiTile label="Active cards" value="842" delta={4} series={[700, 720, 760, 790, 810, 842]} />
          <KpiTile
            label="Rewards credited"
            value="96"
            delta={-3}
            series={[110, 104, 99, 101, 97, 96]}
            spark="bars"
          />
          <KpiTile
            label="Monthly target"
            value="1 208"
            spark="gauge"
            target={1500}
            footer="Nine days left"
          />
        </Grid>

        <Grid cols={4}>
          <StatCard
            label="This week"
            value="284"
            delta={7}
            chart={<Sparkline values={[32, 41, 38, 45, 42, 48, 38]} height={44} />}
          />
          <KpiTile label="Loading" value="—" loading />
          <KpiTile label="No trend" value="12" footer="Since launch" spark="none" />
          <KpiTile label="Dots" value="7,4" unit="/10" series={[6, 7, 7, 8, 7, 7.4]} spark="dots" />
        </Grid>
      </Section>

      <Section
        title="Charts"
        note="No chart library: every mark is SVG the system computes, which is why they weigh nothing and match the tokens exactly. Hover a plot — one crosshair, one tooltip, every series at once."
      >
        <Grid>
          <ChartFrame
            eyebrow="Last nine months"
            title="Covers won back"
            value="1 208"
            delta={18}
            marker
            legend={[
              { name: "This year", shape: "line" },
              { name: "Last year", shape: "line", color: "var(--chart-5)" },
            ]}
            onToggleSeries={toggleSeries}
            hiddenSeries={hiddenSeries}
            note="A dashed series never draws itself in — the two dash arrays would fight."
          >
            <LineChart
              labels={months}
              hidden={hiddenSeries}
              area
              target={1400}
              series={[
                { name: "This year", values: covers },
                { name: "Last year", values: previous, color: "var(--chart-5)", dashed: true, emphasis: false },
              ]}
            />
          </ChartFrame>

          <ChartFrame title="By service" eyebrow="This month">
            <BarChart
              labels={["Lunch", "Dinner", "Weekend"]}
              highlight="Weekend"
              series={[{ name: "Covers", values: [420, 610, 178] }]}
            />
          </ChartFrame>
        </Grid>

        <Grid>
          <ChartFrame title="Where they come from">
            <DonutChart
              centerLabel="Total"
              data={[
                { label: "Walk-in", value: 540 },
                { label: "Regulars", value: 380 },
                { label: "Reservations", value: 210 },
                { label: "Delivery", value: 78 },
              ]}
            />
          </ChartFrame>

          <ChartFrame title="Card lifecycle" note="Bands, not a tapered funnel — widths on one baseline are comparable.">
            <FunnelChart
              steps={[
                { label: "Cards created", value: 1840 },
                { label: "First visit", value: 1420 },
                { label: "Third visit", value: 860 },
                { label: "Reward claimed", value: 412 },
              ]}
            />
          </ChartFrame>
        </Grid>

        <Grid>
          <ChartFrame title="Monthly target" tone="sunken">
            <div className="flex justify-center">
              <GaugeChart value={1208} max={1500} unit="covers" label="of 1 500" caption="Nine days left" />
            </div>
          </ChartFrame>

          <ChartFrame title="Visits against spend">
            <ScatterChart
              trend
              xLabel="Visits"
              yLabel="Spend"
              points={customers.map((row) => ({
                x: row.visits,
                y: Number(row.spend),
                label: row.customer.label,
              }))}
            />
          </ChartFrame>
        </Grid>

        <ChartFrame
          title="Affluence"
          eyebrow="Average covers per hour"
          note="Five steps of one hue, never a rainbow — a hue scale makes the eye read differences that are not there."
        >
          <HeatmapChart rows={weekdays} cols={hours} values={affluence} unit="covers" />
        </ChartFrame>

        <Grid>
          <ChartFrame title="Loading" loading height={180} />
          <ChartFrame title="Empty" empty height={180} />
        </Grid>
      </Section>

      <Section
        title="Table"
        note="Hairline row separators only — no zebra, no vertical rules. Select rows to see the toolbar become a different bar. Double-click a Status or Visits cell to edit it in place."
      >
        <div className="flex flex-col gap-3">
          <TableToolbar
            title="Customers"
            count={customers.length}
            search={search}
            onSearchChange={setSearch}
            density={density}
            onDensityChange={setDensity}
            columns={columns.map((column) => ({ key: column.key, label: column.label ?? column.key }))}
            hiddenColumns={hiddenColumns}
            onColumnsChange={setHiddenColumns}
            filters={[{ key: "active", label: "Active this month" }]}
            onFilterRemove={() => undefined}
            selectedCount={selected.length}
            onSelectionClear={() => setSelected([])}
            bulkActions={
              <>
                <Button size="sm" variant="outlined">
                  Export
                </Button>
                <Button size="sm" variant="secondary">
                  Send a reminder
                </Button>
              </>
            }
            actions={
              <Button size="sm" iconLeft={<Icon name="plus" size={16} />}>
                Add
              </Button>
            }
          />

          <DataTable
            columns={visibleColumns.map((column) =>
              column.key === "status" || column.key === "visits"
                ? { ...column, editable: true }
                : column,
            )}
            rows={customers}
            density={density}
            sort={sort}
            onSortChange={setSort}
            selectable
            selected={selected}
            onSelectedChange={setSelected}
            onColumnHide={(key) => setHiddenColumns((current) => [...current, key])}
            onCellEdit={() => undefined}
            rowActions={[
              { label: "Open", icon: "external-link" },
              { label: "Credit a reward", icon: "gift" },
              { label: "Delete", icon: "trash-2", tone: "error" },
            ]}
            footer={
              <TablePagination
                page={page}
                pageSize={25}
                total={1208}
                onPageChange={setPage}
                onPageSizeChange={() => undefined}
                className="px-0 py-0"
              />
            }
          />
        </div>

        <div className="rounded-panel border border-border-subtle bg-surface-card">
          <SubTable title="Recent visits" count={3} icon="history">
            <DataTable
              density="compact"
              columns={[
                { key: "date", label: "Date", type: "date", width: 120 },
                { key: "service", label: "Service", width: 120 },
                { key: "amount", label: "Amount", type: "amount", align: "right" },
              ]}
              rows={[
                { id: "a", date: "2026-09-14", service: "Dinner", amount: "42.5" },
                { id: "b", date: "2026-09-08", service: "Lunch", amount: "23" },
                { id: "c", date: "2026-09-01", service: "Dinner", amount: "38.9" },
              ]}
            />
          </SubTable>
        </div>

        <Grid>
          <DataTable columns={columns.slice(0, 3)} rows={[]} loading />
          <DataTable
            columns={columns.slice(0, 3)}
            rows={[]}
            emptyTitle="No customers yet"
            emptyHint="They appear here as soon as the first card is added at the counter."
            emptyAction={<Button size="sm">Open counter mode</Button>}
          />
        </Grid>
      </Section>

      <Section
        title="Querying a table"
        note="Filters apply as they are typed and the count says how many rows survive — an Apply button makes people build a rule blind and discover it matched nothing. An incomplete rule is inert rather than matching nothing, so the table never empties itself the moment a field is focused. The sort levels are numbered because their order is the sort. The same rows appear as a board: dragging a card sets the field it is grouped by."
      >
        <TableQuerySheet />
      </Section>

      <Section
        title="Chart studio"
        note="One table, eleven readings of it. Switching family never asks for the figures again — that is the whole reason a studio exists rather than eleven chart editors. A family that cannot say anything about the current table is disabled rather than hidden: knowing a scatter wants a second numeric column beats the option quietly not being there. Import previews the parse before it replaces anything."
      >
        <ChartStudio
          eyebrow="Loyalty"
          title="Six months at the counter"
          labels={studioLabels}
          series={studioSeries}
          height={300}
        />
      </Section>
    </div>
  );
}