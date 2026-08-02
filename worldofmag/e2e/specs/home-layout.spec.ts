import { test, expect } from "../fixtures/test";

/**
 * 042 — pomiary układu strony głównej (AC-16, AC-17).
 * Projekt `desktop`; szerokości ustawiamy ręcznie, bo projekt `mobile` (WebKit) jest w sandboxie
 * niedostępny — to jedyny sposób sprawdzenia zachowania przy wąskim oknie.
 */
test.describe("042 — układ strony głównej", () => {
  const WIDTHS = [
    { w: 390, h: 844, kolumny: "1 (telefon)" },
    { w: 900, h: 900, kolumny: "2 (tablet)" },
    { w: 1440, h: 900, kolumny: "3 (desktop)" },
  ];

  for (const { w, h, kolumny } of WIDTHS) {
    test(`[home-AC16-${w}] brak przewijania poziomego przy ${w}px — ${kolumny}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await page.waitForLoadState("networkidle").catch(() => {});

      const m = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      });
      console.log(`[AC-16] ${w}px → scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth}`);

      // Dopuszczamy 1px na zaokraglenia subpikselowe.
      expect(m.scrollWidth - m.clientWidth).toBeLessThanOrEqual(1);
    });
  }

  test("[home-AC11] kolumna asystenta widoczna i przyklejona przy 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle").catch(() => {});

    const assistant = page.getByRole("complementary", { name: "Asystent AI" });
    await expect(assistant).toBeVisible();
    // Pole gotowe do pisania BEZ zadnego klikniecia w przycisk otwierajacy.
    await expect(assistant.getByRole("textbox", { name: "Pytanie do asystenta" })).toBeVisible();

    // Nie znika przy przewinieciu strony.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await expect(assistant).toBeInViewport();
  });

  test("[home-AC12] przy 390px kolumna asystenta sie nie renderuje", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByRole("complementary", { name: "Asystent AI" })).toBeHidden();
  });

  test("[home-AC17] czytelnosc na skorce jasnej i ciemnej", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const scheme of ["dark", "light"] as const) {
      await page.goto("/");
      await page.waitForLoadState("networkidle").catch(() => {});

      // Wymuszamy schemat przez zmienne motywu na <html> — tak jak robi to warstwa skorek.
      await page.evaluate((s) => {
        const root = document.documentElement;
        if (s === "light") {
          root.style.setProperty("--bg-base", "#ffffff");
          root.style.setProperty("--bg-surface", "#f5f5f5");
          root.style.setProperty("--text-primary", "#111111");
          root.style.setProperty("--text-secondary", "#333333");
          root.style.setProperty("--border", "#dddddd");
        }
      }, scheme);
      await page.waitForTimeout(300);

      // Karta/kolumna asystenta musi miec inne tlo niz kolor tekstu — czyli nie znika.
      const contrast = await page.evaluate(() => {
        const el = document.querySelector('[aria-label="Asystent AI"]') as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor || cs.background, color: cs.color };
      });
      console.log(`[AC-17] skórka=${scheme} →`, JSON.stringify(contrast));
      expect(contrast).not.toBeNull();
      expect(contrast!.bg).not.toBe(contrast!.color);
    }
  });
});
