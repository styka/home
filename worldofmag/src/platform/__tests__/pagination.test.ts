import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DOMYSLNY_ROZMIAR,
  MAKS_ROZMIAR,
  argumentyKursora,
  rozmiarStrony,
  zbudujStrone,
} from "../pagination";

/**
 * 068 — PAGINACJA: przypadki, w których łatwo zgubić wiersz albo pokazać go dwa razy.
 *
 * Trzy rzeczy, z których każda psuje się cicho:
 * 1. **granica strony** — „pełna strona" i „koniec danych" wyglądają tak samo, jeśli nie pobierze
 *    się o jeden wiersz więcej;
 * 2. **`skip: 1`** — bez tego pierwszy wiersz kolejnej strony to duplikat ostatniego z poprzedniej;
 * 3. **górna granica** — bez niej `?limit=100000` omija całą paginację jednym parametrem w URL.
 */

const wiersze = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }));

test("068: pełna strona BEZ nadmiaru to koniec danych, nie kolejna strona", () => {
  // Najczęstszy błąd: `wiersze.length === rozmiar` uznane za „jest więcej". Użytkownik dostaje
  // przycisk „doładuj", który nic nie dokłada.
  const s = zbudujStrone(wiersze(50), 50);
  assert.equal(s.pozycje.length, 50);
  assert.equal(s.nastepnyKursor, null);
});

test("068: jeden wiersz nadmiaru znaczy jest-wiecej i NIE trafia do wyniku", () => {
  const s = zbudujStrone(wiersze(51), 50);
  assert.equal(s.pozycje.length, 50, "wiersz-zwiadowca nie może pokazać się użytkownikowi");
  assert.equal(s.nastepnyKursor, "id-49", "kursorem jest OSTATNI pokazany, nie zwiadowca");
});

test("068: kursor pomija sam siebie", () => {
  // Bez `skip: 1` Prisma zwraca wiersz kursora jako pierwszy element kolejnej strony.
  assert.deepEqual(argumentyKursora("id-49"), { cursor: { id: "id-49" }, skip: 1 });
  assert.deepEqual(argumentyKursora(null), {});
  assert.deepEqual(argumentyKursora(undefined), {});
});

test("068: rozmiar strony ma sufit, którego nie da się przeskoczyć z URL-a", () => {
  assert.equal(rozmiarStrony(undefined), DOMYSLNY_ROZMIAR);
  assert.equal(rozmiarStrony(0), DOMYSLNY_ROZMIAR, "zero to brak wartości, nie pusta strona");
  assert.equal(rozmiarStrony(-5), DOMYSLNY_ROZMIAR);
  assert.equal(rozmiarStrony(10), 10);
  assert.equal(rozmiarStrony(100000), MAKS_ROZMIAR, "sufit jest po to, żeby paginacji nie dało się ominąć");
  assert.equal(rozmiarStrony(10.9), 10, "ułamek obcinamy, nie zaokrąglamy w górę");
});

test("068: pusty wynik to koniec, nie błąd", () => {
  const s = zbudujStrone([], 50);
  assert.deepEqual(s, { pozycje: [], nastepnyKursor: null });
});
