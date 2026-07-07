import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateTimeLocalValue, toDateValue, parseDateInput } from "@/lib/dateInput";

// Regresja 2026-07-02: zmiana „Terminu" zadania (pole datetime-local) przepadała, bo
// handler robił new Date(v + "T12:00:00") na wartości już zawierającej godzinę → Invalid Date.

test("toDateTimeLocalValue: pusty/null/invalid → ''", () => {
  assert.equal(toDateTimeLocalValue(null), "");
  assert.equal(toDateTimeLocalValue(undefined), "");
  assert.equal(toDateTimeLocalValue(""), "");
  assert.equal(toDateTimeLocalValue("nie-data"), "");
});

test("toDateTimeLocalValue: format lokalny YYYY-MM-DDTHH:mm (bez UTC-drift)", () => {
  // Konstruujemy instant z lokalnych składników → format musi je odtworzyć 1:1.
  const local = new Date(2026, 6, 2, 14, 30, 0); // 2026-07-02 14:30 lokalnie
  assert.equal(toDateTimeLocalValue(local), "2026-07-02T14:30");
});

test("parseDateInput: datetime-local parsuje jako lokalny czas (NIE Invalid Date)", () => {
  const d = parseDateInput("2026-07-02T14:30");
  assert.ok(d instanceof Date && !Number.isNaN(d.getTime()), "poprawny instant");
  assert.equal(d!.getFullYear(), 2026);
  assert.equal(d!.getMonth(), 6);
  assert.equal(d!.getDate(), 2);
  assert.equal(d!.getHours(), 14);
  assert.equal(d!.getMinutes(), 30);
});

test("round-trip: instant → datetime-local → instant (do minuty)", () => {
  const original = new Date(2026, 11, 31, 23, 59, 0);
  const asInput = toDateTimeLocalValue(original);
  const back = parseDateInput(asInput);
  assert.ok(back);
  assert.equal(back!.getTime(), original.getTime(), "round-trip zachowuje instant");
});

test("parseDateInput dayOnly: pole 'date' → lokalne południe wybranego dnia", () => {
  const d = parseDateInput("2026-07-02", { dayOnly: true });
  assert.ok(d);
  assert.equal(d!.getFullYear(), 2026);
  assert.equal(d!.getMonth(), 6);
  assert.equal(d!.getDate(), 2);
  assert.equal(d!.getHours(), 12); // południe lokalne
});

test("toDateValue: instant → YYYY-MM-DD (lokalnie); puste → ''", () => {
  assert.equal(toDateValue(new Date(2026, 6, 2, 23, 0, 0)), "2026-07-02");
  assert.equal(toDateValue(null), "");
});

test("parseDateInput: puste wejście → null", () => {
  assert.equal(parseDateInput(""), null);
  assert.equal(parseDateInput("", { dayOnly: true }), null);
});
