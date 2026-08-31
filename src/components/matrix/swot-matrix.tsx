import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../core/icon";
import { MatrixFrame } from "./matrix-frame";

export type SwotQuadrant = "strengths" | "weaknesses" | "opportunities" | "threats";

export interface SwotItem {
  text: string;
  /** 1–3. Shown as dots when `weights` is on. */
  weight?: number;
}

export type SwotEntry = string | SwotItem;

export interface SwotMatrixProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;

  strengths?: SwotEntry[];
  weaknesses?: SwotEntry[];
  opportunities?: SwotEntry[];
  threats?: SwotEntry[];

  onAdd?: (quadrant: SwotQuadrant, text: string) => void;
  onRemove?: (quadrant: SwotQuadrant, item: SwotEntry) => void;
  onSelect?: (quadrant: SwotQuadrant, item: SwotEntry) => void;
  editable?: boolean;

  /** The internal/external and favourable/unfavourable rails. */
  axes?: boolean;
  weights?: boolean;

  labels?: Partial<Record<SwotQuadrant, { label: string; hint: string }>>;
  axisLabels?: { internal: string; external: string; favourable: string; unfavourable: string };
  countLabel?: (count: number) => string;
  addPlaceholder?: (label: string) => string;
  className?: string;
}

/**
 * FAVOURABLE QUADRANTS CARRY THE ACCENT, unfavourable ones stay ink. There is
 * no per-quadrant palette: four coloured boxes make the grid read as decoration,
 * and the accent doing one job — marking what is favourable — keeps its meaning.
 */
const quadrants: {
  key: SwotQuadrant;
  label: string;
  hint: string;
  icon: IconName;
  good: boolean;
}[] = [
  { key: "strengths", label: "Strengths", hint: "Internal, favourable", icon: "trending-up", good: true },
  { key: "weaknesses", label: "Weaknesses", hint: "Internal, unfavourable", icon: "trending-down", good: false },
  { key: "opportunities", label: "Opportunities", hint: "External, favourable", icon: "sun", good: true },
  { key: "threats", label: "Threats", hint: "External, unfavourable", icon: "cloud-lightning", good: false },
];

/**
 * Four quadrants, each a list of short declarative items.
 *
 * The colour lives in the heading chip and a dot; the items stay in ink so the
 * grid reads as text rather than as four coloured boxes. A SWOT is read, not
 * scanned.
 */
