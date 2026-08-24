import { test, expect } from "../fixtures/test";
import { kliknijGwiazdkeUlubionych } from "../pages/chromWidoku";

/**
 * 043 — stan widoku w adresie strony (faza A: Zadania, Zakupy, Notatki).
 * Odpowiada kryteriom AC-4..AC-8 ze `specs/043-nawigacja-widoki-asystent/spec.md`.
 *
 * Projekt `desktop` (Chromium) — `mobile` używa WebKita, którego w sandboxie nie ma.
 *
 * `mode: "serial"`, bo konfiguracja repo ma `fullyParallel`, a testy dzielą jedno konto
 * administratora i sprzątają ulubione (ta sama pułapka co w `favorites.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

/** Sprząta ulubione przez interfejs ustawień, żeby test nie zależał od kolejności. */
async function clearFavorites(page: import("@playwright/test").Page) {
  // 084: patrz `shortcuts.spec.ts` — gwiazdka bieżącego widoku ma być wykluczona, inaczej pętla
  // przełącza ją w kółko zamiast kasować wpisy listy.
  const sel = 'button[aria-label^="Usu"][aria-label$="z ulubionych"]:not([aria-label*="to miejsce"])';
  for (let i = 0; i < 40; i++) {
    await page.goto("/settings");
    // 098: NIE `networkidle` — od 072 aplikacja trzyma otwarty strumien zdarzen (`/api/events`),
    // wiec sieć nigdy nie jest bezczynna i to oczekiwanie konczylo sie limitem czasu testu.
    await page.waitForLoadState("load").catch(() => {});
    const n = await page.getByRole("main").locator(sel).count();
    if (n === 0) return;
    await page.getByRole("main").locator(sel).first().click();
    await expect(page.getByRole("main").locator(sel)).toHaveCount(n - 1, { timeout: 15_000 });
  }
  throw new Error("Nie udalo sie wyczyscic ulubionych w 40 iteracjach");
}

