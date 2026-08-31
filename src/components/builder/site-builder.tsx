import * as React from "react";
import { cn } from "../../lib/cn";
import {
  BUILDER_BREAKPOINTS,
  BUILDER_CATEGORIES,
  builderUid,
  canHoldChildren,
  cloneNode,
  exportHtml,
  findNode,
  insertInto,
  isInSubtree,
  mapTree,
  newNode,
  parentOf,
  removeNode,
  resolveStyle,
  type BreakpointId,
  type BuilderNode,
  type BuilderType,
} from "../../lib/builder";
import { CopyButton } from "../core/copy-button";
import { Icon, type IconName } from "../core/icon";
import { SaveButton } from "../core/save-button";
import { BUILDER_MEDIA_TYPE, BuilderLayers, BuilderRender } from "./builder-canvas";

export interface SiteBuilderProps {
  value?: BuilderNode[];
  onChange?: (next: BuilderNode[]) => void;
  onSave?: (next: BuilderNode[]) => unknown | Promise<unknown>;
  /** Receives the generated page. Without it the HTML is shown in a panel. */
  onExport?: (html: string) => void;

  title?: string;
  height?: number;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

/** How many steps of undo are kept. */
const UNDO_DEPTH = 40;

/** Style fields the inspector exposes, in the order they are usually reached for. */
const STYLE_FIELDS: { key: string; label: string; unit?: string }[] = [
  { key: "paddingTop", label: "Padding top", unit: "px" },
  { key: "paddingBottom", label: "Padding bottom", unit: "px" },
  { key: "gap", label: "Gap", unit: "px" },
  { key: "fontSize", label: "Font size", unit: "px" },
  { key: "maxWidth", label: "Max width", unit: "px" },
  { key: "borderRadius", label: "Radius", unit: "px" },
];

/**
 * A page builder: palette, live canvas, layers and inspector.
 *
 * STYLE EDITS LAND WHERE THE BREAKPOINT SAYS. At desktop they change the base
 * style; at tablet or mobile they become an override on that breakpoint alone.
 * That is the only behaviour that matches what the person sees — they are
 * looking at the mobile frame, so a change should affect mobile, and editing
 * the base from there would silently move the desktop layout they cannot
 * currently see.
 */
export function SiteBuilder({
  value,
  onChange,
  onSave,
  onExport,
  title = "Home page",
  height = 660,
  labels,
  className,
}: SiteBuilderProps) {
  const text = {
    add: "Add",
    layers: "Layers",
    settings: "Settings",
    preview: "Preview",
    edit: "Edit",
    export: "Export",
    closeExport: "Close",
    undo: "Undo",
    redo: "Redo",
    duplicate: "Duplicate",
    delete: "Delete",
    nothingSelected: "Select an element on the page to change it.",
    content: "Content",
    style: "Style",
    empty: "Drag an element from the palette onto the page.",
    ...labels,
  };

  const [tree, setTree] = React.useState<BuilderNode[]>(value ?? []);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [breakpoint, setBreakpoint] = React.useState<BreakpointId>("desktop");
  const [preview, setPreview] = React.useState(false);
  const [tab, setTab] = React.useState<"add" | "layers">("add");
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  const [exported, setExported] = React.useState<string | null>(null);
  const [past, setPast] = React.useState<BuilderNode[][]>([]);
  const [future, setFuture] = React.useState<BuilderNode[][]>([]);

  React.useEffect(() => {
    if (value) setTree(value);
  }, [value]);

  const treeJson = JSON.stringify(tree);
  const [saved, setSaved] = React.useState(() => treeJson);
  const dirty = treeJson !== saved;

  const push = (next: BuilderNode[]) => {
    setPast((current) => [...current.slice(-UNDO_DEPTH), tree]);
    setFuture([]);
    setTree(next);
    onChange?.(next);
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setFuture((current) => [tree, ...current]);
    setPast((current) => current.slice(0, -1));
    setTree(previous);
    onChange?.(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setPast((current) => [...current, tree]);
    setFuture((current) => current.slice(1));
    setTree(next);
    onChange?.(next);
  };

  const node = selected ? findNode(tree, selected) : null;
  const style = node ? resolveStyle(node, breakpoint) : {};

  const patch = (id: string, transform: (node: BuilderNode) => BuilderNode) =>
    push(mapTree(tree, (entry) => (entry.id === id ? transform(entry) : entry)));

  const setStyle = (change: React.CSSProperties) => {
    if (!node) return;

    patch(node.id, (entry) => {
      // At desktop the base moves; below it, only that breakpoint's override.
      if (breakpoint === "desktop") {
        return { ...entry, style: { ...(entry.style ?? {}), ...change } };
      }
      return {
        ...entry,
        responsive: {
          ...(entry.responsive ?? {}),
          [breakpoint]: { ...(entry.responsive?.[breakpoint] ?? {}), ...change },
        },
      };
    });
  };

  const setProp = (change: Record<string, unknown>) => {
    if (!node) return;
    patch(node.id, (entry) => ({ ...entry, props: { ...(entry.props ?? {}), ...change } }));
  };

  const add = (type: BuilderType, parentId?: string | null) => {
    const created = newNode(type);

    // Into the selection if it can hold children, otherwise beside it.
    const host =
      parentId ??
      (node && canHoldChildren(node.type)
        ? node.id
        : node
          ? (parentOf(tree, node.id)?.id ?? null)
          : null);

    push(insertInto(tree, host, created));
    setSelected(created.id);
  };

  const duplicate = () => {
    if (!node) return;
    const parent = parentOf(tree, node.id);
    const copy = cloneNode(node);
    push(insertInto(tree, parent?.id ?? null, copy));
    setSelected(copy.id);
  };

  const remove = () => {
    if (!node) return;
    push(removeNode(tree, node.id));
    setSelected(null);
  };

  const doSave = async () => {
    if (onSave) await onSave(tree);
    setSaved(treeJson);
  };

  const doExport = () => {
    const html = exportHtml(tree, title);
    if (onExport) onExport(html);
    else setExported(html);
  };

  const frame = BUILDER_BREAKPOINTS.find((entry) => entry.id === breakpoint);

  /* --- render ------------------------------------------------------------ */

  const toolButton = (
    icon: IconName,
    label: string,
    on: boolean,
    action: () => void,
    disabled?: boolean,
  ) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={action}
      className={cn(
        "inline-flex size-7.5 items-center justify-center rounded-[9px] border font-sans halo-focus",
        "transition-colors duration-[140ms] ease-standard",
        on
          ? "border-accent-deep bg-accent text-accent-ink"
          : "border-border-subtle bg-transparent text-text-primary hover:bg-surface-alt",
        disabled && "opacity-40",
      )}
    >
      <Icon name={icon} size={13} />
    </button>
  );

  const numberField = (label: string, key: string, unit?: string) => {
    const raw = (style as Record<string, unknown>)[key];
    return (
      <label key={key} className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">{label}</span>
        <input
          type="number"
          value={typeof raw === "number" ? raw : ""}
          placeholder="—"
          onChange={(event) =>
            setStyle({ [key]: event.target.value === "" ? undefined : Number(event.target.value) })
          }
          className="h-7 w-18 rounded-md border border-border-subtle bg-surface-page px-2 text-right font-sans text-[12.5px] tabular-nums text-text-primary outline-none focus:border-border-strong"
        />
        {unit ? <span className="w-4 text-[11px] text-text-secondary">{unit}</span> : null}
      </label>
    );
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3.5 py-2.5">
        <span className="mr-1 text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
          {title}
        </span>

        <span className="inline-flex gap-1 border-l border-hairline pl-2">
          {toolButton("undo-2", text.undo!, false, undo, past.length === 0)}
          {toolButton("redo-2", text.redo!, false, redo, future.length === 0)}
        </span>

        {/* The frame the canvas is drawn at, and the breakpoint edits land on. */}
        <span className="inline-flex gap-1 rounded-pill bg-mist p-0.75">
          {BUILDER_BREAKPOINTS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={entry.label}
              aria-label={entry.label}
              aria-pressed={breakpoint === entry.id}
              onClick={() => setBreakpoint(entry.id)}
              className={cn(
                "inline-flex h-6.5 items-center gap-1.5 rounded-pill border-none px-2.5 font-sans text-[12.5px] halo-focus",
                "transition-colors duration-[140ms] ease-standard",
                breakpoint === entry.id
                  ? "bg-surface-card font-medium text-text-primary"
                  : "bg-transparent text-text-secondary",
              )}
            >
              <Icon name={entry.icon as IconName} size={12} />
            </button>
          ))}
        </span>

