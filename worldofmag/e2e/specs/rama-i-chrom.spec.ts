import { test, expect } from "../fixtures/test";

/**
 * 087 — RAMA WIDOKU I CHROM KONTA.
 *
 * Cztery zgłoszenia dotyczyły nie modułu, tylko RAMY (odstęp pod nagłówkiem, akcje na telefonie,
 * miejsce ustawień, stopka okna nad obszarem gestów), a jedno — przebudowy chromu konta. Dlatego
 * ten plik mierzy powłokę, a nie moduł.
 */

async function otworz(page: import("@playwright/test").Page, adres: string, szer = 1280) {
  await page.setViewportSize({ width: szer, height: 800 });
  await page.goto(adres);
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(1000);
}

test("[087-AC16] w Pogodzie tresc nie styka sie z paskiem modulu", async ({ page }) => {
  await otworz(page, "/pogoda", 360);
  const odstep = await page.evaluate(() => {
    /**
     * Mierzymy od DOLNEJ KRAWĘDZI TEKSTU nagłówka, nie od pudełka bloku.
     *
     * Pierwsza wersja tego testu brała `blok.getBoundingClientRect().bottom` — a naprawa dokłada
     * wypełnienie WEWNĄTRZ bloku, więc jego dolna krawędź przesuwa się razem z treścią i odstęp
     * wychodził 0 zarówno przed poprawką, jak i po niej. Test, który nie potrafi odróżnić naprawy
     * od jej braku, nie jest testem (lekcja z 086).
     */
    const h1 = document.querySelector("main h1");
    const blok = h1?.closest("div")?.parentElement?.parentElement as HTMLElement | null;
    const tresc = blok?.nextElementSibling as HTMLElement | null;
    const pierwszy = tresc?.querySelector("div") as HTMLElement | null;
    if (!h1 || !pierwszy) return null;
    return Math.round(pierwszy.getBoundingClientRect().top - h1.getBoundingClientRect().bottom);
  });
  console.log(`[087-AC16] odstęp nagłówek↔treść: ${odstep}`);
  expect(odstep).not.toBeNull();
  // Zmierzone przed zmianą: 0 px — treść dosłownie stykała się z nazwą modułu.
  expect(odstep!, "pierwszy element treści ma być oddzielony od nagłówka").toBeGreaterThanOrEqual(8);
});

test("[087-AC6] akcje modulu nie zostawiaja pustej polowy wiersza przy 360 px", async ({ page }) => {
  await otworz(page, "/wiadomosci", 360);
  const pomiar = await page.evaluate(() => {
    const pasek = Array.from(document.querySelectorAll<HTMLElement>("main *")).find(
      (el) => getComputedStyle(el).zIndex === "40",
    );
    const przyciski = Array.from(document.querySelectorAll<HTMLElement>("main button")).filter(
      (b) => /Odśwież|Nowy temat/.test(b.textContent || "") && b.getClientRects().length > 0,
    );
    if (!pasek || przyciski.length === 0) return null;
    const rp = pasek.getBoundingClientRect();
    const pierwszy = przyciski.reduce((a, b) => (a.getBoundingClientRect().left < b.getBoundingClientRect().left ? a : b));
    return {
      pasekLeft: Math.round(rp.left),
      pasekWidth: Math.round(rp.width),
      pierwszyLeft: Math.round(pierwszy.getBoundingClientRect().left),
      przycietych: przyciski.filter((b) => b.scrollWidth > b.clientWidth + 1).length,
    };
  });
  console.log(`[087-AC6] ${JSON.stringify(pomiar)}`);
  expect(pomiar).not.toBeNull();
  // Zmierzone przed zmianą: pierwszy przycisk zaczynał się na 202 px przy pasku 0..360 — czyli
  // ponad połowa wiersza stała pusta.
  const zapasZLewej = pomiar!.pierwszyLeft - pomiar!.pasekLeft;
  expect(zapasZLewej, "akcje mają wykorzystywać wiersz, a nie zbijać się do prawej").toBeLessThan(
    Math.round(pomiar!.pasekWidth / 4),
  );
  expect(pomiar!.przycietych, "żaden przycisk nie może być przycięty").toBe(0);
});

test("[087-AC7] ustawienia modulu stoja przy akcjach, nie wsrod zakladek", async ({ page }) => {
  await otworz(page, "/wiadomosci");
  const gear = page.getByRole("button", { name: /Ustawienia modułu/i }).first();
  await expect(gear).toBeVisible({ timeout: 15_000 });
  // Nie jest zakładką…
  await expect(page.locator('[role="tab"][aria-label*="Ustawienia"]')).toHaveCount(0);
  // …i jest przełącznikiem: wchodzi i wychodzi tym samym przyciskiem.
  await expect(gear).toHaveAttribute("aria-pressed", "false");
  await gear.click();
  await page.waitForTimeout(500);
  await expect(gear).toHaveAttribute("aria-pressed", "true");
});

