import { test, expect } from "../fixtures/test";

test.describe("Strona główna", () => {
  test("[scenario-home-snapshots-filtered] dashboard ładuje się dla uprawnionego", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/auth\/signin/);
    // Admin (wszystkie uprawnienia) widzi snapshoty modułów.
    await expect(page.getByText(/Zakupy|Zadania|Notatki|Kuchnia/).first()).toBeVisible();
  });

  test("[scenario-home-admin-widget] widżet admina dla admina", async ({ page }) => {
    await page.goto("/");
    // E2E admin ma rolę ADMIN — widżet/sekcja admina powinna być dostępna.
    await expect(page.getByRole("link", { name: "Admin" }).first()).toBeVisible();
  });
});
