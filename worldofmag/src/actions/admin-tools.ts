"use server";

import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function getOmniaTasksForClipboard(): Promise<{ title: string; description: string | null }[]> {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Brak dostępu");

  const projects = await prisma.taskProject.findMany({
    where: { name: { contains: "omnia", mode: "insensitive" } },
    select: { id: true },
  });

  if (projects.length === 0) return [];

  return prisma.task.findMany({
    where: {
      projectId: { in: projects.map((p) => p.id) },
      status: { notIn: ["DONE", "CANCELLED"] },
      parentTaskId: null,
    },
    select: { title: true, description: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}
