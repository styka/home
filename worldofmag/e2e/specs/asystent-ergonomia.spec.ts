import { test, expect, type Page } from "../fixtures/test";
import { prisma } from "../fixtures/db";
import { E2E_ADMIN } from "../fixtures/users";

/**
 * 106 — ERGONOMIA ASYSTENTA AI: chrom, sesje i tryb dokowania.
 *
 * Cztery zgłoszenia właściciela o RAMĘ asystenta, nie o to, co asystent potrafi:
 * ciasno w górnym pasku (ikona plusa nachodząca na znacznik „auto"), przycięte menu jakości na
 * komputerze, rozmowy ginące w historii, oraz asystent w obszarze treści zamiast w oknie.
 *
 * 098: NIE `networkidle` — od 072 aplikacja trzyma otwarty strumień zdarzeń, więc sieć nigdy nie
 * jest bezczynna i takie oczekiwanie może skończyć się wyłącznie limitem czasu.
 */

const ASYSTENT = '[data-omnia-overlay="assistant"]';

/**
 * Wejście do asystenta zależy od szerokości — i to jest ustalenie przebiegu 100, nie usterka:
 * pływający przycisk istnieje dopiero od `md:`, a na telefonie Sparkles siedzi na środku PASKA
 * KCIUKA („ta jedna ikona, której nigdy nie wolno szukać"). Test musi więc pytać o oba wejścia,
 * inaczej mierzyłby dostępność przycisku zamiast tego, co deklaruje.
 */
async function otworzAsystenta(page: Page, sciezka = "/") {
  await page.goto(sciezka);
  await page.waitForLoadState("load").catch(() => {});
  const plywajacy = page.getByRole("button", { name: "Otwórz asystenta AI" });
  const wPaskuKciuka = page.getByRole("button", { name: "Asystent AI", exact: true });
  if (await plywajacy.first().isVisible().catch(() => false)) {
    await plywajacy.first().click();
  } else {
    await wPaskuKciuka.first().click();
  }
  await expect(page.locator(ASYSTENT)).toBeVisible({ timeout: 15_000 });
}

/**
 * Ustawia tryb prezentacji W BAZIE, przed otwarciem strony.
 *
 * Kusi, żeby zrobić to klikaniem — i to jest pułapka, w którą ten test wpadł: preferencje asystenta
 * dojeżdżają z serwera ASYNCHRONICZNIE po otwarciu okna, więc kliknięcie „wróć do okna" trafia
 * w stan początkowy, a chwilę później wczytane preferencje przestawiają wszystko z powrotem.
 * Objawia się to zniknięciem przycisku między asercją a kliknięciem — czyli czymś, co wygląda na
 * usterkę produktu, a jest wyścigiem w teście. Zapis wprost do bazy usuwa wyścig u źródła.
 */
async function ustawTrybWBazie(tryb: "window" | "content") {
  const user = await prisma.user.findUnique({ where: { email: E2E_ADMIN.email }, select: { id: true } });
  if (!user) throw new Error("brak konta testowego — seed nie wykonał się");
  await prisma.assistantPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, presentation: tryb },
    update: { presentation: tryb },
  });
}

/** Prostokąty wszystkich przycisków górnego paska asystenta. */
async function prostokatyPaska(page: Page) {
  return page.evaluate((sel) => {
    const okno = document.querySelector(sel);
    const pasek = okno?.querySelector("div > div"); // pierwszy wiersz panelu = nagłówek
    if (!pasek) return null;
    const naglowek = pasek.closest("div")?.parentElement?.querySelector(".flex.items-center.justify-between");
    const cel = naglowek ?? pasek;
    const przyciski = Array.from(cel.querySelectorAll("button")).map((b) => {
      const r = b.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, label: b.getAttribute("aria-label") ?? "" };
    });
    const r = cel.getBoundingClientRect();
    return { przyciski, scrollWidth: cel.scrollWidth, clientWidth: cel.clientWidth, szerokosc: r.width };
  }, ASYSTENT);
}

