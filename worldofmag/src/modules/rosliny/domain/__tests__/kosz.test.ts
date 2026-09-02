import { test } from "node:test";
import assert from "node:assert/strict";
import { dataZMigawki, wierszRoslinyZMigawki } from "../kosz";

const migawka = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  workspaceId: "w1",
  spaceId: "s1",
  placeId: "m1",
  name: "Monstera",
  quantity: 3,
  quantityUnit: "szt",
  status: "DEAD",
  statusReason: "przelana",
  statusAt: "2026-03-04T10:00:00.000Z",
  sownAt: "2025-04-01T00:00:00.000Z",
  ...over,
});

test("daty z migawki wracają jako daty, a śmieci jako brak", () => {
  assert.equal(dataZMigawki("2026-03-04T10:00:00.000Z")?.toISOString(), "2026-03-04T10:00:00.000Z");
  assert.equal(dataZMigawki(null), null);
  assert.equal(dataZMigawki("wczoraj"), null);
  assert.equal(dataZMigawki({}), null);
});

test("daty życia rośliny są ODTWARZANE, nie zerowane", () => {
  // Bez tego roślina wraca jako posadzona dzisiaj i psuje ostrzeżenie płodozmianowe całego miejsca.
  const w = wierszRoslinyZMigawki(migawka(), "m1");
  assert.equal(w.sownAt?.getUTCFullYear(), 2025);
  assert.equal(w.statusAt?.toISOString(), "2026-03-04T10:00:00.000Z");
  assert.equal(w.statusReason, "przelana");
  assert.equal(w.status, "DEAD");
});

test("miejsce pochodzi z PARAMETRU — migawka nie wie, czy odwołanie jest wciąż prawdziwe", () => {
  // Roślina wraca sama, jej miejsce nie: zapis z `placeId` z migawki odbiłby się od klucza obcego.
  assert.equal(wierszRoslinyZMigawki(migawka(), null).placeId, null);
  assert.equal(wierszRoslinyZMigawki(migawka(), "m1").placeId, "m1");
});

test("braki uzupełniamy tylko tam, gdzie domyślna nie zmienia znaczenia", () => {
  const w = wierszRoslinyZMigawki({ id: "r2", workspaceId: "w1", spaceId: "s1" }, null);
  assert.equal(w.quantity, 1);
  assert.equal(w.quantityUnit, "szt");
  assert.equal(w.status, "ACTIVE");
  assert.equal(w.name, "");
  assert.equal(w.sownAt, null);
});

test("liczność zero i pusta jednostka to braki, nie wartości", () => {
  const w = wierszRoslinyZMigawki(migawka({ quantity: 0, quantityUnit: "" }), null);
  assert.equal(w.quantity, 1);
  assert.equal(w.quantityUnit, "szt");
});

test("migawka bez przestrzeni albo bez identyfikatora nie ma gdzie wrócić", () => {
  assert.throws(() => wierszRoslinyZMigawki({ id: "r1", workspaceId: "w1" }, null), /Uszkodzona migawka/);
  assert.throws(() => wierszRoslinyZMigawki({ workspaceId: "w1", spaceId: "s1" }, null), /Uszkodzona migawka/);
});
