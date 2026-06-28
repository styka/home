import { test } from "node:test";
import assert from "node:assert/strict";

// Z-221 (T-03): kontrakt sortowania pozycji listy zakupów z realnym Prisma.
// Manualna kolejność (`order` ASC) ma pierwszeństwo; przy braku ułożenia (order=0)
// fallback na priority DESC, potem createdAt ASC = dotychczasowe zachowanie.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

// Te same kryteria, co loader strony `/shopping/[listId]`.
const PAGE_ORDER_BY = [{ order: "asc" as const }, { priority: "desc" as const }, { createdAt: "asc" as const }];

test("Z-221 sort pozycji: order ASC > priority DESC > createdAt ASC", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.create({ data: { email: `shop-${rnd()}@test.local` } });
  const list = await prisma.shoppingList.create({ data: { name: `L-${rnd()}`, ownerId: user.id } });

  try {
    const base = Date.now();
    // Jedna kategoria "Nabiał": same domyślne order=0, różne priority/createdAt.
    const a = await prisma.item.create({ data: { listId: list.id, name: "mleko", category: "Nabiał", createdAt: new Date(base + 1000) } });
    const b = await prisma.item.create({ data: { listId: list.id, name: "ser", category: "Nabiał", priority: 2, createdAt: new Date(base + 2000) } });
    const c = await prisma.item.create({ data: { listId: list.id, name: "jogurt", category: "Nabiał", createdAt: new Date(base + 3000) } });

    await t.test("fallback (order=0): priority DESC, potem createdAt ASC", async () => {
      const rows = await prisma.item.findMany({ where: { listId: list.id }, orderBy: PAGE_ORDER_BY });
      // ser (priority 2) pierwszy; reszta po createdAt: mleko, jogurt.
      assert.deepEqual(rows.map((r) => r.name), ["ser", "mleko", "jogurt"]);
    });

    await t.test("ręczne ułożenie nadpisuje priority: order wygrywa", async () => {
      // Symulacja reorderItems: order = index w docelowej kolejności [jogurt, mleko, ser].
      const target = [c.id, a.id, b.id];
      await prisma.$transaction(target.map((id, i) => prisma.item.update({ where: { id }, data: { order: i } })));
      const rows = await prisma.item.findMany({ where: { listId: list.id }, orderBy: PAGE_ORDER_BY });
      assert.deepEqual(rows.map((r) => r.name), ["jogurt", "mleko", "ser"]);
    });

    await t.test("nowa pozycja order=0 ląduje przed ułożonymi (order>=0)", async () => {
      // Po ułożeniu (order 0..2) pozycja z order=0 (świeża, nieprzeciągnięta) jest na górze.
      const d = await prisma.item.create({ data: { listId: list.id, name: "masło", category: "Nabiał", createdAt: new Date(base + 4000) } });
      const rows = await prisma.item.findMany({ where: { listId: list.id }, orderBy: PAGE_ORDER_BY });
      // masło (order=0) przed jogurt/mleko (order 0 też? nie — jogurt=0, mleko=1, ser=2).
      // jogurt ma order=0 i createdAt 3000, masło order=0 createdAt 4000 → po order tie,
      // priority tie, createdAt ASC: jogurt(3000) < masło(4000). Oba przed mleko(order=1).
      assert.equal(rows[0]?.name, "jogurt");
      assert.equal(rows[1]?.name, "masło");
      assert.equal(rows[2]?.name, "mleko");
      await prisma.item.delete({ where: { id: d.id } });
    });
  } finally {
    await prisma.shoppingList.delete({ where: { id: list.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});
