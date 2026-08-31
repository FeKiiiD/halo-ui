import * as React from "react";
import { cn } from "../../lib/cn";
import { playError, playSuccess } from "../../lib/feedback-sound";
import { Field } from "./field";

export interface CodeInputProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  success?: React.ReactNode;
  length?: number;
  /** Always controlled: the digits are the caller's state. */
  value?: string;
  onChange?: (value: string) => void;
  /**
   * Fired once the last digit lands. Resolving `false` or throwing clears the
   * field and returns focus to the first cell.
   */
  onComplete?: (code: string) => unknown | Promise<unknown>;
  disabled?: boolean;
  /** Defaults to `counter`: a code is almost always entered on a phone. */
  size?: "md" | "counter";
  autoFocus?: boolean;
  className?: string;
}

type CodePhase = "idle" | "checking" | "success" | "error";

/**
 * A short numeric code, one digit per cell.
 *
 * INVERTED ON PURPOSE: the cells are ink with white digits, not white with ink
 * digits. A code screen has nothing else on it, and the block of dark cells is
 * what makes the field findable at arm's length — this is the one input in the
 * system that inverts.
 *
 * Verification fires by itself when the last digit lands: asking someone to
 * press a button after typing a code they just read off a phone is a step that
 * exists only for the developer's convenience.
 */
export function CodeInput({
  label,
  hint,
  error,
  success,
  length = 4,
  value = "",
  onChange,
  onComplete,
  disabled = false,
  size = "counter",
  autoFocus = false,
  className,
}: CodeInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [at, setAt] = React.useState(-1);
  const [phase, setPhase] = React.useState<CodePhase>("idle");

  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = React.useRef(true);
  // Latched so a re-render mid-verification cannot fire onComplete twice.
  const fired = React.useRef(false);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (alive.current) fn();
    }, ms);
    timers.current.push(id);
  };

  // A verdict handed down from outside (the caller validated elsewhere) plays
  // its sound once, then clears itself.
  React.useEffect(() => {
    if (error) {
      setPhase("error");
      playError();
      later(() => setPhase("idle"), 1600);
    } else if (success) {
      setPhase("success");
      playSuccess();
    }
    // Only the identity of the verdict matters, not its text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(error), Boolean(success)]);

  const verify = async (code: string) => {
    if (!onComplete || fired.current) return;
    fired.current = true;
    setPhase("checking");

    let ok = true;
    try {
      const returned = await onComplete(code);
      ok = returned !== false;
    } catch {
      ok = false;
    }

    later(() => {
      if (ok) {
        playSuccess();
        setPhase("success");
        return;
      }
      playError();
      setPhase("error");
      // Clear and hand focus back, so a wrong code can be retyped immediately.
      later(() => {
        setPhase("idle");
        fired.current = false;
        onChange?.("");
        refs.current[0]?.focus();
      }, 900);
    }, 380);
  };

  const put = (index: number, char: string) => {
    if (phase === "success" || phase === "checking") return;

    const next = (value.slice(0, index) + char + value.slice(index + 1)).slice(0, length);
    onChange?.(next);

    if (char) refs.current[index + 1]?.focus();
    if (next.replace(/\D/g, "").length === length) void verify(next);
  };

  const ok = phase === "success";
  const bad = phase === "error";
  const busy = phase === "checking";
  const box = size === "counter" ? 56 : 48;

  return (
    <Field label={label} hint={hint} error={error} success={success} className={className}>
      <div
        className="flex gap-2"
        style={bad ? { animation: "halo-shake 460ms var(--ease-standard) 1" } : undefined}
      >
        {Array.from({ length }, (_, index) => {
          const char = value[index] ?? "";
          return (
            <input
              key={index}
              ref={(element) => {
                refs.current[index] = element;
              }}
              // inputMode numeric brings up the digit pad without type="number"
              // dragging in spinners and scroll-to-change.
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={char}
              disabled={disabled || ok || busy}
              autoFocus={autoFocus && index === 0}
              aria-label={`Digit ${index + 1} of ${length}`}
              onChange={(event) => put(index, event.target.value.replace(/\D/g, "").slice(-1))}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && !char && index > 0) {
                  event.preventDefault();
                  refs.current[index - 1]?.focus();
                  put(index - 1, "");
                }
                if (event.key === "ArrowLeft") refs.current[index - 1]?.focus();
                if (event.key === "ArrowRight") refs.current[index + 1]?.focus();
              }}
              onFocus={() => setAt(index)}
              onBlur={() => setAt((current) => (current === index ? -1 : current))}
              onPaste={(event) => {
                // A pasted code fills every cell at once rather than dropping
                // all but the first character into this one.
                event.preventDefault();
                const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
                onChange?.(text);
                if (text.length === length) void verify(text);
              }}
              className={cn(
                "rounded-input border text-center font-sans font-medium tabular-nums outline-none",
                "transition-[background-color,border-color,color,box-shadow] duration-[220ms] ease-standard",
                size === "counter" ? "text-[24px]" : "text-[20px]",
                disabled
                  ? "border-border-subtle bg-surface-disabled text-text-secondary opacity-50"
                  : ok
                    ? "border-accent bg-accent text-ink"
                    : bad
                      ? "border-error bg-error-soft text-error"
                      : "border-ink bg-ink text-paper",
                busy && "opacity-75",
                at === index && !ok && !bad && "shadow-[0_0_0_3px_rgb(217_248_79/0.28)]",
              )}
              style={{
                width: box,
                height: box,
                // The caret must invert with the fill or it disappears.
                caretColor: ok || bad ? "var(--color-ink)" : "var(--color-paper)",
                ...(ok
                  ? { animation: `halo-pop 300ms var(--ease-standard) ${index * 60}ms both` }
                  : null),
              }}
            />
          );
        })}
      </div>
    </Field>
  );
}
