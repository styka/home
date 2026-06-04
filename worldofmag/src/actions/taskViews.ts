"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import type { TaskView } from "@/types";

const TERMINAL_STATUSES = ["DONE", "CANCELLED"];

/** Bezpieczny parse listy id projektów z kolumny JSON. */
function parseProjectIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Id projektów, do których użytkownik ma dostęp (właściciel lub członek). */
async function accessibleProjectIds(userId: string): Promise<Set<string>> {
  const projects = await prisma.taskProject.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  return new Set(projects.map((p: { id: string }) => p.id));
}

export async function getTaskViews(): Promise<TaskView[]> {
  const user = await requireAuth();

  const [rows, accessible] = await Promise.all([
    prisma.taskView.findMany({
      where: { ownerId: user.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    accessibleProjectIds(user.id),
  ]);

  // Liczby aktywnych zadań per projekt — jedno zapytanie, sumowane potem per widok.
  const grouped = await prisma.task.groupBy({
    by: ["projectId"],
    where: {
      projectId: { in: Array.from(accessible) },
      parentTaskId: null,
      status: { notIn: TERMINAL_STATUSES },
    },
    _count: { _all: true },
  });
  const countByProject = new Map<string, number>(
    grouped
      .filter((g): g is typeof g & { projectId: string } => g.projectId !== null)
      .map((g) => [g.projectId, g._count._all])
  );

  return rows.map((r): TaskView => {
    // Trzymamy tylko wciąż dostępne projekty (skasowane/odebrane znikają cicho).
    const ids = parseProjectIds(r.projectIds).filter((id) => accessible.has(id));
    const activeCount = ids.reduce((sum, id) => sum + (countByProject.get(id) ?? 0), 0);
    return { id: r.id, name: r.name, emoji: r.emoji, projectIds: ids, order: r.order, activeCount };
  });
}

/** Pojedynczy widok (z odfiltrowaniem niedostępnych projektów). Null, gdy nie należy do usera. */
export async function getTaskView(id: string): Promise<TaskView | null> {
  const user = await requireAuth();
  const row = await prisma.taskView.findFirst({ where: { id, ownerId: user.id } });
  if (!row) return null;
  const accessible = await accessibleProjectIds(user.id);
  const ids = parseProjectIds(row.projectIds).filter((pid) => accessible.has(pid));
  return { id: row.id, name: row.name, emoji: row.emoji, projectIds: ids, order: row.order };
}

export async function createTaskView(data: {
  name: string;
  projectIds: string[];
  emoji?: string;
}): Promise<TaskView> {
  const user = await requireAuth();
  const name = data.name.trim();
  if (!name) throw new Error("Nazwa widoku nie może być pusta");

  // Zapisujemy tylko projekty, do których user faktycznie ma dostęp.
  const accessible = await accessibleProjectIds(user.id);
  const ids = data.projectIds.filter((id) => accessible.has(id));
  if (ids.length === 0) throw new Error("Wybierz co najmniej jeden projekt");

  const maxOrder = await prisma.taskView.aggregate({
    where: { ownerId: user.id },
    _max: { order: true },
  });

  const row = await prisma.taskView.create({
    data: {
      name,
      emoji: data.emoji?.trim() || "🗂",
      projectIds: JSON.stringify(ids),
      ownerId: user.id,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  revalidatePath("/tasks");
  return { id: row.id, name: row.name, emoji: row.emoji, projectIds: ids, order: row.order };
}

export async function updateTaskView(
  id: string,
  patch: { name?: string; projectIds?: string[]; emoji?: string }
): Promise<TaskView> {
  const user = await requireAuth();
  const existing = await prisma.taskView.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) throw new Error("Widok nie znaleziony");

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Nazwa widoku nie może być pusta");
    data.name = name;
  }
  if (patch.emoji !== undefined) data.emoji = patch.emoji.trim() || "🗂";
  if (patch.projectIds !== undefined) {
    const accessible = await accessibleProjectIds(user.id);
    const ids = patch.projectIds.filter((pid) => accessible.has(pid));
    if (ids.length === 0) throw new Error("Wybierz co najmniej jeden projekt");
    data.projectIds = JSON.stringify(ids);
  }

  const row = await prisma.taskView.update({ where: { id }, data });
  revalidatePath("/tasks");
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    projectIds: parseProjectIds(row.projectIds),
    order: row.order,
  };
}

export async function deleteTaskView(id: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.taskView.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) return;
  await prisma.taskView.delete({ where: { id } });
  revalidatePath("/tasks");
}
