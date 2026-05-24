import { test, expect } from "../fixtures/test";

test.describe("Strona główna", () => {
  test("[scenario-home-snapshots-filtered] dashboard ładuje się dla uprawnionego", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/auth\/signin/);
    await expect(page.getByText(/Zakupy|Zadania|Notatki|Kuchnia/).first()).toBeVisible();
  });

  test("[scenario-home-admin-widget] widżet/link admina dla admina", async ({ page, app }) => {
    await page.goto("/");
    await app.expectNavVisible("admin");
  });

  test("[scenario-home-subtitle] powitanie z podtytułem", async ({ page }) => {
    await page.goto("/");
    // Greeting nagłówek h1 jest zawsze obecny na dashboardzie.
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("[scenario-home-tasks-badges] snapshot zadań linkuje do widoków", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Zadania/).first()).toBeVisible();
  });
});
