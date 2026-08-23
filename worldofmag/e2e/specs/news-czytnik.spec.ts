import { test, expect } from "../fixtures/test";

/**
 * 084 (AC-2, AC-4, AC-5) — LEKTOR WIADOMOŚCI.
 *
 * Zgłoszenie właściciela: „lektor przestał działać… niby leci a nie słyszę" oraz „lektor przecież
 * nie miał pokazywać swojego okna z tekstem, tylko być przyklejony i pokazywać czytane elementy
 * bezpośrednio w miejscach tych elementów".
 *
 * Ograniczenie, które trzeba znać czytając te testy: w środowisku pracy NIE MA WebKita ani iPhone'a,
 * więc nie sprawdzamy tu prawdziwego zachowania iOS. Sprawdzamy MECHANIZM: że przy syntezie, która
 * milczy, interfejs mówi o ciszy zamiast pokazywać postęp — a to jest zabezpieczenie działające
 * niezależnie od przyczyny milczenia, także takiej, której nie przewidzieliśmy.
 */
test.describe("084 — lektor", () => {
  test("[084-AC2] milcząca synteza daje KOMUNIKAT, a nie licznik postępu", async ({ page }) => {
    // Podstawiamy syntezę, która przyjmuje wypowiedź i nic nie robi — odwzorowanie odrzucenia
    // przez WebKit poza gestem użytkownika (żadnego zdarzenia, żadnego dźwięku).
    await page.addInitScript(() => {
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          speak: () => {},
          cancel: () => {},
          resume: () => {},
          pause: () => {},
          getVoices: () => [],
          addEventListener: () => {},
          removeEventListener: () => {},
          speaking: false,
          paused: false,
          pending: false,
        },
      });
    });

    await page.goto("/wiadomosci");
    await expect(page.locator("section[data-topic-id]").first()).toBeVisible();

    const sluchaj = page.getByRole("button", { name: /Słuchaj wszystkiego/i }).first();
    if ((await sluchaj.count()) === 0) test.skip(true, "brak wiadomości do odsłuchania");
    await sluchaj.click();

    // Czujka ciszy ma 1,5 s; dajemy jej zapas i wymagamy KOMUNIKATU.
    await expect(page.getByRole("status").filter({ hasText: /nie odtworzyło dźwięku/i })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByRole("button", { name: /Odtwórz ponownie/i })).toBeVisible();
  });

  test("[084-AC4, AC-5] pasek lektora jest przyklejony i NIE powtarza treści", async ({ page }) => {
    await page.goto("/wiadomosci");
    await expect(page.locator("section[data-topic-id]").first()).toBeVisible();

    const sluchaj = page.getByRole("button", { name: /Słuchaj wszystkiego/i }).first();
    if ((await sluchaj.count()) === 0) test.skip(true, "brak wiadomości do odsłuchania");
    await sluchaj.click();

    // AC-5: lektor nie ma już własnej listy zdań — po tym poznajemy, że pudełko z treścią zniknęło.
    await expect(page.locator("[data-sentence]")).toHaveCount(0);

    // AC-4: pasek sterowania jest przyklejony do dołu. Szukamy po `data-news-lektor`, a nie po
    // tekście przycisku — „Zamknij lektora" widnieje TAKŻE na przycisku w pasku strumienia (to ten
    // sam przełącznik), więc dopasowanie po nazwie trafiało w niewłaściwy element.
    const pasekLektora = page.locator("[data-news-lektor]");
    await expect(pasekLektora).toBeVisible();
    // AC-4 mówi „przyklejony do dołu ekranu", a nie „konkretna wartość `position`". `fixed` spełnia
    // to lepiej niż `sticky`: `sticky bottom-0` na końcu długiej treści przykleja się dopiero wtedy,
    // gdy przewiniemy do jego miejsca w przepływie — czyli gdy już nie jest potrzebny.
    const pozycja = await pasekLektora.evaluate((el) => getComputedStyle(el as HTMLElement).position);
    expect(["fixed", "sticky"], `pasek lektora nie jest przyklejony (position: ${pozycja})`).toContain(pozycja);

    // …i musi stać przy DOLNEJ krawędzi ramy widoku, a nie gdziekolwiek.
    const przyDole = await pasekLektora.evaluate((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return Math.abs(r.bottom - window.innerHeight) < 120;
    });
    expect(przyDole, "pasek lektora nie stoi przy dolnej krawędzi ekranu").toBe(true);
  });
});
