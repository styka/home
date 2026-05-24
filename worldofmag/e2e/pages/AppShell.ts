import { expect, type Page } from "@playwright/test";
import { BasePage } from "./BasePage";

// Sidebar / mobile-nav labels (exact Polish strings from ModuleSidebar/AppShell).
export const NAV = {
  home: "Strona główna",
  shopping: "Zakupy",
  tasks: "Zadania",
  notes: "Notatki",
  kitchen: "Kuchnia",
  qa: "QA",
  reports: "Raporty",
  invitations: "Zaproszenia",
  settings: "Ustawienia",
  admin: "Admin",
} as const;

export type NavKey = keyof typeof NAV;

export class AppShell extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private get hamburger() {
    return this.page.getByRole("button", { name: /menu/i });
  }

  /** Open the mobile slide-out menu if we're on a small viewport. */
  async openMobileMenuIfNeeded() {
    if (this.isMobile) {
      const burger = this.hamburger.first();
      if (await burger.isVisible().catch(() => false)) {
        await burger.click();
      }
    }
  }

  /** Navigate to a module via the sidebar (desktop) or mobile menu. */
  async openModule(key: NavKey) {
    await this.openMobileMenuIfNeeded();
    await this.page.getByRole("link", { name: NAV[key], exact: false }).first().click();
  }

  /** The nav entry for a locked module renders without a link (lock icon). */
  async expectLocked(key: NavKey) {
    await this.openMobileMenuIfNeeded();
    await expect(this.page.getByRole("link", { name: NAV[key] })).toHaveCount(0);
  }

  async expectNavVisible(key: NavKey) {
    await this.openMobileMenuIfNeeded();
    await expect(this.page.getByRole("link", { name: NAV[key] }).first()).toBeVisible();
  }
}
