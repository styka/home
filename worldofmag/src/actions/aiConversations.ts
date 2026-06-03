"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import type { Prisma } from "@prisma/client";

// Pamięć rozmów asystenta AID ("magiczna ikona"). Wszystko per-user (ownerId === userId);
// rozmowy zespołowe nie istnieją — to prywatny asystent użytkownika.

export type ConversationMeta = {
  id: string;
  title: string;
  updatedAt: Date;
};

export type StoredMessage = {
  id: string;
  role: string; // "user" | "assistant"
  content: string;
  kind: string; // "text" | "plan" | "report" | "navigate" | "clarify" | "results"
  data: unknown;
  createdAt: Date;
};

/** Lista rozmów użytkownika (meta, najnowsze na górze). */
export async function listAiConversations(): Promise<ConversationMeta[]> {
  const user = await requireAuth();
  const rows = await prisma.aiConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
    take: 50,
  });
  return rows;
}

/** Pełna rozmowa z wiadomościami (po weryfikacji własności). */
export async function getAiConversation(
  id: string
): Promise<{ id: string; title: string; messages: StoredMessage[] } | null> {
  const user = await requireAuth();
  const convo = await prisma.aiConversation.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, kind: true, data: true, createdAt: true },
      },
    },
  });
  if (!convo) return null;
  return { id: convo.id, title: convo.title, messages: convo.messages as StoredMessage[] };
}

function deriveTitle(firstText: string): string {
  const clean = firstText.trim().replace(/\s+/g, " ");
  if (!clean) return "Nowa rozmowa";
  const words = clean.split(" ").slice(0, 7).join(" ");
  return words.length > 60 ? words.slice(0, 60) + "…" : words;
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
      data: (msg.data ?? undefined) as Prisma.InputJsonValue | undefined,
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

/** Usuwa rozmowę wraz z wiadomościami (kaskada FK). */
export async function deleteAiConversation(id: string): Promise<void> {
  const user = await requireAuth();
  await prisma.aiConversation.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/");
}
