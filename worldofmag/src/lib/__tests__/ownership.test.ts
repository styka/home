import { test } from "node:test";
import assert from "node:assert/strict";

// Czysta logika modelu własności (prywatny ownerId LUB zespół ownerTeamId).
// Dynamiczny import — ownership.ts ciągnie server-utils, ale same funkcje są czyste
// i nie dotykają bazy (test nie jest DB-gated).

test("ownedByWhere: pusty teamIds → tylko ownerId; z teamIds → dodaje ownerTeamId in", async () => {
  const { ownedByWhere } = await import("@/lib/ownership");
  assert.deepEqual(ownedByWhere("u1", []), { OR: [{ ownerId: "u1" }] });
  assert.deepEqual(ownedByWhere("u1", ["t1", "t2"]), {
    OR: [{ ownerId: "u1" }, { ownerTeamId: { in: ["t1", "t2"] } }],
  });
});

test("assertOwnership: null→Not found, własność bezpośrednia/zespołowa OK, obcy→Forbidden", async () => {
  const { assertOwnership } = await import("@/lib/ownership");
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
