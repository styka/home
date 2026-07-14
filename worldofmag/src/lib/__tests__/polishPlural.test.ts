import { test } from "node:test";
import assert from "node:assert/strict";
import { polishPlural } from "@/lib/polishPlural";

// Testy czystej logiki pluralizacji PL (one/few/many + wyjątek „nastek" 11–14).
const F: [string, string, string] = ["plik", "pliki", "plików"];

test("polishPlural: one (n === 1) i abs(-1)", () => {
  assert.equal(polishPlural(1, F), "plik");
  assert.equal(polishPlural(-1, F), "plik");
});

test("polishPlural: few = końcówka 2–4 poza nastkami", () => {
  for (const n of [2, 3, 4, 22, 23, 24, 102, 103, 104, 1002]) {
    assert.equal(polishPlural(n, F), "pliki", `n=${n} → few`);
  }
});

test("polishPlural: many = 0, 5–21 i wyjątek nastek 11–14/111–114", () => {
  for (const n of [0, 5, 6, 9, 10, 11, 12, 13, 14, 15, 20, 21, 25, 100, 111, 112, 113, 114]) {
    assert.equal(polishPlural(n, F), "plików", `n=${n} → many`);
  }
});

test("polishPlural: nastki biorą górę nad końcówką 2–4 (12,13,14 → many)", () => {
  assert.equal(polishPlural(12, F), "plików");
  assert.equal(polishPlural(13, F), "plików");
  assert.equal(polishPlural(112, F), "plików");
});

test("polishPlural: liczby ujemne traktowane przez wartość bezwzględną", () => {
  assert.equal(polishPlural(-2, F), "pliki");
  assert.equal(polishPlural(-14, F), "plików");
  assert.equal(polishPlural(-22, F), "pliki");
});
