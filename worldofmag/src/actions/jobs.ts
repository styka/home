"use server";

// Z-131 (T-17) — akcje admina dla kolejki zadań: podgląd stanu, ręczny retry/anulowanie.
// Wszystko za bramką `module.admin`. Job nie ma FK do User (ownerId to gołe id),
// więc e-maile właścicieli dociągamy osobnym zapytaniem i mapujemy.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { requeueJob, cancelJob, cleanupOldJobs, type JobStatus } from "@/lib/jobs/queue";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Brak uprawnień administratora");
}

export interface JobRow {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  ownerEmail: string | null;
  createdAt: string;
  updatedAt: string;
  runAfter: string;
}

export interface JobsOverview {
  counts: Record<JobStatus, number>;
  byType: Array<{ type: string; active: number }>;
  recent: JobRow[];
  /** Właściciele z największą liczbą aktywnych zadań (fairness/nadużycia). */
  topOwners: Array<{ email: string; active: number }>;
}

const ALL_STATUSES: JobStatus[] = ["QUEUED", "RUNNING", "DONE", "FAILED", "CANCELLED"];

/** Pełny obraz kolejki dla panelu admina. `statusFilter` zawęża listę „recent". */
export async function getJobsOverview(statusFilter?: JobStatus | "ALL"): Promise<JobsOverview> {
  await assertAdmin();

  const [grouped, recentRaw] = await Promise.all([
    prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.job.findMany({
      where: statusFilter && statusFilter !== "ALL" ? { status: statusFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<JobStatus, number>;
  for (const g of grouped) counts[g.status as JobStatus] = g._count._all;

  // Aktywne (QUEUED/RUNNING) pogrupowane po typie i po właścicielu.
  const active = await prisma.job.findMany({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    select: { type: true, ownerId: true },
  });
  const typeMap = new Map<string, number>();
  const ownerMap = new Map<string, number>();
  for (const j of active) {
    typeMap.set(j.type, (typeMap.get(j.type) ?? 0) + 1);
    if (j.ownerId) ownerMap.set(j.ownerId, (ownerMap.get(j.ownerId) ?? 0) + 1);
  }
  const byType = Array.from(typeMap.entries()).map(([type, a]) => ({ type, active: a })).sort((a, b) => b.active - a.active);

  // E-maile: dla recent + top ownerów.
  const ownerIds = new Set<string>();
  for (const j of recentRaw) if (j.ownerId) ownerIds.add(j.ownerId);
  ownerMap.forEach((_, id) => ownerIds.add(id));
  const users = ownerIds.size
    ? await prisma.user.findMany({ where: { id: { in: Array.from(ownerIds) } }, select: { id: true, email: true } })
    : [];
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const topOwners = Array.from(ownerMap.entries())
    .map(([id, a]) => ({ email: emailById.get(id) ?? id, active: a }))
    .sort((a, b) => b.active - a.active)
    .slice(0, 8);

  const recent: JobRow[] = recentRaw.map((j) => ({
    id: j.id,
    type: j.type,
    status: j.status as JobStatus,
    attempts: j.attempts,
    maxAttempts: j.maxAttempts,
    error: j.error,
    ownerEmail: j.ownerId ? emailById.get(j.ownerId) ?? j.ownerId : null,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    runAfter: j.runAfter.toISOString(),
  }));

  return { counts, byType, recent, topOwners };
}

/** Ręczny retry zadania (FAILED/CANCELLED/DONE → QUEUED z nowym budżetem prób). */
export async function retryJobAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await assertAdmin();
  const ok = await requeueJob(id);
  revalidatePath("/admin/jobs");
  return ok ? { ok: true } : { ok: false, message: "Nie można ponowić (zadanie w toku lub nie istnieje)" };
}

/** Ręczne anulowanie zadania (QUEUED/FAILED → CANCELLED). */
export async function cancelJobAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await assertAdmin();
  const ok = await cancelJob(id);
  revalidatePath("/admin/jobs");
  return ok ? { ok: true } : { ok: false, message: "Nie można anulować (zły stan lub nie istnieje)" };
}

/** Ręczne sprzątanie zakończonych zadań starszych niż `hours` godzin. Zwraca liczbę usuniętych. */
export async function cleanupJobsAction(hours = 24): Promise<number> {
  await assertAdmin();
  const n = await cleanupOldJobs(Math.max(1, hours) * 60 * 60 * 1000);
  revalidatePath("/admin/jobs");
  return n;
}
