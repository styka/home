// Z-010: handler akcji asystenta dla modułu Wiadomości (tematy + odświeżanie).
// Scala oba dawne bloki `module === "news"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { createTopic, updateTopic, deleteTopic, refreshTopic } from "@/actions/news";
import { asStr, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeNewsAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "create_news_topic") {
    const title = asStr(params.title);
    if (!title) throw new Error("Podaj tytuł tematu");
    await createTopic({ title, semanticFilter: asStr(params.semanticFilter) ?? title });
    const msg = `Utworzono temat wiadomości „${title}"`;
    if (params.openAfter === true) return { message: msg, navigateTo: `/wiadomosci`, navigateLabel: "Otwórz Wiadomości" };
    return msg;
  }
  if (type === "delete_news_topic") {
    const id = asStr(params.topicId);
    let topicId = id;
    if (!topicId && searchQuery) {
      const t = await prisma.newsTopic.findFirst({
        where: { ownerId: userId, title: { contains: searchQuery, mode: "insensitive" } },
      });
      topicId = t?.id;
    }
    if (!topicId) throw new Error(`Nie znaleziono tematu: "${searchQuery}"`);
    await deleteTopic(topicId);
    return `Usunięto temat wiadomości`;
  }

  const resolveTopic = async () => {
    const id = asStr(params.topicId);
    if (id) { const t = await prisma.newsTopic.findFirst({ where: { ownerId: userId, id } }); if (t) return t.id; }
    const t = await prisma.newsTopic.findFirst({ where: { ownerId: userId, title: { contains: searchQuery ?? asStr(params.title) ?? "", mode: "insensitive" } } });
    if (!t) throw new Error(`Nie znaleziono tematu: "${searchQuery}"`);
    return t.id;
  };
  if (type === "update_news_topic") {
    const id = await resolveTopic();
    await updateTopic(id, { title: asStr(params.title), semanticFilter: asStr(params.semanticFilter) });
    return `Zaktualizowano temat wiadomości`;
  }
  if (type === "refresh_news_topic") {
    const id = await resolveTopic();
    const r = await refreshTopic(id);
    return `Odświeżono temat — nowych pozycji: ${r.added}`;
  }

  throw new Error(`Nieznany typ akcji wiadomości: ${type}`);
}
