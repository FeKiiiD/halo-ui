import { ALL_TOKENS, toThemeCss, type ThemeState } from "./theme-tokens";

export interface PromptOptions {
  repo: string;
  themeName: string;
  state: ThemeState;
  defaults: ThemeState;
  /** Font stack currently selected, for the @import guidance. */
  fontStack: string;
}

/**
 * A self-contained setup brief, meant to be pasted into a coding agent.
 *
 * IT HAS TO WORK WITH NO OTHER CONTEXT. Whoever runs it has this text and
 * nothing else — not the repo, not this demo, not the conversation that
 * produced the theme. So it carries the install command, the exact import
 * order, the theme file inline, the traps that fail silently, and the rules a
 * component library cannot enforce for itself.
 *
 * The traps are the part that earns its length. Every one of them produces a
 * page that looks merely wrong rather than broken, which is the kind of bug
 * somebody spends an afternoon on.
 */
export function buildSetupPrompt({
  repo,
  themeName,
  state,
  defaults,
  fontStack,
}: PromptOptions): string {
  const slug = themeName.toLowerCase().replace(/\s+/g, "-") || "theme";
  const themeCss = toThemeCss(state, defaults, themeName);

  const changed = ALL_TOKENS.filter(
    (token) =>
      state.light[token.name] !== defaults.light[token.name] ||
      (token.dark && state.dark[token.name] !== defaults.dark[token.name]),
  );

  // A font the browser has to fetch needs its own @import; a system stack does
  // not, and telling someone to import one would send them looking for a font
  // service that has no such family.
  const firstFamily = (fontStack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  const needsFontImport = Boolean(firstFamily) && !/^(system-ui|ui-|-apple|sans-serif|serif|monospace)/i.test(firstFamily);

  const themeSection = changed.length
    ? `
## 3. The theme

Create \`src/styles/${slug}.css\` with exactly this:

\`\`\`css
${themeCss}
\`\`\`

${changed.length} token${changed.length === 1 ? " differs" : "s differ"} from the library's defaults; everything else is inherited, which is why this file is short.`
    : `
## 3. The theme

No token was changed, so import the library's own theme:

\`\`\`css
@import "@halo/ui/themes/kardloop.css";
\`\`\``;

  const fontLine = needsFontImport
    ? `@import url("https://api.fontshare.com/v2/css?f[]=${firstFamily.toLowerCase()}@400,500,600,700&display=swap");`
    : `/* The font stack is a system one — nothing to fetch. */`;

  return `# Set up the Halo component library in this project

You are configuring an existing project to use Halo, a React component
library built on Tailwind v4 with semantic design tokens. Do every step
below, then verify. Do not skip the verification.

## 1. Install

\`\`\`bash
npm i ${repo}
\`\`\`

Add \`leaflet\` **only if** the project will render \`CatchmentMap\` or
\`ZoneMap\`. It is an optional peer dependency: a project that shows no maps
must not install it.

\`\`\`bash
npm i leaflet          # maps only
\`\`\`

The project needs Tailwind v4. If it is on v3, stop and say so — the token
layer uses \`@theme inline\`, which v3 does not have, and a partial migration
is worse than none.

## 2. The stylesheet

Find the project's global stylesheet — the one imported once at the root
(\`app/globals.css\`, \`src/index.css\`, or similar). Put this at the top, in
this order:

\`\`\`css
${fontLine}

@import "tailwindcss";
@import "@halo/ui/styles.css";
@import "./styles/${slug}.css";
@import "@halo/ui/leaflet.css";           /* maps only — delete otherwise */

@source "../node_modules/@halo/ui/dist";
\`\`\`

Four things about that block, each of which fails silently if ignored:

1. **The font \`@import\` must be the first line of the file.** CSS requires
   every \`@import\` to precede all other rules. Placed after any rule — even a
   comment is fine, but a rule is not — the browser drops it without a warning
   and the type silently falls back.
2. **The theme comes after \`styles.css\`.** The semantic layer reads the theme;
   loading it first leaves the aliases pointing at variables that do not exist
   yet, and every component renders with no colour.
3. **\`@source\` is not optional.** Tailwind scans source files for class names.
   The library's classes live in \`node_modules\`, which Tailwind does not scan
   by default, so without this line no component gets any styling at all. Adjust
   the relative path so it resolves from the stylesheet's own location.
4. **\`@halo/ui/leaflet.css\` only if you install leaflet.** It themes Leaflet's
   own controls, which ship hard-coded white and are unreadable on a dark map.
${themeSection}

## 4. Dark mode

The library responds to both \`[data-theme="dark"]\` on \`<html>\` and a \`.dark\`
class, so it works with whatever the project already does. If the project has
no dark mode, add a toggle that sets \`data-theme\`.

Do not add \`dark:\` variants to Halo components. They read semantic tokens that
already flip — a \`dark:\` override on top of one is how a component ends up
correct in one régime and wrong in the other.

## 5. Use it

\`\`\`tsx
import { Button, DataTable, Icon } from "@halo/ui";
\`\`\`

Everything imports from the root, or per group: \`@halo/ui/forms\`,
\`@halo/ui/charts\`, \`@halo/ui/table\`, \`@halo/ui/overlay\`, and so on. Prefer the
root unless bundle size is measured and a per-group import demonstrably helps.

## 6. The rules the library cannot enforce

These are conventions of the design system. Nothing in the code stops you
breaking them, and breaking them is what makes an interface read as an
approximate copy.

**Read semantic aliases, never raw palette values.** Use \`bg-surface-card\`,
not \`bg-paper\`. \`text-text-primary\`, not \`text-ink\`. \`border-border-subtle\`,
not \`border-hairline\`. The indirection is the only reason dark mode works.

The failure this prevents is specific and common: a **fixed colour on a surface
that follows the theme** is invisible in one régime and looks perfect in the
other. If you write a colour into a component, check both régimes before you
believe it.

**The accent has four homes and no others:** the primary button, a key figure,
the active navigation state, and the icon chip of the single inverted card in a
grid. Always ink text on the accent, never white. One accent element per
visible screen — two primary buttons side by side cancel each other out. Never
as a status colour; success and error have their own family.

**Cards carry no shadow and no border.** They separate from the ground by value
alone. \`shadow-float\` exists for genuinely floating things: a dropdown, a
popover, a dragged card.

**Every button is a full pill.** \`rounded-pill\` is 999px. There is no exception
anywhere in the system.

## 7. Verify

Do not report success until all four pass:

1. Render \`<Button>Test</Button>\`. It must be a **filled pill**. A square or
   unstyled button means \`@source\` is missing or its path is wrong.
2. Render \`<Icon name="qr-code" />\`. A missing glyph means \`lucide-react\`
   did not resolve.
3. Toggle \`data-theme="dark"\` on \`<html>\`. The page background must invert.
   If it does not, the theme is loading before \`styles.css\`.
4. Check the computed font on any text. If it is not \`${firstFamily || "the expected family"}\`,
   the font \`@import\` is not the first line of the stylesheet.

If a step fails, fix it before continuing. Each failure has exactly one cause,
listed above.
`;
}
