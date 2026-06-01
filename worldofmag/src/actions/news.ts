"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { chatComplete } from "@/lib/llm/chat";
import { parseJsonLoose } from "@/lib/llm/json";
import { fetchRss } from "@/lib/news/rss";
import { fetchArticle } from "@/lib/news/article";
import { DEFAULT_SOURCES, type Leaning } from "@/lib/news/sources";

export type SummaryLength = "short" | "medium" | "long";
export type ItemStatus = "PENDING" | "ACKNOWLEDGED" | "DISMISSED";

const FRESHNESS_MS = 24 * 60 * 60 * 1000;
const MAX_CANDIDATES_PER_SOURCE = 8;

export interface SourceDTO {
  id: string;
  key: string;
  name: string;
  rssUrl: string;
  homepageUrl: string;
  leaning: Leaning;
  enabled: boolean;
  sortOrder: number;
}

export interface TopicDTO {
  id: string;
  title: string;
  semanticFilter: string;
  enabled: boolean;
  lastRefreshedAt: string | null;
  pendingCount: number;
}

export interface NewsItemDTO {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceKey: string;
  leaning: Leaning;
  url: string;
  title: string;
  summary: string;
  summaryLength: SummaryLength;
  noveltyNote: string | null;
  imageUrl: string | null;
  publishedAt: string;
  status: ItemStatus;
}

export interface KnowledgeDTO {
  sourceId: string;
  sourceName: string;
  sourceKey: string;
  leaning: Leaning;
  version: number;
  headline: string | null;
  content: string;
  createdAt: string;
}

// ─── Setup / seed ──────────────────────────────────────────────────────────

/** Seeduje domyślne źródła + preferencje przy pierwszym wejściu użytkownika. */
export async function ensureNewsSetup(): Promise<void> {
  const user = await requireAuth();
  const count = await prisma.newsSource.count({ where: { ownerId: user.id } });
  if (count === 0) {
    await prisma.newsSource.createMany({
      data: DEFAULT_SOURCES.map((s) => ({ ...s, ownerId: user.id })),
    });
  }
  await prisma.newsPref.upsert({
    where: { ownerId: user.id },
    create: { ownerId: user.id },
    update: {},
  });
}

// ─── Reads ───────────────────────────────────────────────────────────────

export async function getSources(): Promise<SourceDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.newsSource.findMany({
    where: { ownerId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name,
    rssUrl: s.rssUrl,
    homepageUrl: s.homepageUrl,
    leaning: s.leaning as Leaning,
    enabled: s.enabled,
    sortOrder: s.sortOrder,
  }));
}

export async function getTopics(): Promise<TopicDTO[]> {
  const user = await requireAuth();
  const cutoff = new Date(Date.now() - FRESHNESS_MS);
  const rows = await prisma.newsTopic.findMany({
    where: { ownerId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: { items: { where: { status: "PENDING", publishedAt: { gte: cutoff } } } },
      },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    semanticFilter: t.semanticFilter,
    enabled: t.enabled,
    lastRefreshedAt: t.lastRefreshedAt?.toISOString() ?? null,
    pendingCount: t._count.items,
  }));
}

export async function getNewsPref(): Promise<{
  defaultSummaryLength: SummaryLength;
  activeSourceKey: string | null;
}> {
  const user = await requireAuth();
  const p = await prisma.newsPref.findUnique({ where: { ownerId: user.id } });
  return {
    defaultSummaryLength: (p?.defaultSummaryLength as SummaryLength) ?? "medium",
    activeSourceKey: p?.activeSourceKey ?? null,
  };
}

async function assertTopic(topicId: string, userId: string) {
  const t = await prisma.newsTopic.findUnique({ where: { id: topicId } });
  if (!t || t.ownerId !== userId) throw new Error("Temat nie istnieje");
  return t;
}

