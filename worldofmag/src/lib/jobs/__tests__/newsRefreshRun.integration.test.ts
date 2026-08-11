import { test } from "node:test";
import assert from "node:assert/strict";

// 041 (T-11) — trwała historia przebiegów odświeżania Wiadomości. DB-gated.
//
// Sedno: historia ma PRZEŻYĆ sprzątanie kolejki (`cleanupOldJobs` kasuje zadania po 24 h) i nie
// rosnąć w nieskończoność.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

async function withUser(fn: (userId: string) => Promise<void>) {
  const { prisma } = await import("@/platform/db/prisma");
  const user = await prisma.user.create({
    data: { email: `refreshrun-${rnd()}@test.local`, name: "Test historii przebiegów" },
  });
  try {
    await fn(user.id);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
}

const RESULT = { sources: 5, fetched: 12, assigned: 3, summarized: 3, timelineAdded: 2 };

test(
  "dwa przebiegi = dwa wiersze, każdy z własnymi liczbami",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { recordRun } = await import("@/modules/news/jobs/newsRefresh");
    await withUser(async (ownerId) => {
      await recordRun(ownerId, new Date(Date.now() - 60_000), "done", RESULT);
      await recordRun(ownerId, new Date(), "done", { ...RESULT, assigned: 7 });

      const rows = await prisma.newsRefreshRun.findMany({
        where: { ownerId },
        orderBy: { finishedAt: "desc" },
      });
      assert.equal(rows.length, 2, "dwa osobne przebiegi");
      assert.deepEqual(rows.map((r) => r.assigned).sort(), [3, 7]);
    });
  }
);

test(
  "niepowodzenie zapisuje się z komunikatem, a nie znika",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { recordRun } = await import("@/modules/news/jobs/newsRefresh");
    await withUser(async (ownerId) => {
      await recordRun(ownerId, new Date(), "failed", null, "kanał RSS nie odpowiada");
      const row = await prisma.newsRefreshRun.findFirst({ where: { ownerId } });
      assert.equal(row?.status, "failed");
      assert.equal(row?.error, "kanał RSS nie odpowiada");
      assert.equal(row?.fetched, 0);
    });
  }
);

test(
  "skasowanie zadania z kolejki NIE usuwa historii",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { recordRun } = await import("@/modules/news/jobs/newsRefresh");
    await withUser(async (ownerId) => {
      const type = `news.refresh.test.${rnd()}`;
      const job = await prisma.job.create({
        data: { type, status: "DONE", ownerId, payload: "{}", result: "{}" },
      });
      await recordRun(ownerId, new Date(), "done", RESULT);

      // To robi `cleanupOldJobs` po 24 godzinach — i dokładnie dlatego historia nie mogła zostać w `Job`.
      await prisma.job.delete({ where: { id: job.id } });

      const rows = await prisma.newsRefreshRun.findMany({ where: { ownerId } });
      assert.equal(rows.length, 1, "przebieg przeżył sprzątanie kolejki");
    });
  }
);

test(
  "historia jest przycinana do ostatnich 30 przebiegów",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { recordRun, RUN_HISTORY_LIMIT } = await import("@/modules/news/jobs/newsRefresh");
    await withUser(async (ownerId) => {
      // Wstawiamy o pięć więcej niż limit; kasowane mają być NAJSTARSZE.
      for (let i = 0; i < RUN_HISTORY_LIMIT + 5; i++) {
        await recordRun(ownerId, new Date(Date.now() - (100 - i) * 1000), "done", {
          ...RESULT,
          assigned: i,
        });
      }
      const rows = await prisma.newsRefreshRun.findMany({
        where: { ownerId },
        orderBy: { finishedAt: "desc" },
      });
      assert.equal(rows.length, RUN_HISTORY_LIMIT, "tabela nie rośnie w nieskończoność");
      // Zostały najnowsze — czyli te o największych numerach.
      const kept = rows.map((r) => r.assigned).sort((a, b) => a - b);
      assert.equal(kept[0], 5, "najstarsze pięć wypadło");
    });
  }
);
