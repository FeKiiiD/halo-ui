import * as React from "react";
import { cn } from "../../lib/cn";
import {
  canRun,
  defaultsFor,
  flowSnap,
  flowUid,
  indexTypes,
  removeFlowNodes,
  runOrder,
  validateFlow,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeType,
  type FlowParam,
  type FlowProblem,
} from "../../lib/flow";
import { normalize } from "../../lib/use-dismissable";
import { Icon, type IconName } from "../core/icon";
import { SaveButton } from "../core/save-button";
import { SearchField } from "../forms/search-field";
import { FlowCanvas, type FlowRunStep, type FlowSelection } from "./flow-canvas";
import { FLOW_CATEGORIES, type FlowCategory } from "./flow-catalog";

export interface FlowEditorProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onChange?: (next: FlowGraph) => void;
  onSave?: (next: FlowGraph) => unknown | Promise<unknown>;
  /** Runs a dry run. Resolve a per-node result to display it on the canvas. */
  onRun?: (next: FlowGraph) => Promise<Record<string, FlowRunStep>> | Record<string, FlowRunStep>;

  title?: React.ReactNode;
  subtitle?: React.ReactNode;

  catalog?: FlowCategory[];
  editable?: boolean;
  palette?: boolean;
  height?: number;

  labels?: Partial<Record<string, string>>;
  className?: string;
}

const MEDIA_TYPE = "text/halo-flow-node";

/**
 * The flow editor: palette, canvas, inspector, and a list of everything wrong
 * with the flow.
 *
 * THE PROBLEMS PANEL IS THE POINT. A flow is not a drawing — it runs — and the
 * three ways it fails all look completely fine on the canvas: nothing to start
 * it, a node nothing leads to, a condition wired on one branch only. Publishing
 * is blocked on errors and never on warnings, because "do nothing on the no
 * branch" is a real design and a tool that refuses it is a tool people work
 * around.
 */
