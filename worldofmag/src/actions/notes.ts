"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import type { Note } from "@/types";
import { trackActivity } from "@/actions/activity";
import { recordTrash } from "@/lib/trash";

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

  // N4: gdy zmienia się tytuł/treść — zapisz migawkę POPRZEDNIEJ wersji (historia).
  if (patch.title !== undefined || patch.content !== undefined) {
    const prev = await prisma.note.findUnique({ where: { id }, select: { title: true, content: true } });
    const newTitle = patch.title !== undefined ? patch.title.trim() : prev?.title;
    const newContent = patch.content !== undefined ? patch.content : prev?.content;
    if (prev && (prev.title !== newTitle || prev.content !== newContent)) {
      await prisma.noteRevision.create({ data: { noteId: id, title: prev.title, content: prev.content } });
      // Zostaw maks. 20 ostatnich migawek.
      const old = await prisma.noteRevision.findMany({
        where: { noteId: id }, orderBy: { createdAt: "desc" }, skip: 20, select: { id: true },
      });
      if (old.length) await prisma.noteRevision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
    }
  }

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

  // H5: migawka do kosza przed usunięciem (z tagami do późniejszego re-linkowania).
  const full = await prisma.note.findUnique({
    where: { id },
    include: { tags: { select: { tagId: true } } },
  });
  if (full) {
    await recordTrash(user.id, {
      module: "notes",
      entityId: full.id,
      title: full.title,
      payload: {
        id: full.id, title: full.title, content: full.content, isMarkdown: full.isMarkdown,
        pinned: full.pinned, groupId: full.groupId, ownerId: full.ownerId, ownerTeamId: full.ownerTeamId,
        createdAt: full.createdAt, tagIds: full.tags.map((t) => t.tagId),
      },
    });
  }

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

// ─── N3 załączniki notatki ──────────────────────────────────────────────────

export type NoteAttachmentDTO = { id: string; name: string; url: string; createdAt: string };

export async function getNoteAttachments(noteId: string): Promise<NoteAttachmentDTO[]> {
  const user = await requireAuth();
  await assertNoteAccess(noteId, user.id);
  const rows = await prisma.noteAttachment.findMany({ where: { noteId }, orderBy: { createdAt: "desc" } });
  return rows.map((a) => ({ id: a.id, name: a.name, url: a.url, createdAt: a.createdAt.toISOString() }));
}

export async function addNoteAttachment(noteId: string, name: string, url: string): Promise<void> {
  const user = await requireAuth();
  await assertNoteAccess(noteId, user.id);
  const n = name.trim() || "Załącznik";
  if (!url || (!url.startsWith("data:") && !url.startsWith("http"))) throw new Error("Nieprawidłowy plik");
  if (url.length > 3_500_000) throw new Error("Plik jest za duży (max ~2,5 MB)");
  await prisma.noteAttachment.create({ data: { noteId, name: n, url } });
  revalidatePath("/notes");
}

export async function deleteNoteAttachment(id: string): Promise<void> {
  const user = await requireAuth();
  const att = await prisma.noteAttachment.findUnique({ where: { id }, select: { noteId: true } });
  if (!att) throw new Error("Załącznik nie istnieje");
  await assertNoteAccess(att.noteId, user.id);
  await prisma.noteAttachment.delete({ where: { id } });
  revalidatePath("/notes");
}

// ─── N4 historia wersji notatki ─────────────────────────────────────────────

export type NoteRevisionDTO = { id: string; title: string; content: string; createdAt: string };

export async function getNoteRevisions(noteId: string): Promise<NoteRevisionDTO[]> {
  const user = await requireAuth();
  await assertNoteAccess(noteId, user.id);
  const rows = await prisma.noteRevision.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Przywraca treść z migawki. Aktualny stan trafia najpierw do historii (przez updateNote). */
export async function restoreNoteRevision(revisionId: string): Promise<void> {
  const user = await requireAuth();
  const rev = await prisma.noteRevision.findUnique({ where: { id: revisionId } });
  if (!rev) throw new Error("Wersja nie istnieje");
  await assertNoteAccess(rev.noteId, user.id);
  await updateNote(rev.noteId, { title: rev.title, content: rev.content });
  revalidatePath("/notes");
}
