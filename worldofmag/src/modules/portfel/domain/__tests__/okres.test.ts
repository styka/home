import { test } from "node:test";
import assert from "node:assert/strict";
import { startOfMonth, monthRange } from "../okres";

/** Lokalna data jako `RRRR-MM-DD HH:MM` — bez UTC, bo reguła celowo liczy w strefie lokalnej. */
const lokalnie = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ` +
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

test("początek miesiąca to północ pierwszego dnia", () => {
  assert.equal(lokalnie(startOfMonth(new Date(2026, 6, 23, 14, 35))), "2026-07-01 00:00");
});

test("początek miesiąca policzony z ostatniego dnia nie przeskakuje dalej", () => {
  assert.equal(lokalnie(startOfMonth(new Date(2026, 0, 31, 23, 59))), "2026-01-01 00:00");
});

test("bieżący miesiąc: przedział obejmuje cały miesiąc", () => {
  const { start, end } = monthRange(0, new Date(2026, 4, 17, 9, 0));
  assert.equal(lokalnie(start), "2026-05-01 00:00");
  assert.equal(lokalnie(end), "2026-06-01 00:00");
});

test("PRZEŁOM ROKU WSTECZ — offset cofa ze stycznia do grudnia roku poprzedniego", () => {
  // Przypadek, dla którego ta reguła w ogóle wyszła z pliku akcji: przy `now` w styczniu
  // `getMonth() - 1` daje -1, a poprawność zależy od tego, że `Date` normalizuje to na grudzień
  // roku poprzedniego. Bez testu trzeba by na to czekać do stycznia.
  const { start, end } = monthRange(1, new Date(2026, 0, 12, 8, 0));
  assert.equal(lokalnie(start), "2025-12-01 00:00");
  assert.equal(lokalnie(end), "2026-01-01 00:00");
});

test("cofnięcie o kilkanaście miesięcy przechodzi przez rok bez osobnej gałęzi", () => {
  const { start, end } = monthRange(14, new Date(2026, 2, 5, 12, 0));
  assert.equal(lokalnie(start), "2025-01-01 00:00");
  assert.equal(lokalnie(end), "2025-02-01 00:00");
});

test("ujemny offset sięga w przyszłość, też przez przełom roku", () => {
  const { start, end } = monthRange(-1, new Date(2026, 11, 20, 12, 0));
  assert.equal(lokalnie(start), "2027-01-01 00:00");
  assert.equal(lokalnie(end), "2027-02-01 00:00");
});

test("przedział jest otwarty z prawej — ostatnia doba miesiąca nie wypada z rozliczenia", () => {
  // `end` to północ 1. dnia NASTĘPNEGO miesiąca. Gdyby wskazywał ostatni dzień, wpis z 31 stycznia
  // 23:59 nie trafiłby do stycznia.
  const { start, end } = monthRange(0, new Date(2026, 0, 15, 12, 0));
  const ostatniaChwila = new Date(2026, 0, 31, 23, 59, 59);
  assert.ok(ostatniaChwila >= start && ostatniaChwila < end);
  const pierwszaLutego = new Date(2026, 1, 1, 0, 0, 0);
  assert.ok(pierwszaLutego >= end);
});

test("luty w roku przestępnym mieści 29 dni", () => {
  const { start, end } = monthRange(0, new Date(2028, 1, 10, 12, 0));
  assert.equal(lokalnie(start), "2028-02-01 00:00");
  assert.equal(lokalnie(end), "2028-03-01 00:00");
  const dwudziestyDziewiaty = new Date(2028, 1, 29, 12, 0);
  assert.ok(dwudziestyDziewiaty < end);
});

test("bez podanego czasu odniesienia reguła nadal działa — domyślny zegar", () => {
  // Dowód, że parametryzacja z AC-8 nie zmieniła wywołania w akcji: `monthRange(0)` działa dalej.
  const { start, end } = monthRange(0);
  assert.ok(start < end);
  assert.equal(start.getDate(), 1);
  assert.equal(end.getDate(), 1);
});
