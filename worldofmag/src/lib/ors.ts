// OpenRouteService client for the Trasy TIR module.
// - geocoding via Pelias (/geocode/search), biased to Poland
// - HGV routing via /v2/directions/driving-hgv/geojson (returns a decoded
//   LineString, so no polyline decoding is needed)
//
// Free-tier limits (personal use is well within these): directions ~40 req/min
// and ~2000/day; geocoding ~1000/day. planTruckRoute makes at most 2 geocode +
// 2 directions calls per plan — do not loop these.

import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { PolygonCoords } from "@/lib/googleMaps";

const ORS_BASE = "https://api.openrouteservice.org";

export interface OrsRestrictions {
  weight: number;
  height: number;
  length: number;
  width: number;
  axleload: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface RouteResult {
  geometry: [number, number][]; // [lng, lat] pairs
  distanceKm: number;
  durationMin: number;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export class OrsError extends Error {
  code: "NO_KEY" | "NO_ROUTE" | "GEOCODE" | "HTTP";
  constructor(code: OrsError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "OrsError";
  }
}

async function getOrsKey(): Promise<string> {
  const env = process.env.ORS_API_KEY?.trim();
  if (env) return env;
  const row = await prisma.config.findUnique({ where: { key: "ors_api_key" } });
  const dec = decryptSecret(row?.value).trim();
  if (dec) return dec;
  throw new OrsError("NO_KEY", "OpenRouteService nie jest skonfigurowany (ustaw ORS_API_KEY).");
}

/** Geocode a free-text address (biased to Poland). Returns null if no match. */
export async function geocode(text: string): Promise<GeoPoint | null> {
  const key = await getOrsKey();
  const params = new URLSearchParams({
    api_key: key,
    text,
    "boundary.country": "PL",
    size: "1",
  });
  let res: Response;
  try {
    res = await fetch(`${ORS_BASE}/geocode/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new OrsError("GEOCODE", "Geokodowanie nie powiodło się (przekroczono czas).");
  }
  if (!res.ok) throw new OrsError("HTTP", `Błąd geokodowania ORS (HTTP ${res.status}).`);
  const data = (await res.json()) as {
    features?: { geometry: { coordinates: [number, number] }; properties?: { label?: string } }[];
  };
  const f = data.features?.[0];
  if (!f) return null;
  const [lng, lat] = f.geometry.coordinates;
  return { lat, lng, label: f.properties?.label ?? text };
}

/**
 * Route an HGV honouring vehicle restrictions and optional avoid polygons.
 * @param coords ordered [lng, lat] pairs (origin, …, destination)
 * @param avoidPolygons array of GeoJSON Polygon coordinate sets (small squares)
 */
export async function routeHgv(
  coords: [number, number][],
  r: OrsRestrictions,
  avoidPolygons: PolygonCoords[] = [],
): Promise<RouteResult> {
  const key = await getOrsKey();
  const options: Record<string, unknown> = {
    vehicle_type: "hgv",
    profile_params: {
      restrictions: {
        weight: r.weight,
        height: r.height,
        length: r.length,
        width: r.width,
        axleload: r.axleload,
      },
    },
  };
  if (avoidPolygons.length > 0) {
    options.avoid_polygons = { type: "MultiPolygon", coordinates: avoidPolygons };
  }

  let res: Response;
  try {
    res = await fetch(`${ORS_BASE}/v2/directions/driving-hgv/geojson`, {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        Accept: "application/geo+json",
      },
      body: JSON.stringify({ coordinates: coords, options }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new OrsError("HTTP", "Routing nie powiódł się (przekroczono czas).");
  }

  if (!res.ok) {
    let code: number | undefined;
    let msg = "";
    try {
      const body = (await res.json()) as { error?: { code?: number; message?: string } };
      code = body.error?.code;
      msg = body.error?.message ?? "";
    } catch {
      /* ignore parse error */
    }
    // 2009 = route too long, 2010 = point not found, 2099 = no route found
    if (code === 2010 || code === 2099 || code === 2009) {
      throw new OrsError(
        "NO_ROUTE",
        "Nie znaleziono trasy spełniającej ograniczenia — sprawdź wymiary pojazdu lub adresy.",
      );
    }
    throw new OrsError("HTTP", `Błąd routingu ORS (HTTP ${res.status}). ${msg}`.trim());
  }

  const data = (await res.json()) as {
    features?: {
      geometry: { coordinates: [number, number][] };
      properties: { summary?: { distance?: number; duration?: number } };
    }[];
    bbox?: [number, number, number, number];
  };
  const feat = data.features?.[0];
  if (!feat) throw new OrsError("NO_ROUTE", "ORS nie zwrócił trasy.");

  const distM = feat.properties.summary?.distance ?? 0;
  const durS = feat.properties.summary?.duration ?? 0;
  const geometry = feat.geometry.coordinates;
  const bbox =
    data.bbox ??
    (() => {
      let minLng = Infinity,
        minLat = Infinity,
        maxLng = -Infinity,
        maxLat = -Infinity;
      for (const [lng, lat] of geometry) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      return [minLng, minLat, maxLng, maxLat] as [number, number, number, number];
    })();

  return {
    geometry,
    distanceKm: Math.round((distM / 1000) * 10) / 10,
    durationMin: Math.round(durS / 60),
    bbox,
  };
}
