import * as React from "react";
import { cn } from "../../lib/cn";
import { normalize, useDismissable } from "../../lib/use-dismissable";
import { Icon, type IconName } from "../core/icon";
import { Field } from "./field";
import {
  fieldChrome,
  fieldFontSizes,
  fieldHeights,
  optionChrome,
  panelChrome,
  type FieldSize,
} from "./field-chrome";

export interface LookupRecord {
  id: string;
  label: string;
  /** A second line: a role, an address, an identifier. */
  secondary?: string;
  /** Squares the avatar — for a thing rather than a person. */
  type?: "person" | "thing";
  icon?: IconName;
  avatar?: string;
  badge?: React.ReactNode;
}

export interface RecordLookupProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  help?: string;

  /** Single-select value. */
  value?: LookupRecord | null;
  onSelect?: (record: LookupRecord) => void;

  /** Multi-select value. Pass `multiple` alongside. */
  values?: LookupRecord[];
  onChange?: (records: LookupRecord[]) => void;
  multiple?: boolean;

  /** Async source, called with the query after the debounce. */
  fetchRecords?: (query: string) => Promise<LookupRecord[]>;
  /** Local source. Filtered in-process; `fetchRecords` is then ignored. */
  records?: LookupRecord[];

  /** Offers to create what was typed when nothing matches. */
  createLabel?: (query: string) => string;
  onCreate?: (query: string) => void;

  placeholder?: string;
  emptyLabel?: string;
  debounce?: number;
  /** 0 searches as soon as the field is focused. */
  minChars?: number;
  max?: number;
  maxChips?: number;

  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

/**
 * Searches records in another table and links one or several of them.
 *
 * DIFFERENT FROM COMBOBOX in three ways that matter: it can hold several
 * selections as chips, each row carries an avatar and a second line, and it can
 * offer to create what was typed when nothing matches — which is what stops a
 * lookup from being a dead end.
 *
 * Like Combobox, a sequence number discards stale responses: a slow reply to
 * "ma" must not overwrite a fast reply to "marie".
 */
