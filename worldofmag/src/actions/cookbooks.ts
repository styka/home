"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { trackActivity } from "@/actions/activity";
import type { Cookbook } from "@/types/kitchen";

export type CookbookWithCount = Cookbook & { recipeCount: number };

export async function assertCookbookAccess(cookbookId: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const cb = await prisma.cookbook.findUnique({
    where: { id: cookbookId },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!cb) throw new Error("Książka kucharska nie istnieje");
  if (cb.ownerId === userId) return;
  if (cb.ownerTeamId && teamIds.includes(cb.ownerTeamId)) return;
  throw new Error("Brak dostępu do tej książki kucharskiej");
}

export async function getCookbook(id: string): Promise<Cookbook | null> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const cb = await prisma.cookbook.findUnique({ where: { id } });
  if (!cb) return null;
  if (cb.ownerId === user.id) return cb;
  if (cb.ownerTeamId && teamIds.includes(cb.ownerTeamId)) return cb;
  return null;
}

export async function getCookbooks(): Promise<CookbookWithCount[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const cookbooks = await prisma.cookbook.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { recipes: true } } },
  });

  return cookbooks.map((cb) => {
    const { _count, ...rest } = cb;
    return { ...rest, recipeCount: _count.recipes };
  });
}

export async function createCookbook(data: {
  name: string;
  description?: string | null;
  emoji?: string;
  color?: string | null;
  ownerTeamId?: string | null;
}): Promise<Cookbook> {
  const user = await requireAuth();

  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  const cb = await prisma.cookbook.create({
    data: {
      name: data.name.trim(),
      description: data.description ?? null,
      emoji: data.emoji?.trim() || "📚",
      color: data.color ?? null,
      ownerId: data.ownerTeamId ? null : user.id,
      ownerTeamId: data.ownerTeamId ?? null,
    },
  });

  void trackActivity("kitchen", "create_cookbook", { id: cb.id, name: cb.name });
  revalidatePath("/kitchen/cookbooks");
  revalidatePath("/kitchen/recipes");
  return cb;
}

export async function updateCookbook(
  id: string,
  patch: { name?: string; description?: string | null; emoji?: string; color?: string | null }
): Promise<Cookbook> {
  const user = await requireAuth();
  await assertCookbookAccess(id, user.id);

  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.name = patch.name.trim();

  const cb = await prisma.cookbook.update({ where: { id }, data });
  revalidatePath("/kitchen/cookbooks");
  revalidatePath(`/kitchen/cookbooks/${id}`);
  return cb;
}

export async function deleteCookbook(id: string): Promise<void> {
  const user = await requireAuth();
  await assertCookbookAccess(id, user.id);
  await prisma.cookbook.delete({ where: { id } });
  revalidatePath("/kitchen/cookbooks");
  revalidatePath("/kitchen/recipes");
}
