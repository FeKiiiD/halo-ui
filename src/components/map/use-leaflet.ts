import * as React from "react";

/**
 * Basemaps.
 *
 * OPENSTREETMAP'S OWN TILES, NOT CARTO'S. Carto's Positron and Dark Matter are
 * prettier under a choropleth, but they now require an API key — a component
 * that stamps "API KEY REQUIRED" across the map for anyone who has not signed
 * up for a third-party service is not a component anyone can drop in. OSM
 * standard needs no key and no account.
 *
 * There is no dark OSM raster, so the dark régime filters the same tiles.
 * Inverting and re-rotating the hue keeps roads and water the right way round
 * rather than producing a photo negative.
 */
export const BASEMAPS = {
  light: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    filter: "saturate(0.75) brightness(1.03)",
  },
  dark: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    filter: "invert(1) hue-rotate(180deg) saturate(0.5) brightness(0.9) contrast(1.05)",
  },
  /**
   * For a choropleth. OSM raster bakes its labels into the tile, so they
   * cannot be removed — they are pushed back instead, hard, until the fills
   * are what the eye lands on. Losing contrast in the basemap is the right
   * trade: the zones carry the data, and the tiles are orientation only.
   */
  lightPlain: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    filter: "grayscale(1) brightness(1.22) contrast(0.62) opacity(0.72)",
  },
  darkPlain: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    filter: "invert(1) grayscale(1) brightness(0.72) contrast(0.7) opacity(0.68)",
  },
} as const;

export type BasemapName = keyof typeof BASEMAPS;

/** Reads the régime the page is actually in, both attribute and class forms. */
export function useIsDark(): boolean {
  const read = React.useCallback(() => {
    if (typeof document === "undefined") return false;
    const root = document.documentElement;
    if (root.getAttribute("data-theme") === "dark") return true;
    if (root.getAttribute("data-theme") === "light") return false;
    if (root.classList.contains("dark")) return true;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  }, []);

  const [dark, setDark] = React.useState(read);

  React.useEffect(() => {
    const update = () => setDark(read());
    update();

    // The attribute can change without any event, so the root is observed
    // rather than polled — a map that keeps its light tiles after a theme
    // switch is the most visible way a component can ignore the theme.
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", update);

    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", update);
    };
  }, [read]);

  return dark;
}

export type LeafletModule = typeof import("leaflet");

export interface UseLeaflet {
  L: LeafletModule | null;
  /** True until the import settles, either way. */
  loading: boolean;
  /** Set when leaflet is not installed, or its stylesheet is missing. */
  error: Error | null;
}

let cached: Promise<LeafletModule> | null = null;

/**
 * Loads leaflet from the consumer's own dependency.
 *
 * NOT FROM A CDN. The source injected a script tag from unpkg, which means a
 * map that breaks when the CDN does, a request to a third party on every page
 * that shows one, and a version nobody has pinned in their lockfile. Leaflet
 * is an optional peer dependency instead: a project that shows maps installs
 * it, a project that does not never pays for it, and either way the version is
 * the consumer's choice.
 *
 * The import is dynamic so that merely importing this component from the
 * barrel does not require leaflet to be present.
 */
export function useLeaflet(): UseLeaflet {
  const [state, setState] = React.useState<UseLeaflet>({
    L: null,
    loading: true,
    error: null,
  });

  React.useEffect(() => {
    let alive = true;

    cached ??= import("leaflet").then((module) => module.default ?? module);

    cached.then(
      (L) => {
        if (alive) setState({ L, loading: false, error: null });
      },
      (cause: unknown) => {
        // Reset so a later mount can retry — an install may have happened
        // since, and a permanently poisoned cache would need a page reload.
        cached = null;
        if (alive) {
          setState({
            L: null,
            loading: false,
            error: new Error(
              "Leaflet is not available. Install it alongside this package: npm i leaflet, and import 'leaflet/dist/leaflet.css'.",
              { cause },
            ),
          });
        }
      },
    );

    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/**
 * Warns once when leaflet's stylesheet is missing.
 *
 * Without it the map renders as a pile of unpositioned tiles — visually
 * broken in a way that looks like a bug in this component rather than a
 * missing import, so it is worth saying out loud.
 */
export function useLeafletCssCheck(ready: boolean): boolean {
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    if (!ready || typeof document === "undefined") return;

    // Leaflet's own stylesheet sets position:absolute on this class. If the
    // computed value is not that, the CSS never loaded.
    const probe = document.createElement("div");
    probe.className = "leaflet-pane";
    probe.style.display = "none";
    document.body.appendChild(probe);

    const positioned = getComputedStyle(probe).position === "absolute";
    document.body.removeChild(probe);

    setMissing(!positioned);
  }, [ready]);

  return missing;
}
