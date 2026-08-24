import { test, expect } from "../fixtures/test";
import { ensurePogodaFixtures } from "../fixtures/pogoda";

/**
 * 085 (AC-18, AC-21, AC-22) — PASEK STEROWANIA OBSERWATORAMI.
 *
 * Trzy zgłoszenia właściciela o jednej sekcji: informacja o aktualności oceny i wejście do jej
 * ponowienia stały na samym DOLE pod ścianą obserwatorów („dopiero na sam koniec dowiadujemy się,
 * czy są aktualne"), a nad listą stał rząd chipsów, który łamał się na drugą linię i służył
 * wyłącznie filtrowaniu, którego właściciel nie chciał.
 */

test.beforeAll(async () => {
  await ensurePogodaFixtures();
});

/**
 * OGRANICZENIE ŚRODOWISKA, nie testu: sekcja obserwatorów renderuje się dopiero, gdy uda się pobrać
 * prognozę z Open-Meteo, a polityka sieci sandboxa Claude Code on the web nie przepuszcza wyjścia na
 * zewnątrz. Zamiast czerwonego wyniku z powodu, który nie ma nic wspólnego z przedmiotem testu,
 * pomijamy go z JAWNYM powodem — na maszynie właściciela i w środowisku testowym testy się wykonują.
 * Ten sam wzorzec, co pominięty projekt `mobile` (brak WebKita w obrazie).
 */
async function otworzPogode(page: import("@playwright/test").Page) {
  await page.goto("/pogoda");
  // 098: NIE `networkidle` — od 072 aplikacja trzyma otwarty strumień zdarzeń, więc sieć nigdy nie
  // jest bezczynna i to oczekiwanie kończyłoby się limitem czasu.
  await page.waitForLoadState("load").catch(() => {});
  const sekcja = page.getByRole("heading", { name: /Obserwatory pogody/i });
  const jest = await sekcja.isVisible().catch(() => false);
  test.skip(!jest, "brak prognozy (Open-Meteo niedostępne w tym środowisku) — sekcja obserwatorów się nie renderuje");
  await expect(sekcja).toBeVisible({ timeout: 20_000 });
}

test("[085-AC22] w sekcji obserwatorów nie ma chipsów filtra statusów", async ({ page }) => {
  await otworzPogode(page);
  // Chipsy miały postać „<Stan> <liczba>" i były przyciskami. Szukamy ich po TREŚCI, a nie po
  // klasie: klasy nie są kontraktem, a treść była tym, co właściciel zobaczył na ekranie.
  const chipy = page.getByRole("button").filter({ hasText: /^(Spełnione|Częściowo|Niespełnione|Brak danych)\s*\d+$/ });
  await expect(chipy).toHaveCount(0);
});

test("[085-AC18] stan oceny i jej ponowienie stoją NAD listą obserwatorów", async ({ page }) => {
  await otworzPogode(page);

  const wynik = await page.evaluate(() => {
    const naglowek = Array.from(document.querySelectorAll("h2")).find((h) =>
      (h.textContent ?? "").includes("Obserwatory pogody"),
    );
    const sekcja = naglowek?.closest("div")?.parentElement ?? null;
    if (!sekcja) return null;
    const tekst = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
    // Pierwsza karta obserwatora — po niej poznajemy, gdzie zaczyna się lista.
    const karta = Array.from(sekcja.querySelectorAll<HTMLElement>("div")).find((d) =>
      tekst(d).startsWith("Rower po pracy"),
    );
    // Sterowanie stanem treści AI: przycisk ponownej analizy albo napis „Wygenerowano".
    const ponow = Array.from(sekcja.querySelectorAll<HTMLElement>("button")).find((b) =>
      /Przeanalizuj pogodę na nowo|Oceń obserwatory/i.test(b.getAttribute("title") ?? b.textContent ?? ""),
    );
    if (!karta || !ponow) return { karta: !!karta, ponow: !!ponow };
    return {
      karta: true,
      ponow: true,
      // „Nad listą" znaczy: górna krawędź sterowania wyżej niż górna krawędź pierwszej karty.
      ponowY: Math.round(ponow.getBoundingClientRect().top),
      kartaY: Math.round(karta.getBoundingClientRect().top),
    };
  });

  expect(wynik, "sekcja obserwatorów musi się wyrenderować").not.toBeNull();
  expect(wynik!.karta, "pierwsza karta obserwatora").toBe(true);
  expect(wynik!.ponow, "wejście do ponownej analizy").toBe(true);
  expect(wynik!.ponowY!).toBeLessThan(wynik!.kartaY!);
});

