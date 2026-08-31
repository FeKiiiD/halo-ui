# Halo

A React component library: semantic tokens, Tailwind v4, themeable.

Ported from the Kardloop design system. The source was authored for a
bundler-less runtime with every style inline; this is the same system rebuilt
as a real library — 149 components, 21 gates, ~900 assertions.

## Install

```bash
npm i github:FeKiiiD/halo-ui
npm i leaflet          # only if you use the maps
```

Then, in your stylesheet — **the order matters**:

```css
/* The font MUST be the first line of the file. CSS requires every @import to
   precede all other rules, so a font import placed after any rule is silently
   dropped by the browser. */
@import url("https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap");

@import "tailwindcss";
@import "@halo/ui/styles.css";
@import "@halo/ui/themes/kardloop.css";   /* or your own theme */
@import "@halo/ui/leaflet.css";           /* only if you use the maps */

/* Tailwind scans source files for classes; the library's live in
   node_modules, so they have to be declared. */
@source "../node_modules/@halo/ui/dist";
```

```tsx
import { Button, DataTable, Icon } from "@halo/ui";

<Button variant="primary" iconLeft={<Icon name="qr-code" size={18} />}>
  Create programme
</Button>;
```

Everything imports from the root, or per group — `@halo/ui/forms`,
`@halo/ui/charts`, `@halo/ui/table`, and so on.

## What is in it

| Group | What it covers |
|---|---|
| `core` | Button, Icon, Spinner, StatBlock, CountUp, and nine choreographed actions |
| `forms` | 25 fields on one shared `Field` frame — text, choice, dates, money, files, rich text |
| `form` | Assembly: FormSection, FormGrid, FormActions, FormStepper, ChoiceCard, FormSummary |
| `feedback` | Badge, Alert, NotificationCard |
| `overlay` | Modal, ConfirmDialog, StepDialog, Drawer, BottomSheet, ModalButton |
| `cards` | FeatureCard, StatCard, PricingCard, TestimonialCard, MediaCard, SpotlightCard, TeamCard |
| `navigation` | Navbar, MegaMenu, MenuDropdown, MobileNav, Breadcrumbs, Footer, LogoBand |
| `charts` | Line, Bar, Donut, Gauge, Funnel, Heatmap, Scatter, Sparkline, KpiTile, ChartStudio |
| `table` | DataTable with 25 cell types, plus FilterPanel, SortPanel, SavedViews, KanbanBoard, DetailPanel |
| `matrix` | SWOT, BCG, pain/gain, RACI, life-cycle curve |
| `gantt`, `graph` | Schedule with dependencies; force-directed relation map |
| `history` | CommitHistory — a lane graph with branches and a compare tray |
| `messaging` | ConversationList, MessageThread, MessageComposer |
| `diagram` | Free-form canvas and its editor |
| `swimlane`, `erd` | Journey lanes; database schema with SQL generation |
| `flow` | FlowCanvas, FlowEditor with validation, FlowExecutions |
| `builder` | SiteBuilder — a page builder with breakpoints and HTML export |
| `map` | CatchmentMap, ZoneMap (leaflet as an optional peer) |
| `whiteboard` | An unbounded drawing surface |
| `document` | DocumentEditor — blocks, outline, slash palette, HTML/Markdown export |
| `audio` | LiveWaveform, VoiceButton |
| `data`, `consent`, `brand` | JsonViewer, CookieConsent, Logo |

The whole design system is ported. Nothing was left behind.

## The three rules that matter

**1. Components read semantic aliases, never raw palette values.**
`bg-surface-card`, not `bg-paper`. `text-text-primary`, not `text-ink`. That
indirection is the only reason dark mode works and the only reason a theme can
be swapped without touching a component.

That rule is also where nearly every visual bug in this port came from: a
fixed colour on a surface that follows the theme is invisible in one régime,
and it looks perfect in the other. Screenshots in both régimes caught them;
typecheck never did.

**2. The accent has four homes and no others.** The primary button, a key
figure, the active nav state, and the icon chip of the single inverted card in
a grid. Always ink text on it, never white. One accent element per visible
screen. Never as a status colour: success and error have their own family.

**3. Cards carry no shadow and no border.** They separate from the ground by
value alone. `shadow-float` exists for genuinely floating things — a dropdown,
a popover.

## Theming

Three layers, in this order:

| Layer | File | What it holds |
|---|---|---|
| Primitives | `styles/primitives.css` | Spacing, radii, motion, the type ramp. No colour. |
| Theme | `styles/themes/kardloop.css` | The palette, the font family, the halo. |
| Semantic | `styles/semantic.css` | What each colour is *for*, in both régimes. |

**The demo has a theme editor.** Run `pnpm demo:open`, go to the Theme tab,
change colours and fonts, and watch every component on every tab repaint. It
emits two things:

- **The theme file**, containing only what you changed — paste it into your
  project and import it after `styles.css`.
- **A setup prompt**, which carries the install command, the import order, the
  theme inline, the four traps that fail silently, and a verification step.
  Paste it into a coding agent in the target project and the setup is done. It
  is written to work with no other context.

To brand another product by hand, compose the layers yourself:

