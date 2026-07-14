// Z-131 (T-17) — pętla workera (in-process). Startowana raz w `instrumentation.ts`.
// Na prod (płatny tier, nie usypia) chodzi ciągle; na develop (free) chodzi gdy apka
// nie śpi. Ten sam kod można później uruchomić jako OSOBNY worker na Render — logika
// pobierania (`claimNext`, SKIP LOCKED) jest wieloworkerowo-bezpieczna.

import { claimNext, completeJob, failJob, failJobPermanent, cleanupOldJobs, type JobRecord } from "@/lib/jobs/queue";
import { getHandler } from "@/lib/jobs/handlers";
import { reportServerError } from "@/lib/observability/report";

const TICK_MS = 3000;
const CONCURRENCY = 2; // ile zadań równolegle na tick (per instancja)
const CLEANUP_EVERY_MS = 60 * 60 * 1000;

// Guard singletona przetrwały HMR w dev (Next re-importuje moduły).
const g = globalThis as unknown as { __omniaJobWorker?: { timer: NodeJS.Timeout | null; cleanup: NodeJS.Timeout | null } };

async function processOne(job: JobRecord): Promise<void> {
  const handler = getHandler(job.type);
  if (!handler) {
    // Brak handlera = błąd trwały (ponawianie nic nie da).
    await failJobPermanent(job.id, `Brak handlera dla typu "${job.type}"`);
    return;
  }
  try {
    const payload = JSON.parse(job.payload || "{}");
    const result = await handler(payload, { ownerId: job.ownerId, jobId: job.id });
    await completeJob(job.id, result);
  } catch (e) {
    await failJob(job.id, e instanceof Error ? e.message : String(e));
  }
}

/** Jeden przebieg: przejmij do CONCURRENCY zadań i wykonaj równolegle. Zwraca liczbę wziętych. */
export async function runTick(concurrency = CONCURRENCY): Promise<number> {
  const claimed: JobRecord[] = [];
  for (let i = 0; i < concurrency; i++) {
    const job = await claimNext();
    if (!job) break;
    claimed.push(job);
  }
  if (claimed.length > 0) await Promise.all(claimed.map(processOne));
  return claimed.length;
}

/** Startuje workera in-process (idempotentnie). Wyłączalny env-em `JOBS_WORKER_DISABLED=1`. */
export function startJobWorker(): void {
  if (process.env.JOBS_WORKER_DISABLED === "1") return;
  if (g.__omniaJobWorker) return; // już wystartowany w tym procesie
  g.__omniaJobWorker = { timer: null, cleanup: null };

  let running = false;
  const loop = async () => {
    if (running) return; // nie nakładaj ticków
    running = true;
    try {
      // Opróżniaj kolejno, dopóki są zadania (do rozsądnego limitu na jeden przebieg).
      let total = 0;
      for (let i = 0; i < 10; i++) {
        const n = await runTick();
        total += n;
        if (n === 0) break;
      }
    } catch (e) {
      reportServerError(e, { kind: "jobWorkerTick" });
    } finally {
      running = false;
    }
  };

  g.__omniaJobWorker.timer = setInterval(loop, TICK_MS);
  g.__omniaJobWorker.cleanup = setInterval(() => {
    cleanupOldJobs().catch((e) => reportServerError(e, { kind: "jobCleanup" }));
  }, CLEANUP_EVERY_MS);
}
