import { test } from "node:test";
import assert from "node:assert/strict";
import { dataWStrefie } from "@/lib/userTime";

/**
 * 106 — reguła „nie częściej niż raz dziennie" stoi na tej funkcji. Interesuje nas jedno:
 * czy DZIEŃ liczy się w strefie użytkownika, a nie serwera.
 */

test("format to YYYY-MM-DD", () => {
  assert.match(dataWStrefie("Europe/Warsaw", new Date("2026-08-26T12:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});

test("dzień liczy się w STREFIE, nie w UTC", () => {
  // 22:30 UTC to w Warszawie już następny dzień (lato, UTC+2).
  const wieczor = new Date("2026-08-26T22:30:00Z");
  assert.equal(dataWStrefie("Europe/Warsaw", wieczor), "2026-08-27");
  assert.equal(dataWStrefie("UTC", wieczor), "2026-08-26");
});

test("ta sama chwila w różnych strefach bywa różnym dniem", () => {
  const chwila = new Date("2026-08-26T01:00:00Z");
  assert.equal(dataWStrefie("Europe/Warsaw", chwila), "2026-08-26");
  assert.equal(dataWStrefie("America/Los_Angeles", chwila), "2026-08-25");
});