test.describe("106 — ergonomia asystenta", () => {
  /**
   * Tryb prezentacji i lista zapisanych rozmów to stan KONTA, a wszystkie testy w tym pliku
   * logują się jako to samo konto. Równolegle działające testy przestawiałyby sobie nawzajem tę
   * samą preferencję w połowie asercji — i to nie jest usterka produktu, tylko konsekwencja
   * trwałości, której wprost wymaga AC-17. Dlatego blok idzie szeregowo.
   */
  test.describe.configure({ mode: "serial" });

  test("[106-AC1] przy 360 px przyciski paska nie nachodzą na siebie i mają cel 44 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await otworzAsystenta(page);

    const dane = await prostokatyPaska(page);
    expect(dane, "nagłówek asystenta musi istnieć").not.toBeNull();
    const przyciski = dane!.przyciski.filter((b) => b.w > 0 && b.h > 0);
    expect(przyciski.length, "pasek ma mieć przyciski").toBeGreaterThanOrEqual(4);

    // Cel dotyku (C-31). Sprawdzamy TYLKO przyciski nagłówka — `iconBtn` w wierszach list zostaje
    // mniejszy świadomie, bo tam cel mierzy się całym wierszem.
    for (const b of przyciski) {
      expect(b.w, `szerokość celu: ${b.label}`).toBeGreaterThanOrEqual(43.5);
      expect(b.h, `wysokość celu: ${b.label}`).toBeGreaterThanOrEqual(43.5);
    }

    // Sedno zgłoszenia: żadne dwa prostokąty się nie przecinają.
    for (let i = 0; i < przyciski.length; i++) {
      for (let j = i + 1; j < przyciski.length; j++) {
        const a = przyciski[i];
        const b = przyciski[j];
        const przecina = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(przecina, `„${a.label}" nachodzi na „${b.label}"`).toBe(false);
      }
    }

    // Pasek mieści się w szerokości — nic nie ucieka poza ekran.
    expect(dane!.scrollWidth).toBeLessThanOrEqual(dane!.clientWidth + 1);
  });

  test("[106-AC3, AC-4] akcje drugiego planu są pod „Więcej”, a Esc zamyka tylko menu", async ({ page }) => {
    await otworzAsystenta(page);

    // AC-3: ustawienia i zgłoszenie problemu NIE stoją już w pasku…
    const pasek = page.locator(ASYSTENT).locator("button");
    await expect(pasek.filter({ hasText: "" }).and(page.getByRole("button", { name: "Ustawienia asystenta" }))).toHaveCount(0);

    // …tylko pod „Więcej".
    await page.getByRole("button", { name: "Więcej akcji asystenta" }).click();
    const menu = page.getByRole("menu", { name: "Więcej akcji asystenta" });
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await expect(menu.getByRole("menuitem", { name: /Ustawienia asystenta/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Zgłoś problem|problem z asystentem/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Zapisz rozmowę/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Usuń rozmowę/i })).toBeVisible();

    // AC-4: Esc zamyka MENU, a rozmowa zostaje otwarta.
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden({ timeout: 10_000 });
    await expect(page.locator(ASYSTENT)).toBeVisible();
  });

  test("[106-AC5, AC-6] menu poziomu pracy mieści się w oknie, także niskim", async ({ page }) => {
    for (const rozmiar of [{ width: 1280, height: 800 }, { width: 1280, height: 600 }]) {
      await page.setViewportSize(rozmiar);
      await otworzAsystenta(page);

      await page.getByRole("button", { name: /Poziom pracy asystenta/i }).click();
      const menu = page.getByRole("menu", { name: /Poziom pracy asystenta/i });
      await expect(menu).toBeVisible({ timeout: 10_000 });

      const r = await menu.boundingBox();
      expect(r, "menu poziomu musi mieć prostokąt").not.toBeNull();
      // Sedno zgłoszenia: górna krawędź NIE jest ucięta ekranem.
      expect(r!.y, `górna krawędź przy ${rozmiar.height} px`).toBeGreaterThanOrEqual(-0.5);
      expect(r!.y + r!.height, `dolna krawędź przy ${rozmiar.height} px`).toBeLessThanOrEqual(rozmiar.height + 0.5);

      // Wszystkie cztery poziomy są osiągalne (przewijanie WEWNĄTRZ panelu jest dozwolone).
      await expect(menu.getByRole("menuitemradio")).toHaveCount(4);
      await page.keyboard.press("Escape");
    }
  });

  test("[106-AC9, AC-11] historia ma dwie listy z licznikami, a pusta „Zapisane” wyjaśnia się sama", async ({ page }) => {
    await otworzAsystenta(page);
    await page.getByRole("button", { name: /Historia rozmów/i }).click();

    const przelacznik = page.getByRole("tablist", { name: /Listy rozmów/i });
    await expect(przelacznik).toBeVisible({ timeout: 10_000 });
    const segmenty = przelacznik.getByRole("tab");
    await expect(segmenty).toHaveCount(2);

    // Segment „Zapisane" jest KLIKALNY nawet przy zerze — w pustej liście stoi jedyne wyjaśnienie,
    // jak coś na nią trafia, a potrzebuje go dokładnie ten, kto niczego nie zapisał.
    const zapisane = segmenty.filter({ hasText: /Zapisane/i });
    await expect(zapisane).toBeEnabled();
    await zapisane.click();
    await expect(page.getByText(/Zapisz rozmowę z menu/i)).toBeVisible({ timeout: 10_000 });
  });

  test("[106-AC14, AC-15, AC-19, AC-20] tryb treści: adres bez zmian, przewinięcie modułu zachowane", async ({ page }) => {
    await ustawTrybWBazie("window");
    await page.setViewportSize({ width: 1440, height: 900 });
    await otworzAsystenta(page, "/tasks/all");

    const przelacznikTrybu = page.getByRole("button", { name: /Pokaż asystenta w obszarze treści/i });
    await expect(przelacznikTrybu, "przełącznik trybu jest widoczny bez otwierania menu (AC-19)").toBeVisible({ timeout: 10_000 });

    // Przewiń treść modułu i zapamiętaj pozycję.
    const przedPrzewinieciem = await page.evaluate(() => {
      const main = document.querySelector("main");
      const rama = main?.querySelector<HTMLElement>("[data-omnia-scroll], .overflow-y-auto");
      if (rama) rama.scrollTop = 250;
      return { adres: location.href, scroll: rama?.scrollTop ?? -1, maRame: Boolean(rama) };
    });

    await przelacznikTrybu.click();

    // Poczekaj, aż tryb NAPRAWDĘ się przełączy: sprawdzenie adresu przechodzi natychmiast (adres ma
    // się nie zmienić), więc bez tego mierzylibyśmy geometrię sprzed przemalowania.
    await expect(page.getByRole("button", { name: /Pokaż asystenta w oknie/i })).toBeVisible({ timeout: 10_000 });

    // AC-14: adres się NIE zmienia.
    await expect.poll(() => page.evaluate(() => location.href), { timeout: 10_000 }).toBe(przedPrzewinieciem.adres);

    // AC-14: panel przykrywa obszar treści, a nie całe okno (nawigacja zostaje widoczna).
    const geometria = await page.evaluate((sel) => {
      const okno = document.querySelector(sel);
      const main = document.querySelector("main");
      if (!okno || !main) return null;
      const o = okno.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      return {
        lewaOkna: o.x, szerokoscOkna: o.width, szerokoscEkranu: window.innerWidth,
        lewaTresci: m.x, szerokoscTresci: m.width,
        inert: main.hasAttribute("inert"), ariaHidden: main.getAttribute("aria-hidden"),
      };
    }, ASYSTENT);
    expect(geometria).not.toBeNull();
    expect(geometria!.szerokoscOkna, "panel nie zajmuje całej szerokości ekranu").toBeLessThan(geometria!.szerokoscEkranu - 50);
    expect(Math.abs(geometria!.lewaOkna - geometria!.lewaTresci), "panel pokrywa się z obszarem treści").toBeLessThan(2);

    // AC-20: przykryta treść jest odcięta od fokusu i czytnika ekranu.
    expect(geometria!.inert, "<main> ma atrybut inert").toBe(true);
    expect(geometria!.ariaHidden, "<main> ma aria-hidden").toBe("true");

    // AC-15: wyjście z trybu — moduł wraca w tym samym stanie (treść była przykryta, nie porzucona).
    await page.getByRole("button", { name: /Pokaż asystenta w oknie/i }).click();
    const po = await page.evaluate(() => {
      const main = document.querySelector("main");
      const rama = main?.querySelector<HTMLElement>("[data-omnia-scroll], .overflow-y-auto");
      return { scroll: rama?.scrollTop ?? -1, inert: main?.hasAttribute("inert") ?? true, adres: location.href };
    });
    expect(po.inert, "po wyjściu treść znów jest dostępna").toBe(false);
    expect(po.adres).toBe(przedPrzewinieciem.adres);
    if (przedPrzewinieciem.maRame && przedPrzewinieciem.scroll > 0) {
      expect(po.scroll, "pozycja przewijania modułu przeżyła tryb treści").toBe(przedPrzewinieciem.scroll);
    }
  });

  test("[106-AC8, AC-10, AC-12] zapisanie rozmowy jest trwałe, odwracalne, a usunięcie pyta", async ({ page }) => {
    await otworzAsystenta(page);
    await page.getByRole("button", { name: /Historia rozmów/i }).click();

    const przelacznik = page.getByRole("tablist", { name: /Listy rozmów/i });
    await expect(przelacznik).toBeVisible({ timeout: 10_000 });
    const historiaTab = przelacznik.getByRole("tab").filter({ hasText: /Historia/i });
    // Licznik w segmencie to jedyny sygnał, że lista DOSZŁA z serwera — `count()` na przyciskach
    // nie czeka i policzony od razu po kliknięciu daje zero, zanim cokolwiek się wyrenderuje.
    await expect
      .poll(async () => Number((await historiaTab.textContent())?.match(/\d+/)?.[0] ?? 0), { timeout: 15_000 })
      .toBeGreaterThan(0);

    const dodaj = page.getByRole("button", { name: "Dodaj do zapisanych" }).first();
    await expect(dodaj).toBeVisible({ timeout: 10_000 });

    // AC-8: rozmowa wędruje na listę „Zapisane"…
    await dodaj.click();
    const zapisaneTab = przelacznik.getByRole("tab").filter({ hasText: /Zapisane/i });
    await expect.poll(async () => (await zapisaneTab.textContent())?.match(/\d+/)?.[0], { timeout: 10_000 }).not.toBe("0");

    // …i zostaje tam po przeładowaniu strony (nośnikiem jest konto, nie pamięć przeglądarki).
    await otworzAsystenta(page);
    await page.getByRole("button", { name: /Historia rozmów/i }).click();
    await expect(przelacznik).toBeVisible({ timeout: 10_000 });
    await zapisaneTab.click();
    const odznacz = page.getByRole("button", { name: "Usuń z zapisanych" }).first();
    await expect(odznacz).toBeVisible({ timeout: 10_000 });

    // AC-12: usunięcie pyta SKÓRKOWANYM oknem (C-34), a anulowanie zostawia rozmowę.
    await page.getByRole("button", { name: "Usuń rozmowę" }).first().click();
    const potwierdzenie = page.getByRole("dialog").filter({ hasText: /Usunąć tę rozmowę/i });
    await expect(potwierdzenie).toBeVisible({ timeout: 10_000 });
    await potwierdzenie.getByRole("button", { name: /Anuluj/i }).click();
    await expect(odznacz).toBeVisible();

    // AC-10: odwracalność — rozmowa wraca do historii i NIE znika z aplikacji.
    await odznacz.click();
    await expect.poll(async () => (await zapisaneTab.textContent())?.match(/\d+/)?.[0], { timeout: 10_000 }).toBe("0");
    await expect.poll(async () => (await historiaTab.textContent())?.match(/\d+/)?.[0], { timeout: 10_000 }).not.toBe("0");
  });

  test("[106-AC14b] w trybie treści nic z modułu nie przebija nad asystenta", async ({ page }) => {
    await ustawTrybWBazie("content");
    await page.setViewportSize({ width: 1440, height: 900 });
    await otworzAsystenta(page, "/tasks/all");
    await expect(page.getByRole("button", { name: /Pokaż asystenta w oknie/i })).toBeVisible({ timeout: 10_000 });

    /**
     * Sedno: panel asystenta jest RODZEŃSTWEM `<main>`, a nie jego przodkiem, więc o kolejności
     * malowania decydują z-indeksy w tym samym kontekście. Pasek widoku modułu (`ModuleView`) ma
     * `zIndex: 40` i siedzi wewnątrz `<main>` — bez odizolowania kontekstu `<main>` maluje się
     * NAD asystentem, mimo że asystent go „przykrywa".
     *
     * Sprawdzamy to jedyną miarą, która mówi prawdę o warstwach: co naprawdę jest na wierzchu
     * w danym punkcie ekranu.
     */
    const wynik = await page.evaluate((sel) => {
      const panel = document.querySelector(sel) as HTMLElement | null;
      const main = document.querySelector("main");
      if (!panel || !main) return null;
      const r = panel.getBoundingClientRect();
      const punkty: { x: number; y: number }[] = [
        { x: r.x + r.width / 2, y: r.y + 12 },   // pas, w którym stoi pasek widoku modułu
        { x: r.x + r.width / 2, y: r.y + 40 },
        { x: r.x + r.width / 2, y: r.y + r.height / 2 },
      ];
      return punkty.map(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return { wPanelu: Boolean(el && panel.contains(el)), wTresci: Boolean(el && main.contains(el)) };
      });
    }, ASYSTENT);

    expect(wynik).not.toBeNull();
    for (const [i, p] of wynik!.entries()) {
      expect(p.wTresci, `punkt ${i}: nad asystentem jest element z przykrytej treści`).toBe(false);
      expect(p.wPanelu, `punkt ${i}: na wierzchu powinien być asystent`).toBe(true);
    }
  });

  test("[106-AC18] na telefonie tryb treści nie obowiązuje — asystent zostaje arkuszem", async ({ page }) => {
    // Najpierw włącz tryb treści na szerokim ekranie (preferencja siada na koncie)…
    await ustawTrybWBazie("content");
    await page.setViewportSize({ width: 1440, height: 900 });
    await otworzAsystenta(page);
    await expect(page.getByRole("button", { name: /Pokaż asystenta w oknie/i })).toBeVisible({ timeout: 10_000 });

    // …a potem zejdź na telefon: ma być arkusz na całą szerokość, nie kolumna obok nawigacji.
    await page.setViewportSize({ width: 360, height: 780 });
    await otworzAsystenta(page);
    const szerokosci = await page.evaluate((sel) => {
      const okno = document.querySelector(sel);
      const main = document.querySelector("main");
      return okno && main
        ? { panel: okno.getBoundingClientRect().width, ekran: window.innerWidth, inert: main.hasAttribute("inert") }
        : null;
    }, ASYSTENT);
    expect(szerokosci).not.toBeNull();
    expect(szerokosci!.panel, "na telefonie asystent jest arkuszem na całą szerokość").toBeGreaterThanOrEqual(szerokosci!.ekran - 2);
    expect(szerokosci!.inert, "na telefonie treść NIE jest odcinana").toBe(false);
  });
});
