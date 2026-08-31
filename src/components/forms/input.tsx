import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Icon, type IconName } from "../core/icon";
import { Spinner } from "../core/spinner";
import { Field } from "./field";
import {
  fieldChrome,
  fieldFontSizes,
  fieldHeights,
  type FieldSize,
  type FieldTone,
} from "./field-chrome";

export interface InputProps {
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

  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  name?: string;

  /** Drops the label and the message lane — for a field inside a dense row. */
  bare?: boolean;
  size?: FieldSize;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  optional?: boolean;

  iconLeft?: IconName;
  /** Static text before the value: a currency, a scheme, a country code. */
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;

  clearable?: boolean;
  copyable?: boolean;
  /** Shows a spinner in the accent chip — an async check is in flight. */
  validating?: boolean;
  /** Blurs the value behind a reveal toggle. For secrets that are not passwords. */
  masked?: boolean;

  /**
   * A control rendered inside the field, at its right edge — typically a
   * `<FieldAction>` ("Verify", "Send code"). A slot rather than dedicated
   * props, so the action keeps its own API instead of having it re-declared
   * and half-supported here.
   */
  action?: React.ReactNode;

  maxLength?: number;
  id?: string;
  fullWidth?: boolean;
  className?: string;
}

/** Where the celebration sparks fly, and how they tumble. */
const sparks: [number, number, string][] = [
  [-16, -16, "-120deg"],
  [0, -21, "90deg"],
  [16, -15, "-60deg"],
  [20, 2, "160deg"],
  [-20, 0, "60deg"],
  [10, -24, "220deg"],
];

/**
 * The text field the rest of the form group is built on.
 *
 * The whole row is clickable and focuses the input, so the 12px of padding
 * around the text is not dead space.
 *
 * VALIDATION: pass `validating` while an async check runs and `success` when it
 * lands. The transition between the two fires a one-off celebration — a drawn
 * tick with a small burst. It is deliberately cheap and only plays on that
 * edge, never on a field that merely mounts already-valid.
 */
export function Input({
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
  type = "text",
  inputMode,
  autoComplete,
  name,
  bare = false,
  size = "md",
  disabled = false,
  readOnly = false,
  required = false,
  optional = false,
  iconLeft,
  prefix,
  suffix,
  clearable = false,
  copyable = false,
  validating = false,
  masked = false,
  action,
  maxLength,
  id,
  fullWidth = true,
  className,
}: InputProps) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const [celebrate, setCelebrate] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const wasValidating = React.useRef(validating);

  const [val, set] = useControllableState({ value, defaultValue, onChange });

  const inputId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const tone: FieldTone | null = error ? "error" : warning ? "warning" : success ? "success" : null;
  const height = fieldHeights[size];
  const fontSize = fieldFontSizes[size];
  const blurred = masked && !revealed;

  // Celebrate only on the validating → success edge, never on a field that
  // simply mounts valid.
  React.useEffect(() => {
    if (wasValidating.current && !validating && success) {
      setCelebrate(true);
      const id = setTimeout(() => setCelebrate(false), 900);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [validating, success]);

  React.useEffect(() => {
    wasValidating.current = validating;
  }, [validating]);

  const chip = (inner: React.ReactNode, animated?: boolean) => (
    <span
      className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"
      style={animated ? { animation: "halo-pop 300ms ease-out both" } : undefined}
    >
      {inner}
    </span>
  );

  /**
   * onMouseDown preventDefault keeps the input focused when a side button is
   * pressed — without it, clicking "clear" blurs the field and the caret is
   * lost. tabIndex -1 keeps these out of the tab order: they are reachable
   * shortcuts, not stops.
   */
  const sideButton = (glyph: IconName, label: string, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:text-text-primary"
    >
      <Icon name={glyph} size={16} />
    </button>
  );

  const showClear = clearable && val && !disabled && !readOnly;

  return (
    <Field
      reserveMessage={!bare}
      label={bare ? undefined : label}
      hint={hint}
      error={error}
      warning={warning}
      success={success}
      help={help}
      htmlFor={inputId}
      required={required}
      optional={optional}
      id={inputId}
      counter={maxLength ? `${val.length} / ${maxLength}` : undefined}
      counterAlert={maxLength ? val.length >= maxLength * 0.9 : false}
      className={className}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "box-border flex items-center gap-2",
          disabled ? "cursor-not-allowed" : "cursor-text",
          fullWidth && "w-full",
          iconLeft || prefix ? "pl-3" : "pl-3.5",
          action ? "pr-1.5" : "pr-2.5",
          fieldChrome({ tone, focus, hover, disabled, readOnly }),
        )}
        style={{ height }}
      >
        {iconLeft ? (
          <span className="inline-flex shrink-0 text-text-secondary">
            <Icon name={iconLeft} size={size === "sm" ? 16 : 18} />
          </span>
        ) : null}

        {prefix ? (
          <span className="shrink-0 whitespace-nowrap text-text-secondary" style={{ fontSize }}>
            {prefix}
          </span>
        ) : null}

        <input
          ref={inputRef}
          id={inputId}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          name={name}
          value={val}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={inputId ? `${inputId}-msg` : undefined}
          onChange={(event) => set(event.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={(event) => {
            setFocus(false);
            onBlur?.(event.target.value);
          }}
          className={cn(
            "h-full min-w-0 flex-1 border-none bg-transparent font-sans outline-none",
            readOnly ? "text-text-secondary" : "text-text-primary",
            "placeholder:text-text-secondary",
            "transition-[filter] duration-220 ease-standard",
            blurred && "select-none blur-[5px]",
          )}
          style={{ fontSize }}
        />

        {suffix ? (
          <span className="shrink-0 whitespace-nowrap text-text-secondary" style={{ fontSize }}>
            {suffix}
          </span>
        ) : null}

        {validating ? chip(<Spinner size={14} />) : null}

        {tone === "success" && !validating ? (
          <span className="relative inline-flex shrink-0">
            {chip(
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M4 10.6 8 14.5 16 5.5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={
                    celebrate
                      ? {
                          strokeDasharray: 26,
                          strokeDashoffset: 26,
                          animation: "halo-draw 300ms ease-out 80ms forwards",
                        }
                      : undefined
                  }
                />
              </svg>,
              celebrate,
            )}
            {celebrate ? (
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
                {sparks.map(([dx, dy, rotate], index) => (
                  <span
                    key={index}
                    className={cn(
                      "absolute left-1/2 top-1/2 h-0.75",
                      index % 2 ? "w-1.25 bg-ink" : "w-0.75 bg-accent-deep",
                      index % 3 === 0 ? "rounded-full" : "rounded-[1px]",
                    )}
                    style={
                      {
                        "--dx": `${dx}px`,
                        "--dy": `${dy}px`,
                        "--r": rotate,
                        animation: `halo-spark ${500 + index * 40}ms ease-out ${index * 25}ms forwards`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
            ) : null}
          </span>
        ) : null}

        {masked
          ? sideButton(revealed ? "eye-off" : "eye", revealed ? "Hide value" : "Show value", () =>
              setRevealed((r) => !r),
            )
          : null}

        {showClear
          ? sideButton("x", "Clear", () => {
              set("");
              inputRef.current?.focus();
            })
          : null}

        {copyable && val
          ? sideButton(copied ? "check" : "copy", "Copy", () => {
              void navigator.clipboard?.writeText(val);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
          : null}

        {action ? <span className="inline-flex shrink-0">{action}</span> : null}
      </div>
    </Field>
  );
}
