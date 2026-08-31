import * as React from "react";
import { cn } from "../../lib/cn";
import {
  distanceKm,
  estimateIsochrones,
  formatKm,
  ringCounts,
  ringToFeature,
  type Isochrone,
  type LatLng,
} from "../../lib/geo";
import { Icon } from "../core/icon";
import { Spinner } from "../core/spinner";
import { BASEMAPS, useIsDark, useLeaflet, useLeafletCssCheck } from "./use-leaflet";

export interface CatchmentPoint extends LatLng {
  id?: string;
  label?: string;
  /** Scales the dot. Use visits, spend — whatever the map is about. */
  weight?: number;
}

export type CatchmentMode = "distance" | "time";

export interface CatchmentMapProps {
  center: LatLng;
  place?: string;
  points?: CatchmentPoint[];

  /** Ring radii in km, for distance mode. */
  rings?: number[];
  /** Ring times in minutes, for time mode. */
  times?: number[];
  /** Real routed isochrones. Without them, time mode models an estimate. */
  isochrones?: Isochrone[];
  /** Average speed used by the estimate, km/h. */
  speedKmh?: number;

  mode?: CatchmentMode;
  onModeChange?: (mode: CatchmentMode) => void;

  showRings?: boolean;
  showPoints?: boolean;
  controls?: boolean;
  legend?: boolean;

  height?: number;
  zoom?: number;
  onSelect?: (point: CatchmentPoint) => void;
  labels?: Partial<Record<string, string>>;
  className?: string;
}

/** Three rings, inner to outer. Never the accent: it is not a status colour. */
const RING_COLORS = ["var(--color-success)", "var(--color-info)", "var(--color-warning)"];

/**
 * A real catchment map: OSM tiles, the venue at the centre, reach rings, and
 * customer points weighted by frequency.
 *
 * GEOGRAPHY IS LOADED, NEVER DRAWN. A freehand map of a city is always wrong,
 * and wrong in a way that looks convincing — which is worse than no map.
 *
 * Time mode draws routed isochrones when the caller supplies them, and a
 * modelled estimate otherwise. The estimate is labelled as one on the map
 * itself, because a lobed shape looks exactly like real routing data and
 * nobody would otherwise know the difference.
 */
