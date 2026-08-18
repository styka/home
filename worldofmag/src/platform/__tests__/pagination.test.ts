import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DOMYSLNY_ROZMIAR,
  MAKS_ROZMIAR,
  SUFIT_LISTY,
  rozmiarStrony,
  stronaZWierszy,
  zapytanieKursorowe,
} from "../pagination";

/**
 * 068 → 095 — PAGINACJA: przypadki, w których łatwo zgubić wiersz albo pokazać go dwa razy.
 *
 * Trzy rzeczy, z których każda psuje się cicho:
 * 1. **granica strony** — „pełna strona" i „koniec danych" wyglądają tak samo, jeśli nie pobierze
 *    się o jeden wiersz więcej;
 * 2. **`skip: 1`** — bez tego pierwszy wiersz kolejnej strony to duplikat ostatniego z poprzedniej;
 * 3. **górna granica** — bez niej `?limit=100000` omija całą paginację jednym parametrem w URL.
 *
 * **095:** ten plik pokrywa teraz JEDEN helper. Do 095 tę samą ideę niosły dwa (`lib/pagination.ts`
 * z jednym konsumentem i `platform/pagination.ts` z zerem), każdy z własnym zestawem testów —
 * czyli dwa zielone zestawy dowodzące, że dwie różne implementacje działają, i żadnego dowodu, że
 * aplikacja paginuje jednakowo.
 */

const wiersze = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }));

test("068: pełna strona BEZ nadmiaru to koniec danych, nie kolejna strona", () => {
  // Najczęstszy błąd: `wiersze.length === rozmiar` uznane za „jest więcej". Użytkownik dostaje
  // przycisk „doładuj", który nic nie dokłada.
  const s = stronaZWierszy(wiersze(50), 50);
  assert.equal(s.pozycje.length, 50);
  assert.equal(s.nastepnyKursor, null);
  assert.equal(s.jestWiecej, false);
});

test("068: jeden wiersz nadmiaru znaczy jest-wiecej i NIE trafia do wyniku", () => {
  const s = stronaZWierszy(wiersze(51), 50);
  assert.equal(s.pozycje.length, 50, "wiersz-zwiadowca nie może pokazać się użytkownikowi");
  assert.equal(s.nastepnyKursor, "id-49", "kursorem jest OSTATNI pokazany, nie zwiadowca");
  assert.equal(s.jestWiecej, true);
});

test("068: kursor pomija sam siebie, a zapytanie pobiera o jeden więcej", () => {
  // Bez `skip: 1` Prisma zwraca wiersz kursora jako pierwszy element kolejnej strony.
  assert.deepEqual(zapytanieKursorowe({ kursor: "id-49", rozmiar: 50 }), {
    take: 51,
    cursor: { id: "id-49" },
    skip: 1,
  });
  assert.deepEqual(zapytanieKursorowe({ kursor: null, rozmiar: 50 }), { take: 51 });
  assert.deepEqual(zapytanieKursorowe({}), { take: DOMYSLNY_ROZMIAR + 1 });
});

test("068: rozmiar strony ma sufit, którego nie da się przeskoczyć z URL-a", () => {
  assert.equal(rozmiarStrony(undefined), DOMYSLNY_ROZMIAR);
  assert.equal(rozmiarStrony(0), DOMYSLNY_ROZMIAR, "zero to brak wartości, nie pusta strona");
  // 095, scalenie dwóch helperów: `clampLimit(-5)` dawało 1, czyli stronę jednoelementową
  // w odpowiedzi na bezsensowne wejście. Scalony kontrakt traktuje wartość ≤ 0 tak samo jak brak
  // wartości. Różnica jest tu zapisana, bo scalenie dwóch API bez wskazania, które zachowanie
  // wygrało, jest zmianą po cichu.
  assert.equal(rozmiarStrony(-5), DOMYSLNY_ROZMIAR);
  assert.equal(rozmiarStrony(10), 10);
  assert.equal(rozmiarStrony(100000), MAKS_ROZMIAR, "sufit jest po to, żeby paginacji nie dało się ominąć");
  assert.equal(rozmiarStrony(10.9), 10, "ułamek obcinamy, nie zaokrąglamy w górę");
  assert.equal(rozmiarStrony(NaN), DOMYSLNY_ROZMIAR);
});

test("068: pusty wynik to koniec, nie błąd", () => {
  assert.deepEqual(stronaZWierszy([], 50), { pozycje: [], nastepnyKursor: null, jestWiecej: false });
});

test("095: SUFIT_LISTY stoi wysoko nad stroną — to granica, nie paginacja", () => {
  // Gdyby sufit był rzędu rozmiaru strony, „lista z sufitem" zaczęłaby udawać stronę: użytkownik
  // widziałby ucięcie tam, gdzie nie ma przycisku „doładuj".
  assert.ok(SUFIT_LISTY >= MAKS_ROZMIAR * 5, "sufit listy musi być wyraźnie wyższy niż strona");
});
