import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRecurringSuccessor } from "../recurrence";

const DAY = 24 * 60 * 60 * 1000;

test("kotwica DUE (domyślna): termin następnika liczony od terminu zadania, nie od daty wykonania", () => {
  const due = new Date("2026-06-10T08:00:00");
  const completedAt = new Date("2026-06-12T20:00:00"); // wykonane 2 dni po terminie
  const res = computeRecurringSuccessor(
    { recurring: { type: "DAILY", interval: 1 }, dueDate: due, startDate: null, completedAt },
    {},
  );
  assert.ok(res);
  assert.equal(res!.nextDue.getTime(), due.getTime() + DAY); // od terminu, nie od wykonania
});

test("kotwica COMPLETION: termin następnika liczony od daty wykonania", () => {
  const due = new Date("2026-06-10T08:00:00");
  const completedAt = new Date("2026-06-12T20:00:00");
  const res = computeRecurringSuccessor(
    { recurring: { type: "DAILY", interval: 1, anchor: "COMPLETION" }, dueDate: due, startDate: null, completedAt },
    {},
  );
  assert.equal(res!.nextDue.getTime(), completedAt.getTime() + DAY);
});

test("odstępstwo opts.anchor nadpisuje kotwicę reguły dla tego wykonania", () => {
  const due = new Date("2026-06-10T08:00:00");
  const completedAt = new Date("2026-06-12T20:00:00");
  const res = computeRecurringSuccessor(
    { recurring: { type: "DAILY", interval: 1, anchor: "DUE" }, dueDate: due, startDate: null, completedAt },
    { anchor: "COMPLETION" },
  );
  assert.equal(res!.nextDue.getTime(), completedAt.getTime() + DAY);
});

test("nextDueOverride pomija wyliczanie terminu", () => {
  const due = new Date("2026-06-10T08:00:00");
  const override = "2026-07-01T09:00:00";
  const res = computeRecurringSuccessor(
    { recurring: { type: "DAILY", interval: 1 }, dueDate: due, startDate: null, completedAt: due },
    { nextDueOverride: override },
  );
  assert.equal(res!.nextDue.getTime(), new Date(override).getTime());
});

test("endDate: gdy następny termin wypada po endDate → seria kończy się (null)", () => {
  const due = new Date("2026-06-10T08:00:00");
  const res = computeRecurringSuccessor(
    { recurring: { type: "DAILY", interval: 1, endDate: "2026-06-10T23:59:59" }, dueDate: due, startDate: null, completedAt: due },
    {},
  );
  assert.equal(res, null);
});

test("przesunięcie startDate: zachowuje wyprzedzenie startu względem terminu", () => {
  const start = new Date("2026-06-09T08:00:00"); // dzień przed terminem
  const due = new Date("2026-06-10T08:00:00");
  const res = computeRecurringSuccessor(
    { recurring: { type: "DAILY", interval: 1 }, dueDate: due, startDate: start, completedAt: due },
    {},
  );
  assert.ok(res!.nextStart);
  // nowy start = nowy termin − (termin − start) = zachowane 1-dniowe wyprzedzenie
  assert.equal(res!.nextDue.getTime() - res!.nextStart!.getTime(), due.getTime() - start.getTime());
});

test("bez startDate → nextStart null", () => {
  const due = new Date("2026-06-10T08:00:00");
  const res = computeRecurringSuccessor(
    { recurring: { type: "DAILY", interval: 1 }, dueDate: due, startDate: null, completedAt: due },
    {},
  );
  assert.equal(res!.nextStart, null);
});

test("DUE bez terminu zadania → baza = data wykonania (fallback)", () => {
  const completedAt = new Date("2026-06-12T20:00:00");
  const res = computeRecurringSuccessor(
    { recurring: { type: "DAILY", interval: 1 }, dueDate: null, startDate: null, completedAt },
    {},
  );
  assert.equal(res!.nextDue.getTime(), completedAt.getTime() + DAY);
});
