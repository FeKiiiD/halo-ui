import * as React from "react";
import { cn } from "../../lib/cn";
import { fromIso, toIso, type IsoDate } from "../../lib/date";
import { Button } from "../core/button";
import { Icon } from "../core/icon";
import { MatrixAvatar } from "../matrix/matrix-frame";

export type GanttScale = "day" | "week" | "month";
export type GanttStatus = "planned" | "done" | "late";

export interface GanttPerson {
  name: string;
  src?: string;
}

export interface GanttTask {
  id: string;
  name: string;
  start: IsoDate;
  /** Same day as `start` for a milestone. */
  end?: IsoDate;
  group?: string;
  status?: GanttStatus;
  people?: (string | GanttPerson)[];
  /** Ids of tasks this one waits on. */
  dependsOn?: string[];
  progress?: number;
}

export interface GanttChartProps {
  tasks: GanttTask[];
  scale?: GanttScale;
  from?: IsoDate;
  to?: IsoDate;

  rowHeight?: number;
  nameWidth?: number;
  showToday?: boolean;
  today?: IsoDate;

  onSelect?: (task: GanttTask) => void;
  onScaleChange?: (scale: GanttScale) => void;
  onTaskChange?: (id: string, dates: { start: IsoDate; end: IsoDate }) => void;
  onLink?: (from: string, to: string) => void;
  onSave?: (tasks: GanttTask[]) => void;

  editable?: boolean;
  linkable?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;

  title?: React.ReactNode;
  monthNames?: string[];
  dayNames?: string[];
  labels?: {
    day?: string;
    week?: string;
    month?: string;
    edit?: string;
    save?: string;
    cancel?: string;
    today?: string;
  };
  className?: string;
}

const DAY_MS = 86_400_000;

/** Column width per scale, in px. */
const unitWidths: Record<GanttScale, number> = { day: 34, week: 52, month: 92 };

const defaultMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const defaultDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Noon, so a DST shift cannot move the day. */
const atNoon = (value: Date | string): Date => {
  const date = value instanceof Date ? new Date(value) : (fromIso(String(value)) ?? new Date());
  date.setHours(12, 0, 0, 0);
  return date;
};

const startOfWeek = (value: Date): Date => {
  const date = new Date(value);
  // Monday-first: Sunday (0) becomes 6.
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  date.setHours(12, 0, 0, 0);
  return date;
};

const shortDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

/**
 * A rendered line. `start`/`end` are Dates here while GanttTask carries ISO
 * strings, so the task is held alongside rather than spread in — spreading it
 * would put two different types on the same two names.
 */
interface Row {
  kind: "group" | "task";
  id: string;
  name: string;
  start: Date;
  end: Date;
  count?: number;
  people?: (string | GanttPerson)[];
  status?: GanttStatus;
  progress?: number;
  dependsOn?: string[];
  /** Absent on a group row, which summarises its children. */
  task?: GanttTask;
}

/**
 * A timeline: fixed name column, scrollable lane, one bar per task.
 *
 * EDIT MODE HOLDS A DRAFT. Drags and links land in a copy, so Save and Cancel
 * mean something — a Gantt that mutates on every drag has no way to abandon a
 * rearrangement, and rearranging is exactly what people do to see whether it
 * works.
 *
 * Bars are dragged whole to move, or by either end to stretch. Pulling the end
 * handle onto another row draws a dependency.
 */
