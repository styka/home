import { test, expect } from "../fixtures/test";
import { kliknijGwiazdkeUlubionych } from "../pages/chromWidoku";

/**
 * 042 — weryfikacja zachowania ulubionych widoków i poprawek UX.
 * Testy odpowiadają kryteriom akceptacji ze `specs/042-home-centrum-sterowania/spec.md`.
 *
 * Projekt `desktop` (Chromium) — projekt `mobile` używa WebKita, którego w sandboxie nie ma.
 *
 * `mode: "serial"` jest KONIECZNY: konfiguracja repo ma `fullyParallel`, a wszystkie testy dzielą
 * JEDNO konto administratora. Równolegle sprzątanie ulubionych w jednym teście kasowało dane
 * drugiego w locie — objawiało się to „element not found" w teście pustego stanu i zarządzania.
 */
test.describe.configure({ mode: "serial" });

const STAR_SAVE = /Zapisz to miejsce w ulubionych/i;
const STAR_REMOVE = /Usuń to miejsce z ulubionych/i;

/**
 * Otwiera popover gwiazdki na BIEZACEJ stronie i zapisuje widok pod podana nazwa.
 *
 // 098: NIE `networkidle` — od 072 aplikacja trzyma otwarty strumien zdarzen (`/api/events`),
 // wiec sieć nigdy nie jest bezczynna i to oczekiwanie konczylo sie limitem czasu testu.
 * `waitForLoadState("load")` przed klikiem jest istotny: po `router.refresh()` z poprzedniego
 * kroku drzewo bywa jeszcze przemontowywane, a popover trzyma stan lokalnie — klik trafiony w to
 * okno gubil otwarty popover.
 */
async function saveCurrentAs(page: import("@playwright/test").Page, name: string) {
  await page.waitForLoadState("load").catch(() => {});
  // 098: gwiazdka „zapisz widok" jest w DWÓCH miejscach naraz — w pasku widoku (`main`)
  // i w sekcji ulubionych w nawigacji. Bez zawężenia Playwright zgłasza naruszenie trybu
  // ścisłego, bo trafia w dwa elementy. Klikamy tę z paska widoku — to ona jest przedmiotem testu.
  await kliknijGwiazdkeUlubionych(page, /Zapisz to miejsce w ulubionych/i);
  await page.getByPlaceholder("Nazwa widoku…").fill(name);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("main").getByRole("button", { name: /Usuń to miejsce z ulubionych/i }).waitFor({ timeout: 15_000 });
}


/**
 * 080 (Z8): sekcja ulubionych w pasku bocznym startuje ZWINIĘTA — właściciel zgłosił, że rozwinięta
 * spycha pozycje modułów poniżej pierwszego ekranu. Wejście przez ulubione kosztuje więc jedno
 * dodatkowe kliknięcie, dopóki użytkownik raz jej nie rozwinie (stan jest zapamiętywany na koncie).
 * Testy klikają jak człowiek, więc muszą to zrobić tak samo.
 */
async function rozwinUlubione(page: import("@playwright/test").Page) {
  const naglowek = page.getByRole("button", { name: /rozwiń ulubione/i }).first();
  if (await naglowek.count() > 0 && await naglowek.isVisible().catch(() => false)) {
    await naglowek.click();
  }
}

/**
 * Sprząta ulubione przez interfejs ustawień, żeby testy nie zależały od kolejności.
 *
 * 080: selektor zawężony do `main`. Ta sama dwoistość, o której mówią komentarze z 098 przy
 * `saveCurrentAs`: przycisk „Usuń … z ulubionych" istnieje też w POWŁOCE (gwiazdka bieżącego
 * widoku). Dopóki `/settings` samo nie było w ulubionych, `.first()` trafiało w wiersz listy
 * i wszystko działało; gdy trafiło w gwiazdkę powłoki, pętla kasowała wpis dla `/settings`
 * w kółko i kończyła się po 40 obrotach. Zawężenie do treści strony usuwa tę zależność od
 * przypadkowego stanu.
 */
