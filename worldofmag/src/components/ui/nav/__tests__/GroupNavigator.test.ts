import { test } from "node:test";
import assert from "node:assert/strict";
import { WSZYSTKIE, pozycjeNawigatora, sasiadujacaGrupa } from "../GroupNavigator";

/**
 * 083 — reguły WYBORU we wspólnym nawigatorze grup. Testujemy dwie czyste funkcje, bo to one
 * decydują o tym, co użytkownik widzi po dotknięciu strzałki i w jakiej kolejności stoi lista.
 * Komponent jest wokół nich cienką warstwą rysowania.
 */

const GRUPY = [
  { id: "a", etykieta: "Alfa" },
  { id: "b", etykieta: "Beta" },
  { id: "c", etykieta: "Gamma" },
];

test("pozycja zbiorcza stoi PIERWSZA", () => {
  const lista = pozycjeNawigatora(GRUPY, "Wszystkie");
  assert.equal(lista[0].id, WSZYSTKIE);
  assert.deepEqual(lista.map((g) => g.id), [WSZYSTKIE, "a", "b", "c"]);
});

test("bez etykiety zbiorczej lista zostaje czysta", () => {
  assert.deepEqual(pozycjeNawigatora(GRUPY).map((g) => g.id), ["a", "b", "c"]);
});

test("lista wejściowa nie jest modyfikowana", () => {
  pozycjeNawigatora(GRUPY, "Wszystkie");
  assert.equal(GRUPY.length, 3);
});

test("sąsiad idzie w przód i w tył", () => {
  assert.equal(sasiadujacaGrupa(["a", "b", "c"], "a", 1), "b");
  assert.equal(sasiadujacaGrupa(["a", "b", "c"], "c", -1), "b");
});

test("na krańcach zwraca null — lista się NIE zapętla", () => {
  assert.equal(sasiadujacaGrupa(["a", "b", "c"], "c", 1), null);
  assert.equal(sasiadujacaGrupa(["a", "b", "c"], "a", -1), null);
});

test("z pustego wyboru krok w przód trafia na pierwszą pozycję", () => {
  assert.equal(sasiadujacaGrupa(["a", "b", "c"], null, 1), "a");
});

test("nieznany identyfikator zachowuje się jak brak wyboru", () => {
  assert.equal(sasiadujacaGrupa(["a", "b", "c"], "zniknal", 1), "a");
  assert.equal(sasiadujacaGrupa(["a", "b", "c"], "zniknal", -1), null);
});

test("pusta lista nie wysypuje kroku", () => {
  assert.equal(sasiadujacaGrupa([], "a", 1), null);
});
