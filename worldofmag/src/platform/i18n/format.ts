import { JEZYK_DOMYSLNY, STREFA_DOMYSLNA } from "./jezyki";

/**
 * 089 (zadanie 37, Faza 7) — FORMATOWANIE PRZEZ `Intl`.
 *
 * Rozdz. 12.1 wymienia „formatowanie dat, liczb i walut przez `Intl`" jako osobną pozycję zakresu,
 * obok wyciągnięcia tekstów — i słusznie, bo to inny rodzaj długu. Tekst po polsku w komponencie
 * widać na pierwszy rzut oka; `toLocaleString("pl-PL")` **wygląda poprawnie** i jest równie twardo
 * zaszyty. Zaszyta jest w nim też strefa czasowa: bez `timeZone` przeglądarka formatuje datę
 * w strefie systemu, więc ten sam wpis kalendarza zespołu pokazuje inną godzinę osobie za granicą.
 *
 * Funkcje przyjmują ustawienia **parametrem**, a nie czytają ich z kontekstu. Powód jest ten sam,
 * dla którego platforma nie zna modułów: helper formatujący, który sam sięga po sesję, nie da się
 * użyć ani w zadaniu w tle, ani przy treści cudzej przestrzeni, ani w teście.
 */
export type UstawieniaFormatu = { locale: string; timezone: string };

export const FORMAT_DOMYSLNY: UstawieniaFormatu = { locale: JEZYK_DOMYSLNY, timezone: STREFA_DOMYSLNA };

/**
 * `Intl.*Format` jest kosztowny w tworzeniu i tani w użyciu, a formatujemy w listach — po jednym
 * wywołaniu na wiersz. Cache jest ograniczony liczbą kombinacji (język × strefa × opcje), więc
 * nie rośnie z ruchem.
 */
const cacheDat = new Map<string, Intl.DateTimeFormat>();
const cacheLiczb = new Map<string, Intl.NumberFormat>();

function formatDaty(u: UstawieniaFormatu, opcje: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const klucz = `${u.locale}|${u.timezone}|${JSON.stringify(opcje)}`;
  let f = cacheDat.get(klucz);
  if (!f) {
    f = new Intl.DateTimeFormat(u.locale, { timeZone: u.timezone, ...opcje });
    cacheDat.set(klucz, f);
  }
  return f;
}

function formatLiczby(locale: string, opcje: Intl.NumberFormatOptions): Intl.NumberFormat {
  const klucz = `${locale}|${JSON.stringify(opcje)}`;
  let f = cacheLiczb.get(klucz);
  if (!f) {
    f = new Intl.NumberFormat(locale, opcje);
    cacheLiczb.set(klucz, f);
  }
  return f;
}

/** Data bez godziny — „19 sie 2026". */
export function formatujDate(d: Date, u: UstawieniaFormatu = FORMAT_DOMYSLNY): string {
  return formatDaty(u, { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

/** Data z godziną. */
export function formatujDateGodzine(d: Date, u: UstawieniaFormatu = FORMAT_DOMYSLNY): string {
  return formatDaty(u, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Sama godzina — do agendy i kalendarza. */
export function formatujGodzine(d: Date, u: UstawieniaFormatu = FORMAT_DOMYSLNY): string {
  return formatDaty(u, { hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatujLiczbe(n: number, u: UstawieniaFormatu = FORMAT_DOMYSLNY, ulamki = 0): string {
  return formatLiczby(u.locale, { minimumFractionDigits: ulamki, maximumFractionDigits: ulamki }).format(n);
}

/**
 * Kwota z walutą. Waluta jest **parametrem**, nie pochodną języka: w tej samej polskiej przestrzeni
 * trzyma się i złotówki, i euro (Portfel obsługuje wiele walut), więc wyprowadzanie waluty z języka
 * dawałoby złe kwoty przy poprawnym formacie — najgorszy możliwy rodzaj błędu.
 */
export function formatujKwote(n: number, waluta: string, u: UstawieniaFormatu = FORMAT_DOMYSLNY): string {
  return formatLiczby(u.locale, { style: "currency", currency: waluta }).format(n);
}

/**
 * Granice dnia w strefie PRZESTRZENI — do pytań „co jest na dziś" i „co jest po terminie".
 *
 * Liczone przez `Intl`, nie przez arytmetykę na `Date`: przesunięcie strefy zmienia się dwa razy
 * w roku, a `new Date(y, m, d)` używa strefy SERWERA, która na Renderze jest UTC. W praktyce
 * znaczyłoby to, że między północą a drugą w nocy polska „dzisiaj" to serwerowe „wczoraj".
 */
export function granicaDnia(teraz: Date, timezone: string = STREFA_DOMYSLNA): { start: Date; koniec: Date } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dzien = f.format(teraz); // YYYY-MM-DD w strefie przestrzeni
  const start = new Date(`${dzien}T00:00:00${przesuniecie(teraz, timezone)}`);
  return { start, koniec: new Date(start.getTime() + 86_400_000) };
}

/** Przesunięcie strefy w chwili `d`, w formacie `+02:00` — czytane z `Intl`, nie z tabeli. */
function przesuniecie(d: Date, timezone: string): string {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" });
  const czesc = f.formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const znaleziony = czesc.replace("GMT", "");
  return znaleziony === "" ? "+00:00" : znaleziony;
}
