import * as React from "react";
import { cn } from "../../lib/cn";
import {
  BUILDER_ELEMENTS,
  canHoldChildren,
  resolveStyle,
  type BreakpointId,
  type BuilderNode,
} from "../../lib/builder";
import { Icon, type IconName } from "../core/icon";

export interface BuilderRenderProps {
  node: BuilderNode;
  breakpoint: BreakpointId;
  selected?: string | null;
  hovered?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Called when an element from the palette is dropped into a container. */
  onDropInto?: (parentId: string, type: string) => void;
  editable?: boolean;
}

export const BUILDER_MEDIA_TYPE = "text/halo-builder-element";

/**
 * Renders a node as the real thing, not a placeholder.
 *
 * WHAT THE CANVAS SHOWS IS WHAT THE EXPORT RENDERS. A builder that previews
 * approximations teaches its user a layout that will not survive export, and
 * they find out after publishing.
 *
 * Selection chrome is an outline rather than a border, so marking a node never
 * changes its box and never shifts the layout around it — the one thing that
 * makes a builder feel broken.
 */
export function BuilderRender({
  node,
  breakpoint,
  selected,
  hovered,
  onSelect,
  onHover,
  onDropInto,
  editable = true,
}: BuilderRenderProps): React.ReactElement {
  const style = resolveStyle(node, breakpoint);
  const props = node.props ?? {};
  const isSelected = selected === node.id;
  const isHovered = hovered === node.id;
  const [over, setOver] = React.useState(false);

  const holds = canHoldChildren(node.type);

  const chrome: React.CSSProperties = editable
    ? {
        outline: isSelected
          ? "2px solid var(--color-accent-deep)"
          : over
            ? "2px dashed var(--color-accent-deep)"
            : isHovered
              ? "1px solid var(--color-accent-deep)"
              : "none",
        outlineOffset: isSelected ? 1 : 0,
      }
    : {};

  const bind = editable
    ? {
        onClick: (event: React.MouseEvent) => {
          event.stopPropagation();
          onSelect?.(node.id);
        },
        onMouseOver: (event: React.MouseEvent) => {
          event.stopPropagation();
          onHover?.(node.id);
        },
        onMouseOut: () => onHover?.(null),
        ...(holds
          ? {
              onDragOver: (event: React.DragEvent) => {
                if (!event.dataTransfer.types.includes(BUILDER_MEDIA_TYPE)) return;
                event.preventDefault();
                event.stopPropagation();
                setOver(true);
              },
              onDragLeave: () => setOver(false),
              onDrop: (event: React.DragEvent) => {
                event.preventDefault();
                event.stopPropagation();
                setOver(false);
                const type = event.dataTransfer.getData(BUILDER_MEDIA_TYPE);
                if (type) onDropInto?.(node.id, type);
              },
            }
          : {}),
      }
    : {};

  const box = { ...style, ...chrome };

  const children = (node.children ?? []).map((child) => (
    <BuilderRender
      key={child.id}
      node={child}
      breakpoint={breakpoint}
      selected={selected}
      hovered={hovered}
      onSelect={onSelect}
      onHover={onHover}
      onDropInto={onDropInto}
      editable={editable}
    />
  ));

  switch (node.type) {
    case "heading": {
      const tag = String(props.tag ?? "h2");
      const Tag = (["h1", "h2", "h3", "h4"].includes(tag) ? tag : "h2") as "h2";
      return (
        <Tag style={box} {...bind}>
          {String(props.text ?? "")}
        </Tag>
      );
    }

    case "eyebrow":
    case "text":
      return (
        <p style={{ margin: 0, ...box }} {...bind}>
          {String(props.text ?? "")}
        </p>
      );

    case "quote":
      return (
        <blockquote style={{ margin: 0, ...box }} {...bind}>
          {String(props.text ?? "")}
          {props.author ? (
            <cite
              style={{
                display: "block",
                marginTop: 12,
                fontSize: 14,
                fontStyle: "normal",
                color: "var(--color-text-secondary)",
              }}
            >
              {String(props.author)}
            </cite>
          ) : null}
        </blockquote>
      );

    case "list":
      return (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            ...box,
          }}
          {...bind}
        >
          {((props.items as string[] | undefined) ?? []).map((item, index) => (
            <li key={index} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Icon
                name={props.marker === "dot" ? "circle" : "check"}
                size={16}
                className="mt-0.75 shrink-0 text-accent-deep"
              />
              {item}
            </li>
          ))}
        </ul>
      );

    case "image":
      return props.src ? (
        <img
          src={String(props.src)}
          alt={String(props.alt ?? "")}
          style={{ objectFit: (props.fit as "cover") ?? "cover", display: "block", ...box }}
          {...bind}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "var(--color-surface-sunken)",
            color: "var(--color-text-secondary)",
            ...box,
          }}
          {...bind}
        >
          <Icon name="image" size={18} />
          Image to set
        </div>
      );

    case "video":
      return props.src ? (
        <iframe
          src={String(props.src)}
          title="Video"
          style={{ border: "none", display: "block", ...box }}
          {...bind}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "var(--color-action-secondary-bg)",
            color: "var(--color-action-secondary-fg)",
            ...box,
          }}
          {...bind}
        >
          <Icon name="play" size={18} />
          Video to set
        </div>
      );

    case "button": {
      const variant = String(props.variant ?? "primary");
      return (
        <a
          href={String(props.href ?? "#")}
          onClick={(event) => event.preventDefault()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            fontFamily: "var(--font-sans)",
            // The accent always takes ink text, in both régimes.
            background:
              variant === "primary"
                ? "var(--color-accent)"
                : variant === "ghost"
                  ? "transparent"
                  : "var(--color-action-secondary-bg)",
            color:
              variant === "primary"
                ? "var(--color-accent-ink)"
                : variant === "ghost"
                  ? "var(--color-text-primary)"
                  : "var(--color-action-secondary-fg)",
            border: variant === "ghost" ? "1.5px solid var(--color-text-primary)" : "none",
            ...box,
          }}
          {...bind}
        >
          {String(props.text ?? "")}
        </a>
      );
    }

    case "card": {
      const inverted = Boolean(props.inverted);
      return (
        <article
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            ...box,
            background: inverted ? "var(--color-action-secondary-bg)" : style.background,
          }}
          {...bind}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              // The inverted card is the accent's fourth home, and the glyph
              // on it is always ink.
              background: inverted ? "var(--color-accent)" : "var(--color-surface-sunken)",
              color: inverted ? "var(--color-accent-ink)" : "var(--color-text-primary)",
            }}
          >
            <Icon name={(props.icon as IconName) ?? "zap"} size={20} strokeWidth={1.5} />
          </span>

          <h3
            style={{
              margin: 0,
              fontSize: 20,
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
              fontWeight: 600,
              color: inverted ? "var(--color-action-secondary-fg)" : "var(--color-text-primary)",
            }}
          >
            {String(props.title ?? "")}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.55,
              color: inverted
                ? "color-mix(in srgb, var(--color-action-secondary-fg) 70%, transparent)"
                : "var(--color-text-secondary)",
            }}
          >
            {String(props.body ?? "")}
          </p>
        </article>
      );
    }

    case "stat":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, ...box }} {...bind}>
          <strong
            style={{
              fontSize: "inherit",
              fontWeight: "inherit",
              letterSpacing: "inherit",
              color: "inherit",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {String(props.value ?? "")}
          </strong>
          <span style={{ fontSize: 14, fontWeight: 400, color: "var(--color-text-secondary)" }}>
            {String(props.label ?? "")}
          </span>
        </div>
      );

    case "form":
      return (
        <form
          onSubmit={(event) => event.preventDefault()}
          style={{ display: "flex", gap: style.gap ?? 10, maxWidth: 460, ...box }}
          {...bind}
        >
          <input
            placeholder={String(props.placeholder ?? "")}
            readOnly
            style={{
              flex: 1,
              minWidth: 0,
              height: 48,
              padding: "0 16px",
              borderRadius: 12,
              border: "1px solid var(--color-border-subtle)",
              background: "var(--color-surface-card)",
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
            }}
          />
          <button
            type="submit"
            style={{
              height: 48,
              padding: "0 22px",
              borderRadius: 999,
              border: "none",
              background: "var(--color-accent)",
              color: "var(--color-accent-ink)",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {String(props.cta ?? "")}
          </button>
        </form>
      );

    case "nav":
      return (
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            maxWidth: 1240,
            marginLeft: "auto",
            marginRight: "auto",
            paddingLeft: 24,
            paddingRight: 24,
            ...box,
          }}
          {...bind}
        >
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {String(props.brand ?? "Brand")}
          </span>

          <span style={{ display: "flex", gap: 22, marginLeft: 12 }}>
            {((props.links as string[] | undefined) ?? []).map((link, index) => (
              <span
                key={link}
                style={{
                  fontSize: 14,
                  color: index === 0 ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  borderBottom:
                    index === 0 ? "2px solid var(--color-accent)" : "2px solid transparent",
                  paddingBottom: 6,
                }}
              >
                {link}
              </span>
            ))}
          </span>

          {props.cta ? (
            <span
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                height: 40,
                padding: "0 20px",
                borderRadius: 999,
                background: "var(--color-accent)",
                color: "var(--color-accent-ink)",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {String(props.cta)}
            </span>
          ) : null}

          {children}
        </nav>
      );

    case "footer":
      return (
        <footer style={box} {...bind}>
          <span
            style={{
              display: "flex",
              gap: 56,
              maxWidth: 1240,
              margin: "0 auto",
              padding: "0 24px",
              flexWrap: "wrap",
            }}
          >
            {((props.columns as { title: string; links: string[] }[] | undefined) ?? []).map(
              (column) => (
                <span
                  key={column.title}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {column.title}
                  </span>
                  {(column.links ?? []).map((link) => (
                    <span key={link} style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
                      {link}
                    </span>
                  ))}
                </span>
              ),
            )}
            {children}
          </span>
        </footer>
      );

    default:
      return (
        <div
          style={{ minHeight: holds && !children.length ? 72 : undefined, ...box }}
          {...bind}
        >
          {children.length ? (
            children
          ) : editable && holds ? (
            // An empty container has to say it can take something, or the
            // only way to discover it is to try.
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                minHeight: 64,
                border: "1px dashed var(--color-border-subtle)",
                borderRadius: 12,
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-sans)",
                fontSize: 12.5,
              }}
            >
              Drop an element here
            </span>
          ) : null}
        </div>
      );
  }
}

