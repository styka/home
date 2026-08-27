import { test, expect } from "../fixtures/test";

/**
 * 109 — NAWIGACJA STRONY GŁÓWNEJ I PODZIAŁ WIDOKU USTAWIEŃ.
 *
 * Dwa zgłoszenia właściciela o tym samym: orientacji w powłoce. (1) Wejście na stronę główną było
 * zdublowane i nienazwane — nazwa aplikacji plus mała ikona domu w rzędzie narzędzi konta.
 * (2) `/settings` było jedną kolumną z trzynastoma nagłówkami, po której trzeba było przewijać.
 */

const SEKCJE = [
  "konto",
  "wyglad",
  "nawigacja",
  "jezyk",
  "polaczenia",
  "asystent",
  "zespoly",
  "pomoc",
  "prywatnosc",
  "aktywnosc",
];

async function otworz(page: import("@playwright/test").Page, adres: string, szer = 1280) {
  await page.setViewportSize({ width: szer, height: 800 });
  await page.goto(adres);
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(600);
}

// ─── Strona główna w panelu bocznym ─────────────────────────────────────────

test("[109-AC1] Strona glowna jest nazwanym wierszem nad rzedem ikon konta", async ({ page }) => {
  await otworz(page, "/tasks");
  const uklad = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (!aside) return null;
    const widoczny = (el: Element) => el.getClientRects().length > 0;
    const dom = Array.from(aside.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "/" && /Strona główna/.test(a.textContent || "") && widoczny(a),
    );
    const gwiazdka = Array.from(aside.querySelectorAll("button")).find(
      (b) => /ulubion/i.test(b.getAttribute("aria-label") ?? "") && widoczny(b),
    );
    const pierwszyModul = Array.from(aside.querySelectorAll("nav a")).find(widoczny);
    const y = (el?: Element | null) => (el ? Math.round(el.getBoundingClientRect().top) : null);
    return {
      maTekst: !!dom,
      yDom: y(dom),
      yGwiazdka: y(gwiazdka),
      yModul: y(pierwszyModul),
      tekstModulu: (pierwszyModul?.textContent || "").trim(),
    };
  });
  console.log(`[109-AC1] ${JSON.stringify(uklad)}`);
  expect(uklad).not.toBeNull();
  expect(uklad!.maTekst, "wejście na stronę główną ma być opisane słowami, nie samą ikoną").toBe(true);
  expect(uklad!.yDom!, "Strona główna stoi NAD gwiazdką ulubionych").toBeLessThan(uklad!.yGwiazdka!);
  expect(uklad!.yDom!, "Strona główna stoi NAD listą modułów").toBeLessThan(uklad!.yModul!);
});

test("[109-AC2] w panelu jest dokladnie jedno wejscie na strone glowna", async ({ page }) => {
  await otworz(page, "/tasks");
  const wynik = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (!aside) return null;
    const widoczne = Array.from(aside.querySelectorAll('a[href="/"]')).filter(
      (a) => a.getClientRects().length > 0,
    );
    // Nazwa aplikacji stoi w pierwszym wierszu panelu — sprawdzamy, że NIE jest odnośnikiem.
    const naglowek = aside.firstElementChild;
    return {
      liczba: widoczne.length,
      teksty: widoczne.map((a) => (a.textContent || "").trim()),
      nazwaJestOdnosnikiem: !!naglowek?.querySelector('a[href="/"]'),
    };
  });
  console.log(`[109-AC2] ${JSON.stringify(wynik)}`);
  expect(wynik).not.toBeNull();
  expect(wynik!.liczba, "dwa nienazwane wejścia zastąpiło jedno nazwane").toBe(1);
  expect(wynik!.nazwaJestOdnosnikiem, "nazwa aplikacji jest samą marką, nie odnośnikiem").toBe(false);
});

test("[109-AC3] pozycja biezaca jest oznaczona dla czytnika ekranu", async ({ page }) => {
  await otworz(page, "/");
  const aktualna = await page.evaluate(() => {
    const el = document.querySelector('aside a[href="/"]');
    return { current: el?.getAttribute("aria-current") ?? null, tekst: (el?.textContent || "").trim() };
  });
  console.log(`[109-AC3] ${JSON.stringify(aktualna)}`);
  expect(aktualna.current, "stan aktywny był dotąd wyłącznie kolorem").toBe("page");
});

