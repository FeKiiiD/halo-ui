import * as React from "react";
import {
  Button,
  CopyButton,
  DataTable,
  DonutChart,
  Icon,
  IconChip,
  LineChart,
  StatBlock,
  Switch,
  Badge,
} from "../src";
import { Section } from "./forms";
import {
  ALL_TOKENS,
  TOKEN_GROUPS,
  applyTheme,
  contrast,
  readAll,
  resetTheme,
  toHex,
  toThemeCss,
  type ThemeState,
  type TokenSpec,
} from "./theme-tokens";
import { buildSetupPrompt } from "./setup-prompt";

/**
 * Whether two font stacks name the same family first.
 *
 * A computed stack comes back with its own quoting and spacing, so comparing
 * it to a literal preset by string equality almost never holds — and when it
 * accidentally does, it marks the wrong preset active. Only the first family
 * decides, since that is the one that actually renders.
 */
const sameStack = (a: string, b: string) => {
  const head = (stack: string) =>
    (stack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  return Boolean(a) && head(a) === head(b);
};

/** Font stacks worth trying without leaving the page. */
const FONT_PRESETS = [
  { label: "Switzer", value: '"Switzer", "Switzer Variable", system-ui, sans-serif' },
  { label: "System", value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: "Inter", value: '"Inter", system-ui, sans-serif' },
  { label: "Geist", value: '"Geist", system-ui, sans-serif' },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Mono", value: 'ui-monospace, "SFMono-Regular", Menlo, monospace' },
];

/**
 * The theme editor.
 *
 * IT WRITES ONTO THE LIVE DOCUMENT, so every component on every other tab is
 * already showing the change — there is no separate preview to keep in sync,
 * and nothing can look right here and wrong elsewhere.
 *
 * The export emits only what differs from the base theme. A wall of unchanged
 * values would hide the three tokens somebody actually moved, which is the
 * whole reason they came here.
 */
export function ThemeSheet({ dark }: { dark: boolean }) {
  const [defaults, setDefaults] = React.useState<ThemeState | null>(null);
  const [state, setState] = React.useState<ThemeState>({ light: {}, dark: {} });
  const [name, setName] = React.useState("Custom");
  const [showCss, setShowCss] = React.useState(false);
  const [showPrompt, setShowPrompt] = React.useState(false);
  // Remembered, because the repo does not change between visits and retyping
  // it every time is exactly the friction this panel exists to remove.
  const [repo, setRepo] = React.useState(() => {
    try {
      return localStorage.getItem("halo-repo") ?? "github:FeKiiiD/halo-ui";
    } catch {
      return "github:FeKiiiD/halo-ui";
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem("halo-repo", repo);
    } catch {
      /* a private window is not a reason to fail */
    }
  }, [repo]);

  // The defaults are read once, from the stylesheet, before anything is
  // overridden — reading them later would return the edits.
  React.useEffect(() => {
    if (defaults) return;

    const root = document.documentElement;
    const wasDark = root.getAttribute("data-theme") === "dark";

    root.setAttribute("data-theme", "light");
    const light = readAll(root);

    root.setAttribute("data-theme", "dark");
    const darkValues = readAll(root);

    root.setAttribute("data-theme", wasDark ? "dark" : "light");

    setDefaults({ light, dark: darkValues });
    setState({ light: { ...light }, dark: { ...darkValues } });
  }, [defaults]);

  React.useEffect(() => {
    if (defaults) applyTheme(state, dark);
  }, [state, dark, defaults]);

  // Leaving the tab must not leave the document repainted.
  React.useEffect(() => () => resetTheme(), []);

  if (!defaults) return null;

  const scope = dark ? "dark" : "light";

  const set = (token: TokenSpec, value: string) => {
    setState((current) => {
      const next = { ...current, [scope]: { ...current[scope], [token.name]: value } };

      // A token with no dark override lives in the light map only, so editing
      // it while dark is on has to write there or the change vanishes on the
      // next repaint.
      if (dark && !token.dark) {
        next.light = { ...next.light, [token.name]: value };
      }
      return next;
    });
  };

  const valueOf = (token: TokenSpec) =>
    (dark && token.dark ? state.dark[token.name] : state.light[token.name]) ?? "";

  const css = toThemeCss(state, defaults, name);
  const prompt = buildSetupPrompt({
    repo,
    themeName: name,
    state,
    defaults,
    fontStack: state.light["--font-sans"] ?? "",
  });
  const changedCount = ALL_TOKENS.filter(
    (token) =>
      state.light[token.name] !== defaults.light[token.name] ||
      (token.dark && state.dark[token.name] !== defaults.dark[token.name]),
  ).length;

  /* --- contrast warnings ---------------------------------------------------
   * Only the pairs a component actually puts together. A warning about a
   * combination nobody renders is noise, and noise is what makes people stop
   * reading warnings. */
  const pairs = [
    { label: "Text on page", fg: dark ? state.light["--color-paper"] : state.light["--color-ink"], bg: dark ? state.light["--color-ink"] : state.light["--color-paper"] },
    { label: "Ink on accent", fg: state.light["--color-accent-ink"], bg: state.light["--color-accent"] },
    { label: "Muted on page", fg: dark ? state.light["--color-text-muted-dark"] : state.light["--color-text-muted-light"], bg: dark ? state.light["--color-ink"] : state.light["--color-paper"] },
  ].filter((pair) => pair.fg && pair.bg);

  return (
    <div className="flex flex-col gap-16">
      <Section
        title="Theme"
        note="Every token here writes straight onto the live document, so the other tabs are already showing the change — there is no separate preview to drift out of sync. The export emits only what differs from the base theme, so what you paste is a diff you can read rather than a wall of unchanged values."
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-body-s text-text-secondary">Theme name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 w-44 rounded-input border border-border-subtle bg-surface-card px-3 font-sans text-body-s text-text-primary outline-none focus:border-border-strong"
            />
          </label>

          <span className="text-body-s tabular-nums text-text-secondary">
            {changedCount} token{changedCount === 1 ? "" : "s"} changed
          </span>

          <span className="ml-auto flex gap-2">
            <Button
              variant="outlined"
              size="sm"
              onClick={() => setState({ light: { ...defaults.light }, dark: { ...defaults.dark } })}
            >
              Reset
            </Button>
            <Button variant="outlined" size="sm" onClick={() => setShowCss(!showCss)}>
              {showCss ? "Hide the CSS" : "Show the CSS"}
            </Button>
            <Button size="sm" onClick={() => setShowPrompt(!showPrompt)}>
              {showPrompt ? "Hide the prompt" : "Setup prompt"}
            </Button>
          </span>
        </div>

        {pairs.length ? (
          <div className="flex flex-wrap gap-2">
            {pairs.map((pair) => {
              const ratio = contrast(pair.fg!, pair.bg!);
              // 4.5:1 is the WCAG AA threshold for body text. Below it, a
              // reader with ordinary eyesight in ordinary light struggles.
              const ok = ratio >= 4.5;

              return (
                <span
                  key={pair.label}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[12.5px]",
                    ok ? "border-border-subtle text-text-secondary" : "border-warning bg-warning-soft text-warning",
                  ].join(" ")}
                >
                  <Icon name={ok ? "check" : "triangle-alert"} size={12} />
                  {pair.label}
                  <span className="tabular-nums opacity-80">{ratio.toFixed(1)}:1</span>
                </span>
              );
            })}
          </div>
        ) : null}

        {showPrompt ? (
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
              <span className="text-[13.5px] font-medium text-text-primary">Setup prompt</span>
              <label className="flex items-center gap-2">
                <span className="text-[12.5px] text-text-secondary">Repo</span>
                <input
                  value={repo}
                  onChange={(event) => setRepo(event.target.value)}
                  placeholder="github:FeKiiiD/halo-ui"
                  aria-label="Repository"
                  className="h-8 w-56 rounded-input border border-border-subtle bg-surface-page px-2.5 font-mono text-[12px] text-text-primary outline-none focus:border-border-strong"
                />
              </label>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[12px] tabular-nums text-text-secondary">
                  {prompt.split(/\s+/).length} words
                </span>
                <CopyButton value={prompt} iconOnly />
              </span>
            </div>

            <p className="m-0 border-b border-hairline bg-surface-alt px-4 py-2.5 text-[12.5px] leading-[1.5] text-text-secondary">
              Paste this into a coding agent in the target project. It carries the install
              command, the import order, this theme inline, the four traps that fail
              silently, and a verification step — so it works with no other context.
            </p>

            <pre className="m-0 max-h-96 overflow-auto p-4 font-mono text-[11.5px] leading-[1.6] text-text-primary">
              {prompt}
            </pre>
          </div>
        ) : null}

        {showCss ? (
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
              <span className="mr-auto text-[13.5px] font-medium text-text-primary">
                {name.toLowerCase().replace(/\s+/g, "-")}.css
              </span>
              <CopyButton value={css} iconOnly />
            </div>
            <pre className="m-0 max-h-96 overflow-auto p-4 font-mono text-[12px] leading-[1.55] text-text-primary">
              {css}
            </pre>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {TOKEN_GROUPS.map((group) => (
            <div
              key={group.key}
              className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-card p-card"
            >
              <span className="flex flex-col gap-1">
                <span className="text-[14px] font-medium text-text-primary">{group.label}</span>
                {group.note ? (
                  <span className="text-[12.5px] leading-[1.45] text-text-secondary">
                    {group.note}
                  </span>
                ) : null}
              </span>

              <div className="flex flex-col gap-2">
                {group.tokens.map((token) => (
                  <TokenRow
                    key={token.name}
                    token={token}
                    value={valueOf(token)}
                    dark={dark}
                    onChange={(value) => set(token, value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Live preview"
        note="The same components as the other tabs, gathered here so a change can be judged against everything at once rather than one screen at a time."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outlined">Outlined</Button>
          <Button variant="texted">Texted</Button>
          <Button disabled>Disabled</Button>
          <IconChip icon={<Icon name="qr-code" size={20} />} />
          <Switch defaultChecked label="On" />
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="error">Error</Badge>
          <Badge tone="info">Info</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Only the first takes the accent: a row of three lime figures
              spends the accent three times, which is the rule this component
              exists to enforce. */}
          <StatBlock label="Cards in circulation" value="1 208" tone="accent" />
          <StatBlock label="Active" value="842" tone="neutral" />
          <StatBlock label="Redemption rate" value="11,4 %" tone="neutral" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-card border border-border-subtle bg-surface-card p-card">
            <LineChart
              labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
              series={[
                { name: "Cards", values: [42, 58, 71, 64, 89, 112] },
                { name: "Rewards", values: [8, 14, 19, 17, 26, 34] },
              ]}
              height={220}
              smooth
            />
          </div>

          <div className="rounded-card border border-border-subtle bg-surface-card p-card">
            <DonutChart
              data={[
                { label: "Lunch", value: 182 },
                { label: "Dinner", value: 264 },
                { label: "Delivery", value: 61 },
                { label: "Catering", value: 24 },
              ]}
              legend="right"
            />
          </div>
        </div>

        <DataTable
          columns={[
            { key: "name", label: "Customer", type: "text" },
            { key: "visits", label: "Visits", type: "number", align: "right" },
            { key: "spend", label: "Spend", type: "amount", align: "right" },
            {
              key: "status",
              label: "Status",
              type: "select",
              tones: { Loyal: "success", Regular: "accent", Lapsed: "error" },
            },
          ]}
          rows={[
            { id: "1", name: "Marie Dupont", visits: 42, spend: "1208.5", status: "Regular" },
            { id: "2", name: "Alice Moreau", visits: 67, spend: "2410.9", status: "Loyal" },
            { id: "3", name: "Paul Girard", visits: 5, spend: "96", status: "Lapsed" },
          ]}
        />
      </Section>
    </div>
  );
}

/** One editable token. */
function TokenRow({
  token,
  value,
  dark,
  onChange,
}: {
  token: TokenSpec;
  value: string;
  dark: boolean;
  onChange: (value: string) => void;
}) {
  if (token.kind === "font") {
    return (
      <label className="flex flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="text-[12.5px] text-text-primary">{token.label}</span>
          <code className="font-mono text-[11px] text-text-secondary">{token.name}</code>
        </span>

        <span className="flex flex-wrap gap-1">
          {FONT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.value)}
              aria-pressed={sameStack(value, preset.value)}
              className={[
                "h-7 rounded-pill border px-2.5 text-[12px] halo-focus",
                sameStack(value, preset.value)
                  ? "border-accent-deep bg-accent text-accent-ink"
                  : "border-border-subtle bg-transparent text-text-primary hover:bg-surface-alt",
              ].join(" ")}
              style={{ fontFamily: preset.value }}
            >
              {preset.label}
            </button>
          ))}
        </span>

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={token.label}
          className="h-8 w-full rounded-input border border-border-subtle bg-surface-page px-2.5 font-mono text-[11.5px] text-text-primary outline-none focus:border-border-strong"
        />
      </label>
    );
  }

  const hex = toHex(value);

  return (
    <label className="flex items-center gap-2.5">
      {/* The native picker, plus the hex in text: a picker alone cannot be
          pasted into, and pasting a brand hex is the common case. */}
      <input
        type="color"
        value={hex}
        onChange={(event) => onChange(event.target.value)}
        aria-label={token.label}
        className="size-7 shrink-0 cursor-pointer rounded-lg border border-border-subtle bg-transparent p-0.5"
      />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate text-[12.5px] text-text-primary">{token.label}</span>
          {token.dark && dark ? (
            <span className="shrink-0 rounded-pill bg-mist px-1.5 text-[10px] text-text-secondary">
              dark
            </span>
          ) : null}
        </span>
        {token.note ? (
          <span className="truncate text-[11px] text-text-secondary">{token.note}</span>
        ) : null}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${token.label} value`}
        spellCheck={false}
        className="h-7 w-24 shrink-0 rounded-md border border-border-subtle bg-surface-page px-2 font-mono text-[11.5px] tabular-nums text-text-primary outline-none focus:border-border-strong"
      />
    </label>
  );
}
