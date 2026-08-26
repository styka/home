/**
 * 106 — REGUŁA „nie częściej niż raz dziennie", jako czysta funkcja.
 *
 * Mapa `{ "<klucz promptu>": "YYYY-MM-DD" }` trzymana jako tekst w `UserMenuPref.promptyPokazane`.
 * Data jest DATĄ w strefie użytkownika, nie znacznikiem czasu: reguła brzmi „raz dziennie", a nie
 * „co 24 godziny" — arytmetyka na znacznikach przesuwałaby okienko z dnia na dzień i po tygodniu
 * wypadała w środku nocy.
 *
 * Kod mieszka poza plikiem akcji, bo plik `"use server"` nie eksportuje funkcji synchronicznych,
 * więc reguły w nim zapisanej nie da się zaimportować do testu (bramka `check:domain`).
 */

/** Odczyt mapy. Uszkodzony wpis traktujemy jak pustą mapę — najwyżej dialog pokaże się raz za dużo. */
export function czytajPokazane(surowe: string | null | undefined): Record<string, string> {
  if (!surowe) return {};
  try {
    const v = JSON.parse(surowe) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const wynik: Record<string, string> = {};
    for (const [k, w] of Object.entries(v as Record<string, unknown>)) {
      // Pojedyncza wartość niebędąca datą nie może unieważnić całej mapy — pomijamy tylko ją.
      if (typeof w === "string") wynik[k] = w;
    }
    return wynik;
  } catch {
    return {};
  }
}

/** Czy ten prompt był już dziś pokazany. */
export function czyPokazanoDzisiaj(surowe: string | null | undefined, klucz: string, dzisiaj: string): boolean {
  return czytajPokazane(surowe)[klucz] === dzisiaj;
}

/** Mapa po odnotowaniu pokazu, gotowa do zapisania. Zwraca TEKST, bo taki jest kształt kolumny. */
export function zapiszPokazane(surowe: string | null | undefined, klucz: string, dzisiaj: string): string {
  return JSON.stringify({ ...czytajPokazane(surowe), [klucz]: dzisiaj });
}
