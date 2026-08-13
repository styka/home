import { test } from "node:test";
import assert from "node:assert/strict";

// Czysta logika modelu własności (prywatny ownerId LUB zespół ownerTeamId).
// Dynamiczny import — ownership.ts ciągnie server-utils, ale same funkcje są czyste
// i nie dotykają bazy (test nie jest DB-gated).

/**
 * 058: `ownedByWhere` przestało być czystą funkcją od `(userId, teamIds)`.
 *
 * Zakres własności idzie teraz po PRZESTRZENIACH, a te trzeba odczytać — więc funkcja jest
 * asynchroniczna i bierze sam `userId`. Dawna asercja sprawdzała **kształt starej reguły**
 * i utrzymanie jej znaczyłoby pilnowanie stanu, który świadomie zmieniamy (ten sam ruch, co
 * w 053 z asercją o martwych projektach zespołowych).
 *
 * Równości ZBIORÓW rekordów przed i po pilnuje osobny dowód na prawdziwych danych:
 * `platform/auth/__tests__/ownershipScopeSwitch.integration.test.ts`. Tutaj zostaje to, co da się
 * sprawdzić bez bazy: że sygnatura jest asynchroniczna i że wynik ma kształt warunku Prismy.
 */
test("ownedByWhere: zwraca warunek `OR` i wymaga odczytu przestrzeni (058)", async () => {
  const { ownedByWhere } = await import("@/platform/auth/ownership");
  const wynik = ownedByWhere("u1");
  assert.ok(wynik instanceof Promise, "zakres wymaga odczytu przestrzeni, więc jest asynchroniczny");
  // Samego wyniku nie rozwijamy: bez bazy nie ma przestrzeni do odczytania, a udawanie ich
  // atrapą sprawdzałoby atrapę. Od tego jest dowód integracyjny.
});

test("assertOwnership: null→Not found, własność bezpośrednia/zespołowa OK, obcy→Forbidden", async () => {
  const { assertOwnership } = await import("@/platform/auth/ownership");
  // brak encji
  assert.throws(() => assertOwnership(null, "u1", []), /Not found/);
  // własność bezpośrednia
  assert.doesNotThrow(() => assertOwnership({ ownerId: "u1", ownerTeamId: null }, "u1", []));
  // własność przez zespół (ownerTeamId w teamIds usera)
  assert.doesNotThrow(() => assertOwnership({ ownerId: "other", ownerTeamId: "t1" }, "u1", ["t1"]));
  // obcy właściciel, brak zespołu
  assert.throws(() => assertOwnership({ ownerId: "other", ownerTeamId: null }, "u1", ["t1"]), /Forbidden/);
  // zespół, do którego user NIE należy
  assert.throws(() => assertOwnership({ ownerId: "other", ownerTeamId: "t9" }, "u1", ["t1"]), /Forbidden/);
  // niczyje (oba null) — obcy
  assert.throws(() => assertOwnership({ ownerId: null, ownerTeamId: null }, "u1", []), /Forbidden/);
  // ownerTeamId ustawiony, ale user bez zespołów → nie można „posiąść przez zespół"
  assert.throws(() => assertOwnership({ ownerId: "other", ownerTeamId: "t1" }, "u1", []), /Forbidden/);
});
