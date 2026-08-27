import { test, expect } from "../fixtures/test";

/**
 * 108 — behawioralna weryfikacja działu przewodników.
 *
 * Sprawdzamy to, czego nie da się zaliczyć czytaniem kodu: czy ikona pomocy naprawdę stoi w pasku
 * Notatek i dokąd prowadzi, czy hub renderuje obie grupy kafelków, czy wyszukiwarka wskazuje
 * rozdział i czy spis treści przewija dokument.
 */

test.describe("Przewodniki", () => {
  test("[AC-3] hub pokazuje gotowe przewodniki i moduły bez przewodnika", async ({ page }) => {
    await page.goto("/guide");
    await expect(page).not.toHaveURL(/auth\/signin/);
    const main = page.getByRole("main");
    await expect(main.getByText("Gotowe przewodniki")).toBeVisible();
    await expect(main.getByRole("link", { name: /Notatki/ }).first()).toBeVisible();
    await expect(main.getByText("Wkrótce")).toBeVisible();
  });

  test("[AC-3] wejście w kafelek otwiera przewodnik", async ({ page }) => {
    await page.goto("/guide");
    await page.getByRole("main").getByRole("link", { name: /Notatki/ }).first().click();
    await expect(page).toHaveURL(/\/guide\/notatki/);
    await expect(page.getByRole("main").getByText("Wikilinki").first()).toBeVisible();
  });

  test("[AC-6] wyszukiwarka wskazuje rozdział, w którym fraza występuje", async ({ page }) => {
    await page.goto("/guide");
    await page.getByPlaceholder(/Szukaj w przewodnikach/).fill("wikilink");
    const wynik = page.getByRole("main").getByRole("link", { name: /Wikilinki/ }).first();
    await expect(wynik).toBeVisible();
    await expect(wynik).toHaveAttribute("href", /#04-wikilinki/);
  });

  test("[AC-6] fraza bez ogonków daje ten sam wynik", async ({ page }) => {
    await page.goto("/guide");
    await page.getByPlaceholder(/Szukaj w przewodnikach/).fill("zalacznik");
    await expect(page.getByRole("main").getByText(/Załączniki/).first()).toBeVisible();
  });

  test("[AC-6] fraza bez trafień pokazuje stan pusty", async ({ page }) => {
    await page.goto("/guide");
    await page.getByPlaceholder(/Szukaj w przewodnikach/).fill("zyrafanarowerze");
    await expect(page.getByText("Nic nie znaleziono")).toBeVisible();
  });

  test("[AC-5] spis treści przewija do wybranego rozdziału", async ({ page }) => {
    await page.goto("/guide/notatki");
    // Selektor atrybutowy, a nie `#11-pomysly`: identyfikator zaczynający się CYFRĄ jest legalny
    // w HTML5 i działa w `getElementById` oraz w kotwicy adresu (tak robi to czytnik), ale nie jest
    // poprawnym selektorem CSS — `querySelector` rzuca na nim wyjątkiem.
    const sekcja = page.locator('[id="11-pomysly"]');
    // Przed kliknięciem rozdział jest daleko poza ekranem.
    const przed = await sekcja.evaluate((el) => el.getBoundingClientRect().top);
    expect(przed).toBeGreaterThan(1000);
    await page.getByRole("button", { name: /Pomysły/ }).first().click();
    await expect
      .poll(async () => sekcja.evaluate((el) => Math.round(el.getBoundingClientRect().top)), {
        timeout: 5000,
      })
      .toBeLessThan(300);
  });

  test("[AC-11] odnośnik w treści prowadzi w aplikację bez pełnego przeładowania", async ({ page }) => {
    await page.goto("/guide/asystent");
    // Znacznik na obiekcie okna ginie przy pełnym przeładowaniu strony, przetrwa nawigację SPA.
    await page.evaluate(() => ((window as unknown as { __spa?: boolean }).__spa = true));
    await page.getByRole("main").getByRole("link", { name: /przewodniku po Notatkach/ }).click();
    await expect(page).toHaveURL(/\/guide\/notatki/);
    expect(await page.evaluate(() => (window as unknown as { __spa?: boolean }).__spa)).toBe(true);
  });

  /**
   * AC-1 na OBU widokach modułu i w OBU rozmiarach ekranu.
   *
   * Pierwsza wersja sprawdzała tylko `/notes/all` na komputerze i przepuściła realną lukę: `/notes`
   * — czyli strona, na którą prowadzi menu, dolny pasek i szybki cel modułu — nie dostała slotu
   * pomocy wcale. Ikona istniała więc wyłącznie tam, gdzie trzeba było najpierw świadomie wejść,
   * czyli była niewidoczna dokładnie dla kogoś, kto właśnie otworzył moduł i szuka pomocy.
   */
  for (const trasa of ["/notes", "/notes/all"]) {
    for (const ekran of [
      { nazwa: "komputer", viewport: { width: 1280, height: 800 } },
      { nazwa: "telefon", viewport: { width: 390, height: 844 } },
    ]) {
      test(`[AC-1] ikona pomocy na ${trasa} (${ekran.nazwa})`, async ({ page }) => {
        await page.setViewportSize(ekran.viewport);
        await page.goto(trasa);
        const pomoc = page.getByRole("link", { name: "Przewodnik po Notatkach" }).first();
        await expect(pomoc).toBeVisible();
        await pomoc.click();
        await expect(page).toHaveURL(/\/guide\/notatki/);
      });
    }
  }

  test("[AC-2] moduł bez przewodnika nie ma ikony pomocy", async ({ page }) => {
    await page.goto("/habits");
    await expect(page.getByRole("link", { name: /^Przewodnik po/ })).toHaveCount(0);
  });

  test("[AC-4] Ustawienia prowadzą do działu przewodników", async ({ page }) => {
    await page.goto("/settings");
    const link = page.getByRole("link", { name: "Otwórz przewodniki" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/guide");
  });

  test("[AC-10] przy 360 px treść nie przewija się w poziomie, a spis jest dostępny", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 });
    await page.goto("/guide/notatki");
    await expect(page.getByRole("button", { name: "Spis treści" })).toBeVisible();
    const nadmiar = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(nadmiar).toBeLessThanOrEqual(1);
  });

  test("[AC-12] czytelnik bez uprawnienia do modułu widzi kafelek, ale nie jako odnośnik", async ({
    browser,
  }) => {
    // Użytkownik z samym `module.home` — ten sam, na którym stoją testy gatingu.
    const ctx = await browser.newContext({ storageState: "e2e/.auth/limited.json" });
    const page = await ctx.newPage();
    await page.goto("/guide");
    const main = page.getByRole("main");

    // Kafelek Notatek ZOSTAJE widoczny — ukrycie zabrałoby informację, że taki dział istnieje.
    await expect(main.getByText("Notatki").first()).toBeVisible();
    await expect(main.getByText(/Nie masz dostępu do tego modułu/).first()).toBeVisible();
    // …ale przestaje być odnośnikiem.
    await expect(main.getByRole("link", { name: /Notatki/ })).toHaveCount(0);

    // Przewodnik niemodułowy (Asystent) jest dla niego normalnie dostępny.
    await expect(main.getByRole("link", { name: /Asystent AI/ })).toHaveCount(1);
    await ctx.close();
  });
});
