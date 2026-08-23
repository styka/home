import type { Page } from "@playwright/test";

/**
 * 084 — dostęp do chromu powłoki (gwiazdka ulubionych, świeżość danych, skróty).
 *
 * Od 084 świeżość danych i ściągawka skrótów siedzą pod kontrolką „⋯"; GWIAZDKA została w pasku,
 * bo otwiera własne okienko, a warstwa w warstwie okazała się krucha (patrz `ViewBar`).
 * Powód jest zmierzony: w `ViewBar` kurczą się WYŁĄCZNIE filtry, więc chrom zabierał zakładkom
 * modułu dokładnie tyle, ile sam zajmował — 43 px przy ekranie 360 px. Właściciel zgłosił to jako
 * „ta gwiazdka i info o odświeżeniu zabiera przestrzeń na pasek zakładek. To bardzo złe."
 *
 * Ta wiedza mieszka TUTAJ, a nie w trzech specach: gdy chrom kiedyś znów zmieni miejsce, będzie
 * jedno miejsce do poprawienia zamiast polowania po plikach.
 */
export async function otworzChromWidoku(page: Page): Promise<void> {
  const menu = page.getByRole("main").locator('[aria-haspopup="menu"]').first();
  if ((await menu.count()) === 0) return;
  // Menu NIE zamyka się po kliknięciu pozycji (inaczej zabijałoby okienko gwiazdki, patrz
  // `ViewChromeMenu`), więc bezwarunkowe kliknięcie potrafiłoby je ZAMKNĄĆ zamiast otworzyć.
  if ((await menu.getAttribute("aria-expanded")) === "true") return;
  await menu.click();
}

/** Klika gwiazdkę „zapisz/odznacz ten widok" — stoi wprost w pasku widoku. */
export async function kliknijGwiazdkeUlubionych(page: Page, nazwa: RegExp): Promise<void> {
  await page.getByRole("main").getByRole("button", { name: nazwa }).first().click();
}
