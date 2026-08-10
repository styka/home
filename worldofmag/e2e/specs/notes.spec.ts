import { test, expect } from "../fixtures/test";
import { requireVisible } from "../fixtures/guards";

test.describe("Notatki", () => {
  test("[scenario-notes-home-recent-pinned] home notatek", async ({ page, notes }) => {
    await notes.open();
    await expect(page).toHaveURL(/\/notes/);
    await expect(page).not.toHaveURL(/auth\/signin/);
  });

  test("[scenario-notes-search] wyszukiwarka notatek", async ({ notes }) => {
    await notes.openAll();
    await expect(
      notes.searchInput.or(notes.heading(/Notatki|Brak notatek/)).first(),
    ).toBeVisible();
  });

  test("[scenario-notes-group-create] strona grup", async ({ page, notes }) => {
    await notes.openGroups();
    await expect(page).toHaveURL(/\/notes\/groups/);
    // 048: zawężone do `<main>`. Bez tego `getByText(...)` trafiał najpierw w element POWŁOKI
    // (pozycja nawigacji ukryta na tym rozmiarze ekranu), więc asercja widoczności padała mimo
    // poprawnie wyrenderowanej strony. Treść sprawdzamy w treści, nie w chromie.
    // 048: asercja była NIEAKTUALNA — widok mówi „Foldery notatek" / „Nowy folder"; nazwa
    // „grupy" pochodzi z wcześniejszej wersji nazewnictwa i nie ma jej w interfejsie od dawna.
    await expect(page.getByRole("main").getByText(/Foldery notatek|Nowy folder/).first()).toBeVisible();
  });

  test("[scenario-notes-tag-create-assign] strona tagów", async ({ page, notes }) => {
    await notes.openTags();
    await expect(page).toHaveURL(/\/notes\/tags/);
    await expect(page.getByText(/Tagi|Brak tagów|Nowy tag/).first()).toBeVisible();
  });

  test("[scenario-notes-create] utworzenie notatki", async ({ page, notes }) => {
    await notes.open();
    const newNote = page.getByRole("link", { name: /Nowa notatka/i }).or(page.getByRole("button", { name: /Nowa notatka/i }));
    await requireVisible(newNote, "Brak przycisku 'Nowa notatka'");
    await newNote.first().click();
    await expect(page).not.toHaveURL(/auth\/signin/);
  });

  test("[scenario-notes-tag-filter] filtry notatek", async ({ page, notes }) => {
    await notes.openAll();
    const filter = page.getByRole("button", { name: /Przypięte|Wszystkie/i });
    await requireVisible(filter, "Brak zakładek filtra notatek");
    await filter.first().click();
    await expect(page).toHaveURL(/\/notes/);
  });
});
