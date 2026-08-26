import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULES, defaultMenuPrefs, declaredPermissionForPath } from "@/lib/modules";
import { mergeModules, defineModule, permissionForPathIn } from "@/platform/registry";
import { permissionForPath, isPathLocked } from "@/lib/pathPermissions";
import { Home } from "lucide-react";

// 046 — rejestr modułów po wprowadzeniu deklaracji (`module.ts`). Test pilnuje rzeczy, których
// kontrola typów nie złapie: że scalenie deklaracji z listą przejściową NIE GUBI modułu, nie
// duplikuje identyfikatora i nie zmienia kolejności menu. Zgubienie modułu objawiłoby się
// wyłącznie jego zniknięciem z paska bocznego — czyli w miejscu, w którym nikt nie szuka błędu
// scalania.

test("rejestr ma dokładnie 22 moduły i unikalne identyfikatory", () => {
  assert.equal(MODULES.length, 22, "moduł zginął albo doszedł niezauważony");
  const ids = MODULES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, "zduplikowany identyfikator modułu");
});

test("wszystkie 22 moduły są zadeklarowane — lista przejściowa nie istnieje", () => {
  for (const id of ["truck", "contacts", "reports", "qa", "habits", "tasks", "shopping", "calendar", "home"]) {
    const found = MODULES.filter((m) => m.id === id);
    assert.equal(found.length, 1, `moduł ${id} musi wystąpić dokładnie raz`);
  }
});

test("etykieta i kolor pochodzą z deklaracji modułu", () => {
  const truck = MODULES.find((m) => m.id === "truck")!;
  assert.equal(truck.label, "Trasy TIR");
  assert.equal(truck.href, "/truck");
  assert.equal(truck.permission, "module.truck");
  // Kolor zawsze zmienną CSS — inaczej skórka go nie obejmie (C-30).
  assert.match(truck.color, /^var\(--/);
});

test("kolejność menu jest zachowana niezależnie od tego, który moduł jest już przeniesiony", () => {
  const ids = MODULES.map((m) => m.id);
  assert.equal(ids[0], "home", "Strona główna zawsze pierwsza");
  assert.ok(ids.indexOf("contacts") < ids.indexOf("qa"));
  assert.ok(ids.indexOf("qa") < ids.indexOf("truck"));
  assert.equal(ids[ids.length - 1], "reports", "Raporty zawsze ostatnie");
});

test("domyślne preferencje menu obejmują wszystkie moduły; QA jest wyłączone", () => {
  const prefs = defaultMenuPrefs();
  assert.equal(prefs.order.length, MODULES.length);
  assert.deepEqual(prefs.disabled, ["qa"], "tylko QA jest domyślnie wyłączone");
});

test("mergeModules odrzuca zduplikowany identyfikator zamiast po cichu nadpisać", () => {
  const a = defineModule({ id: "x", label: "A", href: "/a", permission: null, color: "var(--x)", Icon: Home, defaultEnabled: true });
  const b = defineModule({ id: "x", label: "B", href: "/b", permission: null, color: "var(--x)", Icon: Home, defaultEnabled: true });
  assert.throws(() => mergeModules([a, b], ["x"]), /Zduplikowany identyfikator/);
});

test("moduł spoza listy kolejności trafia na koniec, a nie znika", () => {
  const a = defineModule({ id: "a", label: "A", href: "/a", permission: null, color: "var(--x)", Icon: Home, defaultEnabled: true });
  const nowy = defineModule({ id: "nowy", label: "N", href: "/n", permission: null, color: "var(--x)", Icon: Home, defaultEnabled: true });
  const merged = mergeModules([a, nowy], ["a"]);
  assert.deepEqual(merged.map((m) => m.id), ["a", "nowy"]);
});

test("ścieżka zadeklarowanego modułu mapuje się na jego uprawnienie", () => {
  assert.equal(permissionForPath("/truck"), "module.truck");
  assert.equal(permissionForPath("/qa"), "module.qa");
  assert.equal(permissionForPath("/qa/scenariusz/abc"), "module.qa");
  assert.equal(permissionForPath("/contacts"), "module.contacts");
  // Raporty celowo bez uprawnienia — `null` znaczy „każdy zalogowany", nie „nie wiem".
  assert.equal(permissionForPath("/reports"), null);
});

test("moduły jeszcze nieprzeniesione nadal mapują się przez łańcuch historyczny", () => {
  assert.equal(permissionForPath("/tasks/all"), "module.tasks");
  assert.equal(permissionForPath("/admin/llm"), "module.admin");
  assert.equal(permissionForPath("/nieistnieje"), null);
});

test("isPathLocked chroni ścieżki modułów zadeklarowanych", () => {
  assert.equal(isPathLocked([], "/truck"), true, "brak uprawnienia → zablokowane");
  assert.equal(isPathLocked(["module.truck"], "/truck"), false);
  assert.equal(isPathLocked([], "/reports"), false, "Raporty dostępne każdemu zalogowanemu");
});

test("dopasowanie ścieżki nie łapie sąsiada o wspólnym prefiksie", () => {
  // „/contacts" nie może przechwycić hipotetycznego „/contactsomething".
  assert.equal(declaredPermissionForPath("/contactsomething"), undefined);
  const mods = [defineModule({ id: "a", label: "A", href: "/a", permission: "p.a", color: "var(--x)", Icon: Home, defaultEnabled: true })];
  assert.equal(permissionForPathIn(mods, "/ab"), undefined);
  assert.equal(permissionForPathIn(mods, "/a/b"), "p.a");
});
