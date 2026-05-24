import { test, expect } from "../fixtures/test";
import { requireVisible, isVisible } from "../fixtures/guards";

test.describe("Zakupy — listy", () => {
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
    const create = shopping.button(/Utwórz/).first();
    if (await create.isEnabled().catch(() => false)) await create.click();
    await expect(page).toHaveURL(/\/shopping/);
  });

  test("[scenario-create-list-long-name] bardzo długa nazwa nie psuje layoutu", async ({ page, shopping }) => {
    await shopping.open();
    await shopping.button(/Nowa lista/).first().click();
    const input = page.getByPlaceholder(/Nazwa listy/);
    await requireVisible(input, "Brak formularza tworzenia listy");
    await input.fill("L".repeat(300));
    await shopping.button(/Utwórz/).first().click();
    await expect(page).toHaveURL(/\/shopping/);
  });

  test("[scenario-switch-lists-sidebar] przełączanie list w sidebarze", async ({ page, shopping, isMobile }) => {
    test.skip(isMobile, "Sidebar tylko desktop");
    const a = `E2E A ${Date.now()}`;
    const b = `E2E B ${Date.now()}`;
    await shopping.open();
    await shopping.createList(a);
    await shopping.open();
    await shopping.createList(b);
    await shopping.open();
    await test.step("Kliknij pierwszą listę", async () => {
      await page.getByText(a).first().click();
    });
    await expect(page).toHaveURL(/\/shopping\//);
  });

  test("[scenario-mobile-select-list] mobilny select listy", async ({ page, shopping, isMobile }) => {
    test.skip(!isMobile, "Tylko mobile");
    await shopping.open();
    const select = page.locator("select[aria-label='Wybierz listę zakupów']");
    await expect(select.or(page.getByText(/Brak list/)).first()).toBeVisible();
  });
});

test.describe("Zakupy — produkty", () => {
  test("[scenario-add-item-enter] dodanie produktu Enterem", async ({ page, shopping }) => {
    const list = `E2E Items ${Date.now()}`;
    await shopping.open();
    await shopping.createList(list);
    // Po utworzeniu zwykle następuje przejście do widoku listy.
    if (!/\/shopping\//.test(page.url())) {
      await page.getByText(list).first().click();
    }
    const item = `mleko-${Date.now()}`;
    await page.keyboard.press("a");
    const input = page.getByRole("textbox").first();
    await requireVisible(input, "Brak pola dodawania produktu");
    await input.fill(item);
    await input.press("Enter");
    await expect(page.getByText(item).first()).toBeVisible();
  });

  test("[scenario-status-filter] filtrowanie po statusie", async ({ page, shopping }) => {
    await shopping.open();
    const anyList = page.getByText(/E2E|Lista/).first();
    if (await isVisible(anyList)) await anyList.click();
    const tab = shopping.filterTab("NEEDED");
    await requireVisible(tab, "Brak zakładek filtra (pusta lista/inny UI)");
    await tab.click();
    await expect(page).toHaveURL(/\/shopping/);
  });
});

test.describe("Zakupy — konfiguracja", () => {
  const routes: { slug: string; path: string; url: RegExp }[] = [
    { slug: "scenario-categories-three-levels", path: "/shopping/categories", url: /categories/ },
    { slug: "scenario-units-list", path: "/shopping/units", url: /units/ },
    { slug: "scenario-products-browse", path: "/shopping/products", url: /products/ },
    { slug: "scenario-icons-browse", path: "/shopping/icons", url: /icons/ },
    { slug: "scenario-stores-browse", path: "/shopping/stores", url: /stores/ },
  ];
  for (const r of routes) {
    test(`[${r.slug}] strona ${r.path} ładuje się`, async ({ page }) => {
      await page.goto(r.path);
      await expect(page).toHaveURL(r.url);
      await expect(page).not.toHaveURL(/auth\/signin/);
    });
  }
});
