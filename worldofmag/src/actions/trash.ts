"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { TRASH_RETENTION_DAYS } from "@/platform/trash/trash";

export type TrashItemDTO = {
  id: string;
  module: string;
  entityId: string;
  title: string;
  deletedAt: string;
};

export async function getTrash(): Promise<{ items: TrashItemDTO[]; retentionDays: number }> {
  const user = await requireAuth();
  // Sprzątanie przeterminowanych przy każdym wejściu (free-tier: bez crona).
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000);
  await prisma.trashItem.deleteMany({ where: { userId: user.id, deletedAt: { lt: cutoff } } });

  const rows = await prisma.trashItem.findMany({
    where: { userId: user.id },
    orderBy: { deletedAt: "desc" },
  });
  return {
    items: rows.map((r) => ({
      id: r.id, module: r.module, entityId: r.entityId, title: r.title, deletedAt: r.deletedAt.toISOString(),
    })),
    retentionDays: TRASH_RETENTION_DAYS,
  };
}

export async function restoreTrashItem(id: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.trashItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) throw new Error("Pozycja kosza nie istnieje");

  const data = JSON.parse(item.payload) as Record<string, unknown>;
  if (item.module === "notes") await restoreNote(data);
  else if (item.module === "tasks") await restoreTask(data);
  else if (item.module === "weather") await restoreWeatherIdea(data);
  else throw new Error("Nieobsługiwany typ pozycji");

  await prisma.trashItem.delete({ where: { id } });
  revalidatePath("/trash");
  revalidatePath("/notes");
  revalidatePath("/tasks");
  revalidatePath("/pogoda/pomysly");
}

export async function purgeTrashItem(id: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.trashItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) return;
  await prisma.trashItem.delete({ where: { id } });
  revalidatePath("/trash");
}

export async function emptyTrash(): Promise<void> {
  const user = await requireAuth();
  await prisma.trashItem.deleteMany({ where: { userId: user.id } });
  revalidatePath("/trash");
}

// ─── Restoratory per moduł ───────────────────────────────────────────────────

function asDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

async function restoreNote(d: Record<string, unknown>): Promise<void> {
  const id = d.id as string;
  // Nie duplikuj, jeśli notatka o tym id już istnieje.
  const exists = await prisma.note.findUnique({ where: { id }, select: { id: true } });
  if (exists) return;

  // Grupa mogła zniknąć — przywróć bez grupy, jeśli nie istnieje.
  let groupId = (d.groupId as string | null) ?? null;
  if (groupId) {
    const g = await prisma.noteGroup.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!g) groupId = null;
  }

  await prisma.note.create({
    data: {
      id,
      title: (d.title as string) ?? "Przywrócona notatka",
      content: (d.content as string) ?? "",
      isMarkdown: (d.isMarkdown as boolean) ?? false,
      pinned: (d.pinned as boolean) ?? false,
      groupId,
      ownerId: (d.ownerId as string | null) ?? null,
      ownerTeamId: (d.ownerTeamId as string | null) ?? null,
      createdAt: asDate(d.createdAt) ?? new Date(),
    },
  });

  // Re-link tagów, które wciąż istnieją.
  const tagIds = (d.tagIds as string[] | undefined) ?? [];
  if (tagIds.length) {
    const existing = await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true } });
    if (existing.length) {
      await prisma.noteTag.createMany({
        data: existing.map((t) => ({ noteId: id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }
}

async function restoreTask(d: Record<string, unknown>): Promise<void> {
  const id = d.id as string;
  const exists = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (exists) return;

  // Projekt/parent mogły zniknąć — wyzeruj nieistniejące referencje.
  let projectId = (d.projectId as string | null) ?? null;
  if (projectId) {
    const p = await prisma.taskProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!p) projectId = null;
  }
  let parentTaskId = (d.parentTaskId as string | null) ?? null;
  if (parentTaskId) {
    const p = await prisma.task.findUnique({ where: { id: parentTaskId }, select: { id: true } });
    if (!p) parentTaskId = null;
  }

  await prisma.task.create({
    data: {
      id,
      title: (d.title as string) ?? "Przywrócone zadanie",
      description: (d.description as string | null) ?? null,
      status: (d.status as string) ?? "TODO",
      priority: (d.priority as string) ?? "NONE",
      dueDate: asDate(d.dueDate),
      startDate: asDate(d.startDate),
      completedAt: asDate(d.completedAt),
      estimatedMins: (d.estimatedMins as number | null) ?? null,
      recurring: (d.recurring as string | null) ?? null,
      category: (d.category as string) ?? "Other",
      order: (d.order as number) ?? 0,
      projectId,
      parentTaskId,
      createdById: (d.createdById as string | null) ?? null,
      assigneeId: (d.assigneeId as string | null) ?? null,
      createdAt: asDate(d.createdAt) ?? new Date(),
    },
  });

  const tagIds = (d.tagIds as string[] | undefined) ?? [];
  if (tagIds.length) {
    const existing = await prisma.taskTagDef.findMany({ where: { id: { in: tagIds } }, select: { id: true } });
    if (existing.length) {
      await prisma.taskTaskTag.createMany({
        data: existing.map((t) => ({ taskId: id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }
}

/**
 * 037: propozycja „co robić" z modułu Pogoda.
 *
 * Uwaga na `[ownerId, fingerprint]`: to klucz unikalny, więc jeśli po usunięciu użytkownik zdążył
 * ponownie zablokować lub obejrzeć propozycję o tej samej nazwie, wiersz już istnieje. Przywracamy
 * wtedy tylko treść, której nowy wiersz nie ma (szczegóły) — twarde `create` wywaliłoby się na
 * naruszeniu unikalności.
 */
async function restoreWeatherIdea(d: Record<string, unknown>): Promise<void> {
  const id = d.id as string;
  const ownerId = d.ownerId as string;
  const fingerprint = d.fingerprint as string;
  if (!ownerId || !fingerprint) throw new Error("Uszkodzona migawka propozycji");

  const clash = await prisma.weatherIdea.findUnique({
    where: { ownerId_fingerprint: { ownerId, fingerprint } },
    select: { id: true, detail: true },
  });
  if (clash) {
    if (!clash.detail && d.detail) {
      await prisma.weatherIdea.update({
        where: { id: clash.id },
        data: {
          detail: d.detail as string,
          detailAt: asDate(d.detailAt),
          detailRuns: (d.detailRuns as number) ?? 0,
          detailUsage: (d.detailUsage as string | null) ?? null,
        },
      });
    }
    return;
  }

  await prisma.weatherIdea.create({
    data: {
      id,
      ownerId,
      fingerprint,
      title: (d.title as string) ?? "Przywrócony pomysł",
      summary: (d.summary as string) ?? "",
      category: (d.category as string) ?? "other",
      state: (d.state as string) ?? "considered",
      locationLabel: (d.locationLabel as string) ?? "",
      lat: (d.lat as number) ?? 0,
      lon: (d.lon as number) ?? 0,
      detail: (d.detail as string | null) ?? null,
      detailAt: asDate(d.detailAt),
      detailRuns: (d.detailRuns as number) ?? 0,
      detailUsage: (d.detailUsage as string | null) ?? null,
      viewCount: (d.viewCount as number) ?? 0,
      lastSeenAt: asDate(d.lastSeenAt) ?? new Date(),
      createdAt: asDate(d.createdAt) ?? new Date(),
    },
  });
}
