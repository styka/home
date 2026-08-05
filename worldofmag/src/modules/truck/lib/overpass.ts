// Fetches current roadworks (OSM `construction`) within a bounding box via the
// public Overpass API. No API key required. Failures degrade gracefully to an
// empty list so a routing plan never fails just because Overpass is down.

export interface Roadwork {
  lat: number;
  lng: number;
  label: string;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

interface OverpassElement {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function labelFor(tags: Record<string, string> = {}): string {
  return (
    tags.name ||
    tags.construction ||
    tags["construction:highway"] ||
    tags.highway ||
    "Roboty drogowe"
  );
}

/**
 * @param bbox Overpass order: [south, west, north, east]
 * @param limit max features to return (also caps the Overpass `out`)
 */
export async function fetchRoadworks(
  bbox: [number, number, number, number],
  limit = 200,
): Promise<Roadwork[]> {
  const [s, w, n, e] = bbox;
  const b = `${s},${w},${n},${e}`;
  const query = `[out:json][timeout:25];
(
  way["highway"="construction"](${b});
  node["highway"="construction"](${b});
  way["construction"](${b});
  node["construction"](${b});
);
out center ${limit};`;

  let res: Response;
  try {
    res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "WorldOfMag/1.0 (truck routing)",
      },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return []; // timeout / network — treat as "no roadworks data"
  }
  if (!res.ok) return [];

  let data: { elements?: OverpassElement[] };
  try {
    data = await res.json();
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: Roadwork[] = [];
  for (const el of data.elements ?? []) {
    const lat = el.center?.lat ?? el.lat;
    const lng = el.center?.lon ?? el.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ lat, lng, label: labelFor(el.tags) });
  }
  return out;
}
