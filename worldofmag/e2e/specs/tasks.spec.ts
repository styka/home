import { test, expect } from "../fixtures/test";

test.describe("Zadania", () => {
  test("[scenario-tasks-view-today] widok Dziś", async ({ page, tasks }) => {
    await tasks.open();
    await test.step("Otwórz widok Dziś", async () => {
      await tasks.openView("today");
    });
    await expect(page).toHaveURL(/\/tasks/);
  });

  test("[scenario-tasks-create-project] utworzenie projektu", async ({ page, tasks, isMobile }) => {
    test.skip(isMobile, "Tworzenie projektu w sidebarze — desktop");
    await tasks.open();
    await test.step("Utwórz projekt", async () => {
      await tasks.createProject(`E2E Projekt ${Date.now()}`);
    });
    await expect(page).toHaveURL(/\/tasks/);
  });

  test("[scenario-tasks-add-quick] szybkie dodanie zadania", async ({ page, tasks }) => {
    await tasks.open();
    await test.step("Dodaj zadanie", async () => {
      await tasks.addTask(`E2E zadanie ${Date.now()}`);
    });
    await expect(page).toHaveURL(/\/tasks/);
  });
});
