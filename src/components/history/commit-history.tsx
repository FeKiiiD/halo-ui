import * as React from "react";
import { cn } from "../../lib/cn";
import { normalize } from "../../lib/use-dismissable";
import { Icon, type IconName } from "../core/icon";
import { SearchField } from "../forms/search-field";
import { Select } from "../forms/select";
import { MatrixAvatar } from "../matrix/matrix-frame";
import { Drawer } from "../overlay/drawer";

export interface CommitChange {
  name: string;
  status?: "added" | "removed" | "changed";
  added?: number;
  removed?: number;
}

export interface Commit {
  id?: string;
  title: string;
  message?: string;
  sha?: string;

  author?: string;
  avatar?: string;
  time?: string;
  branch?: string;

  /** Column this commit sits in. 0 is the trunk. */
  lane?: number;
  /** Lane this one branched off. Draws a leg down to it. */
  branchFrom?: number;
  /** Lane merged into this one. Draws a leg up from it. */
  mergeFrom?: number;

  /** The tip of its branch: drawn as a ring rather than a dot. */
  head?: boolean;
  tag?: string;

  files?: number;
  added?: number;
  removed?: number;
  changes?: CommitChange[];
}

export interface CommitHistoryProps {
  commits: Commit[];
  title?: React.ReactNode;

  rowHeight?: number;
  laneGap?: number;
  laneOrigin?: number;

  onSelect?: (commit: Commit) => void;
  onCompare?: (a: Commit, b: Commit) => void;
  onRestore?: (commit: Commit) => void;

  /** Fades commits not on `activeBranch`. */
  dimUnrelated?: boolean;
  activeBranch?: string;

  searchable?: boolean;
  filterable?: boolean;
  detail?: boolean;

  labels?: {
    search?: string;
    allBranches?: string;
    allAuthors?: string;
    empty?: string;
    emptyHint?: string;
    copySha?: string;
    copied?: string;
    compare?: string;
    cancel?: string;
    pickSecond?: string;
    restore?: string;
    files?: string;
    additions?: string;
    deletions?: string;
    changed?: string;
    of?: (shown: number, total: number) => string;
    fileCount?: (count: number) => string;
  };
  className?: string;
}

/** Trunk first, then one per branch. */
const laneColors = [
  "var(--color-action-secondary-bg)",
  "var(--color-info)",
  "var(--color-warning)",
  "var(--color-error)",
  "var(--color-success)",
];

const laneColor = (lane: number) => laneColors[lane % laneColors.length];

const statusIcon = (status?: CommitChange["status"]): IconName =>
  status === "added" ? "file-plus" : status === "removed" ? "file-minus" : "file-text";

/**
 * History as a lane graph: the trunk in ink, each side branch in its own
 * colour, one row per commit.
 *
 * THE ROW IS THE TARGET, NOT THE DOT. A 8px circle is not a click target, and
 * the thing people want to open is the commit, not its node — so the whole row
 * hovers and opens, and the graph is drawn behind it in an SVG that takes no
 * pointer events at all.
 *
 * Two commits can be ticked for comparison. Picking a third replaces the older
 * of the two rather than refusing: nobody means "compare three".
 */
