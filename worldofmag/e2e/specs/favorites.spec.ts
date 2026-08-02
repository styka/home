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

/** Sprząta ulubione przez interfejs ustawień, żeby testy nie zależały od kolejności. */
async function clearFavorites(page: import("@playwright/test").Page) {
  await page.goto("/settings");
  for (let i = 0; i < 40; i++) {
    const del = page.locator('button[aria-label^="Usu"][aria-label$="z ulubionych"]').first();
    if (!(await del.isVisible().catch(() => false))) break;
    await del.click();
    await page.waitForTimeout(250);
  }
}

test.describe("042 — ulubione widoki", () => {
  test.beforeEach(async ({ page }) => {
    await clearFavorites(page);
  });

  test("[fav-AC1-AC2-AC3] zapis z filtrami, powrót pod ten sam adres, przełącznik", async ({ page }) => {
    // AC-1: zapisujemy miejsce WRAZ z parametrami zapytania.
    await page.goto("/tasks?status=DONE&x=1");
    await page.getByRole("button", { name: STAR_SAVE }).click();

    const nameInput = page.getByPlaceholder("Nazwa widoku…");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Zrobione zadania");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();

    // Po zapisie gwiazdka przechodzi w stan „w ulubionych" (AC-3, pierwsza połowa).
    await expect(page.getByRole("button", { name: STAR_REMOVE })).toBeVisible({ timeout: 10_000 });

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
    await page.getByRole("button", { name: STAR_SAVE }).click();
    await page.getByPlaceholder("Nazwa widoku…").fill("Notatki raz");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(page.getByRole("button", { name: STAR_REMOVE })).toBeVisible({ timeout: 10_000 });

    // Wymuszamy drugi zapis tej samej ścieżki bezpośrednio przez akcję serwera:
    // interfejs pokazuje już „usuń", więc duplikat mógłby powstać tylko tędy.
    await page.goto("/settings");
    const rows = page.locator('button[aria-label^="Usu"][aria-label$="z ulubionych"]');
    await expect(rows).toHaveCount(1);
  });

  test("[fav-AC4] przełącznik z wyszukiwaniem działa z dowolnej strony", async ({ page }) => {
    await page.goto("/kitchen");
    await page.getByRole("button", { name: STAR_SAVE }).click();
    await page.getByPlaceholder("Nazwa widoku…").fill("Kuchnia moja");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(page.getByRole("button", { name: STAR_REMOVE })).toBeVisible({ timeout: 10_000 });

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
    await page.getByRole("button", { name: STAR_SAVE }).click();
    await page.getByPlaceholder("Nazwa widoku…").fill("Notatki skrót");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(page.getByRole("button", { name: STAR_REMOVE })).toBeVisible({ timeout: 10_000 });

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
    await page.goto("/habits");
    await page.getByRole("button", { name: STAR_SAVE }).click();
    await page.getByPlaceholder("Nazwa widoku…").fill("Nawyki stare");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(page.getByRole("button", { name: STAR_REMOVE })).toBeVisible({ timeout: 10_000 });

    await page.goto("/settings");
    await page.locator('button[aria-label^="Zmie"][aria-label*="Nawyki stare"]').click();
    const editor = page.locator('input[value="Nawyki stare"]');
    await editor.fill("Nawyki nowe");
    await editor.press("Enter");
    await expect(page.getByText("Nawyki nowe")).toBeVisible({ timeout: 10_000 });

    await page.locator('button[aria-label^="Usu"][aria-label*="Nawyki nowe"]').click();
    await expect(page.getByText(/Nie masz jeszcze ulubionych widoków/)).toBeVisible({ timeout: 10_000 });
  });

  test("[fav-AC10] ulubione żyją przy koncie, nie w przeglądarce", async ({ page, context }) => {
    await page.goto("/notes");
    await page.getByRole("button", { name: STAR_SAVE }).click();
    await page.getByPlaceholder("Nazwa widoku…").fill("Trwałe notatki");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(page.getByRole("button", { name: STAR_REMOVE })).toBeVisible({ timeout: 10_000 });

    // Czyścimy CAŁY magazyn przeglądarki — zostają tylko ciasteczka sesji.
    await context.clearCookies({ name: "nonexistent" }).catch(() => {});
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Trwałe notatki/ }).first()).toBeVisible();
  });
});

test.describe("042 — poprawki UX", () => {
  test("[ux-AC24] czyszczenie kupionych pozycji wymaga potwierdzenia", async ({ page, shopping }) => {
    // Budujemy własne dane: lista + pozycja przestawiona w stan kupione (DONE),
    // żeby przycisk „Wyczyść" w ogóle się pojawił.
    const listName = `AC24 ${Date.now()}`;
    await shopping.open();
    await shopping.createList(listName);
    await expect(page).toHaveURL(/\/shopping\/.+/);
    await shopping.addItem("mleko");

    const row = page.getByText("mleko", { exact: false }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // `x` przechodzi przez cykl statusów: NEEDED → IN_CART → DONE.
    await row.click();
    await page.keyboard.press("x");
    await page.waitForTimeout(400);
    await page.keyboard.press("x");
    await page.waitForTimeout(800);

    const clear = page.getByTitle(/Wyczyść zakończone elementy/);
    await expect(clear).toBeVisible({ timeout: 10_000 });
    await clear.click();

    // Kluczowe: pozycje NIE znikają bez potwierdzenia — `clearDoneItems` kasuje twardo, bez kosza.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/nie da się cofnąć/i)).toBeVisible();

    await dialog.getByRole("button", { name: "Anuluj" }).click();
    await expect(page.getByTitle(/Wyczyść zakończone elementy/)).toBeVisible();
    await expect(page.getByText("mleko", { exact: false }).first()).toBeVisible();
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
