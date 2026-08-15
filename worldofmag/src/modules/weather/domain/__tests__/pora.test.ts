import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveWhen } from "../pora";
import type { Forecast, HourPoint, DayPoint } from "../../lib/openMeteo";

const godzina = (time: string, temp = 15): HourPoint => ({
  time,
  isDay: true,
  temp,
  apparent: temp,
  precipProb: 0,
  precip: 0,
  windKph: 5,
  code: 1,
});

const dzien = (date: string): DayPoint => ({
  date,
  code: 1,
  tMax: 20,
  tMin: 10,
  precipSum: 0,
  precipProbMax: 0,
  windMaxKph: 10,
  sunrise: "",
  sunset: "",
  uvMax: 3,
});

const prognoza = (daily: DayPoint[], hourly: HourPoint[]): Forecast => ({
  latitude: 52,
  longitude: 21,
  timezone: "Europe/Warsaw",
  current: null,
  hourly,
  daily,
});

test("wybiera wskazany dzień i godziny mieszczące się w porze", () => {
  const f = prognoza(
    [dzien("2026-05-10"), dzien("2026-05-11")],
    [
      godzina("2026-05-11T05:00"),
      godzina("2026-05-11T07:00"),
      godzina("2026-05-11T10:00"),
      godzina("2026-05-11T12:00"),
    ]
  );
  const w = resolveWhen(f, { date: "2026-05-11", part: "morning" });
  assert.equal(w.date, "2026-05-11");
  assert.equal(w.part.key, "morning");
  // Rano to 6:00–11:00 (górna granica wyłączna) — 5:00 i 12:00 odpadają.
  assert.deepEqual(w.hours.map((h) => h.time.slice(11, 16)), ["07:00", "10:00"]);
});

test("data spoza prognozy schodzi do pierwszego dnia, a nie do pustki", () => {
  const f = prognoza([dzien("2026-05-10")], [godzina("2026-05-10T08:00")]);
  const w = resolveWhen(f, { date: "2030-01-01", part: "morning" });
  assert.equal(w.date, "2026-05-10");
  assert.equal(w.day?.date, "2026-05-10");
});

test("PORA BEZ GODZIN BIERZE CAŁY DZIEŃ — prognoza godzinowa bywa krótsza niż dobowa", () => {
  // Ostatni dzień prognozy często nie ma już godzin wieczornych. Bez tego zachowania treść
  // liczyłaby się z pustego zbioru godzin i nie mówiłaby nic.
  const f = prognoza(
    [dzien("2026-05-10")],
    [godzina("2026-05-10T07:00"), godzina("2026-05-10T09:00")]
  );
  const w = resolveWhen(f, { date: "2026-05-10", part: "evening" });
  assert.equal(w.part.key, "evening");
  assert.equal(w.hours.length, 2, "spadło na wszystkie godziny dnia");
});

test("brak wskazania pory daje poranek", () => {
  const f = prognoza([dzien("2026-05-10")], [godzina("2026-05-10T08:00")]);
  assert.equal(resolveWhen(f).part.key, "morning");
});

test("nieznana pora schodzi do pierwszej z listy, zamiast wywalić się na `undefined`", () => {
  const f = prognoza([dzien("2026-05-10")], [godzina("2026-05-10T08:00")]);
  const w = resolveWhen(f, { part: "noc" as never });
  assert.equal(w.part.key, "morning");
});

test("PUSTA PROGNOZA BIERZE DATĘ Z PODANEGO CZASU — brzeg niesprawdzalny przed AC-8", () => {
  // Dokładnie ten przypadek wymusił parametryzację zegara: wcześniej reguła czytała `new Date()`
  // z ciała, więc test nie miał jak stwierdzić, którą datę wybrała.
  const f = prognoza([], []);
  const w = resolveWhen(f, undefined, new Date("2026-11-03T09:00:00.000Z"));
  assert.equal(w.date, "2026-11-03");
  assert.equal(w.day, undefined);
  assert.deepEqual(w.hours, []);
});

test("bez podanego czasu odniesienia reguła nadal działa — domyślny zegar", () => {
  const w = resolveWhen(prognoza([], []));
  assert.match(w.date, /^\d{4}-\d{2}-\d{2}$/);
});

test("godziny innego dnia nie wchodzą do wyniku", () => {
  const f = prognoza(
    [dzien("2026-05-10"), dzien("2026-05-11")],
    [godzina("2026-05-10T08:00"), godzina("2026-05-11T08:00")]
  );
  const w = resolveWhen(f, { date: "2026-05-11", part: "morning" });
  assert.equal(w.hours.length, 1);
  assert.ok(w.hours[0].time.startsWith("2026-05-11"));
});
