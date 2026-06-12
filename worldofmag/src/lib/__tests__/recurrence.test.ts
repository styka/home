import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNextDue, parseRecurringRule } from "../recurrence";

const DAY = 24 * 60 * 60 * 1000;

test("DAILY interval=1 → +1 dzień", () => {
  const from = new Date("2026-06-10T08:00:00");
  const next = computeNextDue(from, { type: "DAILY", interval: 1 });
  assert.ok(next);
  assert.equal(next!.getTime(), from.getTime() + DAY);
});

test("DAILY interval=3 → +3 dni", () => {
  const from = new Date("2026-06-10T08:00:00");
  const next = computeNextDue(from, { type: "DAILY", interval: 3 });
  assert.equal(next!.getTime(), from.getTime() + 3 * DAY);
});

test("WEEKLY z daysOfWeek wybiera następny dzień w tygodniu", () => {
  // 2026-06-10 to środa (getDay()===3). Następny z [1(pn),3(śr),5(pt)] po środzie to piątek (5).
  const from = new Date("2026-06-10T08:00:00");
  const next = computeNextDue(from, { type: "WEEKLY", interval: 1, daysOfWeek: [1, 3, 5] });
  assert.equal(next!.getDay(), 5);
});

test("WEEKLY zawija do następnego tygodnia gdy brak dnia po bieżącym", () => {
  // środa, daysOfWeek=[1] (pon) → następny poniedziałek (za 5 dni).
  const from = new Date("2026-06-10T08:00:00");
  const next = computeNextDue(from, { type: "WEEKLY", interval: 1, daysOfWeek: [1] });
  assert.equal(next!.getDay(), 1);
  assert.ok(next!.getTime() > from.getTime());
});

test("MONTHLY/YEARLY przesuwają miesiąc/rok", () => {
  const from = new Date("2026-01-15T08:00:00");
  assert.equal(computeNextDue(from, { type: "MONTHLY", interval: 1 })!.getMonth(), 1);
  assert.equal(computeNextDue(from, { type: "YEARLY", interval: 1 })!.getFullYear(), 2027);
});

test("nieznany typ → null", () => {
  // @ts-expect-error celowo nieprawidłowy typ
  assert.equal(computeNextDue(new Date(), { type: "NOPE", interval: 1 }), null);
});

test("parseRecurringRule: poprawny JSON / pusty / śmieci", () => {
  assert.deepEqual(parseRecurringRule('{"type":"DAILY","interval":2}'), { type: "DAILY", interval: 2 });
  assert.equal(parseRecurringRule(null), null);
  assert.equal(parseRecurringRule(""), null);
  assert.equal(parseRecurringRule("{nie-json"), null);
});
