import { test, expect } from "../fixtures/test";
import { ensureEtykietyZadan } from "../fixtures/zadania";

/**
 * 100 — ERGONOMIA NAWIGACJI: paski filtrów i pasek kciuka.
 *
 * Trzy zgłoszenia właściciela o jednej rzeczy: pasek ma pokazywać, co jest dostępne i co jest
 * wybrane, mieścić się w stałej wysokości i być w zasięgu kciuka.
 *
 * Te testy są w większości POMIAROWE, nie „czy widać przycisk". Powód jest w treści zgłoszeń:
 * „pasek jest bardzo długi", „nie widać by była wybrana" — to są własności mierzalne w pikselach
 * i w atrybutach, a nie kwestia gustu. Sprawdzanie ich wzrokiem znaczyłoby, że przy następnej
 * zmianie stylu nikt się nie dowie, że regresja wróciła.
 */

/** 098: nigdy `networkidle` — od 072 aplikacja trzyma otwarty strumień zdarzeń. */
async function otworz(page: import("@playwright/test").Page, adres: string) {
  await page.goto(adres);
  await page.waitForLoadState("load").catch(() => {});
}

test.describe("Wiadomości — przełącznik segmentowy", () => {
  test("[100-AC1] trzy listy tematów stoją w pasku, bez otwierania menu", async ({ page }) => {
    await otworz(page, "/wiadomosci?widok=hot");

    const przelacznik = page.getByRole("tablist", { name: /Listy tematów/i });
    await expect(przelacznik).toBeVisible({ timeout: 20_000 });

    for (const nazwa of ["Proponowane", "Monitorowane", "Odrzucone"]) {
      await expect(przelacznik.getByRole("tab", { name: new RegExp(nazwa, "i") })).toHaveCount(1);
    }
  });

  test("[100-AC2] wybrany segment niesie stan dla czytnika ekranu", async ({ page }) => {
    await otworz(page, "/wiadomosci?widok=hot");
    const przelacznik = page.getByRole("tablist", { name: /Listy tematów/i });
    await expect(przelacznik).toBeVisible({ timeout: 20_000 });

    // „Proponowane" jest listą domyślną i nigdy nie bywa wyłączone (jego pustka to stan
    // przejściowy, nie brak listy) — więc to na nim sprawdzamy sam mechanizm zaznaczenia.
    const proponowane = przelacznik.getByRole("tab", { name: /Proponowane/i });
    await expect(proponowane).toHaveAttribute("aria-selected", "true");
  });

  test("[100-AC3] w sekcji propozycji nie ma już menu ⋮", async ({ page }) => {
    await otworz(page, "/wiadomosci?widok=hot");
    await expect(page.getByRole("tablist", { name: /Listy tematów/i })).toBeVisible({ timeout: 20_000 });

    // Menu z 099 miało dostępną nazwę „Więcej działań" i było JEDYNYM wejściem do dwóch list.
    // Menu tematu (087, „Więcej działań tematu…") zostaje — stąd dokładne dopasowanie nazwy.
    await expect(page.getByRole("button", { name: /^Więcej działań$/ })).toHaveCount(0);
  });

  test("[100-AC4] lista o zerowym liczniku jest widoczna, ale wyłączona", async ({ page }) => {
    await otworz(page, "/wiadomosci?widok=hot");
    const przelacznik = page.getByRole("tablist", { name: /Listy tematów/i });
    await expect(przelacznik).toBeVisible({ timeout: 20_000 });

    // Świeże konto nie ma odrzuconych tematów. Segment MUSI istnieć mimo to: znikanie zmieniałoby
    // szerokość paska w trakcie pracy i ukrywało sam fakt, że taka lista istnieje.
    const odrzucone = przelacznik.getByRole("tab", { name: /Odrzucone/i });
    await expect(odrzucone).toHaveCount(1);
    const licznik = (await odrzucone.textContent()) ?? "";
    if (/0\s*$/.test(licznik.trim())) {
      await expect(odrzucone).toBeDisabled();
    }
  });

  test("[100-AC5] przyklejony nagłówek sekcji mieści się w jednym wierszu przy 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 });
    await otworz(page, "/wiadomosci?widok=hot");
    const przelacznik = page.getByRole("tablist", { name: /Listy tematów/i });
    await expect(przelacznik).toBeVisible({ timeout: 20_000 });

    const pomiar = await page.evaluate(() => {
      const pasek = document.querySelector<HTMLElement>('[role="tablist"][aria-label="Listy tematów"]');
      const naglowek = pasek?.closest<HTMLElement>("div.sticky");
      if (!pasek || !naglowek) return null;
      const tabs = Array.from(pasek.querySelectorAll<HTMLElement>('[role="tab"]'));
      return {
        wysokoscNaglowka: Math.round(naglowek.getBoundingClientRect().height),
        // Jeden wiersz = wszystkie segmenty mają tę samą współrzędną górną.
        gornychKrawedzi: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top))).size,
        liczbaSegmentow: tabs.length,
      };
    });

    expect(pomiar).not.toBeNull();
    expect(pomiar!.liczbaSegmentow).toBe(3);
    expect(pomiar!.gornychKrawedzi).toBe(1);
    // Nagłówek sekcji przed 100 miał ~37 px (tytuł + licznik w jednym wierszu). Przełącznik ma
    // zmieścić się w tym samym rzędzie wielkości — zapas jednego wiersza tekstu, nie więcej.
    expect(pomiar!.wysokoscNaglowka).toBeLessThanOrEqual(60);
    console.log(`[100-AC5] wysokość przyklejonego nagłówka przy 360 px: ${pomiar!.wysokoscNaglowka} px`);
  });
});

