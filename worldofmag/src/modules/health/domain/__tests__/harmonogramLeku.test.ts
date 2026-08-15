import { test } from "node:test";
import assert from "node:assert/strict";
import { normTimes, normDays, normFreq } from "../harmonogramLeku";

test("godziny: lista wchodzi posortowana i bez powtórzeń", () => {
  assert.equal(normTimes(["20:00", "08:00", "20:00"]), '["08:00","20:00"]');
});

test("godziny: wiodące zero jest warunkiem POPRAWNEJ kolejności, nie ozdobą", () => {
  // Bez uzupełnienia zera sortowanie napisów dałoby ["20:00","8:00"] — wieczorna dawka przed
  // poranną. Agenda „na dziś" idzie po tej liście po kolei, więc to jest błąd widoczny dla
  // użytkownika, a nie szczegół zapisu.
  assert.equal(normTimes(["20:00", "8:00"]), '["08:00","20:00"]');
});

test("godziny: przyjmuje też CSV, przycinając białe znaki", () => {
  assert.equal(normTimes("07:30, 12:00 ,07:30"), '["07:30","12:00"]');
});

test("godziny: brak poprawnej pory to harmonogram bez pór", () => {
  assert.equal(normTimes(["rano", "25:xx"]), null);
  assert.equal(normTimes(""), null);
  assert.equal(normTimes([]), null);
  assert.equal(normTimes(null), null);
  assert.equal(normTimes(undefined), null);
});

test("godziny: niepoprawne pozycje odpadają, poprawne zostają", () => {
  assert.equal(normTimes(["08:00", "rano", "22:15"]), '["08:00","22:15"]');
});

test("dni: unikalne i posortowane, z tablicy i z CSV", () => {
  assert.equal(normDays([5, 1, 3, 1]), "1,3,5");
  assert.equal(normDays("5, 1 ,3"), "1,3,5");
});

test("dni: wartości spoza tygodnia i ułamki odpadają", () => {
  assert.equal(normDays([7, -1, 2.5]), null);
  assert.equal(normDays([2, 99]), "2");
});

test("dni: brak wskazania to `null`", () => {
  assert.equal(normDays(null), null);
  assert.equal(normDays([]), null);
  assert.equal(normDays(""), null);
});

test("częstotliwość: rozpoznane wartości przechodzą bez zmian", () => {
  assert.equal(normFreq("WEEKLY"), "WEEKLY");
  assert.equal(normFreq("HOURLY"), "HOURLY");
  assert.equal(normFreq("DAILY"), "DAILY");
});

test("częstotliwość: nieznana wartość schodzi do DAILY, nie do ciszy", () => {
  // Wybór bezpieczniejszej strony: harmonogram, którego nie rozpoznano, ma przypominać za często
  // (użytkownik poprawi), a nie zamilknąć.
  assert.equal(normFreq("MONTHLY"), "DAILY");
  assert.equal(normFreq(""), "DAILY");
  assert.equal(normFreq(null), "DAILY");
  assert.equal(normFreq(undefined), "DAILY");
});
