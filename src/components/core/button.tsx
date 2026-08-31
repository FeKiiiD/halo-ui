import * as React from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "outlined" | "texted";
export type ButtonSize = "sm" | "md" | "counter";

export interface ButtonMenuItem {
  label: string;
  onSelect?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  tone?: "default" | "error";
}

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onSelect"> {
  /** `primary` lime · `secondary` ink · `outlined` 1.5px hairline · `texted` bare. */
  variant?: ButtonVariant;
  /** 40 / 48 / 56px. `counter` is the standing, at-the-counter target. */
  size?: ButtonSize;
  /** Swaps the label for a spinner and blocks interaction. */
  loading?: boolean;
  /** Square pill: pass the glyph as `iconLeft` and no label. */
  iconOnly?: boolean;
  /** Adds a chevron segment, divided by a hairline. Back-office only. */
  split?: boolean;
  fullWidth?: boolean;
  /**
   * Sitting on the ink régime. `outlined` and `texted` then keep a white label
   * and tint with translucent white — picking up the mint fill would swallow
   * the label — and `secondary` inverts to a white pill.
   */
  onDark?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  /** Passing these makes the chevron open a real menu. */
  menuItems?: ButtonMenuItem[];
  /** Handler for the chevron when you own the popover yourself. */
  onMenu?: () => void;
  menuAlign?: "left" | "right";
  menuLabel?: string;
  type?: "button" | "submit" | "reset";
}

const sizing: Record<ButtonSize, { box: string; text: string; icon: number; square: string }> = {
  sm: { box: "h-10 px-5", text: "text-[14px]", icon: 16, square: "w-10" },
  counter: { box: "h-14 px-9", text: "text-[17px]", icon: 20, square: "w-14" },
  md: { box: "h-12 px-control-px", text: "text-button", icon: 18, square: "w-12" },
};

/**
 * Colour is the only thing hover and press change — never position, never a
 * shadow. Disabled is a flat grey fill at full opacity, not a translucent
 * button: a ghosted control is harder to read than a solid grey one.
 */
function skin(variant: ButtonVariant, onDark: boolean): string {
  if (variant === "secondary") {
    return onDark
      ? "bg-paper text-ink hover:bg-mist active:bg-mist-strong disabled:bg-surface-disabled disabled:text-text-secondary"
      : "bg-action-secondary-bg text-action-secondary-fg hover:bg-action-secondary-bg-hover active:bg-action-secondary-bg-hover disabled:bg-surface-disabled disabled:text-text-secondary";
  }

  if (variant === "outlined" || variant === "texted") {
    const bordered =
      variant === "outlined"
        ? onDark
          ? "border-[1.5px] border-[#2E2E2E] hover:border-paper disabled:border-[#242424]"
          : "border-[1.5px] border-border-subtle hover:border-border-strong disabled:border-border-subtle"
        : "border-none";

    const tint = onDark
      ? "text-paper hover:bg-white/10 active:bg-white/[0.18] disabled:text-[#5A5F5F]"
      : "text-text-primary hover:bg-mist active:bg-mist-strong disabled:text-text-secondary";

    return cn("bg-transparent disabled:bg-transparent", bordered, tint);
  }

  return "bg-action-primary-bg text-action-primary-fg hover:bg-action-primary-bg-hover active:bg-action-primary-bg-press disabled:bg-surface-disabled disabled:text-text-secondary";
}

