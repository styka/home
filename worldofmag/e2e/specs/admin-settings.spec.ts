import { test, expect } from "../fixtures/test";
import { requireVisible } from "../fixtures/guards";

test.describe("Admin — konsola", () => {
  const pages: { slug: string; path: string; url: RegExp }[] = [
    { slug: "scenario-admin-console-admin-only", path: "/admin", url: /\/admin$/ },
    { slug: "scenario-admin-add-user-role", path: "/admin/access", url: /\/admin\/access/ },
    { slug: "scenario-admin-config-groq", path: "/admin/config", url: /\/admin\/config/ },
    { slug: "scenario-admin-system-category-create", path: "/admin/categories", url: /\/admin\/categories/ },
    { slug: "scenario-admin-playground", path: "/admin/playground", url: /\/admin\/playground/ },
    { slug: "scenario-admin-architecture", path: "/admin/architecture", url: /\/admin\/architecture/ },
  ];
  for (const p of pages) {
    test(`[${p.slug}] ${p.path} dostępne dla admina`, async ({ page }) => {
      await page.goto(p.path);
      await expect(page).toHaveURL(p.url);
      await expect(page).not.toHaveURL(/auth\/signin/);
    });
  }

  test("[scenario-admin-toggle-role-permission] panel RBAC pokazuje role/uprawnienia", async ({ page }) => {
    await page.goto("/admin/access");
    await expect(page.getByText(/uprawnieni|rol|permission/i).first()).toBeVisible();
  });
});

test.describe("Ustawienia", () => {
  test("[scenario-settings-profile-display] profil w ustawieniach", async ({ page, settings }) => {
    await settings.open();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText(/Ustawienia|Wyloguj|team/i).first()).toBeVisible();
  });

  test("[scenario-settings-logout] wylogowanie przekierowuje do logowania", async ({ page, settings }) => {
    await settings.open();
    const logout = page.getByRole("button", { name: /Wyloguj/i }).or(page.getByText(/Wyloguj/i));
    await requireVisible(logout, "Brak przycisku wylogowania");
    await logout.first().click();
    await expect(page).toHaveURL(/auth\/signin/);
  });
});
