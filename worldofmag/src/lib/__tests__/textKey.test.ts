import { test } from "node:test"
import assert from "node:assert/strict"
import { fingerprintOf } from "@/lib/textKey"
import { fingerprintOf as fingerprintFromIdeas } from "@/modules/weather/lib/ideas"

// 039: odcisk jest kluczem naturalnym w bazie (`WeatherIdea.fingerprint`, odrzucone gorące tematy,
// fakty o użytkowniku). Zmiana jego wyniku po cichu odkleja zapisane wiersze od nowych tytułów —
// użytkownik zobaczyłby drugi raz coś, co już zablokował. Stąd testy na konkretnych wartościach.

test("znosi wielkość liter, interpunkcję i wielokrotne spacje", () => {
  assert.equal(fingerprintOf("Wycieczka rowerowa"), "wycieczka-rowerowa")
  assert.equal(fingerprintOf("  Wycieczka   rowerowa!  "), "wycieczka-rowerowa")
  assert.equal(fingerprintOf("WYCIECZKA, ROWEROWA."), "wycieczka-rowerowa")
})

test("polskie znaki diakrytyczne sprowadza do liter bazowych", () => {
  assert.equal(fingerprintOf("Spacer nad Wisłą"), "spacer-nad-wisla")
  assert.equal(fingerprintOf("Zażółć gęślą jaźń"), "zazolc-gesla-jazn")
  // `ł`/`Ł` nie rozkłada się przez NFD — osobna ścieżka w implementacji, więc osobne sprawdzenie.
  assert.equal(fingerprintOf("ŁÓDŹ"), "lodz")
})

test("różne zapisy tego samego tytułu dają ten sam odcisk", () => {
  assert.equal(fingerprintOf("Kino — seans wieczorny"), fingerprintOf("kino seans wieczorny"))
  assert.equal(fingerprintOf("Muzeum Śląskie"), fingerprintOf("muzeum slaskie"))
})

test("różne tytuły dają różne odciski (bez dopasowania rozmytego)", () => {
  assert.notEqual(fingerprintOf("Wycieczka rowerowa"), fingerprintOf("Wycieczka rowerowa doliną"))
})

test("tytuł bez liter i cyfr daje pusty odcisk", () => {
  assert.equal(fingerprintOf("!!! ??? ..."), "")
  assert.equal(fingerprintOf(""), "")
})

test("odcisk jest przycięty do 120 znaków", () => {
  const long = fingerprintOf("a".repeat(200))
  assert.equal(long.length, 120)
})

test("re-eksport z modułu Pogoda wskazuje na tę samą funkcję", () => {
  assert.equal(fingerprintFromIdeas, fingerprintOf)
})
