import { test, expect } from "../fixtures/test";

/**
 * 080 (Z3) → 125 — zakres widoku wieloprojektowego, po zamianie grup na OBSZARY.
 *
 * Pilnuje czterech rzeczy: że zakres obszaru przeżywa mutację zadania (080-AC4), że STARE adresy
 * (`/tasks/multi?group=` i `/tasks/zestaw/<id>` — zapisane w ulubionych) dalej otwierają ten sam
 * zakres przez łańcuch przekierowań (125-AC3), że zakres obejmuje PODDRZEWO obszaru aż do liści
 * (125-AC2/AC-6) i że brak zakresu pokazuje wszystko, a nie nic.
 */

/** Obszar z dwoma projektami (+ pod-obszar z trzecim) i zadaniami. */
async function seedObszar() {
  const { PrismaClient } = await import("@prisma/client");
  const { E2E_ADMIN } = await import("../fixtures/users");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_ADMIN.email } });
    const przestrzen = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: user.id } });
    const stempel = Date.now();

    const a = await prisma.taskProject.create({ data: { name: `Obszar A ${stempel}`, workspaceId: przestrzen.id } });
    const b = await prisma.taskProject.create({ data: { name: `Obszar B ${stempel}`, workspaceId: przestrzen.id } });
    const c = await prisma.taskProject.create({ data: { name: `Obszar C ${stempel}`, workspaceId: przestrzen.id } });

    await prisma.task.create({ data: { title: `Alfa ${stempel}`, projectId: a.id, createdById: user.id } });
    await prisma.task.create({ data: { title: `Beta ${stempel}`, projectId: b.id, createdById: user.id } });
    await prisma.task.create({ data: { title: `Gamma ${stempel}`, projectId: c.id, createdById: user.id } });

    // ProjectArea jest zmapowana na tabelę TaskView (125: te same wiersze co dawne grupy).
    const obszar = await prisma.projectArea.create({
      data: { name: `Obszar ${stempel}`, emoji: "🗂", workspaceId: przestrzen.id },
    });
    const podobszar = await prisma.projectArea.create({
      data: { name: `Pod ${stempel}`, emoji: "🌿", parentId: obszar.id, workspaceId: przestrzen.id },
    });
    await prisma.taskProject.update({ where: { id: a.id }, data: { areaId: obszar.id } });
    await prisma.taskProject.update({ where: { id: b.id }, data: { areaId: obszar.id } });
    // Gamma wisi w POD-obszarze — widok rodzica musi ją objąć (zakres = poddrzewo do liści).
    await prisma.taskProject.update({ where: { id: c.id }, data: { areaId: podobszar.id } });

    return { obszarId: obszar.id, stempel };
  } finally {
    await prisma.$disconnect();
  }
}

test.describe("080/125 — zakres widoku zadań (obszary)", () => {
  test("[080-AC4] zmiana statusu zadania NIE czyści widoku obszaru", async ({ page }) => {
    const { obszarId, stempel } = await seedObszar();

    await page.goto(`/tasks/obszar/${obszarId}`);
    await page.waitForLoadState("load").catch(() => {});

    const alfa = page.getByText(`Alfa ${stempel}`).first();
    const beta = page.getByText(`Beta ${stempel}`).first();
    await expect(alfa).toBeVisible({ timeout: 15_000 });
    await expect(beta).toBeVisible();

    // Zmiana statusu przez skrót `x` na zogniskowanym zadaniu — to jest gest ze zgłoszenia 080.
    await alfa.click();
    await page.keyboard.press("Escape");
    await alfa.hover();
    await page.keyboard.press("x");
    await page.waitForTimeout(1200);

    // SEDNO: po mutacji widok nadal zna swój zakres.
    await expect(page.getByText("Wiele projektów (0)")).toHaveCount(0);
    await expect(beta).toBeVisible({ timeout: 15_000 });
  });

  test("[125-AC2] widok obszaru obejmuje zadania POD-obszaru (poddrzewo do liści)", async ({ page }) => {
    const { obszarId, stempel } = await seedObszar();

    await page.goto(`/tasks/obszar/${obszarId}`);
    await page.waitForLoadState("load").catch(() => {});

    await expect(page.getByText(`Alfa ${stempel}`).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Gamma ${stempel}`).first()).toBeVisible();
  });

  test("[125-AC3] stary adres /tasks/multi?group= dojeżdża do widoku obszaru", async ({ page }) => {
    const { obszarId, stempel } = await seedObszar();

    // Dokładnie ten adres właściciel ma zapisany w ulubionych widokach (multi → zestaw → obszar).
    await page.goto(`/tasks/multi?group=${obszarId}`);
    await page.waitForLoadState("load").catch(() => {});

    await expect(page).toHaveURL(new RegExp(`/tasks/obszar/${obszarId}`), { timeout: 15_000 });
    await expect(page.getByText(`Alfa ${stempel}`).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Beta ${stempel}`).first()).toBeVisible();
  });

  test("[125-AC3] stary adres /tasks/zestaw/<id> dojeżdża do widoku obszaru", async ({ page }) => {
    const { obszarId, stempel } = await seedObszar();

    await page.goto(`/tasks/zestaw/${obszarId}`);
    await page.waitForLoadState("load").catch(() => {});

    await expect(page).toHaveURL(new RegExp(`/tasks/obszar/${obszarId}`), { timeout: 15_000 });
    await expect(page.getByText(`Alfa ${stempel}`).first()).toBeVisible({ timeout: 15_000 });
  });

  test("[080-AC6] stary adres bez zakresu prowadzi do wszystkich zadań, nie do pustki", async ({ page }) => {
    const { stempel } = await seedObszar();

    // To był najgorszy przypadek: brak parametru = zero projektów = pusty ekran.
    await page.goto("/tasks/multi");
    await page.waitForLoadState("load").catch(() => {});

    await expect(page).toHaveURL(/\/tasks\/all/, { timeout: 15_000 });
    await expect(page.getByText(`Alfa ${stempel}`).first()).toBeVisible({ timeout: 15_000 });
  });
});
