import { test, expect } from "../fixtures/test";

/**
 * 111 — PIĘĆ ZGŁOSZEŃ Z TRYBU „WSKAŻ ELEMENT".
 *
 * Tu sprawdzamy wyłącznie to, czego nie da się sprawdzić testem jednostkowym: zachowanie
 * przeglądarki (powrót w historii, realne szerokości elementów w pasku) i to, co widać na ekranie.
 * Logika pamięci pozycji, podpisu bloków lektora i pułapów długości ma własne testy jednostkowe.
 *
 * `networkidle` nie występuje tu ani razu i nie może wystąpić: aplikacja trzyma otwarty strumień
 * zdarzeń, więc sieć nigdy nie jest bezczynna, a taki `wait` może skończyć się wyłącznie limitem
 * czasu (bramka `check:e2e-waits`, lekcja z 098).
 */

const TELEFON = { width: 360, height: 780 };

async function otworz(page: import("@playwright/test").Page, adres: string) {
  await page.goto(adres);
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(600);
}

/** Kontener, który w Omnii NAPRAWDĘ się przewija — to jest sedno zgłoszenia o scrollu. */
async function przewijalny(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const kandydaci = Array.from(main?.querySelectorAll("div") ?? []);
    const el = kandydaci.find((d) => {
      const s = getComputedStyle(d);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && d.scrollHeight > d.clientHeight + 50;
    });
    return el ? { jest: true, wysokosc: el.scrollHeight, okno: el.clientHeight } : { jest: false };
  });
}

// ─── Zgłoszenie 1: powrót „wstecz" ──────────────────────────────────────────

test("[111-AC1] powrot wstecz wraca do miejsca, w ktorym bylo przewiniete", async ({ page }) => {
  await otworz(page, "/admin");

  const kontener = await przewijalny(page);
  test.skip(!kontener.jest, "panel nie ma czego przewijać na tym ekranie");

  // Przewijamy o ponad ekran — mniej i tak nie jest zapamiętywane (próg w `przewijanie.ts`).
  const cel = 400;
  await page.evaluate((y) => {
    const main = document.querySelector("main");
    const el = Array.from(main?.querySelectorAll("div") ?? []).find((d) => {
      const s = getComputedStyle(d);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && d.scrollHeight > d.clientHeight + 50;
    });
    if (el) el.scrollTop = y;
  }, cel);
  await page.waitForTimeout(300);

  await otworz(page, "/admin/przeglad");
  await page.goBack();
  await page.waitForLoadState("load").catch(() => {});
  // Okno ponowień w hooku ma ~1 s — dajemy mu je w całości.
  await page.waitForTimeout(1500);

  const po = await page.evaluate(() => {
    const main = document.querySelector("main");
    const el = Array.from(main?.querySelectorAll("div") ?? []).find((d) => {
      const s = getComputedStyle(d);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && d.scrollHeight > d.clientHeight + 50;
    });
    return el?.scrollTop ?? 0;
  });
  console.log(`[111-AC1] cel=${cel} po powrocie=${po}`);
  expect(po, "powrót w historii ma wrócić w to samo miejsce, a nie na górę").toBeGreaterThan(cel - 60);
});

test("[111-AC2] wejscie z odnosnika (nie wstecz) pokazuje gore strony", async ({ page }) => {
  await otworz(page, "/admin");
  await page.evaluate(() => {
    const main = document.querySelector("main");
    const el = Array.from(main?.querySelectorAll("div") ?? []).find((d) => {
      const s = getComputedStyle(d);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && d.scrollHeight > d.clientHeight + 50;
    });
    if (el) el.scrollTop = 400;
  });
  await page.waitForTimeout(300);

  // Świeże wejście pod ten sam adres — pamięć pozycji istnieje, ale flaga powrotu jest opuszczona.
  await otworz(page, "/admin/przeglad");
  await otworz(page, "/admin");
  await page.waitForTimeout(1200);

  const po = await page.evaluate(() => {
    const main = document.querySelector("main");
    const el = Array.from(main?.querySelectorAll("div") ?? []).find((d) => {
      const s = getComputedStyle(d);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && d.scrollHeight > d.clientHeight + 50;
    });
    return el?.scrollTop ?? 0;
  });
  console.log(`[111-AC2] po wejsciu z odnosnika=${po}`);
  expect(po, "przywracanie dotyczy WYŁĄCZNIE powrotu w historii").toBeLessThan(60);
});

// ─── Zgłoszenie 3: układ Wiadomości ─────────────────────────────────────────

test("[111-AC10] os czasu jest ZAKLADKA, a przelacznika tresci nie ma", async ({ page }) => {
  await otworz(page, "/wiadomosci");
  const zakladki = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="tab"]')).map((el) =>
      (el.getAttribute("aria-label") || el.textContent || "").trim(),
    ),
  );
  console.log(`[111-AC10] zakladki=${JSON.stringify(zakladki)}`);
  expect(zakladki.some((z) => /Wiadomo/i.test(z)), "zakładka Wiadomości").toBe(true);
  expect(zakladki.some((z) => /Gor/i.test(z)), "zakładka Gorące tematy").toBe(true);
  expect(zakladki.some((z) => /Oś czasu/i.test(z)), "oś czasu ma być zakładką, nie opcją przełącznika").toBe(true);
});

