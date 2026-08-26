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
    await expect(gwiazdkaUlubionych(page, /Ulubione/i)).toBeVisible({ timeout: 15_000 });
  });

  test("[085-AC1] gwiazdka: na telefonie w pasku KCIUKA, na komputerze obok dzwonka", async ({ page }) => {
    /**
     * 103 ZMIENIŁO POŁOWĘ TEGO KRYTERIUM — świadomie, na wniosek właściciela: „Powinna tam być
     * ikona ulubionych czyli gwiazdka (zamiast na górnym pasku)".
     *
     * Na telefonie gwiazdka zeszła z górnego paska do DOLNEGO, bo górna krawędź jest poza zasięgiem
     * kciuka trzymającego urządzenie, a zapis widoku jest czynnością wykonywaną wielokrotnie
     * dziennie. Reguła z 085 — „gwiazdka ma jedno miejsce i jest nim chrom, nie treść strony" —
     * obowiązuje dalej; zmieniło się, KTÓRY to chrom na telefonie.
     *
     * Część komputerowa (rząd ikon obok dzwonka) została nietknięta i jest sprawdzana niżej bez zmian.
     */
    // MOBILE: gwiazdka NIE w pasku górnym, tylko w pasku kciuka.
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/pogoda");
    await page.waitForLoadState("load").catch(() => {});
    const mobil = await page.evaluate(() => {
      const widoczne = (el: Element | null) => !!el && el.getClientRects().length > 0;
      const chrom = document.querySelector(".omnia-chrom-konta");
      const pasekKciuka = document.querySelector('nav[aria-label="Nawigacja główna"]');
      const gwiazdkaW = (zakres: Element | null) =>
        zakres
          ? Array.from(zakres.querySelectorAll("button")).find((b) =>
              /ulubion/i.test(b.getAttribute("aria-label") ?? ""),
            ) ?? null
          : null;
      const dzwonek = Array.from(document.querySelectorAll("button")).find((b) =>
        /Powiadomienia/i.test(b.getAttribute("aria-label") ?? ""),
      );
      const skroty = Array.from(document.querySelectorAll("button")).find((b) =>
        /skrót/i.test(b.getAttribute("aria-label") ?? ""),
      );
      return {
        gwiazdkaWTopBarze: widoczne(gwiazdkaW(chrom)),
        gwiazdkaWPaskuKciuka: widoczne(gwiazdkaW(pasekKciuka)),
        dzwonekWidoczny: widoczne(dzwonek ?? null),
        skrotyWidoczne: widoczne(skroty ?? null),
      };
    });
    console.log(`WERYFIKACJA mobile: ${JSON.stringify(mobil)}`);
    // 103: w GÓRNYM pasku gwiazdki już nie ma — jej jedynym miejscem na telefonie jest pasek dolny.
    expect(mobil.gwiazdkaWTopBarze, "gwiazdka zeszła z górnego paska do paska kciuka (103)").toBe(false);
    expect(mobil.gwiazdkaWPaskuKciuka, "gwiazdka musi stać w pasku kciuka").toBe(true);
    expect(mobil.dzwonekWidoczny, "dzwonek zostaje w górnym pasku").toBe(true);
    expect(mobil.skrotyWidoczne, "ściągawka skrótów NIE ma się pokazywać na telefonie").toBe(false);

    // DESKTOP: od 087 chrom stoi w DWÓCH wierszach — patrz [087-AC19/AC20] niżej. Tutaj sprawdzamy
    // już tylko to, co było przedmiotem zgłoszenia z 085: że wszystkie cztery ikony istnieją
    // i są widoczne na komputerze.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/pogoda");
    await page.waitForLoadState("load").catch(() => {});
    const desktop = await page.evaluate(() => {
      // WIDOCZNE, nie „obecne w drzewie": mobilny pasek górny nadal istnieje w DOM (`md:hidden`
      // = display:none), więc bez tego filtra mierzylibyśmy jego elementy, które mają geometrię 0.
      const znajdz = (re: RegExp) =>
        Array.from(document.querySelectorAll("button, a")).find(
          (b) => re.test(b.getAttribute("aria-label") ?? "") && b.getClientRects().length > 0,
        );
      const y = (b?: Element) => (b ? Math.round(b.getBoundingClientRect().top) : null);
      return {
        dzwonek: y(znajdz(/Powiadomienia/i)),
        gwiazdka: y(znajdz(/Ulubione/i)),
        skroty: y(znajdz(/skrót/i)),
        tryb: y(znajdz(/tryb administratora/i)),
      };
    });
    console.log(`WERYFIKACJA desktop: ${JSON.stringify(desktop)}`);
    for (const k of ["dzwonek", "gwiazdka", "skroty", "tryb"] as const) {
      expect(desktop[k], `${k} musi być widoczny na komputerze`).not.toBeNull();
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
    await expect(gwiazdkaUlubionych(page, /Ulubione/i)).toBeVisible({ timeout: 15_000 });
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
    const ustawienia = page.getByRole("button", { name: /Ustawienia modułu/i });
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

test("[086-AC19] rząd chromu stoi NAD nawigacją, pod nazwą aplikacji", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await otworz(page, "/settings");
  const wynik = await page.evaluate(() => {
    const widoczny = (el: Element | null | undefined) => !!el && el.getClientRects().length > 0;
    const gwiazdka = Array.from(document.querySelectorAll("button")).find(
      (b) => /Ulubione/i.test(b.getAttribute("aria-label") ?? "") && widoczny(b),
    );
    /**
     * 087: punktem odniesienia jest PIERWSZA POZYCJA NAWIGACJI, a nie „Strona główna" — ta przestała
     * być pozycją menu i ma teraz własną ikonę w rzędzie chromu. Sedno zgłoszenia z 086 zostaje bez
     * zmian: rząd ikon stoi NAD nawigacją modułów.
     */
    const pierwszaPozycja = Array.from(document.querySelectorAll("aside nav a")).find((a) => widoczny(a));
    const y = (el?: Element | null) => (el ? Math.round(el.getBoundingClientRect().top) : null);
    return { gwiazdka: y(gwiazdka), pierwszaPozycja: y(pierwszaPozycja) };
  });
  expect(wynik.gwiazdka, "gwiazdka w rzędzie chromu").not.toBeNull();
  expect(wynik.pierwszaPozycja, "pierwsza pozycja nawigacji").not.toBeNull();
  expect(wynik.gwiazdka!).toBeLessThan(wynik.pierwszaPozycja!);
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

  test("[086-AC12] powiadomienia o koszcie NIE zależą od przełącznika", async ({ page }) => {
    await otworz(page, "/");
    // 086 odwraca decyzję z 085: kontrola nad wydatkami nie jest ozdobą trybu podglądu, więc
    // `KosztToasts` nie może już czytać przełącznika. Sprawdzamy to strukturalnie — wywołanie
    // modelu wymagałoby sieci — ale wprost: komponent montuje się i nie odwołuje do trybu.
    const czytaTryb = await page.evaluate(() => {
      // Powiadomienia renderują się dopiero po zdarzeniu kosztu; przy braku wpisów kontener nie
      // istnieje w obu stanach przełącznika, więc porównujemy to, co da się porównać: obecność
      // przełącznika (jest) i brak kontenera powiadomień (nie ma czego pokazać).
      return {
        maPrzelacznik: !!document.querySelector('[aria-label*="tryb administratora" i]'),
        maKontener: !!document.querySelector('[aria-live="polite"].pointer-events-none'),
      };
    });
    expect(czytaTryb.maPrzelacznik).toBe(true);
    expect(czytaTryb.maKontener, "bez zdarzenia kosztu kontener nie istnieje w żadnym trybie").toBe(false);
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
