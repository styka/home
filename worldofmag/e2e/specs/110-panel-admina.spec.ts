import { test, expect } from "../fixtures/test";

/**
 * 110 — PANEL ADMINISTRATORA JAKO POGRUPOWANA WYRZUTNIA.
 *
 * Zgłoszenie właściciela o `/admin`: „trzeba przewijać/szukać, gdzie coś jest, żeby do czegoś dojść,
 * i ciężko jest na to trafić". Panel był jedną kolumną: karta buildu, jedenaście liczników, płaska
 * lista dwudziestu jeden odnośników bez grup i bez szukania, aktywna sesja.
 */

/** Trasy panelu, których wejścia pilnuje bramka `check:admin-links`. */
const TRASY = [
  "przeglad", "access", "audit", "health", "metrics", "jobs", "ai-calls",
  "config", "llm", "ai-coverage", "user-facts", "categories", "skins", "reports",
  "zrodla-rss", "docs", "audyt", "audyt-podsumowanie", "architektura-docelowa",
  "architecture", "spec-pipeline", "playground", "e2e", "qa",
];

/** Etykiety, które przed 110 stały na `/admin`, a po 110 mają być w przeglądzie. */
const LICZNIKI = [
  "Użytkownicy", "Zespoły", "Raporty", "Uprawnienia", "Aktywność (7 dni)",
  "Pozycje zakupowe", "Zadania", "Notatki", "Przepisy", "Zwierzęta", "Pozycje magazynu",
];
const BUILD = ["Branch", "Commit", "Wiadomość", "Data commitu", "Data buildu"];
const SESJA = ["Email", "Rola", "User ID"];

async function otworz(page: import("@playwright/test").Page, adres: string, szer = 1280) {
  await page.setViewportSize({ width: szer, height: 800 });
  await page.goto(adres);
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(600);
}

// ─── Wyrzutnia ──────────────────────────────────────────────────────────────

test("[110-AC1] narzedzia stoja w nazwanych grupach, kazde z opisem", async ({ page }) => {
  await otworz(page, "/admin");
  const stan = await page.evaluate(() => {
    const main = document.querySelector("main");
    const grupy = Array.from(main?.querySelectorAll("nav section") ?? []);
    return {
      grup: grupy.length,
      nazwyGrup: grupy.map((g) => (g.querySelector("h2")?.textContent || "").trim()),
      // Pozycja ma dwie linie: nazwę i opis. Jedna linia znaczy, że opis nie doszedł.
      pozycjiZOpisem: grupy.reduce(
        (n, g) => n + Array.from(g.querySelectorAll("a, button")).filter((el) => el.querySelectorAll("span span").length >= 2).length,
        0,
      ),
    };
  });
  console.log(`[110-AC1] ${JSON.stringify(stan)}`);
  expect(stan.grup, "narzędzia mają być rozdzielone na grupy").toBeGreaterThanOrEqual(5);
  expect(stan.nazwyGrup.every((n) => n.length > 0), "każda grupa ma nazwę").toBe(true);
  expect(stan.pozycjiZOpisem, "każda pozycja ma nazwę i opis").toBeGreaterThanOrEqual(20);
});

test("[110-AC2] naglowek grupy jest widoczny razem z jej zawartoscia", async ({ page }) => {
  await otworz(page, "/admin");
  const rozjazdy = await page.evaluate(() => {
    const wynik: { grupa: string; odstep: number }[] = [];
    for (const sekcja of Array.from(document.querySelectorAll("main nav section"))) {
      const h2 = sekcja.querySelector("h2");
      const pierwsza = sekcja.querySelector("a, button");
      if (!h2 || !pierwsza) continue;
      const odstep = Math.round(pierwsza.getBoundingClientRect().top - h2.getBoundingClientRect().bottom);
      wynik.push({ grupa: (h2.textContent || "").trim(), odstep });
    }
    return wynik;
  });
  console.log(`[110-AC2] ${JSON.stringify(rozjazdy)}`);
  expect(rozjazdy.length).toBeGreaterThanOrEqual(5);
  // Nagłówek i jego pierwsza pozycja stoją obok siebie — grupa nie jest „jedną listą pod jednym
  // nagłówkiem", w której nazwa grupy ucieka poza ekran.
  for (const r of rozjazdy) {
    expect(r.odstep, `grupa „${r.grupa}" — nagłówek daleko od zawartości`).toBeLessThan(80);
  }
});

test("[110-AC3] kazda trasa panelu ma wejscie, w tym llm i qa", async ({ page }) => {
  await otworz(page, "/admin");
  const adresy = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main a[href^="/admin/"], main a[href^="/services/"]')).map((a) =>
      a.getAttribute("href"),
    ),
  );
  console.log(`[110-AC3] wejść: ${adresy.length}`);
  for (const trasa of ["przeglad", "llm", "qa", "access", "skins", "jobs"]) {
    expect(adresy, `brak wejścia do /admin/${trasa}`).toContain(`/admin/${trasa}`);
  }
  expect(adresy).toContain("/services/moderation");
});

test("[110-AC4] narzedzie otwiera sie jednym klknieciem", async ({ page }) => {
  await otworz(page, "/admin");
  await page.locator('main a[href="/admin/skins"]').first().click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/admin/skins");
});

// ─── Wyszukiwarka ───────────────────────────────────────────────────────────

