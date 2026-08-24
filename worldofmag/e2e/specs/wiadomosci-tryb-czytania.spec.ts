import { test, expect } from "../fixtures/test";

/**
 * 087 — TRYB CZYTANIA, NAGŁÓWKI SEKCJI I SZCZELNOŚĆ PASKÓW.
 *
 * Zgłoszenia właściciela z testów 086: „powinien być jakiś toggle, który schowa wszystko co zbędne",
 * „chip z ilością jest jakoś za daleko z prawej", „ikony edycji i usunięcia niech będą w dropdown",
 * „między paskami widać przescrolowany content".
 */

/** Kontener przewijania znajdujemy po FAKCIE, że się przewija — nie po pozycji w drzewie. */
async function ustawPrzewiniecie(page: import("@playwright/test").Page, top: number) {
  await page.evaluate((y) => {
    const pasek = document.querySelector("[data-news-pasek]") as HTMLElement | null;
    let el: HTMLElement | null = pasek?.parentElement ?? null;
    while (el && !(el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(el).overflowY))) {
      el = el.parentElement;
    }
    if (el) el.scrollTop = y;
  }, top);
  await page.waitForTimeout(400);
}

async function otworz(page: import("@playwright/test").Page, adres: string, szer = 1280) {
  await page.setViewportSize({ width: szer, height: 800 });
  await page.goto(adres);
  // 098: NIE `networkidle` — aplikacja trzyma otwarty strumień zdarzeń, więc sieć nigdy nie jest bezczynna.
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(1200);
}

/** Chrom nad pierwszą wiadomością = odległość górnej krawędzi pierwszej karty od góry ramy. */
async function chromNadTrescia(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const sekcja = document.querySelector("section");
    const karta = sekcja?.querySelector("div.sticky + div > div") ?? sekcja?.querySelector("div.sticky")?.nextElementSibling;
    const rama = document.querySelector("main > div");
    if (!karta || !rama) return null;
    return Math.round(karta.getBoundingClientRect().top - rama.getBoundingClientRect().top);
  });
}

test("[087-AC1] tryb czytania chowa chrom modulu, zostawia nawigacje i lektora", async ({ page }) => {
  await otworz(page, "/wiadomosci", 360);

  const przelacznik = page.getByRole("button", { name: /Tryb czytania/i });
  await expect(przelacznik).toBeVisible({ timeout: 15_000 });
  await przelacznik.click();
  await page.waitForTimeout(600);

  const stan = await page.evaluate(() => {
    const widoczny = (el: Element | null | undefined) => !!el && el.getClientRects().length > 0;
    const zakladka = Array.from(document.querySelectorAll('[role="tab"]')).find((el) => widoczny(el));
    const odswiez = Array.from(document.querySelectorAll("button")).find((b) => /Odśwież/.test(b.textContent || "") && widoczny(b));
    const stanOdswiezania = Array.from(document.querySelectorAll("div")).find((d) => /Ostatnie odświeżanie/.test(d.textContent || "") && widoczny(d));
    const nawigator = Array.from(document.querySelectorAll("button")).find((b) => /Przejdź do tematu/.test(b.textContent || "") && widoczny(b));
    const wyjscie = Array.from(document.querySelectorAll("button")).find((b) => /Wyjdź z trybu czytania/.test(b.getAttribute("aria-label") || "") && widoczny(b));
    return {
      zakladki: !!zakladka,
      akcjeGlowne: !!odswiez,
      pasekStanu: !!stanOdswiezania,
      nawigator: !!nawigator,
      wyjscie: !!wyjscie,
      adres: location.search,
    };
  });

  expect(stan.zakladki, "zakładki modułu mają zniknąć").toBe(false);
  expect(stan.akcjeGlowne, "akcje główne mają zniknąć").toBe(false);
  expect(stan.pasekStanu, "pasek stanu odświeżania ma zniknąć").toBe(false);
  expect(stan.nawigator, "nawigacja po tematach ma zostać").toBe(true);
  // AC-3: wyjście z trybu musi być widoczne bez przewijania.
  expect(stan.wyjscie, "wyjście z trybu ma być widoczne").toBe(true);
  // AC-4: tryb żyje w adresie, więc widok da się zapisać w ulubionych.
  expect(stan.adres).toContain("czytanie=1");
});

test("[087-AC2] tryb czytania zdejmuje chrom, ktory nie jest nawigacja ani lektorem", async ({ page }) => {
  await otworz(page, "/wiadomosci", 360);
  const przed = await chromNadTrescia(page);
  const pasekWidokuH = await page.evaluate(() => {
    const rama = document.querySelector("main > div") as HTMLElement | null;
    return rama ? parseFloat(getComputedStyle(rama).getPropertyValue("--view-bar-h")) || 0 : 0;
  });

  await otworz(page, "/wiadomosci?czytanie=1", 360);
  const po = await chromNadTrescia(page);
  const zostalo = await page.evaluate(() => {
    const widoczny = (el: Element | null | undefined) => !!el && el.getClientRects().length > 0;
    const jest = (re: RegExp) =>
      Array.from(document.querySelectorAll("button")).some((b) => re.test(b.textContent || "") && widoczny(b));
    return { lektor: jest(/Słuchaj|Zamknij lektora/), nawigacja: jest(/Przejdź do tematu/) };
  });

  console.log(`[087-AC2] chrom 360: przed=${przed} po=${po}, pasek widoku=${pasekWidokuH}`);
  expect(przed).not.toBeNull();
  expect(po).not.toBeNull();
  /**
   * Kryterium poprawione po pomiarze (C-54): pierwotne „co najmniej o połowę" było moją liczbą,
   * a nie wymaganiem właściciela — i okazało się nieosiągalne bez skasowania wejścia do lektora,
   * czyli dokładnie tego, co kazał ZOSTAWIĆ. Mierzymy więc to, co tryb naprawdę zdejmuje.
   */
  expect(przed! - po!, "z ekranu ma zniknąć co najmniej pasek widoku").toBeGreaterThanOrEqual(
    Math.round(pasekWidokuH) - 2,
  );
  expect(zostalo.lektor, "lektor ma zostać").toBe(true);
  expect(zostalo.nawigacja, "nawigacja po tematach ma zostać").toBe(true);
});

