import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTimes, isActiveOn, slotsForDate } from "../medicationSchedule";
import type { MedicationSchedule } from "@/types";

// Z-174: harmonogram leków/pielęgnacji (health-critical: błąd = pominięta/zła dawka).
function sched(o: Partial<MedicationSchedule>): MedicationSchedule {
  return {
    active: true, startDate: new Date(2026, 5, 15), endDate: null,
    freqType: "DAILY", interval: 1, daysOfWeek: null, timesOfDay: '["08:00","20:00"]',
    hourlyStart: null, hourlyEnd: null, ...o,
  } as MedicationSchedule;
}

test("parseTimes: waliduje HH:MM, dedupe i sortuje; śmieci → []", () => {
  assert.deepEqual(parseTimes('["20:00","08:00","08:00"]'), ["08:00", "20:00"]);
  assert.deepEqual(parseTimes('["8:00","x",""]'), []); // jednocyfrowa godzina = niepoprawna
  assert.deepEqual(parseTimes(null), []);
  assert.deepEqual(parseTimes("nie-json"), []);
  assert.deepEqual(parseTimes("{}"), []); // nie tablica
});

test("isActiveOn: flaga + okno kuracji (start/end)", () => {
  const s = sched({ startDate: new Date(2026, 5, 15), endDate: new Date(2026, 5, 20) });
  assert.equal(isActiveOn(s, new Date(2026, 5, 17)), true);
  assert.equal(isActiveOn(s, new Date(2026, 5, 14)), false, "przed startem");
  assert.equal(isActiveOn(s, new Date(2026, 5, 21)), false, "po końcu");
  assert.equal(isActiveOn(sched({ active: false }), new Date(2026, 5, 17)), false, "nieaktywny");
});

test("slotsForDate DAILY: co `interval` dni od startDate", () => {
  const s = sched({ freqType: "DAILY", interval: 2 });
  assert.deepEqual(slotsForDate(s, new Date(2026, 5, 15)), ["08:00", "20:00"], "dzień 0");
  assert.deepEqual(slotsForDate(s, new Date(2026, 5, 16)), [], "dzień 1 — pomijany");
  assert.deepEqual(slotsForDate(s, new Date(2026, 5, 17)), ["08:00", "20:00"], "dzień 2");
});

test("slotsForDate WEEKLY: tylko w wybrane dni tygodnia", () => {
  const day = new Date(2026, 5, 15);
  const dow = day.getDay();
  assert.deepEqual(slotsForDate(sched({ freqType: "WEEKLY", daysOfWeek: String(dow) }), day), ["08:00", "20:00"]);
  assert.deepEqual(slotsForDate(sched({ freqType: "WEEKLY", daysOfWeek: String((dow + 1) % 7) }), day), []);
});

test("slotsForDate HOURLY: co `interval` godzin w oknie", () => {
  const s = sched({ freqType: "HOURLY", interval: 4, hourlyStart: "08:00", hourlyEnd: "20:00" });
  assert.deepEqual(slotsForDate(s, new Date(2026, 5, 15)), ["08:00", "12:00", "16:00", "20:00"]);
});

test("slotsForDate: nieaktywny dzień → brak slotów", () => {
  assert.deepEqual(slotsForDate(sched({ active: false }), new Date(2026, 5, 15)), []);
});
