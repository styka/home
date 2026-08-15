import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDays, normalizeGoal, normalizeReminder } from "../harmonogram";

test("dni: typowy zapis porządkowany i odduplikowany", () => {
  assert.equal(normalizeDays("5,1,3,1"), "1,3,5");
});

test("dni: pełny tydzień to `null`, nie lista siedmiu", () => {
  // Sedno reguły: „codziennie" ma JEDEN zapis. Dwa równoważne zapisy tego samego nawyku
  // rozjechałyby porównania — dlatego siedem dni schodzi do braku wskazania.
  assert.equal(normalizeDays("0,1,2,3,4,5,6"), null);
  assert.equal(normalizeDays("6,5,4,3,2,1,0"), null);
});

test("dni: wartości spoza 0–6 odpadają", () => {
  assert.equal(normalizeDays("7,9,-1"), null);
  assert.equal(normalizeDays("2,99"), "2");
});

test("dni: PUSTY NAPIS DAJE NIEDZIELĘ — zastane zachowanie, opisane celowo", () => {
  // To jest pierwsza rzecz, jaką znalazł pierwszy test tej reguły, i dlatego stoi tu osobno.
  // `"".split(",")` daje `[""]`, a `Number("")` to **0** — czyli niedziela. Pusta lista dni,
  // zamiast oznaczać „bez wskazania", zapisuje nawyk jako „tylko w niedziele".
  //
  // Test UTRWALA stan zastany, a nie go poprawia (069 przenosi reguły, nie zmienia zachowania).
  // Poprawka jest realną zmianą dla użytkownika i wymaga rozstrzygnięcia, czym ma być pusty
  // wybór — „codziennie" czy „bez wskazania" — więc idzie osobnym przebiegiem. Gdyby ktoś to
  // naprawił, ten test zapali się na czerwono i **o to chodzi**: zmiana ma być świadoma.
  assert.equal(normalizeDays(""), "0");
  assert.equal(normalizeDays(" "), "0");
  assert.equal(normalizeDays(","), "0");
});

test("dni: brak wskazania przechodzi bez zmian", () => {
  assert.equal(normalizeDays(null), null);
  assert.equal(normalizeDays(undefined), null);
});

test("cel: mieści się w tygodniu — 10 razy w tygodniu to nadal 7", () => {
  assert.equal(normalizeGoal(3), 3);
  assert.equal(normalizeGoal(10), 7);
  assert.equal(normalizeGoal(7), 7);
});

test("cel: zero i wartości ujemne to brak celu, nie cel zerowy", () => {
  assert.equal(normalizeGoal(0), null);
  assert.equal(normalizeGoal(-2), null);
  assert.equal(normalizeGoal(null), null);
});

test("cel: ułamek jest zaokrąglany do pełnego wykonania", () => {
  assert.equal(normalizeGoal(2.4), 2);
  assert.equal(normalizeGoal(2.6), 3);
  // 0,4 zaokrągla się do 0, a zero nie jest celem — brzeg między „mało" a „wcale".
  assert.equal(normalizeGoal(0.4), null);
});

test("przypomnienie: uzupełnia wiodące zero", () => {
  assert.equal(normalizeReminder("7:05"), "07:05");
  assert.equal(normalizeReminder(" 18:30 "), "18:30");
});

test("przypomnienie: godzina spoza doby przycięta do 23:59", () => {
  assert.equal(normalizeReminder("25:70"), "23:59");
  assert.equal(normalizeReminder("99:99"), "23:59");
});

test("przypomnienie: tekst niebędący godziną to brak przypomnienia", () => {
  assert.equal(normalizeReminder("rano"), null);
  assert.equal(normalizeReminder("7"), null);
  assert.equal(normalizeReminder("   "), null);
  assert.equal(normalizeReminder(null), null);
});
