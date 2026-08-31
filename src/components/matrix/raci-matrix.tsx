import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../core/icon";
import { MatrixAvatar, MatrixFrame } from "./matrix-frame";

export type RaciCode = "R" | "A" | "C" | "I" | "";

export interface RaciPerson {
  id: string;
  name: string;
  role?: string;
  src?: string;
}

export interface RaciRow {
  id: string;
  name: string;
  /** Groups consecutive rows under a heading. */
  group?: string;
}

export interface RaciMatrixProps {
  title?: React.ReactNode;
  people: RaciPerson[];
  rows: RaciRow[];
  /** assignments[rowId][personId] = "R" | "A" | "C" | "I". */
  assignments?: Record<string, Record<string, RaciCode>>;
  onChange?: (rowId: string, personId: string, code: RaciCode) => void;
  editable?: boolean;
  /** Reports rows with no approver, several approvers, or nobody doing the work. */
  checks?: boolean;
  legend?: boolean;
  nameWidth?: number;
  labels?: Partial<Record<Exclude<RaciCode, "">, string>>;
  className?: string;
}

/**
 * A IS THE ACCENT because it is the single decision on the row — exactly the
 * kind of "one thing per row" the accent rule exists for. R is ink (the work),
 * C is mist (consulted), I is an outline (informed only).
 */
const roleStyles: Record<Exclude<RaciCode, "">, { className: string; label: string }> = {
  R: { className: "bg-ink text-paper border-transparent", label: "Responsible" },
  A: { className: "bg-accent text-accent-ink border-accent-deep", label: "Accountable" },
  C: { className: "bg-mist-strong text-ink border-transparent", label: "Consulted" },
  I: { className: "bg-transparent text-text-secondary border-border-strong", label: "Informed" },
};

/** Clicking a cell walks through the codes and back to empty. */
const cycle: RaciCode[] = ["", "R", "A", "C", "I"];

