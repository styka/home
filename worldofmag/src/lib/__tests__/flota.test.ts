import { test } from "node:test";
import assert from "node:assert/strict";
import { deadlineStatus, computeConsumption } from "@/lib/flota";

// Flota — czyste funkcje dotąd nieprzetestowane (computeVehicleTCO osobno w flotaTco.test).
const DAY = 86_400_000;

// ── deadlineStatus: klasyfikacja terminu (przegląd/OC/serwis) ───────────────
test("deadlineStatus: null / pusty / niepoprawna data → null", () => {
  assert.equal(deadlineStatus(null), null);
  assert.equal(deadlineStatus(undefined), null);
  assert.equal(deadlineStatus(""), null);
  assert.equal(deadlineStatus("nie-data"), null);
});

test("deadlineStatus: po terminie → overdue + czerwony", () => {
  const r = deadlineStatus(new Date(Date.now() - 5 * DAY))!;
  assert.equal(r.overdue, true);
  assert.ok(r.days < 0);
  assert.match(r.text, /po terminie/);
  assert.equal(r.color, "var(--accent-red)");
});

test("deadlineStatus: w ciągu 30 dni → amber 'za N dni'", () => {
  const r = deadlineStatus(new Date(Date.now() + 15 * DAY))!;
  assert.equal(r.overdue, false);
  assert.equal(r.days, 15);
  assert.match(r.text, /za 15 dni/);
  assert.equal(r.color, "var(--accent-amber)");
});

test("deadlineStatus: dokładnie 30 dni → jeszcze amber (granica)", () => {
  const r = deadlineStatus(new Date(Date.now() + 30 * DAY))!;
  assert.equal(r.days, 30);
  assert.equal(r.color, "var(--accent-amber)");
});

test("deadlineStatus: powyżej 30 dni → muted, sama data (bez 'za N dni')", () => {
  const r = deadlineStatus(new Date(Date.now() + 45 * DAY))!;
  assert.equal(r.overdue, false);
  assert.ok(r.days >= 44);
  assert.equal(r.color, "var(--text-muted)");
  assert.doesNotMatch(r.text, /za \d+ dni/);
});

// ── computeConsumption: metoda full-to-full ─────────────────────────────────
test("computeConsumption: pusta lista → avg null, zera", () => {
  const r = computeConsumption([]);
  assert.equal(r.avg, null);
  assert.deepEqual(r.points, []);
  assert.equal(r.totalLiters, 0);
  assert.equal(r.totalCost, 0);
});

test("computeConsumption: jedno pełne tankowanie → brak punktu, sumy policzone", () => {
  const r = computeConsumption([{ date: "2026-01-01", odometer: 1000, liters: 40, totalCost: 200, full: true }]);
  assert.equal(r.avg, null);
  assert.equal(r.points.length, 0);
  assert.equal(r.totalLiters, 40);
  assert.equal(r.totalCost, 200);
});

test("computeConsumption: dwa pełne → l/100km (litry drugiego ÷ dystans × 100)", () => {
  const r = computeConsumption([
    { date: "2026-01-01", odometer: 1000, liters: 10, totalCost: 50, full: true },
    { date: "2026-01-10", odometer: 1500, liters: 40, totalCost: 200, full: true },
  ]);
  // dystans 500 km, zużyte 40 l → 8.0 l/100km
  assert.equal(r.points.length, 1);
  assert.equal(r.points[0].y, 8);
  assert.equal(r.avg, 8);
  assert.equal(r.totalLiters, 50);
  assert.equal(r.totalCost, 250);
});

test("computeConsumption: tankowanie częściowe wliczane do okna full-to-full", () => {
  const r = computeConsumption([
    { date: "2026-01-01", odometer: 1000, liters: 10, full: true },
    { date: "2026-01-05", odometer: 1200, liters: 20, full: false },
    { date: "2026-01-10", odometer: 1500, liters: 30, full: true },
  ]);
  // dystans 500, zużyte 20+30=50 → 10.0 l/100km
  assert.equal(r.points.length, 1);
  assert.equal(r.points[0].y, 10);
  assert.equal(r.totalLiters, 60);
});

test("computeConsumption: nieuporządkowane wejście jest sortowane po dacie", () => {
  const r = computeConsumption([
    { date: "2026-01-10", odometer: 1500, liters: 40, full: true },
    { date: "2026-01-01", odometer: 1000, liters: 10, full: true },
  ]);
  assert.equal(r.points.length, 1);
  assert.equal(r.points[0].y, 8);
});

test("computeConsumption: odometr nie wzrósł → brak punktu (ochrona przed dzieleniem)", () => {
  const r = computeConsumption([
    { date: "2026-01-01", odometer: 1500, liters: 10, full: true },
    { date: "2026-01-10", odometer: 1500, liters: 40, full: true },
  ]);
  assert.equal(r.points.length, 0);
  assert.equal(r.avg, null);
});

test("computeConsumption: implausibilne zużycie (≥100 l/100km) odfiltrowane", () => {
  const r = computeConsumption([
    { date: "2026-01-01", odometer: 1000, liters: 10, full: true },
    { date: "2026-01-02", odometer: 1010, liters: 40, full: true }, // 40/10*100 = 400 → odfiltrowane
  ]);
  assert.equal(r.points.length, 0);
  assert.equal(r.avg, null);
});