```css
@import "tailwindcss";
@import "@halo/ui/dist/styles/primitives.css";
@import "./my-theme.css";          /* your palette */
@import "@halo/ui/dist/styles/semantic.css";
@import "@halo/ui/dist/styles/theme.css";
@import "@halo/ui/dist/styles/keyframes.css";
@import "@halo/ui/dist/styles/utilities.css";
@source "../node_modules/@halo/ui/dist";
```

A theme must land before `semantic.css`, which reads it.

Dark mode responds to `[data-theme="dark"]` and to a `.dark` class, so it works
whether the app uses Tailwind's default dark variant or its own attribute.

## Deliberate departures from the source

| Source | Here | Why |
|---|---|---|
| Inline styles throughout | Tailwind classes | `className` overrides work; consumers can extend. |
| `<style>` injected at runtime, 47 times | `keyframes.css`, declared once | The injection breaks under SSR and re-runs on every mount. |
| Lucide from a CDN via `window.lucide` | `lucide-react` via `DynamicIcon` | No global, no network dependency; per-glyph code splitting. |
| Leaflet injected from unpkg | An optional peer dependency | No third-party request per page; the version is yours. |
| CARTO basemaps | OpenStreetMap | CARTO now requires an API key. |
| A phase machine copy-pasted per button | `useAsyncVerdict` | One floor on the busy phase, one unmount guard, one set of rules. |
| `Math.random()` and `Date.now()` ids | Counters | Two nodes made in one millisecond collided, and React reused one DOM node. |
| `window.prompt` for a link address | An inline panel | A browser dialog cannot be styled or tested. |
| Unsanitised `innerHTML` | `sanitizeHtml`, through `DOMParser` | The value is HTML and it is rendered. See below. |
| French default labels | English, with `labels` props | The system is the deliverable; copy belongs to the product. |

## Still unresolved

- **The colours are eyedropper estimates** from a compressed screenshot, never
  confirmed against an original. This is the only thing in the library that was
  never verified. Use the demo's Theme tab to correct them.
- **Switzer loads from the Fontshare CDN.** No binaries ship. Self-host before
  production: a CDN in the critical path costs a render delay on exactly the
  screens where the type matters.
- **Lucide stands in for an icon set that was never supplied.**
- **Three Storybook stories.** The demo covers every component; Storybook is
  half-installed.

## Development

```bash
pnpm install
pnpm demo:open      # builds if stale, then opens it in your browser
pnpm demo:dev       # the same sheet with hot reload, on localhost
pnpm demo           # build only, to demo-dist/index.html
pnpm check          # the full gate chain
pnpm build          # tsup → dist, then the stylesheets
pnpm storybook      # three stories, needs localhost
```

`demo:open` is the one to use. The demo is a single self-contained file, so it
opens straight from disk — no server, no port to forward. If you point Live
Server at it and see markup rather than a page, it is serving the workspace
root: the file is at `halo-ui/demo-dist/index.html`, and it does not need a
server at all.

### The gates

`pnpm check` runs 21 in sequence. Every one exists because it caught a real
bug — not one was written speculatively.

| Gate | What it proves |
|---|---|
| `typecheck` | The TypeScript surface is sound. |
| `check:cn` | Custom Tailwind scales resolve in a merge, so consumer overrides win. |
| `check:numbers` | Money and figures parse and format in both conventions. |
| `check:dates` | Dates survive time zones, month lengths and typed input. |
| `check:price` | A pricing string is either a number or left verbatim. |
| `check:chart` | Axis maths, and that a smoothed curve never overshoots its own data. |
| `check:plot` | Drag-to-value mapping on normal and reversed axes. |
| `check:diagram` | Anchors, side selection, and an elbow that never doubles back. |
| `check:swimlane` | Lane placement, and a backward edge that routes around, not through. |
| `check:erd` | SQL generation: quoting, composite keys, dangling relations. |
| `check:flow` | Validation — no trigger, unreachable nodes, half-wired conditions, cycles. |
| `check:builder` | Tree operations, the breakpoint cascade, and HTML escaping. |
| `check:geo` | Haversine distance, nesting isochrones, choropleth class breaks. |
| `check:table` | Filtering and sorting: date formats, empty cells, formatted amounts. |
| `check:chart-data` | CSV parsing, separator sniffing, and an export that reimports. |
| `check:whiteboard` | Normalised bounds, pointer-anchored zoom, freehand smoothing. |
| `check:rich-text` | Sanitising, **in a real browser**, with live payloads. |
| `check:document` | Block model, HTML and Markdown export, attribute escaping. |
| `demo` | The demo builds — which means Tailwind resolved every class used. |
| `check:boot` | Every sheet loads in both régimes with no console error. |
| `check:phases` | All seven phase machines, in a real browser. |

Two of those are worth singling out.

**`check:rich-text` runs in Chromium** because sanitising is defined by how a
real HTML parser reshapes malformed input. A mock would agree with the
implementation and prove nothing. It fires six payloads at a live page and
asserts none executes — which is how the sanitiser's own parse step was found
to be the vulnerability: it assigned to a detached div's `innerHTML`, and the
browser fires an `<img onerror>` during that parse, before any sanitising runs.

**`check:boot` exists because the gate had a hole.** A regex with an invalid
character class is a syntax error that takes the whole bundle down at parse
time, and both `tsc` and the Vite build passed it without comment. The demo
gate only built; the screenshot scripts visit one sheet each. Nothing loaded
the other four.

`"use client"` is written onto every emitted chunk after the bundle, so the
library imports cleanly from a React Server Component tree.
