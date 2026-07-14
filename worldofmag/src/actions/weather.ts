"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { chatComplete } from "@/lib/llm/chat";
import { parseJsonLoose } from "@/lib/llm/json";
import { fetchForecast, geocode, wmo, type Forecast, type HourPoint } from "@/lib/weather/openMeteo";
import { presetByKey, DAY_PARTS, type Horizon, type DayPart } from "@/lib/weather/presets";

export interface LocationDTO {
  id: string;
  label: string;
  lat: number;
  lon: number;
  isDefault: boolean;
}

export interface WatcherDTO {
  id: string;
  title: string;
  kind: "preset" | "custom";
  presetKey: string | null;
  query: string | null;
  horizon: Horizon;
  enabled: boolean;
}

export interface WatcherVerdict {
  id: string;
  title: string;
  status: "good" | "warn" | "bad" | "info";
  verdict: string;
  detail: string;
}

// ─── Locations ─────────────────────────────────────────────────────────────

export async function getLocations(): Promise<LocationDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.weatherLocation.findMany({
    where: { ownerId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return rows.map((l) => ({ id: l.id, label: l.label, lat: l.lat, lon: l.lon, isDefault: l.isDefault }));
}

export async function addLocationByName(name: string): Promise<LocationDTO> {
  const user = await requireAuth();
  const q = name.trim();
  if (!q) throw new Error("Podaj nazwę miejscowości");
  const geo = await geocode(q);
  if (!geo) throw new Error(`Nie znaleziono lokalizacji „${q}"`);
  const label = geo.admin1 ? `${geo.name}, ${geo.admin1}` : geo.name;
  return addLocation({ label, lat: geo.lat, lon: geo.lon });
}

export async function addLocation(data: {
  label: string;
  lat: number;
  lon: number;
  makeDefault?: boolean;
}): Promise<LocationDTO> {
  const user = await requireAuth();
  const existing = await prisma.weatherLocation.count({ where: { ownerId: user.id } });
  const isDefault = data.makeDefault || existing === 0;
  if (isDefault) {
    await prisma.weatherLocation.updateMany({
      where: { ownerId: user.id },
      data: { isDefault: false },
    });
  }
  const l = await prisma.weatherLocation.create({
    data: {
      ownerId: user.id,
      label: data.label.trim() || "Moja lokalizacja",
      lat: data.lat,
      lon: data.lon,
      isDefault,
    },
  });
  revalidatePath("/pogoda");
  return { id: l.id, label: l.label, lat: l.lat, lon: l.lon, isDefault: l.isDefault };
}

export async function setDefaultLocation(id: string): Promise<void> {
  const user = await requireAuth();
  const l = await prisma.weatherLocation.findUnique({ where: { id } });
  if (!l || l.ownerId !== user.id) throw new Error("Lokalizacja nie istnieje");
  await prisma.weatherLocation.updateMany({ where: { ownerId: user.id }, data: { isDefault: false } });
  await prisma.weatherLocation.update({ where: { id }, data: { isDefault: true } });
  revalidatePath("/pogoda");
}

export async function deleteLocation(id: string): Promise<void> {
  const user = await requireAuth();
  const l = await prisma.weatherLocation.findUnique({ where: { id } });
  if (!l || l.ownerId !== user.id) throw new Error("Lokalizacja nie istnieje");
  await prisma.weatherLocation.delete({ where: { id } });
  revalidatePath("/pogoda");
}

// ─── Forecast (live) ───────────────────────────────────────────────────────

export async function getWeather(lat: number, lon: number): Promise<Forecast> {
  await requireAuth();
  const f = await fetchForecast(lat, lon);
  if (!f) throw new Error("Nie udało się pobrać prognozy (Open-Meteo).");
  return f;
}

// ─── AI helpers ────────────────────────────────────────────────────────────

const PL_DAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

function weekday(dateIso: string): string {
  const d = new Date(dateIso + "T12:00:00");
  return PL_DAYS[d.getDay()];
}

function dailyDigest(f: Forecast): string {
  return f.daily
    .map((d) => {
      const w = wmo(d.code);
      return `${weekday(d.date)} ${d.date}: ${w.label}, ${Math.round(d.tMin)}–${Math.round(
        d.tMax
      )}°C, opady ${d.precipProbMax}% (${d.precipSum.toFixed(1)} mm), wiatr do ${Math.round(
        d.windMaxKph
      )} km/h, UV ${d.uvMax.toFixed(0)}`;
    })
    .join("\n");
}

function hourlyDigest(f: Forecast, hours: number): string {
  const now = Date.now();
  return f.hourly
    .filter((h) => new Date(h.time).getTime() >= now)
    .slice(0, hours)
    .map((h) => {
      const w = wmo(h.code);
      return `${h.time.slice(5, 16).replace("T", " ")}: ${Math.round(h.temp)}°C (odcz. ${Math.round(
        h.apparent
      )}°C), ${w.label}, opady ${h.precipProb}%, wiatr ${Math.round(h.windKph)} km/h`;
    })
    .join("\n");
}

function digestHours(hours: HourPoint[]): string {
  return hours
    .map((h) => {
      const w = wmo(h.code);
      return `${h.time.slice(11, 16)}: ${Math.round(h.temp)}°C (odcz. ${Math.round(
        h.apparent
      )}°C), ${w.label}, opady ${h.precipProb}%, wiatr ${Math.round(h.windKph)} km/h`;
    })
    .join("\n");
}

/**
 * Generuje poradę „co robić" dla wskazanego dnia i pory dnia (domyślnie: pierwszy
 * dzień prognozy + pora przekazana przez klienta). `variation` losuje inną odpowiedź.
 */
export async function describeDay(
  lat: number,
  lon: number,
  label: string,
  opts?: { date?: string; part?: DayPart; variation?: boolean }
): Promise<string> {
  await requireAuth();
  const f = await fetchForecast(lat, lon);
  if (!f) throw new Error("Brak danych pogodowych.");

  const date =
    opts?.date && f.daily.some((d) => d.date === opts.date)
      ? opts.date
      : f.daily[0]?.date ?? new Date().toISOString().slice(0, 10);
  const partKey: DayPart = opts?.part ?? "morning";
  const part = DAY_PARTS.find((p) => p.key === partKey) ?? DAY_PARTS[0];
  const variation = opts?.variation ?? false;

  // Godziny wskazanego dnia w zakresie wybranej pory; jeśli pora już minęła
  // (brak godzin), bierzemy wszystkie pozostałe godziny tego dnia.
  let hours = f.hourly.filter((h) => {
    if (!h.time.startsWith(date)) return false;
    const hour = Number(h.time.slice(11, 13));
    return hour >= part.from && hour < part.to;
  });
  if (hours.length === 0) hours = f.hourly.filter((h) => h.time.startsWith(date));

  const dayInfo = f.daily.find((d) => d.date === date);

  const system =
    "Jesteś asystentem pogodowym. Na podstawie prognozy godzinowej dla wskazanego dnia i pory dnia " +
    "oraz lokalizacji napisz krótką, konkretną poradę po polsku: co dobrze zrobić w tym czasie, jak " +
    "się ubrać, na co uważać. Bez lania wody, maks. 5 zdań, można 1–2 emoji." +
    (variation
      ? " Zaproponuj INNE, świeże, mniej oczywiste pomysły niż zwykle — bądź kreatywny."
      : "");
  const userPrompt =
    `Lokalizacja: ${label}\nDzień: ${weekday(date)} ${date}, pora dnia: ${part.label} (${part.from}:00–${part.to}:00)\n` +
    (dayInfo
      ? `Podsumowanie dnia: ${wmo(dayInfo.code).label}, ${Math.round(dayInfo.tMin)}–${Math.round(
          dayInfo.tMax
        )}°C, opady ${dayInfo.precipProbMax}%, wiatr do ${Math.round(dayInfo.windMaxKph)} km/h, UV ${dayInfo.uvMax.toFixed(
          0
        )}\n`
      : "") +
    `\nPROGNOZA GODZINOWA (${part.label}):\n${
      digestHours(hours) || "(brak danych godzinowych dla tej pory)"
    }` +
    (variation ? `\n\n[wariant ${Math.random().toString(36).slice(2, 8)}]` : "");

  const res = await chatComplete({
    op: "generation",
    temperature: variation ? 0.95 : 0.5,
    maxTokens: 350,
    // Z-330: porada deterministyczna per lokalizacja/dzień/pora/prognoza (prompt je
    // zawiera) — cache eliminuje powtórny koszt tokenów. Wariant ma być świeży → bez cache.
    cache: !variation,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  });
  if (!res.ok) throw new Error(res.message);
  return res.content.trim();
}

// ─── Watchers ──────────────────────────────────────────────────────────────

export async function getWatchers(): Promise<WatcherDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.weatherWatcher.findMany({
    where: { ownerId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((w) => ({
    id: w.id,
    title: w.title,
    kind: w.kind as "preset" | "custom",
    presetKey: w.presetKey,
    query: w.query,
    horizon: w.horizon as Horizon,
    enabled: w.enabled,
  }));
}

export async function addPresetWatcher(presetKey: string): Promise<void> {
  const user = await requireAuth();
  const preset = presetByKey(presetKey);
  if (!preset) throw new Error("Nieznany preset");
  const exists = await prisma.weatherWatcher.findFirst({
    where: { ownerId: user.id, presetKey, kind: "preset" },
  });
  if (exists) return;
  const max = await prisma.weatherWatcher.aggregate({
    where: { ownerId: user.id },
    _max: { sortOrder: true },
  });
  await prisma.weatherWatcher.create({
    data: {
      ownerId: user.id,
      title: preset.title,
      kind: "preset",
      presetKey,
      query: preset.query,
      horizon: preset.horizon,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/pogoda");
}

export async function addCustomWatcher(data: {
  title: string;
  query: string;
  horizon: Horizon;
}): Promise<void> {
  const user = await requireAuth();
  const title = data.title.trim();
  const query = data.query.trim();
  if (!title) throw new Error("Podaj nazwę obserwatora");
  if (!query) throw new Error("Opisz, co chcesz obserwować");
  const max = await prisma.weatherWatcher.aggregate({
    where: { ownerId: user.id },
    _max: { sortOrder: true },
  });
  await prisma.weatherWatcher.create({
    data: {
      ownerId: user.id,
      title,
      kind: "custom",
      query,
      horizon: data.horizon,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/pogoda");
}

export async function updateWatcher(
  id: string,
  patch: { title?: string; query?: string; horizon?: Horizon; enabled?: boolean }
): Promise<void> {
  const user = await requireAuth();
  const w = await prisma.weatherWatcher.findUnique({ where: { id } });
  if (!w || w.ownerId !== user.id) throw new Error("Obserwator nie istnieje");
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.query !== undefined) data.query = patch.query.trim();
  if (patch.horizon !== undefined) data.horizon = patch.horizon;
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  await prisma.weatherWatcher.update({ where: { id }, data });
  revalidatePath("/pogoda");
}

export async function deleteWatcher(id: string): Promise<void> {
  const user = await requireAuth();
  const w = await prisma.weatherWatcher.findUnique({ where: { id } });
  if (!w || w.ownerId !== user.id) throw new Error("Obserwator nie istnieje");
  await prisma.weatherWatcher.delete({ where: { id } });
  revalidatePath("/pogoda");
}

/** Ocenia włączone obserwatory względem aktualnej prognozy (LLM). */
export async function evaluateWatchers(
  lat: number,
  lon: number,
  label: string
): Promise<WatcherVerdict[]> {
  const user = await requireAuth();
  const watchers = await prisma.weatherWatcher.findMany({
    where: { ownerId: user.id, enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  if (watchers.length === 0) return [];

  const f = await fetchForecast(lat, lon);
  if (!f) throw new Error("Brak danych pogodowych.");

  const system =
    "Oceniasz prognozę pogody pod kątem konkretnych obserwatorów (alertów) zdefiniowanych przez " +
    "użytkownika. Dla każdego zdecyduj status: good (warunki sprzyjające), warn (uwaga/ryzyko), " +
    "bad (zła wiadomość / odradzane), info (neutralna informacja). verdict = krótkie hasło, " +
    "detail = 1–2 zdania z konkretami (dni, godziny, wartości). Pisz po polsku. Zwróć WYŁĄCZNIE JSON.";
  const watcherList = watchers
    .map((w, i) => `${i}. [${w.horizon}] ${w.title}: ${w.query ?? w.title}`)
    .join("\n");
  const userPrompt =
    `Lokalizacja: ${label}\n\nPROGNOZA 7-DNIOWA:\n${dailyDigest(f)}\n\n` +
    `NAJBLIŻSZE GODZINY:\n${hourlyDigest(f, 24)}\n\n` +
    `OBSERWATORZY (z horyzontem czasowym):\n${watcherList}\n\n` +
    `Zwróć JSON: {"verdicts":[{"index":0,"status":"good","verdict":"...","detail":"..."}]}`;

  const res = await chatComplete({
    op: "reasoning",
    json: true,
    temperature: 0.3,
    maxTokens: 1500,
    // Z-330: ocena watcherów deterministyczna per lokalizacja/prognoza/lista watcherów
    // (prompt je zawiera) — cache eliminuje powtórny koszt przy ponownych wejściach.
    cache: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  });
  if (!res.ok) throw new Error(res.message);
  const parsed = parseJsonLoose<{
    verdicts: Array<{ index: number; status: string; verdict: string; detail: string }>;
  }>(res.content);
  const verdicts = parsed?.verdicts ?? [];

  return verdicts
    .filter((v) => watchers[v.index])
    .map((v) => {
      const w = watchers[v.index];
      const status = ["good", "warn", "bad", "info"].includes(v.status)
        ? (v.status as WatcherVerdict["status"])
        : "info";
      return { id: w.id, title: w.title, status, verdict: v.verdict ?? "", detail: v.detail ?? "" };
    });
}
