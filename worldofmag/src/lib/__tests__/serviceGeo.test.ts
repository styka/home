import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineKm, formatDistance } from "../serviceGeo";

test("ten sam punkt → 0 km", () => {
  assert.equal(haversineKm(52.23, 21.0, 52.23, 21.0), 0);
});

test("Warszawa↔Kraków ≈ 250 km (±15)", () => {
  const km = haversineKm(52.2297, 21.0122, 50.0647, 19.945);
  assert.ok(km > 235 && km < 265, `oczekiwano ~250, otrzymano ${km}`);
});

test("symetria odległości", () => {
  const a = haversineKm(52.0, 21.0, 50.0, 19.0);
  const b = haversineKm(50.0, 19.0, 52.0, 21.0);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test("formatDistance: metry < 1 km, kilometry powyżej", () => {
  assert.equal(formatDistance(0.4), "400 m");
  assert.equal(formatDistance(2.5), "2,5 km");
});
