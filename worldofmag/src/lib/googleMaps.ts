// Helpers for the Trasy TIR module: turning an ORS route geometry into a
// Google Maps directions hand-off, plus small geo utilities shared with the
// Overpass + ORS clients.
//
// Coordinate convention in this file: route geometry comes from ORS as
// [lng, lat] pairs (GeoJSON order). UI / Google Maps use "lat,lng" strings.

export type LngLat = [number, number]; // [lng, lat]
/** GeoJSON Polygon coordinates: array of linear rings, each a list of [lng,lat]. */
export type PolygonCoords = number[][][];

const EARTH_M_PER_DEG_LAT = 111_320;

/** Bounding box around a polyline, padded by `padDeg`. Returns Overpass order: [south, west, north, east]. */
export function bufferBboxAroundLine(
  line: LngLat[],
  padDeg = 0.02,
): [number, number, number, number] {
  let minLat = Infinity,
    minLng = Infinity,
    maxLat = -Infinity,
    maxLng = -Infinity;
  for (const [lng, lat] of line) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [minLat - padDeg, minLng - padDeg, maxLat + padDeg, maxLng + padDeg];
}

/** A small square avoid-polygon (GeoJSON Polygon coords) centred on a point. */
export function pointToAvoidPolygon(lat: number, lng: number, halfSizeM = 40): PolygonCoords {
  const dLat = halfSizeM / EARTH_M_PER_DEG_LAT;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = halfSizeM / (EARTH_M_PER_DEG_LAT * (cos || 1e-6));
  const s = lat - dLat,
    n = lat + dLat,
    w = lng - dLng,
    e = lng + dLng;
  // ring must be closed (first === last), order [lng, lat]
  return [
    [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s],
    ],
  ];
}

/** Pick up to `max` evenly spaced interior waypoints (excludes start/end). */
export function sampleWaypoints(line: LngLat[], max = 8): { lat: number; lng: number }[] {
  if (line.length <= 2) return [];
  const interior = line.slice(1, -1);
  if (interior.length <= max) {
    return interior.map(([lng, lat]) => ({ lat, lng }));
  }
  const step = (interior.length - 1) / (max - 1);
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i < max; i++) {
    const [lng, lat] = interior[Math.round(i * step)];
    out.push({ lat, lng });
  }
  return out;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Google Maps directions URL (universal `api=1` form) with driving waypoints. */
export function buildGoogleMapsDirUrl(
  origin: string,
  destination: string,
  waypoints: { lat: number; lng: number }[],
): string {
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map((w) => `${round6(w.lat)},${round6(w.lng)}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Google Maps pin (search) URL for a single coordinate. */
export function buildMapsPin(lat: number, lng: number): string {
  const params = new URLSearchParams({ api: "1", query: `${round6(lat)},${round6(lng)}` });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
