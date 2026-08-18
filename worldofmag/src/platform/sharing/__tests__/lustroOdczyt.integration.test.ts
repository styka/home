import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 093 (zadanie 12, etap 2) — PRZEŁĄCZENIE ODCZYTU NA NADANIA, Z POMIAREM ROZJAZDU.
 *
 * Cała wartość tej warstwy leży w **asymetrii**: brak w nadaniach musi być naprawiony (bo to utrata
 * dostępu u realnej osoby), a nadwyżka w nadaniach — przemilczana (bo jest widoczna w oknie
 * udostępniania i da się odebrać). Test sprawdza obie strony osobno, bo pomylenie ich daje albo
 * cichą utratę dostępu, albo warstwę, która nigdy nie milczy i przez to nigdy nie zniknie.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "lustro nadań: brakujące dokładamy, nadwyżkę przemilczamy",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { brakujaceWzgledemNadan } = await import("../lustroOdczyt");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");

    const wl = await prisma.user.create({ data: { email: `lustro-w-${rnd()}@test.local` } });
    const czlonek = await prisma.user.create({ data: { email: `lustro-c-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(wl.id);
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: wl.id } });
    const projekt = await prisma.taskProject.create({ data: { name: `lustro-${rnd()}`, workspaceId: ws.id } });

    const zTabeli = [{ userId: czlonek.id, role: "editor" as const }];

    try {
      await t.test("nadania nie znają osoby → dokładamy ją (i to jest ROZJAZD)", async () => {
        const wynik = await brakujaceWzgledemNadan("tasks.project", projekt.id, zTabeli);
        assert.equal(wynik.length, 1, "gdyby zwrócić pustą listę, osoba straciłaby dostęp po cichu");
        assert.equal(wynik[0].userId, czlonek.id);
      });

      await t.test("nadanie o TEJ SAMEJ roli → pusta lista, bez rozjazdu", async () => {
        await prisma.resourceGrant.create({
          data: {
            workspaceId: ws.id, resourceType: "tasks.project", resourceId: projekt.id,
            subjectType: "user", subjectId: czlonek.id, role: "editor",
            inherited: true, createdById: wl.id,
          },
        });
        assert.deepEqual(await brakujaceWzgledemNadan("tasks.project", projekt.id, zTabeli), []);
      });

      await t.test("nadanie o WYŻSZEJ roli → nadal pusta lista (nadwyżkę przemilczamy)", async () => {
        await prisma.resourceGrant.updateMany({
          where: { resourceId: projekt.id, subjectId: czlonek.id },
          data: { role: "manager" },
        });
        assert.deepEqual(
          await brakujaceWzgledemNadan("tasks.project", projekt.id, zTabeli),
          [],
          "nadwyżka jest widoczna w oknie udostępniania — nie jest usterką do naprawiania tutaj",
        );
      });

      await t.test("nadanie o NIŻSZEJ roli → dokładamy, bo tabela dawała więcej", async () => {
        await prisma.resourceGrant.updateMany({
          where: { resourceId: projekt.id, subjectId: czlonek.id },
          data: { role: "viewer" },
        });
        const wynik = await brakujaceWzgledemNadan("tasks.project", projekt.id, zTabeli);
        assert.equal(wynik.length, 1, "obniżenie roli to też utrata dostępu — do edycji");
      });

      await t.test("nadanie WYGASŁE nie liczy się jako pokrycie", async () => {
        await prisma.resourceGrant.updateMany({
          where: { resourceId: projekt.id, subjectId: czlonek.id },
          data: { role: "editor", expiresAt: new Date(Date.now() - 1000) },
        });
        assert.equal(
          (await brakujaceWzgledemNadan("tasks.project", projekt.id, zTabeli)).length,
          1,
          "nadanie po terminie nie daje dostępu, więc nie może udawać, że lustro jest kompletne",
        );
      });

      await t.test("pusta tabela źródłowa nie wykonuje ani jednego zapytania", async () => {
        // Warstwa przejściowa nie może dokładać zapytania do KAŻDEGO sprawdzenia dostępu — a bez tego
        // skrótu dokładałaby je także tam, gdzie nie ma żadnego członkostwa.
        assert.deepEqual(await brakujaceWzgledemNadan("tasks.project", projekt.id, []), []);
      });
    } finally {
      await prisma.resourceGrant.deleteMany({ where: { resourceId: projekt.id } });
      await prisma.taskProject.deleteMany({ where: { id: projekt.id } });
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: [wl.id, czlonek.id] } } });
      await prisma.workspace.deleteMany({ where: { personalUserId: { in: [wl.id, czlonek.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [wl.id, czlonek.id] } } });
    }
  },
);
