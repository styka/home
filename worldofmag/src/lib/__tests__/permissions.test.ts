import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPermission, permissionForPath, isPathLocked, PERMISSIONS } from "../permissions";
import type { Session } from "next-auth";

// Z-174: rdzeń RBAC (kontrola dostępu) — pure, security-critical.
const sess = (perms: string[]) => ({ user: { permissions: perms } }) as unknown as Session;

test("hasPermission: ma / nie ma / brak sesji", () => {
  assert.equal(hasPermission(sess(["module.tasks"]), "module.tasks"), true);
  assert.equal(hasPermission(sess(["module.tasks"]), "module.admin"), false);
  assert.equal(hasPermission(null, "module.tasks"), false);
  assert.equal(hasPermission(undefined, "module.tasks"), false);
  assert.equal(hasPermission(sess([]), "module.tasks"), false);
});

test("permissionForPath: mapuje prefiks ścieżki na uprawnienie", () => {
  assert.equal(permissionForPath("/"), PERMISSIONS.HOME);
  assert.equal(permissionForPath(""), PERMISSIONS.HOME);
  assert.equal(permissionForPath("/shopping/abc"), PERMISSIONS.SHOPPING);
  assert.equal(permissionForPath("/admin/access"), PERMISSIONS.ADMIN);
  assert.equal(permissionForPath("/wiadomosci"), PERMISSIONS.NEWS);
  assert.equal(permissionForPath("/pogoda"), PERMISSIONS.WEATHER);
  assert.equal(permissionForPath("/magazynowanie/scan"), PERMISSIONS.MAGAZYNOWANIE);
  assert.equal(permissionForPath("/nieistnieje"), null);
});

test("isPathLocked: zablokowane gdy brak wymaganego uprawnienia", () => {
  assert.equal(isPathLocked(["module.tasks"], "/tasks/all"), false, "ma dostęp");
  assert.equal(isPathLocked([], "/tasks/all"), true, "brak uprawnienia → zablokowane");
  assert.equal(isPathLocked(["module.admin"], "/admin/llm"), false);
  assert.equal(isPathLocked([], "/admin/llm"), true, "admin chroniony");
  assert.equal(isPathLocked([], "/nieistnieje"), false, "ścieżka bez wymaganego uprawnienia → niezablokowana");
});
