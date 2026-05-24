import { test, expect } from "../fixtures/test";
import type { NavKey } from "../pages/AppShell";

/**
 * Smoke: the admin storage state has every permission, so each module must be
 * reachable. Clicking through the nav doubles as the visible "demo". Runs under
 * both desktop and mobile projects automatically.
 */
const MODULES: { key: NavKey; url: RegExp }[] = [
  { key: "home", url: /\/$/ },
  { key: "shopping", url: /\/shopping/ },
  { key: "tasks", url: /\/tasks/ },
  { key: "notes", url: /\/notes/ },
  { key: "kitchen", url: /\/kitchen/ },
  { key: "qa", url: /\/qa/ },
  { key: "reports", url: /\/reports/ },
  { key: "settings", url: /\/settings/ },
];

test.describe("Smoke — nawigacja po modułach", () => {
  for (const m of MODULES) {
    test(`[smoke-nav-${m.key}] otwiera moduł ${m.key}`, async ({ page, app }) => {
      await page.goto("/");
      await test.step(`Kliknij nawigację: ${m.key}`, async () => {
        await app.openModule(m.key);
      });
      await expect(page).toHaveURL(m.url);
      await expect(page).not.toHaveURL(/auth\/signin/);
    });
  }

  test("[smoke-admin] konsola admina dostępna", async ({ page, admin }) => {
    await admin.open();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page).not.toHaveURL(/auth\/signin/);
  });
});
