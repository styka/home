import { test } from "node:test";
import assert from "node:assert/strict";
import { countDistinctAdminHolders } from "@/lib/access/adminLockout";

// Z-176: zabezpieczenie przed self-lockoutem — admin nie może operacją RBAC
// doprowadzić do stanu, w którym nikt nie ma już dostępu do /admin.
const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"];

test("liczy RÓŻNYCH posiadaczy admina (deduplikacja po userId)", () => {
  const ur = [
    { userId: "u1", role: "ADMIN" },
    { userId: "u2", role: "ADMIN" },
    { userId: "u1", role: "SUPERADMIN" }, // ten sam user, druga rola → liczony raz
  ];
  assert.equal(countDistinctAdminHolders(ADMIN_ROLES, ur), 2);
});

test("pomija przypisania do ról spoza adminRoles", () => {
  const ur = [
    { userId: "u1", role: "ADMIN" },
    { userId: "u2", role: "EDITOR" }, // nie-admin → nie liczony
  ];
  assert.equal(countDistinctAdminHolders(ADMIN_ROLES, ur), 1);
});

test("excludeRoleGrant: gdy jedyna admin-rola przestanie nadawać admina → 0", () => {
  const ur = [
    { userId: "u1", role: "ADMIN" },
    { userId: "u2", role: "ADMIN" },
  ];
  // udajemy, że rola ADMIN już NIE daje module.admin
  assert.equal(countDistinctAdminHolders(["ADMIN"], ur, { excludeRoleGrant: "ADMIN" }), 0);
});

test("removeUserRole: odebranie roli jednemu z dwóch adminów → zostaje 1", () => {
  const ur = [
    { userId: "u1", role: "ADMIN" },
    { userId: "u2", role: "ADMIN" },
  ];
  assert.equal(
    countDistinctAdminHolders(ADMIN_ROLES, ur, { removeUserRole: { userId: "u1", role: "ADMIN" } }),
    1,
  );
});

test("removeUserRole: user z adminem przez DWIE role nadal jest adminem po odebraniu jednej", () => {
  const ur = [
    { userId: "u1", role: "ADMIN" },
    { userId: "u1", role: "SUPERADMIN" },
  ];
  // odbieramy u1 rolę ADMIN, ale wciąż ma SUPERADMIN → nadal posiadacz
  assert.equal(
    countDistinctAdminHolders(ADMIN_ROLES, ur, { removeUserRole: { userId: "u1", role: "ADMIN" } }),
    1,
  );
});

test("ostatni admin: odebranie roli ostatniemu → 0 (blokada powinna zadziałać)", () => {
  const ur = [{ userId: "u1", role: "ADMIN" }];
  assert.equal(
    countDistinctAdminHolders(ADMIN_ROLES, ur, { removeUserRole: { userId: "u1", role: "ADMIN" } }),
    0,
  );
});

test("brak admin-ról w systemie → 0", () => {
  assert.equal(countDistinctAdminHolders([], [{ userId: "u1", role: "ADMIN" }]), 0);
});