export interface BuilderLayersProps {
  nodes: BuilderNode[];
  depth?: number;
  selected?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  collapsed: string[];
  onToggle: (id: string) => void;
}

/**
 * The document as an indented tree.
 *
 * A node is named by its own text before its type: on a page of nine sections
 * "Section" nine times is a list you have to click through, and the heading
 * inside is what the person actually remembers it by.
 */
export function BuilderLayers({
  nodes,
  depth = 0,
  selected,
  onSelect,
  onHover,
  collapsed,
  onToggle,
}: BuilderLayersProps): React.ReactElement {
  return (
    <>
      {nodes.map((node) => {
        const open = !collapsed.includes(node.id);
        const children = node.children ?? [];
        const element = BUILDER_ELEMENTS[node.type];
        const name =
          (node.props?.text as string) ??
          (node.props?.title as string) ??
          element?.label ??
          node.type;

        return (
          <React.Fragment key={node.id}>
            <button
              type="button"
              onClick={() => onSelect?.(node.id)}
              onMouseEnter={() => onHover?.(node.id)}
              onMouseLeave={() => onHover?.(null)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-[7px] border-none py-1.25 pr-2 text-left font-sans text-[12.5px] halo-focus",
                selected === node.id
                  ? "bg-accent text-accent-ink"
                  : "bg-transparent text-text-primary hover:bg-surface-alt",
              )}
              style={{ paddingLeft: 8 + depth * 13 }}
            >
              {children.length ? (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(node.id);
                  }}
                  className="inline-flex text-current"
                >
                  <Icon name={open ? "chevron-down" : "chevron-right"} size={11} />
                </span>
              ) : (
                <span className="w-2.75" />
              )}

              <Icon name={(element?.icon as IconName) ?? "square"} size={12} />
              <span className="min-w-0 flex-1 truncate">{name}</span>
            </button>

            {open && children.length ? (
              <BuilderLayers
                nodes={children}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
                onHover={onHover}
                collapsed={collapsed}
                onToggle={onToggle}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
}