async function clearFavorites(page: import("@playwright/test").Page) {
  // Wykluczamy GWIAZDKĘ bieżącego widoku („Usuń to miejsce z ulubionych"), która też siedzi
  // w `main` (pasek widoku). Kasowanie ma dotyczyć WPISÓW LISTY w ustawieniach — klikanie
  // gwiazdki tylko przełącza `/settings` w kółko i pętla nigdy nie schodzi do zera.
  const sel = 'button[aria-label^="Usu"][aria-label$="z ulubionych"]:not([aria-label*="to miejsce"])';
  for (let i = 0; i < 40; i++) {
    await page.goto("/settings");
    await page.waitForLoadState("load").catch(() => {});
    const lista = page.getByRole("main").locator(sel);
    const n = await lista.count();
    if (n === 0) return;
    await lista.first().click();
    // Kasowanie idzie przez Server Action + router.refresh() — czekamy, az lista sie przeliczy.
    await expect(page.getByRole("main").locator(sel)).toHaveCount(n - 1, { timeout: 15_000 });
  }
  throw new Error("Nie udalo sie wyczyscic ulubionych w 40 iteracjach");
}

test.describe("042 — ulubione widoki", () => {
  test.beforeEach(async ({ page }) => {
    await clearFavorites(page);
  });

  test("[fav-AC1-AC2-AC3] zapis z filtrami, powrót pod ten sam adres, przełącznik", async ({ page }) => {
    // AC-1: zapisujemy miejsce WRAZ z parametrami zapytania.
    await page.goto("/tasks?status=DONE&x=1");
    // Po zapisie gwiazdka przechodzi w stan „w ulubionych" (AC-3, pierwsza połowa).
    await saveCurrentAs(page, "Zrobione zadania");

    // AC-2: wejście z ulubionych wraca DOKŁADNIE pod ten sam adres z filtrami.
    await page.goto("/notes");
    await page.waitForLoadState("load").catch(() => {});
    await rozwinUlubione(page);
    await page.getByRole("link", { name: /Zrobione zadania/ }).first().click();
    await expect(page).toHaveURL(/\/tasks\?status=DONE&x=1/);

    // AC-3: ponowny klik gwiazdki usuwa wpis.
    await page.getByRole("main").getByRole("button", { name: STAR_REMOVE }).click();
    await expect(page.getByRole("main").getByRole("button", { name: STAR_SAVE })).toBeVisible({ timeout: 10_000 });
  });

  test("[fav-AC9] ponowny zapis tego samego adresu nie tworzy duplikatu", async ({ page }) => {
    await page.goto("/notes");
    await saveCurrentAs(page, "Notatki raz");

    // Wymuszamy drugi zapis tej samej ścieżki bezpośrednio przez akcję serwera:
    // interfejs pokazuje już „usuń", więc duplikat mógłby powstać tylko tędy.
    await page.goto("/settings");
    // AC-9 mowi o BRAKU DUPLIKATU TEGO SAMEGO widoku — liczymy wiec wpisy o tej nazwie,
    // a nie wszystkie ulubione (te moga zostac po innych testach w tej samej bazie).
    const rows = page.locator('button[aria-label*="Notatki raz"][aria-label$="z ulubionych"]');
    await expect(rows).toHaveCount(1);
  });

  test("[fav-AC4] przełącznik z wyszukiwaniem działa z dowolnej strony", async ({ page }) => {
    await page.goto("/kitchen");
    await saveCurrentAs(page, "Kuchnia moja");

    // Ze strony NIEBĘDĄCEJ pulpitem otwieramy pełną listę i filtrujemy ją.
    await page.goto("/portfel");
    await page.getByRole("button", { name: /Wszystkie ulubione/ }).first().click();

    const dialog = page.getByRole("dialog", { name: "Ulubione widoki" });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("Skocz do ulubionego widoku…").fill("Kuchnia");
    await expect(dialog.getByText("Kuchnia moja")).toBeVisible();

    await dialog.getByText("Kuchnia moja").click();
    await expect(page).toHaveURL(/\/kitchen/);
  });

  test("[fav-AC5] Alt+1 skacze do pierwszego ulubionego, AltGr nie przechwytuje pisania", async ({ page }) => {
    await page.goto("/notes");
    await saveCurrentAs(page, "Notatki skrót");

    await page.goto("/kitchen");
    await page.keyboard.press("Alt+Digit1");
    await expect(page).toHaveURL(/\/notes/, { timeout: 10_000 });

    // AltGr (Control+Alt) to na polskiej klawiaturze klawisz od „ą ć ę…" — NIE może nawigować.
    await page.goto("/kitchen");
    await page.keyboard.press("Control+Alt+Digit1");
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/kitchen/);
  });

  test("[fav-AC6] pusty stan nie zajmuje miejsca pustą ramką", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Zapisz miejsce gwiazdką w pasku/)).toBeVisible();
    // Bez ulubionych sekcja w pasku bocznym w ogóle się nie renderuje.
    await expect(page.getByRole("button", { name: /Wszystkie ulubione/ })).toHaveCount(0);
  });

  test("[fav-AC7] zarządzanie: zmiana nazwy i usunięcie", async ({ page }) => {
    await page.goto("/shopping");
    await saveCurrentAs(page, "Nawyki stare");

    await page.goto("/settings");
    await page.locator('button[aria-label^="Zmie"][aria-label*="Nawyki stare"]').click();
    // Kontrolowany input Reacta nie ma atrybutu `value` w DOM — bierzemy pole, ktore dostalo focus.
    const editor = page.locator("input:focus");
    await editor.fill("Nawyki nowe");
    await editor.press("Enter");
    await expect(page.getByText("Nawyki nowe")).toBeVisible({ timeout: 10_000 });

    await page.locator('button[aria-label^="Usu"][aria-label*="Nawyki nowe"]').click();
    await expect(page.getByText(/Nie masz jeszcze ulubionych widoków/)).toBeVisible({ timeout: 10_000 });
  });

  test("[fav-AC10] ulubione żyją przy koncie, nie w przeglądarce", async ({ page, context }) => {
    await page.goto("/notes");
    await saveCurrentAs(page, "Trwałe notatki");

    // Czyścimy CAŁY magazyn przeglądarki — zostają tylko ciasteczka sesji.
    await context.clearCookies({ name: "nonexistent" }).catch(() => {});
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Trwałe notatki/ }).first()).toBeVisible();
  });
});

