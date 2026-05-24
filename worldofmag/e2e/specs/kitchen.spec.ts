import { test, expect } from "../fixtures/test";

test.describe("Kuchnia", () => {
  test("[scenario-kitchen-recipe-create] lista przepisów się ładuje", async ({ page, kitchen }) => {
    await kitchen.openRecipes();
    await expect(page).toHaveURL(/\/kitchen\/recipes/);
    await expect(kitchen.recipeSearch.or(page.getByText(/przepis/i)).first()).toBeVisible();
  });

  test("[scenario-kitchen-plan-set] plan posiłków ze slotami", async ({ page, kitchen }) => {
    await kitchen.openPlan();
    await expect(page).toHaveURL(/\/kitchen\/plan/);
    await expect(
      page.getByText(/Śniadanie|Obiad|Kolacja|Przekąska/).first(),
    ).toBeVisible();
  });

  test("[scenario-kitchen-pantry-add] spiżarnia się ładuje", async ({ page, kitchen }) => {
    await kitchen.openPantry();
    await expect(page).toHaveURL(/\/kitchen\/pantry/);
  });

  test("[scenario-kitchen-cookbook-create] książki kucharskie", async ({ page, kitchen }) => {
    await kitchen.openCookbooks();
    await expect(page).toHaveURL(/\/kitchen\/cookbooks/);
  });
});
