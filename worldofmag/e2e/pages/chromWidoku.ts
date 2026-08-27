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

/**
 * Gwiazdka ulubionych — jedyne wejście w całej aplikacji.
 *
 * 087: nazwa dostępna zmieniła się z „Zapisz/Usuń to miejsce" na „Ulubione…", bo przycisk przestał
 * być zapisem widoku i stał się wejściem do JEDNEGO dialogu ulubionych (lista + operacja na
 * bieżącym widoku). Selektor mieszka tu, więc zmiana dotknęła jednego pliku, nie trzech.
 */
export function gwiazdkaUlubionych(page: Page, nazwa: RegExp) {
  return page.getByRole("button", { name: nazwa }).first();
}

export async function kliknijGwiazdkeUlubionych(page: Page, nazwa: RegExp): Promise<void> {
  await gwiazdkaUlubionych(page, nazwa).click();
}

/**
 * 087: nazwa dostępna gwiazdki. Jedna dla obu stanów — czy widok jest zapisany, mówi `aria-pressed`.
 */
export const GWIAZDKA_ULUBIONYCH = /Ulubione/i;

/**
 * Zapisuje BIEŻĄCY widok w ulubionych przez jedyne wejście, jakie ma użytkownik od 087:
 * gwiazdka → dialog → „Dodaj bieżący widok" → nazwa → Zapisz.
 *
 * Mieszka tutaj, bo przepływ powtarzał się w trzech specyfikacjach — a zmiana z 087 kazała
 * poprawić każdą z nich osobno. Drugi raz już nie będzie trzeba.
 */
export async function zapiszBiezacyWidok(page: Page, nazwa: string): Promise<void> {
  await page.waitForLoadState("load").catch(() => {});
  await kliknijGwiazdkeUlubionych(page, GWIAZDKA_ULUBIONYCH);
  await page.getByRole("button", { name: /Dodaj bieżący widok/i }).click();
  await page.getByPlaceholder("Nazwa widoku…").fill(nazwa);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page
    .getByRole("button", { name: GWIAZDKA_ULUBIONYCH })
    .first()
    .waitFor({ timeout: 15_000 });
}

/** Otwiera dialog ulubionych i przechodzi do zapisanego widoku o podanej nazwie. */
export async function skoczDoUlubionego(page: Page, nazwa: string): Promise<void> {
  await kliknijGwiazdkeUlubionych(page, GWIAZDKA_ULUBIONYCH);
  await page.getByRole("dialog", { name: "Ulubione widoki" }).getByText(nazwa, { exact: false }).first().click();
}

/**
 * Usuwa Z USTAWIEŃ ulubiony o podanej nazwie — i tylko jego.
 *
 * 087: zastępuje „wyczyść WSZYSTKIE ulubione" w testach, które zapisują jeden wpis. Kasowanie całej
 * listy jest zależnością od stanu, którego test nie stworzył: specyfikacje dzielą jedno konto
 * administratora i biegną równolegle, więc pętla „klikaj, aż zostanie zero" ścigała się z sąsiadem
 * i kończyła wyjątkiem „nie udało się wyczyścić w 40 iteracjach". Test sprząta po sobie, nie po innych.
 */
export async function usunUlubioneONazwie(page: Page, nazwa: string): Promise<void> {
  // 109: wpisy ulubionych są pod `/settings/nawigacja`; `/settings` to spis sekcji.
  await page.goto("/settings/nawigacja");
  await page.waitForLoadState("load").catch(() => {});
  const wiersz = page.getByRole("main").locator(`button[aria-label^="Usu"][aria-label*="${nazwa}"]`);
  for (let i = 0; i < 5 && (await wiersz.count()) > 0; i++) {
    await wiersz.first().click();
    await page.waitForTimeout(400);
  }
}
