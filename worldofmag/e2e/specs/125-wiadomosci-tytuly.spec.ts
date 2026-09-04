import { test, expect } from "../fixtures/test";
import { prisma } from "../fixtures/db";
import { E2E_ADMIN } from "../fixtures/users";

/**
 * 125 — WIDOK SAMYCH TYTUŁÓW (triage „do doczytania") W WIADOMOŚCIACH.
 *
 * Dane wchodzą prosto do bazy (wzorzec 124): temat + DWA źródła + trzy pozycje PENDING — dwa
 * źródła są po to, żeby AC-9 (filtr źródeł zawęża identycznie w obu trybach) dało się sprawdzić
 * adresem `?zrodla=…`, bez klikania po panelu filtra. Sprzątanie robi kaskada FK tematu.
 *
 * SERIAL — scenariusze dzielą jeden zestaw danych (lekcja 124: przy `fullyParallel` każdy worker
 * odpala własne `beforeAll` i sejdy się ścigają). `networkidle` nie występuje (bramka
 * `check:e2e-waits`).
 */

const TEMAT = "125 tytuly test";
const WIERSZ_ODKLADANY = "Wiersz do odłożenia 125";
const WIERSZ_ZWYKLY = "Wiersz zwykły 125";
const WIERSZ_ZRODLO_B = "Wiersz źródło B 125";
const KLUCZ_A = "e2e-125a";
const KLUCZ_B = "e2e-125b";

test.describe.configure({ mode: "serial" });

async function przestrzenAdmina(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_ADMIN.email } });
  const ws = await prisma.workspace.findFirst({ where: { personalUserId: user.id } });
  if (!ws) throw new Error("Konto e2e-admin nie ma przestrzeni osobistej");
  return ws.id;
}

async function zapewnijZrodlo(workspaceId: string, key: string, name: string) {
  return prisma.newsSource.upsert({
    where: { workspaceId_key: { workspaceId, key } },
    create: {
      key,
      name,
      rssUrl: `https://example.com/rss-${key}`,
      homepageUrl: "https://example.com",
      workspaceId,
    },
    update: {},
  });
}

test.beforeAll(async () => {
  const workspaceId = await przestrzenAdmina();

  const stary = await prisma.newsTopic.findFirst({ where: { workspaceId, title: TEMAT } });
  if (stary) await prisma.newsTopic.delete({ where: { id: stary.id } });

  const zrodloA = await zapewnijZrodlo(workspaceId, KLUCZ_A, "Źródło 125A");
  const zrodloB = await zapewnijZrodlo(workspaceId, KLUCZ_B, "Źródło 125B");

  const temat = await prisma.newsTopic.create({
    data: { title: TEMAT, semanticFilter: TEMAT, workspaceId },
  });
  await prisma.newsItem.createMany({
    data: [
      {
        topicId: temat.id,
        sourceId: zrodloA.id,
        url: "https://example.com/125/a1",
        title: WIERSZ_ODKLADANY,
        summary: "Streszczenie pozycji odkładanej.",
        publishedAt: new Date(),
        status: "PENDING",
      },
      {
        topicId: temat.id,
        sourceId: zrodloA.id,
        url: "https://example.com/125/a2",
        title: WIERSZ_ZWYKLY,
        summary: "Streszczenie pozycji zwykłej.",
        publishedAt: new Date(Date.now() - 60_000),
        status: "PENDING",
      },
      {
        topicId: temat.id,
        sourceId: zrodloB.id,
        url: "https://example.com/125/b1",
        title: WIERSZ_ZRODLO_B,
        summary: "Streszczenie pozycji ze źródła B.",
        publishedAt: new Date(Date.now() - 120_000),
        status: "PENDING",
      },
    ],
  });
});

async function otworz(page: import("@playwright/test").Page, adres: string, tytul: string) {
  await page.goto(adres);
  await page.waitForLoadState("load").catch(() => {});
  await expect(page.getByText(tytul).first()).toBeVisible({ timeout: 20_000 });
}

function wiersz(page: import("@playwright/test").Page, tytul: string) {
  return page.locator("[data-news-wiersz]", { hasText: tytul });
}

function przelacznikTytulow(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: /widok samych tytułów|Wróć do pełnych wiadomości/i });
}

