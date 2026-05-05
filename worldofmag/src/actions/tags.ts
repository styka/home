"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Tag } from "@/types";

export async function getTags(): Promise<Tag[]> {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

export async function createTag(data: { name: string; color?: string }): Promise<Tag> {
  const tag = await prisma.tag.create({
    data: {
      name: data.name.trim().toLowerCase(),
      color: data.color || null,
    },
  });
  revalidatePath("/notes");
  revalidatePath("/notes/tags");
  return tag;
}

export async function updateTag(
  id: string,
  patch: { name?: string; color?: string | null }
): Promise<Tag> {
  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.name = patch.name.trim().toLowerCase();

  const tag = await prisma.tag.update({ where: { id }, data });
  revalidatePath("/notes");
  revalidatePath("/notes/tags");
  return tag;
}

export async function deleteTag(id: string): Promise<void> {
  await prisma.tag.delete({ where: { id } });
  revalidatePath("/notes");
  revalidatePath("/notes/tags");
}
