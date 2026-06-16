import { test } from "node:test";
import assert from "node:assert/strict";
import { keysetQuery, keysetResult } from "../pagination";

// Z-070/Z-174: keyset end-to-end z realnym kursorem Prisma (nie tylko czysty helper).
// Paginuje notatki usera; sprawdza brak duplikatów, kolejność i przejście hasMore.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-070 keyset + Prisma cursor: strony bez duplikatów, malejąco, hasMore poprawne", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.create({ data: { email: `pg-${rnd()}@test.local` } });

  try {
    // 5 notatek z rosnącym createdAt (sort malejący → najnowsza pierwsza).
    for (let i = 0; i < 5; i++) {
      await prisma.note.create({ data: { title: `n${i}`, ownerId: user.id, createdAt: new Date(Date.now() + i * 1000) } });
    }
    const page = async (cursor: string | null) => {
      const rows = await prisma.note.findMany({
        where: { ownerId: user.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...keysetQuery({ cursor, limit: 2 }),
      });
      return keysetResult(rows, 2);
    };

    const p1 = await page(null);
    const p2 = await page(p1.nextCursor);
    const p3 = await page(p2.nextCursor);

    await t.test("rozmiary stron i hasMore", () => {
      assert.equal(p1.items.length, 2); assert.equal(p1.hasMore, true);
      assert.equal(p2.items.length, 2); assert.equal(p2.hasMore, true);
      assert.equal(p3.items.length, 1); assert.equal(p3.hasMore, false);
      assert.equal(p3.nextCursor, null);
    });

    await t.test("brak duplikatów między stronami (pokrycie wszystkich 5)", () => {
      const ids = [...p1.items, ...p2.items, ...p3.items].map((n) => n.id);
      assert.equal(new Set(ids).size, 5, "5 unikalnych id");
    });

    await t.test("kolejność malejąca po createdAt (najnowsza pierwsza)", () => {
      const all = [...p1.items, ...p2.items, ...p3.items];
      for (let i = 1; i < all.length; i++) {
        assert.ok(all[i - 1].createdAt.getTime() >= all[i].createdAt.getTime(), "malejąco");
      }
      assert.equal(all[0].title, "n4", "najnowsza (n4) pierwsza");
    });
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});