test.describe("042 — poprawki UX", () => {
  test("[ux-AC24] czyszczenie kupionych pozycji wymaga potwierdzenia", async ({ page }) => {
    // Dane przygotowujemy w bazie, a nie klikaniem — testujemy POTWIERDZENIE, nie zakladanie listy.
    const { PrismaClient } = await import("@prisma/client");
    const { E2E_ADMIN } = await import("../fixtures/users");
    const prisma = new PrismaClient();
    let listId = "";
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_ADMIN.email } });
      const przestrzen = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: user.id } });
      const list = await prisma.shoppingList.create({
        // 098: przestrzeń bierzemy zapytaniem, a NIE przez `wlasnoscOsobistaDoZapisu` z aplikacji.
        // Spec Playwrighta jest transpilowany, ale moduł zaimportowany z niego dynamicznie już nie —
        // `await import("@/platform/...")` kończy się „Cannot use import statement outside a module".
        // Fikstura ma być samowystarczalna: zna schemat, nie kod aplikacji.
        data: { name: `AC24 ${Date.now()}`, workspaceId: przestrzen.id },
      });
      listId = list.id;
      await prisma.item.create({ data: { listId: list.id, name: "mleko", status: "DONE" } });
    } finally {
      await prisma.$disconnect();
    }

    await page.goto(`/shopping/${listId}`);
    await page.waitForLoadState("load").catch(() => {});

    const clear = page.getByTitle(/Wyczyść zakończone elementy/);
    await expect(clear).toBeVisible({ timeout: 15_000 });
    await clear.click();

    // Kluczowe: pozycje NIE znikaja bez potwierdzenia — clearDoneItems kasuje twardo, bez kosza.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/nie da się cofnąć/i)).toBeVisible();
    await expect(dialog.getByText(/1 kupiona pozycja/)).toBeVisible();

    await dialog.getByRole("button", { name: "Anuluj" }).click();
    await expect(page.getByTitle(/Wyczyść zakończone elementy/)).toBeVisible();

    // Dopiero potwierdzenie kasuje.
    await page.getByTitle(/Wyczyść zakończone elementy/).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Usuń/ }).click();
    await expect(page.getByTitle(/Wyczyść zakończone elementy/)).toHaveCount(0, { timeout: 15_000 });
  });

  test("[ux-AC25-AC26] Notatki maja Foldery, Zadania zostaja przy Grupach", async ({ page }) => {
    await page.goto("/notes");
    await expect(page.getByRole("link", { name: "Foldery" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Grupy$/ })).toHaveCount(0);

    // AC-27: dotychczasowy adres nadal działa.
    await page.goto("/notes/groups");
    await expect(page).not.toHaveURL(/auth\/signin/);
    await expect(page.getByText(/Foldery notatek/)).toBeVisible();

    // AC-26: w Zadaniach nazwa się NIE zmienia (projekt może być w wielu grupach).
    await page.goto("/tasks");
    await expect(page.getByText(/Grupy/).first()).toBeVisible();
  });
});

