// Z-131 (T-17) — rdzeń kolejki zadań w tle. Wieloworkerowy od startu: pobieranie
// przez `SELECT ... FOR UPDATE SKIP LOCKED`, więc N workerów/instancji nie bierze
// tego samego zadania. Ponawianie z backoffem, odzysk zadań po crashu workera
// (visibility timeout), idempotencja (dedupeKey). Czysta warstwa danych — handlery
// i pętla workera są osobno (`handlers.ts`, `worker.ts`).

import { prisma } from "@/lib/prisma";

export type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED";

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  payload: string;
  result: string | null;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  runAfter: Date;
  lockedAt: Date | null;
  ownerId: string | null;
  dedupeKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueOptions {
  ownerId?: string | null;
  /** Idempotencja: jeśli istnieje AKTYWNE (QUEUED/RUNNING) zadanie z tym kluczem — zwróć je. */
  dedupeKey?: string | null;
  maxAttempts?: number;
  /** Opóźnij wykonanie (ms od teraz). */
  delayMs?: number;
}

/** Zadanie „utknęło" jako RUNNING dłużej niż tyle → uznajemy workera za martwego i odzyskujemy. */
export const DEFAULT_VISIBILITY_TIMEOUT_MS = 2 * 60 * 1000; // 2 min
const BASE_BACKOFF_MS = 5000;

/** Dodaje zadanie do kolejki (z opcjonalną idempotencją po dedupeKey). */
export async function enqueue(
  type: string,
  payload: unknown,
  opts: EnqueueOptions = {}
): Promise<JobRecord> {
  const { ownerId = null, dedupeKey = null, maxAttempts = 3, delayMs = 0 } = opts;

  if (dedupeKey) {
    const existing = await prisma.job.findFirst({
      where: { dedupeKey, status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing as JobRecord;
  }

  const job = await prisma.job.create({
    data: {
      type,
      payload: JSON.stringify(payload ?? {}),
      ownerId,
      dedupeKey,
      maxAttempts,
      runAfter: new Date(Date.now() + Math.max(0, delayMs)),
    },
  });
  return job as JobRecord;
}

/**
 * Atomowo przejmuje JEDNO gotowe zadanie (QUEUED z minionym runAfter, LUB RUNNING
 * porzucone po crashu — lockedAt starszy niż visibility timeout). `SKIP LOCKED` sprawia,
 * że równoległe wywołania nie kolidują (każde bierze inny wiersz albo nic). Zwiększa
 * `attempts` przy przejęciu (crash-loop nie ponawia w nieskończoność).
 */
export async function claimNext(visibilityTimeoutMs = DEFAULT_VISIBILITY_TIMEOUT_MS): Promise<JobRecord | null> {
  const staleBefore = new Date(Date.now() - visibilityTimeoutMs);
  const rows = await prisma.$queryRawUnsafe<JobRecord[]>(
    `UPDATE "Job" SET "status"='RUNNING', "attempts"="attempts"+1, "lockedAt"=now(), "updatedAt"=now()
     WHERE "id" = (
       SELECT "id" FROM "Job"
       WHERE ("status"='QUEUED' AND "runAfter" <= now())
          OR ("status"='RUNNING' AND "lockedAt" < $1)
       ORDER BY "runAfter" ASC, "createdAt" ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
    staleBefore
  );
  return rows[0] ?? null;
}

/** Oznacza zadanie jako zakończone sukcesem z wynikiem (JSON). */
export async function completeJob(id: string, result: unknown): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: { status: "DONE", result: JSON.stringify(result ?? null), error: null, lockedAt: null },
  });
}

/**
 * Oznacza próbę jako nieudaną: jeśli zostały próby → wraca do QUEUED z wykładniczym
 * backoffem; w przeciwnym razie FAILED. Zwraca finalny status (do logowania/testów).
 */
export async function failJob(id: string, errorMessage: string): Promise<JobStatus> {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return "FAILED";
  const msg = (errorMessage || "Nieznany błąd").slice(0, 1000);
  if (job.attempts < job.maxAttempts) {
    const backoff = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, job.attempts - 1));
    await prisma.job.update({
      where: { id },
      data: { status: "QUEUED", error: msg, lockedAt: null, runAfter: new Date(Date.now() + backoff) },
    });
    return "QUEUED";
  }
  await prisma.job.update({ where: { id }, data: { status: "FAILED", error: msg, lockedAt: null } });
  return "FAILED";
}

/** Trwała porażka bez ponawiania (np. brak handlera / błąd nie do naprawienia). */
export async function failJobPermanent(id: string, errorMessage: string): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: { status: "FAILED", error: (errorMessage || "Błąd").slice(0, 1000), lockedAt: null },
  });
}

/** Pobiera zadanie (opcjonalnie zawężone do właściciela — do bezpiecznego pollingu). */
export async function getJob(id: string, ownerId?: string | null): Promise<JobRecord | null> {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return null;
  if (ownerId !== undefined && ownerId !== null && job.ownerId !== ownerId) return null;
  return job as JobRecord;
}

/** Sprząta stare, zakończone zadania (DONE/FAILED/CANCELLED) starsze niż podany wiek. */
export async function cleanupOldJobs(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const res = await prisma.job.deleteMany({
    where: { status: { in: ["DONE", "FAILED", "CANCELLED"] }, updatedAt: { lt: cutoff } },
  });
  return res.count;
}
