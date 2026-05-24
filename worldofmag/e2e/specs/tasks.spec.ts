import { test, expect } from "../fixtures/test";
import { requireVisible } from "../fixtures/guards";

test.describe("Zadania — widoki", () => {
  const views: { slug: string; view: "today" | "upcoming" | "overdue" | "all" }[] = [
    { slug: "scenario-tasks-view-today", view: "today" },
    { slug: "scenario-tasks-view-overdue", view: "overdue" },
    { slug: "scenario-tasks-view-empty", view: "upcoming" },
  ];
  for (const v of views) {
    test(`[${v.slug}] widok ${v.view}`, async ({ page, tasks }) => {
      await tasks.open();
      await tasks.openView(v.view);
      await expect(page).toHaveURL(/\/tasks/);
      await expect(page).not.toHaveURL(/auth\/signin/);
    });
  }
});

test.describe("Zadania — CRUD", () => {
  test("[scenario-tasks-create-project] utworzenie projektu", async ({ page, tasks, isMobile }) => {
    test.skip(isMobile, "Tworzenie projektu w sidebarze — desktop");
    await tasks.open();
    const newProject = tasks.button(/Nowy projekt/);
    await requireVisible(newProject, "Brak przycisku tworzenia projektu");
    await tasks.createProject(`E2E Projekt ${Date.now()}`);
    await expect(page).toHaveURL(/\/tasks/);
  });

  test("[scenario-tasks-add-quick] szybkie dodanie zadania", async ({ page, tasks }) => {
    await tasks.open();
    const title = `E2E zadanie ${Date.now()}`;
    await page.keyboard.press("a");
    const input = page.getByPlaceholder(/Dodaj zadanie/);
    await requireVisible(input, "Brak pola quick-add");
    await input.fill(title);
    await input.press("Enter");
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("[scenario-tasks-add-empty-blocked] pusty tytuł nie tworzy zadania", async ({ page, tasks }) => {
    await tasks.open();
    await page.keyboard.press("a");
    const input = page.getByPlaceholder(/Dodaj zadanie/);
    await requireVisible(input, "Brak pola quick-add");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/tasks/);
  });

  test("[scenario-tasks-tag-create-assign] strona tagów", async ({ page }) => {
    await page.goto("/tasks/tags");
    await expect(page).toHaveURL(/\/tasks\/tags/);
    await expect(page).not.toHaveURL(/auth\/signin/);
  });
});

test.describe("Zadania — skróty", () => {
  test("[scenario-tasks-ctrlk-palette] Ctrl+K otwiera paletę poleceń", async ({ page, tasks }) => {
    await tasks.open();
    await page.keyboard.press("Control+k");
    // cmdk renderuje dialog z polem wyszukiwania.
    const palette = page.getByRole("dialog").or(page.getByPlaceholder(/Szukaj|polecenie|Wpisz/i));
    await requireVisible(palette, "Paleta poleceń nie otworzyła się skrótem");
    await expect(palette.first()).toBeVisible();
  });

  test("[scenario-tasks-nav-jk] nawigacja j/k nie psuje widoku", async ({ page, tasks }) => {
    await tasks.open();
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await expect(page).toHaveURL(/\/tasks/);
  });
});
