import { test } from "node:test";
import assert from "node:assert/strict";

// Z-131 (T-17) — rdzeń kolejki Job na realnym Postgresie. DB-gated.
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test("enqueue → claimNext → complete: pełny cykl życia", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { enqueue, claimNext, completeJob, getJob } = await import("@/lib/jobs/queue");
  const type = `test.echo.${rnd()}`;
  const job = await enqueue(type, { x: 1 }, { ownerId: "u1" });
  try {
    assert.equal(job.status, "QUEUED");
    assert.equal(job.attempts, 0);

    const claimed = await claimNext();
    assert.ok(claimed, "przejęto zadanie");
    assert.equal(claimed!.id, job.id);
    assert.equal(claimed!.status, "RUNNING");
    assert.equal(claimed!.attempts, 1, "attempts++ przy przejęciu");

    await completeJob(job.id, { ok: true });
    const done = await getJob(job.id, "u1");
    assert.equal(done!.status, "DONE");
    assert.deepEqual(JSON.parse(done!.result!), { ok: true });
  } finally {
    await prisma.job.deleteMany({ where: { type } });
  }
});

test("SKIP LOCKED: dwa równoległe claimy JEDNEGO zadania → dokładnie jeden je bierze", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  const { enqueue, claimNext } = await import("@/lib/jobs/queue");
  const type = `test.race.${rnd()}`;
  const job = await enqueue(type, {}, {});
  try {
    // Dwa jednoczesne przejęcia — SKIP LOCKED gwarantuje brak podwójnego wzięcia.
    const [a, b] = await Promise.all([claimNext(), claimNext()]);
    const claimedIds = [a, b].filter(Boolean).map((j) => j!.id);
    assert.equal(claimedIds.length, 1, `dokładnie jeden claim wziął zadanie (było ${claimedIds.length})`);
    assert.equal(claimedIds[0], job.id);
  } finally {
    await prisma.job.deleteMany({ where: { type } });
  }
});

test("wiele zadań, wielu 'workerów': każde zadanie wzięte dokładnie raz", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  const { enqueue, claimNext } = await import("@/lib/jobs/queue");
  const type = `test.many.${rnd()}`;
  const N = 6;
  for (let i = 0; i < N; i++) await enqueue(type, { i }, {});
  try {
    // 3 „workery" po 3 claimy równolegle (>N) — łącznie N unikalnych, reszta null.
    const claims = await Promise.all(Array.from({ length: 9 }, () => claimNext()));
    const ids = claims.filter(Boolean).map((j) => j!.id);
    assert.equal(new Set(ids).size, ids.length, "żadne zadanie nie wzięte dwa razy");
    // wszystkie wzięte pochodzą z naszego typu i jest ich N
    const mine = await prisma.job.count({ where: { type, status: "RUNNING" } });
    assert.equal(mine, N, "wszystkie N przeszły w RUNNING");
  } finally {
    await prisma.job.deleteMany({ where: { type } });
  }
});

test("failJob: ponawia z backoffem do maxAttempts, potem FAILED", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  const { enqueue, claimNext, failJob } = await import("@/lib/jobs/queue");
  const type = `test.retry.${rnd()}`;
  const job = await enqueue(type, {}, { maxAttempts: 2 });
  try {
    await claimNext(); // attempts=1
    let status = await failJob(job.id, "boom");
    assert.equal(status, "QUEUED", "1. porażka < maxAttempts → ponów");
    const requeued = await prisma.job.findUnique({ where: { id: job.id } });
    assert.ok(requeued!.runAfter.getTime() > Date.now(), "runAfter przesunięty w przyszłość (backoff)");

    // Symulujemy drugą próbę (runAfter minął) — cofamy runAfter i przejmujemy.
    await prisma.job.update({ where: { id: job.id }, data: { runAfter: new Date(Date.now() - 1000) } });
    await claimNext(); // attempts=2
    status = await failJob(job.id, "boom2");
    assert.equal(status, "FAILED", "2. porażka == maxAttempts → FAILED");
    const failed = await prisma.job.findUnique({ where: { id: job.id } });
    assert.equal(failed!.status, "FAILED");
    assert.equal(failed!.error, "boom2");
  } finally {
    await prisma.job.deleteMany({ where: { type } });
  }
});

