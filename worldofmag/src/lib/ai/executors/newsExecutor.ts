// Z-010: handler akcji asystenta dla modułu Wiadomości (tematy + odświeżanie).
// Scala oba dawne bloki `module === "news"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { createTopic, updateTopic, deleteTopic, refreshTopic, createSource, updateSource, deleteSource } from "@/actions/news";
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

  if (type === "create_news_source") {
    const name = asStr(params.name);
    const rssUrl = asStr(params.rssUrl);
    if (!name || !rssUrl) throw new Error("Podaj nazwę i adres RSS źródła");
    let homepageUrl = asStr(params.homepageUrl);
    if (!homepageUrl) { try { homepageUrl = new URL(rssUrl).origin; } catch { homepageUrl = rssUrl; } }
    const leaning = (["left", "center", "right"].includes(String(params.leaning)) ? String(params.leaning) : "center") as "left" | "center" | "right";
    await createSource({ name, rssUrl, homepageUrl, leaning });
    return `Dodano źródło wiadomości „${name}"`;
  }
  if (type === "update_news_source" || type === "delete_news_source") {
    const q = searchQuery ?? asStr(params.name);
    const sid = asStr(params.sourceId);
    const src = sid
      ? await prisma.newsSource.findFirst({ where: { id: sid, ownerId: userId }, select: { id: true } })
      : await prisma.newsSource.findFirst({ where: { ownerId: userId, name: { contains: q ?? "", mode: "insensitive" } }, select: { id: true } });
    if (!src) throw new Error(`Nie znaleziono źródła: „${q ?? sid ?? ""}"`);
    if (type === "delete_news_source") { await deleteSource(src.id); return `Usunięto źródło wiadomości`; }
    const leaningRaw = asStr(params.leaning);
    await updateSource(src.id, {
      name: asStr(params.newName),
      rssUrl: asStr(params.rssUrl),
      homepageUrl: asStr(params.homepageUrl),
      ...(leaningRaw && ["left", "center", "right"].includes(leaningRaw) ? { leaning: leaningRaw as "left" | "center" | "right" } : {}),
      ...(params.enabled !== undefined ? { enabled: params.enabled === true } : {}),
    });
    return `Zaktualizowano źródło wiadomości`;
  }

  throw new Error(`Nieznany typ akcji wiadomości: ${type}`);
}
