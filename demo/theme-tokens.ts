/**
 * The tokens the theme editor can change, and the file it writes back out.
 *
 * ONLY THE THEME LAYER IS EDITABLE. The primitives (spacing, radii, motion)
 * and the semantic aliases are the system; the palette and the type family are
 * the brand. Letting the editor touch an alias would let somebody point
 * `--color-surface-card` at the accent and break every component at once,
 * which is not a theme — it is a bug with a colour picker.
 */

export type TokenKind = "color" | "font" | "raw";

export interface TokenSpec {
  name: string;
  label: string;
  kind: TokenKind;
  /** Set when the dark régime overrides this token. */
  dark?: boolean;
  note?: string;
}

export interface TokenGroup {
  key: string;
  label: string;
  note?: string;
  tokens: TokenSpec[];
}

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    key: "neutrals",
    label: "Neutrals",
    note: "Ink and paper. Everything else is built on these two.",
    tokens: [
      { name: "--color-ink", label: "Ink", kind: "color" },
      { name: "--color-ink-elevated", label: "Ink, elevated", kind: "color" },
      { name: "--color-ink-hairline", label: "Ink hairline", kind: "color" },
      { name: "--color-ink-sunken", label: "Ink, sunken", kind: "color" },
      { name: "--color-paper", label: "Paper", kind: "color" },
      { name: "--color-mist", label: "Mist", kind: "color", dark: true },
      { name: "--color-mist-strong", label: "Mist, strong", kind: "color", dark: true },
      { name: "--color-hairline", label: "Hairline", kind: "color", dark: true },
      { name: "--color-text-muted-light", label: "Muted text, light", kind: "color" },
      { name: "--color-text-muted-dark", label: "Muted text, dark", kind: "color" },
    ],
  },
  {
    key: "accent",
    label: "Accent",
    note: "Four homes: primary button, key figure, active nav, the one inverted card. Always ink text on it, never white.",
    tokens: [
      { name: "--color-accent", label: "Accent", kind: "color" },
      { name: "--color-accent-deep", label: "Accent, deep", kind: "color", note: "Hover and borders" },
      { name: "--color-accent-press", label: "Accent, pressed", kind: "color" },
      { name: "--color-accent-ink", label: "Text on accent", kind: "color", note: "Ink, in both régimes" },
    ],
  },
  {
    key: "status",
    label: "Status",
    note: "Deliberately outside the accent family. Each has a light and a dark value.",
    tokens: [
      { name: "--color-success", label: "Success", kind: "color", dark: true },
      { name: "--color-warning", label: "Warning", kind: "color", dark: true },
      { name: "--color-error", label: "Error", kind: "color", dark: true },
      { name: "--color-info", label: "Info", kind: "color", dark: true },
      { name: "--color-success-soft", label: "Success, soft", kind: "color", dark: true },
      { name: "--color-warning-soft", label: "Warning, soft", kind: "color", dark: true },
      { name: "--color-error-soft", label: "Error, soft", kind: "color", dark: true },
      { name: "--color-info-soft", label: "Info, soft", kind: "color", dark: true },
    ],
  },
  {
    key: "halo",
    label: "Halo",
    note: "Three blurred radials over ink. Never a linear gradient — that substitution is what makes a hero read as an approximate copy.",
    tokens: [
      { name: "--color-halo-1", label: "Halo 1", kind: "color" },
      { name: "--color-halo-2", label: "Halo 2", kind: "color" },
      { name: "--color-halo-3", label: "Halo 3", kind: "color" },
    ],
  },
  {
    key: "charts",
    label: "Charts",
    note: "A separate series palette, so the accent keeps its call-to-action job.",
    tokens: [
      { name: "--chart-1", label: "Series 1", kind: "color", dark: true },
      { name: "--chart-2", label: "Series 2", kind: "color", dark: true },
      { name: "--chart-3", label: "Series 3", kind: "color", dark: true },
      { name: "--chart-4", label: "Series 4", kind: "color", dark: true },
      { name: "--chart-5", label: "Series 5", kind: "color", dark: true },
      { name: "--chart-6", label: "Series 6", kind: "color", dark: true },
    ],
  },
  {
    key: "type",
    label: "Type",
    note: "A full font stack, with fallbacks. The first family that resolves wins.",
    tokens: [
      { name: "--font-sans", label: "Sans", kind: "font" },
      { name: "--font-mono", label: "Mono", kind: "font" },
    ],
  },
];

/** Every token the editor knows about, flattened. */
export const ALL_TOKENS = TOKEN_GROUPS.flatMap((group) => group.tokens);

/**
 * Reads a token's current computed value.
 *
 * From the element the régime is set on, not from an arbitrary node: a token
 * overridden under `[data-theme="dark"]` resolves differently depending on
 * where it is read, and reading from the wrong place shows the light value
 * while the dark one is on screen.
 */
export function readToken(name: string, root: HTMLElement = document.documentElement): string {
  return getComputedStyle(root).getPropertyValue(name).trim();
}

/** Reads every token, for the régime currently applied. */
export function readAll(root: HTMLElement = document.documentElement): Record<string, string> {
  return Object.fromEntries(
    ALL_TOKENS.map((token) => {
      const value = readToken(token.name, root);
      // Colours are normalised to six-digit hex on the way in. The native
      // picker only ever emits that form, so a token stored as `#fff` would
      // read as "changed" the instant somebody merely opened its swatch.
      return [token.name, token.kind === "color" && value ? toHex(value) : value];
    }),
  );
}