export function FlowEditor({
  nodes,
  edges,
  onChange,
  onSave,
  onRun,
  title = "Automation",
  subtitle,
  catalog = FLOW_CATEGORIES,
  editable = true,
  palette = true,
  height = 520,
  labels,
  className,
}: FlowEditorProps) {
  const text = {
    search: "Search a step…",
    problems: "Problems",
    noProblems: "Nothing to report.",
    run: "Test run",
    running: "Running…",
    clearRun: "Back to editing",
    inspector: "Settings",
    nothingSelected: "Select a step to configure it.",
    delete: "Delete",
    dragHint: "drag onto the canvas",
    blocked: "Fix the errors before running.",
    ...labels,
  };

  const types = React.useMemo(() => indexTypes(catalog), [catalog]);

  const [selected, setSelected] = React.useState<FlowSelection>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  const [tool, setTool] = React.useState<"select" | "pan">("select");
  const [runStatus, setRunStatus] = React.useState<Record<string, FlowRunStep> | undefined>();
  const [running, setRunning] = React.useState(false);
  const surface = React.useRef<HTMLDivElement>(null);

  const graph: FlowGraph = { nodes, edges };
  const graphJson = JSON.stringify(graph);
  const [saved, setSaved] = React.useState(() => graphJson);
  const dirty = graphJson !== saved;

  const emit = (next: FlowGraph) => onChange?.(next);

  const problems = React.useMemo(() => validateFlow(graph, types), [graphJson, types]);
  const runnable = canRun(problems);

  const selectedNode =
    selected?.type === "node" ? nodes.find((node) => node.id === selected.id) : undefined;
  const selectedType = selectedNode ? types[selectedNode.type] : undefined;

  /* --- editing ----------------------------------------------------------- */

  const place = (type: string, x: number, y: number) => {
    const node: FlowNode = {
      id: flowUid("n"),
      type,
      x: flowSnap(x),
      y: flowSnap(y),
      params: defaultsFor(type, types),
    };
    emit({ nodes: [...nodes, node], edges });
    setSelected({ type: "node", id: node.id });
  };

  const patchNode = (id: string, change: Partial<FlowNode>) =>
    emit({ nodes: nodes.map((node) => (node.id === id ? { ...node, ...change } : node)), edges });

  const setParam = (id: string, key: string, value: unknown) => {
    const node = nodes.find((entry) => entry.id === id);
    if (!node) return;
    patchNode(id, { params: { ...node.params, [key]: value } });
  };

  const removeSelected = () => {
    if (!selectedNode) return;
    emit(removeFlowNodes(graph, [selectedNode.id]));
    setSelected(null);
  };

  const doSave = async () => {
    if (onSave) await onSave(graph);
    setSaved(graphJson);
  };

  const doRun = async () => {
    if (!runnable || running) return;
    setRunning(true);
    try {
      const result = onRun
        ? await onRun(graph)
        : // With no runner, show the shape of a run: every reachable node
          // succeeds. Enough to read the path, honest about being a dry run.
          Object.fromEntries(
            runOrder(graph, types).map((id) => [id, { status: "ok" as const }]),
          );
      setRunStatus(result);
    } finally {
      setRunning(false);
    }
  };

  /* --- render ------------------------------------------------------------ */

  const sectionLabel = (children: React.ReactNode) => (
    <span className="font-sans text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
      {children}
    </span>
  );

  const field = (param: FlowParam, node: FlowNode) => {
    const value = node.params?.[param.key];
    const common =
      "w-full rounded-[9px] border border-border-subtle bg-surface-page px-2.5 font-sans text-[13px] text-text-primary outline-none focus:border-border-strong placeholder:text-text-secondary";

    return (
      <label key={param.key} className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">{param.label}</span>

        {param.editor === "select" ? (
          <select
            value={String(value ?? "")}
            onChange={(event) => setParam(node.id, param.key, event.target.value)}
            className={cn(common, "h-8")}
          >
            {(param.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : param.editor === "textarea" ? (
          <textarea
            value={String(value ?? "")}
            placeholder={param.placeholder}
            onChange={(event) => setParam(node.id, param.key, event.target.value)}
            rows={3}
            className={cn(common, "resize-none py-2 leading-[1.45]")}
          />
        ) : param.editor === "number" ? (
          <input
            type="number"
            value={Number(value ?? 0)}
            onChange={(event) => setParam(node.id, param.key, Number(event.target.value))}
            className={cn(common, "h-8 tabular-nums")}
          />
        ) : (
          <input
            value={String(value ?? "")}
            placeholder={param.placeholder}
            onChange={(event) => setParam(node.id, param.key, event.target.value)}
            className={cn(common, "h-8")}
          />
        )}

        {param.help ? (
          <span className="text-[11.5px] text-text-secondary">{param.help}</span>
        ) : null}
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
      <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-3.25">
        <span className="mr-auto flex min-w-0 flex-col">
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
            {title}
          </span>
          {subtitle ? <span className="text-[12.5px] text-text-secondary">{subtitle}</span> : null}
        </span>

        <span className="text-[12.5px] tabular-nums text-text-secondary">
          {nodes.length} step{nodes.length === 1 ? "" : "s"}
        </span>

        {runStatus ? (
          <button
            type="button"
            onClick={() => setRunStatus(undefined)}
            className="inline-flex h-7.5 items-center gap-1.5 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt halo-focus"
          >
            <Icon name="pencil" size={13} />
            {text.clearRun}
          </button>
        ) : (
          <button
            type="button"
            onClick={doRun}
            disabled={!runnable || running}
            title={runnable ? undefined : text.blocked}
            className={cn(
              "inline-flex h-7.5 items-center gap-1.5 rounded-pill border px-3 font-sans text-[13px] halo-focus",
              runnable && !running
                ? "border-border-subtle bg-transparent text-text-primary hover:bg-surface-alt"
                : "cursor-not-allowed border-border-subtle bg-surface-disabled text-text-secondary",
            )}
          >
            <Icon
              name={running ? "loader" : "play"}
              size={13}
              className={running ? "animate-[halo-spin_900ms_linear_infinite]" : undefined}
            />
            {running ? text.running : text.run}
          </button>
        )}

        {editable ? (
          <SaveButton variant="primary" size="md" minWidth={150} dirty={dirty} disabled={!dirty} onSave={doSave} />
        ) : null}
      </div>

      <div className="flex items-stretch">
        {palette && editable && !runStatus ? (
          <div className="flex w-56 shrink-0 flex-col border-r border-hairline" style={{ maxHeight: height }}>
            <div className="border-b border-hairline p-2.5">
              <SearchField value={query} onChange={setQuery} size="sm" fullWidth placeholder={text.search} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {catalog.map((category) => {
                const items = category.nodes.filter(
                  (node) =>
                    !query || normalize(`${node.label} ${node.note}`).includes(normalize(query)),
                );
                if (!items.length) return null;
                const folded = collapsed.includes(category.key) && !query;

                return (
                  <div key={category.key} className="mb-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((current) =>
                          current.includes(category.key)
                            ? current.filter((entry) => entry !== category.key)
                            : [...current, category.key],
                        )
                      }
                      aria-expanded={!folded}
                      className="flex h-7.5 w-full items-center gap-2 rounded-lg border-none bg-transparent px-1 font-sans text-[12px] text-text-secondary hover:bg-surface-alt halo-focus"
                    >
                      <Icon name={category.icon as IconName} size={13} />
                      <span className="flex-1 text-left">{category.label}</span>
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
                            key={item.type}
                            type="button"
                            draggable
                            title={`${item.note} — ${text.dragHint}`}
                            onDragStart={(event) => {
                              event.dataTransfer.setData(MEDIA_TYPE, item.type);
                              event.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => place(item.type, 64, 64)}
                            className="flex w-full cursor-grab items-center gap-2.25 rounded-[10px] border-none bg-transparent px-2 py-1.75 text-left hover:bg-surface-alt halo-focus"
                          >
                            <span
                              className={cn(
                                "inline-flex size-6.5 shrink-0 items-center justify-center rounded-lg",
                                item.kind === "trigger"
                                  ? "bg-accent text-accent-ink"
                                  : "bg-surface-sunken text-text-primary",
                              )}
                            >
                              <Icon name={item.icon as IconName} size={13} strokeWidth={1.9} />
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
          ref={surface}
          onDragOver={(event) => {
            if (!editable || !event.dataTransfer.types.includes(MEDIA_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            if (!editable) return;
            event.preventDefault();
            const type = event.dataTransfer.getData(MEDIA_TYPE);
            const rect = surface.current?.getBoundingClientRect();
            if (!type || !rect) return;
            place(type, event.clientX - rect.left - 98, event.clientY - rect.top - 31);
          }}
          className="min-w-0 flex-1"
        >
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            types={types}
            onChange={emit}
            selected={selected}
            onSelect={setSelected}
            multi={picked}
            onMultiChange={setPicked}
            tool={tool}
            onToolChange={setTool}
            runStatus={runStatus}
            runPath={runStatus ? runOrder(graph, types) : undefined}
            height={height}
            editable={editable && !runStatus}
          />
        </div>

        <div
          className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-hairline p-3"
          style={{ maxHeight: height }}
        >
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.75">
              {sectionLabel(text.problems)}
              {problems.length ? (
                <span
                  className={cn(
                    "inline-flex h-4.25 items-center rounded-pill px-1.5 text-[10.5px] font-medium",
                    runnable ? "bg-warning-soft text-warning" : "bg-error-soft text-error",
                  )}
                >
                  {problems.length}
                </span>
              ) : null}
            </span>

            {problems.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary">
                <Icon name="check" size={12} className="text-success" />
                {text.noProblems}
              </span>
            ) : (
              problems.map((problem) => (
                <ProblemRow
                  key={problem.code}
                  problem={problem}
                  onFocus={() => {
                    if (problem.nodeIds.length) {
                      setPicked(problem.nodeIds);
                      setSelected({ type: "node", id: problem.nodeIds[0]! });
                    }
                  }}
                />
              ))
            )}
          </div>

          {!runStatus ? (
            <div className="flex flex-col gap-2.5 border-t border-hairline pt-3">
              {sectionLabel(text.inspector)}

              {!selectedNode ? (
                <span className="text-[12.5px] leading-[1.5] text-text-secondary">
                  {text.nothingSelected}
                </span>
              ) : (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-text-secondary">Label</span>
                    <input
                      value={selectedNode.label ?? selectedType?.label ?? ""}
                      onChange={(event) => patchNode(selectedNode.id, { label: event.target.value })}
                      className="h-8 w-full rounded-[9px] border border-border-subtle bg-surface-page px-2.5 font-sans text-[13px] text-text-primary outline-none focus:border-border-strong"
                    />
                  </label>

                  {(selectedType?.params ?? []).map((param) => field(param, selectedNode))}

                  <label className="flex items-center gap-2 text-[12.5px] text-text-primary">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedNode.disabled)}
                      onChange={(event) =>
                        patchNode(selectedNode.id, { disabled: event.target.checked })
                      }
                      className="accent-text-primary"
                    />
                    Skip this step
                  </label>

                  <button
                    type="button"
                    onClick={removeSelected}
                    className="mt-1 inline-flex h-7.5 items-center justify-center gap-1.5 rounded-pill border border-error bg-transparent px-3 font-sans text-[12.5px] text-error halo-focus"
                  >
                    <Icon name="trash-2" size={12} />
                    {text.delete}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {editable ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-4 py-2.25 text-[12.5px] text-text-secondary">
          <span>
            Drag from a step's right edge to wire it · the upper port is success, the lower one
            failure · V select, H or space to pan · ⌘D duplicate · Del to remove
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** One line in the problems list. Clicking it selects what it points at. */
function ProblemRow({ problem, onFocus }: { problem: FlowProblem; onFocus: () => void }) {
  const isError = problem.level === "error";

  return (
    <button
      type="button"
      onClick={onFocus}
      disabled={!problem.nodeIds.length}
      className={cn(
        "flex items-start gap-1.75 rounded-lg border-none bg-transparent px-1 py-1 text-left font-sans text-[12.5px] leading-[1.4] halo-focus",
        problem.nodeIds.length && "hover:bg-surface-alt",
        isError ? "text-error" : "text-warning",
      )}
    >
      <Icon
        name={isError ? "circle-alert" : "triangle-alert"}
        size={12}
        className="mt-0.5 shrink-0"
      />
      <span className="min-w-0 flex-1">{problem.message}</span>
    </button>
  );
}