function RaciChip({
  code,
  size = 26,
  onClick,
  title,
}: {
  code: RaciCode;
  size?: number;
  onClick?: () => void;
  title?: string;
}) {
  if (!code) {
    return (
      <span
        onClick={onClick}
        title={title}
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-dashed border-hairline",
          onClick ? "cursor-pointer" : "cursor-default",
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  const role = roleStyles[code];

  return (
    <span
      onClick={onClick}
      title={title ?? role.label}
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-sans font-semibold",
        "transition-colors duration-[140ms] ease-standard",
        role.className,
        onClick ? "cursor-pointer" : "cursor-default",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {code}
    </span>
  );
}

/**
 * One row per deliverable, one column per person.
 *
 * THE CHECKS ARE THE POINT. A RACI that nobody validates is a diagram; one that
 * names its own governance gaps — no approver, two approvers, nobody doing the
 * work — is a tool. Those three failures are the ones that actually occur.
 */
export function RaciMatrix({
  title = "RACI",
  people,
  rows,
  assignments = {},
  onChange,
  editable = false,
  checks = true,
  legend = true,
  nameWidth = 240,
  labels,
  className,
}: RaciMatrixProps) {
  const [hoverRow, setHoverRow] = React.useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = React.useState<number | null>(null);

  const codeAt = (rowId: string, personId: string): RaciCode =>
    assignments[rowId]?.[personId] ?? "";

  const advance = (rowId: string, personId: string) => {
    if (!editable || !onChange) return;
    const current = codeAt(rowId, personId);
    onChange(rowId, personId, cycle[(cycle.indexOf(current) + 1) % cycle.length]!);
  };

  // Groups keep their rows together; ungrouped rows fall to the end.
  const groups = [...new Set(rows.map((row) => row.group).filter(Boolean))] as string[];
  const ordered: ({ kind: "group"; name: string; id: string } | ({ kind: "row" } & RaciRow))[] =
    groups.length
      ? [
          ...groups.flatMap((group) => [
            { kind: "group" as const, name: group, id: `group:${group}` },
            ...rows.filter((row) => row.group === group).map((row) => ({ kind: "row" as const, ...row })),
          ]),
          ...rows.filter((row) => !row.group).map((row) => ({ kind: "row" as const, ...row })),
        ]
      : rows.map((row) => ({ kind: "row" as const, ...row }));

  const issues = checks
    ? rows
        .map((row) => {
          const codes = Object.values(assignments[row.id] ?? {});
          const accountable = codes.filter((code) => code === "A").length;
          const responsible = codes.filter((code) => code === "R").length;

          if (accountable === 0) return { id: row.id, name: row.name, text: "nobody approves" };
          if (accountable > 1) return { id: row.id, name: row.name, text: `${accountable} approvers` };
          if (responsible === 0) return { id: row.id, name: row.name, text: "nobody does the work" };
          return null;
        })
        .filter((issue): issue is { id: string; name: string; text: string } => issue !== null)
    : [];

  return (
    <MatrixFrame
      title={title}
      meta={`${rows.length} deliverables · ${people.length} people`}
      bare
      className={className}
      footer={
        legend || issues.length ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legend
              ? (Object.keys(roleStyles) as Exclude<RaciCode, "">[]).map((code) => (
                  <span key={code} className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary">
                    <RaciChip code={code} size={20} />
                    {labels?.[code] ?? roleStyles[code].label}
                  </span>
                ))
              : null}

            {issues.length ? (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-warning">
                <Icon name="triangle-alert" size={14} />
                {issues.length === 1
                  ? `${issues[0]!.name}: ${issues[0]!.text}`
                  : `${issues.length} rows need attention`}
              </span>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse"
          style={{ minWidth: nameWidth + people.length * 76 }}
        >
          <thead>
            <tr>
              {/* Sticky, so the deliverable stays readable while scrolling
                  across a wide team. */}
              <th
                className="sticky left-0 z-2 border-b border-r border-hairline bg-surface-card px-3.5 py-2.5 text-left text-[12px] font-normal text-text-secondary"
                style={{ width: nameWidth, minWidth: nameWidth }}
              >
                Deliverable
              </th>

              {people.map((person, index) => (
                <th
                  key={person.id}
                  onMouseEnter={() => setHoverColumn(index)}
                  onMouseLeave={() => setHoverColumn((current) => (current === index ? null : current))}
                  className={cn(
                    "min-w-[76px] border-b border-hairline px-2 py-2.5 align-bottom",
                    "transition-colors duration-[140ms] ease-standard",
                    hoverColumn === index ? "bg-surface-alt" : "bg-transparent",
                  )}
                >
                  <span className="flex flex-col items-center gap-1.25">
                    <MatrixAvatar name={person.name} src={person.src} />
                    <span className="text-center text-[12.5px] font-medium leading-[1.25] text-text-primary">
                      {person.name}
                    </span>
                    {person.role ? (
                      <span className="text-center text-[11px] text-text-secondary">
                        {person.role}
                      </span>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {ordered.map((entry) =>
              entry.kind === "group" ? (
                <tr key={entry.id}>
                  <td
                    colSpan={people.length + 1}
                    className="sticky left-0 border-b border-hairline bg-surface-alt px-3.5 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-text-secondary"
                  >
                    {entry.name}
                  </td>
                </tr>
              ) : (
                <tr
                  key={entry.id}
                  onMouseEnter={() => setHoverRow(entry.id)}
                  onMouseLeave={() => setHoverRow((current) => (current === entry.id ? null : current))}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-1 border-b border-r border-hairline px-3.5 py-2.5",
                      "text-[13.5px] text-text-primary transition-colors duration-[140ms] ease-standard",
                      hoverRow === entry.id ? "bg-surface-alt" : "bg-surface-card",
                    )}
                  >
                    {entry.name}
                  </td>

                  {people.map((person, index) => (
                    <td
                      key={person.id}
                      onMouseEnter={() => setHoverColumn(index)}
                      className={cn(
                        "border-b border-hairline text-center transition-colors duration-[140ms] ease-standard",
                        hoverRow === entry.id || hoverColumn === index
                          ? "bg-surface-alt"
                          : "bg-transparent",
                      )}
                      style={{ padding: "8px 6px" }}
                    >
                      <RaciChip
                        code={codeAt(entry.id, person.id)}
                        onClick={editable ? () => advance(entry.id, person.id) : undefined}
                        title={
                          editable
                            ? `${person.name} — ${entry.name}`
                            : roleStyles[codeAt(entry.id, person.id) as Exclude<RaciCode, "">]?.label
                        }
                      />
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </MatrixFrame>
  );
}
