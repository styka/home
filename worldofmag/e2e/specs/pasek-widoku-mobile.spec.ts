import { test, expect } from "../fixtures/test";

/**
 * 084 (AC-14, AC-16..AC-20) — PASEK WIDOKU NA TELEFONIE.
 *
 * Zgłoszenia właściciela, oba twarde: „ta gwiazdka i info o odświeżeniu zabiera przestrzeń na pasek
 * zakładek" oraz „switch wiadomości/linia czasu już nawet rozszerza stronę poza ekran i trzeba
 * scrolować na boki, co jest nieakceptowalne". Poziome przewijanie strony narusza C-31 wprost.
 *
 * **Metoda ma znaczenie.** Pierwsza wersja pomiaru sprawdzała
 * `document.documentElement.scrollWidth <= clientWidth` — i przepuszczała usterkę, bo strona Omnii
 * przewija się w RAMIE WIDOKU, a nie w dokumencie. Szukamy więc elementów, które są szersze od
 * swojego pola widzenia, a NIE deklarują własnego przewijania: to one rozpychają. Elementy
 * przycinające tekst (`text-overflow: ellipsis`) są z definicji szersze od swojego pola i to jest
 * poprawne — dlatego je pomijamy.
 */

/** Elementy, które rozpychają układ (a nie po prostu przewijają swoją zawartość). */
async function rozpychacze(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const s = getComputedStyle(el);
      if (s.overflowX === "auto" || s.overflowX === "scroll") return;
      if (s.textOverflow === "ellipsis") return; // przycinanie tekstu — zamierzone
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
        const klasy = String(el.className || "").split(" ").slice(0, 2).join(".");
        out.push(`${el.tagName.toLowerCase()}${klasy ? "." + klasy : ""} (${el.scrollWidth}>${el.clientWidth})`);
      }
    });
    return out;
  });
}

test.describe("084 — pasek widoku na telefonie", () => {
  test("[084-AC17] Wiadomości nie rozpychają strony przy 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/wiadomosci");
    await expect(page.locator("[data-news-pasek]")).toBeVisible();
    await page.waitForTimeout(1200);

    const przed = await rozpychacze(page);
    expect(przed, `układ rozpychany zaraz po wejściu: ${przed.join(" | ")}`).toEqual([]);

    // Po przewinięciu też — przyklejony pasek nie może zacząć rozpychać dopiero w ruchu.
    await page.evaluate(() => {
      let el: HTMLElement | null = document.querySelector("[data-news-pasek]");
      while ((el = el?.parentElement ?? null)) {
        const s = getComputedStyle(el);
        if (s.overflowY === "auto" || s.overflowY === "scroll") {
          el.scrollBy({ top: 1200, behavior: "instant" });
          break;
        }
      }
    });
    await page.waitForTimeout(500);
    const po = await rozpychacze(page);
    expect(po, `układ rozpychany po przewinięciu: ${po.join(" | ")}`).toEqual([]);
  });

  /**
   * 084 (AC-14, AC-15) — TEST USUNIĘTY W 085, świadomie.
   *
   * Sprawdzał, że rzadko używany chrom powłoki siedzi pod jedną kontrolką „⋯". 085 poszło dalej niż
   * 084: chromu w pasku nie ma już WCALE — gwiazdka i ściągawka przeniosły się do chromu konta, a
   * wskaźnik świeżości został skasowany (mierzył moment przeładowania strony przez powłokę, nie
   * świeżość danych modułu). Menu „⋯" zniknęło razem z zawartością, więc test sprawdzałby obecność
   * czegoś, co przestało istnieć.
   *
   * Nowe brzmienie tego samego wymagania („pasek widoku należy do modułu, chrom stoi gdzie indziej")
   * pilnują `chrom-konta.spec.ts` [085-AC2] i [085-AC6]. Zostaje ono więc pokryte, tylko ostrzej.
   */

  test("[084-AC19] nazwy zakładek modułu są widoczne przy 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/wiadomosci");
    await expect(page.locator("[data-news-pasek]")).toBeVisible();

    for (const nazwa of ["Tematy", "Gorące tematy", "Źródła"]) {
      const zakladka = page.getByRole("tab", { name: nazwa, exact: true });
      await expect(zakladka, `zakładka „${nazwa}" musi mieć czytelną nazwę`).toHaveCount(1);
      const szerokosc = await zakladka.evaluate((el) => (el as HTMLElement).getBoundingClientRect().width);
      expect(szerokosc, `zakładka „${nazwa}" zwinęła się do zera`).toBeGreaterThan(20);
    }
  });
});