        <span className="ml-auto inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="inline-flex h-7.5 items-center gap-1.5 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt halo-focus"
          >
            <Icon name={preview ? "pencil" : "eye"} size={13} />
            {preview ? text.edit : text.preview}
          </button>

          <button
            type="button"
            onClick={doExport}
            className="inline-flex h-7.5 items-center gap-1.5 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt halo-focus"
          >
            <Icon name="code" size={13} />
            {text.export}
          </button>

          <SaveButton variant="primary" size="md" minWidth={144} dirty={dirty} disabled={!dirty} onSave={doSave} />
        </span>
      </div>

      <div className="flex items-stretch">
        {!preview ? (
          <div className="flex w-56 shrink-0 flex-col border-r border-hairline" style={{ maxHeight: height }}>
            <div className="flex gap-1 border-b border-hairline p-2">
              {(["add", "layers"] as const).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setTab(entry)}
                  aria-pressed={tab === entry}
                  className={cn(
                    "h-7 flex-1 rounded-pill border-none font-sans text-[12.5px] halo-focus",
                    tab === entry
                      ? "bg-text-primary text-surface-page"
                      : "bg-transparent text-text-primary hover:bg-surface-alt",
                  )}
                >
                  {entry === "add" ? text.add : text.layers}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {tab === "add"
                ? BUILDER_CATEGORIES.map((category) => (
                    <div key={category.label} className="mb-2.5">
                      <span className="mb-1 block px-1 font-sans text-[11px] uppercase tracking-[0.06em] text-text-secondary">
                        {category.label}
                      </span>

                      <div className="grid grid-cols-2 gap-1">
                        {category.items.map((item) => (
                          <button
                            key={item.type}
                            type="button"
                            draggable
                            title={item.note}
                            onDragStart={(event) => {
                              event.dataTransfer.setData(BUILDER_MEDIA_TYPE, item.type);
                              event.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => add(item.type)}
                            className="flex cursor-grab flex-col items-center gap-1 rounded-[10px] border border-border-subtle bg-transparent px-1 py-2 font-sans text-[11px] text-text-primary hover:bg-surface-alt halo-focus"
                          >
                            <Icon name={item.icon as IconName} size={14} />
                            <span className="w-full truncate text-center">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                : tree.length ? (
                    <BuilderLayers
                      nodes={tree}
                      selected={selected}
                      onSelect={setSelected}
                      onHover={setHovered}
                      collapsed={collapsed}
                      onToggle={(id) =>
                        setCollapsed((current) =>
                          current.includes(id)
                            ? current.filter((entry) => entry !== id)
                            : [...current, id],
                        )
                      }
                    />
                  ) : (
                    <span className="block px-1 text-[12.5px] leading-[1.5] text-text-secondary">
                      {text.empty}
                    </span>
                  )}
            </div>
          </div>
        ) : null}

        <div
          onClick={() => setSelected(null)}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(BUILDER_MEDIA_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData(BUILDER_MEDIA_TYPE) as BuilderType;
            // A drop on the empty surface goes to the root, not into whatever
            // happens to be selected.
            if (type) add(type, null);
          }}
          className="min-w-0 flex-1 overflow-auto bg-surface-alt p-6"
          style={{ height }}
        >
          {/* The frame. Centred and width-limited so a mobile layout is
              actually seen at mobile width rather than merely described. */}
          <div
            className="mx-auto bg-surface-page shadow-float"
            style={{
              width: frame?.width ?? "100%",
              maxWidth: "100%",
              minHeight: "100%",
              transition: "width 220ms var(--ease-standard)",
            }}
          >
            {tree.length ? (
              tree.map((entry) => (
                <BuilderRender
                  key={entry.id}
                  node={entry}
                  breakpoint={breakpoint}
                  selected={selected}
                  hovered={hovered}
                  onSelect={setSelected}
                  onHover={setHovered}
                  onDropInto={(parentId, type) => {
                    // Never into its own subtree: that would detach the branch.
                    if (selected && isInSubtree(tree, parentId, selected)) return;
                    add(type as BuilderType, parentId);
                  }}
                  editable={!preview}
                />
              ))
            ) : (
              <div className="flex min-h-60 items-center justify-center p-10 text-center text-body-s text-text-secondary">
                {text.empty}
              </div>
            )}
          </div>
        </div>

        {!preview ? (
          <div
            className="flex w-60 shrink-0 flex-col gap-3.5 overflow-y-auto border-l border-hairline p-3"
            style={{ maxHeight: height }}
          >
            <span className="font-sans text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
              {text.settings}
            </span>

            {!node ? (
              <span className="text-[12.5px] leading-[1.5] text-text-secondary">
                {text.nothingSelected}
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-primary">
                  <Icon name="box" size={12} className="text-text-secondary" />
                  {node.type}
                  {breakpoint !== "desktop" ? (
                    <span className="ml-auto rounded-pill bg-mist px-1.75 py-0.5 text-[10.5px] text-text-secondary">
                      {breakpoint}
                    </span>
                  ) : null}
                </span>

                {/* Content fields, only the ones this type actually has. */}
                {["text", "title", "body", "label", "value", "cta", "placeholder", "href", "src", "alt", "author", "brand"].some(
                  (key) => key in (node.props ?? {}),
                ) ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
                      {text.content}
                    </span>

                    {Object.entries(node.props ?? {})
                      .filter(([, entry]) => typeof entry === "string")
                      .map(([key, entry]) => (
                        <label key={key} className="flex flex-col gap-1">
                          <span className="text-[12px] text-text-secondary">{key}</span>
                          {String(entry).length > 40 ? (
                            <textarea
                              value={String(entry)}
                              rows={3}
                              onChange={(event) => setProp({ [key]: event.target.value })}
                              className="resize-none rounded-md border border-border-subtle bg-surface-page px-2 py-1.5 font-sans text-[12.5px] leading-[1.45] text-text-primary outline-none focus:border-border-strong"
                            />
                          ) : (
                            <input
                              value={String(entry)}
                              onChange={(event) => setProp({ [key]: event.target.value })}
                              className="h-7 rounded-md border border-border-subtle bg-surface-page px-2 font-sans text-[12.5px] text-text-primary outline-none focus:border-border-strong"
                            />
                          )}
                        </label>
                      ))}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 border-t border-hairline pt-3">
                  <span className="text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
                    {text.style}
                  </span>
                  {STYLE_FIELDS.map((entry) => numberField(entry.label, entry.key, entry.unit))}
                </div>

                <div className="mt-auto flex gap-1.5 border-t border-hairline pt-3">
                  <button
                    type="button"
                    onClick={duplicate}
                    className="inline-flex h-7.5 flex-1 items-center justify-center gap-1.5 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[12.5px] text-text-primary hover:bg-surface-alt halo-focus"
                  >
                    <Icon name="copy" size={12} />
                    {text.duplicate}
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    aria-label={text.delete}
                    className="inline-flex size-7.5 items-center justify-center rounded-pill border border-error bg-transparent text-error halo-focus"
                  >
                    <Icon name="trash-2" size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {exported !== null ? (
        <div className="border-t border-hairline">
          <div className="flex items-center gap-2 border-b border-hairline px-3.5 py-2.5">
            <span className="mr-auto text-[13.5px] font-medium text-text-primary">{text.export}</span>
            <CopyButton value={exported} iconOnly />
            <button
              type="button"
              aria-label={text.closeExport}
              onClick={() => setExported(null)}
              className="inline-flex size-7 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:bg-surface-alt halo-focus"
            >
              <Icon name="x" size={13} />
            </button>
          </div>

          <pre className="m-0 max-h-64 overflow-auto p-3.5 font-mono text-[12px] leading-[1.55] text-text-primary">
            {exported}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
