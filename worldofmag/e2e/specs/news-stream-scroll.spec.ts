import { test, expect } from "../fixtures/test";

/**
 * 082 (poprawka) → 083 — PRZEWIJANIE STRUMIENIA WIADOMOŚCI.
 *
 * Regresja, którą ten spec pilnuje, była zgłoszona przez właściciela tak: „jak przewijam stronę
 * (tryb strumień) to co przewinięcie do kolejnego tematu to mnie cofa do góry. no i ten pasek
 * z tematami i nawigacją nie przykleja się na górze przy scrolowaniu".
 *
 * Obie połowy miały JEDNĄ przyczynę. Pasek tematów nie był przyklejony, więc przy przewijaniu
 * uciekał wysoko ponad ekran. Czytany temat zmienia się SAM (obserwator przecięć), a pasek dosuwał
 * wtedy aktywny chip przez `scrollIntoView` — a ta metoda przewija KAŻDY przewijalny kontener nad
 * elementem, więc żeby chip stał się widoczny, przewijała całą ramę widoku z powrotem na górę.
 * Zmierzone przed poprawką: skok o 4719 px w górę.
 *
 * 083 zmienia SELEKTORY, nie sens: pas chipsów zastąpił `GroupNavigator` (`[data-news-pasek]`),
 * a ostatnie sprawdzenie („aktywny chip widoczny") ustąpiło miejsca odwrotnemu warunkowi z AC-18 —
 * wyzwalacz nawigatora pokazuje WYBRANY FILTR i ma się NIE zmieniać w trakcie przewijania. Nazwa
 * tematu czytanego należy do przyklejonego nagłówka sekcji.
 *
 * Dlaczego to jest test klikacza, a nie jednostkowy: obie rzeczy istnieją wyłącznie w układzie
 * strony. `position: sticky` i „który kontener przewinął się" nie mają reprezentacji, którą dałoby
 * się sprawdzić bez przeglądarki.
 */
test.describe("Wiadomości — strumień", () => {
  test("[scenario-news-stream-scroll] przewijanie nie cofa strony, a pasek nawigacji zostaje u góry", async ({
    page,
  }) => {
    await page.goto("/wiadomosci");
    const pasek = page.locator("[data-news-pasek]");
    await expect(pasek).toBeVisible();

    // Strumień doczytuje się po stronie klienta — bez czekania na sekcje mierzylibyśmy pustą stronę
    // i test „przechodziłby" na tym, że nie ma czego przewijać.
    await expect(page.locator("section[data-topic-id]").first()).toBeVisible();

    // Uchwyt do RAMY WIDOKU — to ona się przewija, nie dokument (`ModuleView` ma `overflow-y`).
    // Czekamy na WARUNEK, a nie na stałą zwłokę: wysokość rośnie w miarę dochodzenia sekcji.
    const maPrzewijanie = await page
      .waitForFunction(() => {
        let el: HTMLElement | null = document.querySelector("[data-news-pasek]");
        while ((el = el?.parentElement ?? null)) {
          const s = getComputedStyle(el);
          if ((s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 2000) {
            (window as unknown as { __rama: HTMLElement }).__rama = el;
            return true;
          }
        }
        return false;
      }, null, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    // Bez treści na kilka ekranów nie ma czego przewijać i test nie miałby o czym orzekać.
    test.skip(!maPrzewijanie, "brak treści na tyle długiej, żeby ramę dało się przewinąć");

    // Sprawdzamy WPROST, że pasek jest przyklejony — inaczej brak opakowania objawiłby się
    // dopiero wyjątkiem przy odczycie geometrii, czyli komunikatem nie na temat.
    const przyklejony = await page.evaluate(
      () => getComputedStyle(document.querySelector("[data-news-pasek]") as HTMLElement).position,
    );
    expect(przyklejony, "pasek nawigacji nie jest przyklejony (brak `position: sticky`)").toBe("sticky");

    /** Nazwa na wyzwalaczu listy tematów — pierwszy przycisk z `aria-haspopup="listbox"`. */
    const etykietaNawigatora = () =>
      page.evaluate(() =>
        (document
          .querySelector('[data-news-pasek] [aria-haspopup="listbox"]')
          ?.textContent ?? "").trim(),
      );
    const etykietaNaStarcie = await etykietaNawigatora();

    const stan = () =>
      page.evaluate(() => {
        const rama = (window as unknown as { __rama: HTMLElement }).__rama;
        const wrap = document.querySelector("[data-news-pasek]") as HTMLElement;
        return {
          scrollTop: Math.round(rama.scrollTop),
          // 0 = pasek dokładnie przy górnej krawędzi ramy, czyli przyklejony.
          pasekOdGory: Math.round(wrap.getBoundingClientRect().top - rama.getBoundingClientRect().top),
        };
      });

    let poprzedni = 0;
    for (let krok = 0; krok < 8; krok++) {
      await page.evaluate(() =>
        (window as unknown as { __rama: HTMLElement }).__rama.scrollBy({ top: 600, behavior: "instant" }),
      );
      // Czas na obserwatora przecięć — to on przestawia czytany temat i to on wyzwalał szarpnięcie.
      await page.waitForTimeout(400);
      const s = await stan();

      expect(s.scrollTop, `krok ${krok + 1}: strona cofnęła się do góry`).toBeGreaterThanOrEqual(poprzedni);
      expect(Math.abs(s.pasekOdGory), `krok ${krok + 1}: pasek nawigacji odkleił się od góry`).toBeLessThanOrEqual(2);
      poprzedni = s.scrollTop;
    }

    // AC-18: pasek pokazuje WYBRANY FILTR, a nie mijany temat — przewinięcie przez kilka sekcji nie
    // ma prawa podmienić etykiety nawigatora.
    expect(
      await etykietaNawigatora(),
      "pasek nawigacji zmienił etykietę w trakcie przewijania — znów pokazuje temat czytany",
    ).toBe(etykietaNaStarcie);

    // …a nazwa tematu czytanego JEST na ekranie, tyle że w przyklejonym nagłówku jego sekcji.
    const naglowekWidoczny = await page.evaluate(() => {
      const rama = (window as unknown as { __rama: HTMLElement }).__rama;
      const gora = rama.getBoundingClientRect().top;
      return Array.from(document.querySelectorAll("section[data-topic-id] h3")).some((h) => {
        const r = (h as HTMLElement).getBoundingClientRect();
        return r.top >= gora - 4 && r.top <= gora + 160 && (h.textContent ?? "").trim().length > 0;
      });
    });
    expect(naglowekWidoczny, "nagłówek czytanej sekcji nie stoi przy górnej krawędzi ramy").toBe(true);
  });
});
