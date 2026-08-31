import * as React from "react";
import { cn } from "../../lib/cn";
import { normalize } from "../../lib/use-dismissable";
import { Icon } from "../core/icon";
import { SearchField } from "../forms/search-field";

export interface JsonViewerProps {
  value: unknown;
  /** Levels expanded on first render. */
  defaultDepth?: number;
  search?: boolean;
  /** Adds a raw/tree toggle. */
  raw?: boolean;
  copy?: boolean;
  maxHeight?: number | string;
  /** Fired with a dotted path when a key is copied. */
  onCopyPath?: (path: string) => void;
  emptyLabel?: string;
  className?: string;
}

type JsonType = "string" | "number" | "boolean" | "null" | "array" | "object" | "undefined";

const typeOf = (value: unknown): JsonType =>
  value === null ? "null" : Array.isArray(value) ? "array" : (typeof value as JsonType);

const isBranch = (value: unknown): value is object => Boolean(value) && typeof value === "object";

/**
 * Colour by type, from the chart palette rather than the semantic one — these
 * are categories, not statuses. Booleans borrow the warning colour because they
 * are the values people scan for.
 */
const typeColours: Partial<Record<JsonType, string>> = {
  string: "text-[var(--chart-2)]",
  number: "text-[var(--chart-3)]",
  boolean: "text-warning",
  null: "text-text-secondary",
};