export function CatchmentMap({
  center,
  place,
  points = [],
  rings = [1, 2.5, 5],
  times = [5, 10, 20],
  isochrones,
  speedKmh = 22,
  mode: modeProp = "distance",
  onModeChange,
  showRings = true,
  showPoints = true,
  controls = true,
  legend = true,
  height = 420,
  zoom,
  onSelect,
  labels,
  className,
}: CatchmentMapProps) {
  const text = {
    distance: "Distance",
    time: "Time",
    estimated: "Estimated — no routing data",
    customers: "customers",
    loading: "Loading the map…",
    missingCss: "Leaflet's stylesheet is missing: import 'leaflet/dist/leaflet.css'.",
    ...labels,
  };

  const host = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<L.Map | null>(null);
  const overlay = React.useRef<L.LayerGroup | null>(null);
  const tiles = React.useRef<L.TileLayer | null>(null);

  const [mode, setMode] = React.useState<CatchmentMode>(modeProp);
  React.useEffect(() => setMode(modeProp), [modeProp]);

  const { L, loading, error } = useLeaflet();
  const dark = useIsDark();
  const cssMissing = useLeafletCssCheck(Boolean(L));

  const zones = React.useMemo(() => {
    if (mode !== "time") return null;
    return isochrones ?? estimateIsochrones(center, times, { speedKmh });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isochrones, center.lat, center.lng, times.join(), speedKmh]);

  const estimated = mode === "time" && !isochrones;

  const counts = React.useMemo(
    () => ringCounts(center, points, rings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center.lat, center.lng, points, rings.join()],
  );

  /* --- the map instance -------------------------------------------------- */

  React.useEffect(() => {
    if (!L || !host.current || map.current) return;

    const instance = L.map(host.current, {
      center: [center.lat, center.lng],
      zoom: zoom ?? 13,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    // Scroll-wheel zoom off by default, on once the map is clicked: a map
    // inside a scrolling page that swallows the wheel traps the reader.
    instance.on("click", () => instance.scrollWheelZoom.enable());
    instance.on("mouseout", () => instance.scrollWheelZoom.disable());

    L.control.zoom({ position: "bottomright" }).addTo(instance);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(instance);

    map.current = instance;
    overlay.current = L.layerGroup().addTo(instance);

    return () => {
      instance.remove();
      map.current = null;
      overlay.current = null;
      tiles.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  /* --- tiles follow the theme -------------------------------------------- */

  React.useEffect(() => {
    if (!L || !map.current) return;

    const basemap = BASEMAPS[dark ? "dark" : "light"];
    tiles.current?.remove();
    tiles.current = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: 20,
    }).addTo(map.current);

    // Behind everything the component draws.
    tiles.current.setZIndex(0);

    // The filter is what makes one raster source serve both régimes. It lands
    // on the tile pane rather than the container, so the markers drawn above
    // keep their real colours.
    const pane = map.current.getPane("tilePane");
    if (pane) pane.style.filter = basemap.filter;
  }, [L, dark]);

  /* --- overlays ----------------------------------------------------------- */

  React.useEffect(() => {
    if (!L || !map.current || !overlay.current) return;

    const group = overlay.current;
    group.clearLayers();

    if (showRings) {
      if (mode === "time" && zones) {
        zones.forEach((zone, index) => {
          L.geoJSON(ringToFeature(zone), {
            style: {
              color: RING_COLORS[index % RING_COLORS.length],
              weight: 1.5,
              fillColor: RING_COLORS[index % RING_COLORS.length],
              fillOpacity: 0.08,
              // Dashed says "modelled" without a word, and the legend says it
              // in words as well.
              dashArray: zone.estimated ? "6 5" : undefined,
            },
          })
            .bindTooltip(`${zone.minutes} min${zone.estimated ? " (estimated)" : ""}`)
            .addTo(group);
        });
      } else {
        [...rings]
          .sort((a, b) => b - a)
          .forEach((radius, index) => {
            const colour = RING_COLORS[(rings.length - 1 - index) % RING_COLORS.length]!;
            L.circle([center.lat, center.lng], {
              radius: radius * 1000,
              color: colour,
              weight: 1.5,
              fillColor: colour,
              fillOpacity: 0.07,
            })
              .bindTooltip(formatKm(radius))
              .addTo(group);
          });
      }
    }

    if (showPoints) {
      const weights = points.map((point) => point.weight ?? 1);
      const maxWeight = Math.max(1, ...weights);

      for (const point of points) {
        const weight = point.weight ?? 1;
        // sqrt, not linear: a dot's area is what the eye reads, so scaling the
        // radius linearly makes a customer with twice the visits look four
        // times as important.
        const radius = 4 + Math.sqrt(weight / maxWeight) * 7;

        L.circleMarker([point.lat, point.lng], {
          radius,
          color: "var(--color-accent-deep)",
          weight: 1.2,
          fillColor: "var(--color-accent)",
          fillOpacity: 0.75,
        })
          .bindTooltip(
            `${point.label ?? ""}${point.label ? " · " : ""}${formatKm(distanceKm(center, point))}`,
          )
          .on("click", () => onSelect?.(point))
          .addTo(group);
      }
    }

    // The venue, last so it sits above everything.
    L.circleMarker([center.lat, center.lng], {
      radius: 7,
      color: "var(--color-surface-card)",
      weight: 3,
      fillColor: "var(--color-text-primary)",
      fillOpacity: 1,
    })
      .bindTooltip(place ?? "", { permanent: false })
      .addTo(group);

    // Fit to the outermost ring, so the whole catchment is on screen.
    if (zoom == null) {
      const outer =
        mode === "time" && zones?.length
          ? ((zones[zones.length - 1]!.minutes / 60) * speedKmh) * 1000
          : Math.max(...rings) * 1000;

      try {
        map.current.fitBounds(
          L.latLng(center.lat, center.lng).toBounds(outer * 2.4),
          { padding: [16, 16] },
        );
      } catch {
        /* an unfittable bound is not worth failing the render over */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, dark, mode, zones, points, rings.join(), showRings, showPoints, center.lat, center.lng]);

  /* --- render -------------------------------------------------------------- */

  const setModeAndTell = (next: CatchmentMode) => {
    setMode(next);
    onModeChange?.(next);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-surface-card font-sans",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-3">
        <span className="mr-auto flex min-w-0 flex-col">
          {place ? (
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
              {place}
            </span>
          ) : null}
          <span className="text-[12.5px] tabular-nums text-text-secondary">
            {points.length} {text.customers}
          </span>
        </span>

        {controls ? (
          <span className="inline-flex gap-1 rounded-pill bg-mist p-0.75">
            {(["distance", "time"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setModeAndTell(entry)}
                aria-pressed={mode === entry}
                className={cn(
                  "h-6.5 rounded-pill border-none px-3 font-sans text-[12.5px] halo-focus",
                  "transition-colors duration-[140ms] ease-standard",
                  mode === entry
                    ? "bg-surface-card font-medium text-text-primary"
                    : "bg-transparent text-text-secondary",
                )}
              >
                {entry === "distance" ? text.distance : text.time}
              </button>
            ))}
          </span>
        ) : null}
      </div>

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

        {!error && cssMissing ? (
          <div className="absolute inset-x-3 top-3 z-1000 rounded-panel border border-warning bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
            {text.missingCss}
          </div>
        ) : null}
      </div>

      {legend && !error ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-4 py-2.5 text-[12px] text-text-secondary">
          {mode === "time" && zones
            ? zones.map((zone, index) => (
                <span key={zone.minutes} className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: RING_COLORS[index % RING_COLORS.length] }}
                  />
                  {zone.minutes} min
                </span>
              ))
            : rings.map((radius, index) => (
                <span key={radius} className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: RING_COLORS[index % RING_COLORS.length] }}
                  />
                  {formatKm(radius)}
                  <span className="tabular-nums opacity-70">· {counts[index] ?? 0}</span>
                </span>
              ))}

          {estimated ? (
            // Said in words, not only by the dashed stroke: a lobed shape looks
            // exactly like routed data.
            <span className="ml-auto inline-flex items-center gap-1.5 text-warning">
              <Icon name="triangle-alert" size={11} />
              {text.estimated}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
