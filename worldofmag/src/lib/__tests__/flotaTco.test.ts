import { test } from "node:test";
import assert from "node:assert/strict";
import { computeVehicleTCO, type FuelLogLike, type ServiceRecordLike } from "@/lib/flota";

// Z-291: TCO pojazdu (paliwo + serwis) + koszt/km.
const fuel: FuelLogLike[] = [
  { date: "2026-01-01", odometer: 1000, liters: 40, totalCost: 280, full: true },
  { date: "2026-02-01", odometer: 1500, liters: 38, totalCost: 266, full: true },
];
const services: ServiceRecordLike[] = [
  { type: "oil", cost: 200, odometer: 1200 },
  { type: "insurance", cost: 1200, odometer: null },
];

test("sumuje koszt paliwa i serwisu w TCO", () => {
  const tco = computeVehicleTCO(fuel, services);
  assert.equal(tco.fuelCost, 546);
  assert.equal(tco.serviceCost, 1400);
  assert.equal(tco.insuranceCost, 1200, "ubezpieczenie jako podzbiór serwisu");
  assert.equal(tco.total, 1946);
});

test("koszt/km z rozpiętości odometrów (paliwo + serwis)", () => {
  const tco = computeVehicleTCO(fuel, services);
  // odometry: 1000,1500 (paliwo) + 1200 (serwis) → dystans 500
  assert.equal(tco.distanceKm, 500);
  assert.equal(tco.costPerKm, Math.round((1946 / 500) * 100) / 100);
});

test("rozbicie kosztów po typie serwisu", () => {
  const tco = computeVehicleTCO(fuel, services);
  assert.deepEqual(tco.byServiceType, { oil: 200, insurance: 1200 });
});

test("brak danych → zera i null koszt/km", () => {
  const tco = computeVehicleTCO([], []);
  assert.equal(tco.total, 0);
  assert.equal(tco.distanceKm, null);
  assert.equal(tco.costPerKm, null);
});

test("pojedynczy odometr → brak dystansu (potrzeba ≥2 punktów)", () => {
  const tco = computeVehicleTCO([{ date: "2026-01-01", odometer: 1000, liters: 40, totalCost: 280, full: true }], []);
  assert.equal(tco.distanceKm, null);
  assert.equal(tco.costPerKm, null);
  assert.equal(tco.total, 280);
});

test("brakujące koszty (null) traktowane jak 0", () => {
  const tco = computeVehicleTCO(
    [{ date: "2026-01-01", odometer: 1000, liters: 40, totalCost: null, full: true }],
    [{ type: "repair", cost: null, odometer: 1100 }],
  );
  assert.equal(tco.total, 0);
});
