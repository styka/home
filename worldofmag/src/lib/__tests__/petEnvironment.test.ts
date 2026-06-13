import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyValue, rangeFor } from "../petEnvironment";

test("wartość w zakresie → ok (temp. ciepła 28-40)", () => {
  assert.equal(classifyValue("tempWarmC", 34), "ok");
});

test("lekko poza zakresem → warn", () => {
  // max 40, +15% = 46. 42 > 40 ale < 46 → warn.
  assert.equal(classifyValue("tempWarmC", 42), "warn");
});

test("mocno poza zakresem → danger", () => {
  // 47 > 46 (40*1.15) → danger.
  assert.equal(classifyValue("tempWarmC", 47), "danger");
});

test("poniżej minimum: warn vs danger (min 28, *0.85=23.8)", () => {
  assert.equal(classifyValue("tempWarmC", 26), "warn"); // 26 < 28 ale > 23.8
  assert.equal(classifyValue("tempWarmC", 20), "danger"); // < 23.8
});

test("null → ok (brak odczytu nie alarmuje)", () => {
  assert.equal(classifyValue("tempWarmC", null), "ok");
  assert.equal(classifyValue("tempWarmC", undefined), "ok");
});

test("nieznany parametr → ok", () => {
  assert.equal(classifyValue("nieznane", 999), "ok");
});

test("custom range nadpisuje domyślny", () => {
  const custom = { tempWarmC: { min: 30, max: 32 } };
  assert.equal(classifyValue("tempWarmC", 31, custom), "ok");
  assert.equal(classifyValue("tempWarmC", 40, custom), "danger"); // 40 > 32*1.15=36.8
  assert.equal(rangeFor("tempWarmC", custom)?.max, 32);
});

test("rangeFor zwraca domyślny gdy brak custom", () => {
  assert.equal(rangeFor("humidityPct")?.min, 40);
});
