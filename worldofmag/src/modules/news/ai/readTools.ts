import { getHotTopics, getSources, getTopicView, getTopics } from "../contract";
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, asStr } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_news_topics: args {} → [{ id, title }]. Monitorowane tematy wiadomości.",
  "- list_hot_topics: args {} → [{ title, count }]. „Gorące\" tematy z monitorowanych wiadomości (świeże, częste).",
  "- list_news_sources: args {} → [{ id, name, descriptor, enabled }]. Skonfigurowane źródła RSS wiadomości (descriptor = krótki opis od użytkownika).",
  "- get_news_topic_view: args { topicName } → { items:[…], knowledge:[…] }. Świeże pozycje i baza wiedzy dla wskazanego monitorowanego tematu.",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_news_topics: async (args, userId) => {
      // NewsTopic jest user-only (ownerId wymagany).
      const topics = await prisma.newsTopic.findMany({
        where: { ownerId: userId },
        select: { id: true, title: true },
        orderBy: { sortOrder: "asc" },
        take: HARD_MAX,
      });
      return topics;
  },
  list_hot_topics: async (args, userId) => {
      return getHotTopics();
  },
  list_news_sources: async (args, userId) => {
      const sources = await getSources();
      return sources.map((s) => ({ id: s.id, name: s.name, descriptor: s.descriptor, enabled: s.enabled }));
  },
  get_news_topic_view: async (args, userId) => {
      const name = asStr(args.topicName) ?? asStr(args.search);
      if (!name) return { note: "Podaj nazwę tematu (topicName)." };
      const topics = await getTopics();
      const topic = topics.find((t) => t.title.toLowerCase().includes(name.toLowerCase()));
      if (!topic) return { note: `Nie znaleziono tematu: „${name}".` };
      return getTopicView(topic.id);
  },
};
