import { test, expect } from "../fixtures/test";

/**
 * 043 — faza B: ten sam mechanizm stanu widoku w pozostałych modułach (AC-8a, AC-8b).
 *
 * Dla każdego modułu sprawdzamy dwie rzeczy, dokładnie te, których wymaga spec:
 *  1. **wejście bez parametrów nie zmienia dotychczasowego zachowania** — adres zostaje czysty
 *     (to jest kryterium „bez regresji", AC-8),
 *  2. **adres z parametrem otwiera widok w tym stanie** — czyli zapisany ulubiony wróci taki,
 *     jaki był (AC-8a).
 *
 * Pełna lista modułów wraz z uzasadnieniami pominięć jest w
 * `specs/043-nawigacja-widoki-asystent/pokrycie-widokow.md`.
 */

/** Moduł fazy B: ścieżka + parametr, który ma przetrwać wejście na adres. */
const MODULES: Array<{ name: string; path: string; param: string; value: string }> = [
  { name: "Zdrowie", path: "/health", param: "tab", value: "VISIT" },
  { name: "Kalendarz", path: "/calendar", param: "module", value: "tasks" },
  { name: "Wiadomości", path: "/wiadomosci", param: "widok", value: "settings" },
  { name: "Usługi — katalog", path: "/services", param: "sort", value: "newest" },
  { name: "Usługi — zlecenia", path: "/services/requests", param: "tab", value: "provider" },
  { name: "Pogoda — pomysły", path: "/pogoda/pomysly", param: "filter", value: "saved" },
  { name: "Kontakty", path: "/contacts", param: "q", value: "test" },
  { name: "Raporty", path: "/reports", param: "q", value: "omnia" },
  { name: "Magazynowanie", path: "/magazynowanie", param: "q", value: "test" },
  { name: "Kuchnia — przepisy", path: "/kitchen/recipes", param: "q", value: "zupa" },
  { name: "Kuchnia — spiżarnia", path: "/kitchen/pantry", param: "q", value: "mleko" },
];

test.describe("043 — faza B: stan widoku w pozostałych modułach", () => {
  for (const m of MODULES) {
    test(`[vsb-${m.param}-${m.path.replace(/\//g, "-")}] ${m.name}: bez parametrów czysto, z parametrem odtworzony`, async ({ page }) => {
      // AC-8 — wejście „gołe" nie dokłada niczego do adresu.
      await page.goto(m.path);
      await page.waitForLoadState("networkidle").catch(() => {});

      // Konto testowe nie ma uprawnień do KAŻDEGO modułu — wtedy strona przekierowuje na pulpit
      // i test nie miałby czego sprawdzać. Pomijamy z jawnym powodem, zamiast udawać zieloną
      // asercję na przekierowanym adresie (na tym samym potknęliśmy się w 042 z `/habits`).
      const landed = new URL(page.url()).pathname;
      test.skip(landed !== m.path, `${m.name}: konto testowe nie ma dostępu (przekierowanie na ${landed})`);

      expect(new URL(page.url()).search, `${m.name}: wejście bez parametrów musi zostać czyste`).toBe("");

      // AC-8a — adres z parametrem otwiera się i parametr NIE ginie przy starcie widoku.
      await page.goto(`${m.path}?${m.param}=${m.value}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect
        .poll(() => new URL(page.url()).searchParams.get(m.param), { timeout: 10_000 })
        .toBe(m.value);
    });
  }
});