test("[111-AC12] stary adres ?tresc=timeline laduje na osi czasu, nie na pustce", async ({ page }) => {
  await otworz(page, "/wiadomosci?tresc=timeline");
  await page.waitForTimeout(900);
  const stan = await page.evaluate(() => ({
    adres: window.location.search,
    wybrana: Array.from(document.querySelectorAll('[role="tab"]'))
      .filter((el) => el.getAttribute("aria-selected") === "true")
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim()),
  }));
  console.log(`[111-AC12] ${JSON.stringify(stan)}`);
  expect(stan.wybrana.some((z) => /Oś czasu/i.test(z)), "ulubione zapisane przed 111 muszą dalej działać").toBe(true);
  expect(stan.adres, "stary klucz znika z adresu — zakładka jest jedynym nośnikiem").not.toContain("tresc=");
});

test("[111-AC13] w pasku akcji rozciaga sie tekst, a nie ikony", async ({ page }) => {
  await page.setViewportSize(TELEFON);
  await otworz(page, "/wiadomosci");

  // Mierzymy DZIECI strefy akcji, a nie cokolwiek pasującego tekstem: ta sama nazwa potrafi
  // wystąpić w menu albo w innej części strony, a wtedy test mierzy nie ten element i „wynik”
  // zależy od tego, co akurat stoi obok.
  const miary = await page.evaluate(() => {
    const strefa = Array.from(document.querySelectorAll("div")).find(
      (d) => typeof d.className === "string" && d.className.includes("[&>*]:flex-1") && d.className.includes("md:order-3"),
    );
    if (!strefa) return null;
    return Array.from(strefa.children).map((el) => ({
      etykieta: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24),
      w: Math.round(el.getBoundingClientRect().width),
      flex: getComputedStyle(el).flex,
    }));
  });
  console.log(`[111-AC13] ${JSON.stringify(miary)}`);
  test.skip(!miary || miary.length < 2, "pasek akcji nieobecny na tym ekranie");

  const rozciagliwe = miary!.filter((m) => m.flex.startsWith("1 1"));
  const ikonowe = miary!.filter((m) => !m.flex.startsWith("1 1"));

  // To jest liczbowy zapis zgłoszenia „dwie ikony po bokach i jedna ikona z tekstem na środku”:
  // przed 111 wszystkie trzy miały ~tę samą szerokość, bo pasek rozciągał je po równo.
  expect(rozciagliwe.length, "akcja z tekstem ma się rozciągać").toBeGreaterThanOrEqual(1);
  expect(ikonowe.length, "akcje ikonowe mają NIE rozciągać się").toBeGreaterThanOrEqual(1);
  const najszerszaIkona = Math.max(...ikonowe.map((m) => m.w));
  expect(rozciagliwe[0].w, "akcja z tekstem wypełnia wolną szerokość").toBeGreaterThan(najszerszaIkona * 1.5);
  expect(najszerszaIkona, "akcja ikonowa bierze swoje minimum, a nie równą część").toBeLessThan(90);
});

test("[111-AC14] udany przebieg to sam czas; liczby zostaja w podpowiedzi", async ({ page }) => {
  await otworz(page, "/wiadomosci");
  const pasek = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("span")).find((s) =>
      /Ostatnie odświeżanie/i.test(s.textContent || ""),
    );
    return el ? { tekst: (el.textContent || "").trim(), tytul: el.getAttribute("title") || "" } : null;
  });
  test.skip(!pasek, "moduł nie ma jeszcze zakończonego przebiegu odświeżania");
  console.log(`[111-AC14] ${JSON.stringify(pasek)}`);
  expect(pasek!.tekst, "w wierszu ma zostać sam czas").not.toMatch(/źródeł:|pozycji:|faktów/);
  expect(pasek!.tytul, "liczby nie znikają — idą do podpowiedzi").toMatch(/źródeł:/);
});

test("[111-AC16] przy 360 px strona nie przewija sie w poziomie", async ({ page }) => {
  await page.setViewportSize(TELEFON);
  for (const adres of ["/wiadomosci", "/wiadomosci?widok=timeline", "/wiadomosci?widok=hot"]) {
    await otworz(page, adres);
    const miary = await page.evaluate(() => ({
      dokument: document.documentElement.scrollWidth,
      okno: document.documentElement.clientWidth,
    }));
    console.log(`[111-AC16] ${adres} ${JSON.stringify(miary)}`);
    expect(miary.dokument, `${adres}: poziome przewijanie całej strony jest zawsze błędem (C-31)`).toBeLessThanOrEqual(
      miary.okno + 1,
    );
  }
});

test("[111-AC17] zarzadzanie zrodlami wchodzi z panelu filtra portali", async ({ page }) => {
  await otworz(page, "/wiadomosci");
  const filtr = page.locator('button[aria-haspopup="dialog"]').first();
  test.skip((await filtr.count()) === 0, "filtr portali nieobecny");
  await filtr.click();
  await page.waitForTimeout(400);
  const wejscie = page.getByRole("button", { name: /Zarządzaj źródłami/i });
  await expect(wejscie, "zarządzanie stoi tam, gdzie filtr — jedno pojęcie, jedno miejsce").toBeVisible();
});

// ─── Zgłoszenie 2: wiedza o użytkowniku ─────────────────────────────────────

test("[111-AC9] automat wnioskowania ma widoczny wylacznik przy liscie faktow", async ({ page }) => {
  await otworz(page, "/settings/asystent");
  const przelacznik = page.getByText(/Sam szukaj hipotez/i).first();
  test.skip((await przelacznik.count()) === 0, "sekcja wiedzy nieobecna na tym koncie");
  await expect(przelacznik, "automat, o którym nie wiadomo, że chodzi, jest gorszy od jego braku").toBeVisible();
  // Ręczne szukanie zostaje niezależnie od automatu.
  await expect(page.getByRole("button", { name: /Poszukaj hipotez/i })).toBeVisible();
});
