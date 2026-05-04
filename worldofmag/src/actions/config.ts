"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden");
}

export async function getConfigValue(key: string): Promise<string | null> {
  const row = await prisma.config.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  await requireAdmin();
  await prisma.config.upsert({
    where: { key },
    update: { value, updatedAt: new Date() },
    create: { key, value, updatedAt: new Date() },
  });
}
