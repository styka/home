import { test } from "node:test";
import assert from "node:assert/strict";

// Z-051/Z-172/Z-174: twarde usunięcie danych użytkownika (RODO art. 17).
// DB-gated — sprawdza, że purgeUserData kasuje WSZYSTKIE dane usera (też SET-NULL,
// które inaczej zostałyby osierocone) i NIE rusza danych innych userów.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-051 purgeUserData: kasuje dane usera (w tym SET-NULL), izolacja innych zachowana", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { purgeUserData } = await import("@/lib/privacy/purge");

  const A = await prisma.user.create({ data: { email: `purge-a-${rnd()}@test.local` } });
  const B = await prisma.user.create({ data: { email: `purge-b-${rnd()}@test.local` } });

  // Treści A (mieszanka SET-NULL i CASCADE):
  const proj = await prisma.taskProject.create({ data: { name: "P", ownerId: A.id } });
  await prisma.task.create({ data: { title: "t", projectId: proj.id, createdById: A.id } });
  await prisma.note.create({ data: { title: "n", ownerId: A.id } });
  await prisma.shoppingList.create({ data: { name: "l", ownerId: A.id } });
  await prisma.recipe.create({ data: { title: "r", slug: `r-${rnd()}`, ownerId: A.id } });
  // Dane B — kontrola izolacji
  await prisma.note.create({ data: { title: "B-note", ownerId: B.id } });

  try {
    await purgeUserData(A.id);

    await t.test("user A i jego dane skasowane (brak sierot SET-NULL)", async () => {
      assert.equal(await prisma.user.count({ where: { id: A.id } }), 0);
      assert.equal(await prisma.note.count({ where: { ownerId: A.id } }), 0);
      assert.equal(await prisma.recipe.count({ where: { ownerId: A.id } }), 0);
      assert.equal(await prisma.shoppingList.count({ where: { ownerId: A.id } }), 0);
      assert.equal(await prisma.taskProject.count({ where: { ownerId: A.id } }), 0);
      assert.equal(await prisma.task.count({ where: { createdById: A.id } }), 0);
    });

    await t.test("dane usera B nietknięte (izolacja)", async () => {
      assert.equal(await prisma.user.count({ where: { id: B.id } }), 1);
      assert.equal(await prisma.note.count({ where: { ownerId: B.id } }), 1);
    });
  } finally {
    await prisma.note.deleteMany({ where: { ownerId: B.id } });
    await prisma.user.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  }
});
