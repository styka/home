import { test } from "node:test";
import assert from "node:assert/strict";
import {
  suggestedPresetForSpecies, flagsForPreset, resolveFeatures, isFeatureEnabled,
  PET_FEATURE_KEYS, PET_PRESETS,
} from "@/lib/petPresets";

test("suggestedPresetForSpecies: mapowanie gatunku → preset (+ fallback)", () => {
  assert.equal(suggestedPresetForSpecies("snake"), "reptile_keeper");
  assert.equal(suggestedPresetForSpecies("lizard"), "reptile_keeper");
  assert.equal(suggestedPresetForSpecies("turtle"), "reptile_keeper");
  assert.equal(suggestedPresetForSpecies("fish"), "aquarium");
  assert.equal(suggestedPresetForSpecies("bird"), "bird");
  assert.equal(suggestedPresetForSpecies("rodent"), "small_mammal");
  assert.equal(suggestedPresetForSpecies("rabbit"), "small_mammal");
  assert.equal(suggestedPresetForSpecies("dog"), "companion");
  assert.equal(suggestedPresetForSpecies("cat"), "companion");
  assert.equal(suggestedPresetForSpecies("cokolwiek"), "companion", "nieznany → companion");
});

test("flagsForPreset: flagi presetu true, reszta false; nieznany preset → pierwszy", () => {
  const companion = flagsForPreset("companion");
  assert.equal(companion.HEALTH, true);
  assert.equal(companion.FEEDING, true);
  assert.equal(companion.HUSBANDRY, false, "companion bez terrarium");
  assert.equal(companion.GENETICS, false);
  for (const k of PET_FEATURE_KEYS) assert.equal(typeof companion[k], "boolean", `flaga obecna: ${k}`);

  const breeder = flagsForPreset("reptile_breeder");
  assert.equal(breeder.GENETICS, true);
  assert.equal(breeder.BREEDING, true);
  assert.equal(breeder.HUSBANDRY, true);

  assert.deepEqual(flagsForPreset("nieistniejacy"), flagsForPreset(PET_PRESETS[0].key), "fallback na pierwszy preset");
});

test("resolveFeatures: nadpisania JSON scalone nad presetem (włącz/wyłącz)", () => {
  assert.deepEqual(
    resolveFeatures({ presetKey: "companion", featureFlags: null }),
    flagsForPreset("companion"),
    "brak nadpisań → flagi presetu"
  );
  const on = resolveFeatures({ presetKey: "companion", featureFlags: JSON.stringify({ HUSBANDRY: true }) });
  assert.equal(on.HUSBANDRY, true, "nadpisanie włącza sekcję spoza presetu");
  assert.equal(on.HEALTH, true, "reszta presetu zachowana");
  const off = resolveFeatures({ presetKey: "companion", featureFlags: JSON.stringify({ FEEDING: false }) });
  assert.equal(off.FEEDING, false, "nadpisanie wyłącza sekcję presetu");
});

test("resolveFeatures: niepoprawny JSON → sam preset; nieznane klucze i nie-boolean pomijane", () => {
  assert.deepEqual(
    resolveFeatures({ presetKey: "companion", featureFlags: "}{ to nie json" }),
    flagsForPreset("companion"),
    "zły JSON → bezpieczny fallback na preset"
  );
  assert.deepEqual(
    resolveFeatures({ presetKey: "companion", featureFlags: JSON.stringify({ NIEISTNIEJE: true, HEALTH: "tak" }) }),
    flagsForPreset("companion"),
    "nieznany klucz + wartość nie-boolean nie zmieniają flag"
  );
});

test("isFeatureEnabled: zgodne z resolveFeatures", () => {
  assert.equal(isFeatureEnabled({ presetKey: "aquarium", featureFlags: null }, "AQUARIUM"), true);
  assert.equal(isFeatureEnabled({ presetKey: "aquarium", featureFlags: null }, "HUSBANDRY"), false);
  assert.equal(isFeatureEnabled({ presetKey: "companion", featureFlags: JSON.stringify({ GENETICS: true }) }, "GENETICS"), true);
});
