"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import { createTask, tasksModule } from "@/modules/tasks/contract";
import { updateWithVersion } from "@/platform/concurrency/version";
import { prisma } from "@/platform/db/prisma";
import { requireAuth, getUserTeamIds, getAccessibleTeamIds, ownedWhereAsync } from "@/platform/auth/serverUtils";
import type { Note } from "@/types";
import { trackActivity } from "@/actions/activity";
import { recordTrash } from "@/platform/trash/trash";
import { rankNotesBySearch } from "../lib/searchRank";
import { requireModuleAccess, idNotatekNadanychMi } from "../lib/sharingGuard";
import { wlasnoscDoZapisu, przestrzenZespoluBezKontroliDostepu } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";

/**
 * 095: dostęp do JEDNEJ notatki rozstrzyga platforma (`platform/sharing`), a nie moduł.
 *
 * Do 095 był tu `assertOwnership` — „czy notatka jest w którejś z moich przestrzeni". Dla
 * członka przestrzeni wynik jest **identyczny**: deklaracja odwzorowuje obu rodzajów członków na
 * `manager`, a `getAccessContext` liczy przestrzenie tą samą funkcją (`getUserTeamIds`), której
 * używał `assertOwnership`. Zmienia się wyłącznie to, czego wcześniej nie było: NADANIA.
 *
 * Rozdzielenie `note.read` / `note.edit` ma znaczenie tylko dla nadań — dla członka przestrzeni
 * obie operacje wychodzą tak samo, bo obie zaspokaja rola `manager`.
 */
async function assertNoteAccess(
  noteId: string,
  userId: string,
  operation: "note.read" | "note.edit" = "note.edit",
): Promise<void> {
  const note = await prisma.note.findUnique({ where: { id: noteId }, select: { id: true } });
  if (!note) throw new Error("Notatka nie istnieje");
  try {
    await requireModuleAccess(userId, { type: "notes.note", id: noteId }, operation);
  } catch {
    throw new Error("Brak dostępu do notatki");
  }
}

export async function getNotes(filters?: {
  groupId?: string;
  tagIds?: string[];
  search?: string;
  pinned?: boolean;
  ownerTeamId?: string;
}): Promise<Note[]> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "notes");

  /**
   * 095: lista obejmuje moje przestrzenie ORAZ notatki nadane mi wprost.
   *
   * Bez tej drugiej gałęzi udostępnienie notatki było prawdziwe i niewidoczne: `assertNoteAccess`
   * przepuszczał obdarowanego, ale notatka nie pojawiała się nigdzie, gdzie jej szuka — a modułu
   * Notatki nie da się otworzyć „po adresie zasobu", bo listę renderuje jedna strona.
   * `idNotatekNadanychMi` pomija nadania linkowe i odziedziczone (patrz `platform/sharing/nadaneMi`).
   */
  const zakresPrzestrzeni = await ownedWhereAsync(user.id);
  const nadaneMi = await idNotatekNadanychMi(user.id);
  const where: Record<string, unknown> = nadaneMi.length
    ? { OR: [zakresPrzestrzeni, { id: { in: nadaneMi } }] }
    : { ...zakresPrzestrzeni };

  if (filters?.groupId === "NO_GROUP") {
    where.groupId = null;
  } else if (filters?.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters?.pinned) {
    where.pinned = true;
  }

  if (filters?.ownerTeamId) {
    // 095: zawężenie do notatek JEDNEGO zespołu. Po migracji 0244 `Note` nie ma kolumny
    // `ownerTeamId` — zespół wyraża jego przestrzeń. Dostęp sprawdza `teamIds` z zakresu modułu:
    // przestrzeń zespołu, do którego użytkownik nie należy, nie przejdzie przez ten warunek.
    if (!teamIds.includes(filters.ownerTeamId)) return [];
    where.workspaceId = await przestrzenZespoluBezKontroliDostepu(filters.ownerTeamId);
    delete where.OR;
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
    take: SUFIT_LISTY,
    where,
    include: { group: true, tags: { include: { tag: true } } },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  // Z-240 (T-16): przy wyszukiwaniu przesuwamy najtrafniejsze na górę (ranking app-level;
  // sam filtr korzysta z indeksu trigramowego pg_trgm — migracja 0201). Bez `search`
  // kolejność zostaje domyślna [pinned, updatedAt] — zero zmian zachowania.
  if (filters?.search) {
    return rankNotesBySearch(notes as Note[], filters.search);
  }

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
    const teamIds = await getAccessibleTeamIds(user.id, "notes");
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  const note = await prisma.note.create({
    data: {
      title: data.title.trim(),
      content: data.content ?? "",
      isMarkdown: data.isMarkdown ?? false,
      groupId: data.groupId ?? null,
      ...(await wlasnoscDoZapisu(user.id, data.ownerTeamId)),
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
  },
  /** 062: wersja odczytana przed edycją. Pominięta = zapis bez kontroli, jak przed 062. */
  expectedVersion?: number,
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
        take: SUFIT_LISTY,
        where: { noteId: id }, orderBy: { createdAt: "desc" }, skip: 20, select: { id: true },
      });
      if (old.length) await prisma.noteRevision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
    }
  }

  const data: Record<string, unknown> = { ...patch };
  if (patch.title) data.title = patch.title.trim();

  // 062: zapis idzie przez mechanizm wersji (rozdz. 8.5). `expectedVersion` jest opcjonalne —
  // dopóki UI go nie podaje, zachowanie jest identyczne jak dotąd, ale wersja rośnie, więc
  // zadanie 16 dostanie na czym oprzeć `ConflictDialog`.
  await updateWithVersion(prisma.note, "notes.note", id, data, expectedVersion);
  const note = await prisma.note.findUniqueOrThrow({
    where: { id },
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
        pinned: full.pinned, groupId: full.groupId,
        // 078: migawka zapisuje też PRZESTRZEŃ. Bez tego pola przywrócenie notatki po usunięciu
        // kolumn własnościowych nie miałoby z czego odtworzyć, gdzie ta notatka mieszkała.
        workspaceId: full.workspaceId,
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
  await assertNoteAccess(noteId, user.id, "note.read");
  const rows = await prisma.noteAttachment.findMany({ take: SUFIT_LISTY, where: { noteId }, orderBy: { createdAt: "desc" } });
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
  await assertNoteAccess(noteId, user.id, "note.read");
  const rows = await prisma.noteRevision.findMany({
    take: SUFIT_LISTY,
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

/**
 * 115 (Z-INT-09): notatka to często ustalenie, z którego ma wyniknąć czynność —
 * „Do zadań" tworzy zadanie z tytułem notatki i odnośnikiem zwrotnym.
 */
export async function createTaskFromNote(noteId: string): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertNoteAccess(noteId, user.id);
  const session = await auth();
  if (!hasPermission(session, tasksModule.permission)) throw new Error("Brak dostępu do modułu Zadania");
  const note = await prisma.note.findUnique({ where: { id: noteId }, select: { title: true, content: true } });
  if (!note) throw new Error("Notatka nie istnieje");
  const fragment = (note.content ?? "").trim().split("\n").find((l) => l.trim()) ?? "";
  const opis = [fragment ? fragment.slice(0, 200) : null, "Notatka: /notes"].filter(Boolean).join("\n");
  const task = await createTask({ title: note.title, description: opis });
  revalidatePath("/tasks");
  return { id: task.id };
}
