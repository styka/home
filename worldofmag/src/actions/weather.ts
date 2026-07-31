"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { chatComplete } from "@/lib/llm/chat";
import { parseJsonLoose } from "@/lib/llm/json";
import {
  fetchForecast,
  geocode,
  reverseGeocode,
  wmo,
  type Forecast,
  type HourPoint,
} from "@/lib/weather/openMeteo";
import { presetByKey, DAY_PARTS, type Horizon, type DayPart } from "@/lib/weather/presets";
import {
  fingerprintOf,
  parseIdeaCategory,
  parseIdeaState,
  type IdeaDTO,
  type IdeaState,
} from "@/lib/weather/ideas";
import { usageFromChat, parseStoredUsage, type AiUsageInfo } from "@/lib/ai/usage";
import { visibleUsage } from "@/lib/ai/costVisibility";
import { rememberedContent, hashInputs } from "@/lib/ai/contentMemory";
import { recordTrash } from "@/lib/trash";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createTask } from "@/actions/tasks";

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

/**
 * 037: status obserwatora mówi, CZY JEGO WARUNEK ZACHODZI — nie czy pogoda jest ładna.
 *
 * Poprzednia skala (`good`/`warn`/`bad`/`info`, w UI „Sprzyja/Uwaga/Odradzane/Info") kazała modelowi
 * ocenić urodę pogody. Dla obserwatora opisującego zjawisko NEGATYWNE („Bardzo mokry weekend",
 * presety „Przymrozki", „Burze", „Upały") sucha, słoneczna prognoza jest oczywiście „dobra" — więc
 * model poprawnie odpowiadał `good`, a użytkownik czytał „Sprzyja: weekend suchy" na obserwatorze
 * mokrego weekendu. To nie była halucynacja, tylko źle postawione pytanie.
 */
export type WatcherStatus = "met" | "partial" | "unmet" | "unknown";

export interface WatcherVerdict {
  id: string;
  title: string;
  status: WatcherStatus;
  verdict: string;
  detail: string;
}

const WATCHER_STATUSES: WatcherStatus[] = ["met", "partial", "unmet", "unknown"];

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

/**
 * 037: zapis lokalizacji wskazanej PALCEM NA MAPIE.
 *
 * Powód istnienia: wyszukiwarka nazw nie zna części małych miejscowości, a geolokalizacja urządzenia
 * bywa niedostępna albo odmówiona. Punkt na mapie omija oba ograniczenia — nazwa jest wtedy wygodą,
 * nie warunkiem, więc jej brak degraduje do współrzędnych zamiast blokować zapis.
 */
