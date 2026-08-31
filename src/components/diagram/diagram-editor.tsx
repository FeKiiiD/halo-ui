import * as React from "react";
import { cn } from "../../lib/cn";
import {
  ALIGNMENTS,
  FILLS,
  FILL_ORDER,
  LINK_STYLES,
  SHAPES,
  SHAPE_GROUPS,
  bounds,
  duplicateShapes,
  newShape,
  removeShapes,
  type Diagram,
  type FillName,
  type Link,
  type LinkStyle,
  type Shape,
  type ShapeType,
} from "../../lib/diagram";
import { Icon, type IconName } from "../core/icon";
import { SaveButton } from "../core/save-button";
import { CommitHistory, type Commit } from "../history/commit-history";
import { DiagramCanvas, type DiagramTool, type DiagramView } from "./diagram-canvas";

export interface DiagramLogEntry {
  id: string;
  /** ISO timestamp. */
  at: string;
  kind: "publish" | "save" | "restore" | "create";
  text?: string;
  author?: string;
  /** The document as it stood, so the entry can be restored. */
  doc?: Diagram;
  tag?: string;
}

export interface DiagramEditorProps {
  shapes?: Shape[];
  links?: Link[];
  onChange?: (next: Diagram) => void;
  onSave?: (next: Diagram) => unknown | Promise<unknown>;
  onPublish?: (next: Diagram, version: string) => void;

  title?: React.ReactNode;
  height?: number;
  readOnly?: boolean;
  palette?: boolean;

  history?: DiagramLogEntry[];
  author?: string;

