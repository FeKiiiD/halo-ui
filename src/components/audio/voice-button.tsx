import * as React from "react";
import { cn } from "../../lib/cn";
import { useAsyncVerdict } from "../../lib/use-async-verdict";
import { Icon } from "../core/icon";
import {
  VerdictCheck,
  VerdictCross,
  actionSizing,
  type ActionButtonSize,
} from "../core/action-button-shell";
import { LiveWaveform } from "./live-waveform";

export interface VoiceButtonProps {
  children?: React.ReactNode;
  recordingLabel?: string;
  processingLabel?: string;
  successLabel?: string;
  errorLabel?: string;

  /** Runs when recording stops. Throwing, or resolving `false`, plays the
   *  error choreography. */
  onRecord?: () => unknown | Promise<unknown>;
  /** Called if the microphone itself is unavailable. */
  onMicError?: (error: unknown) => void;

  shortcut?: string;
  size?: ActionButtonSize;
  disabled?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
  className?: string;
}

/**
 * Dictation, as one control.
 *
 * RECORDING IS A STATE, NOT A BUSY PHASE, so this does not hand the whole
 * lifecycle to `useAsyncVerdict`: recording ends when the user says it does,
 * not when a promise settles. The hook takes over the moment they stop, which
 * is where a floor on the busy phase and a verdict actually apply.
 *
 * While recording the button is lime with a live waveform — the accent marks
 * the one thing on screen that is capturing, and the red dot says so again for
 * anyone who cannot see the difference.
 */
export function VoiceButton({
  children = "Dictate",
  recordingLabel = "Listening…",
  processingLabel = "Transcribing…",
  successLabel = "Transcribed.",
  errorLabel = "No microphone.",
  onRecord,
  onMicError,
  shortcut,
  size = "md",
  disabled = false,
  iconOnly = false,
  minWidth = 200,
  className,
}: VoiceButtonProps) {
  const sizing = actionSizing[size];
  const [recording, setRecording] = React.useState(false);

  const { phase, run, locked } = useAsyncVerdict({
    onAction: onRecord,
    // 700ms: a transcription that returns instantly still has to look like it
    // was read, or the waveform vanishing reads as a dropped recording.
    minBusy: 700,
  });

  const busy = phase === "busy";

  const press = () => {
    if (disabled || locked) return;

    if (recording) {
      setRecording(false);
      void run();
      return;
    }
    setRecording(true);
  };

  const fill = disabled
    ? "bg-surface-disabled text-text-secondary"
    : phase === "error"
      ? "bg-error-soft text-error"
      : phase === "success" || recording
        ? "bg-accent text-accent-ink"
        : "bg-action-secondary-bg text-action-secondary-fg hover:bg-action-secondary-bg-hover";

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={press}
      aria-label={iconOnly ? String(children) : undefined}
      aria-pressed={recording}
      aria-busy={busy}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-pill border-none",
        "font-sans font-medium leading-[var(--lh-button)] whitespace-nowrap halo-focus",
        "transition-[background-color,color] duration-[var(--dur-base)] ease-standard",
        // box always: it carries the height. square only overrides the width,
        // so replacing box left an icon-only button pill-shaped.
        sizing.box,
        iconOnly && cn('px-0', sizing.square),
        sizing.text,
        fill,
        disabled ? "cursor-not-allowed" : busy ? "cursor-progress" : "cursor-pointer",
        className,
      )}
      style={{
        minWidth: iconOnly ? undefined : minWidth,
        animation:
          phase === "error"
            ? "halo-shake 440ms var(--ease-standard) 1"
            : recording
              ? "halo-voice-halo 1400ms ease-out infinite"
              : undefined,
      }}
    >
      {!recording && (phase === "idle" || busy) ? (
        <>
          <Icon
            name={busy ? "loader" : "mic"}
            size={sizing.icon}
            className={busy ? "animate-[halo-spin_900ms_linear_infinite]" : undefined}
          />
          {iconOnly ? null : <span>{busy ? processingLabel : children}</span>}
        </>
      ) : null}

      {recording ? (
        <>
          {/* The dot repeats what the lime already says, for anyone who cannot
              tell the two fills apart. */}
          <span className="size-2 shrink-0 rounded-full bg-error" />
          {iconOnly ? null : <span>{recordingLabel}</span>}
          {iconOnly ? null : (
            <span className="block w-[74px] shrink-0">
              <LiveWaveform
                active
                bars={22}
                height={20}
                barWidth={2}
                barGap={2}
                mode="scrolling"
                onError={onMicError}
              />
            </span>
          )}
        </>
      ) : null}

      {phase === "success" ? (
        <span
          className="inline-flex items-center gap-2"
          style={{ animation: "halo-pop 280ms var(--ease-standard) both" }}
        >
          <VerdictCheck size={sizing.icon} />
          {iconOnly ? null : successLabel}
        </span>
      ) : null}

      {phase === "error" ? (
        <span
          className="inline-flex items-center gap-2"
          style={{ animation: "halo-pop 240ms var(--ease-standard) both" }}
        >
          <VerdictCross size={sizing.icon} />
          {iconOnly ? null : errorLabel}
        </span>
      ) : null}

      {shortcut && phase === "idle" && !recording && !iconOnly ? (
        <span className="ml-1 rounded-md bg-current/15 px-1.5 py-0.5 text-[11px] font-medium tracking-[0.02em]">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}
