import * as React from "react";
import { cn } from "../../lib/cn";
import {
  CARDINALITY_MARKS,
  COLUMN_TYPES,
  HEAD_H,
  ROW_H,
  TABLE_W,
  columnY,
  erdContentSize,
  erdUid,
  relationPath,
  removeColumn,
  removeTables,
  tableHeight,
  toSql,
  typeOf,
  type Cardinality,
  type ColumnTypeKey,
  type ErdColumn,
  type ErdGraph,
  type ErdRelation,
  type ErdTable,
} from "../../lib/erd";
import { normalize } from "../../lib/use-dismissable";
import { CopyButton } from "../core/copy-button";
import { Icon, type IconName } from "../core/icon";
import { SaveButton } from "../core/save-button";
import { SearchField } from "../forms/search-field";
import { ERD_CATEGORIES, makeTable, type ErdCatalogGroup, type ErdCatalogItem } from "./erd-catalog";

export interface ErdDiagramProps {
  tables: ErdTable[];
  relations: ErdRelation[];

  onChange?: (next: ErdGraph) => void;
  onSelect?: (selection: { type: "table" | "relation"; id: string } | null) => void;
  onSave?: (next: ErdGraph) => unknown | Promise<unknown>;

  title?: React.ReactNode;
  subtitle?: React.ReactNode;

  editable?: boolean;
  palette?: boolean;
  catalog?: ErdCatalogGroup[];

  width?: number;
  height?: number;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

const MEDIA_TYPE = "text/halo-erd-table";

type Selection = { type: "table" | "relation"; id: string } | null;

/**
 * A database schema you can draw.
 *
 * THE SQL IS THE OUTPUT, NOT THE DIAGRAM. Everything here exists to produce a
 * dump somebody will actually run, so the panel is always one click away and
 * the tables are emitted in the order they sit on the canvas — left to right,
 * reading order — which is the only ordering that lets the dump and the
 * drawing be compared side by side.
 *
 * A relation is drawn from a column, not from a table: which column carries
 * the key is the entire content of a foreign key, and a diagram that joins
 * card-to-card edges hides exactly the thing being designed.
 */
export function ErdDiagram({
  tables,
  relations,
  onChange,
  onSelect,
  onSave,
  title = "Schema",
  subtitle,
  editable = true,
  palette = true,
  catalog = ERD_CATEGORIES,
  width = 1240,
  height = 520,
  labels,
  className,
}: ErdDiagramProps) {
  const text = {
    search: "Search a table…",
    sql: "SQL",
    closeSql: "Close the SQL",
    copySql: "Copy",
    addTable: "Add a table",
    dragHint: "drag onto the canvas",
    nullable: "Nullable",
    unique: "Unique",
    primaryKey: "Primary key",
    foreignKey: "Foreign key",
    addColumn: "Add a column",
    deleteTable: "Delete the table",
    deleteRelation: "Delete the relation",
    empty: "Drop a table from the palette to begin.",
    hint: "Drag a table by its header · drag the dot on a row onto another row to relate them · Del to remove",
    ...labels,
  };

  const box = React.useRef<HTMLDivElement>(null);
  const [selected, setSelected] = React.useState<Selection>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [drag, setDrag] = React.useState<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [linking, setLinking] = React.useState<{ tableId: string; columnId: string; x: number; y: number } | null>(null);
  const [band, setBand] = React.useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [pan, setPan] = React.useState<{ x0: number; y0: number; sl: number; st: number } | null>(null);
  const [mode, setMode] = React.useState<"select" | "pan">("select");
  const [space, setSpace] = React.useState(false);
  const [hover, setHover] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  const [editing, setEditing] = React.useState<{ kind: "table" | "column"; id: string } | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sqlOpen, setSqlOpen] = React.useState(false);
  const [typeMenu, setTypeMenu] = React.useState<{ tableId: string; columnId: string } | null>(null);

