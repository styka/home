"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import type { Note } from "@/types";
import { trackActivity } from "@/actions/activity";

async function assertNoteAccess(noteId: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!note) throw new Error("Notatka nie istnieje");
  if (note.ownerId === userId) return;
  if (note.ownerTeamId && teamIds.includes(note.ownerTeamId)) return;
  throw new Error("Brak dostępu do notatki");
}

export async function getNotes(filters?: {
  groupId?: string;
  tagIds?: string[];
  search?: string;
  pinned?: boolean;
  ownerTeamId?: string;
}): Promise<Note[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const where: Record<string, unknown> = {
    OR: [
      { ownerId: user.id },
      teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : null,
    ].filter(Boolean),
  };

  if (filters?.groupId === "NO_GROUP") {
    where.groupId = null;
  } else if (filters?.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters?.pinned) {
    where.pinned = true;
  }

  if (filters?.ownerTeamId) {
    // Narrow to a specific team's notes only
    where.OR = [{ ownerTeamId: filters.ownerTeamId }];
  }

  if (filters?.tagIds && filters.tagIds.length > 0) {
    where.tags = { some: { tagId: { in: filters.tagIds } } };
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    where.AND = [
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const notes = await prisma.note.findMany({
    where,
    include: { group: true, tags: { include: { tag: true } } },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  return notes as Note[];
}

export async function createNote(data: {
  title: string;
  content?: string;
  isMarkdown?: boolean;
  groupId?: string | null;
  tagIds?: string[];
  ownerTeamId?: string;
}): Promise<Note> {
  const user = await requireAuth();

  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  const note = await prisma.note.create({
    data: {
      title: data.title.trim(),
      content: data.content ?? "",
      isMarkdown: data.isMarkdown ?? false,
      groupId: data.groupId ?? null,
      ownerId: data.ownerTeamId ? null : user.id,
      ownerTeamId: data.ownerTeamId ?? null,
      tags: data.tagIds?.length
        ? { create: data.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: { group: true, tags: { include: { tag: true } } },
  });

  void trackActivity("notes", "create_note", { title: data.title });
  revalidatePath("/notes");
  return note as Note;
}

export async function updateNote(
  id: string,
  patch: {
    title?: string;
    content?: string;
    isMarkdown?: boolean;
    groupId?: string | null;
    pinned?: boolean;
  }
): Promise<Note> {
  const user = await requireAuth();
  await assertNoteAccess(id, user.id);

  const data: Record<string, unknown> = { ...patch };
  if (patch.title) data.title = patch.title.trim();

  const note = await prisma.note.update({
    where: { id },
    data,
    include: { group: true, tags: { include: { tag: true } } },
  });

  void trackActivity("notes", "update_note", { id });
  revalidatePath("/notes");
  return note as Note;
}

export async function deleteNote(id: string): Promise<void> {
  const user = await requireAuth();
  await assertNoteAccess(id, user.id);
  await prisma.note.delete({ where: { id } });
  revalidatePath("/notes");
}

export async function toggleNotePin(id: string): Promise<Note> {
  const user = await requireAuth();
  await assertNoteAccess(id, user.id);

  const note = await prisma.note.findUnique({ where: { id } });
  const updated = await prisma.note.update({
    where: { id },
    data: { pinned: !note?.pinned },
    include: { group: true, tags: { include: { tag: true } } },
  });

  revalidatePath("/notes");
  return updated as Note;
}

export async function setNoteTags(id: string, tagIds: string[]): Promise<void> {
  const user = await requireAuth();
  await assertNoteAccess(id, user.id);
  await prisma.noteTag.deleteMany({ where: { noteId: id } });
  if (tagIds.length > 0) {
    await prisma.noteTag.createMany({
      data: tagIds.map((tagId) => ({ noteId: id, tagId })),
    });
  }
  revalidatePath("/notes");
}

export async function addTagToNote(noteId: string, tagId: string): Promise<void> {
  const user = await requireAuth();
  await assertNoteAccess(noteId, user.id);
  await prisma.noteTag.upsert({
    where: { noteId_tagId: { noteId, tagId } },
    create: { noteId, tagId },
    update: {},
  });
  revalidatePath("/notes");
}

export async function removeTagFromNote(noteId: string, tagId: string): Promise<void> {
  const user = await requireAuth();
  await assertNoteAccess(noteId, user.id);
  await prisma.noteTag.delete({ where: { noteId_tagId: { noteId, tagId } } });
  revalidatePath("/notes");
}
