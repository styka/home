import { test } from "node:test";
import assert from "node:assert/strict";
import { userDayBounds, userTomorrowStart } from "../userTime";

// Z-174: granice doby w strefie użytkownika (instanty UTC). Testy deterministyczne
// — tz i base podawane jawnie, więc niezależne od strefy runnera. Pilnują fixu
// „zadanie przesunięte o dzień" (doba liczona w strefie usera, nie serwera/UTC).

test("UTC: granice doby to 00:00:00.000 – 23:59:59.999 tego samego dnia", () => {
  const { start, end } = userDayBounds("UTC", new Date("2026-06-15T12:00:00Z"));
  assert.equal(start.toISOString(), "2026-06-15T00:00:00.000Z");
  assert.equal(end.toISOString(), "2026-06-15T23:59:59.999Z");
});

test("Europe/Warsaw lato (CEST, UTC+2): północ lokalna = 22:00 UTC dnia poprzedniego", () => {
  const { start, end } = userDayBounds("Europe/Warsaw", new Date("2026-06-15T12:00:00Z"));
  assert.equal(start.toISOString(), "2026-06-14T22:00:00.000Z");
  assert.equal(end.toISOString(), "2026-06-15T21:59:59.999Z");
});

test("Europe/Warsaw zima (CET, UTC+1): północ lokalna = 23:00 UTC dnia poprzedniego", () => {
  const { start } = userDayBounds("Europe/Warsaw", new Date("2026-01-15T12:00:00Z"));
  assert.equal(start.toISOString(), "2026-01-14T23:00:00.000Z");
});

test("Późny instant UTC trafia w poprawny dzień LOKALNY (fix przesunięcia o dzień)", () => {
  // 23:30Z = już 01:30 następnego dnia w Warszawie (lato) → doba to 16., nie 15.
  const { start } = userDayBounds("Europe/Warsaw", new Date("2026-06-15T23:30:00Z"));
  assert.equal(start.toISOString(), "2026-06-15T22:00:00.000Z"); // północ 16. czasu warszawskiego
});

test("userTomorrowStart = koniec dziś + 1 ms (początek jutra)", () => {
  const base = new Date("2026-06-15T12:00:00Z");
  const { end } = userDayBounds("Europe/Warsaw", base);
  assert.equal(userTomorrowStart("Europe/Warsaw", base).getTime(), end.getTime() + 1);
  assert.equal(userTomorrowStart("Europe/Warsaw", base).toISOString(), "2026-06-15T22:00:00.000Z");
});