/**
 * A hex colour, whatever form the token is in.
 *
 * `<input type="color">` accepts only `#rrggbb`, so a token expressed as a
 * keyword, an rgb() or an eight-digit hex has to be resolved through the
 * browser before the picker will show it at all — otherwise the swatch is
 * silently black and the first click destroys the real value.
 */
export function toHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#(.)(.)(.)$/i)!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  if (typeof document === "undefined") return "#000000";

  // The browser is the only thing that reliably parses every colour syntax.
  const probe = document.createElement("span");
  probe.style.color = trimmed;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  const rgb = computed.match(/(\d+(?:\.\d+)?)/g);
  if (!rgb || rgb.length < 3) return "#000000";

  return `#${rgb
    .slice(0, 3)
    .map((channel) => Math.round(Number(channel)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Relative luminance, per WCAG.
 *
 * Used to warn when a pair falls below the contrast a body text needs. A theme
 * editor that lets somebody pick an unreadable pair without saying so is worse
 * than one with no picker: the result looks deliberate.
 */
function luminance(hex: string): number {
  const value = toHex(hex).slice(1);
  const channels = [0, 2, 4].map((at) => {
    const c = parseInt(value.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

export interface ThemeState {
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Writes the values onto the document as inline custom properties.
 *
 * Applied to `documentElement.style`, which outranks any stylesheet rule
 * including the dark-régime block — so the preview shows exactly what the
 * exported file would produce, rather than something the cascade partly
 * overrode.
 */
export function applyTheme(state: ThemeState, dark: boolean): void {
  const root = document.documentElement;
  const values = { ...state.light, ...(dark ? state.dark : {}) };

  for (const [name, value] of Object.entries(values)) {
    if (value) root.style.setProperty(name, value);
  }

  // The halo is derived: it is three radials built from the three halo
  // colours, so changing a colour has to rebuild it or the hero keeps the
  // old one.
  const halo = [state.light["--color-halo-1"], state.light["--color-halo-2"], state.light["--color-halo-3"]];
  if (halo.every(Boolean)) {
    root.style.setProperty("--halo", haloGradient(halo as [string, string, string]));
  }
}

/** Clears every inline override, so the stylesheet takes over again. */
export function resetTheme(): void {
  const root = document.documentElement;
  for (const token of ALL_TOKENS) root.style.removeProperty(token.name);
  root.style.removeProperty("--halo");
}

const rgbTriplet = (hex: string): string => {
  const value = toHex(hex).slice(1);
  return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16)).join(" ");
};

/** The three-radial halo, rebuilt from its colours. */
export function haloGradient([one, two, three]: [string, string, string]): string {
  return [
    `radial-gradient(60% 70% at 50% 108%, rgb(${rgbTriplet(one)} / 0.7) 0%, rgb(${rgbTriplet(one)} / 0) 70%)`,
    `radial-gradient(55% 60% at 6% 104%, rgb(${rgbTriplet(two)} / 0.7) 0%, rgb(${rgbTriplet(two)} / 0) 72%)`,
    `radial-gradient(40% 46% at 92% 6%, rgb(${rgbTriplet(three)} / 0.6) 0%, rgb(${rgbTriplet(three)} / 0) 70%)`,
  ].join(",\n    ");
}

/**
 * The theme as a stylesheet, in the shape of themes/kardloop.css.
 *
 * THE POINT IS THAT IT PASTES STRAIGHT IN. Only tokens that actually differ
 * from the file's own defaults are emitted, so what comes out is a diff a
 * person can read, not a wall of unchanged values that hides the three things
 * they changed.
 */
export function toThemeCss(
  state: ThemeState,
  defaults: ThemeState,
  name = "Custom",
): string {
  const changed = (scope: "light" | "dark") =>
    ALL_TOKENS.filter((token) => {
      if (scope === "dark" && !token.dark) return false;
      const value = state[scope][token.name];
      return value && value !== defaults[scope][token.name];
    });

  const emit = (tokens: TokenSpec[], scope: "light" | "dark") =>
    tokens.map((token) => `  ${token.name}: ${state[scope][token.name]};`).join("\n");

  const lightTokens = changed("light");
  const darkTokens = changed("dark");

  if (!lightTokens.length && !darkTokens.length) {
    return "/* Nothing changed yet — adjust a token to see the file. */";
  }

  const halo = [state.light["--color-halo-1"], state.light["--color-halo-2"], state.light["--color-halo-3"]];
  const haloChanged = halo.some(
    (value, index) => value !== defaults.light[`--color-halo-${index + 1}`],
  );

  const parts = [
    `/* ---------------------------------------------------------------------------`,
    ` * Halo — ${name} theme`,
    ` *`,
    ` * Generated from the demo's theme editor. Only the values that differ from`,
    ` * the base theme are listed: everything else is inherited.`,
    ` *`,
    ` * Import AFTER styles.css and BEFORE any component renders:`,
    ` *`,
    ` *   @import "@halo/ui/styles.css";`,
    ` *   @import "./${name.toLowerCase().replace(/\s+/g, "-")}.css";`,
    ` * ------------------------------------------------------------------------ */`,
    "",
    ":root {",
    emit(lightTokens, "light"),
  ];

  if (haloChanged && halo.every(Boolean)) {
    parts.push(
      "",
      "  /* Rebuilt from the three halo colours above. */",
      `  --halo:\n    ${haloGradient(halo as [string, string, string])};`,
    );
  }

  parts.push("}");

  if (darkTokens.length) {
    parts.push(
      "",
      ':root[data-theme="dark"],',
      ".dark,",
      ".halo-dark {",
      emit(darkTokens, "dark"),
      "}",
    );
  }

  return parts.join("\n");
}
