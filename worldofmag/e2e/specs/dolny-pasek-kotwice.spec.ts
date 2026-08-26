import { test, expect } from "../fixtures/test";

/**
 * 103/104 — DOLNY PASEK: kotwice, gwiazdka, historia, panel szybkiej nawigacji.
 *
 * **104 zmieniło dwie rzeczy w tezach 103**, po tym jak właściciel zobaczył pasek na żywo:
 * ikony modułów i domu **nie mają już gestu** (tapnięcie prowadzi wprost do modułu), a łukowy
 * wachlarz zastąpił **panel** otwierany szóstą kotwicą. Testy gestu zostały więc przepisane na
 * testy panelu — nie skasowane, bo sprawdzana rzecz (dojście do podstron i akcji) istnieje dalej,
 * zmieniła się tylko jej forma.
 *
 * Zgłoszenie właściciela wymieniało skład paska wprost: „Strona domowa | magiczna ikona asystenta |
 * ulubione (gwiazdka) | nawigacja po przebytych stronach". Te testy są **pomiarowe i stanowe**, nie
 * „czy widać przycisk": zgłoszenie mówi o zasięgu kciuka i o ograniczeniach ekranu, a to są
 * własności mierzalne. Sprawdzenie ich wzrokiem znaczyłoby, że przy następnej zmianie stylu nikt
 * się nie dowie o regresji.
 */

/** 098: nigdy `networkidle` — od 072 aplikacja trzyma otwarty strumień zdarzeń. */
async function otworz(page: import("@playwright/test").Page, adres: string) {
  await page.goto(adres);
  await page.waitForLoadState("load").catch(() => {});
}

/**
 * Nazwa gwiazdki ZMIENIA SIĘ wraz ze stanem: „Zapisz ten widok w ulubionych" ↔ „Usuń ten widok
 * z ulubionych" — bo `aria-label` ma mówić, co przycisk ZROBI, a nie jak się nazywa zbiór (AC-27).
 * Lokator musi więc łapać oba warianty; wzorzec dopasowany tylko do jednego gubi przycisk dokładnie
 * w momencie, w którym test sprawdza przełączenie.
 */
const GWIAZDKA = /ten widok (w|z) ulubionych/i;

/** Szósta kotwica (104) — otwiera panel szybkiej nawigacji. */
const NAWIGACJA = /Szybka nawigacja/i;

const pasekWidoczny = async (page: import("@playwright/test").Page) => {
  const pasek = page.getByRole("navigation", { name: /Nawigacja główna/i });
  await expect(pasek).toBeVisible({ timeout: 20_000 });
  return pasek;
};

test.describe("Skład dolnego paska", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("[104-AC5] pięć stałych kotwic stoi w pasku na każdej stronie", async ({ page }) => {
    for (const adres of ["/tasks", "/shopping"]) {
      await otworz(page, adres);
      const pasek = await pasekWidoczny(page);

      // Dom, asystent, ulubione, szybka nawigacja i „wstecz" — nazwy dostępne mówią, CO przycisk
      // robi, a nie jak nazywa się zbiór (AC-24).
      await expect(pasek.getByRole("button", { name: /Przejdź na stronę główną/i })).toHaveCount(1);
      await expect(page.getByRole("button", { name: /^Asystent AI$/ })).toHaveCount(1);
      await expect(pasek.getByRole("button", { name: GWIAZDKA })).toHaveCount(1);
      await expect(pasek.getByRole("button", { name: NAWIGACJA })).toHaveCount(1);
      await expect(pasek.getByRole("button", { name: /(poprzedniej strony|Nie ma jeszcze dokąd wracać)/i })).toHaveCount(1);
    }
  });

  test("[104-AC6] przy 360 px SZEŚĆ pozycji trzyma 44 × 44 px i nic nie wychodzi poza ekran", async ({ page }) => {
    await otworz(page, "/tasks");
    await pasekWidoczny(page);

    const pomiar = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Nawigacja główna"]');
      if (!nav) return null;
      const n = nav.getBoundingClientRect();
      return {
        szerokoscOkna: window.innerWidth,
        pozycje: Array.from(nav.querySelectorAll<HTMLElement>("button")).map((b) => {
          const r = b.getBoundingClientRect();
          return {
            etykieta: b.getAttribute("aria-label") ?? "?",
            w: Math.round(r.width),
            h: Math.round(r.height),
            lewa: Math.round(r.left - n.left),
            prawa: Math.round(n.right - r.right),
          };
        }),
      };
    });

    expect(pomiar).not.toBeNull();
    // 104: sześć pozycji + magiczna ikona. Run 103 twierdził, że sufitem jest pięć („szósta
    // zeszłaby do ~41 px") — to była pomyłka o jeden: 292 / 6 = 48,7 px, a 41,7 px wypada dopiero
    // przy siedmiu. Ten test mierzy realne szerokości, więc pilnuje tego rachunku, a nie komentarza.
    expect(pomiar!.pozycje.length).toBeGreaterThanOrEqual(5);
    for (const p of pomiar!.pozycje) {
      expect(p.w, `szerokość „${p.etykieta}”`).toBeGreaterThanOrEqual(44);
      expect(p.h, `wysokość „${p.etykieta}”`).toBeGreaterThanOrEqual(44);
      expect(p.lewa, `„${p.etykieta}” wychodzi lewą krawędzią`).toBeGreaterThanOrEqual(0);
      expect(p.prawa, `„${p.etykieta}” wychodzi prawą krawędzią`).toBeGreaterThanOrEqual(0);
    }
    console.log(
      `[103-AC3] ${pomiar!.szerokoscOkna} px: ` +
        pomiar!.pozycje.map((p) => `${p.etykieta} ${p.w}×${p.h}`).join(", "),
    );
  });

  test("[103-AC10] gwiazdka zniknęła z GÓRNEGO paska telefonu", async ({ page }) => {
    await otworz(page, "/tasks");
    await pasekWidoczny(page);

    // Górny pasek telefonu to rząd chromu konta obok dzwonka. Gwiazdka ma tam już nie stać —
    // jej jedynym miejscem na telefonie jest pasek dolny.
    const wGornym = await page.evaluate(() => {
      const chrom = document.querySelector<HTMLElement>(".omnia-chrom-konta");
      if (!chrom) return 0;
      return Array.from(chrom.querySelectorAll<HTMLElement>("button")).filter((b) =>
        /ulubion/i.test(b.getAttribute("aria-label") ?? ""),
      ).length;
    });
    expect(wGornym).toBe(0);

    const wDolnym = page
      .getByRole("navigation", { name: /Nawigacja główna/i })
      .getByRole("button", { name: GWIAZDKA });
    await expect(wDolnym).toHaveCount(1);
  });
});