test("[110-AC6+AC7] wyszukiwarka prowadzi do narzedzia, takze bez ogonkow", async ({ page }) => {
  await otworz(page, "/admin");
  const pole = page.getByRole("searchbox").first();

  for (const [fraza, oczekiwany] of [
    ["skorka", "/admin/skins"],
    ["zrodla", "/admin/zrodla-rss"],
    ["dostep", "/admin/access"],
  ] as const) {
    await pole.fill(fraza);
    await page.waitForTimeout(250);
    const trafienia = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main nav a')).map((a) => a.getAttribute("href")),
    );
    console.log(`[110-AC6+7] „${fraza}" → ${JSON.stringify(trafienia)}`);
    expect(trafienia, `fraza „${fraza}" ma znaleźć narzędzie`).toContain(oczekiwany);
    expect(trafienia.length, "fraza ma zawężać, a nie zostawiać wszystko").toBeLessThan(10);
  }

  await pole.fill("skorka");
  await page.waitForTimeout(250);
  await page.locator('main a[href="/admin/skins"]').first().click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/admin/skins");
});

test("[110-AC8] brak trafien tlumaczy sie slowami", async ({ page }) => {
  await otworz(page, "/admin");
  await page.getByRole("searchbox").first().fill("qqqzzz");
  await page.waitForTimeout(300);
  await expect(page.getByText(/Nic nie pasuje do tej frazy/i)).toBeVisible({ timeout: 10_000 });
  const grup = await page.evaluate(() => document.querySelectorAll("main nav section").length);
  console.log(`[110-AC8] grup po nietrafionej frazie: ${grup}`);
  expect(grup, "pusta grupa nie zostaje z samym nagłówkiem").toBe(0);
});

// ─── Przegląd systemu ───────────────────────────────────────────────────────

test("[110-AC9] panel nie niesie juz buildu, licznikow ani sesji", async ({ page }) => {
  await otworz(page, "/admin");
  // Warunek pozytywny PRZED asercją o braku: inaczej „nie ma liczników" byłoby prawdą także
  // na stronie, która się nie narysowała (lekcja z 109).
  await expect(page.locator('main a[href="/admin/skins"]')).toBeVisible({ timeout: 10_000 });
  const tekst = await page.evaluate(() => document.querySelector("main")?.textContent ?? "");
  for (const etykieta of ["Data buildu", "Aktywność (7 dni)", "User ID"]) {
    expect(tekst, `„${etykieta}" nie należy już do wyrzutni`).not.toContain(etykieta);
  }
});

test("[110-AC10] przeglad niesie wszystkie dane, ktore stary panel mial na miejscu", async ({ page }) => {
  await otworz(page, "/admin/przeglad");
  const tekst = await page.evaluate(() => document.querySelector("main")?.textContent ?? "");
  for (const etykieta of [...BUILD, ...LICZNIKI, ...SESJA]) {
    expect(tekst, `brak „${etykieta}" w przeglądzie`).toContain(etykieta);
  }
  console.log(`[110-AC10] sprawdzono ${BUILD.length + LICZNIKI.length + SESJA.length} etykiet`);
});

// ─── Powrót, rama, telefon ──────────────────────────────────────────────────

test("[110-AC12] z kazdej strony panelu widac droge powrotna", async ({ page }) => {
  for (const trasa of TRASY) {
    await otworz(page, `/admin/${trasa}`);
    const powrot = await page.evaluate(() => {
      const el = document.querySelector('main a[href="/admin"]');
      return { jest: !!el && el.getClientRects().length > 0, tekst: (el?.textContent || "").trim() };
    });
    console.log(`[110-AC12] /admin/${trasa}: ${JSON.stringify(powrot)}`);
    expect(powrot.jest, `/admin/${trasa} bez widocznego powrotu do panelu`).toBe(true);
  }
});

test("[110-AC13] panel i przeglad korzystaja z ramy widoku", async ({ page }) => {
  for (const adres of ["/admin", "/admin/przeglad"]) {
    await otworz(page, adres);
    const naglowkow = await page.evaluate(() => document.querySelectorAll("main h1").length);
    console.log(`[110-AC13] ${adres}: h1 = ${naglowkow}`);
    // Rama rysuje dokładnie jeden nagłówek strony — dwa znaczyłyby, że widok dorysował własny.
    expect(naglowkow).toBe(1);
  }
  const okruszek = await page.evaluate(() => !!document.querySelector('main a[href="/admin"]'));
  expect(okruszek, "przegląd ma okruszek prowadzący do panelu").toBe(true);
});

test("[110-AC15] telefon: jedna kolumna, bez przewijania w poziomie", async ({ page }) => {
  await otworz(page, "/admin", 390);
  await expect(page.locator('main a[href="/admin/skins"]')).toBeVisible({ timeout: 10_000 });
  const wynik = await page.evaluate(() => {
    const pozycje = Array.from(document.querySelectorAll("main nav section a")).slice(0, 4);
    const lewe = new Set(pozycje.map((p) => Math.round(p.getBoundingClientRect().left)));
    const male = pozycje.filter((p) => p.getBoundingClientRect().height < 44).length;
    return {
      nadmiarPoziomy: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      kolumn: lewe.size,
      zaMale: male,
    };
  });
  console.log(`[110-AC15] ${JSON.stringify(wynik)}`);
  expect(wynik.nadmiarPoziomy, "brak przewijania w poziomie").toBeLessThanOrEqual(1);
  expect(wynik.kolumn, "na telefonie pozycje idą w jednej kolumnie").toBe(1);
  expect(wynik.zaMale, "cele dotyku mają co najmniej 44 px").toBe(0);
});
