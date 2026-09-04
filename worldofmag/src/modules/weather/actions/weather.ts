"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { chatComplete } from "@/platform/llm/chat";
import { parseJsonLoose } from "@/platform/llm/json";
import {
  fetchForecast,
  geocode,
  reverseGeocode,
  wmo,
  observedWmo,
  type Forecast,
  type HourPoint,
} from "../lib/openMeteo";
import { presetByKey, DAY_PARTS, type Horizon, type DayPart } from "../lib/presets";
import { czytajUklad, type WatchersLayout } from "../lib/uklad";
import {
  fingerprintOf,
  parseIdeaCategory,
  parseIdeaState,
  type IdeaDTO,
  type IdeaState,
} from "../lib/ideas";
import { usageFromChat, parseStoredUsage, type AiUsageInfo } from "@/platform/ai/usage";
import { visibleUsage } from "@/platform/ai/costVisibility";
import { rememberedContent, hashInputs } from "@/platform/ai/contentMemory";
import { resolveSectionMode } from "@/platform/ai/sectionModeResolver";
import type { AiSectionMode } from "@/platform/ai/sectionMode";
import { buildUserContext, userContextStamp } from "@/lib/userContext";
import { recordTrash } from "@/platform/trash/trash";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { createTask, tasksModule } from "@/modules/tasks/contract";
import { resolveWhen } from "../domain/pora";
import { roundedBrief } from "../domain/odcisk";
import { wlasnoscOsobistaDoZapisu, filtrMoichRekordow, czyMojRekord } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";

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
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)) },
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
  const existing = await prisma.weatherLocation.count({ where: { ...(await filtrMoichRekordow(user.id)) } });
  const isDefault = data.makeDefault || existing === 0;
  if (isDefault) {
    await prisma.weatherLocation.updateMany({
      where: { ...(await filtrMoichRekordow(user.id)) },
      data: { isDefault: false },
    });
  }
  const l = await prisma.weatherLocation.create({
    data: {
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
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
  if (!l || !(await czyMojRekord(l, user.id))) throw new Error("Lokalizacja nie istnieje");
  await prisma.weatherLocation.updateMany({ where: { ...(await filtrMoichRekordow(user.id)) }, data: { isDefault: false } });
  await prisma.weatherLocation.update({ where: { id }, data: { isDefault: true } });
  revalidatePath("/pogoda");
}

export async function deleteLocation(id: string): Promise<void> {
  const user = await requireAuth();
  const l = await prisma.weatherLocation.findUnique({ where: { id } });
  if (!l || !(await czyMojRekord(l, user.id))) throw new Error("Lokalizacja nie istnieje");
  await prisma.weatherLocation.delete({ where: { id } });
  revalidatePath("/pogoda");
}

// ─── Forecast (live) ───────────────────────────────────────────────────────

export async function getWeather(lat: number, lon: number): Promise<Forecast> {
  await requireAuth();
  const f = await fetchForecast(lat, lon);
  // Błąd zostaje tylko na zimny start: przy awarii z zapełnioną pamięcią `fetchForecast` oddaje
  // ostatnią udaną prognozę oznaczoną `stale` i UI pokazuje pasek zamiast pustego ekranu.
  if (!f) throw new Error("Serwis pogodowy (Open-Meteo) chwilowo nie odpowiada. Spróbuj ponownie za chwilę.");
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
      // 044: ten sam opis co na ekranie — czujka i asystent nie mogą mówić „pochmurno" o godzinie,
      // dla której model raportuje opad, skoro kafel „Teraz" mówi „deszcz" (AC-A8).
      const w = observedWmo(h);
      return `${h.time.slice(5, 16).replace("T", " ")}: ${Math.round(h.temp)}°C (odcz. ${Math.round(
        h.apparent
      )}°C), ${w.label}, opady ${h.precipProb}%, wiatr ${Math.round(h.windKph)} km/h`;
    })
    .join("\n");
}