test("[109-AC4] jedno klikniecie z modulu wraca na strone glowna", async ({ page }) => {
  await otworz(page, "/tasks");
  await page.locator('aside a[href="/"]').first().click();
  await page.waitForLoadState("load").catch(() => {});
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/");
});

test("[109-AC5] telefon: dolny pasek ma jedno wejscie na strone glowna", async ({ page }) => {
  await otworz(page, "/tasks", 390);
  const liczba = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('a[href="/"], button[data-href="/"]')).filter(
        (el) => el.getClientRects().length > 0,
      ).length,
  );
  console.log(`[109-AC5] wejść na stronę główną widocznych na telefonie: ${liczba}`);
  // Panel boczny jest ukryty poniżej `md`, więc wiersz z 109 nie dokłada tu niczego.
  expect(liczba).toBeLessThanOrEqual(1);
});

// ─── Ustawienia: spis, sekcje, wyszukiwarka ─────────────────────────────────

test("[109-AC7] spis sekcji miesci sie bez przewijania, a przy sekcji stoi obok tresci", async ({ page }) => {
  await otworz(page, "/settings");
  const spis = await page.evaluate(() => {
    const main = document.querySelector("main");
    const kontener = main?.querySelector("nav");
    return {
      pozycji: kontener ? kontener.querySelectorAll("a").length : 0,
      przewijaSie: main ? main.scrollHeight > main.clientHeight + 4 : true,
    };
  });
  console.log(`[109-AC7 spis] ${JSON.stringify(spis)}`);
  expect(spis.pozycji, "spis pokazuje wszystkie sekcje").toBe(10);
  expect(spis.przewijaSie, "spis ma się zmieścić na ekranie bez przewijania").toBe(false);

  await otworz(page, "/settings/wyglad");
  const przySekcji = await page.evaluate(() => {
    const listaBoczna = document.querySelector("main aside");
    return {
      listaWidoczna: !!listaBoczna && listaBoczna.getClientRects().length > 0,
      pozycji: listaBoczna ? listaBoczna.querySelectorAll("a").length : 0,
    };
  });
  console.log(`[109-AC7 sekcja] ${JSON.stringify(przySekcji)}`);
  expect(przySekcji.listaWidoczna, "przy otwartej sekcji spis zostaje widoczny obok treści").toBe(true);
  expect(przySekcji.pozycji).toBe(10);
});

test("[109-AC8] telefon: spis bez listy bocznej, a sekcja z widocznym powrotem", async ({ page }) => {
  await otworz(page, "/settings", 390);
  const naSpisie = await page.evaluate(() => {
    const listaBoczna = document.querySelector("main aside");
    return !!listaBoczna && listaBoczna.getClientRects().length > 0;
  });
  console.log(`[109-AC8] lista boczna na telefonie na spisie: ${naSpisie}`);
  // C-31: nigdy dwa panele naraz na telefonie.
  expect(naSpisie).toBe(false);

  await otworz(page, "/settings/wyglad", 390);
  const powrot = page.locator('main a[href="/settings"]').first();
  await expect(powrot).toBeVisible({ timeout: 10_000 });
  const listaBocznaWSekcji = await page.evaluate(() => {
    const el = document.querySelector("main aside");
    return !!el && el.getClientRects().length > 0;
  });
  expect(listaBocznaWSekcji, "na telefonie sekcja zajmuje cały ekran").toBe(false);
});

test("[109-AC9+AC10] kazda sekcja ma wlasny adres i niepusta tresc", async ({ page }) => {
  for (const id of SEKCJE) {
    await otworz(page, `/settings/${id}`);
    const stan = await page.evaluate(() => {
      const main = document.querySelector("main");
      const naglowek = main?.querySelector("h1");
      return {
        sciezka: location.pathname,
        naglowek: (naglowek?.textContent || "").trim(),
        dlugoscTresci: (main?.textContent || "").trim().length,
      };
    });
    console.log(`[109-AC9] ${id}: ${JSON.stringify(stan)}`);
    expect(stan.sciezka, `sekcja ${id} nie przekierowuje na spis`).toBe(`/settings/${id}`);
    expect(stan.naglowek.length, `sekcja ${id} ma nazwany nagłówek`).toBeGreaterThan(0);
    expect(stan.dlugoscTresci, `sekcja ${id} nie może być pusta`).toBeGreaterThan(80);
  }
});

