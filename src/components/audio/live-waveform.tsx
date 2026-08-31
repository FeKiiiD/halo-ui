import * as React from "react";
import { cn } from "../../lib/cn";

export type WaveformMode = "scrolling" | "mirror";

export interface LiveWaveformProps {
  /** Opens the microphone and animates. */
  active?: boolean;
  /** A quieter idling pattern, for the interval after recording stops. */
  processing?: boolean;

  /** `scrolling` pushes each sample in from the right; `mirror` pulses all
   *  bars from one level. */
  mode?: WaveformMode;

  bars?: number;
  height?: number;
  barWidth?: number;
  barGap?: number;
  /** Multiplies the measured peak. Above 1 makes a quiet room look busier. */
  sensitivity?: number;

  /** Called if the microphone is refused or unavailable. */
  onError?: (error: unknown) => void;
  className?: string;
}

/** The bar height when there is no signal at all. */
const FLOOR = 0.06;

/**
 * A canvas bar visualiser.
 *
 * IT FALLS BACK TO A SYNTHETIC SIGNAL. A refused microphone is the common case
 * — a sandboxed preview, a denied permission, an insecure origin — and a
 * control that freezes flat reads as broken rather than as blocked. The
 * fallback keeps it legibly "listening" while `onError` tells the caller what
 * actually happened, so the caller can say so in words.
 *
 * Canvas rather than DOM: at 48 bars and 60fps this is 2 880 style writes a
 * second, which is exactly the workload canvas exists for.
 */
export function LiveWaveform({
  active = false,
  processing = false,
  mode = "scrolling",
  bars = 48,
  height = 40,
  barWidth = 3,
  barGap = 2,
  sensitivity = 1.6,
  onError,
  className,
}: LiveWaveformProps) {
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const frame = React.useRef<number | null>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const audioContext = React.useRef<AudioContext | null>(null);
  const analyser = React.useRef<AnalyserNode | null>(null);
  const levels = React.useRef<number[]>(new Array(bars).fill(FLOOR));

  // Read inside the animation loop, which must not be rebuilt per prop change.
  const settings = React.useRef({ active, processing, mode, barWidth, barGap, sensitivity });
  settings.current = { active, processing, mode, barWidth, barGap, sensitivity };

  const draw = React.useCallback(() => {
    const element = canvas.current;
    if (!element) return;

    const context = element.getContext("2d");
    if (!context) return;

    const { barWidth: width, barGap: gap, active: on } = settings.current;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = element.clientWidth;
    const cssHeight = element.clientHeight;

    // Resize only when it actually changed: assigning width clears the canvas.
    if (element.width !== Math.round(cssWidth * dpr)) {
      element.width = Math.round(cssWidth * dpr);
      element.height = Math.round(cssHeight * dpr);
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);

    // The colour comes from the element's own computed `color`, so the bars
    // follow the theme without the component knowing any token names.
    context.fillStyle = getComputedStyle(element).color || "#0b0b0b";
    context.globalAlpha = on ? 1 : 0.35;

    const pitch = width + gap;
    const count = Math.min(levels.current.length, Math.max(1, Math.floor(cssWidth / pitch)));
    const offset = Math.max(0, (cssWidth - count * pitch) / 2);

    for (let i = 0; i < count; i++) {
      // Read from the end: the newest samples are the ones on screen.
      const level = levels.current[levels.current.length - count + i] ?? FLOOR;
      const barHeight = Math.max(2, level * (cssHeight - 4));
      const x = offset + i * pitch;
      const y = (cssHeight - barHeight) / 2;

      context.beginPath();
      if (context.roundRect) context.roundRect(x, y, width, barHeight, width / 2);
      else context.rect(x, y, width, barHeight);
      context.fill();
    }
  }, []);

  const sample = React.useCallback(() => {
    const node = analyser.current;

    if (node) {
      const buffer = new Uint8Array(node.frequencyBinCount);
      node.getByteTimeDomainData(buffer);

      // Peak deviation from the 128 midpoint, normalised.
      let peak = 0;
      for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128) / 128);
      return Math.min(1, peak * settings.current.sensitivity);
    }

    // No microphone: three detuned sines so the shape never visibly repeats.
    const t = performance.now() / 210;
    const wobble = (Math.sin(t) + Math.sin(t * 1.7) + Math.sin(t * 0.6)) / 3;
    return Math.min(1, Math.max(0.08, 0.42 + wobble * 0.38 + Math.random() * 0.16));
  }, []);

  const stop = React.useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;

    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;

    void audioContext.current?.close().catch(() => undefined);
    audioContext.current = null;
    analyser.current = null;
  }, []);

  React.useEffect(() => {
    if (!active) {
      stop();
      levels.current = new Array(bars).fill(FLOOR);
      draw();
      return;
    }

    let cancelled = false;

    const tick = () => {
      const next = levels.current.slice();
      const value = settings.current.processing
        ? // Processing is not listening: a low, even pulse rather than a
          // signal, so it cannot be mistaken for the microphone still being on.
          0.1 + Math.abs(Math.sin(performance.now() / 260)) * 0.12
        : sample();

      if (settings.current.mode === "scrolling") {
        next.shift();
        next.push(value);
      } else {
        for (let i = 0; i < next.length; i++) {
          next[i] = Math.max(
            FLOOR,
            value * (0.45 + Math.abs(Math.sin(i * 0.7 + performance.now() / 400)) * 0.75),
          );
        }
      }

      levels.current = next;
      draw();
      frame.current = requestAnimationFrame(tick);
    };

    void (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: true });

        // The await can outlive the effect — stop the tracks rather than
        // leaving the browser's recording indicator lit.
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        stream.current = media;
        const context = new AudioContext();
        const node = context.createAnalyser();
        node.fftSize = 512;
        context.createMediaStreamSource(media).connect(node);

        audioContext.current = context;
        analyser.current = node;
      } catch (error) {
        // Not fatal: the loop runs on the synthetic signal instead.
        if (!cancelled) onError?.(error);
      }

      if (!cancelled && frame.current === null) frame.current = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, bars]);

  // One paint on mount, so the idle bars exist before anything is recorded.
  React.useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={cn(
        "block w-full",
        // currentColor is what draw() reads, so the bars follow the theme.
        active && !processing ? "text-text-primary" : "text-text-secondary",
        className,
      )}
      style={{ height }}
    />
  );
}
