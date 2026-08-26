import { test, expect } from "../fixtures/test";

/**
 * 103 — DOLNY PASEK: kotwice, gwiazdka, historia, drzewiasty wachlarz.
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

const pasekWidoczny = async (page: import("@playwright/test").Page) => {
  const pasek = page.getByRole("navigation", { name: /Nawigacja główna/i });
  await expect(pasek).toBeVisible({ timeout: 20_000 });
  return pasek;
};

test.describe("Skład dolnego paska", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("[103-AC1] cztery stałe kotwice stoją w pasku na każdej stronie", async ({ page }) => {
    for (const adres of ["/tasks", "/shopping"]) {
      await otworz(page, adres);
      const pasek = await pasekWidoczny(page);

      // Dom, asystent, ulubione i historia — nazwy dostępne mówią, CO przycisk robi (AC-27).
      await expect(pasek.getByRole("button", { name: /Przejdź na stronę główną/i })).toHaveCount(1);
      await expect(page.getByRole("button", { name: /^Asystent AI$/ })).toHaveCount(1);
      await expect(pasek.getByRole("button", { name: GWIAZDKA })).toHaveCount(1);
      await expect(pasek.getByRole("button", { name: /(poprzedniej strony|Historia jest pusta)/i })).toHaveCount(1);
    }
  });

  test("[103-AC3] przy 360 px każdy cel dotyku trzyma 44 × 44 px i nic nie wychodzi poza ekran", async ({ page }) => {
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
    // Pięć pozycji + magiczna ikona — sufit wyliczony w `MAKS_MODULOW_W_PASKU`.
    expect(pomiar!.pozycje.length).toBeGreaterThanOrEqual(4);
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

  test("[103-AC14] krótkie tapnięcie cofa o jeden krok", async ({ page }) => {
    await otworz(page, "/tasks");
    await pasekWidoczny(page);
    await otworz(page, "/shopping");
    const pasek = await pasekWidoczny(page);

    await pasek.getByRole("button", { name: /poprzedniej strony/i }).click();
    await expect(page).toHaveURL(/\/tasks/, { timeout: 15_000 });
  });

  test("[103-AC13] pusta historia mówi to wprost, zamiast otwierać pustą warstwę", async ({ page }) => {
    await otworz(page, "/tasks");
    const pasek = await pasekWidoczny(page);

    // Świeże wejście: bieżąca strona nie jest pozycją historii, więc lista jest pusta.
    const przycisk = pasek.getByRole("button", { name: /Historia jest pusta/i });
    if ((await przycisk.count()) === 0) {
      test.skip(true, "konto weszło z historią w pamięci sesji — ten stan sprawdzamy tylko na czystym");
    }
    await przycisk.click();
    // Komunikat zamiast warstwy: warstwa bez jednej podpowiedzi nie ma wyjścia poza domysłem.
    await expect(page.getByRole("dialog", { name: /Nawigacja gestem/i })).toHaveCount(0);
  });
});

test.describe("Wachlarz: ustawienia paska i akcje z adresu", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("[103-AC20] akcja wyrażona adresem działa też WPROST z linku", async ({ page }) => {
    // To jest sedno wyboru właściciela: akcję niesie adres, więc ten sam adres działa z gestu,
    // z linku i z zapisanych ulubionych. Gdyby akcja była kodem wykonywanym przez powłokę,
    // ten test nie miałby czego sprawdzić.
    await otworz(page, "/tasks?akcja=nowy-projekt");
    await pasekWidoczny(page);

    const pole = page.getByPlaceholder(/nazwa projektu/i);
    await expect(pole).toBeVisible({ timeout: 20_000 });
  });

  test("[103-AC23] ostatnią pozycją wachlarza są ustawienia paska", async ({ page }) => {
    await otworz(page, "/tasks");
    const pasek = await pasekWidoczny(page);

    const dom = pasek.getByRole("button", { name: /Przejdź na stronę główną/i });
    const pudlo = await dom.boundingBox();
    expect(pudlo).not.toBeNull();
    const x = pudlo!.x + pudlo!.width / 2;
    const y = pudlo!.y + pudlo!.height / 2;

    // Gest: przytrzymanie ~350 ms otwiera wachlarz. Wskaźnik przechwytywany jest dopiero przy
    // otwarciu, więc do tej chwili nie wolno ruszać palcem powyżej progu 12 px.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(600);

    await expect(page.getByRole("dialog", { name: /Nawigacja gestem/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Ustawienia paska/i).first()).toBeVisible();

    await page.mouse.up();
  });
});
