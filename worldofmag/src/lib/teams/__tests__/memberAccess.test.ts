import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PARENT_ROLES,
  RESTRICTABLE_MODULES,
  isRestrictableModule,
  parseModuleAccess,
  serializeModuleAccess,
  canMemberAccessModule,
} from "@/lib/teams/memberAccess";

// Z-194 (T-12) — testowalny rdzeń granularnych ról rodzic/dziecko w zespole.

test("RESTRICTABLE_MODULES = moduły współdzielone przez zespół (mechanizm team)", () => {
  // Powinno pokrywać team-owned moduły, a NIE user-only (stores/news/weather).
  assert.ok(RESTRICTABLE_MODULES.includes("tasks"));
  assert.ok(RESTRICTABLE_MODULES.includes("shopping"));
  assert.ok(RESTRICTABLE_MODULES.includes("portfel"));
  assert.ok(!RESTRICTABLE_MODULES.includes("news"));
  assert.ok(!RESTRICTABLE_MODULES.includes("weather"));
  assert.ok(!RESTRICTABLE_MODULES.includes("stores"));
  // posortowane i bez duplikatów
  assert.deepEqual(RESTRICTABLE_MODULES, [...RESTRICTABLE_MODULES].sort());
  assert.equal(new Set(RESTRICTABLE_MODULES).size, RESTRICTABLE_MODULES.length);
});

test("isRestrictableModule: tylko moduły współdzielone", () => {
  assert.equal(isRestrictableModule("tasks"), true);
  assert.equal(isRestrictableModule("contacts"), true);
  assert.equal(isRestrictableModule("weather"), false);
  assert.equal(isRestrictableModule("nieznany"), false);
});

test("parseModuleAccess: null/puste/niepoprawne → null (brak ograniczeń)", () => {
  assert.equal(parseModuleAccess(null), null);
  assert.equal(parseModuleAccess(undefined), null);
  assert.equal(parseModuleAccess(""), null);
  assert.equal(parseModuleAccess("nie-json"), null);
  assert.equal(parseModuleAccess("{}"), null); // obiekt, nie tablica
  assert.equal(parseModuleAccess('"tasks"'), null); // string, nie tablica
});

test("parseModuleAccess: tablica filtruje do znanych modułów + deduplikuje", () => {
  assert.deepEqual(parseModuleAccess('["tasks","shopping"]'), ["tasks", "shopping"]);
  // odsiewa nieznane/śmieci, deduplikuje
  assert.deepEqual(parseModuleAccess('["tasks","weather","tasks",42,null]'), ["tasks"]);
  // pusta lista PO filtrze (niepuste wejście samych śmieci) = brak dostępu, NIE null
  assert.deepEqual(parseModuleAccess('["weather","news"]'), []);
});

test("parseModuleAccess: jawna pusta tablica → [] (brak dostępu), nie null", () => {
  assert.deepEqual(parseModuleAccess("[]"), []);
});

test("serializeModuleAccess: null→null, tablica→posortowany JSON tylko ze znanych", () => {
  assert.equal(serializeModuleAccess(null), null);
  assert.equal(serializeModuleAccess(undefined), null);
  assert.equal(serializeModuleAccess([]), "[]");
  assert.equal(serializeModuleAccess(["shopping", "tasks", "shopping"]), '["shopping","tasks"]');
  // odsiewa nieznane
  assert.equal(serializeModuleAccess(["tasks", "weather"]), '["tasks"]');
});

test("round-trip serialize→parse zachowuje zbiór modułów", () => {
  const raw = serializeModuleAccess(["portfel", "tasks"]);
  assert.deepEqual(parseModuleAccess(raw), ["portfel", "tasks"]);
});

test("canMemberAccessModule: rodzice (OWNER/ADMIN) zawsze mają dostęp", () => {
  for (const role of PARENT_ROLES) {
    // nawet z pustą listą (która dla dziecka = brak dostępu)
    assert.equal(canMemberAccessModule({ role, moduleAccess: "[]" }, "tasks"), true);
    assert.equal(canMemberAccessModule({ role, moduleAccess: '["shopping"]' }, "portfel"), true);
  }
});

test("canMemberAccessModule: dziecko bez ograniczeń (null) ma pełny dostęp", () => {
  assert.equal(canMemberAccessModule({ role: "MEMBER", moduleAccess: null }, "tasks"), true);
  assert.equal(canMemberAccessModule({ role: "MEMBER" }, "portfel"), true);
});

test("canMemberAccessModule: dziecko z listą — tylko wymienione moduły", () => {
  const child = { role: "MEMBER", moduleAccess: '["tasks","shopping"]' };
  assert.equal(canMemberAccessModule(child, "tasks"), true);
  assert.equal(canMemberAccessModule(child, "shopping"), true);
  assert.equal(canMemberAccessModule(child, "portfel"), false);
  assert.equal(canMemberAccessModule(child, "health"), false);
});

test("canMemberAccessModule: dziecko z pustą listą — brak dostępu do współdzielonych", () => {
  assert.equal(canMemberAccessModule({ role: "MEMBER", moduleAccess: "[]" }, "tasks"), false);
  assert.equal(canMemberAccessModule({ role: "MEMBER", moduleAccess: "[]" }, "shopping"), false);
});

test("canMemberAccessModule: moduł nieograniczalny zawsze dostępny (nawet dziecku z pustą listą)", () => {
  // weather/news/stores nie są współdzielone w zespole → restrykcja ich nie dotyczy
  assert.equal(canMemberAccessModule({ role: "MEMBER", moduleAccess: "[]" }, "weather"), true);
  assert.equal(canMemberAccessModule({ role: "MEMBER", moduleAccess: '["tasks"]' }, "news"), true);
});