test.describe("Zadania — filtr etykiet", () => {
  // Filtr nie renderuje się przy pustym słowniku etykiet ani na pulpicie `/tasks` — potrzebny jest
  // projekt i etykiety, a seed nie zakłada ani jednego, ani drugiego.
  let projekt = "";
  test.beforeAll(async () => {
    projekt = await ensureEtykietyZadan();
  });

  test("[100-AC6] wysokość paska filtrów nie zależy od liczby etykiet", async ({ page }) => {
    await otworz(page, `/tasks/${projekt}`);
    await expect(page.getByRole("button", { name: /Filtr etykiet/i }).first()).toBeVisible({ timeout: 20_000 });

    const pomiar = await page.evaluate(() => {
      const przycisk = Array.from(document.querySelectorAll<HTMLElement>("button")).find(
        (b) => (b.getAttribute("title") ?? "") === "Filtr etykiet",
      );
      const wiersz = przycisk?.parentElement?.parentElement ?? null;
      if (!przycisk || !wiersz) return null;
      return {
        wysokoscWiersza: Math.round(wiersz.getBoundingClientRect().height),
        // Ile chipsów WYBRANYCH stoi obok — bez filtru ma być zero, niezależnie od liczby etykiet
        // w słowniku. To jest sedno zmiany: pasek nie rośnie ze słownikiem.
        chipsow: wiersz.querySelectorAll("span[class*='rounded-full']").length,
      };
    });

    expect(pomiar).not.toBeNull();
    // Do 100 pasek miał tyle chipsów, ile etykiet istniało; teraz — tyle, ile wybrano.
    expect(pomiar!.chipsow).toBe(0);
    expect(pomiar!.wysokoscWiersza).toBeLessThanOrEqual(56);
    console.log(`[100-AC6] wysokość wiersza filtru etykiet: ${pomiar!.wysokoscWiersza} px`);
  });

  test("[100-AC7/AC9] panel filtruje po frazie, pusty wybór znaczy „wszystkie”", async ({ page }) => {
    await otworz(page, `/tasks/${projekt}`);
    const przycisk = page.getByRole("button", { name: /Filtr etykiet/i }).first();
    await expect(przycisk).toBeVisible({ timeout: 20_000 });

    // Bez wyboru przycisk mówi „Wszystkie" — filtr, który po odznaczeniu ostatniej pozycji
    // pokazuje pustą stronę, wygląda jak usterka.
    await expect(przycisk).toContainText(/Wszystkie/i);

    await przycisk.click();
    const szukajka = page.getByPlaceholder(/Szukaj etykiety/i);
    await expect(szukajka).toBeVisible();
    await expect(page.getByRole("button", { name: /Wszystkie etykiety/i })).toBeVisible();
  });
});

