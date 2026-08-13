import { getNoteGroups } from "../contract";
import { getTags } from "@/actions/tags";
import { getUserTeamIds, ownedWhere, ownedOr } from "@/platform/auth/serverUtils";
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, clampLimit, asStr, resolveIdOrName } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_notes: args { search?, limit? } → [{ id, title, snippet, updatedAt, pinned? }]. Lista (snippet skrócony; pinned:true = notatka przypięta). Do PEŁNEJ treści użyj get_note.",
  "- get_note: args { noteId? | search? } → { id, title, content, updatedAt } | null. PEŁNA treść jednej notatki — wywołaj PRZED przepisaniem/edycją treści (update_note/append_to_note), gdy potrzebujesz aktualnego tekstu.",
  "- list_note_tags: args {} → [{ id, name }]. Dostępne etykiety notatek.",
  "- list_note_groups: args {} → [{ id, name }]. Grupy (foldery) notatek.",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_notes: async (args, userId) => {
      const search = asStr(args.search);
      const teamIds = await getUserTeamIds(userId);
      const where: Record<string, unknown> = {
        ...ownedWhere(userId, teamIds),
      };
      if (search) {
        where.AND = [
          {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { content: { contains: search, mode: "insensitive" } },
            ],
          },
        ];
      }
      const notes = await prisma.note.findMany({
        where,
        select: { id: true, title: true, content: true, updatedAt: true, pinned: true },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        take: clampLimit(args.limit),
      });
      // 030: pinned tylko-gdy-ustawione (audyt AC-4 — model ma widzieć stan przypięcia).
      return notes.map((n) => ({
        id: n.id,
        title: n.title,
        snippet: (n.content ?? "").slice(0, 120),
        updatedAt: n.updatedAt.toISOString(),
        ...(n.pinned ? { pinned: true } : {}),
      }));
  },
  get_note: async (args, userId) => {
      const noteId = asStr(args.noteId);
      const search = asStr(args.search);
      const teamIds = await getUserTeamIds(userId);
      const ownerOr = ownedOr(userId, teamIds);
      // 032: `noteId` bywa TYTUŁEM notatki — rozwiąż, zamiast cicho zwrócić null.
      const resolvedNoteId = noteId
        ? await resolveIdOrName(
            noteId,
            "notatki",
            async (id) => (await prisma.note.findFirst({ where: { id, OR: ownerOr }, select: { id: true } }))?.id ?? null,
            async () =>
              prisma.note.findMany({ where: { OR: ownerOr }, select: { id: true, title: true }, take: HARD_MAX }).then((rows) =>
                rows.map((n) => ({ id: n.id, name: n.title }))
              )
          )
        : undefined;
      const note = await prisma.note.findFirst({
        where: resolvedNoteId
          ? { id: resolvedNoteId, OR: ownerOr }
          : {
              OR: ownerOr,
              ...(search
                ? {
                    AND: [
                      {
                        OR: [
                          { title: { contains: search, mode: "insensitive" } },
                          { content: { contains: search, mode: "insensitive" } },
                        ],
                      },
                    ],
                  }
                : {}),
            },
        select: { id: true, title: true, content: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      });
      if (!note) return null;
      return {
        id: note.id,
        title: note.title,
        content: note.content ?? "",
        updatedAt: note.updatedAt.toISOString(),
      };
  },
  list_note_tags: async (args, userId) => {
      const tags = await getTags();
      return tags.map((t) => ({ id: t.id, name: t.name }));
  },
  list_note_groups: async (args, userId) => {
      const groups = await getNoteGroups();
      return groups.map((g) => ({ id: g.id, name: g.name }));
  },
};
