import { test } from "node:test";
import assert from "node:assert/strict";
import { speciesEmoji, speciesLabel, formatWeight, formatDate, ageFromBirth } from "@/lib/petSpecies";

test("speciesEmoji/Label: znane gatunki + fallback dla nieznanego", () => {
  assert.equal(speciesEmoji("dog"), "🐶");
  assert.equal(speciesEmoji("snake"), "🐍");
  assert.equal(speciesEmoji("nieistniejący"), "🐾");
  assert.equal(speciesLabel("cat"), "Kot");
  assert.equal(speciesLabel("rabbit"), "Królik");
  assert.equal(speciesLabel("xyz"), "Inne");
});

test("formatWeight: granica g/kg i formatowanie ułamków", () => {
  assert.equal(formatWeight(null), "—");
  assert.equal(formatWeight(undefined), "—");
  assert.equal(formatWeight(0), "0 g");
  assert.equal(formatWeight(500), "500 g");
  assert.equal(formatWeight(999), "999 g");
  assert.equal(formatWeight(1000), "1 kg"); // pełne kg bez miejsc po przecinku
  assert.equal(formatWeight(2000), "2 kg");
  assert.equal(formatWeight(1500), "1.50 kg"); // niepełne → 2 miejsca
  assert.equal(formatWeight(2750), "2.75 kg");
});

test("formatDate: null → '—', data → dd.mm.yyyy", () => {
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate(undefined), "—");
  assert.match(formatDate(new Date(2024, 2, 5)), /^\d{2}\.\d{2}\.\d{4}$/);
  assert.equal(formatDate("2024-03-05"), formatDate(new Date("2024-03-05")));
});

test("ageFromBirth: null/przyszłość → null, pełne lata z poprawnym pluralem", () => {
  assert.equal(ageFromBirth(null), null);
  // Dzień ≤28 i ten sam miesiąc co teraz → dokładnie N lat, 0 mies. (odporne na
  // przewijanie miesiąca i 29 lutego, niezależnie od dzisiejszej daty).
  const now = new Date();
  const yearsAgo = (n: number) => new Date(now.getFullYear() - n, now.getMonth(), Math.min(now.getDate(), 28));
  assert.equal(ageFromBirth(yearsAgo(-1)), null, "data z przyszłości → null");
  assert.equal(ageFromBirth(yearsAgo(1)), "1 rok");
  assert.equal(ageFromBirth(yearsAgo(2)), "2 lata");
  assert.equal(ageFromBirth(yearsAgo(5)), "5 lat");
});