export function SwotMatrix({
  title = "SWOT",
  subtitle,
  strengths = [],
  weaknesses = [],
  opportunities = [],
  threats = [],
  onAdd,
  onRemove,
  onSelect,
  editable = false,
  axes = true,
  weights = false,
  labels,
  axisLabels = {
    internal: "Internal",
    external: "External",
    favourable: "Favourable",
    unfavourable: "Unfavourable",
  },
  countLabel = (count) => `${count} observations`,
  addPlaceholder = (label) => `Add — ${label.toLowerCase()}`,
  className,
}: SwotMatrixProps) {
  const [drafts, setDrafts] = React.useState<Partial<Record<SwotQuadrant, string>>>({});

  const data: Record<SwotQuadrant, SwotEntry[]> = {
    strengths,
    weaknesses,
    opportunities,
    threats,
  };

  const total = strengths.length + weaknesses.length + opportunities.length + threats.length;

  const submit = (key: SwotQuadrant) => {
    const value = (drafts[key] ?? "").trim();
    if (value) onAdd?.(key, value);
    setDrafts((current) => ({ ...current, [key]: "" }));
  };

  const renderQuadrant = (key: SwotQuadrant) => {
    const meta = quadrants.find((entry) => entry.key === key)!;
    const label = labels?.[key]?.label ?? meta.label;
    const hint = labels?.[key]?.hint ?? meta.hint;
    const items = data[key];

    return (
      <div className="flex min-w-0 flex-col gap-2.5 rounded-panel border border-border-subtle bg-surface-card p-4">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex size-6.5 shrink-0 items-center justify-center rounded-[9px]",
              meta.good ? "bg-accent text-accent-ink" : "bg-ink text-paper",
            )}
          >
            <Icon name={meta.icon} size={15} strokeWidth={1.9} />
          </span>

          <span className="flex flex-col">
            <strong className="text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
              {label}
            </strong>
            <span className="text-[11.5px] text-text-secondary">{hint}</span>
          </span>

          <span className="ml-auto text-[12px] tabular-nums text-text-secondary">
            {items.length}
          </span>
        </span>

        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {items.map((item, index) => {
            const text = typeof item === "string" ? item : item.text;
            const weight = typeof item === "string" ? undefined : item.weight;

            return (
              <li
                key={`${text}-${index}`}
                onClick={() => onSelect?.(key, item)}
                className={cn(
                  "flex items-start gap-2 rounded-xl border border-border-subtle bg-surface-alt px-2.5 py-2.25",
                  onSelect ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    meta.good ? "bg-accent-deep" : "bg-text-primary",
                  )}
                />

                <span className="min-w-0 flex-1 text-pretty text-[13.5px] leading-[1.45] text-text-primary">
                  {text}
                </span>

                {weights && weight ? (
                  <span className="mt-0.75 inline-flex shrink-0 gap-0.5">
                    {[1, 2, 3].map((step) => (
                      <span
                        key={step}
                        className={cn(
                          "size-1.25 rounded-full",
                          step <= weight
                            ? meta.good
                              ? "bg-accent-deep"
                              : "bg-text-primary"
                            : "bg-hairline",
                        )}
                      />
                    ))}
                  </span>
                ) : null}

                {editable && onRemove ? (
                  <button
                    type="button"
                    aria-label={`Remove ${text}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(key, item);
                    }}
                    className="mt-0.25 inline-flex shrink-0 cursor-pointer border-none bg-transparent p-0.5 text-text-secondary hover:text-text-primary halo-focus"
                  >
                    <Icon name="x" size={14} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {editable && onAdd ? (
          <span className="flex items-center gap-1.5">
            <input
              value={drafts[key] ?? ""}
              placeholder={addPlaceholder(label)}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [key]: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") submit(key);
              }}
              className="box-border h-8.5 min-w-0 flex-1 rounded-[10px] border border-border-subtle bg-surface-card px-2.5 font-sans text-[13px] text-text-primary outline-none"
            />
            <button
              type="button"
              aria-label={addPlaceholder(label)}
              onClick={() => submit(key)}
              className="inline-flex size-8.5 shrink-0 items-center justify-center rounded-[10px] border-none bg-text-primary text-surface-page halo-focus"
            >
              <Icon name="plus" size={15} />
            </button>
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <MatrixFrame title={title} subtitle={subtitle} meta={countLabel(total)} className={className}>
      <div className="flex gap-3">
        {axes ? (
          <span className="flex w-5.5 shrink-0 flex-col">
            {[axisLabels.internal, axisLabels.external].map((label) => (
              <span
                key={label}
                className="inline-flex flex-1 items-center justify-center text-[11.5px] tracking-[0.02em] text-text-secondary"
                // Rotated so it reads bottom-to-top, the convention for a
                // vertical axis label.
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                {label}
              </span>
            ))}
          </span>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {axes ? (
            <span className="grid grid-cols-2 gap-3">
              {[axisLabels.favourable, axisLabels.unfavourable].map((label) => (
                <span
                  key={label}
                  className="text-center text-[11.5px] tracking-[0.02em] text-text-secondary"
                >
                  {label}
                </span>
              ))}
            </span>
          ) : null}

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            {renderQuadrant("strengths")}
            {renderQuadrant("weaknesses")}
            {renderQuadrant("opportunities")}
            {renderQuadrant("threats")}
          </div>
        </div>
      </div>
    </MatrixFrame>
  );
}
