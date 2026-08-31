/**
 * Map geometry: distance on the sphere, catchment rings, and choropleth
 * classification.
 *
 * Kept out of the components because it is arithmetic, and arithmetic on a map
 * fails silently — a distance that is 40% wrong still draws a plausible circle,
 * and a break sequence with duplicates still paints every zone some colour.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Mean Earth radius, km. */
const EARTH_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in km.
 *
 * Haversine rather than the equirectangular approximation: over a city the two
 * agree, but the cheap version drifts badly at high latitude and across the
 * antimeridian, and a catchment map is exactly where somebody eventually plots
 * a customer in Reykjavík.
 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Km per degree of latitude. Constant everywhere. */
const KM_PER_LAT = 111.32;

/**
 * Km per degree of longitude at a latitude.
 *
 * Meridians converge towards the poles, so a degree of longitude is 111km at
 * the equator and nothing at all at the pole. Treating it as constant — which
 * is the usual shortcut — makes every ring an ellipse that is too wide, by 25%
 * in Paris and 45% in Reykjavík.
 */
export const kmPerLng = (lat: number) => KM_PER_LAT * Math.cos(toRadians(lat));

/** Moves a point by a distance and a bearing, in km and radians. */
export function offsetKm(origin: LatLng, km: number, bearing: number): LatLng {
  const scale = kmPerLng(origin.lat);
  return {
    lat: origin.lat + (km / KM_PER_LAT) * Math.sin(bearing),
    // Guard the pole: cos(lat) reaches zero and the longitude offset diverges.
    lng: origin.lng + (scale < 0.001 ? 0 : (km / scale) * Math.cos(bearing)),
  };
}

export interface Isochrone {
  minutes: number;
  /** Closed ring as [lng, lat] pairs, GeoJSON order. */
  ring: [number, number][];
  /** True when this is a modelled estimate rather than routed data. */
  estimated: boolean;
}

/** Points around the ring. 72 is one every five degrees. */
const RING_POINTS = 72;

/**
 * A deterministic pseudo-random sequence.
 *
 * Deterministic on purpose: an estimated catchment that reshuffles on every
 * render reads as live data being refreshed, which is the opposite of what it
 * is. The same centre must always produce the same silhouette.
 */
