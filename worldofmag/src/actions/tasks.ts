"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { assertProjectAccess } from "@/actions/taskProjects";
import type { Task, TaskStatus, TaskPriority, TaskWithRelations, RecurringRule } from "@/types";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string };
}

const TASK_INCLUDE = {
  tags: { include: { tag: true } },
  subtasks: {
    include: { tags: { include: { tag: true } } },
    orderBy: { order: "asc" as const },
  },
  comments: {
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  shares: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      team: { select: { id: true, name: true } },
    },
  },
  assignee: { select: { id: true, name: true, email: true, image: true } },
  _count: { select: { subtasks: true, comments: true } },
};

function toTask(p: unknown): Task {
  return p as Task;
}

export async function getTasks(projectId: string): Promise<Task[]> {
  const user = await requireAuth();
  await assertProjectAccess(projectId, user.id);

  const tasks = await prisma.task.findMany({
    where: { projectId, parentTaskId: null },
    include: TASK_INCLUDE,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  return tasks.map(toTask);
}

export async function getAllUserTasks(): Promise<Task[]> {
  const user = await requireAuth();

  const projects = await prisma.taskProject.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    select: { id: true },
  });

  const projectIds = projects.map((p: { id: string }) => p.id);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { projectId: { in: projectIds } },
        { createdById: user.id },
        { assigneeId: user.id },
      ],
      parentTaskId: null,
    },
    include: TASK_INCLUDE,
    orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { order: "asc" }],
  });

  return tasks.map(toTask);
}

export async function getTask(id: string): Promise<TaskWithRelations | null> {
  const user = await requireAuth();

  const task = await prisma.task.findUnique({
    where: { id },
    include: { ...TASK_INCLUDE, subtasks: { include: { tags: { include: { tag: true } }, _count: { select: { subtasks: true, comments: true } } }, orderBy: { order: "asc" } } },
  });

  if (!task) return null;
  if (task.projectId) await assertProjectAccess(task.projectId, user.id);

  return toTask(task) as TaskWithRelations;
}

export async function createTask(data: {
  title: string;
  projectId?: string | null;
  priority?: TaskPriority;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimatedMins?: number | null;
  description?: string | null;
  parentTaskId?: string | null;
  recurring?: RecurringRule | null;
  tagIds?: string[];
}): Promise<Task> {
  const user = await requireAuth();

  if (data.projectId) await assertProjectAccess(data.projectId, user.id);

  const maxOrder = await prisma.task.aggregate({
    where: { projectId: data.projectId ?? null },
    _max: { order: true },
  });

  const task = await prisma.task.create({
    data: {
      title: data.title.trim(),
      projectId: data.projectId ?? null,
      priority: data.priority ?? "NONE",
      dueDate: data.dueDate ?? null,
      startDate: data.startDate ?? null,
      estimatedMins: data.estimatedMins ?? null,
      description: data.description ?? null,
      parentTaskId: data.parentTaskId ?? null,
      recurring: data.recurring ? JSON.stringify(data.recurring) : null,
      createdById: user.id,
      order: (maxOrder._max.order ?? 0) + 1,
      tags: data.tagIds?.length
        ? { create: data.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: TASK_INCLUDE,
  });

  revalidatePath("/tasks");
  if (data.projectId) revalidatePath(`/tasks/${data.projectId}`);
  return toTask(task);
}

export async function updateTask(
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    startDate: Date | null;
    estimatedMins: number | null;
    projectId: string | null;
    assigneeId: string | null;
    recurring: RecurringRule | null;
    order: number;
  }>
): Promise<Task> {
  const user = await requireAuth();
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Task not found");
  if (existing.projectId) await assertProjectAccess(existing.projectId, user.id);

  const completedAt =
    patch.status === "DONE" && existing.status !== "DONE"
      ? new Date()
      : patch.status && patch.status !== "DONE"
      ? null
      : undefined;

  const data: Record<string, unknown> = { ...patch };
  if (patch.recurring !== undefined) {
    data.recurring = patch.recurring ? JSON.stringify(patch.recurring) : null;
  }
  if (completedAt !== undefined) data.completedAt = completedAt;
  if (patch.title) data.title = patch.title.trim();

  const task = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });

  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
  return toTask(task);
}

export async function updateTaskTags(taskId: string, tagIds: string[]): Promise<void> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (task.projectId) await assertProjectAccess(task.projectId, user.id);

  await prisma.taskTaskTag.deleteMany({ where: { taskId } });
  if (tagIds.length > 0) {
    await prisma.taskTaskTag.createMany({ data: tagIds.map((tagId) => ({ taskId, tagId })) });
  }

  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
}

export async function deleteTask(id: string): Promise<void> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;
  if (task.projectId) await assertProjectAccess(task.projectId, user.id);

  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
}

export async function toggleTaskStatus(id: string): Promise<Task> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new Error("Task not found");
  if (task.projectId) await assertProjectAccess(task.projectId, user.id);

  const cycle: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
  const current = task.status as TaskStatus;
  const idx = cycle.indexOf(current);
  const next: TaskStatus = cycle[(idx + 1) % cycle.length];

  return updateTask(id, { status: next });
}

