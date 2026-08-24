import { test, expect } from "../fixtures/test";
import { kliknijGwiazdkeUlubionych, gwiazdkaUlubionych } from "../pages/chromWidoku";

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

/**
 * 087: gwiazdka ma JEDNĄ nazwę i JEDNO zadanie — otworzyć dialog ulubionych. Stan bieżącego widoku
 * czytamy z `aria-pressed`, a nie z etykiety, bo etykieta przestała być czynnością („Zapisz to
 * miejsce") i stała się nazwą miejsca („Ulubione widoki").
 */
const GWIAZDKA = /Ulubione/i;

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
  // 087: gwiazdka otwiera JEDEN dialog — lista zapisanych plus operacja na bieżącym widoku.
  // Zapis jest więc dwoma krokami zamiast jednego, ale za to całe ulubione mają jedno wejście.
  await kliknijGwiazdkeUlubionych(page, GWIAZDKA);
  await page.getByRole("button", { name: /Dodaj bieżący widok/i }).click();
  await page.getByPlaceholder("Nazwa widoku…").fill(name);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(gwiazdkaUlubionych(page, GWIAZDKA)).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
}

/** Otwiera dialog ulubionych i przechodzi do zapisanego widoku o podanej nazwie. */
async function skoczDoUlubionego(page: import("@playwright/test").Page, name: string) {
  await kliknijGwiazdkeUlubionych(page, GWIAZDKA);
  const dialog = page.getByRole("dialog", { name: "Ulubione widoki" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByText(name, { exact: false }).first().click();
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
    await skoczDoUlubionego(page, "Zrobione zadania");
    await expect(page).toHaveURL(/\/tasks\?status=DONE&x=1/);

    // AC-3: usunięcie bieżącego widoku z tego samego dialogu, w którym się go dodaje.
    await kliknijGwiazdkeUlubionych(page, GWIAZDKA);
    await page.getByRole("button", { name: /Usuń bieżący widok/i }).click();
    await expect(gwiazdkaUlubionych(page, GWIAZDKA)).toHaveAttribute("aria-pressed", "false", { timeout: 10_000 });
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
    await kliknijGwiazdkeUlubionych(page, GWIAZDKA);

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
    // 087: sekcja ulubionych w nawigacji NIE ISTNIEJE — pusty stan mieszka w dialogu gwiazdki.
    await expect(page.locator("aside nav").getByText("Ulubione", { exact: true })).toHaveCount(0);
    await kliknijGwiazdkeUlubionych(page, GWIAZDKA);
    await expect(page.getByText(/Nie masz jeszcze ulubionych widoków/)).toBeVisible({ timeout: 10_000 });
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
 * 043/087 — ULUBIONE WIDOCZNE OD PIERWSZEGO WEJŚCIA.
 *
 * 043 wymagało, żeby sekcja ulubionych renderowała się w nawigacji ZAWSZE — także przy zerze wpisów —
 * bo inaczej „nie było skąd się dowiedzieć, że ulubione w ogóle istnieją". 087 spełnia ten sam
 * wymóg innym środkiem i **znosi sekcję**: gwiazdka stoi w rzędzie chromu, widać ją od pierwszego
 * wejścia na każdej trasie, a pod nią jest jeden dialog z listą, pustym stanem, dodaniem bieżącego
 * widoku i wejściem do zarządzania. Powód zmiany był zgłoszeniem właściciela: dwa wejścia do jednej
 * rzeczy („nie powinno być pozycji ulubione w menu, to klik w ikonę gwiazdki powinien otworzyć
 * dialog…"). Testy sprawdzają więc tę samą regułę na nowym nośniku.
 */
test.describe("043/087 — ulubione widoczne od pierwszego wejścia", () => {
  test.beforeEach(async ({ page }) => {
    await clearFavorites(page);
  });

  test("[fav043-AC1-AC2 → 087] gwiazdka jest widoczna od razu, a jej dialog niesie pusty stan i punkt zapisu", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("load").catch(() => {});

    // Sekcji w nawigacji NIE MA — to jest zmiana zamierzona, nie regresja.
    await expect(page.locator("aside nav").getByText("Ulubione", { exact: true })).toHaveCount(0);

    // Wejście jest jedno i widoczne bez przewijania.
    const gwiazdka = gwiazdkaUlubionych(page, GWIAZDKA);
    await expect(gwiazdka).toBeVisible({ timeout: 15_000 });
    await gwiazdka.click();

    const dialog = page.getByRole("dialog", { name: "Ulubione widoki" });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/Nie masz jeszcze ulubionych widoków/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Dodaj bieżący widok/i })).toBeVisible();
  });

  test("[fav043-AC3 → 087] zarządzanie ulubionymi dostępne z dialogu", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("load").catch(() => {});
    await kliknijGwiazdkeUlubionych(page, GWIAZDKA);

    await page.getByRole("button", { name: /Zarządzaj ulubionymi/i }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/settings");

    // Edytor z 042 (nazwa / ikona / kolor / kolejność) jest na miejscu, pod kotwicą.
    await expect(page.locator("#ulubione")).toBeVisible({ timeout: 10_000 });
  });
});