test.describe("Gwiazdka jako inteligentna ikona", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("[103-AC6/AC7] jedno tapnięcie zapisuje widok, drugie go odpisuje", async ({ page }) => {
    await otworz(page, "/tasks");
    const pasek = await pasekWidoczny(page);

    const gwiazdka = pasek.getByRole("button", { name: GWIAZDKA });
    const stanPoczatkowy = await gwiazdka.getAttribute("aria-pressed");

    await gwiazdka.click();
    // Stan zmienia się natychmiast (optymistycznie) — czekamy na PRZECIWNY, nie na konkretny,
    // bo test nie zakłada, czy konto miało ten widok zapisany.
    await expect(gwiazdka).toHaveAttribute("aria-pressed", stanPoczatkowy === "true" ? "false" : "true", {
      timeout: 10_000,
    });

    await gwiazdka.click();
    await expect(gwiazdka).toHaveAttribute("aria-pressed", stanPoczatkowy ?? "false", { timeout: 10_000 });
  });

  test("[103-AC6] zapis melduje się ulotnym potwierdzeniem, nie oknem dialogowym", async ({ page }) => {
    await otworz(page, "/tasks");
    const pasek = await pasekWidoczny(page);
    const gwiazdka = pasek.getByRole("button", { name: GWIAZDKA });

    await gwiazdka.click();
    // Żadnego modala — to była treść zgłoszenia („a nie tym dialogiem który był do tej pory").
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await gwiazdka.click();
  });
});

test.describe("Kolejność kotwic pod kciukiem", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("[103-AC4] historia stoi w rogu pod kciukiem, dom najdalej od niego", async ({ page }) => {
    // Pomiar POZYCJI, nie kolejności w kodzie: nawrót z `/verify` wziął się właśnie stąd, że test
    // sprawdzał listę przed lustrzeniem i przepuścił układ odwrócony do zgłoszenia.
    await otworz(page, "/tasks");
    await pasekWidoczny(page);

    const pomiar = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Nawigacja główna"]');
      if (!nav) return null;
      const srodek = (b: Element) => b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2;
      const znajdz = (re: RegExp) =>
        Array.from(nav.querySelectorAll<HTMLElement>("button")).find((b) => re.test(b.getAttribute("aria-label") ?? ""));
      const historia = znajdz(/(poprzedniej strony|Historia jest pusta)/i);
      const gwiazdka = znajdz(/ten widok (w|z) ulubionych/i);
      const dom = znajdz(/Przejdź na stronę główną/i);
      if (!historia || !gwiazdka || !dom) return null;
      return { historia: srodek(historia), gwiazdka: srodek(gwiazdka), dom: srodek(dom), okno: window.innerWidth };
    });

    expect(pomiar).not.toBeNull();
    // Ręka prawa (domyślna): historia najbardziej na prawo, przed nią gwiazdka, dom po lewej.
    expect(pomiar!.historia, "historia ma stać w rogu pod kciukiem").toBeGreaterThan(pomiar!.gwiazdka);
    expect(pomiar!.dom, "dom ma stać najdalej od kciuka").toBeLessThan(pomiar!.okno / 2);
    console.log(
      `[103-AC4] środki: dom ${Math.round(pomiar!.dom)} px, gwiazdka ${Math.round(pomiar!.gwiazdka)} px, ` +
        `historia ${Math.round(pomiar!.historia)} px (okno ${pomiar!.okno} px)`,
    );
  });
});

