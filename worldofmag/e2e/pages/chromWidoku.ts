import type { Page } from "@playwright/test";

/**
 * 085 — dostęp do CHROMU KONTA (gwiazdka ulubionych, dzwonek, ściągawka skrótów, tryb admina).
 *
 * Do 084 gwiazdka „zapisz to miejsce" stała w pasku widoku, czyli wewnątrz `main`. Zgłoszenie
 * właściciela („gwiazdka powinna być przy ikonach tam na górze, obok ikony powiadomień") przeniosło
 * ją do chromu konta: na telefonie do górnego paska, na komputerze do rzędu w stopce panelu
 * bocznego. Oba miejsca leżą POZA `main`, więc zawężanie do treści strony przestało tu działać —
 * i dlatego selektor mieszka w jednym pliku, a nie w trzech specyfikacjach.
 *
 * Powód przeprowadzki jest zmierzony: w `ViewBar` kurczą się WYŁĄCZNIE filtry, więc chrom zabierał
 * zakładkom modułu dokładnie tyle, ile sam zajmował — 43 px przy ekranie 360 px.
 */

/** Gwiazdka „zapisz/odznacz to miejsce" — jedyne jej wejście w całej aplikacji. */
export function gwiazdkaUlubionych(page: Page, nazwa: RegExp) {
  return page.getByRole("button", { name: nazwa }).first();
}

export async function kliknijGwiazdkeUlubionych(page: Page, nazwa: RegExp): Promise<void> {
  await gwiazdkaUlubionych(page, nazwa).click();
}
