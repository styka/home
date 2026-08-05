"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import {
  requireAuth,
  getUserTeamIds,
  ownedOrSystemWhere,
  assertDictionaryAccess,
} from "@/platform/auth/serverUtils";
import type { NoteGroup } from "@/types";

/**
 * 034: grupy notatek mają właściciela (C-21). Widzimy swoje, zespołowe i systemowe (bez
 * właściciela — wspólne dla wszystkich kont, tak jak kategorie systemowe). Wcześniej model nie miał
 * kolumny właściciela, więc każda grupa była widoczna dla każdego konta.
 */
async function assertNoteGroupAccess(id: string, userId: string): Promise<void> {
  const group = await prisma.noteGroup.findUnique({
    where: { id },
    select: { ownerId: true, ownerTeamId: true },
  });
  await assertDictionaryAccess(group, userId, "folder notatek");
}

export async function getNoteGroups(): Promise<NoteGroup[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  return prisma.noteGroup.findMany({
    where: ownedOrSystemWhere(user.id, teamIds),
    orderBy: { createdAt: "asc" },
  });
}

export async function createNoteGroup(data: {
  name: string;
  description?: string;
  color?: string;
}): Promise<NoteGroup> {
  const user = await requireAuth();
  const group = await prisma.noteGroup.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      color: data.color || null,
      ownerId: user.id,
    },
  });
  revalidatePath("/notes");
  revalidatePath("/notes/groups");
  return group;
}

export async function updateNoteGroup(
  id: string,
  patch: { name?: string; description?: string | null; color?: string | null }
): Promise<NoteGroup> {
  const user = await requireAuth();
  await assertNoteGroupAccess(id, user.id);
  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.name = patch.name.trim();

  const group = await prisma.noteGroup.update({ where: { id }, data });
  revalidatePath("/notes");
  revalidatePath("/notes/groups");
  return group;
}

export async function deleteNoteGroup(id: string): Promise<void> {
  const user = await requireAuth();
  await assertNoteGroupAccess(id, user.id);
  await prisma.noteGroup.delete({ where: { id } });
  revalidatePath("/notes");
  revalidatePath("/notes/groups");
}
