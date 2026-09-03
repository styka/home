import { test, expect } from "../fixtures/test";
import { prisma } from "../fixtures/db";
import { E2E_ADMIN } from "../fixtures/users";

/**
 * 124 — „DO DOCZYTANIA" W WIADOMOŚCIACH (AC-5..AC-10).
 *
 * Dane wchodzą prosto do bazy (temat + źródło + dwie pozycje PENDING), bo przebieg odświeżania
 * potrzebuje sieci i modelu — a testujemy tu UX odłożenia, nie pobieranie RSS. Sprzątanie robi
 * kaskada FK przy kasowaniu tematu, więc powtórne uruchomienie zaczyna od czysta.
 *
 * `networkidle` nie występuje i nie może wystąpić (otwarty strumień zdarzeń — bramka
 * `check:e2e-waits`, lekcja z 098).
 */

const TEMAT = "124 doczytania test";
const POZYCJA_ODKLADANA = "Pozycja do odłożenia 124";
const POZYCJA_ZWYKLA = "Pozycja zwykła 124";

async function przestrzenAdmina(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_ADMIN.email } });
  const ws = await prisma.workspace.findFirst({ where: { personalUserId: user.id } });
  if (!ws) throw new Error("Konto e2e-admin nie ma przestrzeni osobistej");
  return ws.id;
}

test.beforeAll(async () => {
  const workspaceId = await przestrzenAdmina();

  const stary = await prisma.newsTopic.findFirst({ where: { workspaceId, title: TEMAT } });
  if (stary) await prisma.newsTopic.delete({ where: { id: stary.id } });

  const zrodlo =
    (await prisma.newsSource.findFirst({ where: { workspaceId, key: "e2e-124" } })) ??
    (await prisma.newsSource.create({
      data: {
        key: "e2e-124",
        name: "Źródło 124",
        rssUrl: "https://example.com/rss-124",
        homepageUrl: "https://example.com",
        workspaceId,
      },
    }));

  const temat = await prisma.newsTopic.create({
    data: { title: TEMAT, semanticFilter: TEMAT, workspaceId },
  });
  await prisma.newsItem.createMany({
    data: [
      {
        topicId: temat.id,
        sourceId: zrodlo.id,
        url: "https://example.com/124/a1",
        title: POZYCJA_ODKLADANA,
        summary: "Streszczenie pierwszej pozycji testowej.",
        publishedAt: new Date(),
        status: "PENDING",
      },
      {
        topicId: temat.id,
        sourceId: zrodlo.id,
        url: "https://example.com/124/a2",
        title: POZYCJA_ZWYKLA,
        summary: "Streszczenie drugiej pozycji testowej.",
        publishedAt: new Date(Date.now() - 60_000),
        status: "PENDING",
      },
    ],
  });
});

async function otworz(page: import("@playwright/test").Page) {
  await page.goto("/wiadomosci");
  await page.waitForLoadState("load").catch(() => {});
  // Strumień ładuje się akcją po stronie klienta — czekamy na TREŚĆ, nie na czas.
  await expect(page.getByText(POZYCJA_ODKLADANA)).toBeVisible({ timeout: 20_000 });
}

function karta(page: import("@playwright/test").Page, tytul: string) {
  return page.locator("[data-news-karta]", { hasText: tytul });
}

function przyciskFiltra(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: /wiadomości odłożone|Pokaż wszystkie wiadomości/i });
}

test("[124-AC5..AC8] odlozenie, zawezenie, odpornosc na oznacz-wszystkie, zdjecie przez Przeczytane", async ({
  page,
}) => {
  await otworz(page);

  // AC-5: jeden gest odkłada; ten sam przycisk pokazuje stan i cofa.
  const odkladana = karta(page, POZYCJA_ODKLADANA);
  await odkladana.getByRole("button", { name: "Doczytam" }).click();
  await expect(odkladana.getByRole("button", { name: "Odłożone" })).toBeVisible({
    timeout: 15_000,
  });

  // AC-6: zawężenie jednym gestem w pasku; licznik = 1; zostaje wyłącznie odłożona pozycja.
  const filtr = przyciskFiltra(page);
  await expect(filtr).toContainText("1");
  await filtr.click();
  await expect(page).toHaveURL(/doczytania=1/);
  await expect(karta(page, POZYCJA_ODKLADANA)).toHaveCount(1);
  await expect(karta(page, POZYCJA_ZWYKLA)).toHaveCount(0);

  // AC-7: „oznacz wszystkie" nie zabiera odłożonych (okno potwierdzenia jest NEUTRALNE — C-34).
  await page.getByRole("button", { name: "Oznacz wszystkie" }).click();
  await page.getByRole("button", { name: "Potwierdź" }).click();
  await expect(karta(page, POZYCJA_ODKLADANA)).toHaveCount(1, { timeout: 15_000 });

  // AC-8: pojedyncze „Przeczytane" na odłożonej pozycji zdejmuje odłożenie — znika z zawężenia.
  await karta(page, POZYCJA_ODKLADANA).getByRole("button", { name: "Przeczytane" }).click();
  await expect(karta(page, POZYCJA_ODKLADANA)).toHaveCount(0, { timeout: 15_000 });
  await expect(przyciskFiltra(page)).toContainText("0");
});

test("[124-AC10] adres z zawężeniem odtwarza je po wejściu", async ({ page }) => {
  // Świeża pozycja odłożona prosto w bazie — test adresu nie zależy od poprzedniego scenariusza.
  const workspaceId = await przestrzenAdmina();
  const temat = await prisma.newsTopic.findFirstOrThrow({ where: { workspaceId, title: TEMAT } });
  await prisma.newsItem.updateMany({
    where: { topicId: temat.id, title: POZYCJA_ZWYKLA },
    data: { status: "PENDING", readLater: true },
  });

  await page.goto("/wiadomosci?doczytania=1");
  await page.waitForLoadState("load").catch(() => {});
  await expect(karta(page, POZYCJA_ZWYKLA)).toHaveCount(1, { timeout: 20_000 });
  const filtr = przyciskFiltra(page);
  await expect(filtr).toHaveAttribute("aria-pressed", "true");
});

test("[124-AC9] telefon 360 px: przełącznik stoi w pasku i strona nie przewija się w bok", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await otworz(page);

  const filtr = przyciskFiltra(page);
  await expect(filtr).toBeVisible();
  // Poniżej `lg` etykieta chowa się do ikony — licznik zostaje.
  await expect(filtr.locator("span.hidden")).toHaveCount(1);

  // C-31 (błąd twardy z 084): pasek nie może rozpychać strony poza szerokość ekranu.
  const przewija = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(przewija).toBe(false);
});
