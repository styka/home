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

  /**
   * 048: „moduł jest dostępny w nawigacji" ma DWIE poprawne postacie i test musi znać obie.
   *
   * Moduł włączony renderuje się jako **link**. Moduł domyślnie WYŁĄCZONY (dziś tylko QA) siedzi
   * w zwiniętej sekcji „Więcej…" i renderuje się tam jako **przycisk** — bo służy do dołożenia go
   * do menu, a nie do przejścia. Test szukał wyłącznie linku, więc twierdził, że QA jest
   * niedostępne dla uprawnionego użytkownika, choć było: o jedno rozwinięcie i jedno kliknięcie.
   *
   * To zamierzone zachowanie produktu (`defaultEnabled: false`), więc poprawiamy test, nie aplikację.
   */
  async expectNavVisible(key: NavKey) {
    await this.openMobileMenuIfNeeded();
    const link = this.page.getByRole("link", { name: NAV[key] }).first();
    if (await link.isVisible().catch(() => false)) return;

    const more = this.page.getByRole("button", { name: /Więcej/ }).first();
    if (await more.isVisible().catch(() => false)) await more.click();

    await expect(
      link.or(this.page.getByRole("button", { name: NAV[key] }).first()),
    ).toBeVisible();
  }
}
