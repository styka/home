/**
 * 080 (Z12): reguły lektora, które muszą dać się sprawdzić testem.
 *
 * Mieszkają tutaj, a nie w `actions/assistantPrefs.ts`, bo pomocnik zamknięty w pliku
 * `"use server"` jest z definicji niesprawdzalny — taki plik nie eksportuje funkcji
 * synchronicznych, więc nie da się go zaimportować do testu (bramka `check:domain`).
 */

/** Zakres prędkości lektora. Poza nim mowa albo bełkocze, albo usypia — nie ma po co go poszerzać. */
export const READER_RATE_MIN = 0.5;
export const READER_RATE_MAX = 2;
/** Domyślna prędkość = tyle, ile było zaszyte w `lib/tts` przed 080. Kto nic nie ustawi, nie usłyszy zmiany. */
export const READER_RATE_DEFAULT = 0.95;

/**
 * Prędkość spoza zakresu ZAOKRĄGLAMY do brzegu, nie odrzucamy błędem. To wartość z suwaka —
 * jedyną drogą, żeby przyszła zła, jest ręcznie spreparowane żądanie, a wtedy sensowną odpowiedzią
 * jest najbliższa dozwolona prędkość, nie wyjątek u użytkownika, który nic złego nie zrobił.
 */
export function parseReaderRate(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return READER_RATE_DEFAULT;
  return Math.min(READER_RATE_MAX, Math.max(READER_RATE_MIN, Math.round(value * 100) / 100));
}
