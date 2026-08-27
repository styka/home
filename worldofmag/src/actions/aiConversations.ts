"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import type { Prisma } from "@prisma/client";
import { MESSAGE_WINDOW, DRAFT_MAX_CHARS, boundMessageData } from "@/platform/ai/conversationLimits";
import { deriveTitle } from "@/platform/ai/conversationTitle";

// Pamięć rozmów asystenta AID ("magiczna ikona"). Wszystko per-user (ownerId === userId);
// rozmowy zespołowe nie istnieją — to prywatny asystent użytkownika.

export type ConversationMeta = {
  id: string;
  title: string;
  updatedAt: Date;
  /** 106: czy rozmowa stoi na liście „Zapisane" (a nie w historii). */
  saved: boolean;
};

/**
 * 106: rozmowy w DWÓCH rozłącznych listach. Jedno pole `saved` jest jedynym źródłem podziału,
 * więc rozmowa nie ma jak trafić na obie naraz ani zniknąć z obu.
 */
export type ConversationLists = {
  zapisane: ConversationMeta[];
  historia: ConversationMeta[];
};

export type StoredMessage = {
  id: string;
  role: string; // "user" | "assistant"
  content: string;
  kind: string; // "text" | "plan" | "report" | "navigate" | "clarify" | "results"
  data: unknown;
  createdAt: Date;
};

/**
 * Rozmowy użytkownika w dwóch listach (meta, najnowsze na górze).
 *
 * 106: DWA rozłączne zapytania, nie jedno z podziałem po stronie klienta. Wcześniej było jedno
 * z `take: 50`, czyli „50 najnowszych W OGÓLE" — rozmowa zapisana pół roku temu wypadała z wyniku,
 * a to jest dokładnie ta wada, którą lista „Zapisane" ma usunąć. Podział na kliencie odtworzyłby
 * ją co do joty: filtrowałby zbiór, w którym tej rozmowy już nie ma.
 *
 * Każde zapytanie ma jawne ograniczenie (`check:pagination` jest od 096 regułą bezwzględną).
 */
export async function listAiConversations(): Promise<ConversationLists> {
  const user = await requireAuth();
  // `take` stoi przy każdym zapytaniu WPROST, a nie we wspólnym obiekcie rozsypywanym spreadem:
  // bramka `check:pagination` czyta granicę w miejscu wywołania i słusznie nie ufa temu, co przyszło
  // przez zmienną — po to, żeby recenzent widział limit tam, gdzie patrzy na zapytanie.
  const wybor = { id: true, title: true, updatedAt: true, saved: true };
  const [zapisane, historia] = await Promise.all([
    prisma.aiConversation.findMany({
      where: { userId: user.id, saved: true },
      orderBy: { updatedAt: "desc" },
      select: wybor,
      take: 50,
    }),
    prisma.aiConversation.findMany({
      where: { userId: user.id, saved: false },
      orderBy: { updatedAt: "desc" },
      select: wybor,
      take: 50,
    }),
  ]);
  return { zapisane, historia };
}

/** Pełna rozmowa z wiadomościami (po weryfikacji własności). */
export async function getAiConversation(
  id: string
): Promise<{ id: string; title: string; draft: string | null; messages: StoredMessage[] } | null> {
  const user = await requireAuth();
  const convo = await prisma.aiConversation.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      draft: true,
      messages: {
        // Z-215: ładuj tylko najnowsze MESSAGE_WINDOW (zejście od najnowszych),
        // potem odwróć do porządku chronologicznego do wyświetlenia.
        orderBy: { createdAt: "desc" },
        take: MESSAGE_WINDOW,
        select: { id: true, role: true, content: true, kind: true, data: true, createdAt: true },
      },
    },
  });
  if (!convo) return null;
  const messages = (convo.messages as StoredMessage[]).slice().reverse();
  return { id: convo.id, title: convo.title, draft: convo.draft, messages };
}

/** Tworzy nową rozmowę (tytuł z pierwszego polecenia). */
export async function createAiConversation(firstUserText: string): Promise<{ id: string; title: string }> {
  const user = await requireAuth();
  const title = deriveTitle(firstUserText);
  const convo = await prisma.aiConversation.create({
    data: { userId: user.id, title },
    select: { id: true, title: true },
  });
  revalidatePath("/");
  return convo;
}

/** Dopisuje wiadomość do rozmowy (po weryfikacji własności). Bumpuje updatedAt rozmowy. */
export async function appendAiMessage(
  conversationId: string,
  msg: { role: string; content: string; kind?: string; data?: unknown }
): Promise<StoredMessage> {
  const user = await requireAuth();
  const convo = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId: user.id },
    select: { id: true },
  });
  if (!convo) throw new Error("Nie znaleziono rozmowy");
  const created = await prisma.aiMessage.create({
    data: {
      conversationId,
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
      kind: msg.kind ?? "text",
      // Z-215: ogranicz rozmiar sidecara `data` (plan/wyniki) — chroni przed wielkim wierszem.
      data: boundMessageData(msg.data) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true, role: true, content: true, kind: true, data: true, createdAt: true },
  });
  await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  return created as StoredMessage;
}

/** Zmienia tytuł rozmowy. */
export async function renameAiConversation(id: string, title: string): Promise<void> {
  const user = await requireAuth();
  const t = title.trim();
  if (!t) throw new Error("Pusty tytuł");
  await prisma.aiConversation.updateMany({ where: { id, userId: user.id }, data: { title: t } });
  revalidatePath("/");
}

/**
 * 106: przeniesienie rozmowy między listą „Zapisane" a historią.
 *
 * `userId` w `where` JEST guardem własności (wzorzec `renameAiConversation`): cudza rozmowa nie
 * pasuje do filtra, więc operacja jest niewykonalna — a nie „wykonalna i sprawdzana osobno".
 */
export async function setAiConversationSaved(id: string, saved: boolean): Promise<void> {
  const user = await requireAuth();
  await prisma.aiConversation.updateMany({ where: { id, userId: user.id }, data: { saved } });
  revalidatePath("/");
}

/** Usuwa rozmowę wraz z wiadomościami (kaskada FK). */
export async function deleteAiConversation(id: string): Promise<void> {
  const user = await requireAuth();
  await prisma.aiConversation.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/");
}

/**
 * 032: zapisuje BRUDNOPIS — niewysłany tekst pola wiadomości — przy rozmowie. Dzięki temu treść
 * wraca po powrocie do rozmowy, także na innym urządzeniu (wybór właściciela: brudnopis „na koncie",
 * nie w pamięci przeglądarki).
 *
 * `updateMany` z `userId` w `where` jest tu celowe: cudza rozmowa daje 0 zmienionych wierszy i
 * milczenie, zamiast błędu potwierdzającego, że taka rozmowa istnieje.
 */
export async function saveConversationDraft(id: string, draft: string): Promise<void> {
  const user = await requireAuth();
  const value = draft.slice(0, DRAFT_MAX_CHARS);
  await prisma.aiConversation.updateMany({
    where: { id, userId: user.id },
    data: { draft: value || null },
  });
  revalidatePath("/");
}
