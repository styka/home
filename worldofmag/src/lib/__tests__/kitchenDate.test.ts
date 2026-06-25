import { test } from "node:test";
import assert from "node:assert/strict";
import { getWeekStart, getWeekDays, formatDayShort, dateKey, isToday } from "@/lib/kitchenDate";

// Środa 2024-01-03 → tydzień Pon 2024-01-01 … Nd 2024-01-07 (tydzień zaczyna się w pon.).
const WED = new Date(2024, 0, 3);

test("getWeekStart: poniedziałek tygodnia zawierającego datę", () => {
  assert.equal(dateKey(getWeekStart(WED)), "2024-01-01");
  assert.equal(dateKey(getWeekStart(new Date(2024, 0, 1))), "2024-01-01", "poniedziałek → sam siebie");
  assert.equal(dateKey(getWeekStart(new Date(2024, 0, 7))), "2024-01-01", "niedziela → poniedziałek tego samego tygodnia");
});

test("getWeekDays: 7 dni od poniedziałku do niedzieli", () => {
  const days = getWeekDays(WED);
  assert.equal(days.length, 7);
  assert.equal(dateKey(days[0]), "2024-01-01", "pierwszy = poniedziałek");
  assert.equal(dateKey(days[6]), "2024-01-07", "ostatni = niedziela");
});

test("formatDayShort: mapowanie pl skrótu dnia + numer dnia miesiąca", () => {
  assert.equal(formatDayShort(new Date(2024, 0, 1)), "Pon 1");
  assert.equal(formatDayShort(new Date(2024, 0, 3)), "Śr 3");
  assert.equal(formatDayShort(new Date(2024, 0, 7)), "Nd 7", "niedziela getDay()=0 → ostatni indeks");
});

test("dateKey: 'yyyy-MM-dd'", () => {
  assert.equal(dateKey(new Date(2024, 2, 5)), "2024-03-05");
  assert.equal(dateKey(new Date(2024, 11, 31)), "2024-12-31");
});

test("isToday: dziś → true, odległa data → false", () => {
  assert.equal(isToday(new Date()), true);
  assert.equal(isToday(new Date(2000, 0, 1)), false);
});
