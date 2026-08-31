import * as React from "react";
import { cn } from "../../lib/cn";
import { normalize, useDismissable } from "../../lib/use-dismissable";
import { Icon, type IconName } from "../core/icon";
import { Spinner } from "../core/spinner";
import { Field } from "./field";
import {
  fieldChrome,
  fieldFontSizes,
  fieldHeights,
  optionChrome,
  panelChrome,
  type FieldSize,
} from "./field-chrome";

export interface ComboboxOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: IconName;
}

export interface ComboboxProps<T extends string = string> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  help?: string;

  /** The current selection, so the field can show its label at rest. */
  value?: ComboboxOption<T> | null;
  onSelect?: (option: ComboboxOption<T>) => void;

  /** Async source. Called with the query after the debounce. */
  fetchOptions?: (query: string) => Promise<ComboboxOption<T>[]>;
  /** Local source. Filtered in-process; `fetchOptions` is then ignored. */
  options?: ComboboxOption<T>[];

  placeholder?: string;
  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  debounce?: number;
  /** Characters before searching starts. 0 searches on focus. */
  minChars?: number;
  emptyLabel?: string;
  searchingLabel?: string;
  iconLeft?: IconName;
  id?: string;
  className?: string;
}

/**
 * Type-ahead search over a list that may be too large to enumerate.
 *
 * TWO THINGS MAKE THIS SAFE AGAINST RACES: the debounce collapses keystrokes,
 * and a sequence number discards any response that is not from the most recent
 * request. Without the second, a slow reply to "ma" can land after a fast reply
 * to "marie" and silently replace the right results with stale ones.
 *
 * Options use `onMouseDown` rather than `onClick`: a click fires after blur,
 * by which point the panel has closed and the option is gone.
 */
export function Combobox<T extends string = string>({
  label,
  hint,
  error,
  help,
  value,
  onSelect,
  fetchOptions,
  options: staticOptions,
  placeholder = "Search…",
  size = "md",
  disabled = false,
  required = false,
  debounce = 300,
  minChars = 1,
  emptyLabel = "No results",
  searchingLabel = "Searching…",
  iconLeft = "search",
  id,
  className,
}: ComboboxProps<T>) {
  const [query, setQuery] = React.useState(value?.label ?? "");
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const [items, setItems] = React.useState<ComboboxOption<T>[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const root = useDismissable<HTMLDivElement>(open, () => setOpen(false));
  // Monotonic request id; only the latest response is allowed to land.
  const sequence = React.useRef(0);

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const height = fieldHeights[size];
  const fontSize = fieldFontSizes[size];

  React.useEffect(() => {
    if (!focus || query.length < minChars) {
      setItems([]);
      setBusy(false);
      return;
    }

    if (staticOptions) {
      setItems(staticOptions.filter((option) => normalize(option.label).includes(normalize(query))));
      setOpen(true);
      return;
    }

    if (!fetchOptions) return;

    setBusy(true);
    const mine = ++sequence.current;

    const timer = setTimeout(async () => {
      try {
        const results = await fetchOptions(query);
        if (sequence.current === mine) {
          setItems(results);
          setOpen(true);
        }
      } catch {
        // A failed lookup shows as no results; surfacing a stack trace in a
        // search field helps nobody.
        if (sequence.current === mine) setItems([]);
      } finally {
        if (sequence.current === mine) setBusy(false);
      }
    }, debounce);

    return () => clearTimeout(timer);
    // fetchOptions is intentionally excluded: callers routinely pass an inline
    // arrow, which would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, focus, minChars, debounce, staticOptions]);

  const pick = (option: ComboboxOption<T>) => {
    onSelect?.(option);
    setQuery(option.label);
    setOpen(false);
  };

  /** Highlights the matched run inside a label. */
  const mark = (text: string) => {
    if (!query) return text;
    const index = normalize(text).indexOf(normalize(query));
    if (index < 0) return text;
    return (
      <>
        {text.slice(0, index)}
        <mark className="rounded-[2px] bg-accent px-px text-accent-ink">
          {text.slice(index, index + query.length)}
        </mark>
        {text.slice(index + query.length)}
      </>
    );
  };

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      help={help}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      className={className}
    >
      <div ref={root} className="relative">
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={cn(
            "box-border flex items-center gap-2 pl-3 pr-2.5",
            fieldChrome({ tone: error ? "error" : null, focus, hover, disabled }),
          )}
          style={{ height }}
        >
          <span className="inline-flex shrink-0 text-text-secondary">
            <Icon name={iconLeft} size={18} />
          </span>

          <input
            id={fieldId}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            aria-describedby={fieldId ? `${fieldId}-msg` : undefined}
            value={query}
            placeholder={placeholder}
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
                  const option = items[active];
                  if (open && option) {
                    event.preventDefault();
                    pick(option);
                  }
                  break;
                }
                case "Escape":
                  setOpen(false);
                  break;
                default:
                  break;
              }
            }}
            className="h-full min-w-0 flex-1 border-none bg-transparent font-sans text-text-primary outline-none placeholder:text-text-secondary"
            style={{ fontSize }}
          />

          {busy ? (
            <Spinner size={16} />
          ) : query && !disabled ? (
            <button
              type="button"
              aria-label="Clear"
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery("");
                setItems([]);
              }}
              className="inline-flex cursor-pointer border-none bg-transparent p-1 text-text-secondary hover:text-text-primary"
            >
              <Icon name="x" size={15} />
            </button>
          ) : null}
        </div>

        {open && query.length >= minChars ? (
          <div
            role="listbox"
            className={cn("absolute left-0 right-0 top-[calc(100%+6px)] z-60 origin-top", panelChrome)}
            style={{ animation: "halo-panel-in 120ms ease-out both" }}
          >
            {busy && items.length === 0 ? (
              <div aria-live="polite" className="px-3 py-3.5 text-body-s text-text-secondary">
                {searchingLabel}
              </div>
            ) : items.length === 0 ? (
              <div aria-live="polite" className="px-3 py-3.5 text-body-s text-text-secondary">
                {emptyLabel}
              </div>
            ) : (
              items.map((option, index) => {
                const chrome = optionChrome({ active: index === active });
                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => {
                      // Before blur, so the panel is still open when it fires.
                      event.preventDefault();
                      pick(option);
                    }}
                    className={chrome.className}
                    style={chrome.style}
                  >
                    {option.icon ? <Icon name={option.icon} size={16} /> : null}
                    <span className="flex min-w-0 flex-col">
                      <span>{mark(option.label)}</span>
                      {option.description ? (
                        <span className="text-[12px] text-text-secondary">{option.description}</span>
                      ) : null}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </Field>
  );
}
