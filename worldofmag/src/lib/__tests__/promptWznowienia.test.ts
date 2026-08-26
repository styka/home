import { test } from "node:test";
import assert from "node:assert/strict";
import { czytajPokazane, czyPokazanoDzisiaj, zapiszPokazane } from "@/lib/promptWznowienia";

/**
 * 106 — reguła „nie częściej niż raz dziennie".
 *
 * Testujemy tu trzy rzeczy, z których każda ma swój tryb awarii w produkcji: uszkodzony wpis
 * (nie może zablokować dialogu na zawsze), porównanie dat (a nie znaczników czasu) oraz to, że
 * odnotowanie jednego promptu nie kasuje pozostałych.
 */

test("pusty i uszkodzony wpis czyta się jako pusta mapa", () => {
  assert.deepEqual(czytajPokazane(undefined), {});
  assert.deepEqual(czytajPokazane(""), {});
  assert.deepEqual(czytajPokazane("{nie-json"), {});
  // Tablica i liczba to poprawny JSON, ale nie mapa — nie mogą udawać wpisów.
  assert.deepEqual(czytajPokazane("[1,2]"), {});
  assert.deepEqual(czytajPokazane("7"), {});
});

test("pojedyncza zła wartość nie unieważnia pozostałych wpisów", () => {
  assert.deepEqual(czytajPokazane('{"a":"2026-08-26","b":5}'), { a: "2026-08-26" });
});

test("pokazany dziś tylko wtedy, gdy data jest identyczna", () => {
  const mapa = '{"csp":"2026-08-26"}';
  assert.equal(czyPokazanoDzisiaj(mapa, "csp", "2026-08-26"), true);
  assert.equal(czyPokazanoDzisiaj(mapa, "csp", "2026-08-27"), false);
  assert.equal(czyPokazanoDzisiaj(mapa, "inny", "2026-08-26"), false);
  assert.equal(czyPokazanoDzisiaj(null, "csp", "2026-08-26"), false);
});

test("zapis dokłada wpis, nie kasując pozostałych", () => {
  const wynik = zapiszPokazane('{"stary":"2026-01-01"}', "csp", "2026-08-26");
  assert.deepEqual(JSON.parse(wynik), { stary: "2026-01-01", csp: "2026-08-26" });
});

test("zapis nadpisuje datę tego samego promptu", () => {
  const wynik = zapiszPokazane('{"csp":"2026-08-25"}', "csp", "2026-08-26");
  assert.deepEqual(JSON.parse(wynik), { csp: "2026-08-26" });
});
