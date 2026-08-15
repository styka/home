import { test } from "node:test";
import assert from "node:assert/strict";
import { normCurrency } from "../waluta";

test("wielkość liter i białe znaki nie tworzą osobnej waluty", () => {
  assert.equal(normCurrency("pln"), "PLN");
  assert.equal(normCurrency("  eur "), "EUR");
  assert.equal(normCurrency("PLN"), "PLN");
});

test("wynik jest stabilny — ponowne znormalizowanie nic nie zmienia", () => {
  assert.equal(normCurrency(normCurrency(" usd ")), "USD");
});

test("kod dłuższy niż 8 znaków jest przycinany", () => {
  assert.equal(normCurrency("BARDZODLUGAWALUTA"), "BARDZODL");
});

test("pusty kod pozostaje pusty — wywołujący sam decyduje, co z tym zrobić", () => {
  // Akcja `setBaseCurrency` traktuje pusty wynik jako błąd („Podaj walutę"). Reguła nie rzuca
  // wyjątkiem, bo komunikat dla użytkownika należy do warstwy wyżej.
  assert.equal(normCurrency(""), "");
  assert.equal(normCurrency("   "), "");
});