function digestHours(hours: HourPoint[]): string {
  return hours
    .map((h) => {
      // 044: jak wyżej — opis godziny liczony z pełnych parametrów, wspólnie z ekranem.
      const w = observedWmo(h);
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
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)) },
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

/**
 * 082 — preferencja UKŁADU listy obserwatorów, per użytkownik.
 *
 * Odpowiednik `NewsPref` po stronie Pogody: jedna preferencja na przestrzeń osobistą, tworzona
 * przy pierwszym odczycie. Trzymanie tego w adresie strony (wzorzec `platform/viewState`) nie
 * wystarcza — właściciel ma zastać swój układ po prostu wchodząc na `/pogoda`, także z innego
 * urządzenia, a nie po otwarciu zapisanego widoku.
 */
export interface WeatherPrefDTO {
  watchersLayout: WatchersLayout;
  /** 115 (Z-INT-15): czy prognoza domyślnej lokalizacji ma się pokazywać we wspólnym kalendarzu. */
  kalendarzPrognoza: boolean;
}

export async function getWeatherPref(): Promise<WeatherPrefDTO> {
  const user = await requireAuth();
  const row = await prisma.weatherPref.upsert({
    where: { ...(await filtrMoichRekordow(user.id)) },
    create: { ...(await wlasnoscOsobistaDoZapisu(user.id)) },
    update: {},
  });
  return {
    watchersLayout: czytajUklad(row.watchersLayout),
    kalendarzPrognoza: row.kalendarzPrognoza,
  };
}

// ─── 115 (Z-INT-15): prognoza we wspólnym kalendarzu ─────────────────────────

export interface DzienPrognozyKalendarza {
  /** "YYYY-MM-DD" — klucz komórki siatki kalendarza. */
  date: string;
  tMax: number;
  tMin: number;
  emoji: string;
  opis: string;
}

export interface KalendarzPrognozaDTO {
  wlaczona: boolean;
  dni: DzienPrognozyKalendarza[];
}

/**
 * Prognoza dla siatki wspólnego kalendarza: domyślna lokalizacja, najbliższe dni.
 * Brak lokalizacji albo awaria Open-Meteo = pusta lista, nigdy wyjątek — kalendarz
 * jest agregatem wielu modułów i pogoda nie ma prawa go wywrócić.
 */
