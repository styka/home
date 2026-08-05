// Z-010: handler akcji asystenta dla modułu Notatki.
// Scala oba dawne bloki `module === "notes"` (CRUD + toggle_pin) z execute/route.ts.
import { prisma } from "@/platform/db/prisma";
import { createNote, updateNote, deleteNote, toggleNotePin, setNoteTags } from "@/actions/notes";
import { getTags, createTag } from "@/actions/tags";
import { createNoteGroup, updateNoteGroup, deleteNoteGroup } from "@/actions/noteGroups";
import { asStr, undoAction, resolveNoteId, type ExecOutcome } from "@/lib/ai/executors/shared";
import { getUserTeamIds, ownedOrSystemWhere } from "@/platform/auth/serverUtils";
import type { AIAction } from "@/lib/ai/aiAction";

// Zamień nazwy tagów notatek na id (znajdź istniejący po nazwie, inaczej utwórz).
async function resolveNoteTagIds(names: unknown): Promise<string[]> {
  const list = Array.isArray(names) ? names.map((n) => asStr(n)).filter((n): n is string => !!n) : [];
  if (list.length === 0) return [];
  const existing = await getTags();
  const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  for (const name of list) {
    const key = name.trim().toLowerCase();
    const found = byName.get(key);
    if (found) { ids.push(found); continue; }
    const created = await createTag({ name });
    byName.set(key, created.id);
    ids.push(created.id);
  }
  return ids;
}

/**
 * 034: JEDNO miejsce, w którym asystent szuka grupy notatek po nazwie — dzięki temu zawężenie do
 * właściciela (C-21) jest wpięte raz, a nie w każdym typie akcji z osobna.
 */
async function findAccessibleNoteGroup(userId: string, name: string): Promise<{ id: string } | null> {
  const teamIds = await getUserTeamIds(userId);
  return prisma.noteGroup.findFirst({
    where: { ...ownedOrSystemWhere(userId, teamIds), name: { contains: name, mode: "insensitive" } },
    select: { id: true },
  });
}

/**
 * 034: `groupName` → id grupy notatek. Katalog akcji nie miał wcześniej ŻADNEGO sposobu, by wskazać
 * grupę przy tworzeniu notatki, więc model wymyślał parametr `groupName`, a executor go ignorował —
 * notatka lądowała poza grupą (zgłoszenie Z1). Dopasowanie po nazwie, jak `projectName` w zadaniach;
 * nieznana nazwa = brak grupy (notatka i tak powstaje, zamiast wywalać całą akcję).
 */
async function resolveNoteGroupId(userId: string, params: Record<string, unknown>): Promise<string | null> {
  const name = asStr(params.groupName)?.trim();
  if (!name) return null;
  const group = await findAccessibleNoteGroup(userId, name);
  return group?.id ?? null;
}

export async function executeNotesAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "create_note") {
    const groupId = await resolveNoteGroupId(userId, params);
    const note = await createNote({
      title: asStr(params.title) ?? "Nowa notatka",
      content: asStr(params.content) ?? "",
      groupId,
    });
    const msg = `Utworzono notatkę "${note.title}"`;
    const undo = undoAction("notes", "delete_note", { noteId: note.id }, `Usuń notatkę "${note.title}"`);
    if (params.openAfter === true) {
      return { message: msg, undo, navigateTo: `/notes?focus=${note.id}`, navigateLabel: `Otwórz „${note.title}”` };
    }
    return { message: msg, undo };
  }

  if (type === "append_to_note") {
    const id = await resolveNoteId(userId, params, searchQuery);
    const existing = await prisma.note.findUnique({ where: { id }, select: { content: true } });
    const addition = asStr(params.content) ?? "";
    const newContent = existing?.content ? `${existing.content}\n\n${addition}` : addition;
    const note = await updateNote(id, { content: newContent });
    return `Dopisano do notatki "${note.title}"`;
  }

  if (type === "update_note") {
    const id = await resolveNoteId(userId, params, searchQuery);
    const before = await prisma.note.findUnique({ where: { id }, select: { title: true, content: true } });
    const patch: Parameters<typeof updateNote>[1] = {};
    const undoParams: Record<string, unknown> = { noteId: id };
    if (params.title !== undefined) { patch.title = String(params.title); undoParams.title = before?.title ?? ""; }
    if (params.content !== undefined) { patch.content = String(params.content); undoParams.content = before?.content ?? ""; }
    // 034: przeniesienie notatki do grupy wskazanej nazwą (nieznana nazwa = zostawiamy grupę bez zmian).
    if (params.groupName !== undefined) {
      const groupId = await resolveNoteGroupId(userId, params);
      if (groupId) patch.groupId = groupId;
    }
    const note = await updateNote(id, patch);
    const undo = before
      ? { ...undoAction("notes", "update_note", undoParams, `Cofnij zmiany w notatce "${note.title}"`), searchQuery: note.title }
      : undefined;
    return { message: `Zaktualizowano notatkę "${note.title}"`, undo };
  }

  if (type === "delete_note") {
    const id = await resolveNoteId(userId, params, searchQuery);
    const existing = await prisma.note.findUnique({ where: { id }, select: { title: true } });
    await deleteNote(id);
    return `Usunięto notatkę "${existing?.title ?? ""}"`;
  }

  if (type === "toggle_pin") {
    const id = await resolveNoteId(userId, params, searchQuery);
    const note = await toggleNotePin(id);
    return note.pinned ? `Przypięto notatkę „${note.title}"` : `Odpięto notatkę „${note.title}"`;
  }

  if (type === "set_note_tags") {
    const id = await resolveNoteId(userId, params, searchQuery);
    const note = await prisma.note.findUnique({
      where: { id },
      select: { title: true, tags: { select: { tagId: true, tag: { select: { name: true } } } } },
    });
    const addIds = await resolveNoteTagIds(params.tags);
    const removeNames = (Array.isArray(params.removeTags) ? params.removeTags : [])
      .map((n) => asStr(n)?.toLowerCase())
      .filter((n): n is string => !!n);
    let finalIds: string[];
    if (params.replace === true) {
      finalIds = addIds;
    } else {
      const existingIds = (note?.tags ?? [])
        .filter((t) => !removeNames.includes(t.tag.name.toLowerCase()))
        .map((t) => t.tagId);
      finalIds = Array.from(new Set([...existingIds, ...addIds]));
    }
    await setNoteTags(id, finalIds);
    return `Zaktualizowano tagi notatki "${note?.title ?? ""}"`;
  }

  if (type === "create_note_group") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę grupy notatek");
    const g = await createNoteGroup({ name, description: asStr(params.description), color: asStr(params.color) });
    return `Utworzono grupę notatek „${g.name}"`;
  }
  if (type === "update_note_group" || type === "delete_note_group") {
    const q = searchQuery ?? asStr(params.name);
    const gid = asStr(params.groupId);
    const teamIds = await getUserTeamIds(userId);
    const g = gid
      ? await prisma.noteGroup.findFirst({ where: { ...ownedOrSystemWhere(userId, teamIds), id: gid }, select: { id: true } })
      : await findAccessibleNoteGroup(userId, q ?? "");
    if (!g) throw new Error(`Nie znaleziono grupy notatek: „${q ?? gid ?? ""}"`);
    if (type === "delete_note_group") { await deleteNoteGroup(g.id); return `Usunięto grupę notatek`; }
    await updateNoteGroup(g.id, { name: asStr(params.name), description: asStr(params.description) ?? null, color: asStr(params.color) ?? null });
    return `Zaktualizowano grupę notatek`;
  }

  throw new Error(`Nieznany typ akcji notatek: ${type}`);
}
