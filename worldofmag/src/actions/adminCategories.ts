"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { orphanCategoryIcons } from "@/actions/categoryIcons";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
  return session;
}

export type SystemCategory = {
  id: string;
  name: string;
  emoji: string;
  createdAt: Date;
};

export async function getSystemCategories(): Promise<SystemCategory[]> {
  await requireAdmin();
  return prisma.category.findMany({
    where: { userId: null, teamId: null },
    orderBy: { name: "asc" },
  });
}

export async function createSystemCategory(name: string, emoji: string): Promise<void> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return;

  const existing = await prisma.category.findFirst({
    where: { name: trimmed, userId: null, teamId: null },
  });
  if (!existing) {
    await prisma.category.create({
      data: { name: trimmed, emoji: emoji || "📦", userId: null, teamId: null },
    });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/shopping");
}

export async function updateSystemCategory(id: string, name: string, emoji: string): Promise<void> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return;

  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat || cat.userId !== null || cat.teamId !== null) throw new Error("Not a system category");

  const oldName = cat.name;

  await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { name: trimmed, emoji: emoji || "📦" } }),
    // Update all products that use the old name
    prisma.product.updateMany({ where: { category: oldName }, data: { category: trimmed } }),
  ]);

  revalidatePath("/admin/categories");
  revalidatePath("/shopping");
}

export async function deleteSystemCategory(id: string): Promise<void> {
  await requireAdmin();
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat || cat.userId !== null || cat.teamId !== null) throw new Error("Not a system category");

  // Move icon variants for this category to __library__ for all users
  await prisma.categoryIconVariant.updateMany({
    where: { categoryName: cat.name },
    data: { categoryName: "__library__", isActive: false },
  });

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/shopping");
  revalidatePath("/shopping/icons");
}
