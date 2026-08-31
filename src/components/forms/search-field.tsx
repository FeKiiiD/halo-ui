import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Icon } from "../core/icon";
import { fieldFontSizes, fieldHeights, type FieldSize } from "./field-chrome";

export interface SearchFieldProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  size?: FieldSize;
  disabled?: boolean;
  fullWidth?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Filters what is already on screen. It is a pill, not a rounded rectangle —
 * that is what separates it from the data-entry fields: this one changes a
 * view, it does not hold a value to be submitted.
 *
 * It carries no label and no message lane; it belongs in a toolbar, not a form.
 */
export function SearchField({
  value,
  defaultValue = "",
  onChange,
  onClear,
  placeholder = "Search…",
  size = "md",
  disabled = false,
  fullWidth = false,
  ariaLabel = "Search",
  className,
}: SearchFieldProps) {
  const [focus, setFocus] = React.useState(false);
  const [val, set] = useControllableState({ value, defaultValue, onChange });

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-pill border px-3 pl-4 outline-none",
        "transition-[border-color,box-shadow,background-color] duration-[220ms] ease-standard",
        disabled ? "bg-surface-disabled opacity-50" : "bg-surface-card",
        focus ? "border-border-strong shadow-[0_0_0_3px_rgb(11_11_11/0.055)]" : "border-border-subtle",
        fullWidth && "w-full",
        className,
      )}
      style={{ height: fieldHeights[size] }}
    >
      <Icon name="search" size={size === "sm" ? 16 : 18} className="text-text-secondary" />

      <input
        // type="search" gives mobile keyboards a Search key; the browser's own
        // clear affordance is suppressed below in favour of the styled one.
        type="search"
        value={val}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => set(event.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className={cn(
          "min-w-0 flex-1 border-none bg-transparent font-sans text-text-primary outline-none",
          "placeholder:text-text-secondary",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
        style={{ fontSize: fieldFontSizes[size] }}
      />

      {val ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => {
            set("");
            onClear?.();
          }}
          className="inline-flex cursor-pointer border-none bg-transparent p-1 text-text-secondary hover:text-text-primary"
        >
          <Icon name="x" size={16} />
        </button>
      ) : null}
    </div>
  );
}
