import { test, expect } from "../fixtures/test";

test.describe("Admin i Ustawienia", () => {
  test("[scenario-admin-console-admin-only] dashboard admina", async ({ page, admin }) => {
    await admin.open();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page).not.toHaveURL(/auth\/signin/);
  });

  test("[scenario-admin-add-user-role] panel RBAC (access)", async ({ page, admin }) => {
    await admin.openAccess();
    await expect(page).toHaveURL(/\/admin\/access/);
  });

  test("[scenario-admin-config-groq] konfiguracja", async ({ page, admin }) => {
    await admin.openConfig();
    await expect(page).toHaveURL(/\/admin\/config/);
  });

  test("[scenario-settings-profile-display] profil w ustawieniach", async ({ page, settings }) => {
    await settings.open();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText(/Ustawienia|Wyloguj|team/i).first()).toBeVisible();
  });
});
