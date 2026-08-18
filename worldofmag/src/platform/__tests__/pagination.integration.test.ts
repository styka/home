import { test } from "node:test";
import assert from "node:assert/strict";
import { zapytanieKursorowe, stronaZWierszy } from "../pagination";
import { filtrMoichRekordow, wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

// Z-070/Z-174: keyset end-to-end z realnym kursorem Prisma (nie tylko czysty helper).
// Paginuje notatki usera; sprawdza brak duplikatów, kolejność i przejście hasMore.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-070 keyset + Prisma cursor: strony bez duplikatów, malejąco, hasMore poprawne", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/platform/db/prisma");
  const user = await prisma.user.create({ data: { email: `pg-${rnd()}@test.local` } });

  try {
    // 5 notatek z rosnącym createdAt (sort malejący → najnowsza pierwsza).
    for (let i = 0; i < 5; i++) {
      await prisma.note.create({ data: { title: `n${i}`, ...(await wlasnoscDoZapisu(user.id)), createdAt: new Date(Date.now() + i * 1000) } });
    }
    const page = async (cursor: string | null) => {
      const rows = await prisma.note.findMany({
        where: { ...(await filtrMoichRekordow(user.id)) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...zapytanieKursorowe({ kursor: cursor, rozmiar: 2 }),
      });
      return stronaZWierszy(rows, 2);
    };

    const p1 = await page(null);
    const p2 = await page(p1.nastepnyKursor);
    const p3 = await page(p2.nastepnyKursor);

    await t.test("rozmiary stron i hasMore", () => {
      assert.equal(p1.pozycje.length, 2); assert.equal(p1.jestWiecej, true);
      assert.equal(p2.pozycje.length, 2); assert.equal(p2.jestWiecej, true);
      assert.equal(p3.pozycje.length, 1); assert.equal(p3.jestWiecej, false);
      assert.equal(p3.nastepnyKursor, null);
    });

    await t.test("brak duplikatów między stronami (pokrycie wszystkich 5)", () => {
      const ids = [...p1.pozycje, ...p2.pozycje, ...p3.pozycje].map((n) => n.id);
      assert.equal(new Set(ids).size, 5, "5 unikalnych id");
    });

    await t.test("kolejność malejąca po createdAt (najnowsza pierwsza)", () => {
      const all = [...p1.pozycje, ...p2.pozycje, ...p3.pozycje];
      for (let i = 1; i < all.length; i++) {
        assert.ok(all[i - 1].createdAt.getTime() >= all[i].createdAt.getTime(), "malejąco");
      }
      assert.equal(all[0].title, "n4", "najnowsza (n4) pierwsza");
    });
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});
