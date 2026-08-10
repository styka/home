import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDaySlots, minToLabel, labelToMin, minutesOfDay } from "../serviceSlots";

// Środa (weekday 3), okno 09:00–11:00 (540–660), usługa 30 min.
const rules = [{ weekday: 3, startMin: 540, endMin: 660 }];

test("generuje sloty co czas trwania w oknie", () => {
  const slots = generateDaySlots(rules, 3, 30, [], null);
  assert.deepEqual(slots, [540, 570, 600, 630]); // 9:00, 9:30, 10:00, 10:30 (10:30+30=11:00 mieści się)
});

test("inny dzień tygodnia → brak slotów", () => {
  assert.deepEqual(generateDaySlots(rules, 1, 30, [], null), []);
});

test("wyklucza sloty kolidujące z rezerwacją", () => {
  // rezerwacja 9:30–10:00 koliduje ze slotem 570 (a 540 9:00-9:30 nie koliduje).
  const slots = generateDaySlots(rules, 3, 30, [{ startMin: 570, endMin: 600 }], null);
  assert.ok(!slots.includes(570));
  assert.ok(slots.includes(540));
});

test("nowMinIfToday pomija sloty z przeszłości", () => {
  const slots = generateDaySlots(rules, 3, 30, [], 600); // teraz 10:00
  assert.deepEqual(slots, [600, 630]);
});

test("czas trwania <= 0 → brak slotów", () => {
  assert.deepEqual(generateDaySlots(rules, 3, 0, [], null), []);
});

test("minToLabel/labelToMin round-trip i walidacja", () => {
  assert.equal(minToLabel(540), "09:00");
  assert.equal(minToLabel(1020), "17:00");
  assert.equal(labelToMin("09:00"), 540);
  assert.equal(labelToMin("17:00"), 1020);
  assert.equal(labelToMin("25:00"), null);
  assert.equal(labelToMin("abc"), null);
});

test("minutesOfDay z Date", () => {
  const d = new Date(2026, 5, 10, 9, 30, 0, 0);
  assert.equal(minutesOfDay(d), 570);
});
