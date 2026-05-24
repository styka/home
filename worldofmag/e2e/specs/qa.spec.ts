import { test, expect } from "../fixtures/test";

test.describe("Dział QA", () => {
  test("[scenario-qa-home-stats] centrum QA pokazuje statystyki", async ({ page, qa }) => {
    await qa.openHome();
    await expect(page.getByRole("heading", { name: /QA — Centrum testowania/i })).toBeVisible();
    await expect(page.getByText("Moduły", { exact: true })).toBeVisible();
    await expect(page.getByText("Wkrótce", { exact: true })).toBeVisible();
  });

  test("[scenario-qa-module-tree] drzewo modułu Zakupy", async ({ page, qa }) => {
    await qa.openModule("shopping");
    await expect(page).toHaveURL(/\/qa\/shopping/);
    // Epic z seeda dla Zakupów.
    await expect(page.getByText("Listy zakupowe").first()).toBeVisible();
  });

  test("[scenario-qa-scenario-fullscreen] pełnoekranowy scenariusz z nawigacją", async ({ page }) => {
    await page.goto("/qa/scenariusz/scenario-create-list-positive");
    await expect(page.getByRole("heading", { name: /Utworzenie listy/i })).toBeVisible();
    await expect(page.getByText("Warunki wstępne")).toBeVisible();
    await expect(page.getByText("Kroki")).toBeVisible();
    // Breadcrumb do modułu.
    await expect(page.getByRole("link", { name: "Zakupy" }).first()).toBeVisible();
  });

  test("[scenario-qa-admin-create-hierarchy] panel admina QA", async ({ page, qa }) => {
    await qa.openAdmin();
    await expect(page).toHaveURL(/\/admin\/qa/);
    await expect(page.getByRole("heading", { name: /zarządzanie scenariuszami/i })).toBeVisible();
  });

  test("[scenario-qa-tester-access] QA dostępne w nawigacji dla uprawnionego", async ({ app }) => {
    await app.expectNavVisible("qa");
  });

  test("[scenario-qa-admin-edit-preview] edycja scenariusza z podglądem markdown", async ({ page }) => {
    await page.goto("/admin/qa/scenario/scenario-create-list-positive/edit");
    await expect(page).toHaveURL(/\/admin\/qa\/scenario\//);
    await expect(page.getByText(/Podgląd|Markdown|Treść/i).first()).toBeVisible();
  });
});
