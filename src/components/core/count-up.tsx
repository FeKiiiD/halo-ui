import * as React from "react";
import { cn } from "../../lib/cn";

/** Cubic ease-out: fast at first, settling gently. */
const ease = (t: number): number => 1 - Math.pow(1 - t, 3);

export interface CountUpProps {
  value: number;
  /** Where the first count starts. Defaults to 0. */
  from?: number;
  /** Full control over rendering — currency, units, anything. */
  format?: (value: number) => string;
  duration?: number;
  decimals?: number;
  /** Wait until the figure is actually on screen before counting. */
  startOnView?: boolean;
  /** BCP 47 tag for the default formatter. */
  locale?: string;
  className?: string;
}

/**
 * A number that counts to its value: once when it first scrolls into view, and
 * again on every change.
 *
 * Tabular figures are not optional here — proportional digits change width as
 * they animate, which makes the whole line twitch.
 *
 * Honours `prefers-reduced-motion` by rendering the final value outright.
 */
export function CountUp({
  value,
  from,
  format,
  duration = 620,
  decimals = 0,
  startOnView = true,
  locale = "fr-FR",
  className,
}: CountUpProps) {
  const host = React.useRef<HTMLSpanElement>(null);
  const frame = React.useRef<number | null>(null);
  // The value the last animation actually landed on, so a change mid-flight
  // counts from where the eye is rather than restarting from zero.
  const landed = React.useRef<number | null>(null);

  const [reduced, setReduced] = React.useState(false);
  const [display, setDisplay] = React.useState(() => (startOnView ? (from ?? 0) : value));
  const [armed, setArmed] = React.useState(!startOnView);

  // Read in an effect, not during render: window is absent during SSR and the
  // preference can change while the page is open.
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    if (armed || reduced) {
      setArmed(true);
      return;
    }
    const element = host.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setArmed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setArmed(true);
          observer.disconnect();
        }
      },
      // A third of the figure visible is enough — waiting for all of it means
      // a tall stat starts counting only once it is halfway up the viewport.
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [armed, reduced]);

  React.useEffect(() => {
    if (!armed) return;

    if (reduced) {
      landed.current = value;
      setDisplay(value);
      return;
    }

    const start = landed.current ?? from ?? 0;
    if (start === value) {
      setDisplay(value);
      return;
    }

    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      setDisplay(start + (value - start) * ease(t));

      if (t < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        landed.current = value;
        setDisplay(value);
      }
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, armed, duration, from, reduced]);

  const formatter = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [locale, decimals],
  );

  return (
    <span ref={host} className={cn("tabular-nums", className)}>
      {format ? format(display) : formatter.format(display)}
    </span>
  );
}
