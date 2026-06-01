"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { reviewCard, type ReviewGrade } from "@/lib/srs";
import type { LanguageDeck, Vocabulary } from "@/types";

async function assertDeckAccess(deckId: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const deck = await prisma.languageDeck.findUnique({
    where: { id: deckId },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!deck) throw new Error("Talia nie istnieje");
  if (deck.ownerId === userId) return;
  if (deck.ownerTeamId && teamIds.includes(deck.ownerTeamId)) return;
  throw new Error("Brak dostępu do talii");
}

async function assertCardAccess(cardId: string, userId: string): Promise<string> {
  const card = await prisma.vocabulary.findUnique({ where: { id: cardId }, select: { deckId: true } });
  if (!card) throw new Error("Słówko nie istnieje");
  await assertDeckAccess(card.deckId, userId);
  return card.deckId;
}

export async function getDecks(): Promise<LanguageDeck[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const now = new Date();

  const decks = await prisma.languageDeck.findMany({
    where: {
      OR: [{ ownerId: user.id }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])],
    },
    include: { _count: { select: { cards: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const deckIds = decks.map((d) => d.id);

  // Liczba kart „na dziś" (do powtórki) per talia.
  const dueRows = await prisma.vocabulary.groupBy({
    by: ["deckId"],
    where: { deckId: { in: deckIds }, dueAt: { lte: now } },
    _count: { _all: true },
  });
  const dueByDeck = new Map(dueRows.map((r) => [r.deckId, r._count._all]));

  // Liczba „przeczonych" kart (repetitions > 0) per talia.
  const learnedRows = await prisma.vocabulary.groupBy({
    by: ["deckId"],
    where: { deckId: { in: deckIds }, repetitions: { gt: 0 } },
    _count: { _all: true },
  });
  const learnedByDeck = new Map(learnedRows.map((r) => [r.deckId, r._count._all]));

  return decks.map((d) => ({
    ...d,
    dueCount: dueByDeck.get(d.id) ?? 0,
    learnedCount: learnedByDeck.get(d.id) ?? 0,
  })) as LanguageDeck[];
}

export async function getDeck(
  id: string
): Promise<(LanguageDeck & { cards: Vocabulary[] }) | null> {
  const user = await requireAuth();
  await assertDeckAccess(id, user.id);
  const deck = await prisma.languageDeck.findUnique({
    where: { id },
    include: {
      _count: { select: { cards: true } },
      cards: { orderBy: { createdAt: "asc" } },
    },
  });
  return deck as (LanguageDeck & { cards: Vocabulary[] }) | null;
}

export async function createDeck(data: {
  name: string;
  description?: string;
  nativeLang: string;
  targetLang: string;
  sourceText?: string;
  ownerTeamId?: string | null;
}): Promise<LanguageDeck> {
  const user = await requireAuth();
  const name = data.name.trim();
  if (!name) throw new Error("Nazwa talii jest wymagana");

  // Jeśli wskazano zespół, użytkownik musi być jego członkiem.
  let ownerTeamId: string | null = null;
  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Brak dostępu do zespołu");
    ownerTeamId = data.ownerTeamId;
  }

  const deck = await prisma.languageDeck.create({
    data: {
      name,
      description: data.description?.trim() || null,
      nativeLang: data.nativeLang.trim() || "polski",
      targetLang: data.targetLang.trim() || "angielski",
      sourceText: data.sourceText?.trim() || null,
      ownerId: ownerTeamId ? null : user.id,
      ownerTeamId,
    },
  });
  revalidatePath("/languages");
  return deck as LanguageDeck;
}

export async function updateDeck(
  id: string,
  patch: { name?: string; description?: string | null; nativeLang?: string; targetLang?: string }
): Promise<void> {
  const user = await requireAuth();
  await assertDeckAccess(id, user.id);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.nativeLang !== undefined) data.nativeLang = patch.nativeLang.trim();
  if (patch.targetLang !== undefined) data.targetLang = patch.targetLang.trim();
  await prisma.languageDeck.update({ where: { id }, data });
  revalidatePath("/languages");
  revalidatePath(`/languages/${id}`);
}

export async function deleteDeck(id: string): Promise<void> {
  const user = await requireAuth();
  await assertDeckAccess(id, user.id);
  await prisma.languageDeck.delete({ where: { id } });
  revalidatePath("/languages");
}

export async function addWord(
  deckId: string,
  data: { term: string; translation: string; example?: string | null; partOfSpeech?: string | null; notes?: string | null }
): Promise<Vocabulary> {
  const user = await requireAuth();
  await assertDeckAccess(deckId, user.id);
  const term = data.term.trim();
  const translation = data.translation.trim();
  if (!term || !translation) throw new Error("Słówko i tłumaczenie są wymagane");
  const card = await prisma.vocabulary.create({
    data: {
      deckId,
      term,
      translation,
      example: data.example?.trim() || null,
      partOfSpeech: data.partOfSpeech?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
  await prisma.languageDeck.update({ where: { id: deckId }, data: { updatedAt: new Date() } });
  revalidatePath(`/languages/${deckId}`);
  revalidatePath("/languages");
  return card as Vocabulary;
}

export async function bulkAddWords(
  deckId: string,
  words: Array<{ term: string; translation: string; example?: string | null; partOfSpeech?: string | null }>
): Promise<number> {
  const user = await requireAuth();
  await assertDeckAccess(deckId, user.id);
  const clean = words
    .map((w) => ({
      deckId,
      term: (w.term ?? "").trim(),
      translation: (w.translation ?? "").trim(),
      example: w.example?.trim() || null,
      partOfSpeech: w.partOfSpeech?.trim() || null,
    }))
    .filter((w) => w.term && w.translation);
  if (clean.length === 0) return 0;
  await prisma.vocabulary.createMany({ data: clean });
  await prisma.languageDeck.update({ where: { id: deckId }, data: { updatedAt: new Date() } });
  revalidatePath(`/languages/${deckId}`);
  revalidatePath("/languages");
  return clean.length;
}

export async function updateWord(
  id: string,
  patch: { term?: string; translation?: string; example?: string | null; partOfSpeech?: string | null; notes?: string | null }
): Promise<void> {
  const user = await requireAuth();
  const deckId = await assertCardAccess(id, user.id);
  const data: Record<string, unknown> = {};
  if (patch.term !== undefined) data.term = patch.term.trim();
  if (patch.translation !== undefined) data.translation = patch.translation.trim();
  if (patch.example !== undefined) data.example = patch.example?.trim() || null;
  if (patch.partOfSpeech !== undefined) data.partOfSpeech = patch.partOfSpeech?.trim() || null;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  await prisma.vocabulary.update({ where: { id }, data });
  revalidatePath(`/languages/${deckId}`);
}

export async function deleteWord(id: string): Promise<void> {
  const user = await requireAuth();
  const deckId = await assertCardAccess(id, user.id);
  await prisma.vocabulary.delete({ where: { id } });
  revalidatePath(`/languages/${deckId}`);
  revalidatePath("/languages");
}

/** Karty do powtórki: najpierw zaległe (dueAt <= teraz), posortowane od najdawniej należnych. */
export async function getDueCards(deckId: string, limit = 50): Promise<Vocabulary[]> {
  const user = await requireAuth();
  await assertDeckAccess(deckId, user.id);
  const cards = await prisma.vocabulary.findMany({
    where: { deckId, dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
  return cards as Vocabulary[];
}

export async function submitReview(cardId: string, grade: ReviewGrade): Promise<void> {
  const user = await requireAuth();
  const deckId = await assertCardAccess(cardId, user.id);
  const card = await prisma.vocabulary.findUnique({ where: { id: cardId } });
  if (!card) throw new Error("Słówko nie istnieje");

  const next = reviewCard(
    {
      easeFactor: card.easeFactor,
      intervalDays: card.intervalDays,
      repetitions: card.repetitions,
      lapses: card.lapses,
    },
    grade
  );

  await prisma.vocabulary.update({
    where: { id: cardId },
    data: {
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      dueAt: next.dueAt,
      lastReviewedAt: next.lastReviewedAt,
    },
  });
  revalidatePath(`/languages/${deckId}`);
  revalidatePath("/languages");
}