/** Pozycje (świeże, ≤24h) dla tematu + bieżący stan wiedzy per źródło. */
export async function getTopicView(topicId: string): Promise<{
  items: NewsItemDTO[];
  knowledge: KnowledgeDTO[];
}> {
  const user = await requireAuth();
  await assertTopic(topicId, user.id);
  const cutoff = new Date(Date.now() - FRESHNESS_MS);

  const items = await prisma.newsItem.findMany({
    where: { topicId, status: "PENDING", publishedAt: { gte: cutoff } },
    orderBy: { publishedAt: "desc" },
    include: { source: true },
  });

  // Bieżący stan wiedzy = najwyższy version dla każdego (topic, source).
  const allK = await prisma.newsKnowledge.findMany({
    where: { topicId },
    orderBy: { version: "desc" },
    include: { source: true },
  });
  const seen = new Set<string>();
  const knowledge: KnowledgeDTO[] = [];
  for (const k of allK) {
    if (seen.has(k.sourceId)) continue;
    seen.add(k.sourceId);
    knowledge.push({
      sourceId: k.sourceId,
      sourceName: k.source.name,
      sourceKey: k.source.key,
      leaning: k.source.leaning as Leaning,
      version: k.version,
      headline: k.headline,
      content: k.content,
      createdAt: k.createdAt.toISOString(),
    });
  }

  return {
    items: items.map((i) => ({
      id: i.id,
      sourceId: i.sourceId,
      sourceName: i.source.name,
      sourceKey: i.source.key,
      leaning: i.source.leaning as Leaning,
      url: i.url,
      title: i.title,
      summary: i.summary,
      summaryLength: i.summaryLength as SummaryLength,
      noveltyNote: i.noveltyNote,
      imageUrl: i.imageUrl,
      publishedAt: i.publishedAt.toISOString(),
      status: i.status as ItemStatus,
    })),
    knowledge,
  };
}

export async function getKnowledgeHistory(
  topicId: string,
  sourceId: string
): Promise<KnowledgeDTO[]> {
  const user = await requireAuth();
  await assertTopic(topicId, user.id);
  const rows = await prisma.newsKnowledge.findMany({
    where: { topicId, sourceId },
    orderBy: { version: "desc" },
    include: { source: true },
  });
  return rows.map((k) => ({
    sourceId: k.sourceId,
    sourceName: k.source.name,
    sourceKey: k.source.key,
    leaning: k.source.leaning as Leaning,
    version: k.version,
    headline: k.headline,
    content: k.content,
    createdAt: k.createdAt.toISOString(),
  }));
}

// ─── Topic / source / pref mutations ───────────────────────────────────────

export async function createTopic(data: {
  title: string;
  semanticFilter: string;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  const title = data.title.trim();
  const semanticFilter = data.semanticFilter.trim();
  if (!title) throw new Error("Tytuł tematu jest wymagany");
  if (!semanticFilter) throw new Error("Opis filtra semantycznego jest wymagany");
  const min = await prisma.newsTopic.aggregate({
    where: { ownerId: user.id },
    _min: { sortOrder: true },
  });
  const t = await prisma.newsTopic.create({
    data: {
      ownerId: user.id,
      title,
      semanticFilter,
      sortOrder: (min._min.sortOrder ?? 0) - 1,
    },
  });
  revalidatePath("/wiadomosci");
  return { id: t.id };
}

export async function updateTopic(
  id: string,
  patch: { title?: string; semanticFilter?: string; enabled?: boolean }
): Promise<void> {
  const user = await requireAuth();
  await assertTopic(id, user.id);
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("Tytuł tematu jest wymagany");
    data.title = t;
  }
  if (patch.semanticFilter !== undefined) {
    const f = patch.semanticFilter.trim();
    if (!f) throw new Error("Opis filtra semantycznego jest wymagany");
    data.semanticFilter = f;
  }
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  await prisma.newsTopic.update({ where: { id }, data });
  revalidatePath("/wiadomosci");
}

export async function deleteTopic(id: string): Promise<void> {
  const user = await requireAuth();
  await assertTopic(id, user.id);
  await prisma.newsTopic.delete({ where: { id } });
  revalidatePath("/wiadomosci");
}

