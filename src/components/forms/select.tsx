import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { normalize, useDismissable, useListNavigation } from "../../lib/use-dismissable";
import { Icon, type IconName } from "../core/icon";
import { Field } from "./field";
import {
  fieldChrome,
  fieldFontSizes,
  fieldHeights,
  optionChrome,
  panelChrome,
  type FieldSize,
  type FieldTone,
} from "./field-chrome";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** A second line under the label. Keep it to a few words. */
  description?: string;
  icon?: IconName;
  /** Groups consecutive options under a heading. Order the array accordingly. */
  group?: string;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  warning?: React.ReactNode;
  success?: React.ReactNode;
  help?: string;

  options: SelectOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  placeholder?: string;

  bare?: boolean;
  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  /** Adds a filter box in the panel. Worth it past roughly ten options. */
  searchable?: boolean;

  emptyLabel?: string;
  loadingLabel?: string;
  searchPlaceholder?: string;
  id?: string;
  className?: string;
}

/**
 * A single choice from a known list.
 *
 * Built on a button and a panel rather than a native `<select>`, because the
 * native control cannot carry an icon, a description or a badge, and cannot be
 * styled to match the field chrome. The ARIA combobox pattern and full keyboard
 * navigation are what make that trade honest.
 */
export function Select<T extends string = string>({
  label,
  hint,
  error,
  warning,
  success,
  help,
  options,
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  bare = false,
  size = "md",
  disabled = false,
  required = false,
  loading = false,
  searchable = false,
  emptyLabel = "No results",
  loadingLabel = "Loading…",
  searchPlaceholder = "Search…",
  id,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const [selected, set] = useControllableState<T | undefined>({
    value,
    defaultValue,
    onChange: onChange as ((value: T | undefined) => void) | undefined,
  });

  const root = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const tone: FieldTone | null = error ? "error" : warning ? "warning" : success ? "success" : null;
  const height = fieldHeights[size];
  const fontSize = fieldFontSizes[size];

  const visible = React.useMemo(
    () =>
      searchable && query
        ? options.filter((option) => normalize(option.label).includes(normalize(query)))
        : options,
    [options, searchable, query],
  );

  const current = options.find((option) => option.value === selected);

  const pick = (index: number) => {
    const option = visible[index];
    if (!option || option.disabled) return;
    set(option.value);
    setOpen(false);
    setQuery("");
  };

  const { active, setActive, onKeyDown } = useListNavigation({
    length: visible.length,
    open,
    onOpen: () => setOpen(true),
    onSelect: pick,
    onClose: () => setOpen(false),
  });

  // Tracks the last heading rendered so a group label is emitted only when it
  // changes.
  let lastGroup: string | undefined;

  return (
    <Field
      reserveMessage={!bare}
      label={bare ? undefined : label}
      hint={hint}
      error={error}
      warning={warning}
      success={success}
      help={help}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      className={className}
    >
      <div ref={root} className="relative">
        <button
          type="button"
          id={fieldId}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldId ? `${fieldId}-msg` : undefined}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={cn(
            "box-border flex w-full items-center justify-between gap-2 pl-3.5 pr-3 text-left font-sans",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
            current ? "text-text-primary" : "text-text-secondary",
            fieldChrome({ tone, focus: open, hover, disabled }),
          )}
          style={{ height, fontSize }}
        >
          <span className="inline-flex min-w-0 items-center gap-2 truncate">
            {current?.icon ? <Icon name={current.icon} size={16} /> : null}
            {current ? current.label : placeholder}
            {current?.badge ? <Badge>{current.badge}</Badge> : null}
          </span>
          <span
            className={cn(
              "inline-flex text-text-secondary transition-transform duration-[150ms] ease-out",
              open && "rotate-180",
            )}
          >
            <Icon name="chevron-down" size={16} />
          </span>
        </button>

        {open ? (
          <div
            role="listbox"
            className={cn("absolute left-0 right-0 top-[calc(100%+6px)] z-60 origin-top", panelChrome)}
            style={{ animation: "halo-panel-in 120ms ease-out both" }}
          >
            {searchable ? (
              <div className="px-1 pb-2 pt-0.5">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  className="box-border h-9 w-full rounded-[10px] border border-border-subtle bg-surface-card px-3 font-sans text-[14px] text-text-primary outline-none"
                />
              </div>
            ) : null}

            {loading ? (
              <div className="px-3 py-3.5 text-body-s text-text-secondary">{loadingLabel}</div>
            ) : visible.length === 0 ? (
              <div className="px-3 py-3.5 text-body-s text-text-secondary">{emptyLabel}</div>
            ) : (
              visible.map((option, index) => {
                const heading = option.group && option.group !== lastGroup ? option.group : null;
                if (option.group) lastGroup = option.group;
                const chrome = optionChrome({
                  active: index === active,
                  selected: option.value === selected,
                });

                return (
                  <React.Fragment key={option.value}>
                    {heading ? (
                      <div className="px-3 pb-1 pt-2.5 text-[12px] font-semibold text-text-secondary">
                        {heading}
                      </div>
                    ) : null}
                    <div
                      role="option"
                      aria-selected={option.value === selected}
                      aria-disabled={option.disabled || undefined}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(index)}
                      className={cn(
                        chrome.className,
                        option.disabled && "cursor-not-allowed opacity-45",
                      )}
                      style={chrome.style}
                    >
                      {option.icon ? <Icon name={option.icon} size={16} /> : null}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.description ? (
                          <span className="text-[12px] text-text-secondary">{option.description}</span>
                        ) : null}
                      </span>
                      {option.badge ? (
                        <span className="ml-auto">
                          <Badge>{option.badge}</Badge>
                        </span>
                      ) : null}
                      {option.value === selected ? (
                        <span className={cn("inline-flex shrink-0", option.badge ? "ml-1.5" : "ml-auto")}>
                          <Icon name="check" size={15} />
                        </span>
                      ) : null}
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </Field>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5.5 shrink-0 items-center rounded-pill bg-accent px-2.25 text-[12px] font-medium text-accent-ink">
      {children}
    </span>
  );
}
