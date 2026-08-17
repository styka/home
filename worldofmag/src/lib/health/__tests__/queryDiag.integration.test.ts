import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 079 (zadanie 11, etap 4 część 3) — ZAPYTANIA DIAGNOSTYCZNE MUSZĄ SIĘ WYKONYWAĆ.
 *
 * `REPRESENTATIVE_QUERIES` to **surowy SQL** z nazwami kolumn wpisanymi w string. Kompilator go
 * nie widzi, a wywołanie w `getSystemHealth` jest opakowane w `catch`, który po cichu pomija
 * pozycję („EXPLAIN nieosiągalny — pomiń"). Skutek pomyłki jest więc taki: `/admin/health`
 * przestaje pokazywać trzy najgorętsze listy i **nikomu tego nie mówi**.
 *
 * Etap 4 usunął z tych zapytań kolumnę `ownerId`. Ten test istnieje, żeby następna taka zmiana
 * skończyła się czerwonym testem, a nie znikającą sekcją w panelu.
 */

const HAS_DB = !!process.env.DATABASE_URL;

test(
  "każde zapytanie diagnostyczne daje się wykonać (EXPLAIN nie wpada w cichy catch)",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { REPRESENTATIVE_QUERIES } = await import("../queryDiag");

    // Przestrzeń próbki — tak samo jak w `getSystemHealth`. Gdy baza jest pusta, tworzymy jedną,
    // żeby test mierzył SQL, a nie stan danych.
    let przestrzen = await prisma.workspace.findFirst({ select: { id: true } });
    let sprzatnac: string | null = null;
    if (!przestrzen) {
      const utworzona = await prisma.workspace.create({
        data: { kind: "personal", name: "diag" },
        select: { id: true },
      });
      przestrzen = utworzona;
      sprzatnac = utworzona.id;
    }

    try {
      for (const q of REPRESENTATIVE_QUERIES) {
        await t.test(q.label, async () => {
          // Bez `catch` — o to właśnie chodzi. Błąd SQL ma tu WYWALIĆ test.
          const rows = q.needsOwner
            ? await prisma.$queryRawUnsafe<{ "QUERY PLAN": unknown }[]>(
                `EXPLAIN (FORMAT JSON) ${q.sql}`,
                przestrzen!.id,
              )
            : await prisma.$queryRawUnsafe<{ "QUERY PLAN": unknown }[]>(
                `EXPLAIN (FORMAT JSON) ${q.sql}`,
              );
          assert.ok(rows[0]?.["QUERY PLAN"], "EXPLAIN nie zwrócił planu");
        });
      }
    } finally {
      if (sprzatnac) await prisma.workspace.delete({ where: { id: sprzatnac } }).catch(() => {});
    }
  },
);
