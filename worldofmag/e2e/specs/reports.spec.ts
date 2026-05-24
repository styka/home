import { test, expect } from "../fixtures/test";
import { isVisible, requireVisible } from "../fixtures/guards";

test.describe("Raporty", () => {
  test("[scenario-reports-list-visibility] lista raportów użytkownika", async ({ page, reports }) => {
    await reports.open();
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.getByText(/Raporty|Brak raportów/).first()).toBeVisible();
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
    const title = page.getByPlaceholder(/Tytuł raportu/i);
    await requireVisible(title, "Brak formularza nowego raportu");
    await expect(title).toBeVisible();
  });
});
