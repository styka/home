import { test } from "node:test";
import assert from "node:assert/strict";
import { currentDayPart, presetByKey, WEATHER_PRESETS, HORIZON_META, DAY_PARTS, FALLBACK_LOCATION } from "@/lib/weather/presets";

const at = (h: number) => {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d;
};

test("currentDayPart: granice pór dnia (rano/południe/popołudnie/wieczór + brzegi)", () => {
  assert.equal(currentDayPart(at(0)), "morning", "00:00 → rano (gałąź else h<6)");
  assert.equal(currentDayPart(at(5)), "morning");
  assert.equal(currentDayPart(at(6)), "morning", "6 = początek 'rano' (włącznie)");
  assert.equal(currentDayPart(at(10)), "morning");
  assert.equal(currentDayPart(at(11)), "noon", "11 = przejście na 'południe'");
  assert.equal(currentDayPart(at(14)), "noon");
  assert.equal(currentDayPart(at(15)), "afternoon");
  assert.equal(currentDayPart(at(18)), "afternoon");
  assert.equal(currentDayPart(at(19)), "evening");
  assert.equal(currentDayPart(at(22)), "evening");
  assert.equal(currentDayPart(at(23)), "evening", "23 poza zakresami → else (h>=6) → wieczór");
});

test("presetByKey: znany klucz zwraca preset, nieznany → undefined", () => {
  const p = presetByKey("running");
  assert.equal(p?.title, "Bieganie");
  assert.equal(p?.horizon, "today");
  assert.equal(presetByKey("nieistniejacy"), undefined);
});

test("WEATHER_PRESETS: klucze unikalne, horyzonty znane, pola niepuste", () => {
  const keys = WEATHER_PRESETS.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length, "klucze unikalne");
  for (const p of WEATHER_PRESETS) {
    assert.ok(HORIZON_META[p.horizon], `horizon znany: ${p.horizon}`);
    assert.ok(p.title.length > 0 && p.emoji.length > 0 && p.query.length > 0, `pola niepuste: ${p.key}`);
  }
});

test("DAY_PARTS i FALLBACK_LOCATION: spójność danych", () => {
  // zakresy DAY_PARTS są rozłączne i rosnące
  for (let i = 1; i < DAY_PARTS.length; i++) {
    assert.ok(DAY_PARTS[i].from >= DAY_PARTS[i - 1].to, "zakresy nie nachodzą");
  }
  assert.equal(FALLBACK_LOCATION.label, "Warszawa");
  assert.ok(Number.isFinite(FALLBACK_LOCATION.lat) && Number.isFinite(FALLBACK_LOCATION.lon));
});
