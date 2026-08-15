/**
 * 069 (zadanie 19, rozdz. 10.1) — GRANICE OKRESU ROZLICZENIOWEGO.
 *
 * Wyprowadzone z `actions/portfelBudgets.ts` i `actions/portfelReports.ts`. Dwie reguły, które
 * decydują, **które wpisy wchodzą do budżetu i do raportu miesięcznego** — a więc czy wydatek
 * z 1 stycznia obciąży styczeń, czy grudzień.
 *
 * **Zmiana kształtu wymuszona testowalnością (AC-8):** `monthRange` czytała zegar sama
 * (`const now = new Date()` w ciele). Teraz przyjmuje „teraz" parametrem z wartością domyślną
 * `new Date()`, więc **wywołanie w akcji jest znakowo identyczne**, a test może podać przełom roku
 * zamiast czekać na grudzień.
 */

/** Północ pierwszego dnia miesiąca, w strefie lokalnej — tak samo jak liczą to daty wpisów. */
export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Przedział `[start, end)` miesiąca cofniętego o `offset` (0 = bieżący, 1 = poprzedni, …).
 *
 * Przedział jest **domknięty z lewej, otwarty z prawej** i to jest istotne: `end` to północ
 * pierwszego dnia NASTĘPNEGO miesiąca, więc wpis z 31 stycznia 23:59 wpada do stycznia, a wpis
 * z 1 lutego 00:00 — do lutego. Gdyby `end` wskazywał ostatni dzień miesiąca, ostatnia doba
 * wypadłaby z rozliczenia.
 *
 * Ujemne `offset` sięga w przyszłość — `Date` sam normalizuje numer miesiąca poza zakresem 0–11,
 * więc przełom roku działa w obie strony bez osobnej gałęzi.
 */
export function monthRange(offset: number, teraz = new Date()): { start: Date; end: Date } {
  const start = new Date(teraz.getFullYear(), teraz.getMonth() - offset, 1, 0, 0, 0, 0);
  const end = new Date(teraz.getFullYear(), teraz.getMonth() - offset + 1, 1, 0, 0, 0, 0);
  return { start, end };
}