export function RecordLookup({
  label = "Record",
  hint,
  error,
  help,
  value = null,
  onSelect,
  values = [],
  onChange,
  multiple = false,
  fetchRecords,
  records: staticRecords,
  createLabel,
  onCreate,
  placeholder = "Search a record…",
  emptyLabel = "No records",
  debounce = 300,
  minChars = 0,
  max,
  maxChips = 4,
  size = "md",
  disabled = false,
  required = false,
  id,
  className,
}: RecordLookupProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [items, setItems] = React.useState<LookupRecord[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [active, setActive] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const sequence = React.useRef(0);
  const root = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const height = fieldHeights[size];
  const atLimit = max !== undefined && values.length >= max;

  React.useEffect(() => {
    if (!focus || query.length < minChars) {
      setItems([]);
      setBusy(false);
      return;
    }

    if (staticRecords) {
      setItems(
        query
          ? staticRecords.filter(
              (record) =>
                normalize(record.label).includes(normalize(query)) ||
                normalize(record.secondary ?? "").includes(normalize(query)),
            )
          : staticRecords,
      );
      setOpen(true);
      return;
    }

    if (!fetchRecords) return;

    setBusy(true);
    const mine = ++sequence.current;

    const timer = setTimeout(async () => {
      try {
        const results = await fetchRecords(query);
        if (sequence.current === mine) {
          setItems(results);
          setOpen(true);
        }
      } catch {
        if (sequence.current === mine) setItems([]);
      } finally {
        if (sequence.current === mine) setBusy(false);
      }
    }, debounce);

    return () => clearTimeout(timer);
    // fetchRecords is excluded on purpose: callers pass an inline arrow, which
    // would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, focus, minChars, debounce, staticRecords]);

  const pick = (record: LookupRecord) => {
    if (multiple) {
      if (values.some((held) => held.id === record.id)) {
        onChange?.(values.filter((held) => held.id !== record.id));
        return;
      }
      if (atLimit) return;
      onChange?.([...values, record]);
      setQuery("");
      inputRef.current?.focus();
      return;
    }

    onSelect?.(record);
    setQuery("");
    setOpen(false);
  };

  const shown = values.slice(0, maxChips);
  const extra = values.length - shown.length;
  const showCreate = Boolean(createLabel && onCreate && query && !busy && items.length === 0);

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      help={help}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      counter={multiple && max !== undefined ? `${values.length} / ${max}` : undefined}
      counterAlert={atLimit}
      className={className}
    >
      <div ref={root} className="relative">
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => inputRef.current?.focus()}
          className={cn(
            "box-border flex flex-wrap items-center gap-1.5 py-1.5 pl-2.5 pr-2",
            disabled ? "cursor-not-allowed" : "cursor-text",
            fieldChrome({ tone: error ? "error" : null, focus: focus || open, hover, disabled }),
          )}
          style={{ minHeight: height }}
        >
          {/* Single-select shows the held record inline rather than as a chip:
              there is only one, and a chip implies it is one of several. */}
          {!multiple && value && !query ? (
            <span className="inline-flex min-w-0 items-center gap-2">
              <Avatar record={value} size={22} />
              <span className="truncate text-text-primary">{value.label}</span>
            </span>
          ) : null}

          {multiple
            ? shown.map((record) => (
                <span
                  key={record.id}
                  className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-pill bg-accent py-0 pl-1 pr-1.5 text-body-s font-medium text-accent-ink"
                  style={{ animation: "halo-chip-in 220ms var(--ease-standard) both" }}
                >
                  <Avatar record={record} size={20} />
                  <span className="truncate">{record.label}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${record.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange?.(values.filter((held) => held.id !== record.id));
                    }}
                    className="inline-flex shrink-0 cursor-pointer border-none bg-transparent p-0.5 text-accent-ink"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </span>
              ))
            : null}

          {extra > 0 ? (
            <span className="text-body-s font-medium text-text-secondary">+{extra}</span>
          ) : null}

          <input
            ref={inputRef}
            id={fieldId}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            aria-describedby={fieldId ? `${fieldId}-msg` : undefined}
            value={query}
            placeholder={(!multiple && value) || values.length ? "" : placeholder}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={(event) => {
              switch (event.key) {
                case "ArrowDown":
                  event.preventDefault();
                  setActive((a) => Math.min(items.length - 1, a + 1));
                  break;
                case "ArrowUp":
                  event.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                  break;
                case "Enter": {
                  const record = items[active];
                  if (open && record) {
                    event.preventDefault();
                    pick(record);
                  } else if (showCreate) {
                    event.preventDefault();
                    onCreate?.(query);
                    setQuery("");
                  }
                  break;
                }
                case "Escape":
                  setOpen(false);
                  break;
                case "Backspace":
                  if (!query && multiple && values.length) onChange?.(values.slice(0, -1));
                  break;
                default:
                  break;
              }
            }}
            className="h-7 min-w-[120px] flex-1 border-none bg-transparent font-sans text-text-primary outline-none placeholder:text-text-secondary"
            style={{ fontSize: fieldFontSizes[size] }}
          />

          <span className="inline-flex shrink-0 text-text-secondary">
            <Icon name="search" size={17} />
          </span>
        </div>

        {open && focus ? (
          <div
            role="listbox"
            className={cn("absolute left-0 right-0 top-[calc(100%+6px)] z-60 origin-top", panelChrome)}
            style={{ animation: "halo-panel-in 120ms ease-out both" }}
          >
            {busy && items.length === 0 ? (
              <LookupSkeleton />
            ) : items.length === 0 ? (
              showCreate ? null : (
                <div aria-live="polite" className="px-3 py-3.5 text-body-s text-text-secondary">
                  {emptyLabel}
                </div>
              )
            ) : (
              items.map((record, index) => {
                const held = multiple
                  ? values.some((value) => value.id === record.id)
                  : value?.id === record.id;
                const blocked = multiple && !held && atLimit;
                const chrome = optionChrome({ active: index === active, selected: held, height: 44 });

                return (
                  <div
                    key={record.id}
                    role="option"
                    aria-selected={held}
                    aria-disabled={blocked || undefined}
                    onMouseEnter={() => setActive(index)}
                    // mousedown, not click: click fires after blur, by which
                    // point the panel has closed.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      if (!blocked) pick(record);
                    }}
                    className={cn(chrome.className, blocked && "cursor-not-allowed opacity-45")}
                    style={chrome.style}
                  >
                    <Avatar record={record} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{record.label}</span>
                      {record.secondary ? (
                        <span className="truncate text-[12px] text-text-secondary">
                          {record.secondary}
                        </span>
                      ) : null}
                    </span>
                    {record.badge ? (
                      <span className="shrink-0 text-[12px] text-text-secondary">{record.badge}</span>
                    ) : null}
                    {held ? (
                      <span className="inline-flex shrink-0">
                        <Icon name="check" size={15} />
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}

            {showCreate ? (
              <div
                role="option"
                aria-selected={false}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onCreate?.(query);
                  setQuery("");
                }}
                className={cn(
                  optionChrome({}).className,
                  items.length > 0 && "mt-1 border-t border-hairline",
                  "font-medium",
                )}
              >
                <Icon name="plus" size={16} />
                {createLabel?.(query)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Field>
  );
}

/** First letters of the first two words: "Marie Dupont" → "MD". */
function initials(label: string): string {
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

function Avatar({ record, size = 26 }: { record: LookupRecord; size?: number }) {
  if (record.avatar) {
    return (
      <img
        src={record.avatar}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-mist-strong font-sans font-medium text-ink",
        // A square marks a thing, a circle marks a person — the same
        // distinction avatars carry everywhere else.
        record.type === "thing" ? "rounded-[7px]" : "rounded-full",
        size <= 26 ? "text-[10px]" : "text-[12px]",
      )}
      style={{ width: size, height: size }}
    >
      {record.icon ? <Icon name={record.icon} size={size <= 26 ? 13 : 15} /> : initials(record.label)}
    </span>
  );
}

/**
 * Shimmering placeholder rows while a lookup is in flight.
 *
 * Rows of decreasing width rather than identical bars: a uniform block reads as
 * a broken layout, staggered ones read as content arriving.
 */
function LookupSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1 p-1">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-10 items-center gap-2.5 px-2">
          <span className="size-6.5 shrink-0 rounded-full bg-shimmer" />
          <span className="flex flex-1 flex-col gap-1.25">
            <span
              className="h-2.25 rounded bg-shimmer"
              style={{ width: `${62 - index * 8}%` }}
            />
            <span className="h-1.75 rounded bg-mist" style={{ width: `${40 - index * 6}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
