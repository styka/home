"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { auth } from "@/lib/auth";
import { BASE_CATEGORIES } from "@/lib/categories";
import { getActiveCategoryIconMap, orphanCategoryIcons } from "@/actions/categoryIcons";

export type CategoryWithUsage = {
  id: string | null;
  name: string;
  emoji: string;
  isBase: boolean;
  isOwn: boolean;
  teamId: string | null;
  teamName?: string;
  usageCount: number;
};

async function getSystemCategories() {
  try {
    return await prisma.category.findMany({
      where: { userId: null, teamId: null },
      orderBy: { name: "asc" },
    });
  } catch {
    return BASE_CATEGORIES.map((c) => ({ id: null, name: c.name, emoji: c.emoji, userId: null, teamId: null, createdAt: new Date() }));
  }
}

export async function getCategories(): Promise<CategoryWithUsage[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const [systemCats, custom] = await Promise.all([
    getSystemCategories(),
    prisma.category.findMany({
      where: {
        OR: [
          { userId: user.id },
          teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
        ],
      },
      include: { team: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

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

  const systemNames = new Set(systemCats.map((c) => c.name));
  const customNames = new Set(custom.map((c) => c.name));

  return [
    ...systemCats.map((c) => ({
      id: c.id ?? null,
      name: c.name,
      emoji: c.emoji,
      isBase: true,
      isOwn: false,
      teamId: null,
      usageCount: usageMap.get(c.name) ?? 0,
    })),
    ...custom
      .filter((c) => !systemNames.has(c.name))
      .map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        isBase: false,
        isOwn: c.userId === user.id,
        teamId: c.teamId ?? null,
        teamName: c.team?.name,
        usageCount: usageMap.get(c.name) ?? 0,
      })),
    // Categories used in products but not defined anywhere
    ...Array.from(usageMap.entries())
      .filter(([name]) => !systemNames.has(name) && !customNames.has(name))
      .map(([name, count]) => ({
        id: null,
        name,
        emoji: "📦",
        isBase: false,
        isOwn: false,
        teamId: null,
        usageCount: count,
      })),
  ];
}

/** Returns a merged emoji map: system + user custom (for CategoryGroup). */
export async function getCategoryEmojiMap(): Promise<Record<string, string>> {
  const session = await auth();
  const map: Record<string, string> = {};

  const systemCats = await getSystemCategories();
  for (const c of systemCats) map[c.name] = c.emoji;

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

  // Active SVG icons take priority over emoji
  const svgMap = await getActiveCategoryIconMap();
  for (const [cat, svg] of Object.entries(svgMap)) map[cat] = svg;

  return map;
}

/** All category names visible to the user (system + custom). */
export async function getCategoryNames(): Promise<string[]> {
  const session = await auth();
  const systemCats = await getSystemCategories();
  const systemNames = systemCats.map((c) => c.name);

  if (!session?.user?.id) return systemNames;

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

  const customNames = custom.map((c) => c.name).filter((n) => !systemNames.includes(n));
  return [...systemNames, ...customNames];
}

export async function createCategory(name: string, emoji: string, ownerTeamId?: string): Promise<void> {
  const user = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return;

  if (ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(ownerTeamId)) throw new Error("Nie jesteś członkiem tego teamu");

    const existing = await prisma.category.findFirst({
      where: { name: trimmed, teamId: ownerTeamId, userId: null },
    });
    if (!existing) {
      await prisma.category.create({
        data: { name: trimmed, emoji: emoji || "📦", teamId: ownerTeamId, userId: null },
      });
    }
  } else {
    const existing = await prisma.category.findFirst({
      where: { name: trimmed, userId: user.id, teamId: null },
    });
    if (!existing) {
      await prisma.category.create({
        data: { name: trimmed, emoji: emoji || "📦", userId: user.id },
      });
    }
  }

  revalidatePath("/shopping/products");
  revalidatePath("/shopping");
}

async function assertCategoryAccess(id: string, userId: string): Promise<{ name: string; teamId: string | null }> {
  const teamIds = await getUserTeamIds(userId);
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new Error("Kategoria nie istnieje");
  if (cat.userId === userId) return cat;
  if (cat.teamId && teamIds.includes(cat.teamId)) return cat;
  throw new Error("Brak dostępu do kategorii");
}

export async function updateCategory(id: string, name: string, emoji: string): Promise<void> {
  const user = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return;

  const cat = await assertCategoryAccess(id, user.id);
  const oldName = cat.name;

  await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { name: trimmed, emoji: emoji || "📦" } }),
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
  const cat = await assertCategoryAccess(id, user.id);

  await orphanCategoryIcons(cat.name, user.id);

  await prisma.category.delete({ where: { id } });
  revalidatePath("/shopping/products");
  revalidatePath("/shopping/icons");
}
