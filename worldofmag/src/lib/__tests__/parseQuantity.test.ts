import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuantity } from "../parseQuantity";

test("'2 butelki mleka' → qty 2, unit butelki, nazwa mleka", () => {
  const r = parseQuantity("2 butelki mleka");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, "butelki");
  assert.equal(r.name, "mleka");
});

test("'mleko 500ml' → qty 500, unit ml", () => {
  const r = parseQuantity("mleko 500ml");
  assert.equal(r.quantity, 500);
  assert.equal(r.unit, "ml");
  assert.equal(r.name, "mleko");
});

test("'mleko x2' → qty 2, bez jednostki", () => {
  const r = parseQuantity("mleko x2");
  assert.equal(r.quantity, 2);
  assert.equal(r.unit, null);
  assert.equal(r.name, "mleko");
});

test("'3 kg ziemniaki' → qty 3, unit kg", () => {
  const r = parseQuantity("3 kg ziemniaki");
  assert.equal(r.quantity, 3);
  assert.equal(r.unit, "kg");
  assert.equal(r.name, "ziemniaki");
});

test("przecinek dziesiętny: '1,5 l soku'", () => {
  const r = parseQuantity("1,5 l soku");
  assert.equal(r.quantity, 1.5);
  assert.equal(r.unit, "l");
});

test("sam tekst bez liczby → name=całość, qty/unit null", () => {
  const r = parseQuantity("chleb żytni");
  assert.equal(r.quantity, null);
  assert.equal(r.unit, null);
  assert.equal(r.name, "chleb żytni");
});
