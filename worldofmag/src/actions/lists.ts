"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { ShoppingList } from "@/types";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string };
}

/**
 * Returns all lists visible to the current user:
 * - Lists they personally own
 * - Lists owned by any team they belong to
 */
export async function getLists(): Promise<ShoppingList[]> {
  const user = await requireAuth();

  const teamIds = await prisma.teamMember
    .findMany({ where: { userId: user.id }, select: { teamId: true } })
    .then((rows) => rows.map((r) => r.teamId));

  return prisma.shoppingList.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ],
    },
    include: { ownerTeam: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  }) as unknown as Promise<ShoppingList[]>;
}

export async function createList(name: string, ownerTeamId?: string): Promise<ShoppingList> {
  const user = await requireAuth();

  // If assigning to a team, verify membership
  if (ownerTeamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: ownerTeamId, userId: user.id } },
    });
    if (!membership) throw new Error("Not a member of that team");
  }

  const list = await prisma.shoppingList.create({
    data: {
      name: name.trim(),
      ownerId: ownerTeamId ? undefined : user.id,
      ownerTeamId: ownerTeamId ?? undefined,
    },
  });
  revalidatePath("/shopping");
  return list as unknown as ShoppingList;
}

export async function renameList(id: string, name: string): Promise<ShoppingList> {
  const user = await requireAuth();
  await assertListAccess(id, user.id);
  const list = await prisma.shoppingList.update({
    where: { id },
    data: { name: name.trim() },
  });
  revalidatePath("/shopping");
  revalidatePath(`/shopping/${id}`);
  return list as unknown as ShoppingList;
}

export async function deleteList(id: string): Promise<void> {
  const user = await requireAuth();
  await assertListAccess(id, user.id);
  await prisma.shoppingList.delete({ where: { id } });
  revalidatePath("/shopping");
}

/**
 * Throws if the user doesn't own the list (directly or via a team).
 */
export async function assertListAccess(listId: string, userId: string): Promise<void> {
  const list = await prisma.shoppingList.findUnique({
    where: { id: listId },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!list) throw new Error("List not found");

  if (list.ownerId === userId) return;

  if (list.ownerTeamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: list.ownerTeamId, userId } },
    });
    if (membership) return;
  }

  throw new Error("Access denied");
}
