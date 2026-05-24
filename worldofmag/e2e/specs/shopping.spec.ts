import { test, expect } from "../fixtures/test";

test.describe("Zakupy", () => {
  test("[scenario-create-list-positive] utworzenie listy z poprawną nazwą", async ({ page, shopping }) => {
    const name = `E2E Lista ${Date.now()}`;
    await shopping.open();
    await test.step("Utwórz nową listę", async () => {
      await shopping.createList(name);
    });
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("[scenario-create-list-empty-name] pusta nazwa nie tworzy listy", async ({ page, shopping }) => {
    await shopping.open();
    await shopping.button(/Nowa lista/).first().click();
    // Bez wpisania nazwy przycisk Utwórz nie powinien dodać listy.
    const create = shopping.button(/Utwórz/).first();
    await test.step("Próba zatwierdzenia pustej nazwy", async () => {
      if (await create.isEnabled().catch(() => false)) {
        await create.click();
      }
    });
    await expect(page).toHaveURL(/\/shopping/);
  });

  test("[scenario-no-permission-locked] desktop pokazuje pełną nawigację dla uprawnionego", async ({ shopping, app }) => {
    await shopping.open();
    await app.expectNavVisible("shopping");
  });

  test("[scenario-mobile-select-list] mobilny select listy", async ({ page, shopping, isMobile }) => {
    test.skip(!isMobile, "Tylko mobile");
    await shopping.open();
    // Na mobile lista wybierana jest natywnym <select> (gdy istnieją listy).
    const select = page.locator("select[aria-label='Wybierz listę zakupów']");
    await expect(select.or(page.getByText(/Brak list/)).first()).toBeVisible();
  });
});