export function CommitHistory({
  commits,
  title = "History",
  rowHeight = 42,
  laneGap = 18,
  laneOrigin = 16,
  onSelect,
  onCompare,
  onRestore,
  dimUnrelated = true,
  activeBranch,
  searchable = true,
  filterable = true,
  detail = true,
  labels,
  className,
}: CommitHistoryProps) {
  const text = {
    search: "Message, author, sha…",
    allBranches: "All branches",
    allAuthors: "All authors",
    empty: "No commit matches.",
    emptyHint: "Widen the search or drop a filter.",
    copySha: "Copy the sha",
    copied: "Copied",
    compare: "Compare",
    cancel: "Cancel",
    pickSecond: "Pick a second commit to compare.",
    restore: "Restore this version",
    files: "Files",
    additions: "Additions",
    deletions: "Deletions",
    changed: "Changed files",
    of: (shown: number, total: number) => `${shown} of ${total}`,
    fileCount: (count: number) => `${count} file${count === 1 ? "" : "s"} changed`,
    ...labels,
  };

  const [hover, setHover] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState("");
  const [author, setAuthor] = React.useState("");
  // Not seeded from activeBranch: that prop means "highlight this branch",
  // and seeding the filter with it hid every other branch, so the lane graph
  // had nothing left to draw. Dimming and filtering are different questions.
  const [branch, setBranch] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);

  const keyOf = (commit: Commit) => commit.id ?? commit.title;

  const authors = [...new Set(commits.map((commit) => commit.author).filter(Boolean))] as string[];
  const branches = [...new Set(commits.map((commit) => commit.branch).filter(Boolean))] as string[];

  const shown = commits.filter((commit) => {
    if (author && commit.author !== author) return false;
    if (branch && commit.branch !== branch) return false;
    if (!query) return true;

    const needle = normalize(query);
    return normalize(
      [commit.title, commit.message, commit.author, commit.sha].filter(Boolean).join(" "),
    ).includes(needle);
  });

  const laneX = (lane: number) => laneOrigin + lane * laneGap;
  const rowY = (index: number) => index * rowHeight + rowHeight / 2;
  const graphHeight = shown.length * rowHeight;

  // One vertical run per lane, from its first visible commit to its last.
  const segments = React.useMemo(() => {
    const rowsByLane = new Map<number, number[]>();
    shown.forEach((commit, index) => {
      const lane = commit.lane ?? 0;
      const rows = rowsByLane.get(lane) ?? [];
      rows.push(index);
      rowsByLane.set(lane, rows);
    });

    return [...rowsByLane].map(([lane, rows]) => ({
      lane,
      from: rows[0]!,
      to: rows[rows.length - 1]!,
    }));
  }, [shown]);

  const hovered = hover !== null ? shown[hover] : undefined;
  const open = commits.find((commit) => keyOf(commit) === openId);
  const pickedCommits = picked
    .map((id) => commits.find((commit) => keyOf(commit) === id))
    .filter((commit): commit is Commit => Boolean(commit));

  const togglePick = (id: string) =>
    setPicked((current) =>
      // slice(-1) keeps the newest of the two: picking a third drops the
      // oldest rather than refusing the click.
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current.slice(-1), id],
    );

  const copy = (sha: string) => {
    void navigator.clipboard?.writeText(sha).catch(() => undefined);
    setCopied(sha);
    setTimeout(() => setCopied((current) => (current === sha ? null : current)), 1200);
  };

  const rowButton = (icon: IconName, label: string, action: () => void, on?: boolean) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        action();
      }}
      className={cn(
        "inline-flex size-6.5 shrink-0 items-center justify-center rounded-lg border-none bg-transparent halo-focus",
        on ? "text-text-primary" : "text-text-secondary",
      )}
    >
      <Icon name={icon} size={14} />
    </button>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      {title || searchable || filterable ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3.5">
          {title ? (
            <span className="mr-auto inline-flex items-baseline gap-2">
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
                {title}
              </span>
              <span className="text-[13px] tabular-nums text-text-secondary">
                {text.of(shown.length, commits.length)}
              </span>
            </span>
          ) : null}

          {searchable ? (
            <SearchField value={query} onChange={setQuery} size="sm" placeholder={text.search} />
          ) : null}

          {filterable && branches.length ? (
            <Select
              bare
              size="sm"
              value={branch}
              onChange={setBranch}
              options={[
                { value: "", label: text.allBranches },
                ...branches.map((entry) => ({ value: entry, label: entry })),
              ]}
            />
          ) : null}

          {filterable && authors.length ? (
            <Select
              bare
              size="sm"
              value={author}
              onChange={setAuthor}
              options={[
                { value: "", label: text.allAuthors },
                ...authors.map((entry) => ({ value: entry, label: entry })),
              ]}
            />
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        {/* The graph. pointer-events-none throughout: the rows above own every
            interaction, so a lane can never swallow a click. */}
        <svg
          width="100%"
          height={graphHeight}
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          {segments.map((segment) => (
            <line
              key={`lane-${segment.lane}`}
              x1={laneX(segment.lane)}
              x2={laneX(segment.lane)}
              y1={rowY(segment.from)}
              y2={rowY(segment.to)}
              stroke={laneColor(segment.lane)}
              strokeWidth="1.5"
              opacity={segment.lane === 0 ? 0.9 : 0.55}
            />
          ))}

          {shown.flatMap((commit, index) => {
            const lane = commit.lane ?? 0;
            const legs: [number, "down" | "up"][] = [];

            if (commit.branchFrom != null && commit.branchFrom !== lane) {
              legs.push([commit.branchFrom, "down"]);
            }
            if (commit.mergeFrom != null && commit.mergeFrom !== lane) {
              legs.push([commit.mergeFrom, "up"]);
            }

            return legs.map(([other, direction], leg) => {
              const x1 = laneX(other);
              const x2 = laneX(lane);
              const y = rowY(index);
              const dy = direction === "down" ? rowHeight * 0.9 : -rowHeight * 0.9;

              return (
                <path
                  key={`leg-${index}-${leg}`}
                  d={`M ${x1} ${y + dy} C ${x1} ${y + dy / 2}, ${x2} ${y + dy / 2}, ${x2} ${y}`}
                  fill="none"
                  stroke={laneColor(direction === "down" ? lane : other)}
                  strokeWidth="1.5"
                  opacity="0.55"
                />
              );
            });
          })}
        </svg>

        <div className="relative">
          {shown.length ? (
            shown.map((commit, index) => {
              const lane = commit.lane ?? 0;
              const id = keyOf(commit);
              const dimmed = Boolean(
                dimUnrelated && activeBranch && commit.branch && commit.branch !== activeBranch,
              );
              const on = hover === index;
              const isPicked = picked.includes(id);

              return (
                <div
                  key={id}
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover((current) => (current === index ? null : current))}
                  onClick={() => {
                    if (detail) setOpenId(id);
                    onSelect?.(commit);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center pr-2.5",
                    "transition-colors duration-[140ms] ease-standard",
                    isPicked ? "bg-mist" : on ? "bg-surface-alt" : "bg-transparent",
                  )}
                  style={{ height: rowHeight, paddingLeft: laneX(lane) + 18 }}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute box-border rounded-full",
                      commit.head ? "border-[2.5px] bg-surface-card" : "border-none",
                    )}
                    style={{
                      left: laneX(lane) - (commit.head ? 6 : 4),
                      width: commit.head ? 12 : 8,
                      height: commit.head ? 12 : 8,
                      background: commit.head ? undefined : laneColor(lane),
                      borderColor: commit.head ? laneColor(lane) : undefined,
                      opacity: dimmed ? 0.4 : 1,
                    }}
                  />

                  <span
                    className={cn(
                      "truncate text-[14.5px]",
                      commit.head ? "font-medium" : "font-normal",
                      dimmed ? "text-text-secondary opacity-75" : "text-text-primary",
                    )}
                  >
                    {commit.title}
                  </span>

                  {commit.tag ? (
                    <span className="ml-2 inline-flex h-5 shrink-0 items-center rounded-pill bg-accent px-2 text-[11.5px] font-medium text-accent-ink">
                      {commit.tag}
                    </span>
                  ) : null}

                  <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 pl-2.5">
                    {commit.author ? (
                      <MatrixAvatar name={commit.author} src={commit.avatar} size={20} />
                    ) : null}

                    {commit.sha ? (
                      <span className="pl-1.5 text-[12.5px] tabular-nums text-text-secondary">
                        {commit.sha}
                      </span>
                    ) : null}

                    <span
                      className={cn(
                        "inline-flex transition-opacity duration-[140ms] ease-standard",
                        on || isPicked ? "opacity-100" : "opacity-0",
                      )}
                    >
                      {commit.sha
                        ? rowButton(
                            copied === commit.sha ? "check" : "copy",
                            text.copySha,
                            () => copy(commit.sha!),
                          )
                        : null}
                      {rowButton(
                        isPicked ? "square-check" : "square",
                        text.compare,
                        () => togglePick(id),
                        isPicked,
                      )}
                    </span>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col gap-1 px-5 py-7">
              <strong className="text-[15px] font-semibold text-text-primary">{text.empty}</strong>
              <span className="text-[13.5px] text-text-secondary">{text.emptyHint}</span>
            </div>
          )}

          {hovered && !open ? (
            <div
              role="tooltip"
              className="absolute z-20 w-[316px] overflow-hidden rounded-panel border border-border-subtle bg-surface-card shadow-float"
              style={{
                left: Math.min(laneX(hovered.lane ?? 0) + 60, 200),
                top: Math.max(4, rowY(hover!) - 30),
                pointerEvents: "none",
              }}
            >
              <div className="flex flex-col gap-2 px-3.5 py-3">
                <span className="flex items-center gap-2.25">
                  <MatrixAvatar name={hovered.author} src={hovered.avatar} size={26} />
                  <strong className="text-[14.5px] font-semibold text-text-primary">
                    {hovered.author}
                  </strong>
                  <span className="text-[13px] text-text-secondary">{hovered.time}</span>
                </span>
                <span className="text-pretty text-[14px] leading-[1.45] text-text-secondary">
                  {hovered.message ?? hovered.title}
                </span>
              </div>

              {hovered.files != null || hovered.added != null ? (
                <div className="flex items-center gap-2.5 border-t border-hairline px-3.5 py-2.5">
                  {hovered.files != null ? (
                    <span className="text-[13px] text-text-secondary">
                      {text.fileCount(hovered.files)}
                    </span>
                  ) : null}
                  {hovered.added != null ? (
                    <span className="text-[13px] font-medium tabular-nums text-success">
                      +{hovered.added}
                    </span>
                  ) : null}
                  {hovered.removed != null ? (
                    <span className="text-[13px] font-medium tabular-nums text-error">
                      −{hovered.removed}
                    </span>
                  ) : null}
                  <span className="ml-auto inline-flex text-text-primary">
                    <Icon name="arrow-right" size={16} />
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {pickedCommits.length ? (
        <div className="flex items-center gap-2.5 border-t border-hairline bg-surface-alt py-2.5 pl-4 pr-3">
          <span className="min-w-0 truncate text-[13.5px] text-text-primary">
            {pickedCommits.length === 2
              ? `${pickedCommits[0]!.title}  ↔  ${pickedCommits[1]!.title}`
              : text.pickSecond}
          </span>

          <span className="ml-auto inline-flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setPicked([])}
              className="h-8 rounded-pill border border-border-subtle bg-transparent px-3 font-sans text-[13.5px] text-text-primary hover:bg-surface-card halo-focus"
            >
              {text.cancel}
            </button>

            <button
              type="button"
              disabled={pickedCommits.length < 2}
              onClick={() => onCompare?.(pickedCommits[0]!, pickedCommits[1]!)}
              className={cn(
                "h-8 rounded-pill border-none px-3.5 font-sans text-[13.5px] font-medium halo-focus",
                pickedCommits.length < 2
                  ? "cursor-not-allowed bg-surface-disabled text-text-secondary"
                  : "bg-accent text-accent-ink",
              )}
            >
              {text.compare}
            </button>
          </span>
        </div>
      ) : null}

      {detail ? (
        <Drawer
          open={Boolean(open)}
          onClose={() => setOpenId(null)}
          width={460}
          icon="git-commit-horizontal"
          title={open?.title ?? ""}
          subtitle={
            open ? [open.author, open.time, open.branch].filter(Boolean).join(" · ") : ""
          }
          footer={
            open ? (
              <>
                {open.sha ? (
                  <button
                    type="button"
                    onClick={() => copy(open.sha!)}
                    className="h-10 rounded-pill border border-border-subtle bg-transparent px-4 font-sans text-[15px] text-text-primary hover:bg-surface-alt halo-focus"
                  >
                    {copied === open.sha ? text.copied : text.copySha}
                  </button>
                ) : null}

                {onRestore ? (
                  <button
                    type="button"
                    onClick={() => {
                      onRestore(open);
                      setOpenId(null);
                    }}
                    className="h-10 rounded-pill border-none bg-accent px-4.5 font-sans text-[15px] font-medium text-accent-ink halo-focus"
                  >
                    {text.restore}
                  </button>
                ) : null}
              </>
            ) : null
          }
        >
          {open ? (
            <div className="flex flex-col gap-4 font-sans">
              <span className="flex items-center gap-2.5">
                <MatrixAvatar name={open.author} src={open.avatar} size={34} />
                <span className="flex flex-col">
                  <strong className="text-[15px] font-semibold text-text-primary">
                    {open.author}
                  </strong>
                  <span className="text-[13px] text-text-secondary">
                    {open.time}
                    {open.sha ? ` · ${open.sha}` : ""}
                  </span>
                </span>
                {open.tag ? (
                  <span className="ml-auto inline-flex h-5.5 items-center rounded-pill bg-accent px-2.25 text-[12px] font-medium text-accent-ink">
                    {open.tag}
                  </span>
                ) : null}
              </span>

              {open.message ? (
                <span className="text-pretty text-[14.5px] leading-[1.5] text-text-primary">
                  {open.message}
                </span>
              ) : null}

              <span className="flex flex-wrap gap-2">
                {(
                  [
                    [text.files, open.files, "text-text-primary"],
                    [text.additions, open.added != null ? `+${open.added}` : null, "text-success"],
                    [text.deletions, open.removed != null ? `−${open.removed}` : null, "text-error"],
                  ] as const
                )
                  .filter(([, value]) => value != null)
                  .map(([label, value, tone]) => (
                    <span
                      key={label}
                      className="flex min-w-23 flex-col gap-0.5 rounded-[14px] border border-border-subtle bg-surface-alt px-3.5 py-2.5"
                    >
                      <span className="text-[12px] text-text-secondary">{label}</span>
                      <strong
                        className={cn(
                          "text-[19px] font-semibold tracking-[-0.02em] tabular-nums",
                          tone,
                        )}
                      >
                        {value}
                      </strong>
                    </span>
                  ))}
              </span>

              {open.changes?.length ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-text-secondary">{text.changed}</span>
                  {open.changes.map((file) => (
                    <span
                      key={file.name}
                      className="flex items-center gap-2.25 rounded-[12px] border border-border-subtle bg-surface-alt px-3 py-2.25"
                    >
                      <Icon
                        name={statusIcon(file.status)}
                        size={15}
                        className="shrink-0 text-text-secondary"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-primary">
                        {file.name}
                      </span>
                      {file.added != null ? (
                        <span className="text-[12.5px] font-medium tabular-nums text-success">
                          +{file.added}
                        </span>
                      ) : null}
                      {file.removed != null ? (
                        <span className="text-[12.5px] font-medium tabular-nums text-error">
                          −{file.removed}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Drawer>
      ) : null}
    </div>
  );
}
