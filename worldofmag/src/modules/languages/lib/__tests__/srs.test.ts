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

// Z-312: przypadki brzegowe — granica zaliczenia, reset serii, długie przerwy.

test("granica grade=3: traktowane jako sukces (nie lapse), repetitions rośnie", () => {
  const state: SrsState = { easeFactor: 2.5, intervalDays: 6, repetitions: 2, lapses: 0 };
  const r = reviewCard(state, 3, NOW);
  assert.equal(r.repetitions, 3, "grade 3 to zaliczenie → +1 powtórka");
  assert.equal(r.lapses, 0, "grade 3 NIE jest lapsem");
  assert.equal(r.intervalDays, Math.round(6 * r.easeFactor));
});

test("reset serii: po długiej serii sukcesów lapse zeruje repetitions/interval i dolicza lapse", () => {
  // budujemy serię: 5 → 5 → 5
  let s: SrsState = NEW;
  for (let i = 0; i < 3; i++) {
    const u = reviewCard(s, 5, NOW);
    s = { easeFactor: u.easeFactor, intervalDays: u.intervalDays, repetitions: u.repetitions, lapses: u.lapses };
  }
  assert.equal(s.repetitions, 3);
  assert.ok(s.intervalDays >= 6, "interwał urósł po serii");
  const easeBefore = s.easeFactor;
  // teraz całkowite niepowodzenie
  const r = reviewCard(s, 0, NOW);
  assert.equal(r.repetitions, 0, "seria zresetowana");
  assert.equal(r.intervalDays, 1, "wraca do 1 dnia");
  assert.equal(r.lapses, s.lapses + 1, "policzony lapse");
  assert.ok(r.easeFactor < easeBefore, "ease spada po niepowodzeniu");
});

test("długa przerwa: spóźniona powtórka liczy dueAt od TERAZ, nie karze za zwłokę", () => {
  // karta z dużym interwałem, powtórzona długo po terminie
  const state: SrsState = { easeFactor: 2.5, intervalDays: 30, repetitions: 5, lapses: 0 };
  const late = new Date("2027-01-01T00:00:00.000Z"); // dużo później niż „due"
  const r = reviewCard(state, 4, late);
  const expectedInterval = Math.round(30 * r.easeFactor);
  assert.equal(r.intervalDays, expectedInterval, "interwał z aktualnego stanu, nie ze zwłoki");
  assert.equal(r.dueAt.getTime(), late.getTime() + expectedInterval * DAY, "dueAt liczony od chwili powtórki");
});

test("powtarzane niepowodzenia kumulują lapses, ale ease nie schodzi poniżej 1.3", () => {
  let s: SrsState = { easeFactor: 1.4, intervalDays: 10, repetitions: 4, lapses: 0 };
  for (let i = 1; i <= 3; i++) {
    const u = reviewCard(s, 0, NOW);
    assert.equal(u.lapses, i, "każde niepowodzenie to +1 lapse");
    assert.ok(u.easeFactor >= 1.3);
    s = { easeFactor: u.easeFactor, intervalDays: u.intervalDays, repetitions: u.repetitions, lapses: u.lapses };
  }
});
