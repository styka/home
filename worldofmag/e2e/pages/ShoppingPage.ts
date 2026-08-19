import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ShoppingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto("/shopping");
  }

  /**
   * Przycisk „Nowa lista" WEWNĄTRZ treści strony.
   *
   * 048: na `/shopping` są trzy przyciski o tej nazwie — w nawigacji bocznej modułu, w nagłówku
   * widoku i w stanie pustym. `button(...).first()` trafiał w ten z **paska bocznego**, który nie
   * otwiera formularza na stronie głównej modułu, więc test czekał na pole „Nazwa listy…", które
   * nigdy się nie pojawiało. Zawężenie do `<main>` usuwa tę wieloznaczność.
   */
  private get newListButton(): Locator {
    return this.page.getByRole("main").getByRole("button", { name: /Nowa lista/ }).first();
  }

  /** Create a list via the "Nowa lista" inline form. */
  /**
   * 098: tworzenie z POTWIERDZENIEM i ponowieniem.
   *
   * Klik w „Utwórz" przed hydracją nic nie robi — formularz jest już w DOM (renderuje go serwer),
   * więc `fill` przechodzi, przycisk daje się kliknąć, a akcja nie leci. Test padał dopiero
   * kilkanaście linijek dalej, na klikaniu listy, której nie było, i wyglądał na błąd nawigacji.
   * Sprawdzamy najpierw, czy lista już istnieje, żeby ponowienie nie tworzyło duplikatów.
   */
  async createList(name: string) {
    const widoczna = this.page.getByRole("main").getByText(name, { exact: false }).first();
    await expect(async () => {
      if (!(await widoczna.isVisible().catch(() => false))) {
        await this.newListButton.click();
        await this.page.getByPlaceholder(/Nazwa listy/).fill(name);
        await this.page.getByRole("main").getByRole("button", { name: /Utwórz/ }).first().click();
      }
      await expect(widoczna).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 25_000 });
  }

  /** Otwiera sam formularz (bez wypełniania) — dla scenariuszy walidacji. */
  async openNewListForm() {
    await this.newListButton.click();
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