export async function addLocationByPoint(lat: number, lon: number): Promise<LocationDTO> {
  await requireAuth();
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Nieprawidłowe współrzędne");
  if (lat < -90 || lat > 90) throw new Error("Szerokość geograficzna poza zakresem");
  if (lon < -180 || lon > 180) throw new Error("Długość geograficzna poza zakresem");
  const name = await reverseGeocode(lat, lon);
  const label = name ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  return addLocation({ label, lat, lon });
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

// 037: `describeDay` (jeden wygenerowany akapit porady) został usunięty — zastąpiła go lista
// propozycji `getIdeas` niżej w tym pliku. Trzymanie obu wariantów oznaczałoby dwa prompty na tę
// samą potrzebę i dwa razy większy koszt sekcji „Co robić?".

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

export interface WatchersResult {
  verdicts: WatcherVerdict[];
  usage?: AiUsageInfo;
}

/** Ocenia włączone obserwatory względem aktualnej prognozy (LLM). */
export async function evaluateWatchers(
  lat: number,
  lon: number,
  label: string
): Promise<WatchersResult> {
  const user = await requireAuth();
  const watchers = await prisma.weatherWatcher.findMany({
    where: { ownerId: user.id, enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  if (watchers.length === 0) return { verdicts: [] };

  const f = await fetchForecast(lat, lon);
  if (!f) throw new Error("Brak danych pogodowych.");

  const system =
    "Sprawdzasz prognozę pogody pod kątem obserwatorów (warunków) zdefiniowanych przez użytkownika.\n" +
    "NIE oceniasz, czy pogoda jest ładna, dobra ani przyjemna. Oceniasz WYŁĄCZNIE jedno: czy warunek " +
    "opisany przez obserwatora ZACHODZI w jego horyzoncie czasowym.\n" +
    "Status:\n" +
    "- met = warunek zachodzi (to, o co pyta obserwator, faktycznie się dzieje),\n" +
    "- partial = zachodzi częściowo albo niepewnie (np. tylko jeden z dwóch dni, niska szansa),\n" +
    "- unmet = nie zachodzi,\n" +
    "- unknown = prognoza nie daje podstaw do rozstrzygnięcia.\n" +
    "Przykład: obserwator „Bardzo mokry weekend” przy suchej prognozie ma status unmet — mimo że " +
    "sucha pogoda jest przyjemna. Obserwator „Burze” przy nadchodzącej burzy ma status met — mimo " +
    "że to zła wiadomość.\n" +
    "verdict = krótkie hasło nawiązujące do TREŚCI obserwatora, detail = 1–2 zdania z konkretami " +
    "(dni, godziny, wartości). Pisz po polsku. Zwróć WYŁĄCZNIE JSON.";
  const watcherList = watchers
    .map((w, i) => `${i}. [${w.horizon}] ${w.title}: ${w.query ?? w.title}`)
    .join("\n");
  const userPrompt =
    `Lokalizacja: ${label}\n\nPROGNOZA 7-DNIOWA:\n${dailyDigest(f)}\n\n` +
    `NAJBLIŻSZE GODZINY:\n${hourlyDigest(f, 24)}\n\n` +
    `OBSERWATORZY (z horyzontem czasowym):\n${watcherList}\n\n` +
    `Zwróć JSON: {"verdicts":[{"index":0,"status":"met|partial|unmet|unknown","verdict":"...","detail":"..."}]}`;

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

  const mapped = verdicts
    .filter((v) => watchers[v.index])
    .map((v) => {
      const w = watchers[v.index];
      // Nieznana wartość degraduje do „brak danych", a nie do udawania rozstrzygnięcia.
      const status = WATCHER_STATUSES.includes(v.status as WatcherStatus)
        ? (v.status as WatcherStatus)
        : "unknown";
      return { id: w.id, title: w.title, status, verdict: v.verdict ?? "", detail: v.detail ?? "" };
    });

  return {
    verdicts: mapped,
    usage: await visibleUsage(usageFromChat([{ res, label: "obserwatory", op: "reasoning" }])),
  };
}

// ─── 037: propozycje „Co robić?" ────────────────────────────────────────────
//
// Sekcja „Co robić?" dawała jeden ogólny akapit. Teraz daje LISTĘ nazwanych propozycji, z których
// każdą można rozwinąć w szczegółowy plan, zapisać na później albo zablokować na zawsze.
//
// Świadoma decyzja: sama wygenerowana lista NIE trafia do bazy. Prompt jest deterministyczny per
// lokalizacja/dzień/pora/prognoza, więc pamięć podręczna w `chatComplete` (`cache: true`) sprawia,
// że ponowne wejście na /pogoda tego samego dnia nic nie kosztuje. W bazie lądują wyłącznie
// propozycje, z którymi użytkownik COŚ ZROBIŁ — to one mają go przeżyć.

export interface IdeasResult {
  ideas: IdeaDTO[];
  usage?: AiUsageInfo;
  /** 038: kiedy lista powstała — UI mówi wprost, że treść pochodzi z pamięci. */
  generatedAt: string;
  /** Prognoza lub listy pomysłów zmieniły się od czasu wygenerowania. Sygnał, nie polecenie. */
  stale: boolean;
  fromMemory: boolean;
}

/** Surowa propozycja prosto od modelu — to JĄ zapamiętujemy, bez stanu użytkownika. */
interface RawIdea {
  title: string;
  summary?: string;
  category?: string;
  nearby?: boolean;
}

export interface IdeaDetailResult {
  /** Id wiersza w bazie — klient potrzebuje go do zapisu/„dodaj do zadań" bez dodatkowej rundy. */
  id: string;
  fingerprint: string;
  title: string;
  detail: string | null;
  detailRuns: number;
  detailAt: string | null;
  usage?: AiUsageInfo;
}

/** Kontekst pogodowy propozycji — potrzebny i do listy, i do szczegółów. */
export interface IdeaContext {
  lat: number;
  lon: number;
  label: string;
  date?: string;
  part?: DayPart;
}

/** Wspólne rozstrzygnięcie „który dzień i która pora" dla listy propozycji i ich szczegółów. */
function resolveWhen(f: Forecast, opts?: { date?: string; part?: DayPart }) {
  const date =
    opts?.date && f.daily.some((d) => d.date === opts.date)
      ? opts.date
      : f.daily[0]?.date ?? new Date().toISOString().slice(0, 10);
  const partKey: DayPart = opts?.part ?? "morning";
  const part = DAY_PARTS.find((p) => p.key === partKey) ?? DAY_PARTS[0];
  let hours = f.hourly.filter((h) => {
    if (!h.time.startsWith(date)) return false;
    const hour = Number(h.time.slice(11, 13));
    return hour >= part.from && hour < part.to;
  });
  if (hours.length === 0) hours = f.hourly.filter((h) => h.time.startsWith(date));
  const day = f.daily.find((d) => d.date === date);
  return { date, part, hours, day };
}

/**
 * 038: ZAOKRĄGLONY skrót pogody — wyłącznie do liczenia odcisku warunków, nigdy do promptu.
 *
 * Odcisk liczony z surowych wartości zmieniałby się przy każdej korekcie o jedną dziesiątą stopnia
 * i unieważniał zapamiętaną treść bez powodu — czyli niweczył oszczędność, dla której ta pamięć
 * powstała. Temperatura do pełnego stopnia, szansa opadów do 5 punktów procentowych.
 */
function roundedBrief(f: Forecast, when: ReturnType<typeof resolveWhen>): string {
  const d = when.day;
  const head = d
    ? `${d.code}|${Math.round(d.tMin)}|${Math.round(d.tMax)}|${Math.round(d.precipProbMax / 5) * 5}`
    : "";
  const hours = when.hours
    .map((h) => `${h.code}|${Math.round(h.temp)}|${Math.round(h.precipProb / 5) * 5}`)
    .join(";");
  return `${head}#${hours}`;
}

/** Skrót pogody dla promptów propozycji — dzień + wybrana pora, bez lania wody. */
function weatherBrief(f: Forecast, when: ReturnType<typeof resolveWhen>): string {
  const d = when.day;
  const head = d
    ? `Dzień ${weekday(when.date)} ${when.date}: ${wmo(d.code).label}, ${Math.round(d.tMin)}–${Math.round(
        d.tMax
      )}°C, opady ${d.precipProbMax}% (${d.precipSum.toFixed(1)} mm), wiatr do ${Math.round(
        d.windMaxKph
      )} km/h, UV ${d.uvMax.toFixed(0)}`
    : `Dzień ${when.date}`;
  return `${head}\nPora: ${when.part.label} (${when.part.from}:00–${when.part.to}:00)\n${
    digestHours(when.hours) || "(brak danych godzinowych)"
  }`;
}

/**
 * Lista propozycji „co robić" dla lokalizacji, dnia i pory dnia.
 *
 * `variation` = „Wylosuj inne": wymusza świeżą listę (bez pamięci podręcznej i z wyższą temperaturą).
 */
export async function getIdeas(
  lat: number,
  lon: number,
  label: string,
  opts?: { date?: string; part?: DayPart; force?: boolean }
): Promise<IdeasResult> {
  const user = await requireAuth();
  const f = await fetchForecast(lat, lon);
  if (!f) throw new Error("Brak danych pogodowych.");
  const when = resolveWhen(f, opts);
  // 038: jedna nazwa dla jednej intencji. „variation" sugerowało losowanie dla rozrywki, a to jest
  // wymuszenie nowej generacji — jedyny moment, w którym wolno wołać model mimo zapamiętanej treści.
  const force = opts?.force ?? false;

  const known = await prisma.weatherIdea.findMany({ where: { ownerId: user.id } });
  const blocked = known.filter((k) => k.state === "blocked");
  const saved = known.filter((k) => k.state === "saved");
  const byFingerprint = new Map(known.map((k) => [k.fingerprint, k]));

  // 038: pamiętamy SUROWĄ listę od modelu, bez stanu użytkownika. Stan (zapisana/zablokowana)
  // dokładamy przy każdym odczycie z bazy — dzięki temu zablokowanie propozycji usuwa ją z listy
  // natychmiast, bez generowania czegokolwiek od nowa.
  const scopeKey = `${lat.toFixed(3)}|${lon.toFixed(3)}|${when.date}|${when.part.key}`;
  const brief = weatherBrief(f, when);
  const inputHash = hashInputs(
    // Zaokrąglony skrót pogody: korekta o jedną dziesiątą stopnia nie może unieważniać treści,
    // bo zniweczyłaby całą oszczędność, dla której ta pamięć powstała.
    roundedBrief(f, when),
    blocked.map((b) => b.fingerprint).sort().join(","),
    saved.map((b) => b.fingerprint).sort().join(",")
  );

  // Namiastka bazy wiedzy o użytkowniku (pełny mechanizm to osobne zgłoszenie): stałe preferencje
  // z ustawień asystenta + to, co użytkownik już sobie zapisał.
  const prefs = await prisma.assistantPref.findUnique({ where: { userId: user.id } });
  const personalHint =
    (prefs?.instructions?.trim()
      ? `\n\nO UŻYTKOWNIKU (uwzględnij przy doborze propozycji):\n${prefs.instructions.trim()}`
      : "") +
    (saved.length > 0
      ? `\n\nPodobały mu się wcześniej:\n${saved.slice(0, 10).map((k) => `- ${k.title}`).join("\n")}`
      : "");

  const remembered = await rememberedContent<RawIdea[]>({
    ownerId: user.id,
    kind: "weather.ideas",
    scopeKey,
    inputHash,
    force,
    generate: async () => {
      const system =
        "Jesteś przewodnikiem po okolicy i doradcą rekreacyjnym. Na podstawie prognozy dla wskazanego " +
        "dnia i pory dnia proponujesz KONKRETNE pomysły, co robić w danej lokalizacji.\n" +
        "Zasady:\n" +
        "- Zwróć 5–7 propozycji.\n" +
        "- CO NAJMNIEJ 2 muszą dotyczyć konkretnego miejsca lub atrakcji w promieniu ok. 30 km od " +
        "lokalizacji, z NAZWĄ WŁASNĄ (np. szczyt, szlak, jezioro, muzeum, zabytek). Takie pozycje mają " +
        "\"nearby\": true, a w \"summary\" krótko: dlaczego akurat to i jak blisko.\n" +
        "- Pozostałe mogą być ogólnymi czynnościami pasującymi do tej pogody.\n" +
        "- Jeśli pogoda wyklucza rekreację na zewnątrz, przewagę mają propozycje domowe (category: home).\n" +
        "- Pora nocna NIE jest powodem, by nie proponować niczego: wtedy proponuj zajęcia domowe albo " +
        "nocne (obserwacja nieba, spacer przy oświetleniu). Pusta lista jest ZAWSZE złą odpowiedzią.\n" +
        "- Nie wymyślaj miejsc, których nie ma. Jeśli nie znasz okolicy na tyle dobrze, daj mniej " +
        "propozycji miejscowych, ale nie zmyślaj nazw.\n" +
        "- \"title\" to zwięzła nazwa propozycji (do 60 znaków), \"summary\" to JEDNO zdanie uzasadnienia " +
        "odnoszące się do pogody.\n" +
        "- category: outdoor (aktywność na zewnątrz), trip (wycieczka/wyjazd do miejsca), home (w domu), other.\n" +
        "Pisz po polsku. Zwróć WYŁĄCZNIE JSON." +
        (force ? "\nZaproponuj INNE, mniej oczywiste pomysły niż zwykle — bądź kreatywny." : "");

      const blockedHint =
        blocked.length > 0
          ? `\n\nNIE PROPONUJ tych pozycji (użytkownik je odrzucił):\n${blocked
              .map((b) => `- ${b.title}`)
              .join("\n")}`
          : "";

      const userPrompt =
        `Lokalizacja: ${label} (${lat.toFixed(3)}, ${lon.toFixed(3)})\n\n` +
        `PROGNOZA:\n${brief}${blockedHint}${personalHint}\n\n` +
        `Zwróć JSON: {"ideas":[{"title":"...","summary":"...","category":"outdoor|trip|home|other","nearby":true}]}` +
        (force ? `\n\n[wariant ${Math.random().toString(36).slice(2, 8)}]` : "");

      const res = await chatComplete({
        op: "reasoning",
        json: true,
        temperature: force ? 0.95 : 0.6,
        // 038: 1200 tokenów było na styk dla 5–7 propozycji po polsku w JSON — a gdy typ operacji
        // „reasoning" ma przypisany model rozumujący, tokeny rozumowania wliczają się do tego samego
        // limitu i treść bywała ucinana w połowie struktury.
        maxTokens: 2000,
        // Pamięć treści (`AiContent`) zastępuje tu pamięć podręczną wywołań: skoro do modelu idziemy
        // wyłącznie przy braku zapisu albo na wyraźne żądanie, drugi poziom cache nie ma czego oszczędzić.
        cache: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      });
      if (!res.ok) throw new Error(res.message);
      // 038: odpowiedź UCIĘTA to awaria, nie „model nic nie wymyślił". Wcześniej obie sytuacje
      // kończyły się tym samym pustym ekranem, więc użytkownik nie miał jak rozpoznać, że coś się
      // zepsuło — i ponawiał w nieskończoność.
      if (res.truncated) {
        throw new Error(
          "Odpowiedź modelu została ucięta, zanim zdążył wypisać propozycje. Spróbuj ponownie albo " +
            "zwiększ limit tokenów dla operacji typu „reasoning” w panelu LLM."
        );
      }
      const parsed = parseJsonLoose<{ ideas: RawIdea[] }>(res.content);
      // Nieparsowalna odpowiedź też jest awarią — `?? []` zamieniało ją w cichy pusty wynik.
      if (parsed == null) {
        throw new Error("Nie udało się odczytać odpowiedzi modelu (niepoprawny format). Spróbuj ponownie.");
      }
      return {
        value: parsed.ideas ?? [],
        usage: usageFromChat([{ res, label: "propozycje", op: "reasoning" }]),
      };
    },
  });

  const seen = new Set<string>();
  const ideas: IdeaDTO[] = [];
  for (const raw of remembered.value) {
    const title = (raw.title ?? "").trim();
    if (!title) continue;
    const fingerprint = fingerprintOf(title);
    if (!fingerprint || seen.has(fingerprint)) continue;
    const row = byFingerprint.get(fingerprint);
    // Blokada jest EGZEKWOWANA tutaj, po stronie serwera — także dla treści z pamięci. Podpowiedź
    // w prompcie bywa ignorowana przez model, więc sam prompt nie może być gwarancją.
    if (row?.state === "blocked") continue;
    seen.add(fingerprint);
    ideas.push({
      id: row?.id ?? null,
      fingerprint,
      title,
      summary: (raw.summary ?? "").trim(),
      category: parseIdeaCategory(raw.category),
      state: row ? parseIdeaState(row.state) : null,
      nearby: raw.nearby === true,
      hasDetail: !!row?.detail,
      locationLabel: row?.locationLabel ?? label,
      detailAt: row?.detailAt ? row.detailAt.toISOString() : null,
      detailRuns: row?.detailRuns ?? 0,
    });
  }

  return {
    ideas,
    usage: await visibleUsage(remembered.usage),
    generatedAt: remembered.generatedAt,
    stale: remembered.stale,
    fromMemory: remembered.fromMemory,
  };
}

/**
 * 038: zapis propozycji prosto z listy — BEZ generowania opisu i BEZ kosztu.
 *
 * Powód: opis czyta się rzadko, a generowanie go dla każdej zapisanej pozycji byłoby płaceniem za
 * treść, której nikt nie otworzy. Zapisujemy więc same NASIONA (dzień, pora, skrót prognozy z chwili
 * zaproponowania) — opis powstanie później, przy pierwszym wejściu w szczegóły, i będzie opisywał
 * pogodę z dnia, dla którego pomysł powstał, a nie z dnia czytania.
 */
export async function saveIdeaFromList(
  idea: { title: string; summary?: string; category?: string },
  ctx: IdeaContext
): Promise<{ id: string }> {
  const user = await requireAuth();
  const title = idea.title.trim();
  if (!title) throw new Error("Propozycja bez nazwy");
  const fingerprint = fingerprintOf(title);

  const seed = await buildSeed(ctx);
  const row = await prisma.weatherIdea.upsert({
    where: { ownerId_fingerprint: { ownerId: user.id, fingerprint } },
    create: {
      ownerId: user.id,
      fingerprint,
      title,
      summary: (idea.summary ?? "").trim(),
      category: parseIdeaCategory(idea.category),
      state: "saved",
      locationLabel: ctx.label,
      lat: ctx.lat,
      lon: ctx.lon,
      seedDate: seed.date,
      seedPart: seed.part,
      seedWeather: seed.weather,
    },
    update: {
      state: "saved",
      lastSeenAt: new Date(),
      // Nasiona uzupełniamy tylko, gdy ich jeszcze nie ma — pierwsze zaproponowanie jest tym
      // momentem, do którego plan ma się odnosić.
      seedDate: seed.date,
      seedPart: seed.part,
      seedWeather: seed.weather,
    },
  });
  revalidatePath("/pogoda");
  revalidatePath("/pogoda/pomysly");
  return { id: row.id };
}

/** Warunki z chwili zaproponowania — zapisywane razem z pomysłem, nie odtwarzane później. */
async function buildSeed(ctx: IdeaContext): Promise<{ date: string; part: string; weather: string }> {
  const f = await fetchForecast(ctx.lat, ctx.lon);
  if (!f) return { date: ctx.date ?? "", part: ctx.part ?? "morning", weather: "" };
  const when = resolveWhen(f, { date: ctx.date, part: ctx.part });
  return { date: when.date, part: when.part.key, weather: weatherBrief(f, when) };
}

/**
 * Zapisane szczegóły propozycji — BEZ wołania modelu.
 *
 * To jest sedno wymagania „użytkownik wraca do informacji po ponownym uruchomieniu aplikacji":
 * raz wygenerowany plan jest trwały i darmowy przy każdym kolejnym otwarciu.
 */
export async function getIdeaDetail(fingerprint: string): Promise<IdeaDetailResult | null> {
  const user = await requireAuth();
  const row = await prisma.weatherIdea.findUnique({
    where: { ownerId_fingerprint: { ownerId: user.id, fingerprint } },
  });
  if (!row) return null;
  await prisma.weatherIdea.update({
    where: { id: row.id },
    data: { viewCount: { increment: 1 }, lastSeenAt: new Date() },
  });
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    title: row.title,
    detail: row.detail,
    detailRuns: row.detailRuns,
    detailAt: row.detailAt ? row.detailAt.toISOString() : null,
    usage: await visibleUsage(parseStoredUsage(row.detailUsage)),
  };
}

/**
 * Generuje szczegółowy plan propozycji i zapisuje go na stałe.
 *
 * Szczegóły powstają NA ŻĄDANIE (po otwarciu pozycji), a nie z góry dla całej listy — inaczej każde
 * wejście na /pogoda kosztowałoby wielokrotność ceny samej listy. `force` = „Generuj ponownie".
 */
export async function generateIdeaDetail(
  idea: { title: string; summary?: string; category?: string },
  ctx: IdeaContext,
  opts?: { force?: boolean }
): Promise<IdeaDetailResult> {
  const user = await requireAuth();
  const title = idea.title.trim();
  if (!title) throw new Error("Propozycja bez nazwy");
  const fingerprint = fingerprintOf(title);

  const existing = await prisma.weatherIdea.findUnique({
    where: { ownerId_fingerprint: { ownerId: user.id, fingerprint } },
  });
  // Bez wymuszenia zapisany plan wygrywa z nową generacją — użytkownik ma dostać to, co już czytał.
  if (existing?.detail && !opts?.force) {
    return {
      id: existing.id,
      fingerprint,
      title: existing.title,
      detail: existing.detail,
      detailRuns: existing.detailRuns,
      detailAt: existing.detailAt ? existing.detailAt.toISOString() : null,
      usage: await visibleUsage(parseStoredUsage(existing.detailUsage)),
    };
  }

  // 038: plan opisuje pogodę Z CHWILI ZAPROPONOWANIA, a nie z chwili czytania. Pomysł zapisany
  // w niedzielę i otwarty w czwartek dotyczy niedzieli — pobranie bieżącej prognozy dawałoby plan
  // na zupełnie inny dzień, wyglądający przy tym całkowicie wiarygodnie.
  let brief = existing?.seedWeather ?? "";
  let planDate = existing?.seedDate ?? ctx.date ?? "";
  let planPart = existing?.seedPart ?? ctx.part ?? "";
  if (!brief) {
    const f = await fetchForecast(ctx.lat, ctx.lon);
    if (!f) throw new Error("Brak danych pogodowych.");
    const when = resolveWhen(f, { date: ctx.date, part: ctx.part });
    brief = weatherBrief(f, when);
    planDate = when.date;
    planPart = when.part.key;
  }

  const system =
    "Rozpisujesz KONKRETNY plan wykonania jednego pomysłu na spędzenie czasu, dopasowany do pogody " +
    "i lokalizacji. Pisz po polsku, w markdownie, zwięźle (do ~250 słów). Struktura:\n" +
    "- jedno zdanie wstępu (na czym rzecz polega),\n" +
    "- **Jak to zrobić** — kroki lub przebieg (przy trasach: punkty, orientacyjny dystans i czas),\n" +
    "- **Co zabrać** — lista pod tę konkretną pogodę,\n" +
    "- **Na co uważać** — ryzyka wynikające z prognozy,\n" +
    "- **Plan awaryjny** — co zrobić, jeśli pogoda się popsuje.\n" +
    "Nie zmyślaj nazw miejsc, godzin otwarcia, cen ani danych kontaktowych. Bez nagłówka z tytułem — " +
    "tytuł jest już pokazany nad treścią.";

  const userPrompt =
    `Lokalizacja: ${ctx.label} (${ctx.lat.toFixed(3)}, ${ctx.lon.toFixed(3)})\n` +
    `Propozycja: ${title}\n` +
    (idea.summary ? `Uzasadnienie z listy: ${idea.summary}\n` : "") +
    `\nPROGNOZA:\n${brief}` +
    (opts?.force ? `\n\n[nowe ujęcie ${Math.random().toString(36).slice(2, 8)}]` : "");

  const res = await chatComplete({
    op: "generation",
    temperature: 0.7,
    maxTokens: 900,
    // Ponowna generacja ma dać INNY plan, więc omija pamięć podręczną.
    cache: !opts?.force,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  });
  if (!res.ok) throw new Error(res.message);

  const detail = res.content.trim();
  const usage = usageFromChat([{ res, label: "szczegóły propozycji", op: "generation" }]);
  const now = new Date();
  const row = await prisma.weatherIdea.upsert({
    where: { ownerId_fingerprint: { ownerId: user.id, fingerprint } },
    create: {
      ownerId: user.id,
      fingerprint,
      title,
      summary: (idea.summary ?? "").trim(),
      category: parseIdeaCategory(idea.category),
      state: "considered",
      locationLabel: ctx.label,
      lat: ctx.lat,
      lon: ctx.lon,
      seedDate: planDate,
      seedPart: planPart,
      seedWeather: brief,
      detail,
      detailAt: now,
      detailRuns: 1,
      detailUsage: usage ? JSON.stringify(usage) : null,
      viewCount: 1,
      lastSeenAt: now,
    },
    update: {
      detail,
      detailAt: now,
      detailRuns: { increment: 1 },
      detailUsage: usage ? JSON.stringify(usage) : null,
      lastSeenAt: now,
      // Wejście w szczegóły odblokowuje propozycję: jeśli była zablokowana, to znaczy, że użytkownik
      // zmienił zdanie — świadomie ją otworzył.
      state: existing?.state === "blocked" ? "considered" : undefined,
    },
  });

  revalidatePath("/pogoda");
  revalidatePath("/pogoda/pomysly");
  return {
    id: row.id,
    fingerprint,
    title: row.title,
    detail: row.detail,
    detailRuns: row.detailRuns,
    detailAt: row.detailAt ? row.detailAt.toISOString() : null,
    usage: await visibleUsage(usage),
  };
}

/** Biblioteka pomysłów — wszystko, co użytkownik kiedykolwiek rozważał lub odrzucił. */
export async function getIdeaLibrary(filter?: {
  state?: IdeaState | "all";
  location?: string;
}): Promise<IdeaDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.weatherIdea.findMany({
    where: {
      ownerId: user.id,
      ...(filter?.state && filter.state !== "all" ? { state: filter.state } : {}),
      ...(filter?.location ? { locationLabel: filter.location } : {}),
    },
    orderBy: [{ lastSeenAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    fingerprint: r.fingerprint,
    title: r.title,
    summary: r.summary,
    category: parseIdeaCategory(r.category),
    state: parseIdeaState(r.state),
    nearby: false,
    hasDetail: !!r.detail,
    locationLabel: r.locationLabel,
    detailAt: r.detailAt ? r.detailAt.toISOString() : null,
    detailRuns: r.detailRuns,
  }));
}

/** Zmiana stanu istniejącej pozycji: zapisz / przywróć proponowanie / zablokuj. */
export async function setIdeaState(id: string, state: IdeaState): Promise<void> {
  const user = await requireAuth();
  const row = await prisma.weatherIdea.findUnique({ where: { id } });
  if (!row || row.ownerId !== user.id) throw new Error("Propozycja nie istnieje");
  await prisma.weatherIdea.update({ where: { id }, data: { state, lastSeenAt: new Date() } });
  revalidatePath("/pogoda");
  revalidatePath("/pogoda/pomysly");
}

/**
 * Blokada propozycji PROSTO Z LISTY — także takiej, która nie ma jeszcze wiersza w bazie.
 *
 * Dzięki temu „nie proponuj mi tego" nie wymaga wcześniejszego wchodzenia w szczegóły; pozycja trafia
 * do biblioteki bez planu i można ją stamtąd przywrócić.
 */
export async function blockIdea(
  idea: { title: string; summary?: string; category?: string },
  ctx: { label: string; lat: number; lon: number }
): Promise<void> {
  const user = await requireAuth();
  const title = idea.title.trim();
  if (!title) throw new Error("Propozycja bez nazwy");
  const fingerprint = fingerprintOf(title);
  await prisma.weatherIdea.upsert({
    where: { ownerId_fingerprint: { ownerId: user.id, fingerprint } },
    create: {
      ownerId: user.id,
      fingerprint,
      title,
      summary: (idea.summary ?? "").trim(),
      category: parseIdeaCategory(idea.category),
      state: "blocked",
      locationLabel: ctx.label,
      lat: ctx.lat,
      lon: ctx.lon,
    },
    update: { state: "blocked", lastSeenAt: new Date() },
  });
  revalidatePath("/pogoda");
  revalidatePath("/pogoda/pomysly");
}

/** Usunięcie z biblioteki — przez kosz (C-24), żeby dało się cofnąć pomyłkę. */
export async function deleteIdea(id: string): Promise<void> {
  const user = await requireAuth();
  const row = await prisma.weatherIdea.findUnique({ where: { id } });
  if (!row || row.ownerId !== user.id) throw new Error("Propozycja nie istnieje");
  await recordTrash(user.id, {
    module: "weather",
    entityId: row.id,
    title: row.title,
    payload: row,
  });
  await prisma.weatherIdea.delete({ where: { id } });
  revalidatePath("/pogoda");
  revalidatePath("/pogoda/pomysly");
  revalidatePath("/trash");
}

/**
 * „Dodaj do zadań" — pomysł, który użytkownik chce naprawdę zrealizować, trafia do modułu Zadania
 * z odsyłaczem do zapisanych szczegółów.
 */
export async function addIdeaToTasks(id: string): Promise<void> {
  const user = await requireAuth();
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.TASKS)) throw new Error("Brak dostępu do modułu Zadania");
  const row = await prisma.weatherIdea.findUnique({ where: { id } });
  if (!row || row.ownerId !== user.id) throw new Error("Propozycja nie istnieje");

  const description =
    (row.summary ? `${row.summary}\n\n` : "") +
    `Pomysł z modułu Pogoda (${row.locationLabel}).\n` +
    `Szczegóły: /pogoda/pomysly?idea=${row.id}`;
  await createTask({ title: row.title, description });

  // Pozycja przestaje być „rozważana" — użytkownik podjął decyzję, że to robi.
  await prisma.weatherIdea.update({ where: { id }, data: { state: "saved" } });
  revalidatePath("/tasks");
  revalidatePath("/pogoda/pomysly");
}