export async function getKalendarzPrognoza(): Promise<KalendarzPrognozaDTO> {
  const user = await requireAuth();
  const pref = await prisma.weatherPref.findFirst({
    where: { ...(await filtrMoichRekordow(user.id)) },
    select: { kalendarzPrognoza: true },
  });
  const wlaczona = pref?.kalendarzPrognoza ?? true;
  if (!wlaczona) return { wlaczona: false, dni: [] };

  try {
    const lokalizacje = await prisma.weatherLocation.findMany({
      take: SUFIT_LISTY,
      where: { ...(await filtrMoichRekordow(user.id)) },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    const domyslna = lokalizacje[0];
    if (!domyslna) return { wlaczona, dni: [] };

    const f = await fetchForecast(domyslna.lat, domyslna.lon);
    if (!f) return { wlaczona, dni: [] };
    return {
      wlaczona,
      dni: f.daily.slice(0, 7).map((d) => {
        const meta = wmo(d.code);
        return { date: d.date, tMax: d.tMax, tMin: d.tMin, emoji: meta.emoji, opis: meta.label };
      }),
    };
  } catch {
    return { wlaczona, dni: [] };
  }
}

export async function setKalendarzPrognoza(on: boolean): Promise<void> {
  const user = await requireAuth();
  await prisma.weatherPref.upsert({
    where: { ...(await filtrMoichRekordow(user.id)) },
    create: { ...(await wlasnoscOsobistaDoZapisu(user.id)), kalendarzPrognoza: on },
    update: { kalendarzPrognoza: on },
  });
  revalidatePath("/calendar");
  revalidatePath("/pogoda");
}

/**
 * 085 (AC-22): została JEDNA preferencja — układ listy. Filtr statusów zniknął z interfejsu razem
 * ze swoimi chipsami (właściciel: „nie chcemy takiego filtra"), a jego kolumnę usuwa migracja 0257.
 * Kształt `patch` zostaje obiektem, bo tak wołają go istniejące miejsca i bo preferencji widoku
 * może kiedyś przybyć.
 */
export async function setWatchersView(patch: {
  layout?: WatchersLayout;
}): Promise<void> {
  const user = await requireAuth();
  const data: { watchersLayout?: string } = {};
  if (patch.layout !== undefined) data.watchersLayout = czytajUklad(patch.layout);
  await prisma.weatherPref.upsert({
    where: { ...(await filtrMoichRekordow(user.id)) },
    create: { ...(await wlasnoscOsobistaDoZapisu(user.id)), ...data },
    update: data,
  });
  revalidatePath("/pogoda");
}

export async function addPresetWatcher(presetKey: string): Promise<void> {
  const user = await requireAuth();
  const preset = presetByKey(presetKey);
  if (!preset) throw new Error("Nieznany preset");
  const exists = await prisma.weatherWatcher.findFirst({
    where: { ...(await filtrMoichRekordow(user.id)), presetKey, kind: "preset" },
  });
  if (exists) return;
  const max = await prisma.weatherWatcher.aggregate({
    where: { ...(await filtrMoichRekordow(user.id)) },
    _max: { sortOrder: true },
  });
  await prisma.weatherWatcher.create({
    data: {
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
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
    where: { ...(await filtrMoichRekordow(user.id)) },
    _max: { sortOrder: true },
  });
  await prisma.weatherWatcher.create({
    data: {
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
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
  if (!w || !(await czyMojRekord(w, user.id))) throw new Error("Obserwator nie istnieje");
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
  if (!w || !(await czyMojRekord(w, user.id))) throw new Error("Obserwator nie istnieje");
  await prisma.weatherWatcher.delete({ where: { id } });
  revalidatePath("/pogoda");
}

export interface WatchersResult {
  verdicts: WatcherVerdict[];
  usage?: AiUsageInfo;
  /** 080 (Z11): kiedy ocena powstała. `null` = jeszcze nie powstała. */
  generatedAt: string | null;
  /** Prognoza albo lista obserwatorów zmieniła się od czasu oceny. Sygnał, nie polecenie. */
  stale: boolean;
  fromMemory: boolean;
  /** 080 (Z11): ocena czeka na kliknięcie — tryb sekcji zabrania generować przy wejściu na stronę. */
  pending: boolean;
  /** Obowiązujący tryb odświeżania tej sekcji (do przełącznika w pasku). */
  mode: AiSectionMode;
}

/** Wynik dla użytkownika bez ani jednego włączonego obserwatora — nie ma czego oceniać. */
const BRAK_OBSERWATOROW: WatchersResult = {
  verdicts: [],
  generatedAt: null,
  stale: false,
  fromMemory: false,
  pending: false,
  mode: "onDemand",
};

/**
 * Ocenia włączone obserwatory względem aktualnej prognozy (LLM).
 *
 * 080 (Z11): przez `rememberedContent`, jak każda inna sekcja AI. Wcześniej ta funkcja była
 * wołana z `useEffect` przy KAŻDYM wejściu na moduł Pogoda — bez pamięci, bez trybu, bez
 * możliwości powstrzymania. Właściciel zgłosił to jako „bardzo często w ogóle nie działają":
 * każde wejście płaciło za wywołanie modelu, a każda odmowa kończyła się pustą listą i spinnerem.
 * Teraz obowiązuje ta sama zasada, co w „Co robić?": nic nie powstaje bez kliknięcia, chyba że
 * użytkownik świadomie wybrał inny tryb.
 */
export async function evaluateWatchers(
  lat: number,
  lon: number,
  label: string,
  opts?: { force?: boolean }
): Promise<WatchersResult> {
  const user = await requireAuth();
  const watchers = await prisma.weatherWatcher.findMany({
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)), enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  if (watchers.length === 0) return BRAK_OBSERWATOROW;

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

  // 080 (Z11): to tryb decyduje, czy samo wejście na stronę woła model. Domyślnie („na żądanie")
  // NIE woła — ocena czeka na kliknięcie, zamiast kosztować przy każdym wejściu na moduł.
  const mode = await resolveSectionMode(user.id, "weather.watchers");

  // Ocena zależy od TREŚCI obserwatorów (nie tylko ich liczby) i od prognozy. Skrót prognozy
  // celowo zaokrąglony: korekta o jedną dziesiątą stopnia nie może unieważniać oceny, bo
  // zniweczyłaby całą oszczędność, dla której ta pamięć powstała.
  const inputHash = hashInputs(
    watchers.map((w) => `${w.id}|${w.horizon}|${w.title}|${w.query ?? ""}`).join(";"),
    dailyDigest(f).slice(0, 400),
    await userContextStamp(user.id)
  );

  // Surowe werdykty od modelu; przypisanie ich do obserwatorów robimy przy KAŻDYM odczycie,
  // dzięki czemu skasowanie obserwatora natychmiast usuwa jego werdykt z widoku — bez generowania.
  type SurowyWerdykt = { index: number; status: string; verdict: string; detail: string };

  const remembered = await rememberedContent<SurowyWerdykt[]>({
    ownerId: user.id,
    kind: "weather.watchers",
    scopeKey: `${lat.toFixed(3)}|${lon.toFixed(3)}`,
    inputHash,
    force: opts?.force ?? false,
    mode,
    generate: async () => {
      const res = await chatComplete({
        op: "reasoning",
        json: true,
        temperature: 0.3,
        maxTokens: 1500,
        // Pamięć treści (`AiContent`) zastąpiła tu pamięć podręczną wywołań: skoro do modelu
        // idziemy wyłącznie przy braku zapisu albo na wyraźne żądanie, drugi poziom cache nie
        // ma czego oszczędzić.
        cache: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      });
      if (!res.ok) throw new Error(res.message);
      const parsed = parseJsonLoose<{ verdicts: SurowyWerdykt[] }>(res.content);
      // Nieparsowalna odpowiedź to awaria, nie „żaden obserwator się nie spełnił". Te dwie
      // rzeczy wyglądały tak samo (pusta lista) i właśnie dlatego usterka była niewidoczna.
      if (parsed == null) {
        throw new Error("Nie udało się odczytać odpowiedzi modelu (niepoprawny format). Spróbuj ponownie.");
      }
      return {
        value: parsed.verdicts ?? [],
        usage: usageFromChat([{ res, label: "obserwatory", op: "reasoning" }]),
      };
    },
  });

  // Nic jeszcze nie powstało i tryb zabrania generować samoczynnie. To NIE jest „żaden obserwator
  // się nie spełnił" ani awaria — UI ma dla tego osobny stan.
  if (remembered.pending) {
    return { verdicts: [], generatedAt: null, stale: false, fromMemory: false, pending: true, mode };
  }

  const mapped = remembered.value
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
    usage: await visibleUsage(remembered.usage),
    generatedAt: remembered.generatedAt,
    stale: remembered.stale,
    fromMemory: remembered.fromMemory,
    pending: false,
    mode,
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
  /** 038: kiedy lista powstała — UI mówi wprost, że treść pochodzi z pamięci. `null` = jeszcze nie powstała. */
  generatedAt: string | null;
  /** Prognoza lub listy pomysłów zmieniły się od czasu wygenerowania. Sygnał, nie polecenie. */
  stale: boolean;
  fromMemory: boolean;
  /** 041: lista czeka na kliknięcie — tryb sekcji zabrania generować przy samym wejściu na stronę. */
  pending: boolean;
  /** 041: obowiązujący tryb odświeżania tej sekcji (do przełącznika w pasku). */
  mode: AiSectionMode;
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

  const known = await prisma.weatherIdea.findMany({ take: SUFIT_LISTY, where: { ...(await filtrMoichRekordow(user.id)) } });
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
    roundedBrief(when),
    blocked.map((b) => b.fingerprint).sort().join(","),
    saved.map((b) => b.fingerprint).sort().join(","),
    // 039: wiedza o użytkowniku też jest warunkiem powstania treści. Bez tego potwierdzenie „nie
    // jeżdżę na rowerze" zostawiłoby zapamiętane propozycje rowerowe bez śladu, że coś się zmieniło.
    await userContextStamp(user.id)
  );

  // 039: namiastkę wiedzy o użytkowniku zastąpił mechanizm przekrojowy (`lib/userContext.ts`).
  // Stałe instrukcje z ustawień asystenta zostają — to jawna wola użytkownika, a nie hipoteza —
  // i tak samo to, co sam sobie zapisał.
  const prefs = await prisma.assistantPref.findUnique({ where: { userId: user.id } });
  const personalHint =
    (prefs?.instructions?.trim()
      ? `\n\nSTAŁE WSKAZÓWKI OD UŻYTKOWNIKA:\n${prefs.instructions.trim()}`
      : "") +
    (await buildUserContext(user.id)) +
    (saved.length > 0
      ? `\n\nPodobały mu się wcześniej:\n${saved.slice(0, 10).map((k) => `- ${k.title}`).join("\n")}`
      : "");

  // 041: to tryb decyduje, czy samo wejście na stronę woła model. Domyślnie („na żądanie") NIE woła
  // — lista czeka na kliknięcie, zamiast kosztować przy każdej zmianie dnia albo pory.
  const mode = await resolveSectionMode(user.id, "weather.ideas");

  const remembered = await rememberedContent<RawIdea[]>({
    ownerId: user.id,
    kind: "weather.ideas",
    scopeKey,
    inputHash,
    force,
    mode,
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

  // Nic jeszcze nie powstało i tryb zabrania generować samoczynnie. To NIE jest pusta lista
  // („nie ma co robić") ani awaria — UI ma dla tego osobny stan.
  if (remembered.pending) {
    return { ideas: [], generatedAt: null, stale: false, fromMemory: false, pending: true, mode };
  }

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
    pending: false,
    mode,
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
    where: { workspaceId_fingerprint: { ...(await filtrMoichRekordow(user.id)), fingerprint } },
    create: {
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
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
    where: { workspaceId_fingerprint: { ...(await filtrMoichRekordow(user.id)), fingerprint } },
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
    where: { workspaceId_fingerprint: { ...(await filtrMoichRekordow(user.id)), fingerprint } },
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
    where: { workspaceId_fingerprint: { ...(await filtrMoichRekordow(user.id)), fingerprint } },
    create: {
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
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
    take: SUFIT_LISTY,
    where: {
      ...(await filtrMoichRekordow(user.id)),
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
  if (!row || !(await czyMojRekord(row, user.id))) throw new Error("Propozycja nie istnieje");
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
    where: { workspaceId_fingerprint: { ...(await filtrMoichRekordow(user.id)), fingerprint } },
    create: {
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
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
  if (!row || !(await czyMojRekord(row, user.id))) throw new Error("Propozycja nie istnieje");
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
  if (!hasPermission(session, tasksModule.permission)) throw new Error("Brak dostępu do modułu Zadania");
  const row = await prisma.weatherIdea.findUnique({ where: { id } });
  if (!row || !(await czyMojRekord(row, user.id))) throw new Error("Propozycja nie istnieje");

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
