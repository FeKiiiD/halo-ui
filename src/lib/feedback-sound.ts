/**
 * Audio feedback for the buttons that wait on a server answer.
 *
 * Synthesised with WebAudio — no asset files to ship, and nothing plays before
 * a user gesture, so no autoplay policy is ever violated: every call site is
 * downstream of a click or a key press.
 */

let ctx: AudioContext | null = null;
let muted = false;

/** Silence every feedback sound in the app. Persist the user's choice yourself. */
export function setFeedbackMuted(value: boolean): void {
  muted = value;
}

export function isFeedbackMuted(): boolean {
  return muted;
}

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;

  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;

  ctx ??= new AC();
  // Browsers park the context until a gesture; every caller is post-gesture.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneSpec {
  freq: number;
  at: number;
  dur: number;
  peak?: number;
  type?: OscillatorType;
  /** Glide target — omit for a flat note. */
  to?: number;
}

function tone(ac: AudioContext, spec: ToneSpec): void {
  const { freq, at, dur, peak = 0.07, type = "sine", to } = spec;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t0 = ac.currentTime + at;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);

  // Exponential ramps cannot touch zero, hence the 0.0001 floor.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Two rising notes: it went through. */
export function playSuccess(): void {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 660, at: 0, dur: 0.11, peak: 0.06 });
  tone(ac, { freq: 990, at: 0.09, dur: 0.2, peak: 0.05 });
}

/** One low falling note: it did not. */
export function playError(): void {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 220, to: 140, at: 0, dur: 0.26, peak: 0.075, type: "triangle" });
  tone(ac, { freq: 150, at: 0.05, dur: 0.22, peak: 0.05, type: "triangle" });
}
