import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
// 046: mapowanie ścieżka → uprawnienie mieszka w korzeniu kompozycji, bo część modułów niesie je
// we własnej deklaracji, a platformie nie wolno importować modułów. Test celowo sprawdza wariant
// APLIKACYJNY — to on decyduje o dostępie w interfejsie.
import { permissionForPath, isPathLocked } from "@/lib/pathPermissions";
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
  // 047: Magazynowanie jest już modułem — jego slug mieszka w deklaracji, nie w PERMISSIONS.
  // Test sprawdza zachowanie widoczne dla użytkownika (ścieżka nadal chroniona tym samym slugiem),
  // a nie to, w którym pliku slug jest zapisany.
  assert.equal(permissionForPath("/magazynowanie/scan"), "module.magazynowanie");
  assert.equal(permissionForPath("/nieistnieje"), null);
});

test("isPathLocked: zablokowane gdy brak wymaganego uprawnienia", () => {
  assert.equal(isPathLocked(["module.tasks"], "/tasks/all"), false, "ma dostęp");
  assert.equal(isPathLocked([], "/tasks/all"), true, "brak uprawnienia → zablokowane");
  assert.equal(isPathLocked(["module.admin"], "/admin/llm"), false);
  assert.equal(isPathLocked([], "/admin/llm"), true, "admin chroniony");
  assert.equal(isPathLocked([], "/nieistnieje"), false, "ścieżka bez wymaganego uprawnienia → niezablokowana");
});