/** Highlights the matched run inside a token without breaking its colour. */
function Mark({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const index = normalize(text).indexOf(normalize(query));
  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-[3px] bg-accent px-px text-accent-ink">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

function summarise(value: object): string {
  return Array.isArray(value)
    ? `[${value.length} item${value.length === 1 ? "" : "s"}]`
    : `{${Object.keys(value).length} key${Object.keys(value).length === 1 ? "" : "s"}}`;
}

function JsonNode({
  name,
  value,
  path,
  depth,
  expanded,
  onToggle,
  query,
  onCopyPath,
  isIndex,
}: {
  name?: string;
  value: unknown;
  path: string;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  query: string;
  onCopyPath?: (path: string) => void;
  isIndex?: boolean;
}) {
  const type = typeOf(value);
  const branch = isBranch(value);
  const open = branch && expanded.has(path);

  const matches =
    query &&
    (normalize(String(name ?? "")).includes(normalize(query)) ||
      (!branch && normalize(String(value)).includes(normalize(query))));

  const entries = branch
    ? Array.isArray(value)
      ? value.map((entry, index) => [String(index), entry] as const)
      : Object.entries(value as Record<string, unknown>)
    : [];

  return (
    <div>
      <div
        className={cn(
          "group flex items-baseline gap-1.5 rounded px-1 py-0.5 hover:bg-surface-alt",
          matches && "bg-[rgb(217_248_79/0.16)]",
        )}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        {branch ? (
          <button
            type="button"
            onClick={() => onToggle(path)}
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded border-none bg-transparent text-text-secondary halo-focus"
          >
            <Icon
              name="chevron-right"
              size={13}
              className={cn("transition-transform duration-[140ms] ease-out", open && "rotate-90")}
            />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}

        <span className="inline-flex min-w-0 items-baseline gap-1.5">
          {name !== undefined ? (
            <span className="font-medium text-text-primary">
              <Mark text={isIndex ? name : `"${name}"`} query={query} />
              <span className="text-text-secondary">:</span>
            </span>
          ) : null}

          {branch ? (
            <span className="text-text-secondary">
              {open ? (Array.isArray(value) ? "[" : "{") : summarise(value)}
            </span>
          ) : (
            <span className={cn("break-words", typeColours[type] ?? "text-text-primary")}>
              {type === "string" ? (
                <>
                  &quot;
                  <Mark text={String(value)} query={query} />
                  &quot;
                </>
              ) : (
                <Mark text={String(value)} query={query} />
              )}
            </span>
          )}
        </span>

        {onCopyPath ? (
          <button
            type="button"
            onClick={() => onCopyPath(path)}
            aria-label={`Copy path ${path}`}
            // Revealed on hover and on focus: a row of always-visible copy
            // buttons turns a payload into a wall of icons.
            className="ml-auto inline-flex shrink-0 cursor-pointer border-none bg-transparent p-0.5 text-text-secondary opacity-0 transition-opacity duration-[140ms] group-hover:opacity-100 focus-visible:opacity-100 halo-focus"
          >
            <Icon name="copy" size={12} />
          </button>
        ) : null}
      </div>

      {open ? (
        <>
          {entries.map(([key, entry]) => (
            <JsonNode
              key={key}
              name={key}
              value={entry}
              path={path ? `${path}.${key}` : key}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              query={query}
              onCopyPath={onCopyPath}
              isIndex={Array.isArray(value)}
            />
          ))}
          <div className="text-text-secondary" style={{ paddingLeft: (depth + 1) * 14 + 4 }}>
            {Array.isArray(value) ? "]" : "}"}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * A JSON payload made readable: a collapsible tree, colour by type, search,
 * and a raw view.
 *
 * SEARCH HIGHLIGHTS RATHER THAN FILTERS. Removing non-matching rows destroys
 * the structure that makes the match meaningful — a value is only useful when
 * you can see the key path it sits under.
 */
export function JsonViewer({
  value,
  defaultDepth = 1,
  search = true,
  raw = true,
  copy = true,
  maxHeight = 420,
  onCopyPath,
  emptyLabel = "Nothing to show",
  className,
}: JsonViewerProps) {
  const [query, setQuery] = React.useState("");
  const [showRaw, setShowRaw] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Seeded from the value so the first `defaultDepth` levels start open.
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const paths = new Set<string>();

    const walk = (node: unknown, path: string, depth: number) => {
      if (!isBranch(node) || depth > defaultDepth) return;
      paths.add(path);

      const entries = Array.isArray(node)
        ? node.map((entry, index) => [String(index), entry] as const)
        : Object.entries(node as Record<string, unknown>);

      for (const [key, entry] of entries) {
        walk(entry, path ? `${path}.${key}` : key, depth + 1);
      }
    };

    walk(value, "", 0);
    return paths;
  });

  const toggle = (path: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const serialised = React.useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      // Circular references and BigInt both throw; showing the reason beats
      // an empty panel.
      return "// This value cannot be serialised as JSON.";
    }
  }, [value]);

  const hasContent = value !== undefined && value !== null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-panel border border-border-subtle bg-surface-card font-mono text-[13px]",
        className,
      )}
    >
      {search || raw || copy ? (
        <div className="flex items-center gap-2 border-b border-hairline bg-surface-alt px-2.5 py-2 font-sans">
          {search ? (
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search keys and values…"
              size="sm"
              className="h-8 flex-1"
            />
          ) : (
            <span className="flex-1" />
          )}

          {raw ? (
            <button
              type="button"
              onClick={() => setShowRaw((current) => !current)}
              aria-pressed={showRaw}
              className={cn(
                "inline-flex h-8 items-center rounded-lg border border-border-subtle px-2.5 text-[12.5px] halo-focus",
                showRaw ? "bg-surface-card text-text-primary" : "bg-transparent text-text-secondary",
              )}
            >
              Raw
            </button>
          ) : null}

          {copy ? (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(serialised);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              aria-label="Copy JSON"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-border-subtle bg-transparent text-text-secondary hover:text-text-primary halo-focus"
            >
              <Icon name={copied ? "check" : "copy"} size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-auto p-2" style={{ maxHeight }}>
        {!hasContent ? (
          <div className="px-2 py-6 text-center font-sans text-body-s text-text-secondary">
            {emptyLabel}
          </div>
        ) : showRaw ? (
          <pre className="m-0 whitespace-pre-wrap break-words text-text-primary">{serialised}</pre>
        ) : (
          <JsonNode
            value={value}
            path=""
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            query={query}
            onCopyPath={onCopyPath}
          />
        )}
      </div>
    </div>
  );
}