export function GanttChart({
  tasks,
  scale = "week",
  from,
  to,
  rowHeight = 40,
  nameWidth = 244,
  showToday = true,
  today,
  onSelect,
  onScaleChange,
  onTaskChange,
  onLink,
  onSave,
  editable = true,
  linkable = true,
  editing,
  onEditingChange,
  title = "Schedule",
  monthNames = defaultMonths,
  dayNames = defaultDays,
  labels,
  className,
}: GanttChartProps) {
  const text = {
    day: "Day",
    week: "Week",
    month: "Month",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    today: "Today",
    ...labels,
  };

  const [editOn, setEditOn] = React.useState(Boolean(editing));
  const [draft, setDraft] = React.useState<GanttTask[] | null>(null);
  const [zoom, setZoom] = React.useState<GanttScale>(scale);
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  const [hover, setHover] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState<{
    id: string;
    mode: "move" | "start" | "end";
    x0: number;
    dx: number;
  } | null>(null);
  const [link, setLink] = React.useState<{ from: string; x: number; y: number } | null>(null);
  const [columnWidth, setColumnWidth] = React.useState<number | null>(null);
  const [unitOverride, setUnitOverride] = React.useState<number | null>(null);
  const [resize, setResize] = React.useState<{ kind: "name" | "unit"; x0: number; w0: number } | null>(null);

  const lane = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (editing !== undefined) setEditOn(editing);
  }, [editing]);
  React.useEffect(() => setZoom(scale), [scale]);
  React.useEffect(() => setUnitOverride(null), [zoom]);

  const live = draft ?? tasks;
  const canEdit = editable && editOn;

  const enterEdit = () => {
    setDraft(tasks.map((task) => ({ ...task })));
    setEditOn(true);
    onEditingChange?.(true);
  };

  const leaveEdit = (keep: boolean) => {
    if (keep && onSave) onSave(draft ?? tasks);
    setDraft(null);
    setEditOn(false);
    onEditingChange?.(false);
  };

  /* --- Column resizing, spreadsheet-style ------------------------------- */

  React.useEffect(() => {
    if (!resize) return;

    const move = (event: PointerEvent) => {
      const delta = event.clientX - resize.x0;
      if (resize.kind === "name") setColumnWidth(Math.max(140, Math.min(520, resize.w0 + delta)));
      else setUnitOverride(Math.max(22, Math.min(220, resize.w0 + delta)));
    };
    const up = () => setResize(null);

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [resize]);

  /* --- Scale ------------------------------------------------------------ */

  const now = today ? atNoon(today) : atNoon(new Date());
  const dated = live.map((task) => ({
    ...task,
    startDate: atNoon(task.start),
    endDate: atNoon(task.end ?? task.start),
  }));

  const min = from
    ? atNoon(from)
    : new Date(Math.min(...dated.map((task) => task.startDate.getTime())) - 3 * DAY_MS);
  const max = to
    ? atNoon(to)
    : new Date(Math.max(...dated.map((task) => task.endDate.getTime())) + 5 * DAY_MS);

  const unit = unitOverride ?? unitWidths[zoom];
  const nameCol = columnWidth ?? nameWidth;
  const step = zoom === "day" ? DAY_MS : zoom === "week" ? 7 * DAY_MS : 30.44 * DAY_MS;

  const origin =
    zoom === "week"
      ? startOfWeek(min)
      : new Date(min.getFullYear(), min.getMonth(), zoom === "month" ? 1 : min.getDate(), 12);

  const toPx = (date: Date) => ((date.getTime() - origin.getTime()) / step) * unit;
  const msPerPx = step / unit;
  const laneWidth = Math.max(toPx(max) + unit, 480);

  const ticks: Date[] = [];
  for (const cursor = new Date(origin); cursor <= max; ) {
    ticks.push(new Date(cursor));
    if (zoom === "day") cursor.setDate(cursor.getDate() + 1);
    else if (zoom === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }

  const tickLabel = (date: Date) =>
    zoom === "day"
      ? `${dayNames[date.getDay()]} ${date.getDate()}`
      : zoom === "week"
        ? `w. ${shortDate(date)}`
        : `${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;

  /* --- Rows ------------------------------------------------------------- */

  const taskRow = (entry: (typeof dated)[number]): Row => ({
    kind: "task",
    id: entry.id,
    name: entry.name,
    start: entry.startDate,
    end: entry.endDate,
    people: entry.people,
    status: entry.status,
    progress: entry.progress,
    dependsOn: entry.dependsOn,
    task: entry,
  });

  const groups = [...new Set(dated.map((task) => task.group).filter(Boolean))] as string[];
  const rows: Row[] = [];

  if (groups.length) {
    for (const group of groups) {
      const children = dated.filter((task) => task.group === group);

      // A group's bar spans its children — a summary, not a task of its own.
      rows.push({
        kind: "group",
        id: `group:${group}`,
        name: group,
        start: new Date(Math.min(...children.map((child) => child.startDate.getTime()))),
        end: new Date(Math.max(...children.map((child) => child.endDate.getTime()))),
        count: children.length,
        // Deduped by name: a person on four tasks in a group is one face on
        // the group row, not four.
        people: [
          ...new Map(
            children
              .flatMap((child) => child.people ?? [])
              .map((person) => [typeof person === "string" ? person : person.name, person]),
          ).values(),
        ],
      });

      if (!collapsed.includes(group)) {
        for (const child of children) rows.push(taskRow(child));
      }
    }

    for (const task of dated.filter((entry) => !entry.group)) rows.push(taskRow(task));
  } else {
    for (const task of dated) rows.push(taskRow(task));
  }

  const rowIndex = new Map(rows.map((row, index) => [row.id, index]));

  /**
   * Live geometry while dragging, so a bar and its dependency lines move
   * together rather than the lines snapping at the end.
   */
  const geometryOf = (row: Row): { start: Date; end: Date } => {
    if (!drag || drag.id !== row.id) return { start: row.start, end: row.end };

    const shift = drag.dx * msPerPx;
    const snap = (time: number) => atNoon(new Date(time));

    if (drag.mode === "move") {
      return { start: snap(row.start.getTime() + shift), end: snap(row.end.getTime() + shift) };
    }
    if (drag.mode === "start") {
      // A start cannot pass its own end.
      return { start: snap(Math.min(row.start.getTime() + shift, row.end.getTime())), end: row.end };
    }
    return { start: row.start, end: snap(Math.max(row.end.getTime() + shift, row.start.getTime())) };
  };

  /* --- Dragging --------------------------------------------------------- */

  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;

  React.useEffect(() => {
    if (!drag) return;

    const move = (event: PointerEvent) =>
      setDrag((current) => (current ? { ...current, dx: event.clientX - current.x0 } : current));

    const up = () =>
      setDrag((current) => {
        // A 3px threshold: a click on a bar should select it, not nudge it.
        if (current && Math.abs(current.dx) > 3) {
          const row = rowsRef.current.find((entry) => entry.id === current.id);
          if (row) {
            const geometry = geometryOf(row);
            const dates = { start: toIso(geometry.start), end: toIso(geometry.end) };

            setDraft((currentDraft) =>
              (currentDraft ?? tasks.map((task) => ({ ...task }))).map((task) =>
                task.id === current.id ? { ...task, ...dates } : task,
              ),
            );
            onTaskChange?.(current.id, dates);
          }
        }
        return null;
      });

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, tasks]);

  React.useEffect(() => {
    if (!link) return;

    const move = (event: PointerEvent) => {
      const box = lane.current?.getBoundingClientRect();
      if (!box || !lane.current) return;
      setLink((current) =>
        current
          ? {
              ...current,
              x: event.clientX - box.left + lane.current!.scrollLeft,
              y: event.clientY - box.top,
            }
          : current,
      );
    };

    const up = () =>
      setLink((current) => {
        if (current) {
          const target = rowsRef.current[Math.floor(current.y / rowHeight)];
          if (target?.kind === "task" && target.id !== current.from) {
            setDraft((currentDraft) =>
              (currentDraft ?? tasks.map((task) => ({ ...task }))).map((task) =>
                task.id === target.id
                  ? { ...task, dependsOn: [...new Set([...(task.dependsOn ?? []), current.from])] }
                  : task,
              ),
            );
            onLink?.(current.from, target.id);
          }
        }
        return null;
      });

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, rowHeight, tasks]);

  /* --- Render ----------------------------------------------------------- */

  // Not bg-ink: that is a fixed dark value, and the dark surface is also dark,
  // so every planned bar vanished. action-secondary is the neutral solid pair
  // and flips with the theme.
  const barColour = (status?: GanttStatus) =>
    status === "late"
      ? "bg-error"
      : status === "done"
        ? "bg-success"
        : "bg-action-secondary-bg text-action-secondary-fg";

  const scaleButton = (value: GanttScale, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => {
        setZoom(value);
        onScaleChange?.(value);
      }}
      aria-pressed={zoom === value}
      className={cn(
        "h-7 rounded-pill border-none px-2.75 font-sans text-[13px] halo-focus",
        "transition-colors duration-[140ms] ease-standard",
        zoom === value
          ? "bg-text-primary font-medium text-surface-page"
          : "bg-transparent font-normal text-text-primary hover:bg-surface-alt",
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-3.5">
        <span className="mr-auto text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
          {title}
        </span>

        <span className="inline-flex gap-1 rounded-pill bg-mist p-0.75">
          {scaleButton("day", text.day)}
          {scaleButton("week", text.week)}
          {scaleButton("month", text.month)}
        </span>

        {editable ? (
          canEdit ? (
            <span className="inline-flex gap-2">
              <Button variant="outlined" size="sm" onClick={() => leaveEdit(false)}>
                {text.cancel}
              </Button>
              <Button size="sm" onClick={() => leaveEdit(true)}>
                {text.save}
              </Button>
            </span>
          ) : (
            <Button variant="outlined" size="sm" onClick={enterEdit}>
              {text.edit}
            </Button>
          )
        ) : null}
      </div>

      <div className="flex">
        <div className="shrink-0 border-r border-hairline" style={{ width: nameCol }}>
          <div
            className="flex items-center border-b border-hairline bg-surface-alt px-3.5 text-[12px] text-text-secondary"
            style={{ height: 38 }}
          >
            {/* The divider: drag to resize, double-click to reset. */}
            <span className="flex-1 truncate">Task</span>
            <span
              onPointerDown={(event) =>
                setResize({ kind: "name", x0: event.clientX, w0: nameCol })
              }
              onDoubleClick={() => setColumnWidth(null)}
              className="-mr-3.5 h-full w-2 cursor-col-resize"
            />
          </div>

          {rows.map((row) => (
            <div
              key={row.id}
              onMouseEnter={() => setHover(row.id)}
              onMouseLeave={() => setHover((current) => (current === row.id ? null : current))}
              onClick={() => row.task && onSelect?.(row.task)}
              className={cn(
                "flex items-center gap-2 border-b border-hairline px-3.5",
                "transition-colors duration-[140ms] ease-standard",
                hover === row.id ? "bg-surface-alt" : "bg-transparent",
                row.kind === "group" ? "font-medium" : "cursor-pointer",
              )}
              style={{ height: rowHeight }}
            >
              {row.kind === "group" ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setCollapsed((current) =>
                      current.includes(row.name)
                        ? current.filter((entry) => entry !== row.name)
                        : [...current, row.name],
                    );
                  }}
                  aria-expanded={!collapsed.includes(row.name)}
                  className="inline-flex size-4.5 shrink-0 items-center justify-center rounded border-none bg-transparent text-text-secondary halo-focus"
                >
                  <Icon
                    name="chevron-right"
                    size={13}
                    className={cn(
                      "transition-transform duration-[140ms] ease-out",
                      !collapsed.includes(row.name) && "rotate-90",
                    )}
                  />
                </button>
              ) : (
                <span className="w-4.5 shrink-0" />
              )}

              <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-primary">
                {row.name}
              </span>

              {row.count !== undefined ? (
                <span className="shrink-0 text-[12px] tabular-nums text-text-secondary">
                  {row.count}
                </span>
              ) : null}

              {row.people?.length ? <Faces people={row.people} /> : null}
            </div>
          ))}
        </div>

        <div ref={lane} className="relative min-w-0 flex-1 overflow-x-auto">
          <div style={{ width: laneWidth }}>
            <div
              className="sticky top-0 z-2 flex border-b border-hairline bg-surface-alt"
              style={{ height: 38 }}
            >
              {ticks.map((tick, index) => (
                <span
                  key={index}
                  className="flex shrink-0 items-center justify-center border-r border-hairline text-[11.5px] text-text-secondary last:border-r-0"
                  style={{ width: unit }}
                >
                  {tickLabel(tick)}
                </span>
              ))}
            </div>

            <div className="relative">
              {/* Column rules, drawn once behind every row. */}
              {ticks.map((_, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px bg-hairline"
                  style={{ left: (index + 1) * unit }}
                />
              ))}



              {/* Dependencies, under the bars. */}
              <svg
                className="pointer-events-none absolute inset-0 size-full"
                style={{ height: rows.length * rowHeight }}
                aria-hidden="true"
              >
                {rows.flatMap((row, index) =>
                  (row.dependsOn ?? []).map((fromId) => {
                    const fromIndex = rowIndex.get(fromId);
                    const fromRow = fromIndex !== undefined ? rows[fromIndex] : undefined;
                    if (!fromRow || fromIndex === undefined) return null;

                    const fromGeometry = geometryOf(fromRow);
                    const toGeometry = geometryOf(row);

                    const x1 = toPx(fromGeometry.end);
                    const y1 = fromIndex * rowHeight + rowHeight / 2;
                    const x2 = toPx(toGeometry.start);
                    const y2 = index * rowHeight + rowHeight / 2;

                    return (
                      <path
                        key={`${fromId}-${row.id}`}
                        // Out, across, in: an orthogonal route reads as a
                        // dependency; a straight diagonal reads as a chart line.
                        d={`M${x1} ${y1} L${x1 + 10} ${y1} L${x1 + 10} ${y2} L${x2} ${y2}`}
                        fill="none"
                        stroke="var(--color-text-secondary)"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                      />
                    );
                  }),
                )}

                {link ? (
                  <line
                    x1={link.x - 40}
                    y1={link.y}
                    x2={link.x}
                    y2={link.y}
                    stroke="var(--color-accent-deep)"
                    strokeWidth="1.6"
                  />
                ) : null}
              </svg>

              {rows.map((row, index) => {
                const geometry = geometryOf(row);
                const left = toPx(geometry.start);
                const width = Math.max(
                  toPx(geometry.end) - left + unit / (zoom === "day" ? 1 : 7),
                  6,
                );
                const milestone = row.kind === "task" && row.start.getTime() === row.end.getTime();

                return (
                  <div
                    key={row.id}
                    onMouseEnter={() => setHover(row.id)}
                    onMouseLeave={() => setHover((current) => (current === row.id ? null : current))}
                    className={cn(
                      "relative border-b border-hairline transition-colors duration-[140ms] ease-standard",
                      hover === row.id ? "bg-surface-alt" : "bg-transparent",
                    )}
                    style={{ height: rowHeight }}
                  >
                    {milestone ? (
                      <span
                        onPointerDown={(event) => {
                          if (!canEdit) return;
                          setDrag({ id: row.id, mode: "move", x0: event.clientX, dx: 0 });
                        }}
                        onClick={() => row.task && onSelect?.(row.task)}
                        className={cn(
                          "absolute top-1/2 size-3",
                          barColour(row.status),
                          canEdit ? "cursor-grab" : "cursor-pointer",
                        )}
                        style={{
                          left,
                          animation: "halo-gantt-diamond-in 260ms var(--ease-standard) both",
                        }}
                      />
                    ) : (
                      <span
                        onPointerDown={(event) => {
                          if (!canEdit) return;
                          setDrag({ id: row.id, mode: "move", x0: event.clientX, dx: 0 });
                        }}
                        onClick={() => row.task && onSelect?.(row.task)}
                        className={cn(
                          // translateY lives in the keyframe: a class here would be overridden
                          // by the animation and the bar would sit high for 300ms.
                          "absolute top-1/2 flex origin-left items-center rounded-md",
                          row.kind === "group"
                            ? "h-1.5 bg-text-secondary opacity-60"
                            : cn("h-6", barColour(row.status)),
                          canEdit && row.kind === "task"
                            ? drag?.id === row.id
                              ? "cursor-grabbing"
                              : "cursor-grab"
                            : "cursor-pointer",
                        )}
                        style={{
                          left,
                          width,
                          animation: "halo-gantt-bar-in 300ms var(--ease-standard) both",
                        }}
                      >
                        {row.kind === "task" ? (
                          <>
                            {canEdit ? (
                              <>
                                <Grip side="start" onStart={(event) => setDrag({ id: row.id, mode: "start", x0: event.clientX, dx: 0 })} />
                                <Grip side="end" onStart={(event) => setDrag({ id: row.id, mode: "end", x0: event.clientX, dx: 0 })} />
                              </>
                            ) : null}

                            {row.progress !== undefined ? (
                              <span
                                aria-hidden="true"
                                // currentColor, because the bar under it is
                                // dark in one régime and light in the other.
                                className="absolute inset-y-0 left-0 rounded-md bg-current opacity-25"
                                style={{ width: `${Math.min(100, row.progress)}%` }}
                              />
                            ) : null}

                            {linkable && canEdit ? (
                              <span
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  const box = lane.current?.getBoundingClientRect();
                                  if (!box || !lane.current) return;
                                  setLink({
                                    from: row.id,
                                    x: event.clientX - box.left + lane.current.scrollLeft,
                                    y: index * rowHeight + rowHeight / 2,
                                  });
                                }}
                                className="absolute -right-2 top-1/2 size-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-surface-card bg-accent-deep opacity-0 transition-opacity group-hover:opacity-100"
                                style={{ opacity: hover === row.id ? 1 : 0 }}
                              />
                            ) : null}
                          </>
                        ) : null}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* After the rows, not before: a marker the bars paint over is
                  not a marker. */}
              {showToday && now >= min && now <= max ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 z-2 w-0.5 bg-accent-deep"
                  style={{ left: toPx(now) }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The stretch handle at either end of a bar. */
function Grip({
  side,
  onStart,
}: {
  side: "start" | "end";
  onStart: (event: React.PointerEvent) => void;
}) {
  return (
    <span
      onPointerDown={(event) => {
        event.stopPropagation();
        onStart(event);
      }}
      className={cn(
        "absolute inset-y-0 flex w-2.25 cursor-ew-resize items-center justify-center",
        side === "start" ? "left-0" : "right-0",
      )}
    >
      <span className="h-2.5 w-0.5 rounded-sm bg-surface-card opacity-75" />
    </span>
  );
}

/** Overlapping faces on a row. */
function Faces({ people, size = 22 }: { people: (string | GanttPerson)[]; size?: number }) {
  const shown = people.slice(0, 3);
  const rest = people.length - shown.length;

  return (
    <span className="inline-flex shrink-0">
      {shown.map((person, index) => {
        const name = typeof person === "string" ? person : person.name;
        const src = typeof person === "string" ? undefined : person.src;

        return (
          <span
            key={`${name}-${index}`}
            title={name}
            className="rounded-full shadow-[0_0_0_2px_var(--color-surface-card)]"
            style={{ marginLeft: index ? -7 : 0 }}
          >
            <MatrixAvatar name={name} src={src} size={size} />
          </span>
        );
      })}

      {rest > 0 ? (
        <span
          className="inline-flex items-center justify-center rounded-full border border-border-subtle bg-surface-alt text-[10px] text-text-secondary shadow-[0_0_0_2px_var(--color-surface-card)]"
          style={{ width: size, height: size, marginLeft: -7 }}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
