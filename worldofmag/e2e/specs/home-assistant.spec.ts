import { devices } from "@playwright/test";
import { test, expect } from "../fixtures/test";

/**
 * 043 — widget asystenta i układ pulpitu (AC-13..AC-20).
 *
 * Test mobilny używa PRAWDZIWEGO profilu urządzenia (`devices["Pixel 5"]`), a nie samego
 * `setViewportSize` — lekcja z 042: `Emulation.setEmulatedMedia` z cechą `hover` bywa po cichu
 * ignorowane, więc „telefon" okazywał się myszą i test mierzył coś innego, niż deklarował.
 */
test.describe("043 — widget asystenta na pulpicie", () => {
  test("[080-AC18] powitanie jest pierwsze, widget asystenta zaraz po nim (desktop)", async ({ page }) => {
    await page.goto("/");
    // 098: NIE `networkidle` — od 072 aplikacja trzyma otwarty strumien zdarzen (`/api/events`),
    // wiec sieć nigdy nie jest bezczynna i to oczekiwanie konczylo sie limitem czasu testu.
    await page.waitForLoadState("load").catch(() => {});

    const widget = page.locator("[data-omnia-assistant-widget]");
    await expect(widget).toBeVisible({ timeout: 15_000 });

    // AC-15: żadnego pola do pisania — od tego jest panel asystenta.
    await expect(widget.locator("textarea, input")).toHaveCount(0);

    /**
     * 080 (Z9) ODWRACA regułę z 043 (AC-14).
     *
     * 043 wymagało, żeby widget asystenta stał PIERWSZY. Właściciel poprosił potem o odwrotność:
     * najpierw powitanie z podsumowaniem dnia, a widget zaraz pod nim. Test nie jest „naprawiany" —
     * sprawdza nową regułę, bo stara przestała obowiązywać na wyraźne życzenie.
     *
     * Co z 043 ZOSTAJE w mocy i dlatego jest tu dalej sprawdzane: oba bloki są poza listą sekcji
     * personalizowanych, więc ta zmiana nie rusza niczyjej zapisanej kolejności.
     */
    const kolejnosc = await page.evaluate(() => {
      const w = document.querySelector("[data-omnia-assistant-widget]");
      const h1 = document.querySelector("h1");
      if (!w || !h1) return null;
      // 4 = DOCUMENT_POSITION_FOLLOWING → widget występuje PO nagłówku powitania.
      return (h1.compareDocumentPosition(w) & 4) !== 0;
    });
    expect(kolejnosc, "powitanie ma stać przed widgetem asystenta").toBe(true);
  });

  test("[ha-AC16] klik akcji otwiera asystenta i od razu ją wysyła", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load").catch(() => {});

    const widget = page.locator("[data-omnia-assistant-widget]");
    await expect(widget).toBeVisible({ timeout: 15_000 });

    const chip = widget.getByRole("button").nth(1); // 0 = „Otwórz asystenta", 1 = pierwsza akcja
    const prompt = await chip.getAttribute("title");
    expect(prompt, "akcja musi nieść pełne polecenie w atrybucie title").toBeTruthy();

    await chip.click();

    // Panel asystenta się otworzył, a wiadomość poszła BEZ pisania czegokolwiek.
    const dialog = page.getByRole("dialog").filter({ hasText: /Asystent|Zapytaj/i }).first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(prompt!, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  });

  test("[ha-AC20] brak poziomego przewijania na wąskim i szerokim ekranie", async ({ page }) => {
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.waitForLoadState("load").catch(() => {});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `szerokość ${width}px nie może dawać poziomego przewijania`).toBeLessThanOrEqual(1);
    }
  });

  test("[ha-AC18] kafelki pulpitu pakują się bez pustych dziur", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("load").catch(() => {});

    // Układ wielokolumnowy CSS: kafelki jednej kolumny mają stykać się pionowo z dokładnością
    // do odstępu (16 px). W siatce (przed 043) pod niższym kafelkiem zostawała dziura na całą
    // różnicę wysokości wiersza.
    const gaps = await page.evaluate(() => {
      const container = document.querySelector('[class*="columns-"]');
      if (!container) return null;
      const boxes = Array.from(container.children).map((el) => el.getBoundingClientRect());
      const byColumn = new Map<number, DOMRect[]>();
      for (const b of boxes) {
        if (b.height === 0) continue;
        const key = Math.round(b.left);
        byColumn.set(key, [...(byColumn.get(key) ?? []), b]);
      }
      const out: number[] = [];
      for (const col of Array.from(byColumn.values())) {
        col.sort((a, b) => a.top - b.top);
        for (let i = 1; i < col.length; i++) out.push(col[i].top - col[i - 1].bottom);
      }
      return out;
    });

    expect(gaps, "pulpit musi renderować układ wielokolumnowy").not.toBeNull();
    for (const gap of gaps!) {
      expect(gap, "odstęp między kafelkami w kolumnie nie może przekraczać zadanego").toBeLessThanOrEqual(24);
    }
  });
});

// `defaultBrowserType` z profilu urządzenia MUSI zostać odfiltrowany: Playwright nie pozwala
// zmieniać przeglądarki wewnątrz `describe` („forces a new worker"), a projekt `desktop` i tak
// jedzie na Chromium. Zostaje to, co dla tego testu istotne: rozmiar ekranu, dotyk i mobilny UA.
const PIXEL_5 = (() => {
  const { defaultBrowserType: _ignored, ...rest } = devices["Pixel 5"];
  return rest;
})();

test.describe("043 — widget asystenta na telefonie", () => {
  test.use(PIXEL_5);

  test("[ha-AC13] widget widoczny bez przewijania i jako pierwszy", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load").catch(() => {});

    const widget = page.locator("[data-omnia-assistant-widget]");
    await expect(widget).toBeVisible({ timeout: 20_000 });

    const box = await widget.boundingBox();
    const viewport = page.viewportSize();
    expect(box, "widget musi mieć wymiary").not.toBeNull();
    expect(box!.y, "widget musi być nad zgięciem — bez przewijania").toBeLessThan(viewport!.height);
  });
});
