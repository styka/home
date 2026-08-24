import { test, expect } from "../fixtures/test";
import { gwiazdkaUlubionych } from "../pages/chromWidoku";

/**
 * 085 (AC-1..AC-5, AC-8..AC-11) — CHROM KONTA I PRZYKLEJONY PASEK WIDOKU.
 *
 * Dwa zgłoszenia właściciela naraz: „gwiazdka lepiej by było mieć na górze przy ikonach górnego
 * paska strony" oraz „czy to dobrze, że scrolując stronę w dół te akcje nie przyklejają się?".
 * Trzecie — „ten przycisk pokazujący koszty ma ukrywać wszystkie dodatki dla admina".
 */

const STAR_SAVE = /Zapisz to miejsce w ulubionych/i;
const STAR_REMOVE = /Usuń to miejsce z ulubionych/i;

async function otworz(page: import("@playwright/test").Page, sciezka: string) {
  await page.goto(sciezka);
  await page.waitForLoadState("load").catch(() => {});
}

test.describe("085 — chrom konta", () => {
  test("[085-AC2] w treści strony NIE MA już wejścia do zapisu widoku", async ({ page }) => {
    await otworz(page, "/pogoda");
    // Gwiazdka istnieje (w chromie konta), ale nie w `main` — to jest cała treść zgłoszenia
    // „gwiazdka zabiera przestrzeń na pasek zakładek".
    await expect(page.getByRole("main").getByRole("button", { name: STAR_SAVE })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("button", { name: STAR_REMOVE })).toHaveCount(0);
    await expect(gwiazdkaUlubionych(page, /(Zapisz|Usuń) to miejsce/i)).toBeVisible({ timeout: 15_000 });
  });

  test("[085-AC1] gwiazdka stoi obok dzwonka — na telefonie i na komputerze", async ({ page }) => {
    // MOBILE: pasek górny (md:hidden) + brak panelu bocznego.
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/pogoda");
    await page.waitForLoadState("load").catch(() => {});
    const mobil = await page.evaluate(() => {
      const widoczne = (el: Element | null) => !!el && el.getClientRects().length > 0;
      const gwiazdka = Array.from(document.querySelectorAll("button")).find((b) =>
        /(Zapisz|Usuń) to miejsce/i.test(b.getAttribute("aria-label") ?? ""),
      );
      const dzwonek = Array.from(document.querySelectorAll("button")).find((b) =>
        /Powiadomienia/i.test(b.getAttribute("aria-label") ?? ""),
      );
      const skroty = Array.from(document.querySelectorAll("button")).find((b) =>
        /skrót/i.test(b.getAttribute("aria-label") ?? ""),
      );
      return {
        gwiazdkaWidoczna: widoczne(gwiazdka ?? null),
        dzwonekWidoczny: widoczne(dzwonek ?? null),
        // Odległość gwiazdki od dzwonka w poziomie — „obok" znaczy w tym samym rzędzie.
        wTymSamymRzedzie:
          gwiazdka && dzwonek
            ? Math.abs(gwiazdka.getBoundingClientRect().top - dzwonek.getBoundingClientRect().top) < 8
            : false,
        skrotyWidoczne: widoczne(skroty ?? null),
      };
    });
    console.log(`WERYFIKACJA mobile: ${JSON.stringify(mobil)}`);
    expect(mobil.gwiazdkaWidoczna).toBe(true);
    expect(mobil.wTymSamymRzedzie).toBe(true);
    expect(mobil.skrotyWidoczne, "ściągawka skrótów NIE ma się pokazywać na telefonie").toBe(false);

    // DESKTOP: rząd chromu w stopce panelu bocznego, wszystkie cztery ikony w jednej linii.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/pogoda");
    await page.waitForLoadState("load").catch(() => {});
    const desktop = await page.evaluate(() => {
      // WIDOCZNE, nie „obecne w drzewie": mobilny pasek górny nadal istnieje w DOM (`md:hidden`
      // = display:none), więc bez tego filtra mierzylibyśmy jego elementy, które mają geometrię 0.
      const znajdz = (re: RegExp) =>
        Array.from(document.querySelectorAll("button")).find(
          (b) => re.test(b.getAttribute("aria-label") ?? "") && b.getClientRects().length > 0,
        );
      const el = {
        dzwonek: znajdz(/Powiadomienia/i),
        gwiazdka: znajdz(/(Zapisz|Usuń) to miejsce/i),
        skroty: znajdz(/skrót/i),
        tryb: znajdz(/tryb administratora/i),
      };
      const y = (b?: HTMLElement) => (b ? Math.round(b.getBoundingClientRect().top) : null);
      return { dzwonek: y(el.dzwonek), gwiazdka: y(el.gwiazdka), skroty: y(el.skroty), tryb: y(el.tryb) };
    });
    console.log(`WERYFIKACJA desktop: ${JSON.stringify(desktop)}`);
    expect(desktop.dzwonek).not.toBeNull();
    for (const k of ["gwiazdka", "skroty", "tryb"] as const) {
      expect(desktop[k], `${k} musi istnieć`).not.toBeNull();
      expect(Math.abs(desktop[k]! - desktop.dzwonek!), `${k} w jednym rzędzie z dzwonkiem`).toBeLessThan(8);
    }
  });

  test("[085-AC6] w pasku widoku nie ma wskaźnika świeżości ani menu chromu", async ({ page }) => {
    await otworz(page, "/pogoda");
    // Wskaźnik świeżości mierzył moment przeładowania strony przez powłokę, nie świeżość danych
    // modułu — i dlatego zniknął, a nie schował się głębiej.
    await expect(page.locator('[aria-label^="Dane odświeżono"]')).toHaveCount(0);
    await expect(page.getByRole("main").locator('[aria-haspopup="menu"]')).toHaveCount(0);
  });

  test("[085-AC3] zapis widoku działa też na trasie bez ramy modułu", async ({ page }) => {
    await otworz(page, "/admin");
    await expect(gwiazdkaUlubionych(page, /(Zapisz|Usuń) to miejsce/i)).toBeVisible({ timeout: 15_000 });
  });

  test("[085-AC4] pasek widoku zostaje widoczny po przewinięciu treści", async ({ page }) => {
    /**
     * Treść musi być DŁUŻSZA od okna, inaczej test przechodzi, nic nie sprawdzając. W tym
     * środowisku odświeżanie kanałów RSS nie działa (sieć), więc tematy są puste — a od 085 puste
     * tematy są domyślnie ukryte, czyli strona jest krótka. Włączamy więc ich pokazywanie
     * PRZEZ INTERFEJS (przy okazji dowód dla AC-15), przewijamy i przywracamy stan: konto jest
     * współdzielone przez wszystkie specyfikacje, więc zostawienie zmienionego ustawienia byłoby
     * pułapką dla następnego testu.
     */
    await otworz(page, "/wiadomosci");
    const ustawienia = page.getByRole("tab", { name: "Ustawienia", exact: true });
    await expect(ustawienia).toBeVisible({ timeout: 20_000 });
    await ustawienia.click();
    const przelacznik = page.getByRole("checkbox", { name: /Pokazuj tematy bez nowych wiadomości/i });
    await expect(przelacznik).toBeVisible({ timeout: 10_000 });
    const bylWlaczony = await przelacznik.isChecked();
    if (!bylWlaczony) await przelacznik.check();

    const zakladka = page.getByRole("tab", { name: "Tematy", exact: true });
    await zakladka.click();
    await expect(zakladka).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);

    const wynik = await page.evaluate(() => {
      const rama = Array.from(document.querySelectorAll<HTMLElement>("main *")).find((el) => {
        const s = getComputedStyle(el);
        return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 200;
      });
      if (!rama) return { przewinieto: 0, maRame: false };
      rama.scrollTop = 600;
      return { przewinieto: rama.scrollTop, maRame: true };
    });
    expect(wynik.maRame, "widok musi mieć co przewijać").toBe(true);
    expect(wynik.przewinieto).toBeGreaterThan(300);

    // Sedno testu: po przewinięciu zakładka NADAL jest w polu widzenia. Przed 085 wyjeżdżała
    // razem z treścią (zmierzone przed zmianą: treść 11563 px przy oknie 800 px, zakładki poza ekranem).
    await expect(zakladka).toBeInViewport({ timeout: 5_000 });

    if (!bylWlaczony) {
      await ustawienia.click();
      await przelacznik.uncheck();
    }
  });

  test("[085-AC5] przyklejony pasek nie rozpycha strony przy 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await otworz(page, "/wiadomosci");
    await page.waitForTimeout(1200);

    const rozpychacze = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        const s = getComputedStyle(el);
        if (s.overflowX === "auto" || s.overflowX === "scroll") return;
        if (s.textOverflow === "ellipsis") return;
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
          out.push(`${el.tagName.toLowerCase()} (${el.scrollWidth}>${el.clientWidth})`);
        }
      });
      return out;
    });
    expect(rozpychacze, `elementy szersze od swojego pola: ${rozpychacze.join(", ")}`).toEqual([]);

    // I nie DWA nagłówki strony — przebudowa ramy rozdzieliła blok nagłówka od paska, więc to jest
    // dokładnie ta klasa błędu, którą trzeba wykluczyć. Zero jest poprawne: w wariancie gęstym tytuł
    // chowa się poniżej `md`, żeby zakładki dostały całą szerokość.
    expect(await page.getByRole("main").getByRole("heading", { level: 1 }).count()).toBeLessThanOrEqual(1);
  });
});

