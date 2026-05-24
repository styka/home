import { type Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ReportsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }
  async open() {
    await this.goto("/reports");
  }
  async openAdmin() {
    await this.goto("/admin/reports");
  }
}

export class QaPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }
  async openHome() {
    await this.goto("/qa");
  }
  async openModule(module: string) {
    await this.goto(`/qa/${module}`);
  }
  async openAdmin() {
    await this.goto("/admin/qa");
  }
}

export class AdminPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }
  async open() {
    await this.goto("/admin");
  }
  async openAccess() {
    await this.goto("/admin/access");
  }
  async openConfig() {
    await this.goto("/admin/config");
  }
  async openCategories() {
    await this.goto("/admin/categories");
  }
}

export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }
  async open() {
    await this.goto("/settings");
  }
}