test("[125-AC1..AC5] przelacznik, oznaczanie wierszem, licznik, przejscie do odlozonych", async ({
  page,
}) => {
  await otworz(page, "/wiadomosci", WIERSZ_ODKLADANY);

  // AC-1: jeden gest wejścia — karty znikają, wiersze wchodzą, sekcje tematów zostają.
  await przelacznikTytulow(page).click();
  await expect(page).toHaveURL(/tytuly=1/);
  await expect(page.locator("[data-news-karta]")).toHaveCount(0);
  await expect(page.locator("[data-news-wiersz]")).toHaveCount(3);

  // AC-2 + AC-5: dotknięcie wiersza oznacza, stan widać natychmiast, licznik rośnie na bieżąco.
  const odkladany = wiersz(page, WIERSZ_ODKLADANY);
  await odkladany.getByRole("button").click();
  await expect(odkladany.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  const przejscie = page.getByRole("button", { name: "Przejdź do odłożonych" });
  await expect(przejscie).toContainText("1");

  // AC-3: otwarcie artykułu to OSOBNY element z adresem źródła — nie przełącza oznaczenia.
  await expect(odkladany.locator("a[href='https://example.com/125/a1']")).toBeVisible();

  // AC-2 (trwałość): zapis idzie w tle — dajemy mu chwilę, potem twardy reload.
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForLoadState("load").catch(() => {});
  await expect(wiersz(page, WIERSZ_ODKLADANY).getByRole("button")).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 20_000 },
  );

  // Odwracalność tym samym gestem — i z powrotem (stan potrzebny w AC-4).
  await wiersz(page, WIERSZ_ODKLADANY).getByRole("button").click();
  await expect(wiersz(page, WIERSZ_ODKLADANY).getByRole("button")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await wiersz(page, WIERSZ_ODKLADANY).getByRole("button").click();
  await expect(page.getByRole("button", { name: "Przejdź do odłożonych" })).toContainText("1");
  await page.waitForTimeout(800);

  // AC-4: jeden gest z triage'u do pełnego widoku samych odłożonych (zawężenie z 124).
  await page.getByRole("button", { name: "Przejdź do odłożonych" }).click();
  await expect(page).toHaveURL(/doczytania=1/);
  expect(page.url()).not.toMatch(/tytuly=1/);
  await expect(page.locator("[data-news-karta]")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("[data-news-karta]", { hasText: WIERSZ_ODKLADANY })).toHaveCount(1);
});

test("[125-AC6] adres z ?tytuly=1 odtwarza widok tytulow", async ({ page }) => {
  await otworz(page, "/wiadomosci?tytuly=1", WIERSZ_ZWYKLY);
  await expect(page.locator("[data-news-wiersz]")).toHaveCount(3);
  await expect(page.locator("[data-news-karta]")).toHaveCount(0);
  await expect(przelacznikTytulow(page)).toHaveAttribute("aria-pressed", "true");
});

test("[125-AC9] filtr zrodel zaweza identycznie w obu trybach", async ({ page }) => {
  // Tryb tytułów, tylko źródło A → dwa wiersze (bez pozycji ze źródła B).
  await otworz(page, `/wiadomosci?tytuly=1&zrodla=${KLUCZ_A}`, WIERSZ_ZWYKLY);
  await expect(page.locator("[data-news-wiersz]")).toHaveCount(2);
  await expect(wiersz(page, WIERSZ_ZRODLO_B)).toHaveCount(0);

  // Pełny widok, ten sam filtr → te same dwie pozycje jako karty.
  await otworz(page, `/wiadomosci?zrodla=${KLUCZ_A}`, WIERSZ_ZWYKLY);
  await expect(page.locator("[data-news-karta]")).toHaveCount(2);
  await expect(page.locator("[data-news-karta]", { hasText: WIERSZ_ZRODLO_B })).toHaveCount(0);
});

test("[125-AC7] telefon 360 px: wiersz to pelnowymiarowy cel dotyku, bez poziomego scrolla", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await otworz(page, "/wiadomosci?tytuly=1", WIERSZ_ZWYKLY);

  const przycisk = wiersz(page, WIERSZ_ZWYKLY).getByRole("button");
  const rozmiar = await przycisk.boundingBox();
  expect(rozmiar, "wiersz musi mieć wymiar").not.toBeNull();
  expect(rozmiar!.height).toBeGreaterThanOrEqual(44);

  const przewija = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(przewija).toBe(false);
});
