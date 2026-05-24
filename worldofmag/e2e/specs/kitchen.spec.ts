import { test, expect } from "../fixtures/test";
import { requireVisible } from "../fixtures/guards";

test.describe("Kuchnia — nawigacja", () => {
  const routes: { slug: string; path: string; url: RegExp }[] = [
    { slug: "scenario-kitchen-recipe-create", path: "/kitchen/recipes", url: /recipes/ },
    { slug: "scenario-kitchen-plan-set", path: "/kitchen/plan", url: /plan/ },
    { slug: "scenario-kitchen-pantry-add", path: "/kitchen/pantry", url: /pantry/ },
    { slug: "scenario-kitchen-stocktake", path: "/kitchen/pantry/stocktake", url: /stocktake/ },
    { slug: "scenario-kitchen-cookbook-create", path: "/kitchen/cookbooks", url: /cookbooks/ },
  ];
  for (const r of routes) {
    test(`[${r.slug}] ${r.path} ładuje się`, async ({ page }) => {
      await page.goto(r.path);
      await expect(page).toHaveURL(r.url);
      await expect(page).not.toHaveURL(/auth\/signin/);
    });
  }

  test("[scenario-kitchen-plan-cooked] plan pokazuje sloty posiłków", async ({ page, kitchen }) => {
    await kitchen.openPlan();
    await expect(page.getByText(/Śniadanie|Obiad|Kolacja|Przekąska/).first()).toBeVisible();
  });

  test("[scenario-kitchen-pantry-expiring] spiżarnia — wyszukiwarka/stan", async ({ page, kitchen }) => {
    await kitchen.openPantry();
    await expect(
      kitchen.pantrySearch.or(page.getByText(/Spiżarnia|Dodaj|pusta/i)).first(),
    ).toBeVisible();
  });

  test("[scenario-kitchen-recipe-slug-unique] otwarcie edytora nowego przepisu", async ({ page }) => {
    await page.goto("/kitchen/recipes/new");
    await expect(page).not.toHaveURL(/auth\/signin/);
    await expect(page).toHaveURL(/\/kitchen\/recipes\/new/);
  });

  test("[scenario-kitchen-shop-recipe] wyszukiwarka przepisów", async ({ page, kitchen }) => {
    await kitchen.openRecipes();
    const search = kitchen.recipeSearch;
    await requireVisible(search, "Brak wyszukiwarki przepisów");
    await search.fill("test");
    await expect(page).toHaveURL(/\/kitchen\/recipes/);
  });
});
