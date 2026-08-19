import { test } from "node:test";
import assert from "node:assert/strict";

import {
  przytnijPole,
  sprawdzAdresKanalu,
  sprawdzKluczKatalogu,
  normalizujKraj,
  normalizujJezyk,
  normalizujKategorie,
  MAX_TEKST_KATALOGU,
} from "./katalog";

/**
 * 082 — reguły wpisu do systemowej biblioteki źródeł. Wejściem bywa **plik importu**, czyli dane
 * spoza aplikacji, więc każda z tych funkcji musi rozstrzygać, a nie ufać.
 */

test("klucz jest normalizowany do małych liter — „PL-Onet\" i „pl-onet\" to jeden wpis", () => {
  assert.equal(sprawdzKluczKatalogu("PL-Onet"), "pl-onet");
  assert.equal(sprawdzKluczKatalogu("  pl-onet  "), "pl-onet");
});

test("klucz spoza bezpiecznego alfabetu jest odrzucany", () => {
  for (const zly of ["", "a", "pl onet", "pl_onet", "-onet", "źródło", "a".repeat(65)]) {
    assert.throws(() => sprawdzKluczKatalogu(zly), /Klucz/, `powinno paść dla „${zly}"`);
  }
});

test("adres kanału musi być http(s) — inaczej fetchRss milczy zamiast błądzić", () => {
  assert.equal(sprawdzAdresKanalu(" https://example.test/feed "), "https://example.test/feed");
  assert.equal(sprawdzAdresKanalu("HTTP://example.test/feed"), "HTTP://example.test/feed");
  for (const zly of ["", "example.test/feed", "ftp://example.test", "javascript:alert(1)"]) {
    assert.throws(() => sprawdzAdresKanalu(zly), /http/, `powinno paść dla „${zly}"`);
  }
});

test("kategoria spoza słownika staje się „inne\", a nie wyjątkiem", () => {
  assert.equal(normalizujKategorie("technologia"), "technologia");
  assert.equal(normalizujKategorie("Technologia"), "inne");
  assert.equal(normalizujKategorie("cokolwiek"), "inne");
  assert.equal(normalizujKategorie(null), "inne");
});

test("kraj wielkimi, język małymi — filtr porównuje dosłownie", () => {
  assert.equal(normalizujKraj(" pl "), "PL");
  assert.equal(normalizujJezyk(" PL "), "pl");
  assert.equal(normalizujKraj(null), "");
});

test("pole tekstowe jest przycinane, a nie odrzucane", () => {
  assert.equal(przytnijPole("  x  "), "x");
  assert.equal(przytnijPole("a".repeat(500)).length, MAX_TEKST_KATALOGU);
  assert.equal(przytnijPole(undefined), "");
});
