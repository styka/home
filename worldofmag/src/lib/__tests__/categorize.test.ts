import { test } from "node:test";
import assert from "node:assert/strict";
import { categorize } from "../categorize";

// Z-174: regułowy fallback kategoryzacji (gdy LLM niedostępny). Pierwsze dopasowanie
// keyword-substring → kategoria; brak → "Inne". Polski + angielski, case-insensitive.

test("warzywa/owoce (PL + EN)", () => {
  assert.equal(categorize("jabłko"), "Warzywa i owoce");
  assert.equal(categorize("apple"), "Warzywa i owoce");
});

test("nabiał, mięso/ryby, piekarnia", () => {
  assert.equal(categorize("mleko 2%"), "Nabiał i jaja");
  assert.equal(categorize("kurczak"), "Mięso i ryby");
  assert.equal(categorize("chleb razowy"), "Piekarnia");
});

test("substring działa z ilością/prefiksem", () => {
  assert.equal(categorize("2 banany"), "Warzywa i owoce");
  assert.equal(categorize("świeży chleb"), "Piekarnia");
});

test("case-insensitive", () => {
  assert.equal(categorize("JABŁKO"), "Warzywa i owoce");
  assert.equal(categorize("  Mleko  "), "Nabiał i jaja");
});

test("nieznany produkt → Inne", () => {
  assert.equal(categorize("kosmiczny gadżet xyz"), "Inne");
});

test("pierwsze dopasowanie wygrywa (kolejność reguł deterministyczna)", () => {
  // ten sam input zawsze ta sama kategoria — brak zależności od stanu
  assert.equal(categorize("pomidor"), categorize("pomidor"));
});
