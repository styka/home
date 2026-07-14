import { cookies } from "next/headers";

// Strefa czasowa użytkownika i granice doby liczone w TEJ strefie, ale zwracane
// jako instanty UTC (Date) — tak, by porównania w Prismie (DateTime w UTC) były
// zgodne z tym, co użytkownik uważa za „dziś". Bez tego widok „Dziś" liczył dobę
// w strefie serwera (Render = UTC), przez co zadanie przesunięte o jeden dzień
// potrafiło wpaść w UTC-owe „dziś".

const DEFAULT_TZ = "Europe/Warsaw";

/** IANA timezone bieżącego użytkownika z ciasteczka `tz` (ustawianego po stronie
 * klienta). Fallback: Europe/Warsaw (główny użytkownik aplikacji). */
export function userTimeZone(): string {
  try {
    const tz = cookies().get("tz")?.value;
    if (tz && /^[A-Za-z0-9_+\-/]+$/.test(tz)) return tz;
  } catch {
    // cookies() wywołane poza kontekstem requestu — użyj domyślnej strefy.
  }
  return DEFAULT_TZ;
}

/** Offset (ms) między czasem ściennym danej strefy a UTC dla danego instantu.
 * Dodatni na wschód od UTC (np. +2h dla Europe/Warsaw latem). */
function tzOffsetMs(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const hour = p.hour === 24 ? 0 : p.hour; // niektóre środowiska zwracają "24"
  // formatToParts nie zwraca milisekund, a offsety stref to pełne minuty — dolicz
  // ms instantu, inaczej offset gubi ułamek sekundy i np. koniec doby (…:59.999)
  // wychodził o ~1 s za późno (00:00:00.998 następnego dnia).
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, hour, p.minute, p.second, at.getUTCMilliseconds());
  return asUTC - at.getTime();
}

/** Instant UTC odpowiadający zegarowi ściennemu (y, mIndex, d, H, M, S, ms) w strefie tz. */
function zonedWallToUtc(
  tz: string, y: number, mIndex: number, d: number,
  H: number, M: number, S: number, ms: number,
): Date {
  const guess = Date.UTC(y, mIndex, d, H, M, S, ms);
  // Jedna korekta offsetu wystarcza poza godzinną „dziurą" DST (północ nigdy w nią
  // nie wpada w praktycznych strefach), więc granice doby są wyznaczane poprawnie.
  const offset = tzOffsetMs(tz, new Date(guess));
  return new Date(guess - offset);
}

/** Lokalna data użytkownika (rok / miesiąc 1–12 / dzień) dla danego instantu. */
function localYMD(tz: string, at: Date): { y: number; m: number; d: number } {
  const local = new Date(at.getTime() + tzOffsetMs(tz, at));
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() };
}

/** Granice „dziś" w strefie użytkownika jako instanty UTC: [północ, 23:59:59.999]. */
export function userDayBounds(
  tz: string = userTimeZone(),
  base: Date = new Date(),
): { start: Date; end: Date } {
  const { y, m, d } = localYMD(tz, base);
  return {
    start: zonedWallToUtc(tz, y, m - 1, d, 0, 0, 0, 0),
    end: zonedWallToUtc(tz, y, m - 1, d, 23, 59, 59, 999),
  };
}

/** Początek jutra (instant UTC) w strefie użytkownika — granica „nadchodzących". */
export function userTomorrowStart(
  tz: string = userTimeZone(),
  base: Date = new Date(),
): Date {
  return new Date(userDayBounds(tz, base).end.getTime() + 1);
}