/**
 * The pill action, and the component everything else is measured against.
 *
 * The total pill is a signature and is never softened to a rounded rectangle,
 * not even for icon-only or split buttons. Primary is lime with ink text —
 * never white text — and there is at most one on any visible screen: two
 * primary buttons side by side cancel each other out.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    iconOnly = false,
    split = false,
    fullWidth = false,
    onDark = false,
    iconLeft,
    iconRight,
    menuItems,
    onMenu,
    menuAlign = "right",
    menuLabel = "More options",
    type = "button",
    disabled = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  const [open, setOpen] = React.useState(false);
  const wrap = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const away = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const g = sizing[size];
  const isDisabled = disabled || loading;

  const face = cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-sans font-medium leading-[1] halo-focus",
    "transition-[background-color,border-color,color] duration-[120ms] ease-standard",
    "disabled:cursor-not-allowed",
    g.box,
    g.text,
    iconOnly && cn("px-0", g.square),
    skin(variant, onDark),
  );

  const body = iconOnly ? (
    loading ? <Spinner size={g.icon - 2} /> : (iconLeft ?? children)
  ) : (
    <>
      {loading ? <Spinner size={g.icon - 2} /> : iconLeft}
      {children}
      {iconRight}
    </>
  );

  if (!split) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(face, "rounded-pill", fullWidth && !iconOnly && "w-full", className)}
        {...rest}
      >
        {body}
      </button>
    );
  }

  const items = menuItems ?? [];
  // The divider has to read against the fill it sits on, so it is a tint of the
  // label colour rather than a border token.
  const divider =
    variant === "primary" || variant === "secondary"
      ? "border-r-black/[0.18]"
      : onDark
        ? "border-r-[#2E2E2E]"
        : "border-r-hairline";

  // Only the bordered variants draw an outline; the filled ones are defined by
  // their fill and would read as heavier with a ring around them.
  const outlineOnContainer =
    variant === "outlined"
      ? onDark
        ? "border-[1.5px] border-[#2E2E2E]"
        : "border-[1.5px] border-border-subtle"
      : undefined;

  return (
    <span
      ref={wrap}
      className={cn("relative inline-flex", fullWidth && "w-full", className)}
    >
      {/* The outline belongs to the container, not to the two segments: a
          border on each would be clipped by overflow-hidden at the pill's
          curve, leaving a stub floating past the right edge. Segments keep
          only the hairline that divides them. */}
      <span
        className={cn(
          "inline-flex w-full overflow-hidden rounded-pill",
          outlineOnContainer,
        )}
      >
        <button
          ref={ref}
          type={type}
          disabled={isDisabled}
          className={cn(
            face,
            "rounded-none border-0 border-r",
            divider,
            fullWidth ? "flex-1" : "flex-none",
            !iconOnly && "pr-5",
          )}
          {...rest}
        >
          {body}
        </button>
        <button
          type="button"
          aria-label={menuLabel}
          aria-haspopup={items.length ? "menu" : undefined}
          aria-expanded={items.length ? open : undefined}
          disabled={isDisabled}
          onClick={() => {
            if (items.length) setOpen((value) => !value);
            onMenu?.();
          }}
          // shrink-0 on the segment: inside the flex row it would otherwise
          // give up its width to the label side and collapse to nothing.
          className={cn(face, "shrink-0 rounded-none border-0 px-0", g.square)}
        >
          <svg
            width={g.icon}
            height={g.icon}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className={cn(
              "shrink-0 transition-transform duration-[180ms] ease-standard",
              open && "rotate-180",
            )}
          >
            <path
              d="M5.5 8 10 12.5 14.5 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </span>

      {open && items.length > 0 ? (
        <div
          role="menu"
          className={cn(
            "absolute top-[calc(100%+var(--space-2))] z-20 flex min-w-[220px] flex-col",
            "rounded-panel border border-hairline bg-surface-card p-2 shadow-float",
            menuAlign === "right" ? "right-0" : "left-0",
          )}
          style={{ animation: "halo-panel-in 180ms var(--ease-standard) both" }}
        >
          {items.map((item, index) => (
            <MenuItem key={index} item={item} onDone={() => setOpen(false)} />
          ))}
        </div>
      ) : null}
    </span>
  );
});

function MenuItem({ item, onDone }: { item: ButtonMenuItem; onDone: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={() => {
        if (item.disabled) return;
        item.onSelect?.();
        onDone();
      }}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-chip px-3 text-left",
        "font-sans text-body-s transition-colors duration-[120ms] ease-standard",
        "hover:bg-mist disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#A8ADAC]",
        item.tone === "error" ? "text-error" : "text-text-primary",
      )}
    >
      {item.icon}
      {item.label}
    </button>
  );
}
