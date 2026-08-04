import { test, expect } from "../fixtures/test";
import { readModules, EXPECTED_MODULE_COUNT } from "../fixtures/modules";

/**
 * Faza 0 / zadanie 1 przebudowy — KLIKACZ ŚCIEŻKI SZCZĘŚLIWEJ DLA 21/21 MODUŁÓW.
 *
 * Po co, skoro jest już `smoke.spec.ts`? Bo smoke pokrywa 8 modułów z 21 i sprawdza wyłącznie,
 * czy nawigacja prowadzi pod właściwy adres. Fazy 1 i 2 przebudowy przeniosą setki plików
 * i zmigrują dane na 46 modelach — bez tego testu o regresji dowiedzielibyśmy się od właściciela,
 * nie od bramki. Dokument architektury nazywa te zadania „bezwarunkowo pierwszymi".
 *
 * Zakres jest CELOWO wąski i szybki: każdy moduł ma się otworzyć, wyrenderować ramę widoku
 * i nie wywalić błędu. To nie zastępuje testów funkcjonalnych poszczególnych modułów — łapie
 * klasę awarii „po refaktorze moduł X w ogóle się nie renderuje", czyli dokładnie to, czym
 * grozi przenoszenie plików.
 *
 * Lista modułów pochodzi z REJESTRU aplikacji (`src/lib/modules.tsx`), nie z tablicy w teście —
 * inaczej „21/21" przestałoby znaczyć 21/21 przy pierwszym nowym module.
 */

const modules = readModules();

test.describe("Faza 0 — ścieżka szczęśliwa wszystkich modułów", () => {
  test("[f0-registry] rejestr modułów daje się odczytać i ma spodziewaną liczbę wpisów", () => {
    expect(
      modules.length,
      "Parser rejestru przestał dopasowywać wpisy — bez tego klikacz po cichu pomijałby moduły",
    ).toBe(EXPECTED_MODULE_COUNT);
    expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length);
  });

  for (const mod of modules) {
    test(`[f0-open-${mod.id}] otwiera moduł ${mod.label} bez błędu`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (e) => consoleErrors.push(e.message));

      const response = await page.goto(mod.href, { waitUntil: "domcontentloaded" });

      // 1. Serwer nie zwraca błędu.
      expect(response?.status(), `HTTP dla ${mod.href}`).toBeLessThan(400);

      // 2. Nie wypadliśmy na logowanie (stan sesji admina ma wszystkie uprawnienia).
      await expect(page).not.toHaveURL(/auth\/signin/);

      // 3. Granica błędu Next.js się nie odpaliła. To najczęstszy objaw zepsutego widoku:
      //    strona odpowiada 200, ale renderuje komunikat awaryjny zamiast modułu.
      await expect(page.getByText("Coś poszło nie tak")).toHaveCount(0);

      // 4. Rama widoku jest na miejscu — moduł faktycznie się wyrenderował, a nie zwrócił pustki.
      //    `<h1>` pochodzi z `PageHeader` wewnątrz `ModuleView` (kontrakt widoku, 045).
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });

      // 5. Żaden nieobsłużony wyjątek w przeglądarce.
      expect(consoleErrors, `Błędy JS na ${mod.href}`).toEqual([]);
    });
  }
});
