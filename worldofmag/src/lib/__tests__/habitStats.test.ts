import { test } from "node:test";
import assert from "node:assert/strict";
import { isoDate, parseDays, isScheduledOn, startOfWeek, computeStreaks } from "../habitStats";

// Z-174: czyste helpery nawyków (serie/harmonogram/tydzień) — błędogenne, bez testów.

// Daty względem „dziś" (harmonogram dzienny → każdy dzień zaplanowany, więc test
// deterministyczny niezależnie od tego, jaki dziś jest dzień tygodnia).
function dayAgo(n: number): Date {
  const t = new Date();
  const c = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12, 0, 0, 0);
  c.setDate(c.getDate() - n);
  return c;
}

test("parseDays: lista dni, puste/null, filtr zakresu i śmieci", () => {
  assert.deepEqual([...(parseDays("1,3,5") ?? [])].sort(), [1, 3, 5]);
  assert.equal(parseDays(""), null);
  assert.equal(parseDays(null), null);
  assert.deepEqual([...(parseDays("9,abc,2,-1") ?? [])], [2]); // poza 0–6 i nie-liczby odrzucone
});

test("isScheduledOn: null = codziennie; inaczej wg dnia tygodnia daty", () => {
  const d = new Date(2026, 5, 15, 12); // konkretny dzień
  const dow = d.getDay();
  assert.equal(isScheduledOn(null, d), true);
  assert.equal(isScheduledOn(String(dow), d), true);
  assert.equal(isScheduledOn(String((dow + 1) % 7), d), false);
});

test("startOfWeek: zawsze poniedziałek, w tym samym tygodniu, nie w przyszłości", () => {
  for (const off of [0, 1, 2, 3, 4, 5, 6]) {
    const d = dayAgo(off);
    const mon = startOfWeek(d);
    assert.equal(mon.getDay(), 1, "poniedziałek");
    assert.ok(mon.getTime() <= d.getTime(), "nie po dacie");
    assert.ok(d.getTime() - mon.getTime() < 7 * 86400000, "w tym samym tygodniu");
  }
});

test("computeStreaks (dzienny): kolejne dni → bieżąca seria; pusty → 0", () => {
  assert.deepEqual(computeStreaks([], null), { currentStreak: 0, longestStreak: 0 });
  const three = [isoDate(dayAgo(0)), isoDate(dayAgo(1)), isoDate(dayAgo(2))];
  const r = computeStreaks(three, null);
  assert.equal(r.currentStreak, 3);
  assert.equal(r.longestStreak, 3);
});

test("computeStreaks: dziś nieodhaczone NIE zrywa serii (liczy się wczoraj wstecz)", () => {
  const r = computeStreaks([isoDate(dayAgo(1)), isoDate(dayAgo(2))], null);
  assert.equal(r.currentStreak, 2);
});

test("computeStreaks: luka zrywa bieżącą serię", () => {
  // dziś OK, wczoraj brak → seria bieżąca = 1 (dziś), luka przerywa dalej
  const r = computeStreaks([isoDate(dayAgo(0)), isoDate(dayAgo(2))], null);
  assert.equal(r.currentStreak, 1);
  assert.ok(r.longestStreak >= 1);
});
