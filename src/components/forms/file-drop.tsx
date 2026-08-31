import * as React from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../core/icon";
import { Field } from "./field";

export interface DroppedFile {
  name: string;
  size?: number;
  /** 0–100 while uploading. Omit once the upload is not in flight. */
  progress?: number;
  /** Marks the row as finished. */
  done?: boolean;
  error?: string;
  /** Plays the removal animation before the caller drops it from the list. */
  removing?: boolean;
}

export interface FileDropProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  help?: string;

  /**
   * The rows to show. Upload state is the caller's — this component renders
   * progress, it does not perform the upload.
   */
  files?: DroppedFile[];
  onFiles?: (files: File[]) => void;
  onRemove?: (name: string) => void;
  onRetry?: (name: string) => void;

  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** The constraint line under the prompt: formats, size limit. */
  note?: string;
  promptSingle?: string;
  promptMultiple?: string;
  doneLabel?: string;
  retryLabel?: string;
  className?: string;
}

/** 1 048 576 bytes → "1.0 MB"; anything smaller in whole kilobytes. */
function formatSize(bytes: number): string {
  return bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * A drop zone with a list of what has been dropped.
 *
 * IT DOES NOT UPLOAD. The caller owns the transfer and feeds `progress`,
 * `done` and `error` back per file — which is what lets the same component sit
 * in front of a direct POST, a presigned S3 PUT, or a resumable upload.
 *
 * The zone is a real button: clickable, focusable, and activated by Enter or
 * Space, because drag-and-drop alone excludes anyone not using a mouse.
 */
export function FileDrop({
  label,
  hint,
  error,
  help,
  files = [],
  onFiles,
  onRemove,
  onRetry,
  accept = "image/*",
  multiple = false,
  disabled = false,
  required = false,
  note = "PNG or JPG, 2 MB maximum",
  promptSingle = "Drop a file or browse",
  promptMultiple = "Drop your files or browse",
  doneLabel = "Upload complete.",
  retryLabel = "Retry",
  className,
}: FileDropProps) {
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const take = (list: FileList | null) => {
    if (!list?.length || !onFiles) return;
    onFiles(Array.from(list).slice(0, multiple ? undefined : 1));
  };

  return (
    <Field label={label} hint={hint} error={error} help={help} required={required} className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={typeof label === "string" ? label : "Drop a file"}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          inputRef.current?.click();
        }}
        // preventDefault on dragover is what tells the browser a drop is
        // allowed here; without it the file opens in a new tab instead.
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          if (!disabled) take(event.dataTransfer.files);
        }}
        className={cn(
          "flex items-center gap-4 rounded-input border-[1.5px] border-dashed p-6 halo-focus",
          "transition-[background-color,border-color] duration-[150ms] ease-out",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          over ? "bg-mist" : "bg-surface-disabled",
          error ? "border-error" : over ? "border-ink" : "border-border-subtle",
        )}
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-chip bg-accent text-accent-ink">
          <span
            className="inline-flex"
            style={over ? { animation: "halo-file-arrow 700ms ease-in-out infinite" } : undefined}
          >
            <Icon name="upload" size={20} />
          </span>
        </span>

        <span className="flex flex-col gap-0.5">
          <span className="text-body font-medium text-text-primary">
            {multiple ? promptMultiple : promptSingle}
          </span>
          <span className="text-body-s text-text-secondary">{note}</span>
        </span>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => take(event.target.files)}
          className="hidden"
        />
      </div>

      {files.length ? (
        <ul className="m-0 mt-1.5 flex list-none flex-col gap-1.5 p-0">
          {files.map((file) => {
            const uploading = file.progress !== undefined && file.progress < 100 && !file.done;

            return (
              <li
                key={file.name}
                className={cn(
                  "flex items-center gap-2.5 overflow-hidden rounded-input border px-2.5 py-2",
                  "transition-[background-color,border-color] duration-[260ms] ease-standard",
                  file.error
                    ? "border-error bg-error-soft"
                    : file.done
                      ? "border-accent bg-accent"
                      : "border-hairline bg-surface-card",
                )}
                style={{
                  animation: file.removing
                    ? "halo-file-out 220ms cubic-bezier(.4,0,1,1) both"
                    : file.error
                      ? "halo-shake 440ms var(--ease-standard) 1, halo-file-in 220ms ease-out both"
                      : "halo-file-in 220ms ease-out both",
                }}
              >
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
                    file.error
                      ? "bg-surface-card text-error"
                      : file.done
                        ? "bg-ink text-accent"
                        : "bg-accent text-accent-ink",
                  )}
                  style={
                    file.done || file.error
                      ? { animation: "halo-pop 300ms var(--ease-standard) both" }
                      : undefined
                  }
                >
                  {file.done ? (
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M4 10.6 8 14.5 16 5.5"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          strokeDasharray: 26,
                          strokeDashoffset: 26,
                          animation: "halo-draw 300ms var(--ease-standard) 80ms forwards",
                        }}
                      />
                    </svg>
                  ) : file.error ? (
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : uploading ? (
                    <span
                      className="inline-flex"
                      style={{ animation: "halo-spin 900ms linear infinite" }}
                    >
                      <Icon name="loader" size={16} />
                    </span>
                  ) : (
                    <Icon name="file-check" size={16} />
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.75">
                  {/* A finished row has a fixed accent fill, so its text must
                      be ink rather than the theme-following colour — which
                      would go white on lime in dark mode. */}
                  <span
                    className={cn(
                      "flex justify-between gap-2 text-body-s font-medium",
                      file.done ? "text-accent-ink" : "text-text-primary",
                    )}
                  >
                    <span className="truncate">{file.name}</span>
                    {file.size ? (
                      <span
                        className={cn(
                          "whitespace-nowrap font-normal",
                          file.done ? "text-accent-ink/70" : "text-text-secondary",
                        )}
                      >
                        {formatSize(file.size)}
                      </span>
                    ) : null}
                  </span>

                  {file.error ? (
                    <span className="text-[12px] text-error">{file.error}</span>
                  ) : uploading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-pill bg-mist-strong">
                        {/* Barber-pole stripes, so a stalled transfer still
                            reads as "in progress" rather than "frozen". */}
                        <span
                          className="block h-full transition-[width] duration-[250ms] ease-out"
                          style={{
                            width: `${file.progress}%`,
                            background:
                              "repeating-linear-gradient(115deg, var(--color-ink) 0 8px, #2C2C2C 8px 16px)",
                            backgroundSize: "24px 100%",
                            animation: "halo-file-bar 600ms linear infinite",
                          }}
                        />
                      </span>
                      <span className="min-w-[30px] text-right text-[11px] tabular-nums text-text-secondary">
                        {Math.round(file.progress ?? 0)} %
                      </span>
                    </span>
                  ) : file.done ? (
                    <span className="text-[12px] font-medium text-accent-ink">{doneLabel}</span>
                  ) : null}
                </span>

                {file.error && onRetry ? (
                  <button
                    type="button"
                    onClick={() => onRetry(file.name)}
                    className="h-6.5 shrink-0 rounded-pill border border-error bg-transparent px-2.5 font-sans text-[12px] font-medium text-error halo-focus"
                  >
                    {retryLabel}
                  </button>
                ) : null}

                {onRemove ? (
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onRemove(file.name)}
                    className={cn(
                      "inline-flex shrink-0 cursor-pointer border-none bg-transparent p-1 halo-focus",
                      file.done
                        ? "text-accent-ink/70 hover:text-accent-ink"
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <Icon name="x" size={15} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </Field>
  );
}