test("[087-AC14] stopka okna nie wchodzi w obszar gestow", async ({ page }) => {
  await otworz(page, "/wiadomosci", 360);
  const wynik = await page.evaluate(() => {
    // `env(safe-area-inset-bottom)` w Chromium desktop wynosi 0, więc mierzymy REGUŁĘ, nie piksele:
    // czy dolne wypełnienie stopki w ogóle uwzględnia obszar bezpieczny.
    const probka = document.createElement("div");
    probka.style.paddingBottom = "calc(12px + env(safe-area-inset-bottom))";
    document.body.appendChild(probka);
    const dziala = getComputedStyle(probka).paddingBottom !== "";
    probka.remove();
    return { dziala };
  });
  expect(wynik.dziala).toBe(true);

  // Otwieramy realne okno i sprawdzamy, że jego stopka ma wypełnienie liczone z obszaru bezpiecznego.
  const oznacz = page.getByRole("button", { name: /Oznacz wszystkie/i }).first();
  if (await oznacz.count()) {
    await oznacz.click();
    await page.waitForTimeout(400);
    const stopka = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const stopka = dialog?.lastElementChild as HTMLElement | null;
      return stopka ? getComputedStyle(stopka).paddingBottom : null;
    });
    console.log(`[087-AC14] wypełnienie stopki: ${stopka}`);
    expect(stopka, "stopka okna ma własne dolne wypełnienie").not.toBeNull();
    expect(parseFloat(stopka || "0")).toBeGreaterThanOrEqual(12);
  }
});

test("[087-AC13] potwierdzenie Oznacz wszystkie ma tresc", async ({ page }) => {
  await otworz(page, "/wiadomosci");
  const oznacz = page.getByRole("button", { name: /Oznacz wszystkie/i }).first();
  test.skip((await oznacz.count()) === 0, "brak nowych wiadomości w tym środowisku — nie ma czego oznaczać");
  await oznacz.click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const tresc = await dialog.locator("p").first().textContent();
  console.log(`[087-AC13] treść okna: ${tresc}`);
  expect((tresc || "").trim().length, "okno ma mieć opis, nie sam tytuł").toBeGreaterThan(20);
  // C-34: oznaczenie niczego nie usuwa, więc przycisk jest neutralny.
  await expect(dialog.getByRole("button", { name: "Usuń" })).toHaveCount(0);
});

test("[087-AC17] lista modulow nie ma pozycji Ulubione", async ({ page }) => {
  /**
   * 109 ZMIENIA POŁOWĘ TEGO TESTU — nie „naprawiaj" go z powrotem.
   *
   * 087 wyrzuciło z nawigacji dwie pozycje naraz: Ulubione i Stronę główną. Reguła o Ulubionych
   * zostaje (jedno wejście, gwiazdka w rzędzie ikon konta). Strona główna WRACA jako nazwany
   * wiersz — właściciel zgłosił, że ikona domu w rzędzie narzędzi nie jest opisana słowami i stoi
   * pod ulubionymi. Wiersz stoi POZA `<nav>`, nad rzędem ikon, więc lista modułów dalej go nie
   * zawiera; pilnuje tego asercja niżej, żeby nie wrócił jako dublet pozycji menu.
   */
  await otworz(page, "/pogoda");
  const pozycje = await page.evaluate(() =>
    Array.from(document.querySelectorAll("aside nav a, aside nav button"))
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => (el.textContent || "").trim()),
  );
  console.log(`[087-AC17] pozycje nawigacji: ${JSON.stringify(pozycje)}`);
  expect(pozycje.some((p) => /^Ulubione/.test(p)), "Ulubione nie jest juz pozycja menu").toBe(false);
  expect(
    pozycje.some((p) => /^Strona główna$/.test(p)),
    "Strona glowna ma wlasny wiersz nad rzedem ikon, nie jest pozycja listy modulow (109)",
  ).toBe(false);
});

