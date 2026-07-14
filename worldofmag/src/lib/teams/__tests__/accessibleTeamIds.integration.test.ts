import { test } from "node:test";
import assert from "node:assert/strict";

// Z-194 (T-12) — egzekwowanie granularnego dostępu domownika: `getAccessibleTeamIds`
// (prymityw, którego używają wszystkie listujące gettery modułów team-aware). DB-gated.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-194 getAccessibleTeamIds: dziecko z ograniczeniem nie widzi zespołu dla zablokowanego modułu", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { getAccessibleTeamIds, getUserTeamIds } = await import("@/lib/server-utils");
  const { serializeModuleAccess } = await import("@/lib/teams/memberAccess");

  const parent = await prisma.user.create({ data: { email: `acc-p-${rnd()}@test.local` } });
  const child = await prisma.user.create({ data: { email: `acc-c-${rnd()}@test.local` } });
  const team = await prisma.team.create({
    data: {
      name: `Fam-${rnd()}`,
      ownerId: parent.id,
      members: { create: [
        { userId: parent.id, role: "OWNER" },
        { userId: child.id, role: "MEMBER" },
      ] },
    },
  });

  try {
    await t.test("bez ograniczeń: dziecko widzi zespół dla każdego modułu (= getUserTeamIds)", async () => {
      assert.deepEqual(await getAccessibleTeamIds(child.id, "shopping"), [team.id]);
      assert.deepEqual(await getAccessibleTeamIds(child.id, "portfel"), [team.id]);
      assert.deepEqual(await getUserTeamIds(child.id), [team.id]);
    });

    // Rodzic ogranicza dziecko do samych „tasks".
    await prisma.teamMember.update({
      where: { teamId_userId: { teamId: team.id, userId: child.id } },
      data: { moduleAccess: serializeModuleAccess(["tasks"]) },
    });

    await t.test("po ograniczeniu: zespół znika dla zablokowanych modułów, zostaje dla dozwolonych", async () => {
      assert.deepEqual(await getAccessibleTeamIds(child.id, "tasks"), [team.id], "dozwolony moduł widoczny");
      assert.deepEqual(await getAccessibleTeamIds(child.id, "shopping"), [], "zablokowany moduł — zespół ukryty");
      assert.deepEqual(await getAccessibleTeamIds(child.id, "portfel"), [], "zablokowany moduł — zespół ukryty");
      // getUserTeamIds (bez modułu) nadal zwraca pełny zbiór — to surowe członkostwo.
      assert.deepEqual(await getUserTeamIds(child.id), [team.id]);
    });

    await t.test("rodzic (OWNER) zawsze widzi zespół niezależnie od modułu", async () => {
      assert.deepEqual(await getAccessibleTeamIds(parent.id, "shopping"), [team.id]);
      assert.deepEqual(await getAccessibleTeamIds(parent.id, "portfel"), [team.id]);
    });
  } finally {
    await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [parent.id, child.id] } } }).catch(() => {});
  }
});
