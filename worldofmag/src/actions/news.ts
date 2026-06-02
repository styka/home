"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { chatComplete } from "@/lib/llm/chat";
import { parseJsonLoose } from "@/lib/llm/json";
import { fetchRss } from "@/lib/news/rss";
import { fetchArticle } from "@/lib/news/article";
import { webSearch } from "@/lib/news/webSearch";
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
  changeNote: string | null;
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

/** Nowe (jeszcze nieobsłużone) pozycje dla tematu + bieżący stan wiedzy per źródło. */
export async function getTopicView(topicId: string): Promise<{
  items: NewsItemDTO[];
  knowledge: KnowledgeDTO[];
}> {
  const user = await requireAuth();
  await assertTopic(topicId, user.id);

  const items = await prisma.newsItem.findMany({
    where: { topicId, status: "PENDING" },
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
      changeNote: k.changeNote,
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
    changeNote: k.changeNote,
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

class LlmError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function llmJson<T>(
  op: "reasoning" | "generation",
  system: string,
  user: string,
  maxTokens = 2000
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
  if (!res.ok) throw new LlmError(res.status, res.message);
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

const MAX_BOOTSTRAP_ARTICLES = 10;

// Ujednolicony kandydat do bazowej bazy wiedzy (z RSS albo z wyszukiwarki).
interface BootstrapCandidate {
  title: string;
  url: string;
  date: Date | null;
  origin: "rss" | "web";
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * INICJALIZUJE bazę wiedzy (wersja 1) dla danego źródła, gdy temat nie ma jeszcze
 * żadnej wiedzy z tego źródła. Tworzy OBSZERNY, encyklopedyczny (jak Wikipedia)
 * opis w Markdown. Materiał zbiera z wyszukiwarki (domena źródła + szerzej) i RSS;
 * jeśli pobieranie zawiedzie, pisze rzetelną wersję wstępną z wiedzy ogólnej (z
 * adnotacją) — dzięki czemu inicjalizacja NIGDY nie kończy się pustką. Ustawia
 * znacznik `lastPublishedAt`. Zwraca true, jeśli utworzono wersję 1. Rzuca
 * `LlmError` przy niedostępnym LLM (caller to obsłuży).
 */
async function bootstrapKnowledge(
  topic: { id: string; title: string; semanticFilter: string },
  source: { id: string; name: string; homepageUrl: string },
  feed: Awaited<ReturnType<typeof fetchRss>>
): Promise<boolean> {
  const candidates: BootstrapCandidate[] = [];
  const seen = new Set<string>();
  const add = (c: BootstrapCandidate) => {
    if (seen.has(c.url)) return;
    seen.add(c.url);
    candidates.push(c);
  };

  // (1) Wyszukiwarka: najpierw w obrębie domeny źródła, potem szerzej w internecie.
  const domain = hostnameOf(source.homepageUrl);
  const query = `${topic.title} ${topic.semanticFilter}`.slice(0, 200);
  if (domain) {
    for (const r of await webSearch(`${topic.title} site:${domain}`, 6)) {
      add({ title: r.title, url: r.url, date: null, origin: "web" });
    }
  }
  for (const r of await webSearch(query, 6)) {
    add({ title: r.title, url: r.url, date: null, origin: "web" });
  }

  // (2) RSS źródła.
  const rssSorted = [...feed].sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
  );
  for (const f of rssSorted.slice(0, 6)) {
    add({ title: f.title, url: f.link, date: f.publishedAt, origin: "rss" });
  }

  const pick = candidates.slice(0, MAX_BOOTSTRAP_ARTICLES);
  const articles = await Promise.all(pick.map((p) => fetchArticle(p.url)));

  // Wzbogać daty z artykułów, zbierz obrazy, policz znacznik (najnowsza data).
  let watermark: Date | null = null;
  const images: string[] = [];
  const blocks = pick
    .map((p, i) => {
      const art = articles[i];
      const date = p.date ?? art.publishedAt ?? null;
      if (date && (!watermark || date > watermark)) watermark = date;
      if (art.imageUrl) images.push(art.imageUrl);
      const dateStr = date ? date.toISOString().slice(0, 10) : "data nieznana";
      return `### Materiał ${i} (${dateStr}, ${p.origin === "web" ? "wyszukiwarka" : "RSS"})\nTytuł: ${p.title}\nURL: ${p.url}\n${art.imageUrl ? `Obraz: ${art.imageUrl}\n` : ""}Treść: ${art.text.slice(0, 1800)}`;
    })
    .join("\n\n");
  const hasMaterial = blocks.trim().length > 0;

  const system =
    "Tworzysz OBSZERNĄ, encyklopedyczną (jak Wikipedia) bazową bazę wiedzy na zadany temat, z " +
    "perspektywy jednego źródła, po polsku, w Markdown. Użyj sekcji nagłówkowych (## …): " +
    "wprowadzenie, tło/geneza, oś czasu wydarzeń, kluczowe postacie/strony, stan obecny. " +
    "Jeśli masz materiały — opieraj się na nich i nie zmyślaj. Jeśli materiałów brak lub są ubogie, " +
    "napisz rzetelną wersję wstępną z wiedzy ogólnej i ZACZNIJ dokument linią cytatu dokładnie: " +
    "'> ⚠️ Wersja wstępna na podstawie wiedzy ogólnej — do weryfikacji i uzupełnienia bieżącymi źródłami.' " +
    "Gdy podano adresy obrazów, wpleć 1–3 z nich składnią ![](url) w trafnych miejscach. " +
    "Zwróć WYŁĄCZNIE JSON.";
  const userPrompt =
    `TEMAT: „${topic.title}"\nFILTR SEMANTYCZNY: ${topic.semanticFilter}\nŹRÓDŁO BAZOWE: ${source.name}\n\n` +
    (hasMaterial
      ? `MATERIAŁY:\n${blocks}\n\n`
      : `MATERIAŁY: (nie udało się nic pobrać — napisz wersję wstępną z wiedzy ogólnej)\n\n`) +
    (images.length ? `DOSTĘPNE OBRAZY (linkuj składnią ![](url), nie pobieraj): ${images.slice(0, 4).join(" , ")}\n\n` : "") +
    `Zwróć JSON: {"headline":"jednozdaniowy aktualny stan tematu",` +
    `"content":"OBSZERNA baza wiedzy w Markdown (sekcje ##, oś czasu, jeśli są — obrazy ![](url))",` +
    `"changeNote":"krótko: jak zbudowano bazę i jaka jest ostatnia znana informacja (z datą)"}.`;

  const out = await llmJson<{ headline: string; content: string; changeNote: string }>(
    "reasoning",
    system,
    userPrompt,
    6000
  );
  if (!out.content?.trim()) return false;

  try {
    await prisma.newsKnowledge.create({
      data: {
        topicId: topic.id,
        sourceId: source.id,
        version: 1,
        content: out.content.trim(),
        headline: out.headline?.trim() || null,
        changeNote:
          out.changeNote?.trim() ||
          (hasMaterial
            ? "Zainicjowano bazę wiedzy z materiałów internetowych (wyszukiwarka + RSS)."
            : "Zainicjowano wstępną bazę wiedzy z wiedzy ogólnej — do weryfikacji bieżącymi źródłami."),
        lastPublishedAt: watermark ?? new Date(),
      },
    });
    return true;
  } catch {
    // wyścig: ktoś już utworzył wersję 1 — pomiń
    return false;
  }
}

interface UpdateCandidate {
  title: string;
  url: string;
  date: Date | null;
  description: string;
  imageUrl: string | null;
  text: string;
}

/**
 * Odświeża temat. Dla każdego źródła:
 *  - brak bazy wiedzy → INICJALIZUJE (obszerna wersja 1, zawsze coś tworzy),
 *  - jest baza → szuka (wyszukiwarka + RSS) wiadomości z DATĄ PUBLIKACJI bieżącą
 *    lub nowszą niż data OSTATNIEGO WYSZUKIWANIA tematu (topic.lastRefreshedAt),
 *    ocenia trafność/nowość i dodaje jako PENDING (ze zdjęciem).
 * Bez okna 24h. Zwraca też `llmUnconfigured`, by UI pokazało czytelny błąd.
 */
export async function refreshTopic(
  topicId: string
): Promise<{ added: number; initialized: number; llmUnconfigured: boolean }> {
  const user = await requireAuth();
  const topic = await assertTopic(topicId, user.id);
  const pref = await prisma.newsPref.findUnique({ where: { ownerId: user.id } });
  const defaultLength = (pref?.defaultSummaryLength as SummaryLength) ?? "medium";

  // Próg = data ostatniego wyszukiwania tematu (sprzed tej operacji); pobieramy
  // wiadomości opublikowane w tym dniu lub później. Null → bez dolnego progu.
  const since = topic.lastRefreshedAt;

  const sources = await prisma.newsSource.findMany({
    where: { ownerId: user.id, enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  let added = 0;
  let initialized = 0;
  let llmUnconfigured = false;

  for (const source of sources) {
    const currentK = await prisma.newsKnowledge.findFirst({
      where: { topicId, sourceId: source.id },
      orderBy: { version: "desc" },
    });

    // ── Brak bazy wiedzy → INICJALIZACJA ──────────────────────────────────
    if (!currentK) {
      const feed = await fetchRss(source.rssUrl);
      try {
        if (await bootstrapKnowledge(topic, source, feed)) initialized++;
      } catch (e) {
        if (e instanceof LlmError && e.status === 503) llmUnconfigured = true;
        // inny błąd jednego źródła nie blokuje pozostałych
      }
      continue;
    }

    // ── Jest baza → AKTUALIZACJA od daty ostatniego wyszukiwania ────────────
    const candMap = new Map<string, { title: string; link: string; date: Date | null; description: string }>();

    const feed = await fetchRss(source.rssUrl);
    for (const f of feed) {
      // Pomiń pozycje RSS o znanej dacie starszej niż ostatnie wyszukiwanie (oszczędza pobrania).
      if (since && f.publishedAt && f.publishedAt < since) continue;
      if (!candMap.has(f.link))
        candMap.set(f.link, { title: f.title, link: f.link, date: f.publishedAt, description: f.description });
    }
    const domain = hostnameOf(source.homepageUrl);
    const queries = domain
      ? [`${topic.title} site:${domain}`, `${topic.title} ${topic.semanticFilter}`.slice(0, 200)]
      : [`${topic.title} ${topic.semanticFilter}`.slice(0, 200)];
    for (const q of queries) {
      for (const r of await webSearch(q, 6)) {
        if (!candMap.has(r.url))
          candMap.set(r.url, { title: r.title, link: r.url, date: null, description: r.snippet });
      }
    }

    // Odrzuć URL-e już przetworzone (dowolny status) dla tego tematu+źródła.
    const allUrls = Array.from(candMap.keys());
    const known = new Set(
      (
        await prisma.newsItem.findMany({
          where: { topicId, sourceId: source.id, url: { in: allUrls } },
          select: { url: true },
        })
      ).map((r) => r.url)
    );
    const raw = allUrls.filter((u) => !known.has(u)).map((u) => candMap.get(u)!).slice(0, 12);
    if (raw.length === 0) continue;

    // Dociągnij artykuły → daty publikacji + obrazy.
    const arts = await Promise.all(raw.map((c) => fetchArticle(c.link)));
    const enriched: UpdateCandidate[] = raw.map((c, i) => ({
      title: c.title,
      url: c.link,
      date: c.date ?? arts[i].publishedAt ?? null,
      description: c.description,
      imageUrl: arts[i].imageUrl,
      text: arts[i].text,
    }));

    // Filtr: data publikacji bieżąca/nowsza niż ostatnie wyszukiwanie (nieznane daty zostawiamy).
    const fresh = enriched.filter((c) => !since || !c.date || c.date >= since);
    const candidates = fresh.slice(0, MAX_CANDIDATES_PER_SOURCE);
    if (candidates.length === 0) continue;

    const candidateBlocks = candidates
      .map((c, i) => {
        const body = c.text || c.description;
        const d = c.date ? c.date.toISOString().slice(0, 10) : "nieznana";
        return `### Artykuł ${i}\nTytuł: ${c.title}\nData: ${d}\nURL: ${c.url}\nTreść: ${body.slice(0, 2500)}`;
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
      `DOTYCHCZASOWY STAN WIEDZY (źródło: ${source.name}):\n${currentK.content.slice(0, 4000)}\n\n` +
      `KANDYDACI:\n${candidateBlocks}\n\n` +
      `Dla KAŻDEGO artykułu zdecyduj: relevant (czy pasuje do tematu), novel (czy wnosi nową ` +
      `istotną informację względem stanu wiedzy). ${lengthInstruction(defaultLength)}\n` +
      `noveltyNote = jedno zdanie: co NOWEGO wnosi (lub dlaczego nic nie wnosi).\n` +
      `Zwróć JSON: {"decisions":[{"index":0,"relevant":true,"novel":true,"noveltyNote":"...","summary":"..."}]}`;

    let decisions: FilterDecision[] = [];
    try {
      const out = await llmJson<{ decisions: FilterDecision[] }>("reasoning", system, userPrompt);
      decisions = out.decisions ?? [];
    } catch (e) {
      if (e instanceof LlmError && e.status === 503) llmUnconfigured = true;
      decisions = [];
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
            url: c.url,
            title: c.title,
            summary: d.summary?.trim() || c.description.slice(0, 200),
            summaryLength: defaultLength,
            noveltyNote: d.noveltyNote?.trim() || null,
            imageUrl: c.imageUrl ?? null,
            publishedAt: c.date ?? new Date(),
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
  return { added, initialized, llmUnconfigured };
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

/**
 * Przyjmuje pozycję „do wiedzy" → DOPISUJE nową, datowaną sekcję do bazy wiedzy
 * (nie przepisuje wcześniejszej treści). Nagłówek sekcji ma datę PUBLIKACJI w
 * mediach, a w sekcji (jeśli jest) linkowany obraz. Przesuwa znacznik świeżości.
 */
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
  const pubDate = item.publishedAt.toISOString().slice(0, 10);

  // LLM pisze TYLKO treść nowej sekcji (zwięzła integracja) + zaktualizowany headline.
  const system =
    "Dopisujesz nową, datowaną sekcję do narastającej bazy wiedzy na temat (osobno per źródło). " +
    "NIE przepisujesz wcześniejszych sekcji. Na podstawie nowej wiadomości napisz zwięzłą treść " +
    "sekcji po polsku w Markdown (1–4 akapity/punkty), nawiązując do dotychczasowego stanu, jeśli to " +
    "istotne. Zwróć WYŁĄCZNIE JSON {\"sectionBody\":\"...\",\"headline\":\"...\"} — bez nagłówka sekcji " +
    "(nagłówek z datą dodajemy automatycznie).";
  const userPrompt =
    `TEMAT: „${item.topic.title}" (${item.topic.semanticFilter})\n` +
    `ŹRÓDŁO: ${item.source.name}\n\n` +
    `DOTYCHCZASOWY STAN WIEDZY (kontekst, NIE powtarzaj go):\n${(prev?.content ?? "").slice(0, 4000)}\n\n` +
    `NOWA WIADOMOŚĆ (opublikowana ${pubDate}):\nTytuł: ${item.title}\nStreszczenie: ${item.summary}\n` +
    `Co nowego: ${item.noveltyNote ?? "—"}\nURL: ${item.url}\n\n` +
    `sectionBody = treść nowej sekcji (Markdown, bez nagłówka).\n` +
    `headline = zaktualizowany jednozdaniowy „aktualny stan" tematu.`;

  const out = await llmJson<{ sectionBody: string; headline: string }>("reasoning", system, userPrompt);

  // Złóż sekcję: nagłówek z datą publikacji + (opcjonalnie) obraz + treść + źródło.
  const sectionParts = [`## ${pubDate} — ${item.title}`];
  if (item.imageUrl) sectionParts.push(`![](${item.imageUrl})`);
  sectionParts.push(out.sectionBody?.trim() || item.summary);
  sectionParts.push(`[Źródło](${item.url})`);
  const section = sectionParts.join("\n\n");

  const baseContent = prev?.content?.trim() ?? "";
  const newContent = baseContent ? `${baseContent}\n\n${section}` : section;
  const prevWatermark = prev?.lastPublishedAt ?? null;
  const newWatermark =
    prevWatermark && prevWatermark > item.publishedAt ? prevWatermark : item.publishedAt;

  await prisma.$transaction([
    prisma.newsKnowledge.create({
      data: {
        topicId: item.topicId,
        sourceId: item.sourceId,
        version: (prev?.version ?? 0) + 1,
        content: newContent,
        headline: out.headline?.trim() || prev?.headline || null,
        changeNote: section,
        lastPublishedAt: newWatermark,
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
