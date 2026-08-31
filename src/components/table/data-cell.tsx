import * as React from "react";
import { cn } from "../../lib/cn";
import { formatIsoDate } from "../../lib/date";
import { groupDigits, parseNumber } from "../../lib/number-format";
import { Icon, type IconName } from "../core/icon";
import { Badge, type BadgeTone } from "../feedback/badge";
import { AmountField } from "../forms/amount-field";
import { DatePicker } from "../forms/date-picker";
import { Input } from "../forms/input";
import { NumberField } from "../forms/number-field";
import { PhoneField } from "../forms/phone-field";
import { Select } from "../forms/select";
import { Switch } from "../forms/switch";
import { TagsInput } from "../forms/tags-input";
import { Textarea } from "../forms/textarea";
import { TimePicker } from "../forms/time-picker";

export type CellType =
  | "text"
  | "longtext"
  | "email"
  | "emails"
  | "phone"
  | "url"
  | "amount"
  | "number"
  | "percent"
  | "progress"
  | "trend"
  | "date"
  | "datetime"
  | "time"
  | "daterange"
  | "duration"
  | "select"
  | "tags"
  | "boolean"
  | "record"
  | "rating"
  | "sparkline"
  | "area"
  | "secret"
  | "code";

export interface CellRecord {
  label: string;
  secondary?: string;
  avatar?: string;
  icon?: IconName;
  /** Squares the avatar — a thing rather than a person. */
  type?: "person" | "thing";
}

export interface ColumnMeta {
  /** Options for a `select` cell. */
  options?: (string | { value: string; label: string })[];
  /** Badge tone per value, for a `select` cell. */
  tones?: Record<string, BadgeTone>;
  currency?: string;
  unit?: string;
  max?: number;
  maxChips?: number;
  width?: number;
  showLast?: boolean;
}

export interface DataCellProps {
  type?: CellType;
  value: unknown;
  column?: ColumnMeta;
  editing?: boolean;
  onCommit?: (value: unknown) => void;
  onCancel?: () => void;
  emptyLabel?: string;
  trueLabel?: string;
  falseLabel?: string;
}

const toNumber = (value: unknown) => parseNumber(String(value ?? "")) ?? 0;