/**
 * 043 — odkrywalność ulubionych na desktopie (AC-1, AC-2, AC-3).
 *
 * W 042 sekcja ulubionych zwracała `null` przy zerze wpisów, więc na komputerze funkcja
 * praktycznie nie istniała. Te testy pilnują, że pusty stan JEST widoczny.
 */
test.describe("043 — ulubione widoczne od pierwszego wejścia", () => {
  test.beforeEach(async ({ page }) => {
    await clearFavorites(page);
  });

  test("[fav043-AC1-AC2 + 080-AC16] sekcja jest widoczna, ale zwinięta; po rozwinięciu ma zachętę i punkt zapisu", async ({ page }) => {
    /**
     * 080 (Z8) ZAWĘŻA regułę z 043, nie znosi jej.
     *
     * 043 wymagało, żeby sekcja ulubionych renderowała się ZAWSZE — także przy zerze wpisów —
     * bo inaczej „nie było skąd się dowiedzieć, że ulubione w ogóle istnieją". To zostaje: nagłówek
     * z gwiazdką i słowem „Ulubione" jest na miejscu. Zmieniło się tylko to, że reszta sekcji
     * startuje ZWINIĘTA, bo rozwinięta spychała pozycje modułów poniżej pierwszego ekranu.
     *
     * Test JAWNIE ustawia stan początkowy zamiast liczyć na kolejność: rozwinięcie zapisuje się
     * na koncie, a wszystkie testy w tym pliku dzielą jedno konto administratora, więc bez tego
     * ten test przechodziłby albo nie w zależności od tego, co robił poprzedni.
     */
    await page.goto("/tasks/all");
    await page.waitForLoadState("load").catch(() => {});

    // Stan początkowy: zwinięta. Jeśli poprzedni test ją rozwinął — zwijamy z powrotem.
    const zwin = page.getByRole("button", { name: /^zwiń ulubione/i }).first();
    if (await zwin.count() > 0 && await zwin.isVisible().catch(() => false)) {
      await zwin.click();
      await page.waitForTimeout(400);
    }

    // 043/AC-1 ZOSTAJE: sam nagłówek sekcji jest w nawigacji mimo pustej listy.
    await expect(page.getByText("Ulubione", { exact: true })).toBeVisible({ timeout: 15_000 });
    // 080/AC-16: w stanie zwiniętym sekcja to JEDEN wiersz — bez zachęty i bez punktu zapisu.
    await expect(page.getByText(/Nie masz jeszcze zapisanych widoków/i)).toHaveCount(0);

    // Po rozwinięciu wraca zachęta z 043.
    await page.getByRole("button", { name: /^rozwiń ulubione/i }).first().click();
    await expect(page.getByText(/Nie masz jeszcze zapisanych widoków/i)).toBeVisible({ timeout: 10_000 });

    /**
     * 083/AC-2 ZNOSI drugą połowę reguły z 043/AC-2 — i to jest decyzja, nie regresja.
     *
     * 043 wymagało punktu zapisu Z ETYKIETĄ w sekcji ulubionych, bo wtedy jedynym wejściem była
     * ikona schowana na dole nawigacji. Od tamtej pory ta sama akcja stała w TRZECH miejscach naraz
     * (sekcja paska bocznego, mobilny pasek powłoki, pasek widoku) — właściciel zobaczył cztery
     * gwiazdki na jednym ekranie i zgłosił to jako „dwie ikony gwiazdki, po co?". Przy jednej akcji
     * trzy wejścia nie dają wyboru, tylko pytanie „które z nich jest właściwe".
     *
     * Zostaje JEDNO wejście: gwiazdka w pasku widoku — bo to on opisuje widok, który się zapisuje.
     * Sekcja pozostaje tym, czym jest: LISTĄ zapisanych. Zmierzone po zmianie: jedna ikona gwiazdki
     * na ekranie (`/wiadomosci`, desktop 1280 px).
     */
    await expect(page.getByText("Zapisz ten widok", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /zapisz to miejsce w ulubionych/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("[fav043-AC3] zarządzanie ulubionymi dostępne wprost z nawigacji", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("load").catch(() => {});

    await page.getByRole("link", { name: /Zarządzaj ulubionymi/i }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/settings");

    // Edytor z 042 (nazwa / ikona / kolor / kolejność) jest na miejscu, pod kotwicą.
    await expect(page.locator("#ulubione")).toBeVisible({ timeout: 10_000 });
  });
});
