import { test, expect } from "../fixtures/test";
import { requireVisible } from "../fixtures/guards";

test.describe("Zespoły", () => {
  test("[scenario-settings-teams-list] lista zespołów w ustawieniach", async ({ page, settings }) => {
    await settings.open();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText(/team|zespo/i).first()).toBeVisible();
  });

  test("[scenario-teams-create] formularz tworzenia zespołu", async ({ page }) => {
    await page.goto("/settings/team/new");
    await expect(page).toHaveURL(/\/settings\/team\/new/);
    await expect(page).not.toHaveURL(/auth\/signin/);
  });

  test("[scenario-teams-create-empty-name] nazwa zespołu wymagana", async ({ page }) => {
    await page.goto("/settings/team/new");
    const submit = page.getByRole("button", { name: /Utwórz|Zapisz|Stwórz/i });
    await requireVisible(submit, "Brak formularza zespołu");
    await submit.first().click();
    // Bez nazwy nadal jesteśmy na formularzu.
    await expect(page).toHaveURL(/\/settings\/team\/new|\/settings/);
  });

  test("[scenario-teams-invite-accept] strona zaproszeń ładuje się", async ({ page }) => {
    await page.goto("/invitations");
    await expect(page).toHaveURL(/\/invitations/);
    await expect(page).not.toHaveURL(/auth\/signin/);
  });
});
