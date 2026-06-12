import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewCard, type SrsState } from "../srs";

const NEW: SrsState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };
const NOW = new Date("2026-06-10T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

test("pierwszy sukces (grade 5): repetitions=1, interval=1 dzień", () => {
  const r = reviewCard(NEW, 5, NOW);
  assert.equal(r.repetitions, 1);
  assert.equal(r.intervalDays, 1);
  assert.equal(r.dueAt.getTime(), NOW.getTime() + DAY);
  assert.ok(r.easeFactor > NEW.easeFactor); // grade 5 podnosi ease
});

test("drugi sukces: interval=6 dni", () => {
  const r = reviewCard({ ...NEW, repetitions: 1, intervalDays: 1 }, 4, NOW);
  assert.equal(r.repetitions, 2);
  assert.equal(r.intervalDays, 6);
});

test("trzeci+ sukces: interval = round(interval * ease)", () => {
  const state: SrsState = { easeFactor: 2.5, intervalDays: 6, repetitions: 2, lapses: 0 };
  const r = reviewCard(state, 4, NOW);
  assert.equal(r.repetitions, 3);
  assert.equal(r.intervalDays, Math.round(6 * r.easeFactor));
});

test("niepowodzenie (grade < 3): reset repetitions, interval=1, +lapse", () => {
  const state: SrsState = { easeFactor: 2.5, intervalDays: 30, repetitions: 5, lapses: 1 };
  const r = reviewCard(state, 2, NOW);
  assert.equal(r.repetitions, 0);
  assert.equal(r.intervalDays, 1);
  assert.equal(r.lapses, 2);
});

test("ease nie spada poniżej 1.3", () => {
  const state: SrsState = { easeFactor: 1.3, intervalDays: 1, repetitions: 0, lapses: 0 };
  const r = reviewCard(state, 0, NOW);
  assert.ok(r.easeFactor >= 1.3);
});
