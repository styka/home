import { test, expect } from "../fixtures/test";

/**
 * 082 (poprawka) — PRZEWIJANIE STRUMIENIA WIADOMOŚCI.
 *
 * Regresja, którą ten spec pilnuje, była zgłoszona przez właściciela tak: „jak przewijam stronę
 * (tryb strumień) to co przewinięcie do kolejnego tematu to mnie cofa do góry. no i ten pasek
 * z tematami i nawigacją nie przykleja się na górze przy scrolowaniu".
 *
 * Obie połowy miały JEDNĄ przyczynę. Pasek tematów nie był przyklejony, więc przy przewijaniu
 * uciekał wysoko ponad ekran. Aktywny temat zmienia się w strumieniu SAM (obserwator przecięć),
 * a `TopicPicker` dosuwał wtedy aktywny chip przez `scrollIntoView` — a ta metoda przewija KAŻDY
 * przewijalny kontener nad elementem, więc żeby chip stał się widoczny, przewijała całą ramę
 * widoku z powrotem na górę. Zmierzone przed poprawką: skok o 4719 px w górę.
 *
 * Dlaczego to jest test klikacza, a nie jednostkowy: obie rzeczy istnieją wyłącznie w układzie
 * strony. `position: sticky` i „który kontener przewinął się przy `scrollIntoView`" nie mają
 * reprezentacji, którą dałoby się sprawdzić bez przeglądarki.
 */
test.describe("Wiadomości — strumień", () => {
  test("[scenario-news-stream-scroll] przewijanie nie cofa strony, a pasek tematów zostaje u góry", async ({
    page,
  }) => {
    await page.goto("/wiadomosci");
    const pasek = page.locator('[role="tablist"][aria-label="Tematy"]');
    await expect(pasek).toBeVisible();

    // Strumień doczytuje się po stronie klienta — bez czekania na sekcje mierzylibyśmy pustą stronę
    // i test „przechodziłby" na tym, że nie ma czego przewijać.
    await expect(page.locator("section[data-topic-id]").first()).toBeVisible();

    // Uchwyt do RAMY WIDOKU — to ona się przewija, nie dokument (`ModuleView` ma `overflow-y`).
    // Czekamy na WARUNEK, a nie na stałą zwłokę: wysokość rośnie w miarę dochodzenia sekcji.
    const maPrzewijanie = await page
      .waitForFunction(() => {
        let el: HTMLElement | null = document.querySelector('[role="tablist"][aria-label="Tematy"]');
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
    const przyklejony = await page.evaluate(() => {
      const wrap = document
        .querySelector('[role="tablist"][aria-label="Tematy"]')!
        .closest(".sticky") as HTMLElement | null;
      return wrap ? getComputedStyle(wrap).position : null;
    });
    expect(przyklejony, "pasek tematów nie jest przyklejony (brak `position: sticky`)").toBe("sticky");

    const stan = () =>
      page.evaluate(() => {
        const rama = (window as unknown as { __rama: HTMLElement }).__rama;
        const wrap = document
          .querySelector('[role="tablist"][aria-label="Tematy"]')!
          .closest(".sticky") as HTMLElement;
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
      // Czas na obserwatora przecięć — to on przestawia temat i to on wyzwalał szarpnięcie.
      await page.waitForTimeout(400);
      const s = await stan();

      expect(s.scrollTop, `krok ${krok + 1}: strona cofnęła się do góry`).toBeGreaterThanOrEqual(poprzedni);
      expect(Math.abs(s.pasekOdGory), `krok ${krok + 1}: pasek tematów odkleił się od góry`).toBeLessThanOrEqual(2);
      poprzedni = s.scrollTop;
    }

    // Aktywny temat ma być widoczny w pasku — po to pasek przewija się w bok.
    const chipWidoczny = await page.evaluate(() => {
      const p = document.querySelector('[role="tablist"][aria-label="Tematy"]') as HTMLElement;
      const akt = p.querySelector('[aria-selected="true"]') as HTMLElement | null;
      if (!akt) return true;
      return akt.offsetLeft >= p.scrollLeft - 2 && akt.offsetLeft + akt.offsetWidth <= p.scrollLeft + p.clientWidth + 2;
    });
    expect(chipWidoczny, "aktywny temat wypadł poza widoczny obszar paska").toBe(true);
  });
});
