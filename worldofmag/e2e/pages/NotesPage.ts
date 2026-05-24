import { type Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class NotesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto("/notes");
  }

  async openAll() {
    await this.goto("/notes/all");
  }

  async openGroups() {
    await this.goto("/notes/groups");
  }

  async openTags() {
    await this.goto("/notes/tags");
  }

  async newNote() {
    await this.page.getByRole("link", { name: /Nowa notatka/i }).first().click();
  }

  get searchInput() {
    return this.page.getByPlaceholder(/Szukaj w notatkach/i);
  }

  async createGroup(name: string) {
    await this.button(/Nowa grupa/i).first().click();
    await this.page.getByPlaceholder(/Nazwa grupy/i).fill(name);
    await this.page.keyboard.press("Enter");
  }

  async createTag(name: string) {
    await this.button(/Nowy tag/i).first().click();
    await this.page.getByPlaceholder(/Nazwa tagu/i).fill(name);
    await this.page.keyboard.press("Enter");
  }
}
