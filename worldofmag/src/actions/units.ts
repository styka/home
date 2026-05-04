"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UNITS } from "@/types";

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

export type UnitWithUsage = {
  id: string | null;
  name: string;
  isBase: boolean;
  isOwn: boolean;
  usageCount: number;
};

export async function getUnits(): Promise<UnitWithUsage[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const customUnits = await prisma.unit.findMany({
    where: {
      OR: [
        { userId: user.id },
        teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
      ],
    },
    orderBy: { name: "asc" },
  });

  // Usage counts from products
  const products = await prisma.product.findMany({
    where: {
      defaultUnit: { not: null },
      OR: [
        { userId: user.id },
        teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
        { userId: null, teamId: null },
      ],
    },
    select: { defaultUnit: true },
  });

  const usageMap = new Map<string, number>();
  for (const p of products) {
    if (p.defaultUnit) {
      usageMap.set(p.defaultUnit, (usageMap.get(p.defaultUnit) ?? 0) + 1);
    }
  }

  const baseNames = new Set(UNITS.map((u) => u.value));
  const customNames = new Set(customUnits.map((u) => u.name));

  const result: UnitWithUsage[] = [
    // Hardcoded base units
    ...UNITS.map((u) => ({
      id: null,
      name: u.value,
      isBase: true,
      isOwn: false,
      usageCount: usageMap.get(u.value) ?? 0,
    })),
    // User custom units (not already in base list)
    ...customUnits
      .filter((u) => !baseNames.has(u.name))
      .map((u) => ({
        id: u.id,
        name: u.name,
        isBase: false,
        isOwn: u.userId === user.id,
        usageCount: usageMap.get(u.name) ?? 0,
      })),
    // Units used in products but not in base list or custom units table
    ...Array.from(usageMap.entries())
      .filter(([name]) => !baseNames.has(name) && !customNames.has(name))
      .map(([name, count]) => ({
        id: null,
        name,
        isBase: false,
        isOwn: false,
        usageCount: count,
      })),
  ];

  return result;
}

export async function getUnitSuggestions(): Promise<string[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const custom = await prisma.unit.findMany({
    where: {
      OR: [
        { userId: user.id },
        teamIds.length > 0 ? { teamId: { in: teamIds } } : {},
      ],
    },
    select: { name: true },
  });

  const baseNames = UNITS.map((u) => u.value);
  const customNames = custom.map((u) => u.name).filter((n) => !baseNames.includes(n));
  return [...baseNames, ...customNames];
}

export async function createUnit(name: string): Promise<void> {
  const user = await requireAuth();
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return;

  const existing = await prisma.unit.findFirst({
    where: { name: trimmed, userId: user.id, teamId: null },
  });
  if (!existing) {
    await prisma.unit.create({ data: { name: trimmed, userId: user.id } });
  }

  revalidatePath("/shopping/products");
}

export async function renameUnit(id: string, newName: string): Promise<void> {
  const user = await requireAuth();
  const trimmed = newName.trim().toLowerCase();
  if (!trimmed) return;

  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit || unit.userId !== user.id) throw new Error("Forbidden");

  const oldName = unit.name;

  await prisma.$transaction([
    prisma.unit.update({ where: { id }, data: { name: trimmed } }),
    // Update all products using the old unit name
    prisma.product.updateMany({
      where: { defaultUnit: oldName, userId: user.id },
      data: { defaultUnit: trimmed },
    }),
  ]);

  revalidatePath("/shopping/products");
  revalidatePath("/shopping");
}

export async function deleteUnit(id: string): Promise<void> {
  const user = await requireAuth();
  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit || unit.userId !== user.id) throw new Error("Forbidden");

  await prisma.unit.delete({ where: { id } });
  revalidatePath("/shopping/products");
}
