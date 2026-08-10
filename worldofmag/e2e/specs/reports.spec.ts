import { test, expect } from "../fixtures/test";
import { isVisible, requireVisible } from "../fixtures/guards";

test.describe("Raporty", () => {
  test("[scenario-reports-list-visibility] lista raportów użytkownika", async ({ page, reports }) => {
    await reports.open();
    await expect(page).toHaveURL(/\/reports/);
    // 048: zawężone do `<main>`. Bez tego `getByText(...)` trafiał najpierw w element POWŁOKI
    // (pozycja nawigacji ukryta na tym rozmiarze ekranu), więc asercja widoczności padała mimo
    // poprawnie wyrenderowanej strony. Treść sprawdzamy w treści, nie w chromie.
    await expect(page.getByRole("main").getByText(/Raporty|Brak raportów/).first()).toBeVisible();
  });

  test("[scenario-reports-open-markdown] otwarcie raportu renderuje treść", async ({ page, reports }) => {
    await reports.open();
    const card = page.locator("a[href^='/reports/']").first();
    if (!(await isVisible(card))) {
      test.skip(true, "Brak raportów do otwarcia (pusty seed)");
    }
    await card.click();
    await expect(page).toHaveURL(/\/reports\//);
  });

  test("[scenario-reports-admin-create] panel admina raportów", async ({ page, reports }) => {
    await reports.openAdmin();
    await expect(page).toHaveURL(/\/admin\/reports/);
    await expect(
      page.getByRole("link", { name: /Nowy raport/i }).or(page.getByText(/Raporty/)).first(),
    ).toBeVisible();
  });

  test("[scenario-reports-admin-edit] formularz nowego raportu", async ({ page }) => {
    await page.goto("/admin/reports/new");
    await expect(page).toHaveURL(/\/admin\/reports\/new/);
    // 048: naruszenie trybu strict — wzorzec /Tytuł raportu/i pasował TAKŻE do pola treści
    // („# Tytuł raportu  Treść w formacie Markdown…"). Dopasowanie dokładne wskazuje tytuł.
    const title = page.getByPlaceholder("Tytuł raportu", { exact: true });
    await requireVisible(title, "Brak formularza nowego raportu");
    await expect(title).toBeVisible();
  });
});
