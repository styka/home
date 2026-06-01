// Klient Open-Meteo (darmowy, bez klucza API). Pobiera prognozę godzinową i dzienną
// oraz geokoduje nazwy miejscowości. Mapowanie kodów pogody WMO → polski opis + emoji.

export interface HourPoint {
  time: string; // ISO local
  temp: number;
  apparent: number;
  precipProb: number; // %
  precip: number; // mm
  windKph: number;
  code: number;
}

export interface DayPoint {
  date: string; // YYYY-MM-DD
  code: number;
  tMax: number;
  tMin: number;
  precipSum: number; // mm
  precipProbMax: number; // %
  windMaxKph: number;
  sunrise: string;
  sunset: string;
  uvMax: number;
}

export interface Forecast {
  latitude: number;
  longitude: number;
  timezone: string;
  current: { temp: number; apparent: number; code: number; windKph: number; isDay: boolean } | null;
  hourly: HourPoint[];
  daily: DayPoint[];
}

export interface GeoResult {
  name: string;
  lat: number;
  lon: number;
  country: string | null;
  admin1: string | null;
}

// Kody pogody WMO → opis (PL) + emoji + token koloru akcentu.
export interface WmoMeta {
  label: string;
  emoji: string;
  color: string;
}

export function wmo(code: number): WmoMeta {
  const c = code;
  if (c === 0) return { label: "Bezchmurnie", emoji: "☀️", color: "var(--accent-amber)" };
  if (c === 1) return { label: "Przeważnie słonecznie", emoji: "🌤️", color: "var(--accent-amber)" };
  if (c === 2) return { label: "Częściowe zachmurzenie", emoji: "⛅", color: "var(--accent-amber)" };
  if (c === 3) return { label: "Pochmurno", emoji: "☁️", color: "var(--text-secondary)" };
  if (c === 45 || c === 48) return { label: "Mgła", emoji: "🌫️", color: "var(--text-muted)" };
  if (c >= 51 && c <= 55) return { label: "Mżawka", emoji: "🌦️", color: "var(--accent-blue)" };
  if (c >= 56 && c <= 57) return { label: "Marznąca mżawka", emoji: "🌧️", color: "var(--accent-blue)" };
  if (c >= 61 && c <= 65) return { label: "Deszcz", emoji: "🌧️", color: "var(--accent-blue)" };
  if (c >= 66 && c <= 67) return { label: "Marznący deszcz", emoji: "🌧️", color: "var(--accent-blue)" };
  if (c >= 71 && c <= 75) return { label: "Śnieg", emoji: "🌨️", color: "var(--accent-blue)" };
  if (c === 77) return { label: "Krupa śnieżna", emoji: "🌨️", color: "var(--accent-blue)" };
  if (c >= 80 && c <= 82) return { label: "Przelotny deszcz", emoji: "🌦️", color: "var(--accent-blue)" };
  if (c >= 85 && c <= 86) return { label: "Przelotny śnieg", emoji: "🌨️", color: "var(--accent-blue)" };
  if (c === 95) return { label: "Burza", emoji: "⛈️", color: "var(--accent-purple)" };
  if (c >= 96 && c <= 99) return { label: "Burza z gradem", emoji: "⛈️", color: "var(--accent-purple)" };
  return { label: "Pogoda zmienna", emoji: "🌡️", color: "var(--text-secondary)" };
}

export async function geocode(name: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=1&language=pl&format=json`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{
        name: string;
        latitude: number;
        longitude: number;
        country?: string;
        admin1?: string;
      }>;
    };
    const r = data.results?.[0];
    if (!r) return null;
    return {
      name: r.name,
      lat: r.latitude,
      lon: r.longitude,
      country: r.country ?? null,
      admin1: r.admin1 ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchForecast(lat: number, lon: number): Promise<Forecast | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
      hourly:
        "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max",
      timezone: "auto",
      forecast_days: "7",
      wind_speed_unit: "kmh",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as any;

    const hourly: HourPoint[] = (d.hourly?.time ?? []).map((t: string, i: number) => ({
      time: t,
      temp: d.hourly.temperature_2m[i],
      apparent: d.hourly.apparent_temperature[i],
      precipProb: d.hourly.precipitation_probability?.[i] ?? 0,
      precip: d.hourly.precipitation?.[i] ?? 0,
      windKph: d.hourly.wind_speed_10m?.[i] ?? 0,
      code: d.hourly.weather_code?.[i] ?? 0,
    }));

    const daily: DayPoint[] = (d.daily?.time ?? []).map((t: string, i: number) => ({
      date: t,
      code: d.daily.weather_code[i],
      tMax: d.daily.temperature_2m_max[i],
      tMin: d.daily.temperature_2m_min[i],
      precipSum: d.daily.precipitation_sum?.[i] ?? 0,
      precipProbMax: d.daily.precipitation_probability_max?.[i] ?? 0,
      windMaxKph: d.daily.wind_speed_10m_max?.[i] ?? 0,
      sunrise: d.daily.sunrise?.[i] ?? "",
      sunset: d.daily.sunset?.[i] ?? "",
      uvMax: d.daily.uv_index_max?.[i] ?? 0,
    }));

    return {
      latitude: d.latitude,
      longitude: d.longitude,
      timezone: d.timezone ?? "auto",
      current: d.current
        ? {
            temp: d.current.temperature_2m,
            apparent: d.current.apparent_temperature,
            code: d.current.weather_code,
            windKph: d.current.wind_speed_10m,
            isDay: d.current.is_day === 1,
          }
        : null,
      hourly,
      daily,
    };
  } catch {
    return null;
  }
}