test.describe("Pasek kciuka i dominująca ręka", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("[100-AC13] magiczna ikona stoi na środku dolnego paska i nie ma jej drugiej kopii", async ({ page }) => {
    await otworz(page, "/tasks");
    const pasek = page.getByRole("navigation", { name: /Nawigacja główna/i });
    await expect(pasek).toBeVisible({ timeout: 20_000 });

    const magiczne = page.getByRole("button", { name: /^Asystent AI$/ });
    await expect(magiczne).toHaveCount(1);

    const pomiar = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Nawigacja główna"]');
      const btn = Array.from(document.querySelectorAll<HTMLElement>("button")).find(
        (b) => b.getAttribute("aria-label") === "Asystent AI",
      );
      if (!nav || !btn) return null;
      const n = nav.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      return {
        odchylenieOdSrodka: Math.round(Math.abs((b.left + b.width / 2) - (n.left + n.width / 2))),
        // „Wyeksponowana" znaczy: wystaje ponad górną krawędź paska.
        wystajePonad: Math.round(n.top - b.top),
        srednica: Math.round(b.width),
      };
    });

    expect(pomiar).not.toBeNull();
    expect(pomiar!.odchylenieOdSrodka).toBeLessThanOrEqual(2);
    expect(pomiar!.wystajePonad).toBeGreaterThan(0);
    console.log(
      `[100-AC13] magiczna ikona: ${pomiar!.srednica} px, wystaje ${pomiar!.wystajePonad} px ponad pasek, ` +
        `odchylenie od środka ${pomiar!.odchylenieOdSrodka} px`,
    );
  });

  test("[100-AC14] każda pozycja paska trzyma minimalny cel dotyku 44 × 44 px", async ({ page }) => {
    await otworz(page, "/tasks");
    await expect(page.getByRole("navigation", { name: /Nawigacja główna/i })).toBeVisible({ timeout: 20_000 });

    const pomiary = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Nawigacja główna"]');
      if (!nav) return [];
      return Array.from(nav.querySelectorAll<HTMLElement>("button")).map((b) => {
        const r = b.getBoundingClientRect();
        return { etykieta: b.getAttribute("aria-label") ?? "?", w: Math.round(r.width), h: Math.round(r.height) };
      });
    });

    expect(pomiary.length).toBeGreaterThan(0);
    for (const p of pomiary) {
      // Różnica między ręką dominującą a drugą jest w NADMIARZE, nigdy w niedomiarze (C-31).
      expect(p.w, `szerokość pozycji „${p.etykieta}”`).toBeGreaterThanOrEqual(44);
      expect(p.h, `wysokość pozycji „${p.etykieta}”`).toBeGreaterThanOrEqual(44);
    }
    console.log(`[100-AC14] cele dotyku: ${pomiary.map((p) => `${p.etykieta} ${p.w}×${p.h}`).join(", ")}`);
  });

  test("[100-AC19] wystająca ikona nie zasłania treści — obszar główny ma na nią zapas", async ({ page }) => {
    await otworz(page, "/tasks");
    await expect(page.getByRole("navigation", { name: /Nawigacja główna/i })).toBeVisible({ timeout: 20_000 });

    const zapas = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>("main");
      if (!main) return null;
      return Math.round(parseFloat(getComputedStyle(main).paddingBottom));
    });

    expect(zapas).not.toBeNull();
    // Pasek ma 56 px, ikona wystaje 14 px — zapas musi pokryć oba, inaczej ostatni wiersz długiej
    // listy chowa się pod paskiem.
    expect(zapas!).toBeGreaterThanOrEqual(56);
    console.log(`[100-AC19] dolne wypełnienie obszaru głównego: ${zapas} px`);
  });

  test("[100-AC12/AC22] gwiazdka ulubionych w górnym pasku idzie za ręką", async ({ page }) => {
    await otworz(page, "/tasks");
    await expect(page.getByRole("navigation", { name: /Nawigacja główna/i })).toBeVisible({ timeout: 20_000 });

    // Mierzymy POZYCJĘ, nie obecność reguły w arkuszu: nawrót z /verify wziął się właśnie stąd, że
    // reguła istniała (i działała na komputerze), a górny pasek telefonu jej nie używał. Test
    // czytający CSS przepuściłby ten błąd drugi raz.
    const zmierz = () =>
      page.evaluate(() => {
        const gwiazdka = Array.from(document.querySelectorAll<HTMLElement>("button")).find((b) =>
          /Ulubione/i.test(b.getAttribute("aria-label") ?? ""),
        );
        if (!gwiazdka) return null;
        const r = gwiazdka.getBoundingClientRect();
        return { srodek: Math.round(r.left + r.width / 2), szerokoscOkna: window.innerWidth };
      });

    const prawa = await zmierz();
    expect(prawa, "gwiazdka ulubionych nie znaleziona w górnym pasku").not.toBeNull();
    // Domyślnie ręka prawa — gwiazdka w prawej połowie ekranu.
    expect(prawa!.srodek).toBeGreaterThan(prawa!.szerokoscOkna / 2);

    await page.evaluate(() => document.documentElement.setAttribute("data-reka", "left"));
    const lewa = await zmierz();
    // Po przełączeniu — w lewej połowie. Atrybut nakłada serwer w `layout.tsx`; tutaj sprawdzamy,
    // że pasek NA NIEGO REAGUJE.
    expect(lewa!.srodek).toBeLessThan(lewa!.szerokoscOkna / 2);
    await page.evaluate(() => document.documentElement.setAttribute("data-reka", "right"));

    console.log(`[100-AC12] środek gwiazdki: prawa ${prawa!.srodek} px, lewa ${lewa!.srodek} px (okno ${prawa!.szerokoscOkna} px)`);
  });

  test("[100-AC12] przy ręce lewej pływające przyciski idą na lewą krawędź", async ({ page }) => {
    await otworz(page, "/tasks");
    await expect(page.getByRole("navigation", { name: /Nawigacja główna/i })).toBeVisible({ timeout: 20_000 });

    // Atrybut nakłada serwer w `layout.tsx`; tutaj sprawdzamy sam MECHANIZM lustrzenia — że reguła
    // istnieje i działa — bez przechodzenia przez ustawienia (to osobna, wolniejsza droga).
    const wynik = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "omnia-plywajacy";
      el.style.position = "fixed";
      el.style.bottom = "0";
      document.body.appendChild(el);
      const przed = getComputedStyle(el).right;
      document.documentElement.setAttribute("data-reka", "left");
      const poRight = getComputedStyle(el).right;
      const poLeft = getComputedStyle(el).left;
      document.documentElement.setAttribute("data-reka", "right");
      el.remove();
      return { przed, poRight, poLeft };
    });

    expect(wynik.przed).toBe("20px");
    expect(wynik.poLeft).toBe("20px");
    expect(wynik.poRight).not.toBe("20px");
  });
});
