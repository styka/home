import { test, expect } from "../fixtures/test";

/**
 * 083 (recenzja) — ŚLEDZENIE CZYTANEGO TEMATU PRZEŻYWA PRZEMONTOWANIE SEKCJI.
 *
 * Usterka, którą ten spec pilnuje: obserwator przecięć był przeliczany efektem zależnym od LISTY
 * IDENTYFIKATORÓW tematów, a obserwował WĘZŁY DOM. Przy przełączeniu `Wiadomości ⇄ Linia czasu`
 * oba widoki rysują sekcje tych samych tematów w tej samej kolejności, więc lista nie zmieniała się
 * ani o znak — a React odmontowywał jeden widok i montował drugi, czyli węzły były nowe. Efekt się
 * nie przeliczał, obserwator trzymał odpięte węzły i wskazanie czytanego tematu ZAMARZAŁO:
 * podświetlenie nagłówka zostawało na przypadkowej sekcji, a strzałka „dalej" skakała względem
 * zamrożonej wartości.
 *
 * Dlaczego test klikacza: „który węzeł obserwuje IntersectionObserver po przemontowaniu" nie ma
 * reprezentacji poza przeglądarką. `tsc`, lint i bramki statyczne przepuszczają to bez słowa.
 */
test.describe("Wiadomości — obserwator sekcji", () => {
  test("[scenario-news-observer-remount] czytany temat aktualizuje się po powrocie z linii czasu", async ({
    page,
  }) => {
    await page.goto("/wiadomosci");
    await expect(page.locator("[data-news-pasek]")).toBeVisible();
    await expect(page.locator("section[data-topic-id]").first()).toBeVisible();

    const maSekcje = await page.locator("section[data-topic-id]").count();
    test.skip(maSekcje < 2, "potrzebne co najmniej dwa tematy, żeby wskazanie miało się na co zmienić");

    // Uchwyt do ramy widoku (to ona się przewija, nie dokument).
    await page.waitForFunction(() => {
      let el: HTMLElement | null = document.querySelector("[data-news-pasek]");
      while ((el = el?.parentElement ?? null)) {
        const s = getComputedStyle(el);
        if (s.overflowY === "auto" || s.overflowY === "scroll") {
          (window as unknown as { __rama: HTMLElement }).__rama = el;
          return true;
        }
      }
      return false;
    }, null, { timeout: 15000 });

    /** Który nagłówek sekcji jest wyróżniony jako CZYTANY (obramowanie akcentem). */
    const czytany = () =>
      page.evaluate(() => {
        const s = Array.from(document.querySelectorAll("section[data-topic-id]")).find((sec) =>
          (sec.firstElementChild as HTMLElement | null)?.className.includes("accent-blue"),
        );
        return s?.getAttribute("data-topic-id") ?? null;
      });

    const przewin = (px: number) =>
      page.evaluate(
        (n) => (window as unknown as { __rama: HTMLElement }).__rama.scrollBy({ top: n, behavior: "instant" }),
        px,
      );

    await przewin(1500);
    await page.waitForTimeout(500);
    const przedPrzelaczeniem = await czytany();

    // Tam i z powrotem — to jest ten moment, w którym węzły się wymieniają, a lista tematów nie.
    await page.getByRole("button", { name: "Linia czasu", exact: true }).click();
    await expect(page.locator("section[data-topic-id]").first()).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Wiadomości", exact: true }).click();
    await expect(page.locator("section[data-topic-id]").first()).toBeVisible({ timeout: 15000 });

    // Po powrocie wskazanie MA reagować na przewijanie. Wracamy na górę i schodzimy w dół — jeśli
    // obserwator trzyma odpięte węzły, wskazanie nie drgnie ani razu.
    await page.evaluate(() =>
      (window as unknown as { __rama: HTMLElement }).__rama.scrollTo({ top: 0, behavior: "instant" }),
    );
    await page.waitForTimeout(400);
    const naGorze = await czytany();

    const widziane = new Set<string>();
    for (let krok = 0; krok < 6; krok++) {
      await przewin(900);
      await page.waitForTimeout(400);
      const c = await czytany();
      if (c) widziane.add(c);
    }

    expect(
      widziane.size,
      `wskazanie czytanego tematu zamarło po przemontowaniu sekcji (przed: ${przedPrzelaczeniem}, na górze: ${naGorze}, widziane: ${[...widziane].join(",")})`,
    ).toBeGreaterThan(1);
  });
});
