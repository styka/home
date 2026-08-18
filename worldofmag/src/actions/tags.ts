"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import {
  requireAuth,
  getUserTeamIds,
  ownedOrSystemWhere,
  assertDictionaryAccess,
} from "@/platform/auth/serverUtils";
import type { Tag } from "@/types";
import { SUFIT_LISTY } from "@/platform/pagination";

/**
 * 034: etykiety mają właściciela (C-21) — użytkownik widzi swoje, zespołowe i systemowe (bez
 * właściciela). Unikalność nazwy jest teraz „w obrębie właściciela", więc dwoje użytkowników może
 * mieć etykietę o tej samej nazwie (wcześniej `name` było unikalne globalnie).
 */
async function assertTagAccess(id: string, userId: string): Promise<void> {
  const tag = await prisma.tag.findUnique({
    where: { id },
    select: { ownerId: true, ownerTeamId: true },
  });
  await assertDictionaryAccess(tag, userId, "etykieta");
}

export async function getTags(): Promise<Tag[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  return prisma.tag.findMany({ take: SUFIT_LISTY, where: ownedOrSystemWhere(user.id, teamIds), orderBy: { name: "asc" } });
}

export async function createTag(data: { name: string; color?: string }): Promise<Tag> {
  const user = await requireAuth();
  const name = data.name.trim().toLowerCase();
  // Ta sama nazwa u tego samego właściciela = ta sama etykieta (klucz złożony w bazie).
  const existing = await prisma.tag.findUnique({ where: { ownerId_name: { ownerId: user.id, name } } });
  if (existing) return existing;
  const tag = await prisma.tag.create({
    data: { name, color: data.color || null, ownerId: user.id },
  });
  revalidatePath("/notes");
  revalidatePath("/notes/tags");
  return tag;
}

export async function updateTag(
  id: string,
  patch: { name?: string; color?: string | null }
): Promise<Tag> {
  const user = await requireAuth();
  await assertTagAccess(id, user.id);
  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.name = patch.name.trim().toLowerCase();

  const tag = await prisma.tag.update({ where: { id }, data });
  revalidatePath("/notes");
  revalidatePath("/notes/tags");
  return tag;
}

export async function deleteTag(id: string): Promise<void> {
  const user = await requireAuth();
  await assertTagAccess(id, user.id);
  await prisma.tag.delete({ where: { id } });
  revalidatePath("/notes");
  revalidatePath("/notes/tags");
}
