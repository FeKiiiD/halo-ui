import * as React from "react";
import { cn } from "../../lib/cn";
import { useDismissable } from "../../lib/use-dismissable";
import {
  describeView,
  isViewDirty,
  type QueryColumn,
  type SavedView,
  type ViewConfig,
} from "../../lib/table-query";
import { Icon } from "../core/icon";

export interface SavedViewsProps {
  views: SavedView[];
  activeId?: string;
  /** The live table state, compared against the active view. */
  config: ViewConfig;
  columns?: QueryColumn[];

  onSelect?: (view: SavedView) => void;
  onSave?: (view: SavedView) => void;
  onCreate?: (name: string, config: ViewConfig) => void;
  onRename?: (view: SavedView, name: string) => void;
  onDelete?: (view: SavedView) => void;
  onReset?: (view: SavedView) => void;

  labels?: Partial<Record<string, string>>;
  className?: string;
}

/**
 * The saved-view strip.
 *
 * THE DIRTY MARK IS THE WHOLE POINT. A view is a saved arrangement, and the
 * question it has to answer at a glance is "am I looking at what I saved, or
 * at something I have since changed" — because the answer decides whether
 * leaving the page loses work.
 *
 * The comparison is normalised, so rebuilding an identical rule does not mark
 * the view dirty. A badge that is always on is one nobody reads.
 */
export function SavedViews({
  views,
  activeId,
  config,
  columns = [],
  onSelect,
  onSave,
  onCreate,
  onRename,
  onDelete,
  onReset,
  labels,
  className,
}: SavedViewsProps) {
  const text = {
    save: "Save",
    saveAs: "Save as a new view",
    rename: "Rename",
    delete: "Delete",
    reset: "Discard changes",
    unsaved: "unsaved changes",
    newView: "New view",
    namePrompt: "Name",
    more: "View options",
    builtin: "Built-in view",
    ...labels,
  };

  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const menuRef = useDismissable<HTMLDivElement>(Boolean(menuFor), () => setMenuFor(null));

  const active = views.find((view) => view.id === activeId);
  const dirty = isViewDirty(active, config);

  const startRename = (view: SavedView) => {
    setMenuFor(null);
    setRenaming(view.id);
    setDraft(view.name);
  };

  const commitRename = (view: SavedView) => {
    const name = draft.trim();
    // An empty name is a slip, not an intent to blank the label.
    if (name && name !== view.name) onRename?.(view, name);
    setRenaming(null);
  };

  return (
    <div className={cn("flex flex-col gap-1.5 font-sans", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {views.map((view) => {
          const on = view.id === activeId;
          const showDirty = on && dirty;

          return (
            <span key={view.id} className="relative inline-flex">
              {renaming === view.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => commitRename(view)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename(view);
                    if (event.key === "Escape") setRenaming(null);
                  }}
                  aria-label={text.namePrompt}
                  className="h-7.5 w-36 rounded-pill border border-border-strong bg-surface-card px-3 font-sans text-[13px] text-text-primary outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect?.(view)}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "inline-flex h-7.5 items-center gap-1.5 rounded-pill border px-3 font-sans text-[13px] halo-focus",
                    "transition-colors duration-[140ms] ease-standard",
                    on
                      ? "border-transparent bg-action-secondary-bg font-medium text-action-secondary-fg"
                      : "border-border-subtle bg-transparent text-text-primary hover:bg-surface-alt",
                  )}
                >
                  {view.name}

                  {/* The dot, not a word: it has to survive being glanced at
                      in a strip of six tabs. */}
                  {showDirty ? (
                    <span
                      title={text.unsaved}
                      className="size-1.75 shrink-0 rounded-full bg-accent"
                    />
                  ) : null}

                  {on ? (
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={text.more}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuFor(menuFor === view.id ? null : view.id);
                      }}
                      className="-mr-1 inline-flex opacity-70 hover:opacity-100"
                    >
                      <Icon name="chevron-down" size={12} />
                    </span>
                  ) : null}
                </button>
              )}

              {menuFor === view.id ? (
                <div
                  ref={menuRef}
                  role="menu"
                  className="absolute left-0 top-9 z-50 w-52 rounded-panel border border-border-subtle bg-surface-card p-1.25 shadow-float"
                >
                  {dirty ? (
                    <>
                      <MenuItem
                        icon="save"
                        label={text.save!}
                        onClick={() => {
                          onSave?.({ ...view, config });
                          setMenuFor(null);
                        }}
                      />
                      <MenuItem
                        icon="rotate-ccw"
                        label={text.reset!}
                        onClick={() => {
                          onReset?.(view);
                          setMenuFor(null);
                        }}
                      />
                      <span className="mx-1.5 my-1 block h-px bg-hairline" />
                    </>
                  ) : null}

                  <MenuItem
                    icon="copy"
                    label={text.saveAs!}
                    onClick={() => {
                      setMenuFor(null);
                      setCreating(true);
                      setDraft("");
                    }}
                  />

                  {!view.builtin ? (
                    <>
                      <MenuItem icon="pencil" label={text.rename!} onClick={() => startRename(view)} />
                      <MenuItem
                        icon="trash-2"
                        label={text.delete!}
                        tone="error"
                        onClick={() => {
                          onDelete?.(view);
                          setMenuFor(null);
                        }}
                      />
                    </>
                  ) : (
                    <span className="block px-2.5 py-1.5 text-[11.5px] text-text-secondary">
                      {text.builtin}
                    </span>
                  )}
                </div>
              ) : null}
            </span>
          );
        })}

        {creating ? (
          <input
            autoFocus
            value={draft}
            placeholder={text.newView}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (draft.trim()) onCreate?.(draft.trim(), config);
              setCreating(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                if (draft.trim()) onCreate?.(draft.trim(), config);
                setCreating(false);
              }
              if (event.key === "Escape") setCreating(false);
            }}
            aria-label={text.namePrompt}
            className="h-7.5 w-36 rounded-pill border border-border-strong bg-surface-card px-3 font-sans text-[13px] text-text-primary outline-none"
          />
        ) : (
          <button
            type="button"
            aria-label={text.saveAs}
            title={text.saveAs}
            onClick={() => {
              setCreating(true);
              setDraft("");
            }}
            className="inline-flex size-7.5 items-center justify-center rounded-pill border border-dashed border-border-subtle bg-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary halo-focus"
          >
            <Icon name="plus" size={13} />
          </button>
        )}

        {dirty && active ? (
          <button
            type="button"
            onClick={() => onSave?.({ ...active, config })}
            className="ml-auto inline-flex h-7.5 items-center gap-1.5 rounded-pill bg-accent px-3 font-sans text-[13px] font-medium text-accent-ink halo-focus"
          >
            <Icon name="save" size={13} />
            {text.save}
          </button>
        ) : null}
      </div>

      <span className="text-[12px] text-text-secondary">{describeView(config, columns)}</span>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  onClick: () => void;
  tone?: "error";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-lg border-none bg-transparent px-2.5 text-left font-sans text-[13px] hover:bg-mist halo-focus",
        tone === "error" ? "text-error" : "text-text-primary",
      )}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}
