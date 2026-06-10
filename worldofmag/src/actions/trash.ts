"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";

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
  else throw new Error("Nieobsługiwany typ pozycji");

  await prisma.trashItem.delete({ where: { id } });
  revalidatePath("/trash");
  revalidatePath("/notes");
  revalidatePath("/tasks");
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
