import { expect, type Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ShoppingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto("/shopping");
  }

  /** Create a list via the "Nowa lista" inline form. */
  async createList(name: string) {
    await this.button(/Nowa lista/).first().click();
    await this.page.getByPlaceholder(/Nazwa listy/).fill(name);
    await this.button(/Utwórz/).first().click();
  }

  /** Open a list by its name from the sidebar / catalogue. */
  async openList(name: string) {
    await this.page.getByText(name, { exact: false }).first().click();
  }

  /** Add an item to the open list. Uses the `a` shortcut then types + Enter. */
  async addItem(text: string) {
    await this.page.keyboard.press("a");
    const input = this.page.getByRole("textbox").first();
    await input.fill(text);
    await input.press("Enter");
  }

  /** Mobile native <select> for switching lists. */
  get mobileListSelect() {
    return this.page.locator("select[aria-label='Wybierz listę zakupów']");
  }

  filterTab(status: "ALL" | "NEEDED" | "IN_CART" | "DONE" | "MISSING") {
    return this.page.getByRole("button", { name: status, exact: true });
  }

  async expectEmptyState() {
    await expect(this.page.getByText(/Brak produktów|Brak list/)).toBeVisible();
  }
}
