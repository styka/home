// 082: układ listy obserwatorów pogody — reguły czyste, bez Prismy, bez Reacta.
//
// Mieszkają osobno od akcji, bo mają DWÓCH konsumentów o różnych wymaganiach: akcja serwerowa
// (zawężenie wartości wczytanej z bazy) i komponent kliencki (sortowanie i grupowanie już
// pobranych werdyktów). Dzięki temu jedno i drugie da się przetestować bez bazy.

import type { WatcherStatus } from "../actions/weather";

/**
 * `status` — jedna lista posortowana po stanie · `grouped` — sekcje po stanie ·
 * `manual` — kolejność dodania (stan sprzed 082). String + union TS (C-12).
 */
export type WatchersLayout = "status" | "grouped" | "manual";

export const WATCHERS_LAYOUTS: WatchersLayout[] = ["status", "grouped", "manual"];

/**
 * Kolejność stanów: od „to, o co pytałeś, się dzieje" do „nie wiadomo".
 *
 * Uwaga na odczytanie: zieleń („spełnione") dla obserwatora ostrzegawczego jest ZŁĄ wiadomością —
 * dlatego etykieta i podpowiedź w interfejsie mówią o SPEŁNIENIU WARUNKU, a nie o urodzie pogody
 * (reguła z 037, której to sortowanie nie wolno podważyć: na górze stoi to, co WYMAGA UWAGI).
 */
export const STATUS_ORDER: WatcherStatus[] = ["met", "partial", "unmet", "unknown"];

const RANGA = new Map(STATUS_ORDER.map((s, i) => [s, i]));

/** Wartość spoza unii → domyślna. Preferencja przychodzi z bazy i może być z innej wersji. */
export function czytajUklad(raw: string | null | undefined): WatchersLayout {
  return WATCHERS_LAYOUTS.includes(raw as WatchersLayout) ? (raw as WatchersLayout) : "status";
}

/**
 * Porządkuje obserwatory wg stanu, zachowując pierwotną kolejność wewnątrz stanu (sortowanie
 * stabilne). Obserwator bez werdyktu — wyłączony albo jeszcze nieoceniony — ląduje na końcu:
 * udawanie, że znamy jego stan, byłoby gorsze niż pokazanie go osobno.
 */
export function poStanie<T>(
  pozycje: T[],
  statusOf: (p: T) => WatcherStatus | null,
): T[] {
  return pozycje
    .map((p, i) => ({ p, i, r: RANGA.get(statusOf(p) ?? ("" as WatcherStatus)) ?? STATUS_ORDER.length }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.p);
}

/** Sekcje w kolejności `STATUS_ORDER`; sekcja pusta nie jest zwracana wcale. */
export function wSekcje<T>(
  pozycje: T[],
  statusOf: (p: T) => WatcherStatus | null,
): { status: WatcherStatus | null; pozycje: T[] }[] {
  const out: { status: WatcherStatus | null; pozycje: T[] }[] = [];
  for (const s of STATUS_ORDER) {
    const grupa = pozycje.filter((p) => statusOf(p) === s);
    if (grupa.length > 0) out.push({ status: s, pozycje: grupa });
  }
  const bezStanu = pozycje.filter((p) => statusOf(p) === null);
  if (bezStanu.length > 0) out.push({ status: null, pozycje: bezStanu });
  return out;
}

