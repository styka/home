"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import type { ShoppingList } from "@/types";

export interface ListSummary {
  id: string;
  name: string;
  pendingCount: number;
  totalCount: number;
  teamName: string | null;
  archived?: boolean;
}

export async function getListSummaries(includeArchived = false): Promise<ListSummary[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const lists = await prisma.shoppingList.findMany({
    where: {
      archived: includeArchived,
      OR: [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ],
    },
    include: { ownerTeam: { select: { id: true, name: true } } },
    orderBy: includeArchived ? { archivedAt: "desc" } : { createdAt: "asc" },
  });

  return Promise.all(
    lists.map(async (list) => {
      const [pendingCount, totalCount] = await Promise.all([
        prisma.item.count({ where: { listId: list.id, status: "NEEDED" } }),
        prisma.item.count({ where: { listId: list.id } }),
      ]);
      return {
        id: list.id,
        name: list.name,
        pendingCount,
        totalCount,
        teamName: list.ownerTeam?.name ?? null,
        archived: list.archived,
      };
    })
  );
}

/**
 * Returns all lists visible to the current user:
 * - Lists they personally own
 * - Lists owned by any team they belong to
 */
export async function getLists(): Promise<ShoppingList[]> {
  const user = await requireAuth();

  const teamIds = await getUserTeamIds(user.id);

  return prisma.shoppingList.findMany({
    where: {
      archived: false,
      OR: [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ],
    },
    include: { ownerTeam: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  }) as unknown as Promise<ShoppingList[]>;
}

export async function getArchivedLists(): Promise<ShoppingList[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  return prisma.shoppingList.findMany({
    where: {
      archived: true,
      OR: [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ],
    },
    include: { ownerTeam: { select: { id: true, name: true } } },
    orderBy: { archivedAt: "desc" },
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

export async function archiveList(id: string): Promise<void> {
  const user = await requireAuth();
  await assertListAccess(id, user.id);
  await prisma.shoppingList.update({
    where: { id },
    data: { archived: true, archivedAt: new Date() },
  });
  revalidatePath("/shopping");
  revalidatePath(`/shopping/${id}`);
}

export async function unarchiveList(id: string): Promise<void> {
  const user = await requireAuth();
  await assertListAccess(id, user.id);
  await prisma.shoppingList.update({
    where: { id },
    data: { archived: false, archivedAt: null },
  });
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