export async function createSource(data: {
  name: string;
  rssUrl: string;
  homepageUrl: string;
  leaning: Leaning;
}): Promise<void> {
  const user = await requireAuth();
  const name = data.name.trim();
  if (!name) throw new Error("Nazwa źródła jest wymagana");
  if (!/^https?:\/\//i.test(data.rssUrl.trim())) throw new Error("Adres RSS musi być poprawnym URL");
  const key = `custom-${Date.now().toString(36)}`;
  const max = await prisma.newsSource.aggregate({
    where: { ownerId: user.id },
    _max: { sortOrder: true },
  });
  await prisma.newsSource.create({
    data: {
      ownerId: user.id,
      key,
      name,
      rssUrl: data.rssUrl.trim(),
      homepageUrl: data.homepageUrl.trim() || data.rssUrl.trim(),
      leaning: data.leaning,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/wiadomosci");
}

export async function updateSource(
  id: string,
  patch: { name?: string; rssUrl?: string; homepageUrl?: string; leaning?: Leaning; enabled?: boolean }
): Promise<void> {
  const user = await requireAuth();
  const s = await prisma.newsSource.findUnique({ where: { id } });
  if (!s || s.ownerId !== user.id) throw new Error("Źródło nie istnieje");
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.rssUrl !== undefined) data.rssUrl = patch.rssUrl.trim();
  if (patch.homepageUrl !== undefined) data.homepageUrl = patch.homepageUrl.trim();
  if (patch.leaning !== undefined) data.leaning = patch.leaning;
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  await prisma.newsSource.update({ where: { id }, data });
  revalidatePath("/wiadomosci");
}

export async function deleteSource(id: string): Promise<void> {
  const user = await requireAuth();
  const s = await prisma.newsSource.findUnique({ where: { id } });
  if (!s || s.ownerId !== user.id) throw new Error("Źródło nie istnieje");
  await prisma.newsSource.delete({ where: { id } });
  revalidatePath("/wiadomosci");
}

export async function setDefaultSummaryLength(length: SummaryLength): Promise<void> {
  const user = await requireAuth();
  await prisma.newsPref.upsert({
    where: { ownerId: user.id },
    create: { ownerId: user.id, defaultSummaryLength: length },
    update: { defaultSummaryLength: length },
  });
  revalidatePath("/wiadomosci");
}

export async function setActiveSource(key: string | null): Promise<void> {
  const user = await requireAuth();
  await prisma.newsPref.upsert({
    where: { ownerId: user.id },
    create: { ownerId: user.id, activeSourceKey: key },
    update: { activeSourceKey: key },
  });
}

// ─── LLM helpers ───────────────────────────────────────────────────────────

function lengthInstruction(length: SummaryLength): string {
  switch (length) {
    case "short":
      return "Streszczenie KRÓTKIE: jedno zdanie, maks. ~25 słów, sama esencja.";
    case "long":
      return "Streszczenie SZCZEGÓŁOWE: 4–6 zdań, kontekst, liczby, konsekwencje (maks. ~130 słów).";
    default:
      return "Streszczenie ŚREDNIE: 2–3 zdania, najważniejsze fakty (maks. ~60 słów).";
  }
}

async function llmJson<T>(op: "reasoning" | "generation", system: string, user: string): Promise<T> {
  const res = await chatComplete({
    op,
    json: true,
    temperature: 0.2,
    maxTokens: 2000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  if (!res.ok) throw new Error(res.message);
  const parsed = parseJsonLoose<T>(res.content);
  if (parsed == null) throw new Error("Nie udało się odczytać odpowiedzi LLM (niepoprawny JSON).");
  return parsed;
}

// ─── Refresh pipeline ──────────────────────────────────────────────────────

interface FilterDecision {
  index: number;
  relevant: boolean;
  novel: boolean;
  noveltyNote: string;
  summary: string;
}

/** Pobiera świeże (≤24h) wiadomości dla tematu, ocenia trafność/nowość przez LLM. */
export async function refreshTopic(
  topicId: string
): Promise<{ added: number; scanned: number; skippedOld: number }> {
  const user = await requireAuth();
  const topic = await assertTopic(topicId, user.id);
  const pref = await prisma.newsPref.findUnique({ where: { ownerId: user.id } });
  const defaultLength = (pref?.defaultSummaryLength as SummaryLength) ?? "medium";

  const sources = await prisma.newsSource.findMany({
    where: { ownerId: user.id, enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  const cutoff = new Date(Date.now() - FRESHNESS_MS);
  let added = 0;
  let scanned = 0;
  let skippedOld = 0;

  // Sprzątanie: usuń przeterminowane (>24h) pozycje PENDING — uznane za nieistotne.
  await prisma.newsItem.deleteMany({
    where: { topicId, status: "PENDING", publishedAt: { lt: cutoff } },
  });

  for (const source of sources) {
    const feed = await fetchRss(source.rssUrl);
    const fresh = feed.filter((f) => {
      if (!f.publishedAt) return false;
      if (f.publishedAt < cutoff) {
        skippedOld++;
        return false;
      }
      return true;
    });
    fresh.sort((a, b) => (b.publishedAt!.getTime() - a.publishedAt!.getTime()));
    const limited = fresh.slice(0, MAX_CANDIDATES_PER_SOURCE);

    // Pomijamy artykuły już przetworzone (po URL) dla tego tematu+źródła.
    const knownUrls = new Set(
      (
        await prisma.newsItem.findMany({
          where: { topicId, sourceId: source.id, url: { in: limited.map((l) => l.link) } },
          select: { url: true },
        })
      ).map((r) => r.url)
    );
    const candidates = limited.filter((l) => !knownUrls.has(l.link));
    if (candidates.length === 0) continue;
    scanned += candidates.length;

    // Dociągamy pełną treść artykułów (równolegle).
    const articles = await Promise.all(candidates.map((c) => fetchArticle(c.link)));

    // Bieżący stan wiedzy dla tego źródła (do oceny nowości).
    const currentK = await prisma.newsKnowledge.findFirst({
      where: { topicId, sourceId: source.id },
      orderBy: { version: "desc" },
    });

    const candidateBlocks = candidates
      .map((c, i) => {
        const body = articles[i].text || c.description;
        return `### Artykuł ${i}\nTytuł: ${c.title}\nData: ${c.publishedAt?.toISOString()}\nURL: ${c.link}\nTreść: ${body.slice(0, 2500)}`;
      })
      .join("\n\n");

    const system =
      "Jesteś redaktorem monitorującym wiadomości dla użytkownika. Oceniasz, czy artykuł " +
      "pasuje SEMANTYCZNIE do zdefiniowanego tematu oraz czy wnosi REALNĄ NOWĄ informację " +
      "względem dotychczasowego stanu wiedzy (odrzucaj clickbait i artykuły nic nie wnoszące). " +
      "Pisz po polsku. Zwróć WYŁĄCZNIE JSON.";

    const userPrompt =
      `TEMAT: „${topic.title}"\n` +
      `FILTR SEMANTYCZNY: ${topic.semanticFilter}\n\n` +
      `DOTYCHCZASOWY STAN WIEDZY (źródło: ${source.name}):\n${
        currentK?.content || "(brak — to pierwszy zbiór informacji na ten temat z tego źródła)"
      }\n\n` +
      `KANDYDACI:\n${candidateBlocks}\n\n` +
      `Dla KAŻDEGO artykułu zdecyduj: relevant (czy pasuje do tematu), novel (czy wnosi nową ` +
      `istotną informację względem stanu wiedzy). ${lengthInstruction(defaultLength)}\n` +
      `noveltyNote = jedno zdanie: co NOWEGO wnosi (lub dlaczego nic nie wnosi).\n` +
      `Zwróć JSON: {"decisions":[{"index":0,"relevant":true,"novel":true,"noveltyNote":"...","summary":"..."}]}`;

    let decisions: FilterDecision[] = [];
    try {
      const out = await llmJson<{ decisions: FilterDecision[] }>("reasoning", system, userPrompt);
      decisions = out.decisions ?? [];
    } catch (err) {
      // Jedno źródło nie blokuje pozostałych — pomijamy i lecimy dalej.
      continue;
    }

    for (const d of decisions) {
      if (!d.relevant || !d.novel) continue;
      const c = candidates[d.index];
      if (!c) continue;
      try {
        await prisma.newsItem.create({
          data: {
            topicId,
            sourceId: source.id,
            url: c.link,
            title: c.title,
            summary: d.summary?.trim() || c.description.slice(0, 200),
            summaryLength: defaultLength,
            noveltyNote: d.noveltyNote?.trim() || null,
            imageUrl: articles[d.index]?.imageUrl ?? null,
            publishedAt: c.publishedAt!,
            status: "PENDING",
          },
        });
        added++;
      } catch {
        // kolizja unikalności (równoległe odświeżenie) — pomiń
      }
    }
  }

  await prisma.newsTopic.update({
    where: { id: topicId },
    data: { lastRefreshedAt: new Date() },
  });
  revalidatePath("/wiadomosci");
  return { added, scanned, skippedOld };
}

// ─── Item actions ──────────────────────────────────────────────────────────

export async function resummarizeItem(itemId: string, length: SummaryLength): Promise<string> {
  const user = await requireAuth();
  const item = await prisma.newsItem.findUnique({
    where: { id: itemId },
    include: { topic: true, source: true },
  });
  if (!item || item.topic.ownerId !== user.id) throw new Error("Pozycja nie istnieje");

  const article = await fetchArticle(item.url);
  const body = article.text || item.summary;
  const system =
    "Streszczasz artykuł prasowy po polsku. Zwróć WYŁĄCZNIE JSON {\"summary\":\"...\"}.";
  const userPrompt =
    `Tytuł: ${item.title}\nTreść: ${body.slice(0, 4000)}\n\n${lengthInstruction(length)}`;
  const out = await llmJson<{ summary: string }>("generation", system, userPrompt);
  const summary = out.summary?.trim();
  if (!summary) throw new Error("Pusta odpowiedź LLM");

  await prisma.newsItem.update({
    where: { id: itemId },
    data: { summary, summaryLength: length },
  });
  revalidatePath("/wiadomosci");
  return summary;
}

/** Oznacza pozycję jako przyjętą do wiadomości → wplata ją w bazę wiedzy (nowa wersja). */
export async function acknowledgeItem(itemId: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.newsItem.findUnique({
    where: { id: itemId },
    include: { topic: true, source: true },
  });
  if (!item || item.topic.ownerId !== user.id) throw new Error("Pozycja nie istnieje");

  const prev = await prisma.newsKnowledge.findFirst({
    where: { topicId: item.topicId, sourceId: item.sourceId },
    orderBy: { version: "desc" },
  });

  const system =
    "Prowadzisz narastającą bazę wiedzy na temat śledzony przez użytkownika, osobno dla każdego " +
    "źródła. Otrzymujesz dotychczasowy stan wiedzy i nową, zaakceptowaną informację. Zaktualizuj " +
    "opis stanu: zachowaj istotne wcześniejsze fakty, dołącz nowe, uporządkuj chronologicznie/logicznie. " +
    "Pisz zwięźle po polsku w Markdown. Zwróć WYŁĄCZNIE JSON {\"headline\":\"...\",\"content\":\"...\"}.";
  const userPrompt =
    `TEMAT: „${item.topic.title}" (${item.topic.semanticFilter})\n` +
    `ŹRÓDŁO: ${item.source.name}\n\n` +
    `DOTYCHCZASOWY STAN WIEDZY:\n${prev?.content || "(brak — to pierwszy wpis)"}\n\n` +
    `NOWA INFORMACJA (z ${item.publishedAt.toISOString().slice(0, 10)}):\n` +
    `Tytuł: ${item.title}\nStreszczenie: ${item.summary}\nCo nowego: ${item.noveltyNote ?? "—"}\nURL: ${item.url}\n\n` +
    `headline = jednozdaniowy „aktualny stan" tematu. content = pełny, zaktualizowany opis (Markdown).`;

  const out = await llmJson<{ headline: string; content: string }>("reasoning", system, userPrompt);

  await prisma.$transaction([
    prisma.newsKnowledge.create({
      data: {
        topicId: item.topicId,
        sourceId: item.sourceId,
        version: (prev?.version ?? 0) + 1,
        content: out.content?.trim() || item.summary,
        headline: out.headline?.trim() || null,
      },
    }),
    prisma.newsItem.update({ where: { id: itemId }, data: { status: "ACKNOWLEDGED" } }),
  ]);
  revalidatePath("/wiadomosci");
}

export async function dismissItem(itemId: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.newsItem.findUnique({
    where: { id: itemId },
    include: { topic: { select: { ownerId: true } } },
  });
  if (!item || item.topic.ownerId !== user.id) throw new Error("Pozycja nie istnieje");
  await prisma.newsItem.update({ where: { id: itemId }, data: { status: "DISMISSED" } });
  revalidatePath("/wiadomosci");
}

// ─── Hot topics ────────────────────────────────────────────────────────────

export interface HotTopic {
  title: string;
  summary: string;
  suggestedFilter: string;
  sources: string[];
}

/** Klasteryzuje świeże (≤24h) nagłówki ze wszystkich źródeł w „gorące tematy". */
export async function getHotTopics(): Promise<HotTopic[]> {
  const user = await requireAuth();
  const sources = await prisma.newsSource.findMany({
    where: { ownerId: user.id, enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  const cutoff = new Date(Date.now() - FRESHNESS_MS);

  const headlines: string[] = [];
  for (const s of sources) {
    const feed = await fetchRss(s.rssUrl);
    for (const f of feed) {
      if (!f.publishedAt || f.publishedAt < cutoff) continue;
      headlines.push(`[${s.name}] ${f.title}`);
    }
  }
  const capped = headlines.slice(0, 60);
  if (capped.length === 0) return [];

  const system =
    "Analizujesz nagłówki wiadomości z ostatnich 24h z kilku polskich portali. Pogrupuj je w " +
    "6–8 najważniejszych, wyraźnie różnych gorących tematów. Pisz po polsku. Zwróć WYŁĄCZNIE JSON.";
  const userPrompt =
    `NAGŁÓWKI:\n${capped.join("\n")}\n\n` +
    `Zwróć JSON: {"topics":[{"title":"krótka nazwa tematu","summary":"1–2 zdania o co chodzi",` +
    `"suggestedFilter":"propozycja filtra semantycznego do monitorowania tego tematu",` +
    `"sources":["nazwy portali, które o tym piszą"]}]}`;

  const out = await llmJson<{ topics: HotTopic[] }>("reasoning", system, userPrompt);
  return (out.topics ?? []).slice(0, 8);
}
