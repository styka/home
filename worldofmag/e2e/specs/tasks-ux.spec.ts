import { test, expect } from "../fixtures/test";

/**
 * 042 — weryfikacja zgłoszonych usterek w Zadaniach (AC-20..AC-23).
 *
 * Kluczowa sztuczka: `@media (hover: hover)` emulujemy przez CDP
 * (`Emulation.setEmulatedMedia`), bo tylko tak da się w jednym Chromium sprawdzić OBA warianty —
 * urządzenie dotykowe (hover: none) i wskaźnik myszy (hover: hover).
 */

/** Tworzy projekt z jednym zadaniem i zwraca ich identyfikatory. */
async function seedTask(title: string, description?: string) {
  const { PrismaClient } = await import("@prisma/client");
  const { E2E_ADMIN } = await import("../fixtures/users");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_ADMIN.email } });
    const przestrzen = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: user.id } });
    const project = await prisma.taskProject.create({
      // 098: przestrzeń bierzemy zapytaniem, a NIE przez `wlasnoscOsobistaDoZapisu` z aplikacji.
      // Spec Playwrighta jest transpilowany, ale moduł zaimportowany z niego dynamicznie już nie —
      // `await import("@/platform/...")` kończy się „Cannot use import statement outside a module".
      // Fikstura ma być samowystarczalna: zna schemat, nie kod aplikacji.
      data: { name: `UX ${Date.now()}`, workspaceId: przestrzen.id },
    });
    const task = await prisma.task.create({
      data: { title, description: description ?? null, projectId: project.id, createdById: user.id },
    });
    return { projectId: project.id, taskId: task.id };
  } finally {
    await prisma.$disconnect();
  }
}

test.describe("042 — usterki w Zadaniach", () => {
  test("[080-AC1] kolumna zaznaczeń pojawia się i ZNIKA razem z trybem zaznaczania", async ({ page }) => {
    /**
     * 080 (Z1) ZASTĘPUJE test [ux-AC20-AC21] z 042.
     *
     * 042 sprawdzało, że checkbox ujawnia się przy najechaniu myszą, a na dotyku nie. Właściciel
     * zgłosił potem, że chce czegoś innego: ikona trybu ma UKRYWAĆ I ODKRYWAĆ kolumnę, a nie tylko
     * blokować zaznaczanie. Ujawnianie przy najechaniu było właśnie powodem, dla którego checkbox
     * musiał się renderować zawsze (z `opacity-0`) i zajmować 20 px w każdym wierszu.
     *
     * Dlatego stary test nie jest „naprawiany" — jest zastąpiony testem nowej reguły. Asercja idzie
     * na OBECNOŚĆ W DOM, nie na przezroczystość: „ukryta kolumna" znaczy brak elementu, bo
     * `opacity: 0` chowa piksele, a nie układ.
     */
    const { projectId } = await seedTask("Zadanie testowe A");

    await page.goto(`/tasks/${projectId}`);
    await page.waitForLoadState("load").catch(() => {});
    await expect(page.getByText("Zadanie testowe A").first()).toBeVisible({ timeout: 15_000 });

    const checkboxy = page.locator('button[aria-label="Zaznacz zadanie"]');
    const przelacznik = page.getByRole("button", { name: /zaznacz wiele/i }).first();

    // Poza trybem: kolumny NIE MA w drzewie. Najechanie myszą też jej nie przywraca.
    await page.getByText("Zadanie testowe A").first().hover();
    await page.waitForTimeout(300);
    expect(await checkboxy.count()).toBe(0);

    // Włączenie trybu odsłania kolumnę.
    await przelacznik.click();
    await expect(checkboxy.first()).toBeVisible({ timeout: 10_000 });

    // Wyłączenie trybu chowa ją z powrotem — w całości.
    await przelacznik.click();
    await page.waitForTimeout(300);
    expect(await checkboxy.count()).toBe(0);
  });

  test("[ux-AC23] pole opisu rozciąga się bez wewnętrznego przewijania", async ({ page }) => {
    // JEDEN akapit bez znaków nowej linii — dokładnie przypadek, którego stary `rows` nie widział.
    const longText = "Bardzo dlugi opis zadania. ".repeat(60).trim();
    const { projectId, taskId } = await seedTask("Zadanie z dlugim opisem", longText);

    await page.goto(`/tasks/${projectId}?task=${taskId}`);
    await page.waitForLoadState("load").catch(() => {});

    // Otwieramy szczegóły zadania i wchodzimy w edycję opisu (klik w wyrenderowany markdown).
    await page.getByText("Zadanie z dlugim opisem").first().click();
    const rendered = page.locator("div.cursor-text").filter({ hasText: "Bardzo dlugi opis" }).first();
    await expect(rendered).toBeVisible({ timeout: 15_000 });
    await rendered.click();

    const ta = page.locator("textarea").first();
    await expect(ta).toBeVisible({ timeout: 10_000 });

    const m = await ta.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return { scrollHeight: t.scrollHeight, clientHeight: t.clientHeight, maxAllowed: Math.round(window.innerHeight * 0.6) };
    });
    console.log("[AC-23] pole opisu →", JSON.stringify(m));

    // Pole ma wysokość treści (z tolerancją 2px) albo osiągnęło sufit 60vh.
    const dopasowane = Math.abs(m.scrollHeight - m.clientHeight) <= 2;
    const przySuficie = m.clientHeight >= m.maxAllowed - 2;
    expect(dopasowane || przySuficie).toBe(true);
    // I na pewno jest znacznie wyższe niż domyślne 3 wiersze (~72 px).
    expect(m.clientHeight).toBeGreaterThan(100);
  });
});
