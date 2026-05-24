import { test, expect } from "../fixtures/test";

test.describe("Raporty", () => {
  test("[scenario-reports-list-visibility] lista raportów użytkownika", async ({ page, reports }) => {
    await reports.open();
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.getByText(/Raporty|Brak raportów/).first()).toBeVisible();
  });

  test("[scenario-reports-admin-create] panel admina raportów", async ({ page, reports }) => {
    await reports.openAdmin();
    await expect(page).toHaveURL(/\/admin\/reports/);
    await expect(page.getByRole("link", { name: /Nowy raport/i }).or(page.getByText(/Raporty/)).first()).toBeVisible();
  });
});
