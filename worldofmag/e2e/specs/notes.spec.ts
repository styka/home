import { test, expect } from "../fixtures/test";

test.describe("Notatki", () => {
  test("[scenario-notes-search] wyszukiwarka notatek", async ({ notes }) => {
    await notes.openAll();
    await expect(notes.searchInput.or(notes.heading(/Notatki|Brak notatek/)).first()).toBeVisible();
  });

  test("[scenario-notes-group-create] strona grup", async ({ page, notes }) => {
    await notes.openGroups();
    await expect(page).toHaveURL(/\/notes\/groups/);
    await expect(page.getByText(/Grupy notatek|Brak grup/).first()).toBeVisible();
  });

  test("[scenario-notes-tag-create-assign] strona tagów", async ({ page, notes }) => {
    await notes.openTags();
    await expect(page).toHaveURL(/\/notes\/tags/);
  });
});