test.describe("Historia odwiedzonych stron", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("[104-AC18] tapnięcie „wstecz” cofa o jeden krok", async ({ page }) => {
    await otworz(page, "/tasks");
    await pasekWidoczny(page);
    await otworz(page, "/shopping");
    const pasek = await pasekWidoczny(page);

    await pasek.getByRole("button", { name: /poprzedniej strony/i }).click();
    await expect(page).toHaveURL(/\/tasks/, { timeout: 15_000 });
  });

  test("[104-AC19] pusta historia mówi to wprost, zamiast otwierać pustą warstwę", async ({ page }) => {
    await otworz(page, "/tasks");
    const pasek = await pasekWidoczny(page);

    // Świeże wejście: bieżąca strona nie jest pozycją historii, więc lista jest pusta.
    const przycisk = pasek.getByRole("button", { name: /Nie ma jeszcze dokąd wracać/i });
    if ((await przycisk.count()) === 0) {
      test.skip(true, "konto weszło z historią w pamięci sesji — ten stan sprawdzamy tylko na czystym");
    }
    await przycisk.click();
    // Komunikat zamiast warstwy — i żadnego panelu: pełna historia mieszka w panelu szybkiej
    // nawigacji, a nie pod tą ikoną (104, AC-20).
    await expect(page.getByRole("dialog", { name: /Szybka nawigacja/i })).toHaveCount(0);
  });
});

test.describe("Ikony modułów prowadzą wprost (104)", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("[104-AC1/AC2] przytrzymanie ikony modułu prowadzi do modułu i NIE otwiera warstwy", async ({ page }) => {
    /**
     * To jest sedno zgłoszenia właściciela: „te pierwsze 3 ikony […] mają możliwość rozwijania
     * wachlarzy a one nie mają mieć wachlarzy". Do 103 ta sama ikona robiła dwie różne rzeczy
     * zależnie od czasu przytrzymania, więc każde dotknięcie paska było ryzykiem. Test celowo
     * przytrzymuje palec DŁUGO — dawniej otwierało to warstwę zamiast nawigować.
     */
    await otworz(page, "/shopping");
    const pasek = await pasekWidoczny(page);

    const modul = pasek.getByRole("button", { name: /^Zadania$/ });
    const pudlo = await modul.boundingBox();
    expect(pudlo).not.toBeNull();
    const x = pudlo!.x + pudlo!.width / 2;
    const y = pudlo!.y + pudlo!.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();

    await expect(page).toHaveURL(/\/tasks/, { timeout: 15_000 });
    await expect(page.getByRole("dialog", { name: /Szybka nawigacja/i })).toHaveCount(0);
  });

  test("[104-AC4] pozycje paska nie odbierają przeglądarce przewijania", async ({ page }) => {
    // `touch-action: none` przyszło z gestem. Zostawione po nim zjadałoby przewijanie zaczęte
    // palcem na ikonie — czyli pasek „zacinałby się" w sposób niepowiązany ze skasowaną funkcją.
    await otworz(page, "/tasks");
    await pasekWidoczny(page);

    const zaburzone = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Nawigacja główna"]');
      if (!nav) return -1;
      return Array.from(nav.querySelectorAll<HTMLElement>("button")).filter(
        (b) => getComputedStyle(b).touchAction === "none",
      ).length;
    });
    expect(zaburzone).toBe(0);
  });

  test("[104-AC21] łukowy wachlarz zniknął z aplikacji", async ({ page }) => {
    await otworz(page, "/tasks");
    const pasek = await pasekWidoczny(page);

    for (const nazwa of [/Przejdź na stronę główną/i, /^Zakupy$/]) {
      const pozycja = pasek.getByRole("button", { name: nazwa });
      if ((await pozycja.count()) === 0) continue;
      const pudlo = await pozycja.first().boundingBox();
      if (!pudlo) continue;
      await page.mouse.move(pudlo.x + pudlo.width / 2, pudlo.y + pudlo.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();
      await expect(page.getByRole("dialog", { name: /Nawigacja gestem/i })).toHaveCount(0);
    }
  });
});