  /** Formats a timestamp as "3 minutes ago". Replace to localise. */
  formatAgo?: (iso: string) => string;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

const MEDIA_TYPE = "text/halo-shape";

/** How many steps of undo are kept. */
const UNDO_DEPTH = 40;

const logKinds: Record<
  DiagramLogEntry["kind"],
  { icon: IconName; label: string; lane: number; branch: string }
> = {
  publish: { icon: "rocket", label: "Published", lane: 0, branch: "published" },
  save: { icon: "save", label: "Saved", lane: 1, branch: "draft" },
  restore: { icon: "rotate-ccw", label: "Version restored", lane: 1, branch: "draft" },
  create: { icon: "file-plus", label: "Created", lane: 0, branch: "published" },
};

const defaultAgo = (iso: string) => {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86_400)} d ago`;
};

/**
 * The free-form diagramming shell: palette, canvas, inspector.
 *
 * WHERE A FLOW EDITOR MODELS SOMETHING THAT RUNS, THIS MODELS A DRAWING THAT
 * EXPLAINS. No node types, no ports, no execution order — so nothing here
 * validates, and nothing refuses a half-finished thought.
 *
 * Saves and publishes are recorded as a lane graph through CommitHistory:
 * published versions on the trunk, drafts on their own branch. Restoring is an
 * ordinary edit, which is why it is undoable like any other.
 */
export function DiagramEditor({
  shapes: shapesProp,
  links: linksProp,
  onChange,
  onSave,
  onPublish,
  title = "Diagram",
  height = 560,
  readOnly = false,
  palette = true,
  history = [],
  author = "You",
  formatAgo = defaultAgo,
  labels,
  className,
}: DiagramEditorProps) {
  const text = {
    select: "Select (V)",
    pan: "Pan (H, or space)",
    undo: "Undo",
    redo: "Redo",
    grid: "Grid",
    snap: "Snap to grid",
    versions: "Versions",
    versionsHint: "Published on the trunk, drafts on their branch",
    publish: "Publish",
    closeHistory: "Close the history",
    fill: "Fill",
    textSection: "Text",
    alignment: "Alignment",
    order: "Order",
    front: "Front",
    back: "Back",
    route: "Route",
    dashed: "Dashed",
    label: "Label",
    labelPlaceholder: "yes, no, otherwise…",
    duplicate: "Duplicate",
    delete: "Delete",
    bold: "Bold",
    empty:
      "Nothing selected. Drop a shape from the palette, double-click to write, and drag a lime dot from one shape to another to connect them.",
    hint: "Double-click to write · lime dot to connect · V select, H or space to pan · ⌘D duplicate · Del to remove",
    ...labels,
  };

  const [doc, setDoc] = React.useState<Diagram>(() => ({
    shapes: shapesProp ?? [],
    links: linksProp ?? [],
  }));

  React.useEffect(() => {
    if (shapesProp) setDoc((current) => ({ ...current, shapes: shapesProp }));
  }, [shapesProp]);

  const [selected, setSelected] = React.useState<string[]>([]);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [tool, setTool] = React.useState<DiagramTool>("select");
  const [view, setView] = React.useState<DiagramView>({ x: 40, y: 30, k: 1 });
  const [grid, setGrid] = React.useState(true);
  const [snapOn, setSnapOn] = React.useState(true);
  const [showHistory, setShowHistory] = React.useState(false);
  const [log, setLog] = React.useState<DiagramLogEntry[]>(history);
  const [pending, setPending] = React.useState(0);
  const [saved, setSaved] = React.useState(() =>
    JSON.stringify({ shapes: shapesProp ?? [], links: linksProp ?? [] }),
  );

  // Undo stacks live in state, not refs: a ref would not re-render, so the
  // buttons would stay disabled after the first edit.
  const [past, setPast] = React.useState<Diagram[]>([]);
  const [future, setFuture] = React.useState<Diagram[]>([]);

  const surface = React.useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(doc) !== saved;

  const apply = (next: Diagram, record = true) => {
    if (record) {
      setPast((current) => [...current.slice(-UNDO_DEPTH), doc]);
      setFuture([]);
    }
    setDoc(next);
    onChange?.(next);
    setPending((count) => count + 1);
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((current) => current.slice(0, -1));
    setFuture((current) => [...current, doc]);
    setDoc(previous);
    onChange?.(previous);
  };

  const redo = () => {
    const next = future[future.length - 1];
    if (!next) return;
    setFuture((current) => current.slice(0, -1));
    setPast((current) => [...current, doc]);
    setDoc(next);
    onChange?.(next);
  };

  /* --- the version log --------------------------------------------------- */

  const pushLog = (
    kind: DiagramLogEntry["kind"],
    entryText: string,
    snapshot?: Diagram,
    tag?: string,
  ) =>
    setLog((current) => [
      {
        id: `h${current.length}-${kind}-${entryText}`,
        at: new Date().toISOString(),
        kind,
        text: entryText,
        author,
        doc: snapshot,
        tag,
      },
      ...current,
    ]);

  const doSave = async () => {
    if (onSave) await onSave(doc);
    setSaved(JSON.stringify(doc));
    pushLog(
      "save",
      pending ? `${pending} change${pending === 1 ? "" : "s"}` : "No change",
      doc,
    );
    setPending(0);
  };

  const doPublish = async () => {
    if (onSave) await onSave(doc);
    setSaved(JSON.stringify(doc));
    const version = `v${log.filter((entry) => entry.kind === "publish").length + 2}`;
    pushLog("publish", "Version released", doc, version);
    setPending(0);
    onPublish?.(doc, version);
  };

  const restore = (entry: DiagramLogEntry) => {
    if (!entry.doc) return;
    apply(entry.doc);
    pushLog("restore", `Version of ${new Date(entry.at).toLocaleString()}`);
  };

  const commits = React.useMemo<(Commit & { entry?: DiagramLogEntry })[]>(() => {
    type Row = Commit & { entry?: DiagramLogEntry };
    const rows: Row[] = log.map((entry, index): Row => {
      const kind = logKinds[entry.kind] ?? logKinds.save;
      // The previous entry that carried a snapshot — the one this is a diff
      // against. Entries without a doc (a restore) are not comparable.
      const previous = log.slice(index + 1).find((other) => other.doc);

      const diff =
        entry.doc && previous?.doc
          ? {
              added: entry.doc.shapes.filter(
                (shape) => !previous.doc!.shapes.some((old) => old.id === shape.id),
              ).length,
              removed: previous.doc.shapes.filter(
                (old) => !entry.doc!.shapes.some((shape) => shape.id === old.id),
              ).length,
            }
          : null;

      return {
        id: entry.id,
        title: kind.label + (entry.text ? ` — ${entry.text}` : ""),
        message: entry.text ?? kind.label,
        author: entry.author ?? author,
        time: formatAgo(entry.at),
        lane: kind.lane,
        branch: kind.branch,
        tag: entry.tag,
        head: index === 0,
        files: entry.doc?.shapes.length,
        added: diff?.added,
        removed: diff?.removed,
        changes: entry.doc
          ? [
              { name: `${entry.doc.shapes.length} shapes`, status: "changed" as const },
              { name: `${entry.doc.links.length} links`, status: "changed" as const },
            ]
          : undefined,
        entry,
      };
    });

    // Draw the legs where the lane changes between adjacent rows.
    rows.forEach((row, index) => {
      const next = rows[index + 1];
      if (!next) return;
      const lane = row.lane ?? 0;
      const nextLane = next.lane ?? 0;
      if (nextLane !== lane && lane > 0) row.branchFrom = nextLane;
      if (lane === 0 && nextLane > 0) row.mergeFrom = nextLane;
    });

    return rows;
  }, [log, author, formatAgo]);

  /* --- selection --------------------------------------------------------- */

  const selectedShapes = doc.shapes.filter((shape) => selected.includes(shape.id));
  const selectedLink = doc.links.find((link) => selected.includes(link.id));
  const one = selectedShapes.length === 1 ? selectedShapes[0] : null;

  const patchShapes = (change: Partial<Shape>) =>
    apply({
      ...doc,
      shapes: doc.shapes.map((shape) =>
        selected.includes(shape.id) ? { ...shape, ...change } : shape,
      ),
    });

  const patchLink = (change: Partial<Link>) => {
    if (!selectedLink) return;
    apply({
      ...doc,
      links: doc.links.map((link) =>
        link.id === selectedLink.id ? { ...link, ...change } : link,
      ),
    });
  };

  const removeSelected = () => {
    apply(removeShapes(selected, doc));
    setSelected([]);
  };

  const order = (direction: "front" | "back") => {
    const picked = doc.shapes.filter((shape) => selected.includes(shape.id));
    const rest = doc.shapes.filter((shape) => !selected.includes(shape.id));
    apply({ ...doc, shapes: direction === "front" ? [...rest, ...picked] : [...picked, ...rest] });
  };

  const alignTo = (alignment: (typeof ALIGNMENTS)[number]) => {
    const region = bounds(selectedShapes);
    if (!region) return;
    apply({
      ...doc,
      shapes: doc.shapes.map((shape) =>
        selected.includes(shape.id) ? { ...shape, ...alignment.apply(shape, region) } : shape,
      ),
    });
  };

  const duplicateSelected = () => {
    const { diagram, created } = duplicateShapes(selected, doc);
    apply(diagram);
    setSelected(created);
  };

  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData(MEDIA_TYPE) as ShapeType;
    const rect = surface.current?.getBoundingClientRect();
    if (!type || !rect) return;

    const shape = newShape(
      type,
      (event.clientX - rect.left - view.x) / view.k,
      (event.clientY - rect.top - view.y) / view.k,
    );
    apply({ ...doc, shapes: [...doc.shapes, shape] });
    setSelected([shape.id]);
    setEditing(shape.id);
  };

  /* --- render ------------------------------------------------------------ */

  const toolButton = (
    icon: IconName,
    label: string,
    on: boolean,
    action: () => void,
    extra?: { disabled?: boolean; grow?: boolean; tone?: "error"; children?: React.ReactNode },
  ) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={extra?.children ? undefined : label}
      aria-pressed={on}
      disabled={extra?.disabled}
      onClick={action}
      className={cn(
        "inline-flex h-7.5 min-w-7.5 items-center justify-center gap-1.5 rounded-[9px] border px-2.25 font-sans text-[13px] halo-focus",
        "transition-colors duration-[140ms] ease-standard",
        on
          ? "border-accent-deep bg-accent text-accent-ink"
          : "border-border-subtle bg-transparent text-text-primary hover:bg-surface-alt",
        extra?.tone === "error" && "border-error text-error",
        extra?.disabled && "opacity-40",
        extra?.grow && "flex-1",
      )}
    >
      <Icon name={icon} size={13} />
      {extra?.children}
    </button>
  );

  const sectionLabel = (children: React.ReactNode) => (
    <span className="font-sans text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
      {children}
    </span>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-panel border border-border-subtle bg-surface-card font-sans text-text-primary",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2.5">
        <span className="mr-1 text-[15px] font-semibold tracking-[-0.01em]">{title}</span>

        {!readOnly ? (
          <>
            <span className="inline-flex gap-1">
              {toolButton("mouse-pointer-2", text.select, tool === "select", () => setTool("select"))}
              {toolButton("hand", text.pan, tool === "pan", () => setTool("pan"))}
            </span>

            <span className="inline-flex gap-1 border-l border-hairline pl-2">
              {toolButton("undo-2", text.undo, false, undo, { disabled: past.length === 0 })}
              {toolButton("redo-2", text.redo, false, redo, { disabled: future.length === 0 })}
            </span>

            <span className="inline-flex gap-1 border-l border-hairline pl-2">
              {toolButton("grid-3x3", text.grid, grid, () => setGrid(!grid))}
              {toolButton("magnet", text.snap, snapOn, () => setSnapOn(!snapOn))}
            </span>
          </>
        ) : null}

        <span className="ml-auto inline-flex items-center gap-2">
          <span className="text-[12.5px] text-text-secondary">
            {doc.shapes.length} shapes · {doc.links.length} links
          </span>

          {!readOnly
            ? toolButton("history", text.versions, showHistory, () => setShowHistory(!showHistory), {
                children: <span>{text.versions}</span>,
              })
            : null}

          {!readOnly ? (
            <SaveButton variant="primary" size="md" minWidth={148} dirty={dirty} disabled={!dirty} onSave={doSave} />
          ) : null}
        </span>
      </div>

      <div className="flex items-stretch">
        {palette && !readOnly ? (
          <div
            className="flex w-42 shrink-0 flex-col gap-3.5 overflow-y-auto border-r border-hairline p-3"
            style={{ maxHeight: height }}
          >
            {SHAPE_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-1.5">
                {sectionLabel(group.label)}

                {group.items.map((type) => {
                  const spec = SHAPES[type];
                  const on = tool === `shape:${type}`;

                  return (
                    <button
                      key={type}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(MEDIA_TYPE, type);
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      // Click arms the tool, drag places directly — both work,
                      // because people reach for one or the other and neither
                      // is discoverable from the outside.
                      onClick={() => setTool(on ? "select" : `shape:${type}`)}
                      className={cn(
                        "flex cursor-grab items-center gap-2 rounded-[10px] border px-2.25 py-1.75 text-left font-sans text-[13px] halo-focus",
                        "transition-colors duration-[140ms] ease-standard",
                        on
                          ? "border-accent-deep bg-accent text-accent-ink"
                          : "border-border-subtle bg-transparent text-text-primary hover:bg-surface-alt",
                      )}
                    >
                      <Icon name={spec.icon as IconName} size={15} />
                      {spec.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}

        <div
          ref={surface}
          onDragOver={(event) => event.preventDefault()}
          onDrop={drop}
          className="min-w-0 flex-1"
        >
          <DiagramCanvas
            shapes={doc.shapes}
            links={doc.links}
            onChange={apply}
            selected={selected}
            onSelect={setSelected}
            editing={editing}
            onEditing={setEditing}
            tool={tool}
            onToolChange={setTool}
            gridOn={grid}
            snapOn={snapOn}
            view={view}
            onView={setView}
            height={height}
            readOnly={readOnly}
          />
        </div>

        {!readOnly && showHistory ? (
          <div className="flex w-85 shrink-0 flex-col border-l border-hairline" style={{ maxHeight: height }}>
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.75">
              <span className="mr-auto flex min-w-0 flex-col">
                <span className="text-[14px] font-semibold tracking-[-0.01em]">{text.versions}</span>
                <span className="text-[12px] text-text-secondary">{text.versionsHint}</span>
              </span>
              {toolButton("rocket", text.publish, false, () => void doPublish(), {
                children: <span>{text.publish}</span>,
              })}
              {toolButton("x", text.closeHistory, false, () => setShowHistory(false))}
            </div>

            {dirty ? (
              <div className="flex items-center gap-1.75 border-b border-hairline px-3 py-2.25 text-[12.5px] text-text-secondary">
                <span className="size-1.75 rounded-full bg-accent" />
                {pending} unsaved change{pending === 1 ? "" : "s"}
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto p-3">
              <CommitHistory
                title={null}
                commits={commits}
                searchable={false}
                filterable={false}
                onRestore={(commit) => {
                  const match = commits.find((row) => row.id === commit.id)?.entry;
                  if (match) restore(match);
                }}
              />
            </div>
          </div>
        ) : null}

        {!readOnly && !showHistory ? (
          <div
            className="flex w-54 shrink-0 flex-col gap-3.5 overflow-y-auto border-l border-hairline p-3"
            style={{ maxHeight: height }}
          >
            {!selected.length ? (
              <span className="text-[12.5px] leading-[1.5] text-text-secondary">{text.empty}</span>
            ) : null}

            {selectedShapes.length ? (
              <>
                <div className="flex flex-col gap-1.75">
                  {sectionLabel(text.fill)}
                  <div className="grid grid-cols-5 gap-1.5">
                    {FILL_ORDER.map((name) => {
                      const swatch = FILLS[name];
                      const on = one?.fill === name;

                      return (
                        <button
                          key={name}
                          type="button"
                          title={swatch.label}
                          aria-label={swatch.label}
                          aria-pressed={on}
                          onClick={() => patchShapes({ fill: name as FillName })}
                          className={cn(
                            "h-6.5 cursor-pointer rounded-[7px] border-[1.5px] halo-focus",
                            on && "ring-2 ring-accent",
                          )}
                          style={{
                            // The "no fill" swatch is a hatch, because an
                            // empty square reads as white, not as nothing.
                            background:
                              name === "none"
                                ? "repeating-linear-gradient(45deg,var(--color-surface-alt) 0 4px,transparent 4px 8px)"
                                : swatch.bg,
                            borderColor: on
                              ? "var(--color-accent-deep)"
                              : swatch.line === "transparent"
                                ? "var(--color-border-subtle)"
                                : swatch.line,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1.75">
                  {sectionLabel(text.textSection)}
                  <div className="flex gap-1.25">
                    {(
                      [
                        ["align-left", "left"],
                        ["align-center", "center"],
                        ["align-right", "right"],
                      ] as const
                    ).map(([icon, value]) =>
                      toolButton(icon, value, one?.align === value, () => patchShapes({ align: value }), {
                        grow: true,
                      }),
                    )}
                    {toolButton("bold", text.bold, Boolean(one?.bold), () =>
                      patchShapes({ bold: !one?.bold }), { grow: true },
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={11}
                      max={34}
                      step={1}
                      value={one?.fontSize ?? 15}
                      aria-label="Font size"
                      onChange={(event) => patchShapes({ fontSize: Number(event.target.value) })}
                      className="flex-1 accent-text-primary"
                    />
                    <span className="min-w-8.5 text-[12px] tabular-nums text-text-secondary">
                      {one?.fontSize ?? 15} px
                    </span>
                  </div>
                </div>

                {selectedShapes.length > 1 ? (
                  <div className="flex flex-col gap-1.75">
                    {sectionLabel(text.alignment)}
                    <div className="grid grid-cols-3 gap-1.25">
                      {ALIGNMENTS.map((alignment) =>
                        toolButton(alignment.icon as IconName, alignment.label, false, () =>
                          alignTo(alignment),
                        ),
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.75">
                  {sectionLabel(text.order)}
                  <div className="flex gap-1.25">
                    {toolButton("bring-to-front", text.front, false, () => order("front"), {
                      grow: true,
                      children: <span>{text.front}</span>,
                    })}
                    {toolButton("send-to-back", text.back, false, () => order("back"), {
                      grow: true,
                      children: <span>{text.back}</span>,
                    })}
                  </div>
                </div>
              </>
            ) : null}

            {selectedLink ? (
              <>
                <div className="flex flex-col gap-1.75">
                  {sectionLabel(text.route)}
                  <div className="flex gap-1.25">
                    {(Object.entries(LINK_STYLES) as [LinkStyle, { label: string; icon: string }][]).map(
                      ([style, meta]) =>
                        toolButton(
                          meta.icon as IconName,
                          meta.label,
                          (selectedLink.style ?? "elbow") === style,
                          () => patchLink({ style }),
                          { grow: true },
                        ),
                    )}
                  </div>
                  {toolButton("minus", text.dashed, Boolean(selectedLink.dashed), () =>
                    patchLink({ dashed: !selectedLink.dashed }), {
                      children: <span>{text.dashed}</span>,
                    },
                  )}
                </div>

                <div className="flex flex-col gap-1.75">
                  {sectionLabel(text.label)}
                  <input
                    value={selectedLink.label ?? ""}
                    onChange={(event) => patchLink({ label: event.target.value })}
                    placeholder={text.labelPlaceholder}
                    aria-label={text.label}
                    className="h-8 rounded-[9px] border border-border-subtle bg-surface-page px-2.5 font-sans text-[13px] text-text-primary outline-none placeholder:text-text-secondary focus:border-border-strong"
                  />
                </div>
              </>
            ) : null}

            {selected.length ? (
              <div className="mt-auto flex gap-1.25 border-t border-hairline pt-2.5">
                {toolButton("copy", text.duplicate, false, duplicateSelected, {
                  grow: true,
                  children: <span>{text.duplicate}</span>,
                })}
                {toolButton("trash-2", text.delete, false, removeSelected, { tone: "error" })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3.5 border-t border-hairline px-3.25 py-2.25 text-[12.5px] text-text-secondary">
        <span>{text.hint}</span>
      </div>
    </div>
  );
}
