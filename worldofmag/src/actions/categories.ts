"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Hardcoded base categories — always visible, not stored in DB
export const BASE_CATEGORIES: Array<{ name: string; emoji: string }> = [
  { name: "Produce",           emoji: "🥕" },
  { name: "Dairy & Eggs",      emoji: "🧀" },
  { name: "Meat & Fish",       emoji: "🥩" },
  { name: "Bakery",            emoji: "🍞" },
  { name: "Dry Goods & Pasta", emoji: "🌾" },
  { name: "Drinks",            emoji: "🍺" },
  { name: "Frozen",            emoji: "🧊" },
  { name: "Snacks & Sweets",   emoji: "🍫" },
  { name: "Condiments & Oils", emoji: "🫙" },
  { name: "Spices & Herbs",    emoji: "🌿" },
  { name: "Cleaning & Hygiene","emoji": "🧴" },
  { name: "Canned & Preserved","emoji": "🥫" },
  { name: "Other",             emoji: "📦" },
];

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

export type CategoryWithUsage = {
  id: string | null;
  name: string;
  emoji: string;
  isBase: boolean;
  isOwn: boolean;
  usageCount: number;
};

export async function getCategories(): Promise<CategoryWithUsage[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const custom = await prisma.category.findMany({
    where: {
      OR: [
        { userId: user.id },
        teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
      ],
    },
    orderBy: { name: "asc" },
  });

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { userId: user.id },
        teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
        { userId: null, teamId: null },
      ],
    },
    select: { category: true },
  });

  const usageMap = new Map<string, number>();
  for (const p of products) {
    usageMap.set(p.category, (usageMap.get(p.category) ?? 0) + 1);
  }

  const baseNames = new Set(BASE_CATEGORIES.map((c) => c.name));
  const customNames = new Set(custom.map((c) => c.name));

  return [
    ...BASE_CATEGORIES.map((c) => ({
      id: null,
      name: c.name,
      emoji: c.emoji,
      isBase: true,
      isOwn: false,
      usageCount: usageMap.get(c.name) ?? 0,
    })),
    ...custom
      .filter((c) => !baseNames.has(c.name))
      .map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        isBase: false,
        isOwn: c.userId === user.id,
        usageCount: usageMap.get(c.name) ?? 0,
      })),
    // Categories used in products but not defined anywhere
    ...Array.from(usageMap.entries())
      .filter(([name]) => !baseNames.has(name) && !customNames.has(name))
      .map(([name, count]) => ({
        id: null,
        name,
        emoji: "📦",
        isBase: false,
        isOwn: false,
        usageCount: count,
      })),
  ];
}

/** Returns a merged emoji map: base + user custom (for CategoryGroup). */
export async function getCategoryEmojiMap(): Promise<Record<string, string>> {
  const session = await auth();
  const map: Record<string, string> = {};
  for (const c of BASE_CATEGORIES) map[c.name] = c.emoji;

  if (!session?.user?.id) return map;
  const teamIds = await getUserTeamIds(session.user.id);

  const custom = await prisma.category.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
      ],
    },
    select: { name: true, emoji: true },
  });

  for (const c of custom) map[c.name] = c.emoji;
  return map;
}

/** All category names visible to the user (base + custom). */
export async function getCategoryNames(): Promise<string[]> {
  const session = await auth();
  const baseNames = BASE_CATEGORIES.map((c) => c.name);
  if (!session?.user?.id) return baseNames;

  const teamIds = await getUserTeamIds(session.user.id);
  const custom = await prisma.category.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
      ],
    },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  const customNames = custom.map((c) => c.name).filter((n) => !baseNames.includes(n));
  return [...baseNames, ...customNames];
}

export async function createCategory(name: string, emoji: string): Promise<void> {
  const user = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return;

  const existing = await prisma.category.findFirst({
    where: { name: trimmed, userId: user.id, teamId: null },
  });
  if (!existing) {
    await prisma.category.create({
      data: { name: trimmed, emoji: emoji || "📦", userId: user.id },
    });
  }

  revalidatePath("/shopping/products");
  revalidatePath("/shopping");
}

export async function updateCategory(id: string, name: string, emoji: string): Promise<void> {
  const user = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return;

  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat || cat.userId !== user.id) throw new Error("Forbidden");

  const oldName = cat.name;

  await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { name: trimmed, emoji: emoji || "📦" } }),
    // Rename in products catalog (not in list items — too invasive for shared lists)
    prisma.product.updateMany({
      where: { category: oldName, userId: user.id },
      data: { category: trimmed },
    }),
  ]);

  revalidatePath("/shopping/products");
  revalidatePath("/shopping");
}

export async function deleteCategory(id: string): Promise<void> {
  const user = await requireAuth();
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat || cat.userId !== user.id) throw new Error("Forbidden");

  await prisma.category.delete({ where: { id } });
  revalidatePath("/shopping/products");
}
