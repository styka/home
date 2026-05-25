"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export async function trackActivity(
  module: "shopping" | "tasks" | "notes" | "kitchen" | "pets",
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user?.id) return;
    await prisma.userActivity.create({
      data: {
        userId: session.user.id,
        module,
        action,
        metadata: metadata as Prisma.InputJsonValue ?? undefined,
      },
    });
  } catch {
    // fire-and-forget — never throw
  }
}

export async function getRecentActivity(limit = 30) {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.userActivity.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
