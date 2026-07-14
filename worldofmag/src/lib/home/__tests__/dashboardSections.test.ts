import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeSectionKeys, DASHBOARD_SECTIONS } from "@/lib/home/dashboardSections";

// Z-218: whitelist kluczy sekcji pulpitu — literówki/duplikaty nie tworzą martwych pozycji.
test("przepuszcza znane klucze, zachowuje kolejność wejścia", () => {
  assert.deepEqual(sanitizeSectionKeys(["today", "modules"]), ["today", "modules"]);
});

test("odrzuca nieznane klucze (literówka)", () => {
  assert.deepEqual(sanitizeSectionKeys(["today", "todey", "modulez", "modules"]), ["today", "modules"]);
});

test("usuwa duplikaty (pierwsze wystąpienie wygrywa)", () => {
  assert.deepEqual(sanitizeSectionKeys(["today", "today", "modules"]), ["today", "modules"]);
});

test("wejście nie-tablicowe / złe typy → pusta lista", () => {
  assert.deepEqual(sanitizeSectionKeys(null), []);
  assert.deepEqual(sanitizeSectionKeys("today"), []);
  assert.deepEqual(sanitizeSectionKeys([1, 2, {}, null]), []);
});

test("wszystkie domyślne sekcje są akceptowane", () => {
  const all = [...DASHBOARD_SECTIONS];
  assert.deepEqual(sanitizeSectionKeys(all), all);
});
