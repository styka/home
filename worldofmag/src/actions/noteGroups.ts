"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { NoteGroup } from "@/types";

export async function getNoteGroups(): Promise<NoteGroup[]> {
  return prisma.noteGroup.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createNoteGroup(data: {
  name: string;
  description?: string;
  color?: string;
}): Promise<NoteGroup> {
  const group = await prisma.noteGroup.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      color: data.color || null,
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
  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.name = patch.name.trim();

  const group = await prisma.noteGroup.update({ where: { id }, data });
  revalidatePath("/notes");
  revalidatePath("/notes/groups");
  return group;
}

export async function deleteNoteGroup(id: string): Promise<void> {
  await prisma.noteGroup.delete({ where: { id } });
  revalidatePath("/notes");
  revalidatePath("/notes/groups");
}
