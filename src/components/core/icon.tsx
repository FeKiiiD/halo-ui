import * as React from "react";
import { cn } from "../../lib/cn";

/**
 * Any Lucide glyph name, in the kebab-case the design system writes them in:
 * `qr-code`, `circle-help`, `layout-dashboard`.
 */
export type IconName = string;

/**
 * The glyph registry, loaded once and lazily.
 *
 * WHY NOT lucide-react/dynamic. That subpath re-exports a file which ships
 * under `dist/esm/` but is actually CommonJS, with no `"type": "module"` to
 * disambiguate it — so Node in ESM refuses the named export outright. A
 * bundler papers over it, which is why this only surfaced when the published
 * package was installed and imported from a plain script. The root entry is
 * the one form that resolves everywhere, so the loading is done here instead.
 *
 * Still one dynamic import, so a consumer that renders no icon never pays for
 * the registry — but the whole registry arrives at once rather than per glyph.
 * That is the cost of the workaround, and it buys an import that works in
 * Node, in a test runner, and server-side before any bundling.
 */
type GlyphComponent = React.ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
  role?: string;
}>;

let registry: Record<string, GlyphComponent> | null = null;
let loading: Promise<Record<string, GlyphComponent>> | null = null;

/** `qr-code` becomes `QrCode`, which is how lucide names its exports. */
const pascal = (name: string) =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");

function loadRegistry(): Promise<Record<string, GlyphComponent>> {
  loading ??= import("lucide-react").then((module) => {
    registry = module as unknown as Record<string, GlyphComponent>;
    return registry;
  });
  return loading;
}

export interface IconProps {
  name: IconName;
  /** 20 is the system default; 18 inside a button. */
  size?: number;
  /** 1.5 everywhere. Two stroke weights on one screen is a bug. */
  strokeWidth?: number;
  color?: string;
  className?: string;
  /** Set when the glyph carries meaning no adjacent text conveys. */
  "aria-label"?: string;
}

/**
 * Monochrome line glyph, 1.5px stroke, in `currentColor`.
 *
 * The registry is imported dynamically and cached, so a consumer that renders
 * no icon never pays for it, and every icon after the first is synchronous.
 * See loadRegistry above for why this is not lucide's own DynamicIcon.
 *
 * The rules that come with it: never a coloured icon, never a filled or duotone
 * glyph, never two stroke weights in one screen, and no emoji or Unicode
 * symbols standing in for icons (no ✓ ★ →).
 */
export function Icon({
  name,
  size = 20,
  strokeWidth = 1.5,
  color,
  className,
  "aria-label": ariaLabel,
}: IconProps) {
  // Seeded from the cache, so an icon rendered after the first paints
  // immediately rather than flashing a gap.
  const [glyphs, setGlyphs] = React.useState(registry);

  React.useEffect(() => {
    if (glyphs) return;

    let alive = true;
    void loadRegistry().then((loaded) => {
      if (alive) setGlyphs(loaded);
    });
    return () => {
      alive = false;
    };
  }, [glyphs]);

  const Glyph = glyphs?.[pascal(name)];

  if (!Glyph) {
    // A reserved box, not nothing: an icon appearing late must not reflow the
    // row it sits in, and a missing glyph must not collapse its own layout.
    return (
      <span
        aria-hidden="true"
        className={cn("inline-block shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={cn("shrink-0", className)}
      // A glyph is decorative unless the caller says otherwise: most sit beside
      // a label that already names the action.
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    />
  );
}
