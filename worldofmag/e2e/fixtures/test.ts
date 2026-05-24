import { test as base, expect } from "@playwright/test";
import { AppShell } from "../pages/AppShell";
import { ShoppingPage } from "../pages/ShoppingPage";
import { TasksPage } from "../pages/TasksPage";
import { NotesPage } from "../pages/NotesPage";
import { KitchenPage } from "../pages/KitchenPage";
import { ReportsPage, QaPage, AdminPage, SettingsPage } from "../pages/MiscPages";

// NOTE: nie definiujemy fixture `isMobile` — Playwright ma wbudowaną opcję o tej
// nazwie (true dla projektu iPhone 13, false dla desktop). Testy destrukturyzują
// `{ isMobile }` i dostają tę wbudowaną wartość.
type Pages = {
  app: AppShell;
  shopping: ShoppingPage;
  tasks: TasksPage;
  notes: NotesPage;
  kitchen: KitchenPage;
  reports: ReportsPage;
  qa: QaPage;
  admin: AdminPage;
  settings: SettingsPage;
};

export const test = base.extend<Pages>({
  app: async ({ page }, use) => use(new AppShell(page)),
  shopping: async ({ page }, use) => use(new ShoppingPage(page)),
  tasks: async ({ page }, use) => use(new TasksPage(page)),
  notes: async ({ page }, use) => use(new NotesPage(page)),
  kitchen: async ({ page }, use) => use(new KitchenPage(page)),
  reports: async ({ page }, use) => use(new ReportsPage(page)),
  qa: async ({ page }, use) => use(new QaPage(page)),
  admin: async ({ page }, use) => use(new AdminPage(page)),
  settings: async ({ page }, use) => use(new SettingsPage(page)),
});

export { expect };
