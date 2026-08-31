import * as React from "react";
import { createRoot } from "react-dom/client";
// A consumer of the library imports leaflet's stylesheet itself — the package
// declares leaflet as an optional peer and never injects it from a CDN.
import "leaflet/dist/leaflet.css";
// And the library's optional theming for leaflet's own controls, which ship
// hard-coded white and stay unreadable on a dark map otherwise.
import "../src/styles/leaflet.css";
import "./main.css";
import { FormsSheet } from "./forms";
import { SurfacesSheet } from "./surfaces";
import { DataSheet } from "./data";
import { AnalysisSheet } from "./analysis";
import { ThemeSheet } from "./theme";

import {
  AIButton,
  Blob,
  Button,
  CopyButton,
  CountUp,
  EnvelopeButton,
  HoldButton,
  Icon,
  IconChip,
  RewardButton,
  SaveButton,
  ScanButton,
  SearchButton,
  SectionMarker,
  SendButton,
  Spinner,
  StatBlock,
} from "../src";

/* -------------------------------------------------------------------------
 * Fake async work, so the choreographies actually run.
 * ---------------------------------------------------------------------- */

const succeeds =
  (value: unknown = true, delay = 900) =>
  () =>
    new Promise((resolve) => setTimeout(() => resolve(value), delay));

const fails =
  (delay = 900) =>
  () =>
    new Promise((_, reject) => setTimeout(() => reject(new Error("failed")), delay));

