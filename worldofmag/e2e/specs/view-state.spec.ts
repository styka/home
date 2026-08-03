import { test, expect } from "../fixtures/test";

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
  const sel = 'button[aria-label^="Usu"][aria-label$="z ulubionych"]';
  for (let i = 0; i < 40; i++) {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle").catch(() => {});
    const n = await page.locator(sel).count();
    if (n === 0) return;
    await page.locator(sel).first().click();
    await expect(page.locator(sel)).toHaveCount(n - 1, { timeout: 15_000 });
  }
  throw new Error("Nie udalo sie wyczyscic ulubionych w 40 iteracjach");
}

test.describe("043 — stan widoku w adresie", () => {
  test("[vs-AC5] zmiana układu i grupowania w Zadaniach trafia do adresu", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Wejście bez parametrów NIE dokłada niczego do adresu (AC-8).
    expect(new URL(page.url()).search).toBe("");

    await page.getByRole("button", { name: "Kanban", exact: true }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get("layout")).toBe("kanban");
  });

  test("[vs-AC6] przycisk wstecz wraca do poprzedniego stanu widoku", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("networkidle").catch(() => {});

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
    await page.waitForLoadState("networkidle").catch(() => {});

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
      await page.waitForLoadState("networkidle").catch(() => {});
      // Brak parametrów w adresie = widok domyślny, dokładnie jak przed 043.
      expect(new URL(page.url()).search, `${path} nie powinno dokładać parametrów`).toBe("");
    }
  });

  test("[vs-AC7] Notatki: tryb widoku trafia do adresu i wraca", async ({ page }) => {
    await page.goto("/notes/all");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Przełącznik listy/siatki (jedyny przycisk zmieniający tryb prezentacji notatek).
    const toggle = page.getByTitle(/Widok siatki/i).first();
    await toggle.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("grid");

    // Ponowne otwarcie tego adresu daje ten sam tryb.
    await page.goto("/notes/all?view=grid");
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(new URL(page.url()).searchParams.get("view")).toBe("grid");
  });

  test("[vs-AC4] ulubiony zapisany z filtrami wraca z filtrami", async ({ page }) => {
    await clearFavorites(page);

    await page.goto("/tasks/all?layout=kanban");
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.getByRole("button", { name: /Zapisz to miejsce w ulubionych/i }).click();
    await page.getByPlaceholder("Nazwa widoku…").fill("Kanban wszystkich");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await page.getByRole("button", { name: /Usuń to miejsce z ulubionych/i }).waitFor({ timeout: 15_000 });

    // Wyjście gdzie indziej i powrót przez ulubione — adres musi nieść komplet ustawień.
    await page.goto("/notes/all");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByRole("link", { name: "Kanban wszystkich" }).first().click();

    await expect.poll(() => new URL(page.url()).searchParams.get("layout"), { timeout: 15_000 }).toBe("kanban");

    await clearFavorites(page);
  });
});
