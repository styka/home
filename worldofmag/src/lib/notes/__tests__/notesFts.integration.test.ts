import { test } from "node:test";
import assert from "node:assert/strict";

// Z-240 (T-16) — indeksowane wyszukiwanie notatek (pg_trgm) zamiast skanującego ILIKE.
// DB-gated: sprawdza istnienie rozszerzenia+indeksów, poprawność filtra i to, że planer
// UMIE użyć indeksu trigramowego dla ILIKE (z wymuszonym wyłączeniem seq scan).
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("Z-240 pg_trgm: rozszerzenie + indeksy GIN istnieją", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  const ext = await prisma.$queryRawUnsafe<Array<{ extname: string }>>(`SELECT extname FROM pg_extension WHERE extname='pg_trgm'`);
  assert.equal(ext.length, 1, "rozszerzenie pg_trgm zainstalowane");
  const idx = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
    `SELECT indexname FROM pg_indexes WHERE tablename='Note' AND indexname IN ('Note_title_trgm_idx','Note_content_trgm_idx')`
  );
  assert.equal(idx.length, 2, "oba indeksy trigramowe istnieją");
});

test("Z-240: filtr ILIKE zwraca poprawne notatki (bez zmiany zachowania)", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.create({ data: { email: `fts-${rnd()}@test.local` } });
  try {
    await prisma.note.create({ data: { title: "Przepis na żurek", content: "kwas i kiełbasa", ownerId: user.id } });
    await prisma.note.create({ data: { title: "Lista zakupów", content: "mleko, żurek w słoiku", ownerId: user.id } });
    await prisma.note.create({ data: { title: "Coś innego", content: "bez związku", ownerId: user.id } });

    await t.test("dopasowanie po treści i tytule (substring, insensitive)", async () => {
      const rows = await prisma.note.findMany({
        where: { ownerId: user.id, OR: [
          { title: { contains: "żurek", mode: "insensitive" } },
          { content: { contains: "żurek", mode: "insensitive" } },
        ] },
        select: { title: true },
      });
      const titles = rows.map((r) => r.title).sort();
      assert.deepEqual(titles, ["Lista zakupów", "Przepis na żurek"]);
    });
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});

test("Z-240: planer UMIE użyć indeksu trigramowego dla ILIKE (enable_seqscan=off)", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  // Wymuszamy preferencję indeksu (na małej tabeli planer normalnie wybrałby seq scan).
  await prisma.$executeRawUnsafe(`SET enable_seqscan = off`);
  try {
    const plan = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
      `EXPLAIN SELECT id FROM "Note" WHERE "title" ILIKE '%zurek%'`
    );
    const text = plan.map((r) => r["QUERY PLAN"]).join("\n");
    assert.match(text, /Note_title_trgm_idx/, `plan powinien użyć indeksu trigramowego:\n${text}`);
  } finally {
    await prisma.$executeRawUnsafe(`SET enable_seqscan = on`);
  }
});
