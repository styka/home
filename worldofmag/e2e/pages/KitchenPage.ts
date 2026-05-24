import { type Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export const MEAL_SLOTS = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
} as const;

export class KitchenPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openHome() {
    await this.goto("/kitchen");
  }

  async openRecipes() {
    await this.goto("/kitchen/recipes");
  }

  async openPlan() {
    await this.goto("/kitchen/plan");
  }

  async openPantry() {
    await this.goto("/kitchen/pantry");
  }

  async openCookbooks() {
    await this.goto("/kitchen/cookbooks");
  }

  get recipeSearch() {
    return this.page.getByPlaceholder(/Szukaj przepisów/i);
  }

  get pantrySearch() {
    return this.page.getByPlaceholder(/Szukaj w spiżarni/i);
  }
}
