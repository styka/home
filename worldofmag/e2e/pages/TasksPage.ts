import { type Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export const TASK_VIEWS = {
  today: "Dziś",
  upcoming: "Nadchodzące",
  overdue: "Zaległe",
  all: "Wszystkie",
} as const;

export class TasksPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto("/tasks");
  }

  async openView(view: keyof typeof TASK_VIEWS) {
    await this.link(TASK_VIEWS[view]).first().click();
  }

  /**
   * 048: przycisk „Nowy projekt" jest i w nawigacji bocznej modułu, i w treści strony.
   * `.first()` trafiał w ten z paska bocznego — a odkąd nawigacja ładuje się leniwie (pole
   * `sideNav` w deklaracji), kliknięcie potrafiło wyprzedzić jej zamontowanie i formularz się
   * nie otwierał. Zawężenie do `<main>` usuwa i wieloznaczność, i wyścig.
   */
  async createProject(name: string) {
    await this.page.getByRole("main").getByRole("button", { name: /Nowy projekt/ }).first().click();
    await this.page.getByPlaceholder(/Nazwa projektu/).fill(name);
    await this.page.keyboard.press("Enter");
  }

  /** Quick-add a task (input placeholder "Dodaj zadanie… (a / n)"). */
  async addTask(title: string) {
    const input = this.page.getByPlaceholder(/Dodaj zadanie/);
    if (!(await input.isVisible().catch(() => false))) {
      await this.page.keyboard.press("a");
    }
    await input.fill(title);
    await input.press("Enter");
  }

  filterTab(status: "ALL" | "TODO" | "IN_PROGRESS" | "DONE" | "DEFERRED" | "CANCELLED") {
    return this.page.getByRole("button", { name: status, exact: true });
  }
}
