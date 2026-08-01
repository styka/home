"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { chatComplete } from "@/lib/llm/chat";
import { parseJsonLoose } from "@/lib/llm/json";
import { fetchArticle } from "@/lib/news/article";
import { DEFAULT_SOURCES, type Leaning } from "@/lib/news/sources";
import { fingerprintOf } from "@/lib/textKey";
import { rememberedContent, hashInputs } from "@/lib/ai/contentMemory";
import { usageFromChat, type AiUsageInfo } from "@/lib/ai/usage";
import { visibleUsage } from "@/lib/ai/costVisibility";
import { enqueue, MAX_ACTIVE_JOBS_PER_OWNER } from "@/lib/jobs/queue";
import type { DateConfidence, NewsRefreshResult } from "@/lib/jobs/handlers/newsRefresh";

export type SummaryLength = "short" | "medium" | "long";
export type ItemStatus = "PENDING" | "ACKNOWLEDGED" | "DISMISSED";

const FRESHNESS_MS = 24 * 60 * 60 * 1000;

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

/** 039: pozycja linii czasu tematu — zastąpiła wersjonowaną, narracyjną bazę wiedzy. */
export interface TimelineEntryDTO {
  id: string;
  /** Data ZDARZENIA (nie pobrania). */
  eventDate: string;
  /** "exact" | "approx" | "published" — skąd wzięliśmy datę. */
  dateConfidence: DateConfidence;
  fact: string;
  sourceName: string | null;
  sourceKey: string | null;
  leaning: Leaning | null;
  /** Adres materiału źródłowego, jeśli znany — pozwala kliknąć w fakt i sprawdzić go u źródła. */
  url: string | null;
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
  const rows = await prisma.newsTopic.findMany({
    where: { ownerId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: { items: { where: { status: "PENDING" } } },
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

/** Nowe (jeszcze nieobsłużone) pozycje dla tematu + jego linia czasu. */
export async function getTopicView(topicId: string): Promise<{
  items: NewsItemDTO[];
  timeline: TimelineEntryDTO[];
}> {
  const user = await requireAuth();
  await assertTopic(topicId, user.id);

  const items = await prisma.newsItem.findMany({
    where: { topicId, status: "PENDING" },
    orderBy: { publishedAt: "desc" },
    include: { source: true },
  });

  const timeline = await getTopicTimeline(topicId);

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
    timeline,
  };
}

/**
 * 039: linia czasu tematu — od najnowszego zdarzenia.
 *
 * Sortujemy po dacie ZDARZENIA, nie po dacie zapisu: materiał opublikowany dziś, a opisujący coś
 * sprzed tygodnia, ma trafić na swoje miejsce w chronologii, a nie na górę listy.
 */
export async function getTopicTimeline(topicId: string): Promise<TimelineEntryDTO[]> {
  const user = await requireAuth();
  await assertTopic(topicId, user.id);
  const rows = await prisma.newsTimelineEntry.findMany({
    where: { topicId },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    include: { source: true },
  });

  // Adres materiału bierzemy z puli — pozwala kliknąć w fakt i sprawdzić go u źródła.
  const articleIds = rows.map((r) => r.articleId).filter((id): id is string => !!id);
  const articles = articleIds.length
    ? await prisma.newsArticle.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, url: true },
      })
    : [];
  const urlById = new Map(articles.map((a) => [a.id, a.url]));

