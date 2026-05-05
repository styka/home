"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { TaskTagDef } from "@/types";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string };
}

export async function getTaskTags(): Promise<TaskTagDef[]> {
  await requireAuth();
  return prisma.taskTagDef.findMany({ orderBy: { name: "asc" } });
}

export async function createTaskTag(name: string, color = "#6b7280"): Promise<TaskTagDef> {
  await requireAuth();

  const tag = await prisma.taskTagDef.upsert({
    where: { name: name.trim().toLowerCase() },
    create: { name: name.trim().toLowerCase(), color },
    update: { color },
  });

  revalidatePath("/tasks");
  return tag;
}

export async function updateTaskTag(id: string, patch: { name?: string; color?: string }): Promise<TaskTagDef> {
  await requireAuth();

  const tag = await prisma.taskTagDef.update({
    where: { id },
    data: {
      ...(patch.name !== undefined && { name: patch.name.trim().toLowerCase() }),
      ...(patch.color !== undefined && { color: patch.color }),
    },
  });

  revalidatePath("/tasks");
  return tag;
}

export async function deleteTaskTag(id: string): Promise<void> {
  await requireAuth();
  await prisma.taskTagDef.delete({ where: { id } });
  revalidatePath("/tasks");
}
