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
    const project = await prisma.taskProject.create({
      data: { name: `UX ${Date.now()}`, ownerId: user.id },
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
  test("[ux-AC20-AC21] checkbox ujawnia się przy myszy, ale NIE na dotyku", async ({ page, browser }) => {
    const { projectId } = await seedTask("Zadanie testowe A");

    const odczytajCheckbox = async (p: import("@playwright/test").Page) =>
      p.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Zaznacz zadanie"]') as HTMLElement | null;
        if (!btn) return null;
        const cs = getComputedStyle(btn);
        return {
          opacity: cs.opacity,
          pointerEvents: cs.pointerEvents,
          hoverHover: matchMedia("(hover: hover)").matches,
        };
      });

    // --- Wariant DOTYKOWY (AC-20) — zgłoszenie właściciela ---
    // Uzywamy PRAWDZIWEJ emulacji urzadzenia mobilnego w Chromium (Pixel 5). CDP
    // `Emulation.setEmulatedMedia` z cecha `hover` bylo ignorowane — `matchMedia("(hover: hover)")`
    // nadal zwracalo `true`, wiec test mierzyl w rzeczywistosci urzadzenie ze wskaznikiem.
    const { devices } = await import("@playwright/test");
    const touchCtx = await browser.newContext({
      ...devices["Pixel 5"],
      storageState: "e2e/.auth/admin.json",
      baseURL: "http://localhost:3000",
    });
    const touchPage = await touchCtx.newPage();
    try {
      await touchPage.goto(`/tasks/${projectId}`);
      await touchPage.waitForLoadState("networkidle").catch(() => {});
      const row = touchPage.getByText("Zadanie testowe A").first();
      await expect(row).toBeVisible({ timeout: 15_000 });

      // Dotkniecie tytulu w celu przewiniecia listy — dokladnie gest ze zgloszenia.
      await row.tap();
      await touchPage.waitForTimeout(400);

      const onTouch = await odczytajCheckbox(touchPage);
      console.log("[AC-20] dotyk →", JSON.stringify(onTouch));
      expect(onTouch).not.toBeNull();
      // Warunek wstepny: to naprawde urzadzenie BEZ wskaznika.
      expect(onTouch!.hoverHover).toBe(false);
      expect(Number(onTouch!.opacity)).toBe(0);
      expect(onTouch!.pointerEvents).toBe("none");
    } finally {
      await touchCtx.close();
    }

    // --- Wariant MYSZY (AC-21) — zachowanie ma zostać jak było ---
    await page.goto(`/tasks/${projectId}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByText("Zadanie testowe A").first().hover();
    await page.waitForTimeout(400);

    const onMouse = await odczytajCheckbox(page);
    console.log("[AC-21] mysz →", JSON.stringify(onMouse));
    expect(onMouse!.hoverHover).toBe(true);
    expect(Number(onMouse!.opacity)).toBe(1);
    expect(onMouse!.pointerEvents).not.toBe("none");
  });

  test("[ux-AC23] pole opisu rozciąga się bez wewnętrznego przewijania", async ({ page }) => {
    // JEDEN akapit bez znaków nowej linii — dokładnie przypadek, którego stary `rows` nie widział.
    const longText = "Bardzo dlugi opis zadania. ".repeat(60).trim();
    const { projectId, taskId } = await seedTask("Zadanie z dlugim opisem", longText);

    await page.goto(`/tasks/${projectId}?task=${taskId}`);
    await page.waitForLoadState("networkidle").catch(() => {});

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
