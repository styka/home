"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import type { Report } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
  return session!.user;
}

export type ReportMeta = Omit<Report, "content"> & { authorName?: string | null };

/** Admin: all reports */
export async function getReportsMeta(): Promise<ReportMeta[]> {
  await requireAdmin();
  const rows = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      authorId: true,
      teamId: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true, email: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    authorName: r.author?.name ?? r.author?.email ?? null,
    author: undefined,
  })) as unknown as ReportMeta[];
}

/** User: own reports + public/system reports + team reports */
export async function getUserReportsMeta(): Promise<ReportMeta[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const rows = await prisma.report.findMany({
    where: {
      OR: [
        { authorId: user.id },
        { authorId: null },
        ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      authorId: true,
      teamId: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true, email: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    authorName: r.author?.name ?? r.author?.email ?? null,
    author: undefined,
  })) as unknown as ReportMeta[];
}

/** Admin: full report content */
export async function getReport(slug: string): Promise<Report | null> {
  await requireAdmin();
  return prisma.report.findUnique({ where: { slug } });
}

/** User: get own report, public report, or team report by slug */
export async function getUserReport(slug: string): Promise<Report | null> {
  const user = await requireAuth();
  const report = await prisma.report.findUnique({ where: { slug } });
  if (!report) return null;
  if (report.authorId === null || report.authorId === user.id) return report;
  if (report.teamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (teamIds.includes(report.teamId)) return report;
  }
  throw new Error("Brak dostępu do raportu");
}

/** Admin: create new report */
export async function createReport(data: {
  title: string;
  slug: string;
  content: string;
  category?: string;
}): Promise<Report> {
  const user = await requireAdmin();
  const trimSlug = data.slug.trim().toLowerCase().replace(/\s+/g, "-");

  const report = await prisma.report.create({
    data: {
      title: data.title.trim(),
      slug: trimSlug,
      content: data.content,
      category: data.category ?? "general",
      authorId: user.id,
    },
  });

  revalidatePath("/admin/reports");
  revalidatePath("/reports");
  return report;
}

/** Admin: update existing report */
export async function updateReport(
  slug: string,
  data: { title?: string; content?: string; category?: string }
): Promise<Report> {
  await requireAdmin();

  const report = await prisma.report.update({
    where: { slug },
    data: {
      ...(data.title ? { title: data.title.trim() } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.category ? { category: data.category } : {}),
    },
  });

  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${slug}`);
  revalidatePath("/reports");
  return report;
}

/** Admin: delete report */
export async function deleteReport(slug: string): Promise<void> {
  await requireAdmin();
  await prisma.report.delete({ where: { slug } });
  revalidatePath("/admin/reports");
  revalidatePath("/reports");
}
