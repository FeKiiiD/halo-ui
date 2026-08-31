import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../core/icon";
import { Field } from "./field";
import { fieldChrome, type FieldSize } from "./field-chrome";

export interface EmailListInputProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  help?: string;

  /** Always controlled: the recipient list is the caller's. */
  emails?: string[];
  onChange?: (emails: string[]) => void;

  placeholder?: string;
  max?: number;
  bare?: boolean;
  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;

  invalidLabel?: string;
  duplicateLabel?: string;
  limitLabel?: (max: number) => string;
  id?: string;
  className?: string;
}

/**
 * Deliberately permissive. A stricter pattern rejects addresses that are
 * perfectly valid — plus-addressing, long TLDs, unusual subdomains — and the
 * only authority on whether an address works is whether mail reaches it.
 */
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/** Splits on the separators people actually paste from address books. */
const SEPARATORS = /[,;\s\n]+/;

/**
 * A list of email recipients as chips.
 *
 * Pasting a block of addresses splits it and validates each one, which is how
 * anyone moving a list from a spreadsheet or a mail client expects it to work.
 * Invalid entries are rejected with a message rather than silently dropped —
 * losing a recipient without saying so is worse than refusing one.
 */
export function EmailListInput({
  label = "Recipients",
  hint,
  error,
  help,
  emails = [],
  onChange,
  placeholder = "name@example.com",
  max,
  bare = false,
  size = "md",
  disabled = false,
  required = false,
  invalidLabel = "That is not a valid address.",
  duplicateLabel = "Already in the list.",
  limitLabel = (limit) => `Limit reached: ${limit} maximum.`,
  id,
  className,
}: EmailListInputProps) {
  const [draft, setDraft] = React.useState("");
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [warning, setWarning] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const fieldId =
    id ?? (typeof label === "string" ? `halo-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const full = max !== undefined && emails.length >= max;

  /** Shows a transient message without turning the field permanently red. */
  const flash = (message: string) => {
    setWarning(message);
    const id = setTimeout(() => setWarning(null), 2400);
    timers.current.push(id);
  };

  const commit = (raw: string): boolean => {
    const candidates = raw.split(SEPARATORS).map((s) => s.trim()).filter(Boolean);
    if (!candidates.length) return true;

    const next = [...emails];
    let rejected: string | null = null;

    for (const candidate of candidates) {
      if (max !== undefined && next.length >= max) {
        rejected = limitLabel(max);
        break;
      }
      if (!EMAIL.test(candidate)) {
        rejected = invalidLabel;
        continue;
      }
      if (next.includes(candidate.toLowerCase())) {
        rejected = duplicateLabel;
        continue;
      }
      // Lower-cased on the way in: addresses are case-insensitive in practice,
      // and two spellings of one address would both send.
      next.push(candidate.toLowerCase());
    }

    if (next.length !== emails.length) onChange?.(next);
    if (rejected) flash(rejected);
    return !rejected;
  };

  return (
    <Field
      reserveMessage={!bare}
      label={bare ? undefined : label}
      hint={hint}
      error={error}
      warning={warning ?? undefined}
      help={help}
      htmlFor={fieldId}
      required={required}
      id={fieldId}
      counter={max !== undefined ? `${emails.length} / ${max}` : undefined}
      counterAlert={full}
      className={className}
    >
      <div
        onClick={() => inputRef.current?.focus()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          "flex min-h-12 flex-wrap items-center gap-1.5 px-2 py-1.5",
          disabled ? "cursor-not-allowed" : "cursor-text",
          fieldChrome({
            tone: error ? "error" : warning ? "warning" : null,
            focus,
            hover,
            disabled,
          }),
        )}
      >
        {emails.map((email) => (
          <span
            key={email}
            className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-pill bg-accent py-0 pl-3 pr-1.5 text-body-s font-medium text-accent-ink"
            style={{ animation: "halo-chip-in 220ms var(--ease-standard) both" }}
          >
            <span className="truncate">{email}</span>
            <button
              type="button"
              aria-label={`Remove ${email}`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onChange?.(emails.filter((value) => value !== email));
              }}
              className="inline-flex shrink-0 cursor-pointer border-none bg-transparent p-0.5 text-accent-ink"
            >
              <Icon name="x" size={13} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={fieldId}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={draft}
          placeholder={emails.length ? "" : placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldId ? `${fieldId}-msg` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            // Committing on blur means a typed address is never silently lost
            // by clicking away; if it is rejected, the draft stays put.
            if (commit(draft)) setDraft("");
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (!SEPARATORS.test(text)) return;
            event.preventDefault();
            if (commit(text)) setDraft("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === ";") {
              event.preventDefault();
              if (commit(draft)) setDraft("");
              return;
            }
            if (event.key === "Backspace" && !draft && emails.length) {
              onChange?.(emails.slice(0, -1));
            }
          }}
          className="h-7 min-w-[140px] flex-1 border-none bg-transparent font-sans text-body text-text-primary outline-none placeholder:text-text-secondary"
        />
      </div>
    </Field>
  );
}
