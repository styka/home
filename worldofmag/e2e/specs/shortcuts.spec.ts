import { test, expect } from "../fixtures/test";

/**
 * 043 — rejestr skrótów klawiszowych (AC-9..AC-12).
 *
 * Najważniejszy test to `[sc-AC9]`: `Alt+1` musi wykonać WYŁĄCZNIE skok do ulubionego i NIE
 * przełączyć zakładki filtra. To była realna kolizja wprowadzona w 042 — `switch (e.key)`
 * w `useKeyboardShortcuts` nie sprawdzał modyfikatorów.
 */
test.describe.configure({ mode: "serial" });

async function clearFavorites(page: import("@playwright/test").Page) {
  const sel = 'button[aria-label^="Usu"][aria-label$="z ulubionych"]';
  for (let i = 0; i < 40; i++) {
    await page.goto("/settings");
    // 098: NIE `networkidle` — od 072 aplikacja trzyma otwarty strumien zdarzen (`/api/events`),
    // wiec sieć nigdy nie jest bezczynna i to oczekiwanie konczylo sie limitem czasu testu.
    await page.waitForLoadState("load").catch(() => {});
    const n = await page.locator(sel).count();
    if (n === 0) return;
    await page.locator(sel).first().click();
    await expect(page.locator(sel)).toHaveCount(n - 1, { timeout: 15_000 });
  }
  throw new Error("Nie udalo sie wyczyscic ulubionych w 40 iteracjach");
}

test.describe("043 — skróty klawiszowe", () => {
  test("[sc-AC11] ściągawka pod ? pokazuje skróty strony i globalne", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("load").catch(() => {});

    const sheet = page.getByRole("dialog", { name: /Ściągawka skrótów/i });

    // 098: ściągawka czyta rejestr W CHWILI OTWARCIA, a strona rejestruje swoje skróty dopiero
    // po hydracji. Wcześniej test czekał na `networkidle`, które przy otwartym strumieniu SSE
    // nie następuje nigdy — więc czekał do limitu i przy okazji zdążył. Po naprawie tamtego
    // czekania trzeba było nazwać ten warunek wprost: otwieramy z ponowieniem, zamiast zakładać,
    // że hydracja już się wydarzyła.
    await expect(async () => {
      await page.keyboard.press("Escape");
      await page.keyboard.press("Shift+Slash"); // znak „?"
      await expect(sheet).toBeVisible({ timeout: 2_000 });
      // Sekcje muszą być obie — pierwszeństwo strony jest sednem rozwiązania.
      await expect(sheet.getByText("Ta strona", { exact: true })).toBeVisible({ timeout: 2_000 });
      await expect(sheet.getByText("Globalne", { exact: true })).toBeVisible({ timeout: 2_000 });
      // I lista pochodzi z rejestru, więc widać realne skróty strony Zadań.
      await expect(sheet.getByText("Zakładka filtra 1")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden({ timeout: 10_000 });
  });

  test("[sc-AC10] goła cyfra przełącza zakładkę filtra", async ({ page }) => {
    // Notatki, a NIE Zadania: zakładki Zadań zależą od statusów włączonych w danej liście, więc
    // „druga zakładka" bywa różna zależnie od danych w bazie. `NOTE_FILTERS` to stała
    // (`ALL`, `PINNED`, `NO_GROUP`, `SEARCH`), więc `2` zawsze znaczy „Przypięte".
    await page.goto("/notes/all");
    await page.waitForLoadState("load").catch(() => {});
    expect(new URL(page.url()).search).toBe("");

    // 098: skróty strony rejestrują się dopiero po hydracji, a `load` następuje wcześniej.
    // Ponawiamy naciśnięcie zamiast zakładać, że strona jest już interaktywna — wcześniej maskowało
    // to czekanie na `networkidle`, które przy otwartym strumieniu SSE trwało do limitu czasu.
    await expect(async () => {
      await page.keyboard.press("2");
      await expect
        .poll(() => new URL(page.url()).searchParams.get("filter"), { timeout: 1_500 })
        .toBe("PINNED");
    }).toPass({ timeout: 20_000 });
  });

  test("[sc-AC9] Alt+1 skacze do ulubionego i NIE zmienia zakładki filtra", async ({ page }) => {
    await clearFavorites(page);

    // Zapisujemy ulubione prowadzące do INNEGO modułu — łatwo sprawdzić, że skok się wydarzył.
    await page.goto("/notes/all");
    await page.waitForLoadState("load").catch(() => {});
    // 098: gwiazdka „zapisz widok" jest w DWÓCH miejscach naraz — w pasku widoku (`main`)
    // i w sekcji ulubionych w nawigacji. Bez zawężenia Playwright zgłasza naruszenie trybu
    // ścisłego, bo trafia w dwa elementy. Klikamy tę z paska widoku — to ona jest przedmiotem testu.
    await page.getByRole("main").getByRole("button", { name: /Zapisz to miejsce w ulubionych/i }).click();
    await page.getByPlaceholder("Nazwa widoku…").fill("Notatki skrót");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    // 098: ta sama dwoistość co przy zapisie — gwiazdka „usuń z ulubionych" jest i w pasku widoku,
    // i w nawigacji. Sprawdzamy tę z paska widoku.
    await page.getByRole("main").getByRole("button", { name: /Usuń to miejsce z ulubionych/i }).waitFor({ timeout: 15_000 });

    // Na stronie z zakładkami filtrów: adres startowy bez parametrów.
    await page.goto("/tasks/all");
    await page.waitForLoadState("load").catch(() => {});
    expect(new URL(page.url()).search).toBe("");

    await page.keyboard.press("Alt+Digit1");

    // Skok się wydarzył…
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/notes/all");
    // …i po drodze NIE ustawił filtra zadań (to była kolizja z 042).
    expect(new URL(page.url()).searchParams.get("status")).toBeNull();

    await clearFavorites(page);
  });

  test("[sc-AC12] pisanie w polu nie wyzwala skrótów", async ({ page }) => {
    await page.goto("/tasks/all");
    await page.waitForLoadState("load").catch(() => {});

    // Na liście zadań pole tekstowe pojawia się dopiero po otwarciu wyszukiwarki skrótem „/".
    // 098: z ponowieniem — skrót działa dopiero po hydracji, a `load` następuje wcześniej.
    const input = page.locator("input:focus").first();
    await expect(async () => {
      await page.keyboard.press("/");
      await expect(input).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 20_000 });
    // „2" i „d" to skróty strony (zakładka filtra, usuwanie) — w polu muszą być zwykłymi znakami.
    await input.type("2d");

    await expect(input).toHaveValue(/2d/);
    expect(new URL(page.url()).searchParams.get("status")).toBeNull();
  });
});
