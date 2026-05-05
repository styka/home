"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { TaskProject } from "@/types";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string };
}

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

export async function deleteTaskProject(id: string): Promise<void> {
  const user = await requireAuth();
  await assertProjectAccess(id, user.id, "ADMIN");

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