test.describe("043 — stan widoku w adresie", () => {
  test("[vs-AC5] zmiana układu i grupowania w Zadaniach trafia do adresu", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("load").catch(() => {});

    // Wejście bez parametrów NIE dokłada niczego do adresu (AC-8).
    expect(new URL(page.url()).search).toBe("");

    await page.getByRole("button", { name: "Kanban", exact: true }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get("layout")).toBe("kanban");
  });

  test("[vs-AC6] przycisk wstecz wraca do poprzedniego stanu widoku", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("load").catch(() => {});

    await page.getByRole("button", { name: "Kanban", exact: true }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get("layout")).toBe("kanban");

    await page.getByRole("button", { name: "Timeline", exact: true }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get("layout")).toBe("timeline");

    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.get("layout")).toBe("kanban");

    await page.goBack();
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });

  test("[vs-AC5b] adres z parametrami otwiera się w tym samym stanie", async ({ page }) => {
    // Kluczowe dla AC-5: adres skopiowany z paska ma dawać ten sam widok po ponownym otwarciu.
    await page.goto("/tasks/all?layout=kanban");
    await page.waitForLoadState("load").catch(() => {});

    // Parametr NIE może zostać zgubiony przy starcie widoku (to był sedno zgłoszenia:
    // zapisany widok wracał bez ustawień).
    expect(new URL(page.url()).searchParams.get("layout")).toBe("kanban");
    // I widok faktycznie startuje w Kanbanie — przełącznik jest podświetlony kolorem akcentu.
    const kanban = page.getByRole("button", { name: "Kanban", exact: true }).first();
    await expect(kanban).toHaveCSS("color", /rgb/, { timeout: 10_000 });
  });

  test("[vs-AC8] wejście bez parametrów nie zmienia zachowania modułów", async ({ page }) => {
    for (const path of ["/tasks/all", "/notes/all"]) {
      await page.goto(path);
      await page.waitForLoadState("load").catch(() => {});
      // Brak parametrów w adresie = widok domyślny, dokładnie jak przed 043.
      expect(new URL(page.url()).search, `${path} nie powinno dokładać parametrów`).toBe("");
    }
  });

  test("[vs-AC7] Notatki: tryb widoku trafia do adresu i wraca", async ({ page }) => {
    await page.goto("/notes/all");
    await page.waitForLoadState("load").catch(() => {});

    // Przełącznik listy/siatki (jedyny przycisk zmieniający tryb prezentacji notatek).
    const toggle = page.getByTitle(/Widok siatki/i).first();
    await toggle.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("grid");

    // Ponowne otwarcie tego adresu daje ten sam tryb.
    await page.goto("/notes/all?view=grid");
    await page.waitForLoadState("load").catch(() => {});
    expect(new URL(page.url()).searchParams.get("view")).toBe("grid");
  });


  /**
   * AC-7 dla Zakupów. `/verify` słusznie wytknął, że spec wymienia Zakupy z nazwy, a testy
   * pokrywały tylko Notatki — kod był wpięty w ten sam mechanizm, ale to nie to samo co sprawdzony.
   */
  test("[vs-AC7-zakupy] Zakupy: zakładka filtra i sortowanie w adresie", async ({ page }) => {
    // `domcontentloaded`, NIE `networkidle`: powłoka odświeża dane w tle (`DataFreshness` co 45 s),
    // więc sieć w Omnii bywa „nigdy cicha" i czekanie na nią zjadało cały limit czasu testu.
    // Linki do list są renderowane serwerowo, więc są w dokumencie już na tym etapie.
    await page.goto("/shopping", { waitUntil: "domcontentloaded" });

    // Bierzemy ISTNIEJĄCĄ listę zamiast tworzyć nową: formularz „Nowa lista" jest w tym środowisku
    // niestabilny (te same kroki wywracają `shopping.spec.ts`), a ten test ma sprawdzać stan widoku,
    // nie zakładanie list. Bez żadnej listy nie ma czego weryfikować — wtedy pomijamy z powodem.
    const listLinks = page.locator('a[href^="/shopping/"]');
    const paths: string[] = [];
    for (const href of await listLinks.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""))) {
      const path = href.split("?")[0];
      if (/^\/shopping\/[A-Za-z0-9_-]{20,}$/.test(path)) paths.push(path);
    }
    test.skip(paths.length === 0, "Brak listy zakupowej w bazie testowej — nie ma czego weryfikować");
    const listPath = paths[0];

    // AC-8: wejście na listę bez parametrów nie dokłada niczego do adresu.
    await page.goto(listPath, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).search).toBe("");

    // AC-7: zmiana zakładki filtra trafia do adresu. Klikamy zakładkę zamiast wciskać cyfrę —
    // klik w przycisk Reacta wymusza czekanie na hydratację, a skrót klawiszowy poszedłby
    // w próżnię, gdyby nasłuchiwacz powłoki nie był jeszcze podpięty.
    // `FILTER_TABS` to stała (`ALL`, `NEEDED`, …), a zakładki mają w `title` swój numer.
    // Klik ponawiany w `poll`, bo `domcontentloaded` nie gwarantuje HYDRATACJI — Playwright czeka
    // na widoczność i klikalność przycisku, ale nie na to, aż React podepnie do niego handler.
    // Pierwszy klik potrafi więc trafić w martwy jeszcze element.
    await expect
      .poll(async () => {
        await page.getByTitle(/\(2\)/).first().click().catch(() => {});
        return new URL(page.url()).searchParams.get("filter");
      }, { timeout: 20_000 })
      .toBe("NEEDED");

    // …i wraca po ponownym otwarciu tego samego adresu, razem z sortowaniem.
    await page.goto(`${listPath}?filter=DONE&sort=product`, { waitUntil: "domcontentloaded" });
    await expect.poll(() => new URL(page.url()).searchParams.get("filter"), { timeout: 10_000 }).toBe("DONE");
    expect(new URL(page.url()).searchParams.get("sort")).toBe("product");
  });

  test("[vs-AC4] ulubiony zapisany z filtrami wraca z filtrami", async ({ page }) => {
    await clearFavorites(page);

    await page.goto("/tasks/all?layout=kanban");
    await page.waitForLoadState("load").catch(() => {});

    // 098: gwiazdka „zapisz widok" jest w DWÓCH miejscach naraz — w pasku widoku (`main`)
    // i w sekcji ulubionych w nawigacji. Bez zawężenia Playwright zgłasza naruszenie trybu
    // ścisłego, bo trafia w dwa elementy. Klikamy tę z paska widoku — to ona jest przedmiotem testu.
    await kliknijGwiazdkeUlubionych(page, /Zapisz to miejsce w ulubionych/i);
    await page.getByPlaceholder("Nazwa widoku…").fill("Kanban wszystkich");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    // 098: ta sama dwoistość co przy zapisie — gwiazdka „usuń z ulubionych" jest i w pasku widoku,
    // i w nawigacji. Sprawdzamy tę z paska widoku.
    await page.getByRole("main").getByRole("button", { name: /Usuń to miejsce z ulubionych/i }).waitFor({ timeout: 15_000 });

    // Wyjście gdzie indziej i powrót przez ulubione — adres musi nieść komplet ustawień.
    await page.goto("/notes/all");
    await page.waitForLoadState("load").catch(() => {});
    // 080 (Z8): sekcja ulubionych startuje zwinięta — rozwijamy ją, tak jak zrobiłby użytkownik.
    const naglowekUlubionych = page.getByRole("button", { name: /rozwiń ulubione/i }).first();
    if (await naglowekUlubionych.count() > 0 && await naglowekUlubionych.isVisible().catch(() => false)) {
      await naglowekUlubionych.click();
    }
    await page.getByRole("link", { name: "Kanban wszystkich" }).first().click();

    await expect.poll(() => new URL(page.url()).searchParams.get("layout"), { timeout: 15_000 }).toBe("kanban");

    await clearFavorites(page);
  });
});