test("[085-AC21] pasek sterowania mieści się w jednym wierszu przy 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await otworzPogode(page);

  const wysokosc = await page.evaluate(() => {
    const naglowek = Array.from(document.querySelectorAll("h2")).find((h) =>
      (h.textContent ?? "").includes("Obserwatory pogody"),
    );
    const sekcja = naglowek?.closest("div")?.parentElement ?? null;
    if (!sekcja) return null;
    const przyciskUkladu = Array.from(sekcja.querySelectorAll<HTMLElement>("button")).find((b) =>
      /układ/i.test(b.getAttribute("aria-label") ?? ""),
    );
    const pasek = przyciskUkladu?.parentElement?.parentElement ?? null;
    return pasek ? Math.round(pasek.getBoundingClientRect().height) : null;
  });

  expect(wysokosc, "pasek sterowania musi istnieć").not.toBeNull();
  // Jeden wiersz kontrolki to ~32–40 px z odstępami; dwa wiersze to ponad 70. Próg 56 px rozdziela
  // te dwa światy z zapasem i nie przywiązuje testu do dokładnych odstępów.
  expect(wysokosc!).toBeLessThan(56);
});

/**
 * 086 (AC-18) — DŁUGA NAZWA LOKALIZACJI NIE ZJADA TYTUŁU.
 *
 * Zgłoszenie właściciela: przy „Kocoń, województwo śląskie" tytuł modułu zostawał przycięty do
 * kilku liter. Przyczyna była w `PageHeader`: akcja miała `flex-shrink: 0`, więc rosła kosztem
 * sąsiada. Pierwsza naprawa dała akcji sufit `max-width: 55%` — i zepsuła Kalendarz, którego
 * nawigator miesiąca nie potrafi się zwęzić i wychodził 2 px poza swoje pudełko. Dlatego mierzymy
 * OBIE strony: tytuł ma być czytelny, a akcja ma się mieścić w swoim pudełku.
 */
test("[086-AC18] dluga nazwa lokalizacji nie przycina tytulu modulu", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/pogoda");
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(800);

  const pomiar = await page.evaluate(() => {
    const h1 = document.querySelector("main h1");
    if (!h1) return null;
    const naglowek = h1.closest("div")?.parentElement as HTMLElement | null;
    const tytul = h1.querySelector("span:last-of-type") as HTMLElement | null;
    const akcja = naglowek?.lastElementChild as HTMLElement | null;
    return {
      tytulTekst: (tytul?.textContent ?? "").trim(),
      tytulWidoczny: tytul ? tytul.clientWidth : -1,
      tytulTresc: tytul ? tytul.scrollWidth : -1,
      akcjaWidoczna: akcja ? akcja.clientWidth : -1,
      akcjaTresc: akcja ? akcja.scrollWidth : -1,
    };
  });

  expect(pomiar, "nagłówek modułu nie znaleziony").not.toBeNull();
  const p = pomiar!;
  console.log(`[086-AC18] ${JSON.stringify(p)}`);

  // Tytuł „Pogoda" jest krótki — po naprawie musi się mieścić w całości, bez wielokropka.
  expect(p.tytulTresc, `tytuł „${p.tytulTekst}" przycięty (${p.tytulTresc}>${p.tytulWidoczny})`)
    .toBeLessThanOrEqual(p.tytulWidoczny + 1);
  // A pudełko akcji nie może być węższe od swojej treści — to była regresja pierwszej naprawy.
  expect(p.akcjaTresc, `akcja wychodzi poza pudełko (${p.akcjaTresc}>${p.akcjaWidoczna})`)
    .toBeLessThanOrEqual(p.akcjaWidoczna + 1);
});
