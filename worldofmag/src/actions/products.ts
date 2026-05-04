"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { categorize } from "@/lib/categorize";
import type { Product } from "@/types";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string };
}

async function getUserTeamIds(userId: string): Promise<string[]> {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  return memberships.map((m) => m.teamId);
}

export async function getProductSuggestions(prefix: string): Promise<Product[]> {
  if (!prefix || prefix.length < 1) return [];
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const teamIds = userId ? await getUserTeamIds(userId) : [];

  return prisma.product.findMany({
    where: {
      name: { contains: prefix.toLowerCase() },
      OR: [
        { userId: userId ?? undefined },
        teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
        { userId: null, teamId: null },
      ],
    },
    orderBy: [{ useCount: "desc" }, { name: "asc" }],
    take: 10,
  });
}

export async function getProducts(): Promise<Product[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  return prisma.product.findMany({
    where: {
      OR: [
        { userId: user.id },
        teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
        { userId: null, teamId: null },
      ],
    },
    orderBy: [{ useCount: "desc" }, { name: "asc" }],
  });
}

export async function upsertUserProduct(
  name: string,
  defaultUnit: string | null,
  category?: string
): Promise<Product> {
  const user = await requireAuth();
  const normalizedName = name.trim().toLowerCase();
  const cat = category ?? categorize(name);

  const existing = await prisma.product.findFirst({
    where: { name: normalizedName, userId: user.id },
  });

  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        useCount: { increment: 1 },
        defaultUnit: defaultUnit ?? existing.defaultUnit,
        updatedAt: new Date(),
      },
    });
  }

  return prisma.product.create({
    data: {
      name: normalizedName,
      category: cat,
      defaultUnit,
      useCount: 1,
      userId: user.id,
      teamId: null,
    },
  });
}

export async function createProduct(data: {
  name: string;
  defaultUnit?: string | null;
  category?: string;
}): Promise<Product> {
  const user = await requireAuth();
  const normalizedName = data.name.trim().toLowerCase();
  return prisma.product.create({
    data: {
      name: normalizedName,
      category: data.category ?? categorize(data.name),
      defaultUnit: data.defaultUnit ?? null,
      useCount: 1,
      userId: user.id,
      teamId: null,
    },
  });
}

export async function updateProduct(
  id: string,
  data: { name?: string; defaultUnit?: string | null; category?: string }
): Promise<Product> {
  const user = await requireAuth();
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new Error("Product not found");
  if (product.userId !== user.id) throw new Error("Forbidden");

  return prisma.product.update({
    where: { id },
    data: {
      name: data.name ? data.name.trim().toLowerCase() : undefined,
      defaultUnit: data.defaultUnit,
      category: data.category,
      updatedAt: new Date(),
    },
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const user = await requireAuth();
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return;
  if (product.userId !== user.id) throw new Error("Forbidden");
  await prisma.product.delete({ where: { id } });
  revalidatePath("/shopping/products");
}

export async function copyGlobalProduct(id: string): Promise<Product> {
  const user = await requireAuth();
  const global = await prisma.product.findUnique({ where: { id } });
  if (!global || global.userId !== null || global.teamId !== null) {
    throw new Error("Not a global product");
  }

  const existing = await prisma.product.findFirst({
    where: { name: global.name, userId: user.id },
  });
  if (existing) return existing;

  return prisma.product.create({
    data: {
      name: global.name,
      category: global.category,
      defaultUnit: global.defaultUnit,
      useCount: 1,
      userId: user.id,
      teamId: null,
    },
  });
}
