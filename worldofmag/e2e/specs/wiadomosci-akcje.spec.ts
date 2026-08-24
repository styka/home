import { test, expect } from "../fixtures/test";

/**
 * 086 (AC-1..AC-4, AC-20, AC-21) — SEMANTYKA AKCJI I PRZYKLEJANIE W WIADOMOŚCIACH.
 *
 * Zgłoszenia właściciela: „czym się różni odrzuć od przeczytane?" (odpowiedź z kodu: niczym — status
 * `DISMISSED` był zapisywany i nigdzie nieodczytywany) oraz „tematy wiadomości przyklejają się za
 * nisko".
 */

/** Włącza pokazywanie pustych tematów, żeby w widoku w ogóle były sekcje. Zwraca stan poprzedni. */
async function pokazPusteTematy(page: import("@playwright/test").Page): Promise<boolean> {
  const ustawienia = page.getByRole("tab", { name: "Ustawienia", exact: true });
  await ustawienia.click();
  const przelacznik = page.getByRole("checkbox", { name: /Pokazuj tematy bez nowych wiadomości/i });
  await expect(przelacznik).toBeVisible({ timeout: 15_000 });
  const bylo = await przelacznik.isChecked();
  if (!bylo) await przelacznik.check();
  await page.getByRole("tab", { name: "Tematy", exact: true }).click();
  await page.waitForTimeout(1200);
  return bylo;
}

async function przywroc(page: import("@playwright/test").Page, bylo: boolean) {
  if (bylo) return;
  await page.getByRole("tab", { name: "Ustawienia", exact: true }).click();
  await page.getByRole("checkbox", { name: /Pokazuj tematy bez nowych wiadomości/i }).uncheck();
}

test("[086-AC4] akcja Odrzuć nie istnieje nigdzie w module", async ({ page }) => {
  await page.goto("/wiadomosci");
  await page.waitForLoadState("load").catch(() => {});
  const bylo = await pokazPusteTematy(page);
  await expect(page.getByRole("button", { name: /^Odrzuć$/i })).toHaveCount(0);
  await przywroc(page, bylo);
});

test("[086-AC21] kontrolka wyboru tematu nie powtarza nazwy zakładki", async ({ page }) => {
  await page.goto("/wiadomosci");
  await page.waitForLoadState("load").catch(() => {});
  const wyzwalacz = page.locator('[data-news-pasek] [aria-haspopup="listbox"]');
  await expect(wyzwalacz).toBeVisible({ timeout: 15_000 });
  const etykieta = (await wyzwalacz.textContent())?.trim() ?? "";
  // Zakładka nazywa się „Tematy" — kontrolka ma mówić, CO robi, a nie powtarzać jej nazwę.
  expect(etykieta).not.toBe("Tematy");
  expect(etykieta).toMatch(/Przejdź do tematu/i);
});

test("[086-AC20] zasłona nagłówków nie rośnie, gdy nad paskiem modułu coś stanie", async ({
  page,
}) => {
  await page.goto("/wiadomosci");
  await page.waitForLoadState("load").catch(() => {});
  const bylo = await pokazPusteTematy(page);

  /**
   * SEDNO TESTU — i powód, dla którego pierwsza wersja była bezwartościowa.
   *
   * Zasłona (`--news-pasek-h`) mówi nagłówkom sekcji, na jakiej wysokości mają się zatrzymać.
   * Do 086 liczyliśmy ją POZYCYJNIE: „odległość dolnej krawędzi paska modułu od górnej krawędzi
   * ramy". Ta miara jest poprawna dokładnie wtedy, gdy pasek modułu przylega do paska widoku — i to
   * właśnie zachodzi w środowisku testowym, więc porównanie samych liczb przechodziło także ze
   * wstrzykniętą regresją (sprawdzone: 107 = 48 + 59 w obu wersjach).
   *
   * Różnica ujawnia się, gdy między paskiem widoku a paskiem modułu COŚ STANIE — u właściciela robi
   * to pasek stanu odświeżania. Wstawiamy więc taki element sztucznie i sprawdzamy, czy zasłona
   * została na swojej wysokości. Miara pozycyjna urośnie o jego wysokość i nagłówki przykleją się
   * za nisko — dokładnie tak, jak w zgłoszeniu.
   */
  const przed = await page.evaluate(() =>
    Math.round(
      parseFloat(
        getComputedStyle(document.querySelector("section div.sticky") as HTMLElement).top,
      ) || 0,
    ),
  );

  await page.evaluate(() => {
    const pasek = document.querySelector<HTMLElement>("[data-news-pasek]");
    if (!pasek?.parentElement) return;
    const przekladka = document.createElement("div");
    przekladka.id = "test-przekladka";
    przekladka.style.height = "40px";
    pasek.parentElement.insertBefore(przekladka, pasek);
  });
  /**
   * Przeliczenie zasłony robi `ResizeObserver` pilnujący paska i ramy — samo wstawienie elementu
   * NAD paskiem nie zmienia ich rozmiaru, więc nic by się nie przeliczyło i test znów mierzyłby
   * nic. Szturchamy więc szerokość okna: to jest ta sama okoliczność, w której zasłona przelicza
   * się u właściciela (pojawienie się i zniknięcie paska stanu odświeżania).
   */
  await page.setViewportSize({ width: 1279, height: 800 });
  await page.waitForTimeout(700);

  const po = await page.evaluate(() =>
    Math.round(
      parseFloat(
        getComputedStyle(document.querySelector("section div.sticky") as HTMLElement).top,
      ) || 0,
    ),
  );

  await page.evaluate(() => document.getElementById("test-przekladka")?.remove());
  await przywroc(page, bylo);

  expect(przed, "zasłona musi być policzona").toBeGreaterThan(0);
  // Zasłona to suma DWÓCH WYSOKOŚCI — nie zależy od tego, co stoi wyżej.
  expect(
    Math.abs(po - przed),
    `zasłona zmieniła się z ${przed} px na ${po} px po wstawieniu 40 px nad paskiem modułu`,
  ).toBeLessThanOrEqual(2);
});