function seeded(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

/**
 * Modelled reach areas, for when no routing service is available.
 *
 * THE SHAPE IS A LIE, AND IT SAYS SO. Real isochrones are lobed because road
 * networks are; a circle would claim a precision nobody has. These are lobed
 * too, from one shared radial profile so the zones nest instead of crossing —
 * but every one is flagged `estimated`, and the caller is expected to say so
 * on screen.
 */
export function estimateIsochrones(
  center: LatLng,
  minutes: number[],
  options: { speedKmh?: number; seed?: number } = {},
): Isochrone[] {
  const { speedKmh = 22, seed = 7919 } = options;
  const random = seeded(seed);

  // One profile shared by every ring: independent profiles would let a
  // 10-minute zone poke outside the 20-minute one, which is nonsense.
  const profile = Array.from({ length: RING_POINTS }, (_, i) => {
    const angle = (i / RING_POINTS) * Math.PI * 2;
    return (
      0.62 +
      0.38 * Math.abs(Math.cos(angle * 1.5 + 0.4)) +
      0.22 * Math.abs(Math.sin(angle * 3 + 1.1)) +
      random() * 0.12
    );
  });

  return [...minutes]
    .sort((a, b) => a - b)
    .map((entry) => {
      const base = (entry / 60) * speedKmh;

      const ring: [number, number][] = profile.map((factor, i) => {
        const angle = (i / RING_POINTS) * Math.PI * 2;
        const point = offsetKm(center, base * factor, angle);
        return [point.lng, point.lat];
      });

      // GeoJSON requires the ring to close.
      ring.push(ring[0]!);

      return { minutes: entry, ring, estimated: true };
    });
}

/** A polygon ring as a GeoJSON Feature. */
export const ringToFeature = (isochrone: Isochrone) => ({
  type: "Feature" as const,
  properties: { minutes: isochrone.minutes, estimated: isochrone.estimated },
  geometry: { type: "Polygon" as const, coordinates: [isochrone.ring] },
});

/** Points that fall inside a radius of the centre, with their distance. */
export function pointsWithin<T extends LatLng>(
  center: LatLng,
  points: T[],
  radiusKm: number,
): (T & { km: number })[] {
  return points
    .map((point) => ({ ...point, km: distanceKm(center, point) }))
    .filter((point) => point.km <= radiusKm);
}

/** How many points fall in each ring, as bands rather than cumulative totals. */
export function ringCounts(center: LatLng, points: LatLng[], rings: number[]): number[] {
  const sorted = [...rings].sort((a, b) => a - b);
  const distances = points.map((point) => distanceKm(center, point));

  return sorted.map((radius, index) => {
    const inner = index === 0 ? 0 : sorted[index - 1]!;
    return distances.filter((km) => km > inner && km <= radius).length;
  });
}

export type ScaleKind = "quantile" | "linear";

/**
 * Class breaks for a choropleth.
 *
 * BREAKS MUST BE STRICTLY INCREASING. The obvious quantile implementation —
 * index into the sorted values at each fraction — produces duplicates whenever
 * the data is skewed, which is most real data: if 60% of zones hold the same
 * value, several breaks land on it. Bucket indices then jump, so some colours
 * in the ramp never appear while others swallow half the map, and the legend
 * shows a range that matches nothing on screen. Duplicates are collapsed here,
 * and the caller gets fewer classes rather than wrong ones.
 */
export function classBreaks(
  values: number[],
  steps: number,
  kind: ScaleKind = "quantile",
): number[] {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length || steps < 2) return [];

  const low = sorted[0]!;
  const high = sorted[sorted.length - 1]!;

  // Every value identical: no break can separate anything.
  if (low === high) return [];

  const raw =
    kind === "linear"
      ? Array.from({ length: steps - 1 }, (_, i) => low + ((high - low) * (i + 1)) / steps)
      : Array.from({ length: steps - 1 }, (_, i) => {
          const at = Math.floor((sorted.length * (i + 1)) / steps);
          return sorted[Math.min(at, sorted.length - 1)]!;
        });

  return [...new Set(raw)].filter((value) => value > low && value <= high).sort((a, b) => a - b);
}

/**
 * The class a value falls into, 0-based.
 *
 * Half-open upwards — `value > break` — so the maximum lands in the last class
 * rather than one past the end of the ramp.
 */
export function classOf(value: number | null | undefined, breaks: number[]): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return breaks.filter((entry) => value > entry).length;
}

/**
 * A colour ramp sampled to exactly `count` stops.
 *
 * Sampled rather than sliced: slicing the first N of a ramp designed with a
 * light and a dark end throws away the dark end, and a five-class map drawn in
 * the ramp's lightest five colours has no contrast at all.
 */
export function sampleRamp(ramp: string[], count: number): string[] {
  if (count <= 1) return [ramp[ramp.length - 1] ?? ramp[0]!];
  if (!ramp.length) return [];

  return Array.from({ length: count }, (_, i) =>
    ramp[Math.round((i / (count - 1)) * (ramp.length - 1))]!,
  );
}

/** Formats a distance the way a person would say it. */
export function formatKm(km: number, locale = "en"): string {
  if (km < 1) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(km * 1000)} m`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}

/** A bounding box that holds every point, padded by a fraction of its span. */
export function boundsOf(
  points: LatLng[],
  pad = 0.1,
): { south: number; west: number; north: number; east: number } | null {
  if (!points.length) return null;

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);

  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);

  // A single point has no span, so pad by a fixed amount instead of by zero —
  // otherwise the map fits to nothing and zooms to maximum.
  const latPad = (north - south || 0.01) * pad;
  const lngPad = (east - west || 0.01) * pad;

  return {
    south: south - latPad,
    west: west - lngPad,
    north: north + latPad,
    east: east + lngPad,
  };
}