  return rows.map((r) => ({
    id: r.id,
    eventDate: r.eventDate.toISOString(),
    dateConfidence: r.dateConfidence as DateConfidence,
    fact: r.fact,
    sourceName: r.source?.name ?? null,
    sourceKey: r.source?.key ?? null,
    leaning: (r.source?.leaning as Leaning) ?? null,
    url: r.articleId ? urlById.get(r.articleId) ?? null : null,
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

class LlmError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * 037: `sink` zbiera wyniki wywołań modelu, żeby akcja mogła pokazać koszt przy wygenerowanej
 * treści. Świadomie jako opcjonalny parametr wyjściowy, a nie zmiana typu zwracanego — inaczej
 * wszystkie pięć miejsc wołających ten helper musiałoby rozpakowywać krotkę bez żadnego zysku.
 */
type LlmSink = Array<{ res: Awaited<ReturnType<typeof chatComplete>>; label?: string }>;

async function llmJson<T>(
  op: "reasoning" | "generation",
  system: string,
  user: string,
  maxTokens = 2000,
  sink?: LlmSink,
  label?: string
): Promise<T> {
  const res = await chatComplete({
    op,
    json: true,
    temperature: 0.2,
    maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  sink?.push({ res, label });
  if (!res.ok) throw new LlmError(res.status, res.message);
  const parsed = parseJsonLoose<T>(res.content);
  if (parsed == null) throw new Error("Nie udało się odczytać odpowiedzi LLM (niepoprawny JSON).");
  return parsed;
}

// ─── Przebieg odświeżania ──────────────────────────────────────────────────
//
// 039: `refreshTopic(topicId)` ZNIKŁ. Pobranie i analiza dzieją się teraz w jednym zadaniu w tle
// (`news.refresh`, `lib/jobs/handlers/newsRefresh.ts`) obejmującym wszystkie tematy naraz — bo
// kanały RSS są wspólne dla tematów, a odświeżanie per temat pobierało ten sam kanał kilkanaście
// razy na cykl. Utrzymywanie obu ścieżek oznaczałoby dwa sposoby na to samo, rozjeżdżające się
// przy pierwszej zmianie.

/** Stan przebiegu odświeżania — odczytywany z KOLEJKI, nie z pamięci komponentu. */
export interface NewsRefreshState {
  jobId: string;
  status: string;
  /** Etap („Pobieram źródła (3/5)…") — tylko dla trwającego przebiegu. */
  progress: string | null;
  error: string | null;
  result: NewsRefreshResult | null;
  startedAt: string;
}

/**
 * Uruchamia przebieg odświeżania całego modułu i zwraca id zadania.
 *
 * `dedupeKey` per użytkownik sprawia, że drugie kliknięcie w trwający przebieg wraca do tego samego
 * zadania zamiast puszczać drugi, równoległy przejazd po tych samych kanałach.
 */
export async function startNewsRefresh(force?: boolean): Promise<{ jobId: string }> {
  const user = await requireAuth();
  const job = await enqueue(
    "news.refresh",
    { force: force === true },
    { ownerId: user.id, dedupeKey: `news.refresh:${user.id}`, maxActivePerOwner: MAX_ACTIVE_JOBS_PER_OWNER }
  );
  return { jobId: job.id };
}

/**
 * Ostatni przebieg odświeżania — trwający albo zakończony.
 *
 * Dzięki temu powrót na stronę pokazuje, że coś trwa (albo czym się skończyło), zamiast udawać, że
 * nic się nie dzieje. Niepowodzenie niesie komunikat błędu, a nie pustą listę.
 */
export async function getNewsRefreshState(): Promise<NewsRefreshState | null> {
  const user = await requireAuth();
  const job = await prisma.job.findFirst({
    where: { ownerId: user.id, type: "news.refresh" },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return null;

  let result: NewsRefreshResult | null = null;
  if (job.result) {
    try {
      const parsed = JSON.parse(job.result) as NewsRefreshResult;
      // Licznik kosztu przechodzi przez bramkę widoczności dopiero przy odczycie — handler chodzi
      // w workerze bez sesji, więc nie mógł tego rozstrzygnąć u siebie (037).
      result = { ...parsed, usage: await visibleUsage(parsed.usage) };
    } catch {
      result = null;
    }
  }

  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    result,
    startedAt: job.createdAt.toISOString(),
  };
}

// ─── Item actions ──────────────────────────────────────────────────────────

export interface ResummarizeResult {
  summary: string;
  usage?: AiUsageInfo;
}

export async function resummarizeItem(
  itemId: string,
  length: SummaryLength
): Promise<ResummarizeResult> {
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
  const sink: LlmSink = [];
  const out = await llmJson<{ summary: string }>("generation", system, userPrompt, 2000, sink, "streszczenie");
  const summary = out.summary?.trim();
  if (!summary) throw new Error("Pusta odpowiedź LLM");

  await prisma.newsItem.update({
    where: { id: itemId },
    data: { summary, summaryLength: length },
  });
  revalidatePath("/wiadomosci");
  return { summary, usage: await visibleUsage(usageFromChat(sink)) };
}

/**
 * Oznacza pozycję jako obsłużoną („przeczytane, wiem").
 *
 * 039: przestało to być wywołanie modelu. Wcześniej każde kliknięcie dopisywało do narracyjnej bazy
 * wiedzy nową sekcję pisaną przez model — czyli użytkownik płacił za odczytanie własnej wiadomości.
 * Linia czasu powstaje teraz raz, w przebiegu odświeżania, więc odhaczenie pozycji to zwykła zmiana
 * statusu.
 */
export async function acknowledgeItem(itemId: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.newsItem.findUnique({
    where: { id: itemId },
    include: { topic: { select: { ownerId: true } } },
  });
  if (!item || item.topic.ownerId !== user.id) throw new Error("Pozycja nie istnieje");
  await prisma.newsItem.update({ where: { id: itemId }, data: { status: "ACKNOWLEDGED" } });
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
  /** Odcisk tytułu — po nim rozpoznajemy temat odrzucony przez użytkownika. */
  fingerprint: string;
}

export interface HotTopicsResult {
  topics: HotTopic[];
  /** Kiedy powstała ta lista (pamięć treści) — puste, gdy nie ma z czego jej zbudować. */
  generatedAt: string | null;
  /** Materiał się zmienił od czasu wygenerowania — informacja, nie powód do regeneracji. */
  stale: boolean;
  usage?: AiUsageInfo;
}

export interface HiddenTopicDTO {
  id: string;
  title: string;
  createdAt: string;
}

/**
 * Klasteryzuje świeże (≤24 h) nagłówki w „gorące tematy" — **z puli, nie z sieci**.
 *
 * Wcześniej ta funkcja pobierała wszystkie kanały RSS jeszcze raz, przy każdym wejściu na widok,
 * choć przebieg odświeżania właśnie je pobrał. Teraz czyta `NewsArticle`, więc samo otwarcie
 * zakładki nie kosztuje ani jednego żądania do portali.
 *
 * Wynik przechodzi przez pamięć treści (038): wejście na widok nie generuje listy od nowa, a
 * `force` odpowiada jawnemu kliknięciu „Odśwież propozycje".
 */
export async function getHotTopics(force?: boolean): Promise<HotTopicsResult> {
  const user = await requireAuth();
  const cutoff = new Date(Date.now() - FRESHNESS_MS);

  const articles = await prisma.newsArticle.findMany({
    where: { ownerId: user.id, publishedAt: { gte: cutoff } },
    orderBy: { publishedAt: "desc" },
    take: 60,
    include: { source: { select: { name: true } } },
  });
  if (articles.length === 0) {
    return { topics: [], generatedAt: null, stale: false };
  }

  const hidden = await prisma.newsHiddenTopic.findMany({
    where: { ownerId: user.id },
    select: { fingerprint: true },
  });
  const hiddenSet = new Set(hidden.map((h) => h.fingerprint));

  const headlines = articles.map((a) => `[${a.source.name}] ${a.title}`);

  const remembered = await rememberedContent<{ topics: HotTopic[] }>({
    ownerId: user.id,
    kind: "news.hotTopics",
    scopeKey: "default",
    // Warunki = materiał, z którego lista powstała. Nowe artykuły w puli zapalają „nieaktualne",
    // ale NIE generują listy od nowa — o tym decyduje kliknięcie użytkownika.
    inputHash: hashInputs(articles.length, articles[0]?.id ?? "", articles[articles.length - 1]?.id ?? ""),
    force,
    generate: async () => {
      const system =
        "Analizujesz nagłówki wiadomości z ostatnich 24h z kilku polskich portali. Pogrupuj je w " +
        "6–8 najważniejszych, wyraźnie różnych gorących tematów. Pisz po polsku. Zwróć WYŁĄCZNIE JSON.";
      const userPrompt =
        `NAGŁÓWKI:\n${headlines.join("\n")}\n\n` +
        `Zwróć JSON: {"topics":[{"title":"krótka nazwa tematu","summary":"1–2 zdania o co chodzi",` +
        `"suggestedFilter":"propozycja filtra semantycznego do monitorowania tego tematu",` +
        `"sources":["nazwy portali, które o tym piszą"]}]}`;
      const sink: LlmSink = [];
      const out = await llmJson<{ topics: HotTopic[] }>(
        "reasoning",
        system,
        userPrompt,
        2000,
        sink,
        "gorące tematy"
      );
      const topics = (out.topics ?? []).slice(0, 8).map((t) => ({
        ...t,
        fingerprint: fingerprintOf(t.title ?? ""),
      }));
      return { value: { topics }, usage: usageFromChat(sink) };
    },
  });

  return {
    // Odrzucone odfiltrowujemy PO odczycie z pamięci, a nie przed zapisem — dzięki temu cofnięcie
    // odrzucenia przywraca temat od razu, bez płacenia za ponowne wygenerowanie listy.
    topics: (remembered.value.topics ?? []).filter((t) => !hiddenSet.has(t.fingerprint)),
    generatedAt: remembered.generatedAt,
    stale: remembered.stale,
    usage: await visibleUsage(remembered.usage),
  };
}

/** „Nie proponuj tego tematu" — odrzucenie po odcisku tytułu (gorący temat nie ma własnego id). */
export async function hideHotTopic(title: string): Promise<void> {
  const user = await requireAuth();
  const clean = title.trim();
  if (!clean) throw new Error("Pusty tytuł tematu");
  const fingerprint = fingerprintOf(clean);
  await prisma.newsHiddenTopic.upsert({
    where: { ownerId_fingerprint: { ownerId: user.id, fingerprint } },
    create: { ownerId: user.id, fingerprint, title: clean },
    update: { title: clean },
  });
  revalidatePath("/wiadomosci");
}

/** Cofnięcie odrzucenia — temat wraca na listę propozycji. */
export async function unhideHotTopic(id: string): Promise<void> {
  const user = await requireAuth();
  const row = await prisma.newsHiddenTopic.findUnique({ where: { id } });
  if (!row || row.ownerId !== user.id) throw new Error("Nie znaleziono odrzuconego tematu");
  await prisma.newsHiddenTopic.delete({ where: { id } });
  revalidatePath("/wiadomosci");
}

export async function getHiddenTopics(): Promise<HiddenTopicDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.newsHiddenTopic.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.createdAt.toISOString() }));
}
