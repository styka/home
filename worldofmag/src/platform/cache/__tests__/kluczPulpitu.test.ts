import { test } from "node:test";
import assert from "node:assert/strict";
import { kluczPulpitu, odciskUprawnien } from "@/lib/cacheAgregatow";

/**
 * 085 (zadanie 29) — KLUCZ CACHE'U MIGAWKI PULPITU.
 *
 * Migawka zawiera wyłącznie moduły, do których użytkownik ma prawo. Gdyby uprawnienia nie wchodziły
 * do klucza, odebranie dostępu zostawiłoby dane modułu w cache'u i pokazywałoby je do wygaśnięcia
 * wpisu — ta sama klasa błędu, przed którą ostrzega rozdz. 11.1.3, tylko że tutaj do uniknięcia
 * bez żadnego mechanizmu unieważniania. Dlatego klucz jest wydzieloną funkcją: żeby dało się to
 * sprawdzić, a nie tylko przeczytać.
 */
test("różne uprawnienia dają różny klucz", () => {
  const a = kluczPulpitu("u1", "s1", ["module.tasks", "module.notes"]);
  const b = kluczPulpitu("u1", "s1", ["module.tasks"]);
  assert.notDeepEqual(a, b, "odebranie uprawnienia musi zmienić klucz, inaczej dane zostaną w cache'u");
});

test("kolejność uprawnień nie zmienia klucza", () => {
  // Sesja nie gwarantuje kolejności. Bez sortowania ten sam użytkownik miałby dwa różne wpisy
  // i cache trafiałby losowo — objawem byłby „pulpit czasem szybki, czasem wolny".
  assert.deepEqual(
    kluczPulpitu("u1", "s1", ["module.notes", "module.tasks"]),
    kluczPulpitu("u1", "s1", ["module.tasks", "module.notes"]),
  );
});

test("różny użytkownik i różny stempel dają różny klucz", () => {
  assert.notDeepEqual(kluczPulpitu("u1", "s1", []), kluczPulpitu("u2", "s1", []));
  assert.notDeepEqual(kluczPulpitu("u1", "s1", []), kluczPulpitu("u1", "s2", []));
});

test("odcisk nie ujawnia listy uprawnień", () => {
  // Klucze cache'u trafiają do nazw plików na dysku instancji. Pełna lista uprawnień w nazwie
  // pliku to niepotrzebny wyciek informacji o koncie.
  const odcisk = odciskUprawnien(["module.admin", "module.health"]);
  assert.ok(!odcisk.includes("admin") && !odcisk.includes("health"));
  assert.ok(odcisk.length <= 8);
});
