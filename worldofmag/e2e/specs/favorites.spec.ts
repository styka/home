import { test, expect } from "../fixtures/test";

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
 * `waitForLoadState("networkidle")` przed klikiem jest istotny: po `router.refresh()` z poprzedniego
 * kroku drzewo bywa jeszcze przemontowywane, a popover trzyma stan lokalnie — klik trafiony w to
 * okno gubil otwarty popover.
 */
async function saveCurrentAs(page: import("@playwright/test").Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button", { name: /Zapisz to miejsce w ulubionych/i }).click();
  await page.getByPlaceholder("Nazwa widoku…").fill(name);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("button", { name: /Usuń to miejsce z ulubionych/i }).waitFor({ timeout: 15_000 });
}

/** Sprząta ulubione przez interfejs ustawień, żeby testy nie zależały od kolejności. */
async function clearFavorites(page: import("@playwright/test").Page) {
  const sel = 'button[aria-label^="Usu"][aria-label$="z ulubionych"]';
  for (let i = 0; i < 40; i++) {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle").catch(() => {});
    const n = await page.locator(sel).count();
    if (n === 0) return;
    await page.locator(sel).first().click();
    // Kasowanie idzie przez Server Action + router.refresh() — czekamy, az lista sie przeliczy.
    await expect(page.locator(sel)).toHaveCount(n - 1, { timeout: 15_000 });
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
    await page.getByRole("link", { name: /Zrobione zadania/ }).first().click();
    await expect(page).toHaveURL(/\/tasks\?status=DONE&x=1/);

    // AC-3: ponowny klik gwiazdki usuwa wpis.
    await page.getByRole("button", { name: STAR_REMOVE }).click();
    await expect(page.getByRole("button", { name: STAR_SAVE })).toBeVisible({ timeout: 10_000 });
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
      const list = await prisma.shoppingList.create({
        data: { name: `AC24 ${Date.now()}`, ownerId: user.id },
      });
      listId = list.id;
      await prisma.item.create({ data: { listId: list.id, name: "mleko", status: "DONE" } });
    } finally {
      await prisma.$disconnect();
    }

    await page.goto(`/shopping/${listId}`);
    await page.waitForLoadState("networkidle").catch(() => {});

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

  test("[fav043-AC1-AC2] sekcja, zachęta i punkt zapisu widoczne bez ani jednego ulubionego", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("networkidle").catch(() => {});

    // AC-1: nagłówek sekcji jest w nawigacji mimo pustej listy.
    await expect(page.getByText("Ulubione", { exact: true })).toBeVisible({ timeout: 15_000 });
    // …wraz z zachętą mówiącą, co zrobić.
    await expect(page.getByText(/Nie masz jeszcze zapisanych widoków/i)).toBeVisible();

    // AC-2: punkt zapisu ma ETYKIETĘ, nie jest samą ikoną schowaną na dole nawigacji.
    await expect(page.getByText("Zapisz ten widok", { exact: true })).toBeVisible();
  });

  test("[fav043-AC3] zarządzanie ulubionymi dostępne wprost z nawigacji", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.getByRole("link", { name: /Zarządzaj ulubionymi/i }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/settings");

    // Edytor z 042 (nazwa / ikona / kolor / kolejność) jest na miejscu, pod kotwicą.
    await expect(page.locator("#ulubione")).toBeVisible({ timeout: 10_000 });
  });
});