test("[109-AC11] kotwica ulubionych dziala pod nowym adresem", async ({ page }) => {
  await otworz(page, "/settings/nawigacja#ulubione");
  await expect(page.locator("#ulubione")).toBeVisible({ timeout: 10_000 });
});

test("[109-AC13+AC14] wyszukiwarka prowadzi do sekcji, a brak trafien tlumaczy sie slowami", async ({ page }) => {
  await otworz(page, "/settings");
  const pole = page.getByRole("searchbox").first();
  await pole.fill("skorka");
  await page.waitForTimeout(300);
  const poFiltrze = await page.evaluate(
    () => Array.from(document.querySelectorAll("main nav a")).map((a) => a.getAttribute("href")),
  );
  console.log(`[109-AC13] po frazie „skorka": ${JSON.stringify(poFiltrze)}`);
  expect(poFiltrze).toContain("/settings/wyglad");
  expect(poFiltrze.length, "fraza ma zawężać, a nie zostawiać wszystko").toBeLessThan(10);

  await page.locator('main a[href="/settings/wyglad"]').first().click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/settings/wyglad");

  await otworz(page, "/settings");
  await page.getByRole("searchbox").first().fill("qqqzzz");
  await page.waitForTimeout(300);
  const stanPusty = await page.evaluate(() => (document.querySelector("main")?.textContent || ""));
  console.log(`[109-AC14] długość treści przy braku trafień: ${stanPusty.length}`);
  expect(stanPusty, "brak trafień tłumaczy się słowami, a nie pustą przestrzenią").toMatch(/Nic nie pasuje/i);
});

test("[109-AC15] wyszukiwarka dziala bez polskich znakow", async ({ page }) => {
  await otworz(page, "/settings");
  for (const [fraza, oczekiwany] of [
    ["jezyk", "/settings/jezyk"],
    ["prywatnosc", "/settings/prywatnosc"],
    ["polaczenia", "/settings/polaczenia"],
  ] as const) {
    await page.getByRole("searchbox").first().fill(fraza);
    await page.waitForTimeout(250);
    const trafienia = await page.evaluate(
      () => Array.from(document.querySelectorAll("main nav a")).map((a) => a.getAttribute("href")),
    );
    console.log(`[109-AC15] „${fraza}" → ${JSON.stringify(trafienia)}`);
    expect(trafienia, `fraza „${fraza}" bez ogonków ma znaleźć sekcję`).toContain(oczekiwany);
  }
});

test("[109-AC16] Ustawienia korzystaja z ramy widoku, nie z wlasnego naglowka", async ({ page }) => {
  await otworz(page, "/settings/wyglad");
  const naglowki = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      h1: main ? main.querySelectorAll("h1").length : 0,
      okruszek: !!main?.querySelector('a[href="/settings"]'),
    };
  });
  console.log(`[109-AC16] ${JSON.stringify(naglowki)}`);
  // Rama rysuje dokładnie jeden nagłówek strony — dwa znaczyłyby, że widok dorysował własny.
  expect(naglowki.h1).toBe(1);
  expect(naglowki.okruszek, "okruszek „Ustawienia" prowadzi do spisu").toBe(true);
});

test("[109-AC18] telefon: tresc sekcji nie chowa sie pod dolnym paskiem", async ({ page }) => {
  await otworz(page, "/settings/pomoc", 390);
  const wynik = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return null;
    const pasek = document.querySelector("nav[aria-label], footer, [data-pasek-kciuka]");
    const dolTresci = Math.round(main.getBoundingClientRect().bottom);
    return { dolTresci, wysokoscOkna: window.innerHeight, pasekIstnieje: !!pasek };
  });
  console.log(`[109-AC18] ${JSON.stringify(wynik)}`);
  expect(wynik).not.toBeNull();
  expect(wynik!.dolTresci, "obszar treści mieści się w oknie").toBeLessThanOrEqual(wynik!.wysokoscOkna + 2);
});

test("[109] nieznana sekcja daje 404, a trasa zespolow dziala dalej", async ({ page }) => {
  const odpowiedz = await page.goto("/settings/nieistniejaca-sekcja");
  console.log(`[109] status nieznanej sekcji: ${odpowiedz?.status()}`);
  expect(odpowiedz?.status()).toBe(404);

  await otworz(page, "/settings/team/new");
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/settings/team/new");
});
