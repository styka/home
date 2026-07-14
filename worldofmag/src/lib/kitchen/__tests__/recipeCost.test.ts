import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRecipeCost } from "@/lib/kitchen/recipeCost";

// Z-252: koszt przepisu / porcji.

test("sumuje quantity * unitPrice i dzieli na porcje", () => {
  const r = computeRecipeCost(
    [
      { quantity: 2, unitPrice: 3 }, // 6
      { quantity: 0.5, unitPrice: 10 }, // 5
    ],
    2,
  );
  assert.equal(r.total, 11);
  assert.equal(r.perServing, 5.5);
  assert.equal(r.pricedCount, 2);
  assert.equal(r.totalCount, 2);
  assert.equal(r.complete, true);
});

test("składnik bez ceny pomijany w sumie, ale liczony do totalCount; complete=false", () => {
  const r = computeRecipeCost(
    [
      { quantity: 1, unitPrice: 4 },
      { quantity: 2, unitPrice: null }, // brak ceny, obowiązkowy
    ],
    1,
  );
  assert.equal(r.total, 4);
  assert.equal(r.pricedCount, 1);
  assert.equal(r.totalCount, 2);
  assert.equal(r.complete, false, "obowiązkowy bez ceny → niekompletne");
});

test("brak quantity → traktuj jak 1 jednostkę", () => {
  const r = computeRecipeCost([{ unitPrice: 7 }], 1);
  assert.equal(r.total, 7);
});

test("składnik opcjonalny bez ceny nie psuje complete", () => {
  const r = computeRecipeCost(
    [
      { quantity: 1, unitPrice: 5 },
      { quantity: 1, unitPrice: null, isOptional: true },
    ],
    1,
  );
  assert.equal(r.complete, true);
  assert.equal(r.total, 5);
});

test("servings=0 → traktuj jak 1 (brak dzielenia przez zero)", () => {
  const r = computeRecipeCost([{ quantity: 1, unitPrice: 8 }], 0);
  assert.equal(r.perServing, 8);
});

test("brak wycenionych składników → complete=false, total=0", () => {
  const r = computeRecipeCost([{ quantity: 1 }, { quantity: 2 }], 4);
  assert.equal(r.total, 0);
  assert.equal(r.complete, false);
  assert.equal(r.pricedCount, 0);
});

test("zaokrągla do 2 miejsc", () => {
  const r = computeRecipeCost([{ quantity: 3, unitPrice: 0.333 }], 3);
  assert.equal(r.total, 1); // 0.999 → 1.00
  assert.equal(r.perServing, 0.33);
});
