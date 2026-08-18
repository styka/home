import { getDueCards, getStudyStreak } from "../contract";
import { getUserTeamIds, ownedWhereAsync } from "@/platform/auth/serverUtils";
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, clampLimit, asStr, ownerScope } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_decks: args {} → [{ id, name, nativeLang, targetLang }]. Talie fiszek (nauka języków).",
  "- list_due_cards: args { deckName, limit? } → [{ id, term, translation }]. Fiszki do powtórki w danej talii.",
  "- get_study_streak: args {} → { streak, reviewedToday }. Passa nauki języków.",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_decks: async (args, userId) => {
      const decks = await prisma.languageDeck.findMany({
        where: await ownerScope(userId),
        select: { id: true, name: true, nativeLang: true, targetLang: true },
        orderBy: { updatedAt: "desc" },
        take: HARD_MAX,
      });
      return decks;
  },
  list_due_cards: async (args, userId) => {
      const deckName = asStr(args.deckName) ?? asStr(args.search);
      const deck = await prisma.languageDeck.findFirst({
        where: {
          ...(await ownedWhereAsync(userId)),
          ...(deckName ? { name: { contains: deckName, mode: "insensitive" as const } } : {}),
        },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
      });
      if (!deck) return { note: "Nie znaleziono talii fiszek." };
      const cards = await getDueCards(deck.id, clampLimit(args.limit));
      return { deck: deck.name, cards: cards.map((c) => ({ id: c.id, term: c.term, translation: c.translation })) };
  },
  get_study_streak: async (args, userId) => {
      return getStudyStreak();
  },
};