/** "1208.5" → "1 208,50 €" */
function formatMoney(value: unknown, currency = "€"): string {
  const [whole = "0", fraction = "00"] = toNumber(value).toFixed(2).split(".");
  return `${groupDigits(whole)},${fraction} ${currency}`;
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

/** A small pill for a tag or an address inside a cell. */
function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.25 overflow-hidden whitespace-nowrap rounded-pill px-2.25",
        "text-[12px] font-medium",
        accent ? "border-none bg-accent text-accent-ink" : "border border-border-subtle bg-surface-alt text-text-primary",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Renders one table cell by data type, and its inline editor when editing.
 *
 * THIS IS WHERE THE FORM COMPONENTS EARN THEIR KEEP: every editor is the same
 * field the rest of the app uses, in `bare` mode. A table with its own private
 * set of inputs is a table whose validation, formatting and keyboard behaviour
 * drift from the forms beside it.
 *
 * An empty value always renders as an em dash rather than as nothing: a blank
 * cell is indistinguishable from a rendering failure.
 */
export function DataCell({
  type = "text",
  value,
  column = {},
  editing = false,
  onCommit,
  onCancel,
  emptyLabel = "—",
  trueLabel = "Yes",
  falseLabel = "No",
}: DataCellProps) {
  const [draft, setDraft] = React.useState(value == null ? "" : String(value));

  React.useEffect(() => {
    if (editing) setDraft(value == null ? "" : String(value));
  }, [editing, value]);

  const commit = (next?: unknown) => onCommit?.(next === undefined ? draft : next);

  if (editing) {
    switch (type) {
      case "boolean":
        return (
          <Switch
            checked={value === true || value === "true"}
            onChange={(checked) => commit(checked ? "true" : "false")}
          />
        );

      case "select":
        return (
          <Select
            bare
            size="sm"
            value={draft}
            onChange={commit}
            options={(column.options ?? []).map((option) =>
              typeof option === "string" ? { value: option, label: option } : option,
            )}
          />
        );

      case "longtext":
        return (
          <Textarea
            bare
            value={draft}
            onChange={setDraft}
            onBlur={() => commit()}
            rows={2}
            maxRows={4}
            autoResize={false}
          />
        );

      case "amount":
        return (
          <AmountField
            bare
            size="sm"
            value={draft}
            onChange={setDraft}
            onBlur={() => commit()}
            currency={column.currency === "$" ? "USD" : "EUR"}
          />
        );

      case "number":
      case "progress":
        return (
          <NumberField
            bare
            size="sm"
            value={draft}
            onChange={setDraft}
            onBlur={() => commit()}
            unit={column.unit}
            max={column.max}
          />
        );

      case "percent":
        return (
          <NumberField
            bare
            size="sm"
            value={draft}
            onChange={setDraft}
            onBlur={() => commit()}
            unit="%"
            max={100}
          />
        );

      case "rating":
        return (
          <NumberField
            bare
            size="sm"
            value={draft}
            onChange={setDraft}
            onBlur={() => commit()}
            min={0}
            max={5}
          />
        );

      case "date":
        return <DatePicker bare size="sm" value={draft} onChange={commit} />;

      case "time":
        return <TimePicker bare size="sm" value={draft} onChange={commit} />;

      case "phone":
        return <PhoneField bare size="sm" value={draft} onChange={setDraft} onBlur={() => commit()} />;

      case "tags":
        return (
          <TagsInput
            bare
            tags={Array.isArray(value) ? value : String(value ?? "").split(/,\s*/).filter(Boolean)}
            onChange={(list) => commit(list.join(", "))}
          />
        );

      case "email":
        return (
          <Input
            bare
            size="sm"
            type="email"
            iconLeft="mail"
            value={draft}
            onChange={setDraft}
            onBlur={() => commit()}
            clearable
          />
        );

      case "url":
        return (
          <Input
            bare
            size="sm"
            type="url"
            prefix="https://"
            value={String(draft).replace(/^https?:\/\//, "")}
            onChange={setDraft}
            onBlur={() => commit()}
          />
        );

      case "secret":
        return <Input bare size="sm" masked value={draft} onChange={setDraft} onBlur={() => commit()} />;

      case "code":
        return (
          <Input
            bare
            size="sm"
            inputMode="numeric"
            value={draft}
            onChange={setDraft}
            onBlur={() => commit()}
          />
        );

      default:
        return (
          <Input bare size="sm" value={draft} onChange={setDraft} onBlur={() => commit()} clearable />
        );
    }
  }

  if (value == null || value === "") {
    return <span className="text-text-secondary">{emptyLabel}</span>;
  }

  switch (type) {
    case "email":
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Icon name="mail" size={14} className="shrink-0 text-text-secondary" />
          <a
            href={`mailto:${value}`}
            // The row is usually clickable; a link inside it must not also open it.
            onClick={(event) => event.stopPropagation()}
            className="truncate border-b border-border-subtle text-text-primary no-underline"
          >
            {String(value)}
          </a>
        </span>
      );

    case "emails": {
      const list = Array.isArray(value) ? value : String(value).split(/[,;]\s*/);
      return (
        <span className="inline-flex items-center gap-1">
          <Chip accent>{list[0]}</Chip>
          {list.length > 1 ? (
            <span className="text-[12px] text-text-secondary">+{list.length - 1}</span>
          ) : null}
        </span>
      );
    }

    case "phone":
    case "time":
      return <span className="tabular-nums">{String(value)}</span>;

    case "url":
      return (
        <a
          href={String(value).startsWith("http") ? String(value) : `https://${value}`}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex items-center gap-1.25 border-b border-border-subtle text-text-primary no-underline"
        >
          {String(value).replace(/^https?:\/\//, "")}
          <Icon name="external-link" size={12} />
        </a>
      );

    case "amount":
      return (
        <span className="font-medium tabular-nums">{formatMoney(value, column.currency)}</span>
      );

    case "number":
      return (
        <span className="tabular-nums">
          {groupDigits(String(value).replace(/\D/g, ""))}
          {column.unit ? ` ${column.unit}` : ""}
        </span>
      );

    case "percent": {
      const percent = toNumber(value);
      return (
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="tabular-nums">{percent} %</span>
          <span className="h-1 w-10.5 shrink-0 overflow-hidden rounded-pill bg-surface-alt">
            <span
              className="block h-full bg-text-primary"
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </span>
        </span>
      );
    }

    case "progress": {
      const current = toNumber(value);
      const max = column.max ?? 100;
      return (
        <span className="inline-flex min-w-[118px] items-center gap-2">
          <span className="h-1.25 flex-1 overflow-hidden rounded-pill bg-surface-alt">
            <span
              className={cn("block h-full", current >= max ? "bg-accent-deep" : "bg-text-primary")}
              style={{ width: `${Math.min(100, (current / max) * 100)}%` }}
            />
          </span>
          <span className="text-[12px] tabular-nums text-text-secondary">
            {current}/{max}
          </span>
        </span>
      );
    }

    case "trend": {
      const change = toNumber(value);
      const up = change >= 0;
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.25 tabular-nums",
            up ? "text-success" : "text-error",
          )}
        >
          <Icon name={up ? "trending-up" : "trending-down"} size={14} />
          {/* A minus sign, not a hyphen: it aligns with the digits. */}
          {up ? "+" : "−"}
          {Math.abs(change)} %
        </span>
      );
    }

    case "date":
      return (
        <span className="tabular-nums">
          {String(value).includes("-") ? formatIsoDate(String(value)) : String(value)}
        </span>
      );

    case "datetime":
      return (
        <span className="inline-flex flex-col leading-[1.25]">
          <span className="tabular-nums">{formatIsoDate(String(value).slice(0, 10))}</span>
          <span className="text-[12px] tabular-nums text-text-secondary">
            {String(value).slice(11, 16)}
          </span>
        </span>
      );

    case "daterange": {
      const [from, to] = Array.isArray(value)
        ? value
        : String(value).split("→").map((part) => part.trim());
      const format = (input: string) => (input?.includes("-") ? formatIsoDate(input) : input);
      return (
        <span className="tabular-nums">
          {format(from)} → {format(to)}
        </span>
      );
    }

    case "duration": {
      const minutes = toNumber(value);
      const hours = Math.floor(minutes / 60);
      return (
        <span className="tabular-nums">
          {hours ? `${hours} h ` : ""}
          {String(minutes % 60).padStart(2, "0")} min
        </span>
      );
    }

    case "select":
      return <Badge tone={column.tones?.[String(value)] ?? "neutral"}>{String(value)}</Badge>;

    case "tags": {
      const list = Array.isArray(value) ? value : String(value).split(/,\s*/);
      const shown = list.slice(0, column.maxChips ?? 2);
      return (
        <span className="inline-flex min-w-0 items-center gap-1">
          {shown.map((tag: string) => (
            <Chip key={tag} accent>
              {tag}
            </Chip>
          ))}
          {list.length > shown.length ? (
            <span className="text-[12px] text-text-secondary">+{list.length - shown.length}</span>
          ) : null}
        </span>
      );
    }

    case "boolean":
      return value === true || value === "true" ? (
        <span className="inline-flex items-center gap-1.5 text-success">
          <Icon name="check" size={15} />
          {trueLabel}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <Icon name="minus" size={15} />
          {falseLabel}
        </span>
      );

    case "record": {
      const record = value as CellRecord;
      return (
        <span className="inline-flex min-w-0 items-center gap-2.25">
          {record.avatar ? (
            <img
              src={record.avatar}
              alt=""
              width={26}
              height={26}
              className="shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className={cn(
                "inline-flex size-6.5 shrink-0 items-center justify-center bg-surface-alt text-[10px] font-semibold",
                record.type === "thing" ? "rounded-[7px]" : "rounded-full",
              )}
            >
              {record.icon ? <Icon name={record.icon} size={13} /> : initials(record.label)}
            </span>
          )}
          <span className="flex min-w-0 flex-col leading-[1.25]">
            <span className="truncate font-medium">{record.label}</span>
            {record.secondary ? (
              <span className="truncate text-[12px] text-text-secondary">{record.secondary}</span>
            ) : null}
          </span>
        </span>
      );
    }

    case "rating": {
      const stars = Math.round(toNumber(value));
      return (
        <span className="inline-flex gap-0.5 text-text-primary" aria-label={`${stars} out of 5`}>
          {[1, 2, 3, 4, 5].map((index) => (
            <Icon
              key={index}
              name="star"
              size={13}
              className={index <= stars ? "opacity-100" : "opacity-25"}
            />
          ))}
        </span>
      );
    }

    case "sparkline":
    case "area": {
      const values = (Array.isArray(value) ? value : String(value).split(/[,\s]+/)).map(toNumber);
      const width = column.width ?? 96;
      const height = 30;

      const high = Math.max(...values, 1);
      const low = Math.min(...values, 0);
      const span = high - low || 1;

      const points = values.map((point, index) => [
        (index / Math.max(1, values.length - 1)) * width,
        height - ((point - low) / span) * (height - 4) - 2,
      ]);
      const path = points
        .map(([x, y], index) => `${index ? "L" : "M"}${x!.toFixed(1)} ${y!.toFixed(1)}`)
        .join(" ");

      const rising = values[values.length - 1]! >= values[0]!;
      const last = points[points.length - 1]!;

      return (
        <span className="inline-flex items-center gap-2">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            className="block overflow-visible"
          >
            {type === "area" ? (
              <path
                d={`${path} L${width} ${height} L0 ${height} Z`}
                fill={rising ? "rgb(217 248 79 / 0.45)" : "rgb(214 49 74 / 0.16)"}
              />
            ) : null}
            <path
              d={path}
              fill="none"
              stroke={rising ? "var(--color-text-primary)" : "var(--color-error)"}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={last[0]}
              cy={last[1]}
              r="2.4"
              fill={rising ? "var(--color-accent-deep)" : "var(--color-error)"}
            />
          </svg>

          {column.showLast === false ? null : (
            <span className="text-[12px] tabular-nums text-text-secondary">
              {values[values.length - 1]}
            </span>
          )}
        </span>
      );
    }

    case "secret":
      return <span className="tabular-nums tracking-[0.08em]">••••••••</span>;

    case "longtext":
      return <span className="line-clamp-2 text-pretty">{String(value)}</span>;

    default:
      return <span className="truncate">{String(value)}</span>;
  }
}
