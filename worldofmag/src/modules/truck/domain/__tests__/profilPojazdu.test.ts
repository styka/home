import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, ograniczProfil, ZAKRESY_PROFILU } from "../profilPojazdu";

test("typowy zestaw drogowy przechodzi bez zmian", () => {
  const wejscie = { weight: 40, height: 4.0, length: 16.5, width: 2.55, axleload: 11.5 };
  assert.deepEqual(ograniczProfil(wejscie), wejscie);
});

test("wartości ponad zakres schodzą do górnej granicy", () => {
  const p = ograniczProfil({ weight: 500, height: 99, length: 100, width: 20, axleload: 80 });
  assert.deepEqual(p, { weight: 120, height: 6, length: 30, width: 5, axleload: 30 });
});

test("wartości poniżej zakresu podnoszą się do dolnej granicy", () => {
  const p = ograniczProfil({ weight: 0, height: -3, length: 0, width: 0, axleload: 0 });
  assert.deepEqual(p, { weight: 1, height: 1, length: 1, width: 1, axleload: 0.5 });
});

test("PUSTE POLE DAJE NAJMNIEJSZY POJAZD, nie największy — to wybór po stronie bezpieczeństwa", () => {
  // `NaN` (pusty formularz) schodzi do dolnej granicy. Gdyby szedł do górnej, planer przepuściłby
  // trasy z ograniczeniami, których kierowca w rzeczywistości nie przejedzie.
  const p = ograniczProfil({ weight: NaN, height: NaN, length: NaN, width: NaN, axleload: NaN });
  assert.deepEqual(p, { weight: 1, height: 1, length: 1, width: 1, axleload: 0.5 });
});

test("brzegi zakresu są włączające", () => {
  for (const [pole, z] of Object.entries(ZAKRESY_PROFILU)) {
    assert.equal(clamp(z.min, z.min, z.max), z.min, `dolny brzeg ${pole}`);
    assert.equal(clamp(z.max, z.min, z.max), z.max, `górny brzeg ${pole}`);
  }
});

test("nieskończoność jest liczbą, więc przycina się normalnie", () => {
  assert.equal(clamp(Infinity, 1, 120), 120);
  assert.equal(clamp(-Infinity, 1, 120), 1);
});
