import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Field } from "./field";
import { fieldChrome, type FieldTone } from "./field-chrome";

export interface TextareaProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  warning?: React.ReactNode;
  success?: React.ReactNode;
  help?: string;

  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;

  rows?: number;
  /** Ceiling for auto-resize. Past this the textarea scrolls instead. */
  maxRows?: number;
  /** Grows with its content. Turn off to get the native drag handle back. */
  autoResize?: boolean;

  bare?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  optional?: boolean;
  maxLength?: number;
  name?: string;
  id?: string;
  className?: string;
}

/** Matches the 24px line-height and the 12px vertical padding below. */
const LINE_HEIGHT = 24;
const VERTICAL_PADDING = 24;

/**
 * Multi-line text that grows with its content.
 *
 * Auto-resize measures rather than counting characters, because a proportional
 * font makes character counts meaningless. Resetting the height to `auto`
 * before reading `scrollHeight` is what lets it shrink again — without that it
 * only ever grows.
 */
export function Textarea({
  label,
  hint,
  error,
  warning,
  success,
  help,
  value,
  defaultValue = "",
  onChange,
  onBlur,
  placeholder,
  rows = 3,
  maxRows = 12,
  autoResize = true,
  bare = false,
  disabled = false,
  readOnly = false,
  required = false,
  optional = false,
  maxLength,
  name,
  id,
  className,
}: TextareaProps) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const [val, set] = useControllableState({ value, defaultValue, onChange });

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const tone: FieldTone | null = error ? "error" : warning ? "warning" : success ? "success" : null;

  // Layout effect, not effect: measuring after paint would show one frame at
  // the old height on every keystroke.
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !autoResize) return;

    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, maxRows * LINE_HEIGHT + VERTICAL_PADDING)}px`;
  }, [val, autoResize, maxRows]);

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
      optional={optional}
      id={fieldId}
      counter={maxLength ? `${val.length} / ${maxLength}` : undefined}
      counterAlert={maxLength ? val.length >= maxLength * 0.9 : false}
      className={className}
    >
      <textarea
        ref={ref}
        id={fieldId}
        name={name}
        rows={rows}
        value={val}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldId ? `${fieldId}-msg` : undefined}
        onChange={(event) => set(event.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={(event) => {
          setFocus(false);
          onBlur?.(event.target.value);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          "box-border w-full overflow-auto px-4 py-3 font-sans text-body leading-6",
          readOnly ? "text-text-secondary" : "text-text-primary",
          "placeholder:text-text-secondary",
          autoResize ? "resize-none" : "resize-y",
          fieldChrome({ tone, focus, hover, disabled, readOnly }),
        )}
      />
    </Field>
  );
}