  const graph: ErdGraph = { tables, relations };
  const graphJson = JSON.stringify(graph);
  const [saved, setSaved] = React.useState(() => graphJson);
  const dirty = graphJson !== saved;

  const active = space ? "pan" : mode;

  const byId = React.useMemo(
    () => Object.fromEntries(tables.map((table) => [table.id, table])) as Record<string, ErdTable>,
    [tables],
  );

  const emit = (next: Partial<ErdGraph>) => onChange?.({ ...graph, ...next });

  React.useEffect(() => onSelect?.(selected), [selected, onSelect]);

  const { width: contentW, height: contentH } = erdContentSize(tables, width, height);
  const sql = React.useMemo(() => toSql(tables, relations), [tables, relations]);

  /* --- keyboard --------------------------------------------------------- */

  const live = React.useRef({ selected, picked, graph, editable, editing });
  live.current = { selected, picked, graph, editable, editing };

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase() ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || target?.isContentEditable) return;

      if (event.code === "Space") {
        event.preventDefault();
        setSpace(true);
        return;
      }

      const current = live.current;
      const key = event.key.toLowerCase();
      if (key === "v") setMode("select");
      if (key === "h") setMode("pan");

      if (event.key === "Escape") {
        setSelected(null);
        setLinking(null);
        setTypeMenu(null);
        return;
      }

      if (!current.editable || current.editing) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;

      if (current.picked.length) {
        event.preventDefault();
        emit(removeTables(current.graph, current.picked));
        setPicked([]);
        setSelected(null);
        return;
      }

      const target2 = current.selected;
      if (!target2) return;
      event.preventDefault();

      if (target2.type === "table") emit(removeTables(current.graph, [target2.id]));
      else {
        emit({ relations: current.graph.relations.filter((entry) => entry.id !== target2.id) });
      }
      setSelected(null);
    };

    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpace(false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!typeMenu) return;
    const away = () => setTypeMenu(null);
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [typeMenu]);

  /* --- pointer ---------------------------------------------------------- */

  const toLocal = (event: { clientX: number; clientY: number }) => {
    const element = box.current;
    const rect = element?.getBoundingClientRect();
    if (!element || !rect) return { x: 0, y: 0 };
    return {
      x: event.clientX - rect.left + element.scrollLeft,
      y: event.clientY - rect.top + element.scrollTop,
    };
  };

  React.useEffect(() => {
    if (!drag && !linking && !band && !pan) return;

    const move = (event: PointerEvent) => {
      if (pan && box.current) {
        box.current.scrollLeft = pan.sl - (event.clientX - pan.x0);
        box.current.scrollTop = pan.st - (event.clientY - pan.y0);
        return;
      }

      const point = toLocal(event);

      if (drag) {
        const table = byId[drag.id];
        if (!table) return;

        const nextX = Math.max(0, Math.round(point.x - drag.dx));
        const nextY = Math.max(0, Math.round(point.y - drag.dy));
        const dx = nextX - table.x;
        const dy = nextY - table.y;

        // A group drags together only if the dragged table is in it.
        const group = picked.length > 1 && picked.includes(drag.id) ? picked : [drag.id];

        emit({
          tables: tables.map((entry) =>
            group.includes(entry.id)
              ? entry.id === drag.id
                ? { ...entry, x: nextX, y: nextY }
                : { ...entry, x: Math.max(0, entry.x + dx), y: Math.max(0, entry.y + dy) }
              : entry,
          ),
        });

        if (!drag.moved) setDrag((current) => (current ? { ...current, moved: true } : current));
        return;
      }

      if (linking) {
        setLinking((current) => (current ? { ...current, x: point.x, y: point.y } : current));
        return;
      }

      if (band) {
        setBand((current) => (current ? { ...current, x2: point.x, y2: point.y } : current));
      }
    };

    const up = (event: PointerEvent) => {
      if (linking) {
        // The row under the pointer, found through the DOM rather than by
        // geometry: rows scroll and reorder, and the element knows where it is.
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const row = element?.closest<HTMLElement>("[data-column]");
        const targetTable = row?.dataset.table;
        const targetColumn = row?.dataset.column;

        if (
          targetTable &&
          targetColumn &&
          targetTable !== linking.tableId &&
          !relations.some(
            (relation) =>
              relation.fromTable === linking.tableId &&
              relation.fromColumn === linking.columnId &&
              relation.toTable === targetTable &&
              relation.toColumn === targetColumn,
          )
        ) {
          emit({
            relations: [
              ...relations,
              {
                id: erdUid("r"),
                fromTable: linking.tableId,
                fromColumn: linking.columnId,
                toTable: targetTable,
                toColumn: targetColumn,
                cardinality: "1-n",
              },
            ],
            // The source column becomes a foreign key: that is what drawing
            // the relation means, and leaving it unmarked makes the diagram
            // disagree with its own SQL.
            tables: tables.map((table) =>
              table.id === linking.tableId
                ? {
                    ...table,
                    columns: table.columns.map((column) =>
                      column.id === linking.columnId ? { ...column, fk: true } : column,
                    ),
                  }
                : table,
            ),
          });
        }
        setLinking(null);
      }

      if (band) {
        const left = Math.min(band.x1, band.x2);
        const right = Math.max(band.x1, band.x2);
        const top = Math.min(band.y1, band.y2);
        const bottom = Math.max(band.y1, band.y2);

        if (right - left > 6 && bottom - top > 6) {
          setPicked(
            tables
              .filter(
                (table) =>
                  table.x + TABLE_W > left &&
                  table.x < right &&
                  table.y + tableHeight(table) > top &&
                  table.y < bottom,
              )
              .map((table) => table.id),
          );
        } else setPicked([]);
        setBand(null);
      }

      setDrag(null);
      setPan(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, linking, band, pan, tables, relations, picked]);

  /* --- edits ------------------------------------------------------------ */

  const patchTable = (id: string, change: Partial<ErdTable>) =>
    emit({ tables: tables.map((table) => (table.id === id ? { ...table, ...change } : table)) });

  const patchColumn = (tableId: string, columnId: string, change: Partial<ErdColumn>) =>
    emit({
      tables: tables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              columns: table.columns.map((column) =>
                column.id === columnId ? { ...column, ...change } : column,
              ),
            }
          : table,
      ),
    });

  const addColumn = (tableId: string) =>
    emit({
      tables: tables.map((table) =>
        table.id === tableId
          ? { ...table, columns: [...table.columns, { id: erdUid("c"), name: "column", type: "text" as ColumnTypeKey }] }
          : table,
      ),
    });

  const place = (spec: ErdCatalogItem, x: number, y: number) => {
    const table = makeTable(spec, Math.max(0, Math.round(x)), Math.max(0, Math.round(y)));
    emit({ tables: [...tables, table] });
    setSelected({ type: "table", id: table.id });
  };

  const doSave = async () => {
    if (onSave) await onSave(graph);
    setSaved(graphJson);
  };

  /* --- render ----------------------------------------------------------- */

  const selectedRelation =
    selected?.type === "relation" ? relations.find((entry) => entry.id === selected.id) : undefined;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-3.25">
        <span className="mr-auto flex min-w-0 flex-col">
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
            {title}
          </span>
          {subtitle ? (
            <span className="text-[12.5px] text-text-secondary">{subtitle}</span>
          ) : null}
        </span>

        <span className="text-[12.5px] tabular-nums text-text-secondary">
          {tables.length} table{tables.length === 1 ? "" : "s"} · {relations.length} relation
          {relations.length === 1 ? "" : "s"}
        </span>

        <button
          type="button"
          onClick={() => setSqlOpen(!sqlOpen)}
          aria-pressed={sqlOpen}
          className={cn(
            "inline-flex h-7.5 items-center gap-1.5 rounded-pill border px-3 font-sans text-[13px] halo-focus",
            "transition-colors duration-[140ms] ease-standard",
            sqlOpen
              ? "border-border-strong bg-surface-alt text-text-primary"
              : "border-border-subtle bg-transparent text-text-primary hover:bg-surface-alt",
          )}
        >
          <Icon name="code" size={13} />
          {text.sql}
        </button>

        {editable ? (
          <SaveButton variant="primary" size="md" minWidth={150} dirty={dirty} disabled={!dirty} onSave={doSave} />
        ) : null}
      </div>

      <div className="flex items-stretch">
        {palette && editable ? (
          <div className="flex w-56 shrink-0 flex-col border-r border-hairline" style={{ maxHeight: height }}>
            <div className="border-b border-hairline p-2.5">
              <SearchField value={query} onChange={setQuery} size="sm" fullWidth placeholder={text.search} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {catalog.map((group) => {
                const items = group.items.filter(
                  (item) =>
                    !query || normalize(`${item.label} ${item.note}`).includes(normalize(query)),
                );
                if (!items.length) return null;
                const folded = collapsed.includes(group.key) && !query;

                return (
                  <div key={group.key} className="mb-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((current) =>
                          current.includes(group.key)
                            ? current.filter((entry) => entry !== group.key)
                            : [...current, group.key],
                        )
                      }
                      aria-expanded={!folded}
                      className="flex h-7.5 w-full items-center gap-2 rounded-lg border-none bg-transparent px-1 font-sans text-[12px] text-text-secondary hover:bg-surface-alt halo-focus"
                    >
                      <Icon name={group.icon as IconName} size={13} />
                      <span className="flex-1 text-left">{group.label}</span>
                      <Icon
                        name="chevron-right"
                        size={12}
                        className={cn(
                          "transition-transform duration-[180ms] ease-standard",
                          !folded && "rotate-90",
                        )}
                      />
                    </button>

                    {!folded
                      ? items.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            draggable
                            title={`${item.note} — ${text.dragHint}`}
                            onDragStart={(event) => {
                              event.dataTransfer.setData(MEDIA_TYPE, JSON.stringify(item));
                              event.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => place(item, 40, 40)}
                            className="flex w-full cursor-grab items-center gap-2.25 rounded-[10px] border-none bg-transparent px-2 py-1.5 text-left hover:bg-surface-alt halo-focus"
                          >
                            <span className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-primary">
                              <Icon name={item.icon as IconName} size={13} />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-text-primary">
                              {item.label}
                            </span>
                            <Icon name="grip-vertical" size={12} className="text-text-secondary" />
                          </button>
                        ))
                      : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div
          ref={box}
          onDragOver={(event) => {
            if (!editable || !event.dataTransfer.types.includes(MEDIA_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            if (!editable) return;
            event.preventDefault();
            const raw = event.dataTransfer.getData(MEDIA_TYPE);
            if (!raw) return;
            try {
              const point = toLocal(event);
              place(JSON.parse(raw) as ErdCatalogItem, point.x - TABLE_W / 2, point.y - HEAD_H / 2);
            } catch {
              /* a malformed payload is simply not a drop */
            }
          }}
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;
            if (event.target !== event.currentTarget && !target.dataset.canvas) return;

            if (active === "pan" && box.current) {
              setPan({
                x0: event.clientX,
                y0: event.clientY,
                sl: box.current.scrollLeft,
                st: box.current.scrollTop,
              });
              return;
            }

            setSelected(null);
            const point = toLocal(event);
            setBand({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
          }}
          className={cn(
            "relative min-w-0 flex-1 touch-none select-none overflow-auto bg-surface-page",
            active === "pan" ? (pan ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
          )}
          style={{ height }}
        >
          <div
            data-canvas="1"
            className="relative"
            style={{ width: contentW, height: contentH, minHeight: "100%" }}
          >
            {tables.length === 0 ? (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-body-s text-text-secondary">
                {text.empty}
              </span>
            ) : null}

            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              width={contentW}
              height={contentH}
            >
              {relations.map((relation) => {
                const from = byId[relation.fromTable];
                const to = byId[relation.toTable];
                if (!from || !to) return null;

                const geometry = relationPath(from, to, relation.fromColumn, relation.toColumn);
                const on = selected?.type === "relation" && selected.id === relation.id;
                const [markA, markB] = CARDINALITY_MARKS[relation.cardinality ?? "1-n"];

                return (
                  <g key={relation.id}>
                    <path
                      d={geometry.d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      style={{ pointerEvents: "stroke", cursor: editable ? "pointer" : "default" }}
                      onPointerDown={(event) => {
                        if (!editable) return;
                        event.stopPropagation();
                        setSelected({ type: "relation", id: relation.id });
                      }}
                    />
                    <path
                      d={geometry.d}
                      fill="none"
                      stroke={on ? "var(--color-accent-deep)" : "var(--color-text-secondary)"}
                      strokeWidth={on ? 2.2 : 1.5}
                    />

                    {/* The cardinality marks sit just off each end, on the
                        side the curve leaves from. */}
                    <text
                      x={geometry.ax + (geometry.rightward ? 9 : -9)}
                      y={geometry.ay - 6}
                      textAnchor="middle"
                      className="font-sans"
                      style={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                    >
                      {markA}
                    </text>
                    <text
                      x={geometry.bx + (geometry.rightward ? -9 : 9)}
                      y={geometry.by - 6}
                      textAnchor="middle"
                      className="font-sans"
                      style={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                    >
                      {markB}
                    </text>
                  </g>
                );
              })}

              {linking && byId[linking.tableId] ? (
                <path
                  d={`M ${byId[linking.tableId]!.x + TABLE_W} ${columnY(byId[linking.tableId]!, linking.columnId)} L ${linking.x} ${linking.y}`}
                  fill="none"
                  stroke="var(--color-accent-deep)"
                  strokeWidth="1.8"
                  strokeDasharray="5 4"
                />
              ) : null}
            </svg>

            {tables.map((table) => {
              const isSelected = selected?.type === "table" && selected.id === table.id;
              const inGroup = picked.includes(table.id);
              const isDragging = drag?.moved && (drag.id === table.id || (picked.includes(drag.id) && inGroup));

              return (
                <div
                  key={table.id}
                  onMouseEnter={() => setHover(table.id)}
                  onMouseLeave={() => setHover((current) => (current === table.id ? null : current))}
                  className={cn(
                    "absolute rounded-[14px] border-[1.5px] bg-surface-card",
                    isSelected
                      ? "border-accent-deep ring-3 ring-accent/30"
                      : inGroup
                        ? "border-text-primary"
                        : "border-border-subtle",
                    isDragging ? "shadow-float" : "shadow-none",
                    !isDragging && "transition-[box-shadow,border-color] duration-[140ms] ease-standard",
                  )}
                  style={{
                    left: table.x,
                    top: table.y,
                    width: TABLE_W,
                    zIndex: typeMenu?.tableId === table.id ? 40 : isSelected || isDragging ? 20 : 12,
                  }}
                >
                  <div
                    onPointerDown={(event) => {
                      if (!editable || active === "pan") return;
                      event.stopPropagation();
                      setSelected({ type: "table", id: table.id });
                      const point = toLocal(event);
                      setDrag({
                        id: table.id,
                        dx: point.x - table.x,
                        dy: point.y - table.y,
                        moved: false,
                      });
                    }}
                    onDoubleClick={() => {
                      if (!editable) return;
                      setEditing({ kind: "table", id: table.id });
                      setDraft(table.name);
                    }}
                    className={cn(
                      "flex items-center gap-1.75 rounded-t-[12.5px] px-2.5",
                      // A view is marked by its fill, not by an icon alone:
                      // the distinction has to survive being skimmed.
                      table.kind === "view"
                        ? "bg-surface-sunken text-text-primary"
                        : "bg-action-secondary-bg text-action-secondary-fg",
                      editable ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
                    )}
                    style={{ height: HEAD_H }}
                  >
                    <Icon name={table.kind === "view" ? "eye" : "table-2"} size={14} />

                    {editing?.kind === "table" && editing.id === table.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            patchTable(table.id, { name: draft });
                            setEditing(null);
                          }
                          if (event.key === "Escape") setEditing(null);
                        }}
                        onBlur={() => {
                          patchTable(table.id, { name: draft });
                          setEditing(null);
                        }}
                        className="h-6 min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-card px-1.5 font-sans text-[13px] text-text-primary outline-none"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                        {table.name}
                      </span>
                    )}

                    <span className="shrink-0 text-[11px] opacity-70">{table.columns.length}</span>
                  </div>

                  <div className="py-0.75">
                    {table.columns.map((column) => {
                      const linked = relations.some(
                        (relation) =>
                          (relation.fromTable === table.id && relation.fromColumn === column.id) ||
                          (relation.toTable === table.id && relation.toColumn === column.id),
                      );

                      return (
                        <div
                          key={column.id}
                          data-table={table.id}
                          data-column={column.id}
                          className={cn(
                            "relative flex items-center gap-1.5 px-2.5 text-[12.5px]",
                            linking && linking.tableId !== table.id && "hover:bg-mist",
                          )}
                          style={{ height: ROW_H }}
                        >
                          <span
                            className={cn(
                              "inline-flex w-3.25 shrink-0 justify-center",
                              column.pk
                                ? "text-text-primary"
                                : column.fk
                                  ? "text-text-secondary"
                                  : "text-transparent",
                            )}
                          >
                            <Icon name={column.pk ? "key-round" : "key"} size={11} />
                          </span>

                          {editing?.kind === "column" && editing.id === column.id ? (
                            <input
                              autoFocus
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  patchColumn(table.id, column.id, { name: draft });
                                  setEditing(null);
                                }
                                if (event.key === "Escape") setEditing(null);
                              }}
                              onBlur={() => {
                                patchColumn(table.id, column.id, { name: draft });
                                setEditing(null);
                              }}
                              className="h-5.5 min-w-0 flex-1 rounded border border-border-subtle bg-surface-page px-1 font-sans text-[12.5px] text-text-primary outline-none"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => {
                                if (!editable) return;
                                setEditing({ kind: "column", id: column.id });
                                setDraft(column.name);
                              }}
                              className="min-w-0 flex-1 truncate text-text-primary"
                            >
                              {column.name}
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={!editable}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() =>
                              setTypeMenu(
                                typeMenu?.columnId === column.id
                                  ? null
                                  : { tableId: table.id, columnId: column.id },
                              )
                            }
                            className="shrink-0 rounded border-none bg-transparent font-mono text-[11px] text-text-secondary hover:text-text-primary halo-focus"
                          >
                            {typeOf(column.type).label}
                          </button>

                          {typeMenu?.tableId === table.id && typeMenu.columnId === column.id ? (
                            <div
                              onPointerDown={(event) => event.stopPropagation()}
                              className="absolute right-0 top-5.5 z-60 w-52 rounded-[10px] border border-border-subtle bg-surface-card p-1.5 shadow-float"
                            >
                              {COLUMN_TYPES.map((type) => (
                                <button
                                  key={type.key}
                                  type="button"
                                  onClick={() => {
                                    patchColumn(table.id, column.id, { type: type.key });
                                    setTypeMenu(null);
                                  }}
                                  className={cn(
                                    "flex h-7 w-full items-center gap-2 rounded-md border-none bg-transparent px-2 text-left font-sans text-[12.5px] hover:bg-mist halo-focus",
                                    column.type === type.key
                                      ? "font-medium text-text-primary"
                                      : "text-text-primary",
                                  )}
                                >
                                  <Icon name={type.icon as IconName} size={12} />
                                  <span className="flex-1">{type.label}</span>
                                  <span className="font-mono text-[11px] text-text-secondary">
                                    {type.sql}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {editable && (hover === table.id || linked) ? (
                            <span
                              title="Drag onto another row to relate them"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                setLinking({
                                  tableId: table.id,
                                  columnId: column.id,
                                  x: table.x + TABLE_W,
                                  y: columnY(table, column.id),
                                });
                              }}
                              className={cn(
                                "absolute -right-1.5 top-1/2 z-3 size-2.5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-surface-card",
                                linked ? "bg-accent-deep" : "bg-text-secondary",
                              )}
                            />
                          ) : null}
                        </div>
                      );
                    })}

                    {editable ? (
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => addColumn(table.id)}
                        className="flex h-6.5 w-full items-center gap-1.5 border-none bg-transparent px-2.5 text-left font-sans text-[12px] text-text-secondary hover:text-text-primary halo-focus"
                      >
                        <Icon name="plus" size={11} />
                        {text.addColumn}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {band ? (
              <span
                className="pointer-events-none absolute z-30 border-[1.5px] border-accent-deep"
                style={{
                  left: Math.min(band.x1, band.x2),
                  top: Math.min(band.y1, band.y2),
                  width: Math.abs(band.x2 - band.x1),
                  height: Math.abs(band.y2 - band.y1),
                  background: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                }}
              />
            ) : null}
          </div>
        </div>

        {sqlOpen ? (
          <div className="flex w-96 shrink-0 flex-col border-l border-hairline" style={{ maxHeight: height }}>
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
              <span className="mr-auto text-[13.5px] font-medium text-text-primary">{text.sql}</span>
              <CopyButton value={sql} iconOnly />
              <button
                type="button"
                aria-label={text.closeSql}
                onClick={() => setSqlOpen(false)}
                className="inline-flex size-7 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:bg-surface-alt halo-focus"
              >
                <Icon name="x" size={13} />
              </button>
            </div>

            <pre className="m-0 flex-1 overflow-auto p-3 font-mono text-[12px] leading-[1.55] text-text-primary">
              {sql}
            </pre>
          </div>
        ) : null}
      </div>

      {editable && selectedRelation ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-surface-alt px-4 py-2.5">
          <span className="text-[12.5px] text-text-secondary">Cardinality</span>
          <span className="inline-flex gap-1 rounded-pill bg-surface-card p-0.75">
            {(Object.keys(CARDINALITY_MARKS) as Cardinality[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={(selectedRelation.cardinality ?? "1-n") === value}
                onClick={() =>
                  emit({
                    relations: relations.map((relation) =>
                      relation.id === selectedRelation.id
                        ? { ...relation, cardinality: value }
                        : relation,
                    ),
                  })
                }
                className={cn(
                  "h-6.5 rounded-pill border-none px-2.5 font-mono text-[12px] halo-focus",
                  (selectedRelation.cardinality ?? "1-n") === value
                    ? "bg-text-primary text-surface-page"
                    : "bg-transparent text-text-primary",
                )}
              >
                {value}
              </button>
            ))}
          </span>

          <button
            type="button"
            onClick={() => {
              emit({ relations: relations.filter((entry) => entry.id !== selectedRelation.id) });
              setSelected(null);
            }}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-pill border border-error bg-transparent px-3 font-sans text-[12.5px] text-error halo-focus"
          >
            <Icon name="trash-2" size={12} />
            {text.deleteRelation}
          </button>
        </div>
      ) : null}

      {editable ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-4 py-2.25 text-[12.5px] text-text-secondary">
          <span>{text.hint}</span>
        </div>
      ) : null}
    </div>
  );
}