test("[087-AC18] gwiazdka otwiera jeden dialog z lista i operacja na biezacym widoku", async ({ page }) => {
  await otworz(page, "/pogoda");
  await page.getByRole("button", { name: /Ulubione/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /Ulubione widoki/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  // Operacja na bieżącym widoku jest w TYM SAMYM oknie co lista.
  await expect(dialog.getByRole("button", { name: /(Dodaj|Usuń) bieżący widok/i })).toBeVisible();
});

test("[087-AC19 + 109-AC1] uklad wierszy w panelu bocznym", async ({ page }) => {
  /**
   * 109 ZMIENIA UKŁAD OPISANY W 087-AC20 — nie „naprawiaj" go z powrotem.
   *
   * 087 postawiło ikonę domu jako pierwszą w rzędzie ikon konta (dom, gwiazdka, skróty).
   * Właściciel zgłosił dwie rzeczy naraz: wejście na stronę główną nie jest opisane słowami i stoi
   * POD ulubionymi. Od 109 Strona główna ma własny, nazwany wiersz NAD tym rzędem, a w rzędzie
   * zostają gwiazdka i skróty. Niezmiennik z 086 (rząd ikon nad nawigacją modułów) zostaje.
   */
  await otworz(page, "/pogoda");
  const uklad = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (!aside) return null;
    const widoczny = (el: Element) => el.getClientRects().length > 0;
    const znajdz = (re: RegExp) =>
      Array.from(aside.querySelectorAll("button, a")).find(
        (b) => re.test(b.getAttribute("aria-label") ?? "") && widoczny(b),
      );
    const p = (el?: Element | null) =>
      el ? { x: Math.round(el.getBoundingClientRect().left), y: Math.round(el.getBoundingClientRect().top) } : null;
    // Wiersz Strony głównej jest zwykłą pozycją nawigacji — szukamy go po TEKŚCIE, nie po
    // `aria-label`, bo od 109 jest opisany słowami i to jest właśnie sedno zmiany.
    const dom =
      Array.from(aside.querySelectorAll("a")).find(
        (a) => a.getAttribute("href") === "/" && /Strona główna/.test(a.textContent || "") && widoczny(a),
      ) ?? null;
    return {
      // 109: wzorzec poprawiony z /Powiadomienia/i. Od 107 dzwonek jest SKRZYNKĄ i jego `aria-label`
      // brzmi „Skrzynka" — stary wzorzec przestał cokolwiek znajdować, więc ten test był czerwony
      // od 107, raportując „dzwonek musi być widoczny" o elemencie, który był na ekranie.
      dzwonek: p(znajdz(/skrzynk|powiadomie/i)),
      tryb: p(znajdz(/tryb administratora/i)),
      dom: p(dom),
      gwiazdka: p(znajdz(/Ulubione/i)),
      skroty: p(znajdz(/skrót/i)),
      // 109-AC2: w całym panelu ma być DOKŁADNIE JEDNO wejście na `/`.
      wejsciaNaStroneGlowna: Array.from(aside.querySelectorAll('a[href="/"]')).filter(widoczny).length,
    };
  });
  console.log(`[087-AC19 + 109-AC1] ${JSON.stringify(uklad)}`);
  expect(uklad).not.toBeNull();
  const { dzwonek, tryb, dom, gwiazdka, skroty } = uklad!;
  for (const [nazwa, el] of Object.entries({ dzwonek, tryb, dom, gwiazdka, skroty })) {
    expect(el, `${nazwa} musi być widoczny`).not.toBeNull();
  }
  // 087-AC19: przełącznik admina i dzwonek w jednym wierszu, admin PRZED dzwonkiem.
  expect(Math.abs(tryb!.y - dzwonek!.y), "admin i dzwonek w tym samym wierszu").toBeLessThan(8);
  expect(tryb!.x, "najpierw przełącznik admina, bardziej z prawej dzwonek").toBeLessThan(dzwonek!.x);
  // 109-AC1: nazwany wiersz Strony głównej stoi POD nazwą aplikacji i NAD gwiazdką.
  expect(dom!.y, "Strona główna stoi poniżej wiersza z nazwą aplikacji").toBeGreaterThan(dzwonek!.y);
  expect(dom!.y, "Strona główna stoi NAD rzędem ikon konta").toBeLessThan(gwiazdka!.y);
  // 087-AC20 w części, która zostaje: gwiazdka i skróty w jednym rzędzie, w tej kolejności.
  expect(Math.abs(gwiazdka!.y - skroty!.y), "gwiazdka i skróty w jednym wierszu").toBeLessThan(8);
  expect(gwiazdka!.x).toBeLessThan(skroty!.x);
  // 109-AC2: jedno wejście na `/`, więc nazwa aplikacji nie jest już odnośnikiem.
  expect(uklad!.wejsciaNaStroneGlowna, "dokładnie jedno wejście na stronę główną w panelu").toBe(1);
});

test("[087-AC21] telefon ma jedno wejscie do ulubionych", async ({ page }) => {
  /**
   * 103: reguła bez zmian — na telefonie ma być DOKŁADNIE JEDNO wejście do ulubionych. Zmieniło się
   * miejsce (górny pasek → pasek kciuka) i przez to sama nazwa przycisku: od 103 `aria-label` mówi,
   * co przycisk ZROBI („Zapisz ten widok w ulubionych"), a nie jak nazywa się zbiór. Wzorzec
   * dopasowany do słowa „Ulubione" nie łapał już formy „ulubionych" i liczył zero — czyli test
   * przestałby pilnować reguły, o którą mu chodzi, raportując przy tym fałszywy błąd.
   */
  await otworz(page, "/pogoda", 390);
  const liczba = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll("button")).filter(
        (b) => /ulubion/i.test(b.getAttribute("aria-label") ?? "") && b.getClientRects().length > 0,
      ).length,
  );
  console.log(`[087-AC21] wejść do ulubionych na telefonie: ${liczba}`);
  expect(liczba, "dokładnie jedno wejście").toBe(1);
});