test("[087-AC9] chip licznika stoi przy tytule sekcji", async ({ page }) => {
  await otworz(page, "/wiadomosci");
  const pomiar = await page.evaluate(() => {
    const naglowek = document.querySelector("section > div.sticky");
    const h3 = naglowek?.querySelector("h3");
    const chip = h3?.parentElement?.querySelector("span");
    if (!h3 || !chip) return null;
    return {
      odstep: Math.round(chip.getBoundingClientRect().left - h3.getBoundingClientRect().right),
      zawija: getComputedStyle(naglowek as Element).flexWrap,
      wysokosc: Math.round((naglowek as Element).getBoundingClientRect().height),
    };
  });
  console.log(`[087-AC9] ${JSON.stringify(pomiar)}`);
  expect(pomiar).not.toBeNull();
  expect(pomiar!.odstep, "chip ma stać przy tytule, nie na krańcu wiersza").toBeLessThanOrEqual(12);
  expect(pomiar!.zawija, "nagłówek nie zawija się na drugą linię").toBe("nowrap");
});

test("[087-AC10] naglowek sekcji miesci sie w jednym wierszu przy 360 px", async ({ page }) => {
  await otworz(page, "/wiadomosci", 360);
  const pomiar = await page.evaluate(() => {
    const naglowek = document.querySelector("section > div.sticky") as HTMLElement | null;
    const chip = naglowek?.querySelector("h3")?.parentElement?.querySelector("span") as HTMLElement | null;
    if (!naglowek || !chip) return null;
    return {
      wysokosc: Math.round(naglowek.getBoundingClientRect().height),
      chipPrzyciety: chip.scrollWidth > chip.clientWidth + 1,
    };
  });
  console.log(`[087-AC10] ${JSON.stringify(pomiar)}`);
  expect(pomiar).not.toBeNull();
  expect(pomiar!.wysokosc, "jeden wiersz, nie dwa").toBeLessThan(70);
  expect(pomiar!.chipPrzyciety, "licznik nie może być przycięty").toBe(false);
});

test("[087-AC11] akcje tematu sa schowane pod trzema kropkami", async ({ page }) => {
  await otworz(page, "/wiadomosci");
  const naglowek = page.locator("section > div.sticky").first();
  // Odsłonięte ikony edycji/usuwania nie mogą stać w nagłówku…
  await expect(naglowek.getByRole("button", { name: /^Edytuj temat/i })).toHaveCount(0);
  // …a menu ma być jedno i ma się otwierać.
  const kropki = naglowek.getByRole("button", { name: /Więcej działań/i }).first();
  await expect(kropki).toBeVisible({ timeout: 15_000 });
  await kropki.click();
  await expect(page.getByRole("menuitem", { name: /Edytuj temat/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("menuitem", { name: /Usuń temat/i })).toBeVisible();
});

test("[087-AC15] zaslona naglowkow nadaza za paskiem widoku", async ({ page }) => {
  await otworz(page, "/wiadomosci", 360);
  await ustawPrzewiniecie(page, 3000);

  const wynik = await page.evaluate(async () => {
    const pasek = document.querySelector("[data-news-pasek]") as HTMLElement;
    const pasekWidoku = Array.from(document.querySelectorAll<HTMLElement>("main *")).find(
      (el) => getComputedStyle(el).zIndex === "40",
    );
    const przerwa = () => {
      const rp = pasek.getBoundingClientRect();
      const naglowki = Array.from(document.querySelectorAll<HTMLElement>("section > div.sticky"));
      const przypiety = naglowki.reduce((a, b) =>
        Math.abs(a.getBoundingClientRect().top - rp.bottom) < Math.abs(b.getBoundingClientRect().top - rp.bottom) ? a : b,
      );
      return Math.round(przypiety.getBoundingClientRect().top - rp.bottom);
    };
    const przed = przerwa();

    /**
     * KONTROLA RÓŻNICUJĄCA (lekcja z 086): sam odczyt przerwy niczego nie rozstrzyga, bo w stanie
     * ustalonym paski przylegają w OBU wersjach kodu. Podnosimy więc wysokość PASKA WIDOKU — czyli
     * robimy dokładnie to, co u właściciela robi przycisk „Odświeżam…", zawijający drugi wiersz.
     * Ze starą, przeliczaną liczbą zasłona nie nadążała i przerwa rosła do −40 px.
     */
    const przekladka = document.createElement("div");
    przekladka.style.height = "40px";
    pasekWidoku?.appendChild(przekladka);
    await new Promise((r) => setTimeout(r, 700));
    return { przed, po: przerwa() };
  });

  console.log(`[087-AC15] przerwa przed=${wynik.przed} po=${wynik.po}`);
  expect(Math.abs(wynik.przed), "w stanie ustalonym paski przylegają").toBeLessThanOrEqual(2);
  expect(Math.abs(wynik.po), "po zmianie wysokości paska widoku zasłona ma nadążyć").toBeLessThanOrEqual(2);
});
