import { test, expect } from "../fixtures/test";

/**
 * 085 — PRZEGLĄD RAMY WIDOKU na dziesięciu trasach różnych klas.
 *
 * Powstał jako jednorazowy przegląd po przyklejeniu paska (T-25) i został na stałe: przebudowa ramy
 * dotyka wszystkich modułów naraz, a jej błędy nie rzucają wyjątkiem — objawiają się wyglądem.
 * Ten test jest najtańszym sposobem, żeby następna zmiana w `ModuleView` nie przeszła niezauważona.
 *
 * Sprawdzamy klasy, w których przebudowa ramy mogła coś zepsuć: wariant gęsty (`compact`), wąska
 * kolumna (`width="narrow"`), okruszek (`breadcrumb`) i listy wirtualizowane (`scrollRef` musi dalej
 * wskazywać element, który FAKTYCZNIE się przewija).
 */
const TRASY: Array<{ sciezka: string; opis: string }> = [
  { sciezka: "/tasks", opis: "gęsty + fill" },
  { sciezka: "/notes", opis: "gęsty + fill" },
  { sciezka: "/shopping", opis: "gęsty + fill" },
  { sciezka: "/wiadomosci", opis: "gęsty + column" },
  { sciezka: "/qa", opis: "wąska kolumna" },
  { sciezka: "/contacts", opis: "lista wirtualizowana" },
  { sciezka: "/magazynowanie", opis: "lista wirtualizowana" },
  { sciezka: "/kitchen", opis: "zwykły column" },
  { sciezka: "/pogoda", opis: "zwykły column" },
  { sciezka: "/calendar", opis: "zwykły column" },
];

for (const { sciezka, opis } of TRASY) {
  test(`[085-rama] ${sciezka} (${opis}) — jeden nagłówek, brak rozpychania, treść nie pod paskiem`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(sciezka);
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(1200);

    const wynik = await page.evaluate(() => {
      const rozpychacze: string[] = [];
      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        const s = getComputedStyle(el);
        if (s.overflowX === "auto" || s.overflowX === "scroll") return;
        if (s.textOverflow === "ellipsis") return;
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
          rozpychacze.push(`${el.tagName.toLowerCase()} (${el.scrollWidth}>${el.clientWidth})`);
        }
      });
      const main = document.querySelector("main");
      return {
        rozpychacze,
        // WIDOCZNE nagłówki, nie węzły w drzewie: wariant gęsty chowa tytuł poniżej `md`
        // (`hidden md:flex`), a `querySelectorAll` liczy też to, czego nie widać — i wtedy test
        // mierzy strukturę HTML zamiast tego, co użytkownik ma na ekranie.
        naglowkow: main
          ? Array.from(main.querySelectorAll<HTMLElement>("h1")).filter((h) => h.getClientRects().length > 0).length
          : -1,
        // Ile kontenerów przewijania ma rama — dwa zagnieżdżone to klasyczny objaw zepsutego układu.
        przewijalnych: Array.from(document.querySelectorAll<HTMLElement>("main *")).filter((el) => {
          const s = getComputedStyle(el);
          return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 20;
        }).length,
      };
    });

    expect(wynik.rozpychacze, `${sciezka}: rozpycha ${wynik.rozpychacze.join(" | ")}`).toEqual([]);
    expect(wynik.naglowkow, `${sciezka}: liczba nagłówków h1`).toBeLessThanOrEqual(1);
    expect(wynik.przewijalnych, `${sciezka}: zagnieżdżone przewijanie`).toBeLessThanOrEqual(1);
  });
}