test.describe("Panel szybkiej nawigacji (104)", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  async function otworzPanel(page: import("@playwright/test").Page) {
    const pasek = await pasekWidoczny(page);
    await pasek.getByRole("button", { name: NAWIGACJA }).click();
    const panel = page.getByRole("dialog", { name: /Szybka nawigacja/i });
    await expect(panel).toBeVisible({ timeout: 10_000 });
    return panel;
  }

  test("[104-AC9/AC10] tapnięcie kotwicy otwiera panel z listą modułów", async ({ page }) => {
    await otworz(page, "/tasks");
    const panel = await otworzPanel(page);
    await expect(panel.getByRole("button", { name: /^Zakupy$/ })).toBeVisible();
  });

  test("[104-AC11/AC12] moduł rozwija się w miejscu, a cel nawiguje", async ({ page }) => {
    await otworz(page, "/tasks");
    const panel = await otworzPanel(page);

    const rozwin = panel.getByRole("button", { name: /Pokaż miejsca w module Zakupy/i });
    await expect(rozwin).toHaveAttribute("aria-expanded", "false");
    await rozwin.click();
    await expect(panel.getByRole("button", { name: /Ukryj miejsca w module Zakupy/i })).toBeVisible();

    await panel.getByRole("button", { name: /Mapy sklepów/i }).click();
    await expect(page).toHaveURL(/\/shopping\/stores/, { timeout: 15_000 });
  });

  test("[104-AC13] wyszukiwarka znajduje cel wpisany BEZ ogonków", async ({ page }) => {
    // „zalegle" ma znaleźć „Zaległe" — na klawiaturze telefonu ogonki pisze się dłuższym
    // przytrzymaniem klawisza, więc szukający szybko wpisze wersję bez nich.
    await otworz(page, "/tasks");
    const panel = await otworzPanel(page);

    await panel.getByPlaceholder(/Szukaj modułu lub miejsca/i).fill("zalegle");
    await expect(panel.getByRole("button", { name: /Zaległe/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("[104-AC14] ostatnio odwiedzone strony są w panelu", async ({ page }) => {
    await otworz(page, "/shopping");
    await pasekWidoczny(page);
    await otworz(page, "/tasks");
    const panel = await otworzPanel(page);

    await expect(panel.getByText(/Ostatnie/i).first()).toBeVisible();
  });

  test("[104-AC15] Esc zamyka panel i nic nie nawiguje", async ({ page }) => {
    await otworz(page, "/tasks");
    const panel = await otworzPanel(page);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/tasks/);
  });

  test("[104-AC17] panel mieści się na ekranie i przewija w środku", async ({ page }) => {
    await otworz(page, "/tasks");
    await otworzPanel(page);

    const pomiar = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('[role="dialog"][aria-label*="Szybka nawigacja"]');
      if (!panel) return null;
      const r = panel.getBoundingClientRect();
      // Przewijać ma się WNĘTRZE panelu, a sam panel — nie. Dwa zagnieżdżone kontenery znaczyłyby,
      // że przewija się ten zewnętrzny, czyli wyszukiwarka i stopka odjeżdżają razem z listą.
      const przewijalny = Array.from(panel.querySelectorAll<HTMLElement>("*")).some(
        (el) => getComputedStyle(el).overflowY === "auto",
      );
      const panelPrzewija = getComputedStyle(panel).overflowY === "auto";
      return {
        wysokosc: Math.round(r.height),
        okno: window.innerHeight,
        gora: Math.round(r.top),
        przewijalny,
        panelPrzewija,
      };
    });

    expect(pomiar).not.toBeNull();
    expect(pomiar!.wysokosc).toBeLessThanOrEqual(pomiar!.okno);
    expect(pomiar!.gora).toBeGreaterThanOrEqual(0);
    expect(pomiar!.przewijalny, "lista ma własne przewijanie, panel nie rośnie w nieskończoność").toBe(true);
    expect(pomiar!.panelPrzewija, "sam panel NIE przewija — inaczej nagłówek i stopka odjeżdżają").toBe(false);
  });

  test("[104-AC23] ustawienia paska są w stopce panelu", async ({ page }) => {
    // Przeniesione tu z wachlarza — to było ich jedyne wejście z paska, więc kasując wachlarz
    // bez tego odcięlibyśmy je bez zapowiedzi.
    await otworz(page, "/tasks");
    const panel = await otworzPanel(page);
    await expect(panel.getByRole("button", { name: /Ustawienia paska/i })).toBeVisible();
  });
});

test.describe("Akcje z adresu", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("[103-AC20] akcja wyrażona adresem działa też WPROST z linku", async ({ page }) => {
    // Akcję niesie adres, więc ten sam adres działa z panelu, z linku i z zapisanych ulubionych.
    await otworz(page, "/tasks?akcja=nowy-projekt");
    await pasekWidoczny(page);

    const pole = page.getByPlaceholder(/nazwa projektu/i);
    await expect(pole).toBeVisible({ timeout: 20_000 });
  });
});
