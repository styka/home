import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHARE_CAPABILITIES,
  getShareCapability,
  canShare,
  isShareable,
  SHARE_MECHANISM_LABELS,
} from "@/lib/sharing/capabilities";

// Z-193 — testowalny rdzeń ujednoliconego „Udostępnij" (mapa zdolności modułów).

test("getShareCapability: znany moduł → opis; user-only/nieznany → null", () => {
  assert.equal(getShareCapability("tasks")?.module, "tasks");
  assert.equal(getShareCapability("stores"), null);
  assert.equal(getShareCapability("news"), null);
  assert.equal(getShareCapability("nieznany"), null);
});

test("canShare: tasks ma entity+projectMembers, shopping tylko team, stores nic", () => {
  assert.equal(canShare("tasks", "entity"), true);
  assert.equal(canShare("tasks", "projectMembers"), true);
  assert.equal(canShare("shopping", "entity"), false);
  assert.equal(canShare("shopping", "team"), true);
  assert.equal(canShare("stores", "team"), false);
});

test("isShareable: moduły team-owned tak, user-only nie", () => {
  assert.equal(isShareable("notes"), true);
  assert.equal(isShareable("pets"), true);
  assert.equal(isShareable("weather"), false);
});

test("każda zdolność: module==klucz, niepuste mechanizmy z poprawnymi etykietami", () => {
  for (const [id, cap] of Object.entries(SHARE_CAPABILITIES)) {
    assert.equal(cap.module, id);
    assert.ok(cap.entityLabel, `brak entityLabel dla ${id}`);
    assert.ok(cap.mechanisms.length > 0, `puste mechanisms dla ${id}`);
    for (const m of cap.mechanisms) assert.ok(m in SHARE_MECHANISM_LABELS, `zła etykieta mechanizmu ${m}`);
  }
});

test("sharing per-encja (entity) tylko dla tasks i pets", () => {
  const entityModules = Object.values(SHARE_CAPABILITIES)
    .filter((c) => c.mechanisms.includes("entity"))
    .map((c) => c.module)
    .sort();
  assert.deepEqual(entityModules, ["pets", "tasks"]);
});
