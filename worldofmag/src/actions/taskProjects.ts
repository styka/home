"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import type { TaskProject, ProjectStatusConfig } from "@/types";
import { serializeStatusConfig, parseStatusConfig, SYSTEM_TASK_STATUSES } from "@/types";

function toProject(p: unknown): TaskProject {
  return p as TaskProject;
}

export async function getTaskProjects(): Promise<TaskProject[]> {
  const user = await requireAuth();

  const owned = await prisma.taskProject.findMany({
    where: { ownerId: user.id },
    include: { _count: { select: { tasks: true } }, members: { select: { userId: true, role: true } } },
    orderBy: [{ isInbox: "desc" }, { createdAt: "asc" }],
  });

  const memberOf = await prisma.taskProject.findMany({
    where: { members: { some: { userId: user.id } }, ownerId: { not: user.id } },
    include: { _count: { select: { tasks: true } }, members: { select: { userId: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });

  return [...owned, ...memberOf].map(toProject);
}

export async function createTaskProject(
  name: string,
  opts?: { color?: string; emoji?: string; description?: string }
): Promise<TaskProject> {
  const user = await requireAuth();

  const project = await prisma.taskProject.create({
    data: {
      name: name.trim(),
      color: opts?.color ?? "#6b7280",
      emoji: opts?.emoji ?? "📋",
      description: opts?.description ?? null,
      ownerId: user.id,
    },
    include: { _count: { select: { tasks: true } } },
  });

  revalidatePath("/tasks");
  return toProject(project);
}

export async function updateTaskProject(
  id: string,
  patch: { name?: string; color?: string; emoji?: string; description?: string }
): Promise<TaskProject> {
  const user = await requireAuth();
  await assertProjectAccess(id, user.id, "ADMIN");

  const project = await prisma.taskProject.update({
    where: { id },
    data: {
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.emoji !== undefined && { emoji: patch.emoji }),
      ...(patch.description !== undefined && { description: patch.description }),
    },
    include: { _count: { select: { tasks: true } } },
  });

  revalidatePath("/tasks");
  return toProject(project);
}

/** Zapisuje konfigurację statusów listy (włączone statusy + ścieżka przejść). */
export async function updateTaskProjectStatusConfig(
  id: string,
  config: ProjectStatusConfig
): Promise<TaskProject> {
  const user = await requireAuth();
  await assertProjectAccess(id, user.id, "ADMIN");

  // Sanityzacja własnych statusów (dedupe po kluczu, niepusta nazwa, defaulty pól).
  const custom = (config.custom ?? [])
    .filter((c) => c && typeof c.key === "string" && c.key.length > 0)
    .filter((c, i, a) => a.findIndex((x) => x.key === c.key) === i)
    .map((c) => ({
      key: c.key,
      label: (c.label ?? "").trim() || c.key,
      color: c.color || "var(--text-muted)",
      icon: c.icon || "circle",
      isTerminal: c.isTerminal === true,
    }));

  // Zbiór dozwolonych kluczy = systemowe ∪ własne. Filtrujemy enabled/chain.
  const validKeys = new Set<string>([...SYSTEM_TASK_STATUSES.map((s) => s.key), ...custom.map((c) => c.key)]);
  const enabled = config.enabled.filter((s, i, a) => a.indexOf(s) === i && validKeys.has(s));
  if (enabled.length === 0) throw new Error("Lista musi mieć co najmniej jeden status");
  const chain = config.chain.filter((s, i, a) => a.indexOf(s) === i && enabled.includes(s));

  // Blokada usunięcia własnego statusu, który jest w użyciu przez zadania.
  const existing = await prisma.taskProject.findUnique({ where: { id }, select: { statusConfig: true } });
  const prevCustomKeys = parseStatusConfig(existing?.statusConfig ?? null).custom?.map((c) => c.key) ?? [];
  const removed = prevCustomKeys.filter((k) => !custom.some((c) => c.key === k));
  for (const key of removed) {
    const inUse = await prisma.task.count({ where: { projectId: id, status: key } });
    if (inUse > 0) {
      const label = parseStatusConfig(existing?.statusConfig ?? null).custom?.find((c) => c.key === key)?.label ?? key;
      throw new Error(`Nie można usunąć statusu „${label}" — używa go ${inUse} ${inUse === 1 ? "zadanie" : "zadań"}. Najpierw przenieś te zadania.`);
    }
  }

  const project = await prisma.taskProject.update({
    where: { id },
    data: { statusConfig: serializeStatusConfig({ enabled, chain, custom }) },
    include: { _count: { select: { tasks: true } } },
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return toProject(project);
}

export async function deleteTaskProject(id: string): Promise<void> {
  const user = await requireAuth();
  await assertProjectAccess(id, user.id, "ADMIN");

  // Skrzynka to specjalny projekt-domyślny — nie pozwalamy go usunąć.
  const project = await prisma.taskProject.findUnique({ where: { id }, select: { isInbox: true } });
  if (project?.isInbox) throw new Error("Nie można usunąć Skrzynki");

  // Zadania nie są kasowane — relacja Task.projectId ma onDelete: SetNull,
  // więc po usunięciu projektu zostają bez przypisania (widoczne w „Wszystkie").
  await prisma.taskProject.delete({ where: { id } });
  revalidatePath("/tasks");
}

export async function getOrCreateInbox(): Promise<TaskProject> {
  const user = await requireAuth();

  let inbox = await prisma.taskProject.findFirst({
    where: { ownerId: user.id, isInbox: true },
    include: { _count: { select: { tasks: true } } },
  });

  if (!inbox) {
    inbox = await prisma.taskProject.create({
      data: { name: "Skrzynka", emoji: "📥", isInbox: true, ownerId: user.id, color: "#6b7280" },
      include: { _count: { select: { tasks: true } } },
    });
  }

  return toProject(inbox);
}

export async function addProjectMember(projectId: string, userId: string, role = "MEMBER"): Promise<void> {
  const user = await requireAuth();
  await assertProjectAccess(projectId, user.id, "ADMIN");

  await prisma.taskProjectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role },
    update: { role },
  });

  revalidatePath(`/tasks/${projectId}`);
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const user = await requireAuth();
  await assertProjectAccess(projectId, user.id, "ADMIN");

  await prisma.taskProjectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });

  revalidatePath(`/tasks/${projectId}`);
}

export async function assertProjectAccess(
  projectId: string,
  userId: string,
  minRole: "MEMBER" | "ADMIN" = "MEMBER"
): Promise<void> {
  const project = await prisma.taskProject.findUnique({
    where: { id: projectId },
    include: { members: { where: { userId } } },
  });

  if (!project) throw new Error("Project not found");

  if (project.ownerId === userId) return;

  const membership = project.members[0];
  if (!membership) throw new Error("Access denied");

  if (minRole === "ADMIN" && membership.role !== "ADMIN") throw new Error("Admin access required");
}
