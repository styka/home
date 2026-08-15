import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSlug } from "../slug";

/**
 * Omnia ma DWIE reguły sluga — tę i `modules/kitchen/domain/slug.ts` — i dają różne wyniki.
 * Rozbieżności są udokumentowane niżej **wartościami**, a nie importem tamtej reguły: sięgnięcie
 * po wnętrze cudzego modułu łamie granicę z Fazy 1 (C-36), a ścieżka względna przemknęłaby obok
 * reguły lintu, która pilnuje aliasów `@/modules/*`. Lustrzane przypadki stoją w teście Kuchni.
 */

test("typowy tytuł scenariusza", () => {
  assert.equal(normalizeSlug("Logowanie przez Google"), "logowanie-przez-google");
});

test("polskie znaki schodzą do łacińskich", () => {
  assert.equal(normalizeSlug("Zapis żądania w koszu"), "zapis-zadania-w-koszu");
});

test("wielokrotne myślniki zwijają się do jednego, brzegowe znikają", () => {
  assert.equal(normalizeSlug("  --Import   CSV--  "), "import-csv");
});

test("podkreślenie PRZEŻYWA (w Kuchni schodzi do myślnika)", () => {
  // Scenariusze bywają nazywane jak identyfikatory testów, więc `_` jest tu znakiem znaczącym.
  assert.equal(normalizeSlug("test_logowania"), "test_logowania");
});

test("brak wartości awaryjnej — pusty tytuł daje PUSTY slug (Kuchnia dałaby `przepis`)", () => {
  assert.equal(normalizeSlug("!!!"), "");
  assert.equal(normalizeSlug(""), "");
});

test("brak przycięcia długości (Kuchnia tnie do 80 znaków)", () => {
  assert.equal(normalizeSlug("a".repeat(200)).length, 200);
});

test("wynik jest stabilny — ponowna normalizacja nic nie zmienia", () => {
  const raz = normalizeSlug("Płatności — kwota ujemna");
  assert.equal(normalizeSlug(raz), raz);
});