test.describe("085 — tryb administratora", () => {
  test("[085-AC9] przełącznik jest widoczny i opisany jako tryb administratora", async ({ page }) => {
    await otworz(page, "/");
    await expect(page.getByRole("button", { name: /tryb administratora/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("[085-AC8] wyłączony tryb ukrywa narzędzia administratora, włączony je przywraca", async ({ page }) => {
    await otworz(page, "/");
    const zglos = page.getByRole("button", { name: /Tryb zgłaszania/i });

    // Stan wyjściowy to WYŁĄCZONY — o taki prosi zgłoszenie („admin widzi strony jak użytkownik").
    await expect(zglos).toHaveCount(0);
    // Wejście do panelu administracyjnego zostaje mimo wyłączonego trybu (AC-9) — bez niego nie
    // dałoby się wrócić.
    await expect(page.getByRole("link", { name: "Admin", exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: /włącz tryb administratora/i }).first().click();
    await expect(zglos.first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /wyłącz tryb administratora/i }).first().click();
    await expect(zglos).toHaveCount(0, { timeout: 10_000 });
  });
});

/**
 * 085 (AC-11) — konto BEZ uprawnień administratora niczego z tej warstwy nie widzi.
 *
 * Osobny blok, bo wymaga innej tożsamości. To jest kontrola, że rozszerzenie przełącznika nie
 * przeciekło poza administratora: nie-administrator nie ma nawet skąd wiedzieć, że taki tryb istnieje.
 */
test.describe("085 — tryb administratora dla konta bez uprawnień", () => {
  test.use({ storageState: "e2e/.auth/limited.json" });

  test("[085-AC11] nie-administrator nie widzi przełącznika ani narzędzi", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load").catch(() => {});
    await expect(page.getByRole("button", { name: /tryb administratora/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Tryb zgłaszania/i })).toHaveCount(0);
  });
});
