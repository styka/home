import { test } from "node:test";
import assert from "node:assert/strict";

// Z-194 (T-04) — usunięcie konta WŁAŚCICIELA zespołu: auto-transfer własności na
// następcę albo usunięcie zespołu „solo" wraz z zasobami. DB-gated.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-194 deleteMyAccount: właściciel z innymi członkami → transfer własności na następcę", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { purgeUserData } = await import("@/lib/privacy/purge");

  const owner = await prisma.user.create({ data: { email: `t4-owner-${rnd()}@test.local` } });
  const memberOld = await prisma.user.create({ data: { email: `t4-old-${rnd()}@test.local` } });
  const adminYoung = await prisma.user.create({ data: { email: `t4-adm-${rnd()}@test.local` } });

  const team = await prisma.team.create({
    data: {
      name: `T-${rnd()}`,
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "OWNER", joinedAt: new Date("2020-01-01") },
          { userId: memberOld.id, role: "MEMBER", joinedAt: new Date("2020-06-01") },
          { userId: adminYoung.id, role: "ADMIN", joinedAt: new Date("2023-01-01") },
        ],
      },
    },
  });
  // Zasób zespołu (ownerTeamId) — musi przeżyć transfer.
  const list = await prisma.shoppingList.create({ data: { name: "wspólna", ownerTeamId: team.id } });

  try {
    await purgeUserData(owner.id);

    await t.test("zespół przeżywa, własność u najstarszego ADMIN-a (nie u starszego MEMBER-a)", async () => {
      const after = await prisma.team.findUnique({ where: { id: team.id } });
      assert.ok(after, "zespół istnieje");
      assert.equal(after!.ownerId, adminYoung.id, "ADMIN ma pierwszeństwo nad starszym MEMBER-em");
      const succ = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: team.id, userId: adminYoung.id } } });
      assert.equal(succ?.role, "OWNER", "następca dostaje rolę OWNER");
    });

    await t.test("zasoby zespołu i pozostali członkowie nietknięci; właściciel usunięty", async () => {
      assert.equal(await prisma.shoppingList.count({ where: { id: list.id } }), 1, "lista zespołu przeżywa");
      assert.equal(await prisma.user.count({ where: { id: owner.id } }), 0, "właściciel usunięty");
      assert.equal(await prisma.teamMember.count({ where: { teamId: team.id, userId: owner.id } }), 0, "membership właściciela skasowane");
      assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 2, "zostają 2 osoby");
    });
  } finally {
    await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [memberOld.id, adminYoung.id, owner.id] } } }).catch(() => {});
  }
});

test("Z-194 deleteMyAccount: zespół solo (właściciel = jedyny członek) usuwany wraz z zasobami", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { purgeUserData } = await import("@/lib/privacy/purge");

  const owner = await prisma.user.create({ data: { email: `t4-solo-${rnd()}@test.local` } });
  const team = await prisma.team.create({
    data: { name: `S-${rnd()}`, ownerId: owner.id, members: { create: [{ userId: owner.id, role: "OWNER" }] } },
  });
  const list = await prisma.shoppingList.create({ data: { name: "solo-lista", ownerTeamId: team.id } });

  try {
    await purgeUserData(owner.id);

    await t.test("zespół solo i jego zasoby skasowane (ownerTeam=Cascade)", async () => {
      assert.equal(await prisma.team.count({ where: { id: team.id } }), 0, "zespół solo usunięty");
      assert.equal(await prisma.shoppingList.count({ where: { id: list.id } }), 0, "zasób zespołu skasowany kaskadowo");
      assert.equal(await prisma.user.count({ where: { id: owner.id } }), 0, "właściciel usunięty");
    });
  } finally {
    await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
  }
});