test("odzysk po crashu: RUNNING starsze niż visibility timeout jest ponownie przejmowane", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  const { enqueue, claimNext } = await import("@/lib/jobs/queue");
  const type = `test.stale.${rnd()}`;
  const job = await enqueue(type, {}, {});
  try {
    await claimNext(); // RUNNING, lockedAt=now
    // Nic nie czeka w kolejce → z krótkim timeoutem też nic (świeży lock).
    assert.equal(await claimNext(60_000), null, "świeży RUNNING nie jest odzyskiwany");
    // Postarzamy lockedAt → powinno zostać odzyskane.
    await prisma.job.update({ where: { id: job.id }, data: { lockedAt: new Date(Date.now() - 5 * 60 * 1000) } });
    const reclaimed = await claimNext(60_000);
    assert.ok(reclaimed && reclaimed.id === job.id, "porzucone RUNNING odzyskane");
    assert.equal(reclaimed!.attempts, 2, "attempts rośnie przy re-claimie");
  } finally {
    await prisma.job.deleteMany({ where: { type } });
  }
});

test("enqueue dedupeKey: nie tworzy duplikatu aktywnego zadania", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async () => {
  const { prisma } = await import("@/lib/prisma");
  const { enqueue } = await import("@/lib/jobs/queue");
  const type = `test.dedupe.${rnd()}`;
  const key = `k-${rnd()}`;
  const a = await enqueue(type, { v: 1 }, { dedupeKey: key });
  const b = await enqueue(type, { v: 2 }, { dedupeKey: key });
  try {
    assert.equal(a.id, b.id, "drugi enqueue zwrócił to samo aktywne zadanie");
    assert.equal(await prisma.job.count({ where: { type } }), 1, "tylko jedno zadanie w bazie");
  } finally {
    await prisma.job.deleteMany({ where: { type } });
  }
});

// ── Worker end-to-end (scalony tu, by claimNext nie kolidował z równoległym plikiem) ──
test("runTick: sukces → DONE z wynikiem; wyjątek → retry/FAILED; brak handlera → FAILED", { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false }, async (t) => {
  const { prisma } = await import("@/lib/prisma");
  const { JOB_HANDLERS } = await import("@/lib/jobs/handlers");
  const { enqueue, getJob } = await import("@/lib/jobs/queue");
  const { runTick } = await import("@/lib/jobs/worker");

  const okType = `test.ok.${rnd()}`;
  const boomType = `test.boom.${rnd()}`;
  const missingType = `test.missing.${rnd()}`;
  JOB_HANDLERS[okType] = async (payload: { n?: number }) => ({ doubled: (payload?.n ?? 0) * 2 });
  JOB_HANDLERS[boomType] = async () => { throw new Error("wybuch"); };

  try {
    await t.test("handler zwraca wynik → DONE", async () => {
      const j = await enqueue(okType, { n: 21 }, {});
      const n = await runTick(5);
      assert.ok(n >= 1);
      const done = await getJob(j.id);
      assert.equal(done!.status, "DONE");
      assert.deepEqual(JSON.parse(done!.result!), { doubled: 42 });
    });

    await t.test("handler rzuca, maxAttempts=1 → FAILED z komunikatem", async () => {
      const j = await enqueue(boomType, {}, { maxAttempts: 1 });
      await runTick(5);
      const failed = await getJob(j.id);
      assert.equal(failed!.status, "FAILED");
      assert.equal(failed!.error, "wybuch");
    });

    await t.test("brak handlera → FAILED (bez ponawiania)", async () => {
      const j = await enqueue(missingType, {}, { maxAttempts: 5 });
      await runTick(5);
      const failed = await getJob(j.id);
      assert.equal(failed!.status, "FAILED", "brak handlera = trwała porażka mimo maxAttempts>1");
      assert.match(failed!.error ?? "", /Brak handlera/);
    });
  } finally {
    delete JOB_HANDLERS[okType];
    delete JOB_HANDLERS[boomType];
    await prisma.job.deleteMany({ where: { type: { in: [okType, boomType, missingType] } } });
  }
});
