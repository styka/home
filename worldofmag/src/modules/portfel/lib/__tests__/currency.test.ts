import { test } from "node:test";
import assert from "node:assert/strict";
import { toBase, type RateInfo } from "../currency";

// Z-174: przeliczanie walut na walutę bazową (poprawność finansowa Portfela).
const info: RateInfo = { base: "PLN", rates: { PLN: 1, EUR: 4.3, USD: 4 } };

test("waluta = bazowa → bez zmian, converted", () => {
  assert.deepEqual(toBase(100, "PLN", info), { value: 100, converted: true });
});

test("brak waluty (null/undefined) → traktowane jak bazowa", () => {
  assert.deepEqual(toBase(50, null, info), { value: 50, converted: true });
  assert.deepEqual(toBase(50, undefined, info), { value: 50, converted: true });
});

test("znany kurs → amount * rate, converted", () => {
  assert.deepEqual(toBase(100, "EUR", info), { value: 430, converted: true });
  assert.deepEqual(toBase(10, "USD", info), { value: 40, converted: true });
});

test("wielkość liter waluty nie ma znaczenia", () => {
  assert.deepEqual(toBase(100, "eur", info), { value: 430, converted: true });
});

test("brak kursu → 1:1 i converted=false (do oznaczenia w UI)", () => {
  assert.deepEqual(toBase(100, "GBP", info), { value: 100, converted: false });
});

test("kurs <= 0 traktowany jak brak kursu (1:1, nieprzeliczone)", () => {
  const bad: RateInfo = { base: "PLN", rates: { CHF: 0, JPY: -1 } };
  assert.deepEqual(toBase(100, "CHF", bad), { value: 100, converted: false });
  assert.deepEqual(toBase(100, "JPY", bad), { value: 100, converted: false });
});
