"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Note } from "@/types";
import { trackActivity } from "@/actions/activity";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";

const NOTE_INCLUDE = {
  group: true,
  tags: { include: { tag: true } },
  ownerTeam: { select: { id: true, name: true } },
} as const;

type NoteWithRelations = Awaited<ReturnType<typeof fetchNote>>;

async function fetchNote(id: string) {
  return prisma.note.findUnique({
    where: { id },
    include: NOTE_INCLUDE,
  });
}

export async function getNotes(filters?: {
  groupId?: string;
  tagIds?: string[];
  search?: string;
  pinned?: boolean;
}): Promise<Note[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const ownerFilter = {
    OR: [
      { ownerId: user.id },
      ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      { ownerId: null, ownerTeamId: null },
    ],
  };

  const conditions: unknown[] = [ownerFilter];

  if (filters?.groupId === "NO_GROUP") {
    conditions.push({ groupId: null });
  } else if (filters?.groupId) {
    conditions.push({ groupId: filters.groupId });
  }

  if (filters?.pinned) {
    conditions.push({ pinned: true });
  }

  if (filters?.tagIds && filters.tagIds.length > 0) {
    conditions.push({ tags: { some: { tagId: { in: filters.tagIds } } } });
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    conditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const notes = await prisma.note.findMany({
    where: conditions.length > 1 ? { AND: conditions } : ownerFilter,
    include: NOTE_INCLUDE,
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
}): Promise<Note> {
  const user = await requireAuth();

  const note = await prisma.note.create({
    data: {
      title: data.title.trim(),
      content: data.content ?? "",
      isMarkdown: data.isMarkdown ?? false,
      groupId: data.groupId ?? null,
      ownerId: user.id,
      tags: data.tagIds?.length
        ? { create: data.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: NOTE_INCLUDE,
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
  const data: Record<string, unknown> = { ...patch };
  if (patch.title) data.title = patch.title.trim();

  const note = await prisma.note.update({
    where: { id },
    data,
    include: NOTE_INCLUDE,
  });

  void trackActivity("notes", "update_note", { id });
  revalidatePath("/notes");
  return note as Note;
}

export async function deleteNote(id: string): Promise<void> {
  await prisma.note.delete({ where: { id } });
  revalidatePath("/notes");
}

export async function toggleNotePin(id: string): Promise<Note> {
  const note = await prisma.note.findUnique({ where: { id } });
  const updated = await prisma.note.update({
    where: { id },
    data: { pinned: !note?.pinned },
    include: NOTE_INCLUDE,
  });

  revalidatePath("/notes");
  return updated as Note;
}

export async function setNoteTags(id: string, tagIds: string[]): Promise<void> {
  await prisma.noteTag.deleteMany({ where: { noteId: id } });
  if (tagIds.length > 0) {
    await prisma.noteTag.createMany({
      data: tagIds.map((tagId) => ({ noteId: id, tagId })),
    });
  }
  revalidatePath("/notes");
}

export async function addTagToNote(noteId: string, tagId: string): Promise<void> {
  await prisma.noteTag.upsert({
    where: { noteId_tagId: { noteId, tagId } },
    create: { noteId, tagId },
    update: {},
  });
  revalidatePath("/notes");
}

export async function removeTagFromNote(noteId: string, tagId: string): Promise<void> {
  await prisma.noteTag.delete({ where: { noteId_tagId: { noteId, tagId } } });
  revalidatePath("/notes");
}
