import { test, expect } from "../fixtures/test";

// Wszystkie testy w tym pliku jako użytkownik z TYLKO module.home.
test.use({ storageState: "e2e/.auth/limited.json" });

test.describe("Uprawnienia — gating (użytkownik ograniczony)", () => {
  test("[scenario-no-permission-locked] zablokowane moduły bez linku w nawigacji", async ({ page, app }) => {
    await page.goto("/");
    await test.step("Zakupy są zablokowane (kłódka, brak linku)", async () => {
      await app.expectLocked("shopping");
    });
  });

  test("[scenario-direct-url-blocked] bezpośredni URL /shopping przekierowuje", async ({ page }) => {
    await page.goto("/shopping");
    await expect(page).not.toHaveURL(/\/shopping/);
  });

  test("[scenario-qa-no-permission] /qa zablokowane dla ograniczonego", async ({ page }) => {
    await page.goto("/qa");
    await expect(page).not.toHaveURL(/\/qa/);
  });

  test("[scenario-admin-non-admin-blocked] /admin niedostępne dla nie-admina", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  });
});
