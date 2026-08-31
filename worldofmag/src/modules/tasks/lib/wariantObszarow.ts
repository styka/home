/**
 * 117 (AC-4): OSTATNIO UŻYTY WARIANT widoku „wg obszarów", pamiętany między wizytami.
 *
 * Nośnik jak w `ukladSzczegolow.ts` — `localStorage`, nie kolumna w bazie: to preferencja
 * prezentacji jednego ekranu, a wariant AKTYWNY i tak niesie adres (`?obszary=…`), więc widok
 * zapisany w ulubionych wraca dokładnie taki, jaki był. Pamięć lokalna służy tylko jako
 * domyślna wartość przy wejściu bez parametru. Odczyt/zapis w `try/catch`: prywatne okno
 * i zablokowany magazyn to poprawne stany, nie błędy.
 */

const KLUCZ = "omnia.zadania.wariantObszarow";

export type WariantObszarow = "sekcje" | "drill" | "panel";

export const WARIANT_DOMYSLNY: WariantObszarow = "sekcje";

export const WARIANTY_OBSZAROW: readonly WariantObszarow[] = ["sekcje", "drill", "panel"];

export function odczytajWariantObszarow(): WariantObszarow {
  try {
    const surowe = window.localStorage.getItem(KLUCZ);
    return WARIANTY_OBSZAROW.includes(surowe as WariantObszarow)
      ? (surowe as WariantObszarow)
      : WARIANT_DOMYSLNY;
  } catch {
    return WARIANT_DOMYSLNY;
  }
}

export function zapiszWariantObszarow(wariant: WariantObszarow): void {
  try {
    window.localStorage.setItem(KLUCZ, wariant);
  } catch {
    // Brak magazynu = zostajemy przy domyślnym następnym razem.
  }
}
