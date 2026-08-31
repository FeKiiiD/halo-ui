import * as React from "react";
import { cn } from "../../lib/cn";
import type { FlowEdge, FlowNode, FlowNodeType } from "../../lib/flow";
import { Icon, type IconName } from "../core/icon";
import { JsonViewer } from "../data/json-viewer";
import { FlowCanvas, type FlowRunStep } from "./flow-canvas";

export type ExecutionStatus = "ok" | "error" | "running" | "waiting";
export type StepStatus = "ok" | "error" | "running" | "skipped";

export interface ExecutionStep {
  nodeId: string;
  status: StepStatus;
  /** Duration in ms. */
  ms?: number;
  /** How many records the step handled. */
  items?: number;
  error?: string;
  /** What went in and what came out, for the data view. */
  input?: unknown;
  output?: unknown;
}

export interface Execution {
  id: string;
  /** ISO timestamp. */
  at: string;
  status: ExecutionStatus;
  /** What set it off — a customer, a schedule, a webhook. */
  trigger?: string;
  ms?: number;
  steps: ExecutionStep[];
}

export interface FlowExecutionsProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  types: Record<string, FlowNodeType>;

  executions: Execution[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onRetry?: (execution: Execution) => void;

  height?: number;
  formatAgo?: (iso: string) => string;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

const runTone: Record<ExecutionStatus, { label: string; icon: IconName; text: string; dot: string }> = {
  ok: { label: "Succeeded", icon: "check", text: "text-success", dot: "bg-success" },
  error: { label: "Failed", icon: "triangle-alert", text: "text-error", dot: "bg-error" },
  running: { label: "Running", icon: "loader", text: "text-accent-deep", dot: "bg-accent-deep" },
  waiting: { label: "Waiting", icon: "hourglass", text: "text-warning", dot: "bg-warning" },
};

const stepTone: Record<StepStatus, { label: string; icon: IconName; text: string }> = {
  ok: { label: "Succeeded", icon: "check", text: "text-success" },
  error: { label: "Failed", icon: "x", text: "text-error" },
  running: { label: "Running", icon: "loader", text: "text-accent-deep" },
  skipped: { label: "Not run", icon: "minus", text: "text-text-secondary" },
};

const defaultAgo = (iso: string) => {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86_400)} d ago`;
};

const duration = (ms?: number) =>
  ms == null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

/**
 * Execution history: the run list, and the chosen run shown three ways.
 *
 * IT OPENS ON THE FAILURE. When a run went wrong, the failing step is what
 * somebody came here for — not the first step, not the last. Selecting the
 * beginning and making them hunt is the difference between a log that answers
 * the question and one that merely contains the answer.
 *
 * The canvas view marks each node with its outcome; the log lists the steps in
 * order; the data view shows what actually passed through the step in hand,
 * which is the only view that says *why* it failed rather than *that* it did.
 */
export function FlowExecutions({
  nodes,
  edges,
  types,
  executions,
  selectedId,
  onSelect,
  onRetry,
  height = 420,
  formatAgo = defaultAgo,
  labels,
  className,
}: FlowExecutionsProps) {
  const text = {
    title: "Runs",
    all: "All",
    failed: "Failed",
    succeeded: "Succeeded",
    canvas: "Canvas",
    log: "Log",
    data: "Data",
    retry: "Run again",
    empty: "No runs yet.",
    noneMatch: "No run matches this filter.",
    input: "Input",
    output: "Output",
    noData: "This step recorded no data.",
    items: "records",
    ...labels,
  };

  const [picked, setPicked] = React.useState<string | undefined>(
    selectedId ?? executions[0]?.id,
  );
  const [view, setView] = React.useState<"canvas" | "log" | "data">("canvas");
  const [filter, setFilter] = React.useState<"all" | "error" | "ok">("all");
  const [stepId, setStepId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedId) setPicked(selectedId);
  }, [selectedId]);

  const shown = executions.filter((entry) => filter === "all" || entry.status === filter);
  const run = executions.find((entry) => entry.id === picked) ?? executions[0];
  const steps = run?.steps ?? [];

  const failing = steps.find((step) => step.status === "error");

  // The failing step, or the last one that ran. Never the first: nobody opens
  // a run history to look at the trigger.
  const current = stepId
    ? steps.find((step) => step.nodeId === stepId)
    : (failing ?? steps[steps.length - 1]);

  // A new run resets the manual step selection, so the next failure is what
  // opens rather than whatever was being read a moment ago.
  React.useEffect(() => setStepId(null), [picked]);

  const runStatus = React.useMemo(
    () =>
      Object.fromEntries(
        steps.map((step) => [
          step.nodeId,
          {
            status: step.status,
            detail:
              step.error ??
              [duration(step.ms), step.items != null ? `${step.items} ${text.items}` : null]
                .filter(Boolean)
                .join(" · "),
          } satisfies FlowRunStep,
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps],
  );

  const runPath = React.useMemo(() => steps.map((step) => step.nodeId), [steps]);

  const nameOf = (nodeId: string) => {
    const node = nodes.find((entry) => entry.id === nodeId);
    if (!node) return nodeId;
    return node.label ?? types[node.type]?.label ?? nodeId;
  };

  const failedCount = executions.filter((entry) => entry.status === "error").length;

  const tab = (key: "canvas" | "log" | "data", label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setView(key)}
      aria-pressed={view === key}
      className={cn(
        "h-7 rounded-pill border-none px-2.75 font-sans text-[12.5px] halo-focus",
        "transition-colors duration-[140ms] ease-standard",
        view === key
          ? "bg-text-primary font-medium text-surface-page"
          : "bg-transparent font-normal text-text-primary hover:bg-surface-alt",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn("border-t border-hairline font-sans", className)}>
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3">
        <span className="mr-auto flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
            {text.title}
          </span>
          <span className="text-[12.5px] tabular-nums text-text-secondary">
            {failedCount} failed of {executions.length}
          </span>
        </span>

        <span className="inline-flex gap-0.5 rounded-pill border border-border-subtle bg-surface-alt p-0.5">
          {(
            [
              ["all", text.all],
              ["error", text.failed],
              ["ok", text.succeeded],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "h-6.5 rounded-pill border-none px-2.5 font-sans text-[12.5px] halo-focus",
                "transition-colors duration-[140ms] ease-standard",
                filter === key
                  ? "bg-text-primary text-surface-page"
                  : "bg-transparent text-text-primary",
              )}
            >
              {label}
            </button>
          ))}
        </span>

        <span className="inline-flex gap-1 rounded-pill bg-mist p-0.75">
          {tab("canvas", text.canvas!)}
          {tab("log", text.log!)}
          {tab("data", text.data!)}
        </span>

        {onRetry && run ? (
          <button
            type="button"
            onClick={() => onRetry(run)}
            className="inline-flex h-7.5 items-center gap-1.5 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13px] text-text-primary hover:bg-surface-alt halo-focus"
          >
            <Icon name="rotate-ccw" size={13} />
            {text.retry}
          </button>
        ) : null}
      </div>

      <div className="flex items-stretch border-t border-hairline">
        <div className="w-64 shrink-0 overflow-y-auto border-r border-hairline" style={{ maxHeight: height }}>
          {executions.length === 0 ? (
            <div className="px-3.5 py-6 text-center text-body-s text-text-secondary">
              {text.empty}
            </div>
          ) : shown.length === 0 ? (
            <div className="px-3.5 py-6 text-center text-body-s text-text-secondary">
              {text.noneMatch}
            </div>
          ) : (
            shown.map((entry) => {
              const tone = runTone[entry.status];
              const active = entry.id === run?.id;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setPicked(entry.id);
                    onSelect?.(entry.id);
                  }}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-b border-l-2 border-hairline px-3.5 py-2.5 text-left halo-focus",
                    "transition-colors duration-[140ms] ease-standard",
                    active
                      ? "border-l-ink bg-mist"
                      : "border-l-transparent bg-transparent hover:bg-surface-alt",
                  )}
                >
                  <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} />

                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] text-text-primary">
                      {entry.trigger ?? tone.label}
                    </span>
                    <span className="truncate text-[11.5px] text-text-secondary">
                      {formatAgo(entry.at)}
                    </span>
                  </span>

                  <span className="shrink-0 text-[11.5px] tabular-nums text-text-secondary">
                    {duration(entry.ms)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="min-w-0 flex-1">
          {!run ? (
            <div className="flex items-center justify-center text-body-s text-text-secondary" style={{ height }}>
              {text.empty}
            </div>
          ) : view === "canvas" ? (
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              types={types}
              runStatus={runStatus}
              runPath={runPath}
              height={height}
              editable={false}
              selected={current ? { type: "node", id: current.nodeId } : null}
              onSelect={(selection) => selection?.type === "node" && setStepId(selection.id)}
            />
          ) : view === "log" ? (
            <div className="overflow-y-auto" style={{ maxHeight: height }}>
              {steps.map((step, index) => {
                const tone = stepTone[step.status];
                const active = current?.nodeId === step.nodeId;

                return (
                  <button
                    key={`${step.nodeId}-${index}`}
                    type="button"
                    onClick={() => setStepId(step.nodeId)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-b border-hairline px-3.5 py-2.5 text-left halo-focus",
                      "transition-colors duration-[140ms] ease-standard",
                      active ? "bg-mist" : "bg-transparent hover:bg-surface-alt",
                    )}
                  >
                    <span className="w-5 shrink-0 text-[11.5px] tabular-nums text-text-secondary">
                      {index + 1}
                    </span>

                    <span className={cn("inline-flex shrink-0", tone.text)}>
                      <Icon
                        name={tone.icon}
                        size={14}
                        className={
                          step.status === "running"
                            ? "animate-[halo-spin_900ms_linear_infinite]"
                            : undefined
                        }
                      />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] text-text-primary">
                        {nameOf(step.nodeId)}
                      </span>
                      {step.error ? (
                        <span className="truncate text-[11.5px] text-error">{step.error}</span>
                      ) : step.items != null ? (
                        <span className="truncate text-[11.5px] text-text-secondary">
                          {step.items} {text.items}
                        </span>
                      ) : null}
                    </span>

                    <span className="shrink-0 text-[11.5px] tabular-nums text-text-secondary">
                      {duration(step.ms)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto p-3.5" style={{ maxHeight: height }}>
              {!current ? (
                <span className="text-body-s text-text-secondary">{text.noData}</span>
              ) : (
                <>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-text-primary">
                      {nameOf(current.nodeId)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[12px]",
                        stepTone[current.status].text,
                      )}
                    >
                      <Icon name={stepTone[current.status].icon} size={11} />
                      {stepTone[current.status].label}
                    </span>
                    <span className="ml-auto text-[12px] tabular-nums text-text-secondary">
                      {duration(current.ms)}
                    </span>
                  </span>

                  {current.error ? (
                    <span className="rounded-panel border border-error bg-error-soft px-3 py-2 text-[12.5px] text-error">
                      {current.error}
                    </span>
                  ) : null}

                  {current.input === undefined && current.output === undefined ? (
                    <span className="text-body-s text-text-secondary">{text.noData}</span>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {current.input !== undefined ? (
                        <span className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
                            {text.input}
                          </span>
                          <JsonViewer value={current.input} />
                        </span>
                      ) : null}
                      {current.output !== undefined ? (
                        <span className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] uppercase tracking-[0.06em] text-text-secondary">
                            {text.output}
                          </span>
                          <JsonViewer value={current.output} />
                        </span>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
