import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORKSHOP_TYPES,
  WORKSHOP_TYPE_IDS,
  EQUIPMENT_SUGGESTIONS,
  getWorkshopType,
  getSuggestions,
  KIND_LABELS,
  TIER_LABELS,
} from "@/lib/warsztat/catalog";

// Katalog warsztatów = statyczne dane „łatwe do rozbudowy" → testy pilnują spójności,
// żeby dopisanie typu/pozycji nie wprowadziło cicho błędu (zwł. duplikatu `key`,
// który łączy podpowiedź z `WorkshopItem.suggestionKey`).

test("getWorkshopType: znany id → ten typ; nieznany/pusty → fallback 'ogolny'", () => {
  assert.equal(getWorkshopType("stolarski").id, "stolarski");
  assert.equal(getWorkshopType("nie-istnieje").id, "ogolny");
  assert.equal(getWorkshopType("").id, "ogolny");
});

test("getSuggestions: znany typ → jego lista; nieznany → lista 'ogolny'", () => {
  assert.equal(getSuggestions("stolarski"), EQUIPMENT_SUGGESTIONS.stolarski);
  assert.equal(getSuggestions("nieznany"), EQUIPMENT_SUGGESTIONS.ogolny);
  assert.ok(getSuggestions("samochodowy").length > 0);
});

test("WORKSHOP_TYPE_IDS odpowiada WORKSHOP_TYPES", () => {
  assert.deepEqual(WORKSHOP_TYPE_IDS, WORKSHOP_TYPES.map((t) => t.id));
});

test("każdy typ warsztatu ma niepustą listę podpowiedzi (spójność katalogu)", () => {
  for (const t of WORKSHOP_TYPES) {
    assert.ok(EQUIPMENT_SUGGESTIONS[t.id], `brak EQUIPMENT_SUGGESTIONS dla '${t.id}'`);
    assert.ok(EQUIPMENT_SUGGESTIONS[t.id].length > 0, `pusta lista dla '${t.id}'`);
  }
});

test("klucze podpowiedzi UNIKALNE w obrębie typu (łączą się z WorkshopItem.suggestionKey)", () => {
  for (const [typeId, list] of Object.entries(EQUIPMENT_SUGGESTIONS)) {
    const keys = list.map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length, `duplikat key w typie '${typeId}'`);
  }
});

test("każda podpowiedź ma komplet pól + poprawny kind/tier (z etykiet)", () => {
  for (const [typeId, list] of Object.entries(EQUIPMENT_SUGGESTIONS)) {
    for (const s of list) {
      assert.ok(s.name && s.key && s.category, `niepełna pozycja w '${typeId}'`);
      assert.ok(s.kind in KIND_LABELS, `zły kind '${s.kind}' w '${typeId}'`);
      assert.ok(s.tier in TIER_LABELS, `zły tier '${s.tier}' w '${typeId}'`);
    }
  }
});
