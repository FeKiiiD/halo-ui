import * as React from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Icon } from "../core/icon";
import { Field } from "./field";
import { fieldChrome, fieldFontSizes, fieldHeights, type FieldSize } from "./field-chrome";

export interface PasswordRule {
  label: string;
  ok: boolean;
}

export interface PasswordFieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  /** Shows the strength meter once anything is typed. */
  showStrength?: boolean;
  /** Replaces the built-in checklist. Pass `[]` to hide it entirely. */
  rules?: PasswordRule[];
  capsLockWarning?: string;
  name?: string;
  id?: string;
  className?: string;
}

const levels = [
  { label: "Very weak", className: "text-error", bar: "bg-error" },
  { label: "Weak", className: "text-warning", bar: "bg-warning" },
  { label: "Fair", className: "text-[#C9A227]", bar: "bg-[#C9A227]" },
  { label: "Good", className: "text-success", bar: "bg-success" },
  { label: "Excellent", className: "text-success", bar: "bg-success" },
];

/**
 * Scores a password 0–4 on length and character variety.
 *
 * Length dominates deliberately: a long passphrase of one character class beats
 * a short one with every class, which is what actually resists cracking.
 * Anything under 8 characters scores 0 regardless of how it is composed.
 *
 * Exported so a caller can gate submission on the same number the meter shows.
 */
export function scorePassword(value: string): number {
  if (!value) return 0;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((pattern) => pattern.test(value)).length;

  if (value.length < 8) return 0;
  if (value.length >= 16 && classes >= 3) return 4;
  if (value.length >= 12 && classes >= 3) return 3;
  if (value.length >= 10 && classes >= 2) return 2;
  return 1;
}

/**
 * A password, with a strength meter and a live checklist.
 *
 * The checklist updates as the user types rather than waiting for submission:
 * a rule that only appears after a failed attempt is a rule the user had to
 * guess.
 *
 * Caps Lock is detected on keydown and shown as a warning, because a password
 * field gives no other clue that it is on.
 */
export function PasswordField({
  label = "Password",
  hint,
  error,
  value,
  defaultValue = "",
  onChange,
  onBlur,
  placeholder,
  autoComplete = "new-password",
  size = "md",
  disabled = false,
  required = false,
  showStrength = true,
  rules,
  capsLockWarning = "Caps Lock is on.",
  name,
  id,
  className,
}: PasswordFieldProps) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const [caps, setCaps] = React.useState(false);

  const [val, set] = useControllableState({ value, defaultValue, onChange });

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : "halo-password");
  const level = scorePassword(val);
  const height = fieldHeights[size];

  const checklist =
    rules ??
    [
      { label: "At least 12 characters", ok: val.length >= 12 },
      { label: "An upper and a lower case letter", ok: /[a-z]/.test(val) && /[A-Z]/.test(val) },
      { label: "A digit", ok: /\d/.test(val) },
      { label: "A special character", ok: /[^\w\s]/.test(val) },
    ];

  return (
    <Field
      label={label}
      // Caps Lock displaces the hint: it is the more urgent of the two, and
      // stacking both would push the meter down.
      hint={caps ? undefined : hint}
      warning={caps ? capsLockWarning : undefined}
      error={error}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      className={className}
    >
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
          <Icon name="lock" size={18} />
        </span>

        <input
          id={fieldId}
          name={name}
          type={shown ? "text" : "password"}
          value={val}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${fieldId}-msg`}
          onChange={(event) => set(event.target.value)}
          onKeyDown={(event) => setCaps(event.getModifierState?.("CapsLock") ?? false)}
          onFocus={() => setFocus(true)}
          onBlur={(event) => {
            setFocus(false);
            setCaps(false);
            onBlur?.(event.target.value);
          }}
          className="h-full min-w-0 flex-1 border-none bg-transparent font-sans text-text-primary outline-none placeholder:text-text-secondary"
          style={{ fontSize: fieldFontSizes[size] }}
        />

        <button
          type="button"
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          // preventDefault so revealing does not blur the field and lose the caret.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setShown((s) => !s)}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-text-secondary hover:text-text-primary"
        >
          <Icon name={shown ? "eye-off" : "eye"} size={16} />
        </button>
      </div>

      {showStrength && val ? (
        <div className="mt-0.5 flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1 flex-1 rounded-pill transition-colors duration-[250ms] ease-out",
                    index < level ? levels[level]!.bar : "bg-mist-strong",
                  )}
                />
              ))}
            </div>
            <span className={cn("min-w-[70px] text-right text-body-s", levels[level]!.className)}>
              {levels[level]!.label}
            </span>
          </div>

          {checklist.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {checklist.map((rule) => (
                <li
                  key={rule.label}
                  className={cn(
                    "flex items-center gap-1.5 text-body-s transition-colors duration-[150ms] ease-out",
                    rule.ok ? "text-success" : "text-text-secondary",
                  )}
                >
                  <Icon name={rule.ok ? "circle-check" : "circle"} size={14} />
                  {rule.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Field>
  );
}