export async function completeRecurringTask(id: string): Promise<Task> {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || !existing.recurring) throw new Error("Not a recurring task");

  const rule: RecurringRule = JSON.parse(existing.recurring);
  const now = new Date();

  // Mark current as done
  await updateTask(id, { status: "DONE" });

  // Compute next due date
  const nextDue = computeNextDue(existing.dueDate ?? now, rule);
  if (!nextDue) return toTask(existing);

  if (rule.endDate && nextDue > new Date(rule.endDate)) return toTask(existing);

  const nextTask = await prisma.task.create({
    data: {
      title: existing.title,
      description: existing.description,
      priority: existing.priority,
      projectId: existing.projectId,
      parentTaskId: existing.parentTaskId,
      estimatedMins: existing.estimatedMins,
      createdById: existing.createdById,
      assigneeId: existing.assigneeId,
      recurring: existing.recurring,
      dueDate: nextDue,
      order: existing.order,
    },
    include: TASK_INCLUDE,
  });

  revalidatePath("/tasks");
  if (existing.projectId) revalidatePath(`/tasks/${existing.projectId}`);
  return toTask(nextTask);
}

function computeNextDue(from: Date, rule: RecurringRule): Date | null {
  const d = new Date(from);
  switch (rule.type) {
    case "DAILY":
      d.setDate(d.getDate() + rule.interval);
      return d;
    case "WEEKLY":
      if (rule.daysOfWeek?.length) {
        const currentDay = d.getDay();
        const sorted = [...rule.daysOfWeek].sort((a, b) => a - b);
        const next = sorted.find((day) => day > currentDay);
        if (next !== undefined) {
          d.setDate(d.getDate() + (next - currentDay));
        } else {
          d.setDate(d.getDate() + (7 - currentDay + sorted[0]));
        }
        return d;
      }
      d.setDate(d.getDate() + 7 * rule.interval);
      return d;
    case "MONTHLY":
      d.setMonth(d.getMonth() + rule.interval);
      return d;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + rule.interval);
      return d;
    default:
      return null;
  }
}

export async function addTaskComment(taskId: string, content: string): Promise<void> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (task.projectId) await assertProjectAccess(task.projectId, user.id);

  await prisma.taskComment.create({ data: { taskId, userId: user.id, content: content.trim() } });
  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
}

export async function deleteTaskComment(commentId: string): Promise<void> {
  const user = await requireAuth();
  const comment = await prisma.taskComment.findUnique({ where: { id: commentId }, include: { task: true } });
  if (!comment) return;
  if (comment.userId !== user.id) throw new Error("Not your comment");

  await prisma.taskComment.delete({ where: { id: commentId } });
  if (comment.task.projectId) revalidatePath(`/tasks/${comment.task.projectId}`);
}

export async function shareTask(taskId: string, target: { userId?: string; teamId?: string }, role: "VIEWER" | "EDITOR" = "VIEWER"): Promise<void> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (task.projectId) await assertProjectAccess(task.projectId, user.id);

  await prisma.taskShare.create({ data: { taskId, userId: target.userId ?? null, teamId: target.teamId ?? null, role } });
  if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
}

export async function removeTaskShare(shareId: string): Promise<void> {
  const user = await requireAuth();
  const share = await prisma.taskShare.findUnique({ where: { id: shareId }, include: { task: true } });
  if (!share) return;
  if (share.task.projectId) await assertProjectAccess(share.task.projectId, user.id);

  await prisma.taskShare.delete({ where: { id: shareId } });
  if (share.task.projectId) revalidatePath(`/tasks/${share.task.projectId}`);
}

export async function reorderTask(taskId: string, newOrder: number): Promise<void> {
  await requireAuth();
  await prisma.task.update({ where: { id: taskId }, data: { order: newOrder } });
  revalidatePath("/tasks");
}

export async function getTodayTasks(): Promise<Task[]> {
  const user = await requireAuth();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);

  const projects = await prisma.taskProject.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    select: { id: true },
  });
  const projectIds = projects.map((p: { id: string }) => p.id);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [{ projectId: { in: projectIds } }, { assigneeId: user.id }],
      dueDate: { gte: start, lte: end },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    include: TASK_INCLUDE,
    orderBy: [{ priority: "asc" }, { order: "asc" }],
  });

  return tasks.map(toTask);
}

export async function getOverdueTasks(): Promise<Task[]> {
  const user = await requireAuth();
  const now = new Date(); now.setHours(0, 0, 0, 0);

  const projects = await prisma.taskProject.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    select: { id: true },
  });
  const projectIds = projects.map((p: { id: string }) => p.id);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [{ projectId: { in: projectIds } }, { assigneeId: user.id }],
      dueDate: { lt: now },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    include: TASK_INCLUDE,
    orderBy: [{ dueDate: "asc" }],
  });

  return tasks.map(toTask);
}
