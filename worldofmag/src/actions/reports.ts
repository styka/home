"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import type { Report } from "@prisma/client";

async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Forbidden");
  return user;
}

export async function getReportsMeta(): Promise<Omit<Report, "content">[]> {
  await requireAdmin();
  return prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, category: true, createdAt: true, updatedAt: true },
  });
}

export async function getReport(slug: string): Promise<Report | null> {
  await requireAdmin();
  return prisma.report.findUnique({ where: { slug } });
}
