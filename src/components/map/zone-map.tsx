import * as React from "react";
import { cn } from "../../lib/cn";
import { classBreaks, classOf, sampleRamp, type ScaleKind } from "../../lib/geo";
import { Icon } from "../core/icon";
import { Spinner } from "../core/spinner";
import { BASEMAPS, useIsDark, useLeaflet, useLeafletCssCheck } from "./use-leaflet";

/** A GeoJSON FeatureCollection, kept loose so any source works. */
export interface ZoneShapes {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties?: Record<string, unknown>;
    geometry: unknown;
  }[];
}

export interface ZoneMapProps {
  shapes: ZoneShapes;
  /** Value per zone, keyed by the feature property named in `keyProp`. */
  values: Record<string, number>;

  /** Feature property holding the join key. */
  keyProp?: string;
  /** Feature property holding the display name. */
  nameProp?: string;

  scale?: ScaleKind;
  steps?: number;
  /** Light to dark. Sampled to `steps`, never sliced. */
  ramp?: string[];

  title?: React.ReactNode;
  legendLabel?: string;
  format?: (value: number) => string;

  height?: number;
  onSelect?: (zone: { key: string; name: string; value: number | null }) => void;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

/**
 * Light to dark, five stops. Not the accent: a choropleth needs a ramp with an
 * ordered lightness, and the accent is a single flat colour that means
 * "primary action" everywhere else in the system.
 */
const DEFAULT_RAMP = ["#e7f0ee", "#b9d9d0", "#7fbcac", "#4a9683", "#1f6b58"];

/**
 * A choropleth: zones filled by value, on a label-free basemap.
 *
 * PLACE NAMES UNDER A FILL ARE NOISE, which is why the basemap has none. The
 * zone boundaries and the tooltip carry the identity; the tiles are there for
 * orientation only.
 *
 * The classification is the part that decides whether the map tells the truth.
 * Quantile breaks follow the data's shape, which is right when the question is
 * "which zones are highest"; linear breaks keep equal intervals, which is
 * right when the question is "how much". Neither is a default that suits both,
 * so both are offered and the legend always shows the actual boundaries.
 */
export function ZoneMap({
  shapes,
  values,
  keyProp = "code",
  nameProp = "name",
  scale = "quantile",
  steps = 5,
  ramp = DEFAULT_RAMP,
  title,
  legendLabel,
  format = (value) => new Intl.NumberFormat().format(value),
  height = 420,
  onSelect,
  labels,
  className,
}: ZoneMapProps) {
  const text = {
    loading: "Loading the map…",
    noData: "No value",
    missingCss: "Leaflet's stylesheet is missing: import 'leaflet/dist/leaflet.css'.",
    empty: "No zones to draw.",
    ...labels,
  };

  const host = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<L.Map | null>(null);
  const layer = React.useRef<L.GeoJSON | null>(null);
  const tiles = React.useRef<L.TileLayer | null>(null);

  const [hover, setHover] = React.useState<{ name: string; value: number | null } | null>(null);

  const { L, loading, error } = useLeaflet();
  const dark = useIsDark();
  const cssMissing = useLeafletCssCheck(Boolean(L));

  const keyOf = React.useCallback(
    (feature: ZoneShapes["features"][number]) => String(feature.properties?.[keyProp] ?? ""),
    [keyProp],
  );
  const nameOf = React.useCallback(
    (feature: ZoneShapes["features"][number]) =>
      String(feature.properties?.[nameProp] ?? feature.properties?.[keyProp] ?? ""),
    [nameProp, keyProp],
  );

  const present = React.useMemo(
    () =>
      (shapes.features ?? [])
        .map((feature) => values[keyOf(feature)])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    [shapes, values, keyOf],
  );

  const breaks = React.useMemo(
    () => classBreaks(present, steps, scale),
    [present, steps, scale],
  );

  // The ramp carries one more colour than there are breaks: n breaks make n+1
  // classes.
  const colours = React.useMemo(
    () => sampleRamp(ramp, breaks.length + 1),
    [ramp, breaks.length],
  );

  const colourFor = React.useCallback(
    (value: number | null | undefined) => {
      const index = classOf(value, breaks);
      if (index == null) return dark ? "#1b2321" : "#eff3f2";
      return colours[Math.min(index, colours.length - 1)]!;
    },
    [breaks, colours, dark],
  );

  /* --- the map instance --------------------------------------------------- */

  React.useEffect(() => {
    if (!L || !host.current || map.current) return;

    const instance = L.map(host.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([46.6, 2.4], 5);

    instance.on("click", () => instance.scrollWheelZoom.enable());
    instance.on("mouseout", () => instance.scrollWheelZoom.disable());
    L.control.zoom({ position: "bottomright" }).addTo(instance);

    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
      tiles.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  React.useEffect(() => {
    if (!L || !map.current) return;

    // The label-free variant: names under a fill compete with the data.
    const basemap = BASEMAPS[dark ? "darkPlain" : "lightPlain"];
    tiles.current?.remove();
    tiles.current = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: 18,
    }).addTo(map.current);
    tiles.current.setZIndex(0);

    // The filter is what makes one raster source serve both régimes. It lands
    // on the tile pane rather than the container, so the markers drawn above
    // keep their real colours.
    const pane = map.current.getPane("tilePane");
    if (pane) pane.style.filter = basemap.filter;
  }, [L, dark]);

  /* --- the zones ----------------------------------------------------------- */

  React.useEffect(() => {
    if (!L || !map.current || !shapes.features?.length) return;

    layer.current?.remove();

    const geo = L.geoJSON(shapes as never, {
      style: (feature) => {
        const value = values[keyOf(feature as never)] ?? null;
        return {
          color: dark ? "rgba(255,255,255,0.22)" : "rgba(11,11,11,0.20)",
          weight: 0.8,
          fillColor: colourFor(value),
          // A zone with no data is deliberately flatter, so an absent value
          // never reads as a low one.
          fillOpacity: value == null ? 0.35 : 0.82,
        };
      },
      onEachFeature: (feature, entry) => {
        const key = keyOf(feature as never);
        const name = nameOf(feature as never);
        const value = values[key] ?? null;

        entry.on("mouseover", () => {
          setHover({ name, value });
          (entry as L.Path).setStyle({ weight: 2.2, color: "var(--color-text-primary)" });
          (entry as L.Path).bringToFront();
        });

        entry.on("mouseout", () => {
          setHover(null);
          geo.resetStyle(entry as L.Path);
        });

        entry.on("click", () => onSelect?.({ key, name, value }));
      },
    }).addTo(map.current);

    layer.current = geo;

    try {
      map.current.fitBounds(geo.getBounds(), { padding: [12, 12] });
    } catch {
      /* an empty or degenerate collection is not worth failing over */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, shapes, values, dark, breaks, colours]);

  /* --- render -------------------------------------------------------------- */

  const empty = !shapes.features?.length;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      {title || hover ? (
        <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-3">
          {title ? (
            <span className="mr-auto text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
              {title}
            </span>
          ) : (
            <span className="mr-auto" />
          )}

          {hover ? (
            <span className="inline-flex items-center gap-2 text-[13px]">
              <span className="text-text-primary">{hover.name}</span>
              <span className="tabular-nums text-text-secondary">
                {hover.value == null ? text.noData : format(hover.value)}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative" style={{ height }}>
        <div ref={host} className="size-full" />

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-alt text-body-s text-text-secondary">
            <Spinner size={16} />
            {text.loading}
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-alt px-6 text-center">
            <Icon name="map-pin-off" size={20} className="text-text-secondary" />
            <span className="max-w-md text-body-s text-text-secondary">{error.message}</span>
          </div>
        ) : null}

        {!error && !loading && empty ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-alt text-body-s text-text-secondary">
            {text.empty}
          </div>
        ) : null}

        {!error && cssMissing ? (
          <div className="absolute inset-x-3 top-3 z-1000 rounded-panel border border-warning bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
            {text.missingCss}
          </div>
        ) : null}
      </div>

      {!error && breaks.length ? (
        <div className="border-t border-hairline px-4 py-2.5">
          {legendLabel ? (
            <span className="mb-1.5 block text-[11.5px] text-text-secondary">{legendLabel}</span>
          ) : null}

          <div className="flex h-2 overflow-hidden rounded-full">
            {colours.map((colour, index) => (
              <span key={index} className="flex-1" style={{ background: colour }} />
            ))}
          </div>

          {/* The actual break values, not a smooth gradient caption: a legend
              that does not name its boundaries cannot be read back off the map. */}
          {/* Deduped: a break equal to the maximum would otherwise print the
              same number twice, which reads as a rendering fault. */}
          <div className="mt-1 flex justify-between text-[10.5px] tabular-nums text-text-secondary">
            {[...new Set([Math.min(...present), ...breaks, Math.max(...present)])].map((entry) => (
              <span key={entry}>{format(entry)}</span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
