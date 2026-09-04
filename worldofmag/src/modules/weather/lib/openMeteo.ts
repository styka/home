// Klient Open-Meteo (darmowy, bez klucza API). Pobiera prognozę godzinową i dzienną
// oraz geokoduje nazwy miejscowości. Mapowanie kodów pogody WMO → polski opis + emoji.
import { resilientFetch } from "@/lib/integrations/resilientFetch"; // Z-157: timeout+retry+degradacja
import { logEvent } from "@/platform/observability/log";

export interface HourPoint {
  time: string; // ISO local
  /** 038: czy o tej godzinie jest dzień — z API, nie z naszego liczenia wschodu/zachodu. */
  isDay: boolean;
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

/**
 * 044: bieżące warunki. Do 043 był to typ wpisany inline w `Forecast` i niosący WYŁĄCZNIE
 * syntetyczny kod pogody dostawcy — zapytanie nie pobierało nawet pola o opadzie. Stąd zgłoszenie
 * właściciela „pada, a moduł pokazuje chmurkę": kod WMO potrafi mówić „pochmurno" w tej samej
 * chwili, w której model raportuje opad. Cztery pola opadu pochodzą z TEGO SAMEGO zapytania,
 * więc nie kosztują dodatkowego wywołania sieciowego.
 *
 * Każde z nich jest `number | null`, bo dostawca może pola nie zwrócić (starsze wdrożenia API,
 * degradacja). `null` musi oznaczać „nie wiem", a nie „nie pada" — inaczej brak danych
 * cichaczem kasowałby korektę.
 */
export interface CurrentPoint {
  /**
   * Znacznik czasu dostawcy (czas LOKALNY lokalizacji, ISO). Po nim dopasowujemy punkt godzinowy
   * odpowiadający „teraz" — zegar przeglądarki nie nadaje się do tego, bo użytkownik ogląda pogodę
   * także dla miejsc w innej strefie czasowej.
   */
  time: string;
  temp: number;
  apparent: number;
  code: number;
  windKph: number;
  isDay: boolean;
  /** Suma opadu (deszcz+przelotny+śnieg) w ostatniej godzinie, mm. */
  precip: number | null;
  /** Deszcz ciągły, mm. */
  rain: number | null;
  /** Opad przelotny, mm. */
  showers: number | null;
  /** Śnieg, cm (Open-Meteo podaje śnieg w centymetrach). */
  snowfall: number | null;
}

export interface Forecast {
  latitude: number;
  longitude: number;
  timezone: string;
  current: CurrentPoint | null;
  hourly: HourPoint[];
  daily: DayPoint[];
  /** Chwila udanego pobrania z API (ISO UTC). Przy odpowiedzi z pamięci — chwila TAMTEGO pobrania. */
  fetchedAt?: string;
  /**
   * `true` = Open-Meteo nie odpowiedziało, a to jest ostatnia udana prognoza z pamięci procesu.
   * Pole jest informacją dla UI (pasek „prognoza sprzed…"), nigdy wyzwalaczem ponownego pobrania.
   */
  stale?: boolean;
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

/**
 * 038: `isNight` podmienia ikonę tylko tam, gdzie w wariancie dziennym świeci SŁOŃCE.
 *
 * Zgłoszenie właściciela: o 23:00 i 02:00 pasek godzinowy pokazywał ☀️. Deszcz, śnieg i mgła
 * wyglądają w nocy tak samo jak w dzień, więc świadomie NIE dorabiamy im sztucznych wariantów —
 * byłoby to mnożenie ikon bez informacji (C-53).
 *
 * 044: ta sama zasada, konsekwentnie domknięta. Mżawka (51–55) i przelotny deszcz (80–82) też
 * używały ikony ze słońcem (🌦️), więc po zmroku pokazywały słońce zza chmury — dokładnie usterka,
 * którą 038 miało usunąć, tyle że w dwóch przeoczonych zakresach kodów. Nocą dostają 🌧️.
 * Reguła do zapamiętania: wariant nocny dodajemy WTEDY I TYLKO WTEDY, gdy dzienny zawiera słońce.
 */
export function wmo(code: number, isNight = false): WmoMeta {
  const c = code;
  if (c === 0)
    return isNight
      ? { label: "Bezchmurna noc", emoji: "🌙", color: "var(--accent-blue)" }
      : { label: "Bezchmurnie", emoji: "☀️", color: "var(--accent-amber)" };
  if (c === 1)
    return isNight
      ? { label: "Niemal bezchmurna noc", emoji: "🌙", color: "var(--accent-blue)" }
      : { label: "Przeważnie słonecznie", emoji: "🌤️", color: "var(--accent-amber)" };
  if (c === 2)
    return isNight
      ? { label: "Częściowe zachmurzenie", emoji: "☁️", color: "var(--text-secondary)" }
      : { label: "Częściowe zachmurzenie", emoji: "⛅", color: "var(--accent-amber)" };
  if (c === 3) return { label: "Pochmurno", emoji: "☁️", color: "var(--text-secondary)" };
  if (c === 45 || c === 48) return { label: "Mgła", emoji: "🌫️", color: "var(--text-muted)" };
  if (c >= 51 && c <= 55)
    return isNight
      ? { label: "Mżawka", emoji: "🌧️", color: "var(--accent-blue)" }
      : { label: "Mżawka", emoji: "🌦️", color: "var(--accent-blue)" };
  if (c >= 56 && c <= 57) return { label: "Marznąca mżawka", emoji: "🌧️", color: "var(--accent-blue)" };
  if (c >= 61 && c <= 65) return { label: "Deszcz", emoji: "🌧️", color: "var(--accent-blue)" };
  if (c >= 66 && c <= 67) return { label: "Marznący deszcz", emoji: "🌧️", color: "var(--accent-blue)" };
  if (c >= 71 && c <= 75) return { label: "Śnieg", emoji: "🌨️", color: "var(--accent-blue)" };
  if (c === 77) return { label: "Krupa śnieżna", emoji: "🌨️", color: "var(--accent-blue)" };
  if (c >= 80 && c <= 82)
    return isNight
      ? { label: "Przelotny deszcz", emoji: "🌧️", color: "var(--accent-blue)" }
      : { label: "Przelotny deszcz", emoji: "🌦️", color: "var(--accent-blue)" };
  if (c >= 85 && c <= 86) return { label: "Przelotny śnieg", emoji: "🌨️", color: "var(--accent-blue)" };
  if (c === 95) return { label: "Burza", emoji: "⛈️", color: "var(--accent-purple)" };
  if (c >= 96 && c <= 99) return { label: "Burza z gradem", emoji: "⛈️", color: "var(--accent-purple)" };
  return { label: "Pogoda zmienna", emoji: "🌡️", color: "var(--text-secondary)" };
}

// ─── 044: korekta opisu pogody zmierzonym opadem ───────────────────────────

/** Rodzaj opadu rozpoznany z pomiarów. Union TS, nie enum Prisma (C-12). */
export type PrecipKind = "rain" | "showers" | "snow" | "none";

/**
 * Poniżej tej wartości opad jest ŚLADOWY i nie zmienia obrazu pogody. Bez tego progu wilgoć na
 * granicy czułości (0,05 mm) kazałaby ikonie krzyczeć „deszcz" przy suchym chodniku.
 */
const PRECIP_MM_MIN = 0.1;
/** Progi natężenia (mm/h) — standardowe meteorologiczne granice słaby/umiarkowany/silny. */
const PRECIP_MM_MODERATE = 2.5;
const PRECIP_MM_HEAVY = 7.6;

/**
 * Wejście korekty: kod dostawcy + to, co faktycznie zmierzono. Pasuje zarówno do `CurrentPoint`,
 * jak i do `HourPoint` — dzięki temu ekran, czujki i asystent liczą opis JEDNĄ funkcją (AC-A8).
 */
export interface ObservedConditions {
  code: number;
  /** Brak = traktujemy jak dzień (prognoza dzienna nie ma pory doby). */
  isDay?: boolean;
  precip?: number | null;
  rain?: number | null;
  showers?: number | null;
  snowfall?: number | null;
}

/** Czy pomiar przekracza próg istotności. `null`/brak = „nie wiem", więc nie. */
function measurable(v: number | null | undefined): boolean {
  return typeof v === "number" && v >= PRECIP_MM_MIN;
}

/**
 * Rodzaj opadu z pomiarów. Śnieg ma pierwszeństwo (jest najbardziej rozstrzygający dla ubioru),
 * potem przelotny, a `precipitation` bez rozbicia na rodzaje lądujemy jako deszcz.
 */
export function precipKind(o: ObservedConditions): PrecipKind {
  if (measurable(o.snowfall)) return "snow";
  if (measurable(o.showers)) return "showers";
  if (measurable(o.rain) || measurable(o.precip)) return "rain";
  return "none";
}

/** Ile w sumie spadło — do pokazania użytkownikowi „ile pada" (AC-A4). */
export function precipAmount(o: ObservedConditions): number | null {
  if (typeof o.precip === "number") return o.precip;
  const parts = [o.rain, o.showers].filter((v): v is number => typeof v === "number");
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

/**
 * Kod WMO o właściwym natężeniu dla danego rodzaju opadu.
 *
 * Natężenie liczymy z sumy w mm (dla śniegu jest to ekwiwalent wodny z pola `precipitation`, bo samo
 * `snowfall` dostawca podaje w centymetrach). Ziarnistość „słaby/umiarkowany/silny" w zupełności
 * wystarcza ikonie — dokładną wartość i tak pokazujemy obok liczbowo.
 */
function codeForPrecip(kind: Exclude<PrecipKind, "none">, mm: number): number {
  const step = mm >= PRECIP_MM_HEAVY ? 2 : mm >= PRECIP_MM_MODERATE ? 1 : 0;
  if (kind === "snow") return 71 + step * 2; // 71 / 73 / 75
  if (kind === "showers") return 80 + step; // 80 / 81 / 82
  return 61 + step * 2; // 61 / 63 / 65
}

/**
 * 044: opis warunków liczony z PEŁNYCH parametrów, nie z samego kodu dostawcy.
 *
 * Zgłoszenie właściciela brzmiało: „mam deszcz, a moduł pokazuje chmurkę i 82%". Przyczyna była
 * podwójna — kafel nie pobierał danych o opadzie (patrz `CurrentPoint`), a syntetyczny `weather_code`
 * modelu potrafi zostać na „pochmurno", gdy ten sam model raportuje już opad.
 *
 * Korekta jest CELOWO wąska, żeby nie zamienić jednego kłamstwa na drugie:
 *  - `code >= 51` (mżawka, deszcz, śnieg, przelotne, burza) zostawiamy w spokoju — dostawca wie
 *    lepiej niż my, jaki to rodzaj opadu, a nadpisywanie burzy „deszczem" gubiłoby ostrzeżenie;
 *  - `code <= 48` (bezchmurnie / zachmurzenie / mgła) przy zmierzonym opadzie ≥ progu podmieniamy
 *    na kod opadowy — to jest dokładnie ta sytuacja ze zgłoszenia;
 *  - brak danych o opadzie (`null`) → zachowanie identyczne jak przed 044 (AC-A7).
 *
 * Wynik zawsze przechodzi przez `wmo()`, więc etykieta, emoji i token koloru powstają nadal
 * w jednym miejscu.
 */
export function observedWmo(o: ObservedConditions): WmoMeta {
  const isNight = o.isDay === false;
  if (o.code > 48) return wmo(o.code, isNight);

  const kind = precipKind(o);
  if (kind === "none") return wmo(o.code, isNight);

  const mm = precipAmount(o) ?? PRECIP_MM_MIN;
  return wmo(codeForPrecip(kind, mm), isNight);
}

export async function geocode(name: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=1&language=pl&format=json`;
    const res = await resilientFetch(url, { cache: "no-store", timeoutMs: 10_000 });
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

/**
 * 037: geokodowanie ODWROTNE — nazwa miejsca dla punktu wskazanego na mapie.
 *
 * Open-Meteo geokoduje tylko „nazwa → współrzędne", więc do drogi powrotnej używamy Nominatim (OSM),
 * tego samego źródła, z którego pochodzą kafelki mapy. `zoom=10` celuje w poziom miejscowości/gminy —
 * dokładniejszy zwracałby numery domów, ogólniejszy samo województwo.
 *
 * `User-Agent` jest wymagany regulaminem Nominatim (zapytania bez niego są odrzucane). Wołamy to
 * WYŁĄCZNIE przy zapisie lokalizacji, nie przy renderze — jedno zapytanie na świadomą akcję
 * użytkownika mieści się w limitach usługi.
 *
 * Zwraca `null` przy dowolnym niepowodzeniu — brak nazwy nie może zablokować zapisu punktu.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=pl` +
      `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const res = await resilientFetch(url, {
      cache: "no-store",
      timeoutMs: 8_000,
      headers: { "User-Agent": "Omnia/1.0 (worldofmag)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name?: string;
      address?: Record<string, string>;
      display_name?: string;
    };
    const a = data.address ?? {};
    // Od najbardziej konkretnego do najogólniejszego — mała wieś ma `village`, miasto `city`.
    const place = a.village ?? a.hamlet ?? a.town ?? a.city ?? a.municipality ?? data.name ?? null;
    const region = a.state ?? a.county ?? null;
    if (place && region) return `${place}, ${region}`;
    if (place) return place;
    // Ostatnia deska ratunku: pierwszy człon pełnej nazwy (Nominatim zwraca ją „od szczegółu").
    const first = data.display_name?.split(",")[0]?.trim();
    return first || null;
  } catch {
    return null;
  }
}

/** Liczba z odpowiedzi API albo `null`. Odsiewa `undefined`, `null` i `NaN` jednym sitem. */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ─── Degradacja: ostatnia udana prognoza ───────────────────────────────────
//
// Zgłoszenie właściciela (2026-09): „serwis Open-Meteo chwilowo nie odpowiada" — moduł pokazywał
// błąd i PUSTY ekran, choć chwilę wcześniej miał kompletną prognozę. Open-Meteo bywa niedostępne
// per adres IP (limity darmowego tieru liczone na współdzielone IP hostingu), więc awaria potrafi
// trwać minuty i nie zależy od nas. Prognoza sprzed godziny jest wtedy nieporównanie lepsza niż
// brak prognozy — trzymamy więc ostatnią udaną odpowiedź w pamięci procesu i przy awarii oddajemy
// ją OZNACZONĄ jako nieaktualną. Pamięć procesu wystarcza: to degradacja, nie poprawność — po
// restarcie instancji po prostu wraca dawne zachowanie (komunikat błędu).

/** Jak stara może być prognoza łatająca awarię. 6 h — dalej opis dnia wciąż jest prawdziwy. */
const PAMIEC_PROGNOZ_MAX_MS = 6 * 60 * 60 * 1000;
/** Sufit wpisów — lokalizacji jest niewiele, ale mapa nie może rosnąć bez końca. */
const PAMIEC_PROGNOZ_SUFIT = 100;

const pamiecPrognoz = new Map<string, { f: Forecast; at: number }>();

const kluczPrognozy = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

/** Wyłącznie do testów: czyści pamięć ostatnich prognoz. */
export function wyczyscPamiecPrognoz(): void {
  pamiecPrognoz.clear();
}

function zapamietajPrognoze(lat: number, lon: number, f: Forecast): void {
  const key = kluczPrognozy(lat, lon);
  if (!pamiecPrognoz.has(key) && pamiecPrognoz.size >= PAMIEC_PROGNOZ_SUFIT) {
    // Map trzyma kolejność wstawień — pierwszy klucz to najstarszy wpis.
    const najstarszy = pamiecPrognoz.keys().next().value;
    if (najstarszy !== undefined) pamiecPrognoz.delete(najstarszy);
  }
  pamiecPrognoz.set(key, { f, at: Date.now() });
}

function prognozaZPamieci(lat: number, lon: number): Forecast | null {
  const wpis = pamiecPrognoz.get(kluczPrognozy(lat, lon));
  if (!wpis || Date.now() - wpis.at > PAMIEC_PROGNOZ_MAX_MS) return null;
  return { ...wpis.f, stale: true };
}

/** Wstrzykiwane atrapy do testów — logika degradacji musi być sprawdzalna bez sieci i timerów. */
export interface FetchForecastOpts {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export async function fetchForecast(
  lat: number,
  lon: number,
  testOpts?: FetchForecastOpts
): Promise<Forecast | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      // 044: `precipitation,rain,showers,snowfall` — bez nich kafel „Teraz" nie miał z czego poznać
      // deszczu i wisiał na samym `weather_code`. To ten sam blok `current`, więc zero dodatkowego
      // ruchu sieciowego.
      current:
        "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day," +
        "precipitation,rain,showers,snowfall",
      hourly:
        "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,is_day",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max",
      timezone: "auto",
      forecast_days: "7",
      wind_speed_unit: "kmh",
    });
    const res = await resilientFetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      cache: "no-store",
      timeoutMs: 12_000,
      ...testOpts,
    });
    if (!res.ok) {
      // Status w logu jest jedyną szansą odróżnienia limitu (429) od awarii (5xx) — bez niego
      // każda niedostępność Open-Meteo wygląda identycznie i nie da się jej zdiagnozować.
      logEvent("warn", "integration.http", { url: "open-meteo.forecast", status: res.status });
      return prognozaZPamieci(lat, lon);
    }
    const d = (await res.json()) as any;

    const hourly: HourPoint[] = (d.hourly?.time ?? []).map((t: string, i: number) => ({
      time: t,
      isDay: d.hourly.is_day?.[i] !== 0,
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

    const forecast: Forecast = {
      latitude: d.latitude,
      longitude: d.longitude,
      timezone: d.timezone ?? "auto",
      fetchedAt: new Date().toISOString(),
      current: d.current
        ? {
            time: typeof d.current.time === "string" ? d.current.time : "",
            temp: d.current.temperature_2m,
            apparent: d.current.apparent_temperature,
            code: d.current.weather_code,
            windKph: d.current.wind_speed_10m,
            isDay: d.current.is_day === 1,
            // 044: `?? null` celowo zamiast `?? 0` — brak pola ma znaczyć „nie wiem", bo zero
            // wyłączałoby korektę ikony tak samo jak zmierzona susza (AC-A7).
            precip: num(d.current.precipitation),
            rain: num(d.current.rain),
            showers: num(d.current.showers),
            snowfall: num(d.current.snowfall),
          }
        : null,
      hourly,
      daily,
    };
    zapamietajPrognoze(lat, lon, forecast);
    return forecast;
  } catch (e) {
    logEvent("warn", "integration.failed", { url: "open-meteo.forecast", error: e });
    return prognozaZPamieci(lat, lon);
  }
}
