import { test, expect } from "../fixtures/test";

// Czyścimy ciasteczka → użytkownik niezalogowany (mimo storageState).
test.describe("Logowanie i ochrona tras", () => {
  test("[scenario-auth-unauth-redirect] niezalogowany przekierowany do logowania", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/shopping");
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("[scenario-auth-no-anonymous] brak trybu anonimowego (strona główna)", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("[scenario-auth-google-success] strona logowania ma przycisk Google", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/auth/signin");
    await expect(
      page.getByRole("button", { name: /Google/i }).or(page.getByText(/Google/i)).first(),
    ).toBeVisible();
  });

  test("[scenario-auth-fresh-permissions] zalogowany admin ma dostęp (sesja z DB)", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/auth\/signin/);
  });
});
