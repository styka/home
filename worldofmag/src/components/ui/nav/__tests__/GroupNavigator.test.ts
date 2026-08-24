import { test } from "node:test";
import assert from "node:assert/strict";
import { sasiadujacaGrupa } from "../GroupNavigator";

/**
 * 083/084 — reguła KROKU we wspólnym nawigatorze grup. Została jedna czysta funkcja: 084 skasowało
 * pozycję zbiorczą razem z `pozycjeNawigatora`, bo po zmianie znaczenia listy (SKOK, nie filtr)
 * nikt jej nie używał. `sasiadujacaGrupa` przetrwała, bo używa jej gest w bok w Wiadomościach.
 */

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
