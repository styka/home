import { test, expect } from "../fixtures/test";

/**
 * 080 (Z3) — REGRESJA, której brak przepuścił zgłoszony błąd.
 *
 * Zgłoszenie: „gdy mamy na widoku grupę projektów i zmienimy jakiemuś zadaniu status, to naraz
 * z widoku znikają projekty, jakby grupa projektów była pusta". Widok pokazywał wtedy nagłówek
 * „🗂 Wiele projektów (0)".
 *
 * Ten plik pilnuje trzech rzeczy naraz: że zakres przeżywa mutację (AC-4), że stare adresy dalej
 * otwierają ten sam zakres (AC-6) i że wyczyszczenie zakresu pokazuje wszystko, a nie nic.
 */

/** Dwa projekty z zadaniami plus zapisany zestaw obejmujący oba. */
async function seedZestaw() {
  const { PrismaClient } = await import("@prisma/client");
  const { E2E_ADMIN } = await import("../fixtures/users");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_ADMIN.email } });
    const przestrzen = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: user.id } });
    const stempel = Date.now();

    const a = await prisma.taskProject.create({ data: { name: `Zestaw A ${stempel}`, workspaceId: przestrzen.id } });
    const b = await prisma.taskProject.create({ data: { name: `Zestaw B ${stempel}`, workspaceId: przestrzen.id } });

    await prisma.task.create({ data: { title: `Alfa ${stempel}`, projectId: a.id, createdById: user.id } });
    await prisma.task.create({ data: { title: `Beta ${stempel}`, projectId: b.id, createdById: user.id } });

    // ProjectGroup jest zmapowana na tabelę TaskView; projectIds to JSON string[].
    const grupa = await prisma.projectGroup.create({
      data: {
        name: `Grupa ${stempel}`,
        emoji: "🗂",
        projectIds: JSON.stringify([a.id, b.id]),
        workspaceId: przestrzen.id,
      },
    });

    return { grupaId: grupa.id, projektA: a.id, projektB: b.id, stempel };
  } finally {
    await prisma.$disconnect();
  }
}

test.describe("080 — zakres widoku zadań", () => {
  test("[080-AC4] zmiana statusu zadania NIE czyści widoku zestawu", async ({ page }) => {
    const { grupaId, stempel } = await seedZestaw();

    await page.goto(`/tasks/zestaw/${grupaId}`);
    await page.waitForLoadState("load").catch(() => {});

    const alfa = page.getByText(`Alfa ${stempel}`).first();
    const beta = page.getByText(`Beta ${stempel}`).first();
    await expect(alfa).toBeVisible({ timeout: 15_000 });
    await expect(beta).toBeVisible();

    // Zmiana statusu przez skrót `x` na zogniskowanym zadaniu — to jest gest ze zgłoszenia.
    await alfa.click();
    await page.keyboard.press("Escape");
    await alfa.hover();
    await page.keyboard.press("x");
    await page.waitForTimeout(1200);

    // SEDNO: po mutacji widok nadal zna swój zakres.
    await expect(page.getByText("Wiele projektów (0)")).toHaveCount(0);
    await expect(beta).toBeVisible({ timeout: 15_000 });
  });

  test("[080-AC6] stary adres /tasks/multi?group= otwiera ten sam zakres", async ({ page }) => {
    const { grupaId, stempel } = await seedZestaw();

    // Dokładnie ten adres właściciel ma zapisany w ulubionych widokach.
    await page.goto(`/tasks/multi?group=${grupaId}`);
    await page.waitForLoadState("load").catch(() => {});

    await expect(page).toHaveURL(new RegExp(`/tasks/zestaw/${grupaId}`), { timeout: 15_000 });
    await expect(page.getByText(`Alfa ${stempel}`).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Beta ${stempel}`).first()).toBeVisible();
  });

  test("[080-AC6] stary adres bez zakresu prowadzi do wszystkich zadań, nie do pustki", async ({ page }) => {
    const { stempel } = await seedZestaw();

    // To był najgorszy przypadek: brak parametru = zero projektów = pusty ekran.
    await page.goto("/tasks/multi");
    await page.waitForLoadState("load").catch(() => {});

    await expect(page).toHaveURL(/\/tasks\/all/, { timeout: 15_000 });
    await expect(page.getByText(`Alfa ${stempel}`).first()).toBeVisible({ timeout: 15_000 });
  });
});
