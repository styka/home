import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 079 (zadanie 11, etap 4 część 3) — RÓWNOWAŻNOŚĆ „DOSTĘPNE ZESPOŁY" ⟷ „DOSTĘPNE PRZESTRZENIE".
 *
 * Guardy rekordu w dziewiętnastu modułach zamieniają dziś warunek
 * `ownerId === ja || dostepneZespoly.includes(ownerTeamId)` na `dostepnePrzestrzenie.includes(
 * workspaceId)`. Jeśli te dwa zbiory nie są tym samym, przełączenie **po cichu poszerza albo
 * zawęża** dostęp — a u konta bez ograniczeń wyjdą identyczne, więc pomyłki nie widać.
 *
 * Dlatego test porównuje ZBIORY na prawdziwych danych i ma **przypadek różnicujący**: domownik
 * z odebranym dostępem do modułu. Sonda: podmiana `getAccessibleWorkspaceIds` na szerszy wariant
 * (wszystkie moje przestrzenie) czerwieni dokładnie ten przypadek.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "dostępne przestrzenie = przestrzeń osobista + przestrzenie zespołów dostępnych dla modułu",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { getAccessibleTeamIds, getAccessibleWorkspaceIds } = await import(
      "@/platform/auth/serverUtils"
    );
    const { serializeModuleAccess } = await import("@/lib/teams/memberAccess");
    const { ensurePersonalWorkspace, syncTeamWorkspace } = await import(
      "@/platform/workspaces/sync"
    );

    const rodzic = await prisma.user.create({ data: { email: `aw-r-${rnd()}@test.local` } });
    const dziecko = await prisma.user.create({ data: { email: `aw-d-${rnd()}@test.local` } });
    const zespol = await prisma.team.create({
      data: {
        name: `AW-${rnd()}`,
        ownerId: rodzic.id,
        members: {
          create: [
            { userId: rodzic.id, role: "OWNER" },
            { userId: dziecko.id, role: "MEMBER" },
          ],
        },
      },
    });
    await ensurePersonalWorkspace(rodzic.id);
    await ensurePersonalWorkspace(dziecko.id);
    await syncTeamWorkspace(zespol.id);

    /** Zbiór policzony **niezależnie** — ze starej reguły, przez lustro. To jest punkt odniesienia. */
    async function zeStarejReguly(userId: string, moduleId: string): Promise<string[]> {
      const teamIds = await getAccessibleTeamIds(userId, moduleId);
      const osobista = await prisma.workspace.findUnique({
        where: { personalUserId: userId },
        select: { id: true },
      });
      const zespolowe = await prisma.workspace.findMany({
        where: { teamId: { in: teamIds } },
        select: { id: true },
      });
      return [...(osobista ? [osobista.id] : []), ...zespolowe.map((w) => w.id)].sort();
    }

    const zbior = async (userId: string, moduleId: string) =>
      (await getAccessibleWorkspaceIds(userId, moduleId)).sort();

    try {
      await t.test("bez ograniczeń: oba zbiory identyczne i zawierają przestrzeń zespołu", async () => {
        for (const m of ["shopping", "portfel", "magazynowanie"]) {
          assert.deepEqual(await zbior(dziecko.id, m), await zeStarejReguly(dziecko.id, m), m);
        }
        assert.equal((await zbior(dziecko.id, "shopping")).length, 2, "osobista + zespołowa");
      });

      await prisma.teamMember.update({
        where: { teamId_userId: { teamId: zespol.id, userId: dziecko.id } },
        data: { moduleAccess: serializeModuleAccess(["tasks"]) },
      });

      await t.test("PRZYPADEK RÓŻNICUJĄCY: odebrany moduł zabiera przestrzeń zespołu", async () => {
        const dozwolony = await zbior(dziecko.id, "tasks");
        const zablokowany = await zbior(dziecko.id, "shopping");
        assert.equal(dozwolony.length, 2, "moduł dozwolony: osobista + zespołowa");
        assert.equal(zablokowany.length, 1, "moduł zablokowany: ZOSTAJE sama osobista");
        assert.deepEqual(zablokowany, await zeStarejReguly(dziecko.id, "shopping"));
        // Gdyby ktoś podmienił tę funkcję na „wszystkie moje przestrzenie", ten wiersz padnie:
        // surowe członkostwo w przestrzeni zespołu nadal istnieje, bo lustro nie zna `moduleAccess`.
        const czlonkostwa = await prisma.workspaceMember.count({ where: { userId: dziecko.id } });
        assert.equal(czlonkostwa, 2, "lustro nadal zna oba członkostwa — zawężenie robi guard, nie lustro");
      });

      await t.test("rodzic (OWNER) nie daje się ograniczyć", async () => {
        for (const m of ["shopping", "portfel"]) {
          assert.deepEqual(await zbior(rodzic.id, m), await zeStarejReguly(rodzic.id, m), m);
          assert.equal((await zbior(rodzic.id, m)).length, 2, m);
        }
      });
    } finally {
      await prisma.team.delete({ where: { id: zespol.id } }).catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: [rodzic.id, dziecko.id] } } })
        .catch(() => {});
    }
  },
);