/* -------------------------------------------------------------------------
 * Page furniture
 * ---------------------------------------------------------------------- */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-t border-border-subtle pt-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading-m">{title}</h2>
        {note ? <p className="max-w-[70ch] text-body text-text-secondary">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {label ? <span className="text-body-s text-text-secondary">{label}</span> : null}
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

/** A do / don't pair, since several of the rules are only legible as contrast. */
function Judgement({
  verdict,
  caption,
  children,
}: {
  verdict: "do" | "dont";
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-[96px] items-center gap-4 rounded-card bg-surface-alt p-6">
        {children}
      </div>
      <div className="flex items-start gap-2">
        {/* Glyphs, not Unicode marks — the system forbids ✓ and ✕ standing in
            for icons. */}
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-white ${
            verdict === "do" ? "bg-success" : "bg-error"
          }`}
        >
          <Icon name={verdict === "do" ? "check" : "x"} size={11} strokeWidth={2.5} />
        </span>
        <span className="text-body-s text-text-secondary">{caption}</span>
      </div>
    </div>
  );
}

function Swatch({ token, name }: { token: string; name: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-14 w-full rounded-chip border border-border-subtle"
        style={{ background: `var(${token})` }}
      />
      <div className="flex flex-col">
        <span className="text-body-s font-medium">{name}</span>
        <code className="text-[11px] text-text-secondary">{token}</code>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Theme control
 * ---------------------------------------------------------------------- */

function useTheme() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) };
}

/* -------------------------------------------------------------------------
 * Sheet
 * ---------------------------------------------------------------------- */

type Tab = "core" | "forms" | "surfaces" | "data" | "analysis" | "theme";

function Sheet() {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = React.useState<Tab>("core");

  return (
    <div className="min-h-screen pb-40">
      {/* The one piece of chrome: the régime toggle. Everything below responds
          to it, which is the point of the whole token architecture. */}
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface-page/90 backdrop-blur-sm">
        <div className="halo-container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-heading-s">Halo</span>
            <nav className="flex items-center gap-1">
              {(["core", "forms", "surfaces", "data", "analysis", "theme"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTab(name)}
                  className={
                    "h-8 rounded-pill px-3.5 font-sans text-body-s font-medium capitalize transition-colors duration-[120ms] ease-standard halo-focus " +
                    (tab === name
                      ? "bg-ink text-paper"
                      : "bg-transparent text-text-secondary hover:bg-mist")
                  }
                >
                  {name}
                </button>
              ))}
            </nav>
          </div>
          <Button
            variant="outlined"
            size="sm"
            onClick={toggle}
            iconLeft={<Icon name={theme === "light" ? "moon" : "sun"} size={16} />}
          >
            {theme === "light" ? "Dark" : "Light"}
          </Button>
        </div>
      </header>

      <div className="halo-container flex flex-col gap-16 pt-16">
        {tab === "forms" ? (
          <FormsSheet />
        ) : tab === "surfaces" ? (
          <SurfacesSheet />
        ) : tab === "data" ? (
          <DataSheet />
        ) : tab === "analysis" ? (
          <AnalysisSheet />
        ) : tab === "theme" ? (
          <ThemeSheet dark={theme === "dark"} />
        ) : <>
        {/* ---- Intro ---- */}
        <section className="flex flex-col gap-6">
          <div>
            <SectionMarker />
            <span className="text-eyebrow">Component sheet</span>
          </div>
          <h1 className="max-w-[18ch] text-display-l">Every core component, both régimes.</h1>
          <p className="max-w-[68ch] text-body-l text-text-secondary">
            Toggle the régime above. Nothing on this page is re-styled by the toggle — every
            component reads semantic aliases, and the aliases re-point. That indirection is the
            whole reason a theme can be swapped without touching a component.
          </p>
        </section>

        {/* ---- Colour ---- */}
        <Section
          title="Colour"
          note="Components read these aliases and never a raw palette value. Watch them all re-point when you switch régime."
        >
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <span className="text-body-s text-text-secondary">Surfaces</span>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Swatch token="--color-surface-page" name="Page" />
                <Swatch token="--color-surface-alt" name="Alt" />
                <Swatch token="--color-surface-card" name="Card" />
                <Swatch token="--color-surface-sunken" name="Sunken" />
                <Swatch token="--color-surface-disabled" name="Disabled" />
                <Swatch token="--color-surface-code" name="Code" />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-body-s text-text-secondary">Action &amp; chrome</span>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Swatch token="--color-action-primary-bg" name="Primary" />
                <Swatch token="--color-action-primary-bg-hover" name="Primary hover" />
                <Swatch token="--color-action-primary-bg-press" name="Primary press" />
                <Swatch token="--color-action-secondary-bg" name="Secondary" />
                <Swatch token="--color-chip-neutral-bg" name="Chip" />
                <Swatch token="--color-focus-ring" name="Focus ring" />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-body-s text-text-secondary">
                Status — deliberately outside the accent family
              </span>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
                <Swatch token="--color-success" name="Success" />
                <Swatch token="--color-success-soft" name="Success soft" />
                <Swatch token="--color-warning" name="Warning" />
                <Swatch token="--color-warning-soft" name="Warning soft" />
                <Swatch token="--color-error" name="Error" />
                <Swatch token="--color-error-soft" name="Error soft" />
                <Swatch token="--color-info" name="Info" />
                <Swatch token="--color-info-soft" name="Info soft" />
              </div>
            </div>
          </div>
        </Section>

        {/* ---- Type ---- */}
        <Section
          title="Typography"
          note="Force comes from size and tightness, never from weight — nothing here is heavier than 600. The negative tracking is what stops the type reading generic, and it survives every breakpoint."
        >
          <div className="flex flex-col gap-6">
            {(
              [
                ["text-display-xl", "76 / 76 · −0.035em", "Ten minutes to launch."],
                ["text-display-l", "56 / 58 · −0.03em", "The counter, not the phone."],
                ["text-heading-m", "32 / 38 · −0.02em", "One gesture."],
                ["text-heading-s", "20 / 26 · −0.01em", "Card title"],
                ["text-eyebrow", "15 / 20 · sentence case", "Loyalty at the counter"],
                ["text-body-l", "18 / 28", "The intro paragraph, one size up from running text."],
                ["text-body", "16 / 26", "Running text, two or three sentences at most."],
                ["text-body-s", "14 / 22", "Card text and captions."],
              ] as const
            ).map(([cls, spec, sample]) => (
              <div
                key={cls}
                className="flex flex-col gap-1 border-b border-border-subtle pb-5 last:border-0"
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <code className="text-[11px] text-text-secondary">{cls}</code>
                  <span className="text-[11px] text-text-secondary">{spec}</span>
                </div>
                <span className={cls}>{sample}</span>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <code className="text-[11px] text-text-secondary">text-stat · always the accent</code>
              <span className="text-stat text-accent">
                <CountUp value={1208} />
              </span>
            </div>
          </div>
        </Section>

        {/* ---- Spacing & radii ---- */}
        <Section
          title="Spacing &amp; radii"
          note="Base 4, with deliberate gaps at 5, 7, 9 and 10 — a missing custom property voids the whole declaration silently, which caused real layout bugs in the source system. All buttons are total pills, without exception."
        >
          <div className="grid gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 6, 8, 12, 16, 20].map((step) => (
                <div key={step} className="flex items-center gap-4">
                  <code className="w-20 text-[11px] text-text-secondary">--space-{step}</code>
                  <div className="h-3 bg-accent" style={{ width: `var(--space-${step})` }} />
                  <span className="text-body-s text-text-secondary">{step * 4}px</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-6">
              {(
                [
                  ["rounded-pill", "Pill · every button"],
                  ["rounded-card", "Card · 24"],
                  ["rounded-panel", "Panel · 20"],
                  ["rounded-chip", "Chip · 12"],
                ] as const
              ).map(([cls, label]) => (
                <div key={cls} className="flex flex-col gap-2">
                  <div className={`size-20 bg-ink ${cls}`} />
                  <span className="text-body-s text-text-secondary">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ---- Button ---- */}
        <Section
          title="Button"
          note="The component everything else is measured against. Hover and press change colour only — never position, never a shadow."
        >
          <div className="flex flex-col gap-8">
            <Row label="Variants — primary lime, secondary ink, outlined 1.5px, texted bare">
              <Button variant="primary">Publish</Button>
              <Button variant="secondary">Scan</Button>
              <Button variant="outlined">Save draft</Button>
              <Button variant="texted">Cancel</Button>
            </Row>

            <Row label="Sizes — 40 / 48 / 56. Counter is the standing target.">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="counter">Counter</Button>
            </Row>

            <Row label="With icons, icon-only, and full width">
              <Button variant="secondary" iconLeft={<Icon name="qr-code" size={18} />}>
                Scan
              </Button>
              <Button variant="outlined" iconRight={<Icon name="arrow-right" size={18} />}>
                Continue
              </Button>
              <Button variant="secondary" iconOnly iconLeft={<Icon name="plus" size={18} />} />
              <Button variant="outlined" iconOnly iconLeft={<Icon name="settings" size={18} />} />
            </Row>

            <Row label="Split — the chevron opens a real menu. Back-office only.">
              <Button
                variant="primary"
                split
                menuItems={[
                  { label: "Publish and notify customers" },
                  { label: "Schedule publication" },
                  { label: "Delete draft", tone: "error" },
                ]}
              >
                Publish
              </Button>
              <Button
                variant="outlined"
                split
                menuAlign="left"
                menuItems={[
                  { label: "Export as CSV" },
                  { label: "Export as PDF", disabled: true },
                ]}
              >
                Export
              </Button>
            </Row>

            <Row label="Loading and disabled — disabled is a flat grey fill, not a translucent button">
              <Button loading>Publishing…</Button>
              <Button variant="secondary" loading>
                Saving…
              </Button>
              <Button disabled>Primary</Button>
              <Button variant="secondary" disabled>
                Secondary
              </Button>
              <Button variant="outlined" disabled>
                Outlined
              </Button>
            </Row>

            <div className="flex flex-col gap-3">
              <span className="text-body-s text-text-secondary">
                On the ink régime — outlined and texted keep a white label; secondary inverts
              </span>
              <div className="halo-halo flex flex-wrap items-center gap-4 rounded-card p-10">
                <Button variant="primary" onDark>
                  Create programme
                </Button>
                <Button variant="secondary" onDark>
                  Watch the demo
                </Button>
                <Button variant="outlined" onDark>
                  Learn more
                </Button>
                <Button variant="texted" onDark>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Section>

        {/* ---- The accent rule ---- */}
        <Section
          title="The accent rule"
          note="The accent has four homes: the primary button, a key figure, the active nav state, and the icon chip of the single inverted card in a grid. Nowhere else."
        >
          <div className="grid gap-8 md:grid-cols-2">
            <Judgement verdict="do" caption="One accent element. The eye knows where to go.">
              <Button variant="primary">Create programme</Button>
              <Button variant="outlined">Learn more</Button>
            </Judgement>
            <Judgement
              verdict="dont"
              caption="Two primaries side by side cancel each other out — neither reads as the action."
            >
              <Button variant="primary">Create programme</Button>
              <Button variant="primary">Watch the demo</Button>
            </Judgement>
            <Judgement verdict="do" caption="Ink text on the accent. Always.">
              <span className="inline-flex h-12 items-center rounded-pill bg-accent px-7 text-button font-medium text-ink">
                Create programme
              </span>
            </Judgement>
            <Judgement
              verdict="dont"
              caption="White on the accent fails contrast and looks washed out on a counter screen in daylight."
            >
              <span className="inline-flex h-12 items-center rounded-pill bg-accent px-7 text-button font-medium text-white">
                Create programme
              </span>
            </Judgement>
          </div>
        </Section>

        {/* ---- Primitives ---- */}
        <Section title="Primitives" note="The small parts the rest of the system is built from.">
          <div className="flex flex-col gap-10">
            <Row label="Icon chip — 40×40. The inverted one is reserved for the single flipped card in a grid.">
              <IconChip icon={<Icon name="qr-code" />} />
              <IconChip icon={<Icon name="gift" />} />
              <IconChip icon={<Icon name="line-chart" />} />
              <IconChip icon={<Icon name="zap" />} inverted />
            </Row>

            <Row label="Icons — monochrome, 1.5px stroke, currentColor. No emoji, ever.">
              {(
                ["qr-code", "scan-line", "store", "users", "gift", "zap", "line-chart", "layout-dashboard", "settings", "check"] as const
              ).map((name) => (
                <span key={name} className="flex flex-col items-center gap-2">
                  <Icon name={name} size={24} />
                  <code className="text-[10px] text-text-secondary">{name}</code>
                </span>
              ))}
            </Row>

            <div className="flex flex-col gap-3">
              <span className="text-body-s text-text-secondary">
                Stat block — the figure counts up when it scrolls into view. Only the first is
                accented; a row of three lime figures spends the accent three times.
              </span>
              <div className="flex flex-wrap gap-16">
                <StatBlock value={<CountUp value={1208} />} label="Covers won back this month" />
                <StatBlock value="10 min" label="To launch a programme" tone="neutral" />
                <StatBlock value="+18 %" label="Repeat visits" tone="neutral" />
              </div>
            </div>

            <Row label="Spinner — the processing state of a button">
              <Spinner size={14} />
              <Spinner size={20} />
              <Spinner size={28} />
            </Row>

            <div className="flex flex-col gap-3">
              <span className="text-body-s text-text-secondary">
                Blob — a flat circle behind a product visual. No border, no shadow, no gradient.
              </span>
              <div className="relative h-56 overflow-hidden rounded-card bg-surface-alt">
                <Blob size={260} className="-right-12 top-6" />
                <div className="relative z-10 flex h-full flex-col justify-center p-8">
                  <SectionMarker />
                  <span className="text-heading-m">Behind a product visual.</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ---- Choreographed buttons ---- */}
        <Section
          title="Choreographed buttons"
          note="The system's only sustained motion, each tied to one moment. Press them: the busy phase is floored so the animation always reads, even when the promise resolves instantly. Sound plays on the verdict."
        >
          <div className="flex flex-col gap-10">
            <Row label="Send — the plane pitches up, cruises, then leaves the frame with confetti">
              <SendButton onSend={succeeds()} />
              <SendButton onSend={succeeds()} hold />
              <SendButton onSend={fails()}>Send (fails)</SendButton>
            </Row>

            <Row label="Reward — held by default; crediting a cover back is not reversible">
              <RewardButton onClaim={succeeds()} />
              <RewardButton onClaim={fails()} />
            </Row>

            <Row label="Scan — the beam reads the code, modules light, the frame locks">
              <ScanButton onScan={succeeds("Marie")} />
              <ScanButton onScan={fails()} />
            </Row>

            <Row label="AI — the robot bobs and the label rotates; this one runs six seconds">
              <AIButton onAsk={succeeds(true, 6000)} />
            </Row>

            <Row label="Save — the reel turns while the write is in flight. The dot is the unsaved marker.">
              <SaveButton onSave={succeeds()} />
              <SaveButton onSave={succeeds()} variant="primary" dirty={false} />
              <SaveButton onSave={fails()} />
            </Row>

            <Row label="Copy — the front sheet lifts off the stack">
              <CopyButton value="https://example.com/card/8412" />
              <CopyButton value="x" variant="primary" />
            </Row>

            <Row label="Search — the lens sweeps the lines and magnifies each as it passes">
              <SearchButton onSearch={succeeds(128)} />
              <SearchButton onSearch={fails()} />
            </Row>

            <Row label="Envelope — the flap swings back, the letter rises out">
              <EnvelopeButton onOpen={succeeds()} />
            </Row>

            <Row label="Hold — press and hold. Releasing early retracts the fill visibly.">
              <HoldButton onConfirm={() => undefined} />
              <HoldButton size="counter" onConfirm={() => undefined}>
                Hold to validate
              </HoldButton>
            </Row>
          </div>
        </Section>

        {/* ---- Counter mode ---- */}
        <Section
          title="Counter mode"
          note="Used standing, behind a counter, at peak service, sometimes in daylight on a cheap screen. Targets rise to 56px, and display sizes cap well below the landing page's."
        >
          <div className="flex flex-col gap-6 rounded-card bg-surface-alt p-8">
            <span className="text-app-title">Table 4 — Marie</span>
            <div className="flex flex-wrap items-center gap-4">
              <ScanButton onScan={succeeds("Marie")} size="counter" />
              <RewardButton onClaim={succeeds()} size="counter" />
              <HoldButton size="counter" onConfirm={() => undefined}>
                Hold to validate
              </HoldButton>
            </div>
            <p className="max-w-[60ch] text-body-s text-text-secondary">
              Note what is absent: no accent text on dark for dense information, and no display
              sizes. Both are landing-page devices that fail at arm's length.
            </p>
          </div>
        </Section>

        {/* ---- Focus ---- */}
        <Section
          title="Focus"
          note="Tab through this page. The 2px ring appears for keyboard focus only, so a mouse click never leaves an outline behind — but a keyboard user is never left without one."
        >
          <Row>
            <Button variant="primary">Focus me</Button>
            <Button variant="secondary">Then me</Button>
            <Button variant="outlined">And me</Button>
            <CopyButton value="tab-order" />
          </Row>
        </Section>

        </>}

        <footer className="border-t border-border-subtle pt-8 text-body-s text-text-secondary">
          Halo ·{" "}
          {tab === "forms"
            ? "forms, 36 components"
            : tab === "surfaces"
              ? "feedback, overlays, cards, navigation — 24 components"
              : tab === "data"
                ? "charts and table — 20 components"
                : tab === "analysis"
                  ? "matrices, messaging, data — 11 components"
                  : "core, 18 components"}{" "}
          · generated from the library source, not a mock-up.
        </footer>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Sheet />
  </React.StrictMode>,
);
