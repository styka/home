// 039: przebieg odświeżania Wiadomości — JEDNO zadanie na cały moduł, cztery etapy.
//
// Dlaczego zadanie, a nie akcja: poprzedni `refreshTopic` chodził w Server Action, więc wskaźnik
// postępu żył wyłącznie w komponencie — odświeżenie strony gubiło informację, że cokolwiek trwa.
// Kolejka ma trwały stan, ponawianie i obsługę błędu, i nie trzeba było pisać do tego nic nowego.
//
// Dlaczego jeden przebieg na moduł, a nie na temat: RSS-y są wspólne dla wszystkich tematów.
// Przy 3 tematach × 5 źródeł (+ ponowne pobranie w gorących tematach) ten sam kanał leciał ~20 razy
// na cykl. Teraz każde źródło pobieramy RAZ do wspólnej puli (`NewsArticle`), a przypisanie do
// tematów jest osobnym, tanim etapem na całej puli naraz.

import { prisma } from "@/platform/db/prisma";
import { chatComplete } from "@/platform/llm/chat";
import { parseJsonLoose } from "@/platform/llm/json";
import { fetchRss } from "@/lib/news/rss";
import { fingerprintOf } from "@/lib/textKey";
import { usageFromChat, type AiUsageInfo } from "@/lib/ai/usage";
import { JobError, type JobContext } from "@/lib/jobs/types";

/** Okno pierwszego przebiegu, gdy nigdy jeszcze nie pobieraliśmy puli. */
const FIRST_RUN_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Ile pozycji z jednego kanału bierzemy pod uwagę (kanały bywają bardzo długie). */
const MAX_ITEMS_PER_SOURCE = 40;
/** Ile artykułów idzie w jednej porcji do klasyfikacji — porcja musi zmieścić się w budżecie. */
const CLASSIFY_BATCH = 40;
/** Ile świeżych artykułów z puli w ogóle rozważamy w jednym przebiegu. */
const MAX_POOL_PER_RUN = 120;

export interface NewsRefreshPayload {
  /** Zignoruj próg czasu i pobierz pełne okno 24 h (przycisk „Odśwież mimo wszystko"). */
  force?: boolean;
}

export interface NewsRefreshResult {
  /** Ile źródeł faktycznie odpytaliśmy — równe liczbie włączonych źródeł, niezależnie od tematów. */
  sources: number;
  /** Nowe artykuły w puli. */
  fetched: number;
  /** Przypisania artykuł → temat zapisane jako pozycje. */
  assigned: number;
  /** Pozycje, które dostały streszczenie od modelu. */
  summarized: number;
  /** Nowe fakty w liniach czasu. */
  timelineAdded: number;
  /** Model niedostępny/nieskonfigurowany — UI ma o tym powiedzieć wprost, a nie pokazać pustkę. */
  llmUnconfigured?: boolean;
  usage?: AiUsageInfo;
}

type LlmSink = Array<{ res: Awaited<ReturnType<typeof chatComplete>>; label?: string }>;

/**
 * Wywołanie modelu zwracające JSON. Odpowiedź UCIĘTA albo nieparsowalna to BŁĄD, nie pusty wynik
 * (lekcja z 038: `?? []` na wyniku parsowania zamieniało awarię w „nic nie znaleziono", a
 * użytkownik ponawiał w nieskończoność, bo komunikat nie mówił prawdy).
 */
async function llmJson<T>(
  op: "dispatch" | "generation" | "reasoning",
  system: string,
  user: string,
  maxTokens: number,
  sink: LlmSink,
  label: string
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
  sink.push({ res, label });
  if (!res.ok) throw new JobError(res.message, res.status);
  if (res.truncated) {
    throw new JobError(
      `Odpowiedź modelu została ucięta na etapie „${label}" — zabrakło budżetu tokenów.`,
      502
    );
  }
  const parsed = parseJsonLoose<T>(res.content);
  if (parsed == null) {
    throw new JobError(`Nie udało się odczytać odpowiedzi modelu na etapie „${label}".`, 502);
  }
  return parsed;
}

// ─── Etap 1: pobranie puli ──────────────────────────────────────────────────

interface PoolStageResult {
  sources: number;
  fetched: number;
}

/**
 * Pobiera każde włączone źródło **dokładnie raz** i dopisuje nowe pozycje do wspólnej puli.
 *
 * Próg czasu jest wspólny dla całego modułu (`NewsPref.lastFetchedAt`), bo pobranie przestało być
 * czynnością pojedynczego tematu. Pierwszy przebieg bierze okno 24 h — bez tego zaciągnęlibyśmy
 * całą historię kanału przy pierwszym kliknięciu.
 */
async function fetchPool(ownerId: string, force: boolean, ctx: JobContext): Promise<PoolStageResult> {
  const sources = await prisma.newsSource.findMany({
    where: { ownerId, enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  if (sources.length === 0) return { sources: 0, fetched: 0 };

  const firstRunFloor = new Date(Date.now() - FIRST_RUN_WINDOW_MS);

  /**
   * Próg czasu liczymy **per źródło**, z najnowszego artykułu tego źródła W PULI — a nie ze
   * wspólnego znacznika „kiedy ostatnio pobieraliśmy".
   *
   * Powód: `fetchRss` połyka błędy sieci i zwraca pustą listę. Przy wspólnym znaczniku jeden
   * timeout portalu przesuwałby próg wszystkim, więc materiał z okna awarii nie wróciłby już
   * NIGDY — cicho, bez śladu w interfejsie. Znacznik wyliczony z tego, co faktycznie mamy,
   * przesuwa się wyłącznie dla źródeł, które naprawdę coś dostarczyły.
   */
  const watermarks = await prisma.newsArticle.groupBy({
    by: ["sourceId"],
    where: { ownerId },
    _max: { publishedAt: true },
  });
  const sinceBySource = new Map(
    watermarks.map((w) => [w.sourceId, w._max.publishedAt ?? firstRunFloor])
  );

  let fetched = 0;
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    ctx.progress?.(`Pobieram źródła (${i + 1}/${sources.length})…`);
    const feed = await fetchRss(source.rssUrl);
    const since = force ? firstRunFloor : sinceBySource.get(source.id) ?? firstRunFloor;

    const rows = feed
      .slice(0, MAX_ITEMS_PER_SOURCE)
      // Pozycja bez daty w kanale jest w nim TERAZ, więc traktujemy ją jako bieżącą zamiast
      // wyrzucać — inaczej kanały bez `pubDate` byłyby dla nas niewidoczne.
      .map((f) => ({ ...f, publishedAt: f.publishedAt ?? new Date() }))
      .filter((f) => f.publishedAt >= since)
      .map((f) => ({
        ownerId,
        sourceId: source.id,
        url: f.link,
        title: f.title,
        description: f.description,
        publishedAt: f.publishedAt,
      }));
    if (rows.length === 0) continue;

    // Duplikat po [ownerId, sourceId, url] = ten sam artykuł widziany w poprzednim przebiegu.
    const res = await prisma.newsArticle.createMany({ data: rows, skipDuplicates: true });
    fetched += res.count;
  }

  // `lastFetchedAt` nie steruje już progiem (robi to znacznik per źródło powyżej) — zostaje jako
  // informacja „kiedy ostatnio pobieraliśmy", pokazywana użytkownikowi.
  await prisma.newsPref.upsert({
    where: { ownerId },
    create: { ownerId, lastFetchedAt: new Date() },
    update: { lastFetchedAt: new Date() },
  });

  return { sources: sources.length, fetched };
}

// ─── Etap 2: klasyfikacja puli do tematów ───────────────────────────────────

const CLASSIFY_SYSTEM =
  "Jesteś redaktorem przydzielającym materiały prasowe do monitorowanych tematów. Dla każdego " +
  "artykułu wskazujesz, do których tematów pasuje SEMANTYCZNIE (nie po samych słowach kluczowych). " +
  "Artykuł może nie pasować do żadnego tematu — to normalne i częste. Odrzucaj clickbait i " +
  "materiały tylko ocierające się o temat. Pisz po polsku. Zwróć WYŁĄCZNIE JSON.";

interface ClassifyRow {
  /** Indeks artykułu w przekazanej porcji. */
  index: number;
  /** Indeksy tematów, do których artykuł pasuje. */
  topics: number[];
}

interface PoolArticle {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  description: string;
  publishedAt: Date;
}

interface TopicRow {
  id: string;
  title: string;
  semanticFilter: string;
}

/**
 * Przypisuje pulę do tematów **jednym wywołaniem na porcję**, a nie jednym na parę temat × źródło.
 *
 * To jest cała oszczędność tej przebudowy: model widzi wszystkie tematy naraz, więc jeden przejazd
 * po puli obsługuje cały moduł. Operacja jest tania (`dispatch`) — dopiero streszczenia i linia
 * czasu, czyli etapy pracujące na wybranym materiale, sięgają po droższe modele.
 */
async function classifyPool(
  articles: PoolArticle[],
  topics: TopicRow[],
  defaultLength: string,
  sink: LlmSink,
  ctx: JobContext
): Promise<{ assigned: number; newItemIds: string[] }> {
  if (articles.length === 0 || topics.length === 0) return { assigned: 0, newItemIds: [] };

  const topicList = topics
    .map((t, i) => `${i}. „${t.title}" — ${t.semanticFilter}`)
    .join("\n");

  let assigned = 0;
  const newItemIds: string[] = [];
  const batches = Math.ceil(articles.length / CLASSIFY_BATCH);

  for (let b = 0; b < batches; b++) {
    const batch = articles.slice(b * CLASSIFY_BATCH, (b + 1) * CLASSIFY_BATCH);
    ctx.progress?.(
      batches > 1
        ? `Przypisuję do tematów (${b + 1}/${batches})…`
        : "Przypisuję materiały do tematów…"
    );

    const articleList = batch
      .map(
        (a, i) =>
          `${i}. ${a.title}\n   ${a.description.slice(0, 300) || "(brak skrótu)"}`
      )
      .join("\n");

    const out = await llmJson<{ matches?: ClassifyRow[] }>(
      "dispatch",
      CLASSIFY_SYSTEM,
      `TEMATY:\n${topicList}\n\nARTYKUŁY:\n${articleList}\n\n` +
        `Zwróć JSON: {"matches":[{"index":0,"topics":[1]}]}. Pomijaj artykuły bez dopasowania — ` +
        `nie zwracaj dla nich pustych wpisów.`,
      2000,
      sink,
      "przypisanie do tematów"
    );

    for (const m of out.matches ?? []) {
      const article = batch[m.index];
      if (!article || !Array.isArray(m.topics)) continue;
      for (const ti of m.topics) {
        const topic = topics[ti];
        if (!topic) continue;
        try {
          const item = await prisma.newsItem.create({
            data: {
              topicId: topic.id,
              sourceId: article.sourceId,
              articleId: article.id,
              url: article.url,
              title: article.title,
              // Streszczenie modelu dopiero w etapie 3 — na razie skrót z kanału, żeby pozycja
              // nigdy nie była pusta, nawet gdyby dalsze etapy padły.
              summary: article.description.slice(0, 400),
              summaryLength: defaultLength,
              imageUrl: null,
              publishedAt: article.publishedAt,
              status: "PENDING",
            },
          });
          newItemIds.push(item.id);
          assigned++;
        } catch {
          // Kolizja [topicId, sourceId, url] = ten artykuł jest już w tym temacie. Pomijamy.
        }
      }
    }
  }

  return { assigned, newItemIds };
}

/**
 * Świeże artykuły z puli, których nie przypisaliśmy jeszcze do żadnego tematu.
 *
 * „Nieprzypisany" liczymy po `articleId` w `NewsItem` — artykuł odrzucony przez klasyfikację (bo do
 * niczego nie pasował) wróciłby więc w kolejnym przebiegu. Ograniczamy to oknem czasu: bierzemy
 * tylko materiał z ostatniej doby, więc odrzut wypada z rozważań po dniu, zamiast wracać w kółko.
 */
async function unassignedPool(ownerId: string): Promise<PoolArticle[]> {
  const rows = await prisma.newsArticle.findMany({
    where: {
      ownerId,
      publishedAt: { gte: new Date(Date.now() - FIRST_RUN_WINDOW_MS) },
      items: { none: {} },
    },
    orderBy: { publishedAt: "desc" },
    take: MAX_POOL_PER_RUN,
    select: {
      id: true,
      sourceId: true,
      url: true,
      title: true,
      description: true,
      publishedAt: true,
    },
  });
  return rows;
}

// ─── Etap 3: streszczenia ───────────────────────────────────────────────────

/** Ile pozycji streszczamy jednym wywołaniem. */
const SUMMARY_BATCH = 10;

function lengthInstruction(length: string): string {
  switch (length) {
    case "short":
      return "Streszczenie KRÓTKIE: jedno zdanie, maks. ~25 słów, sama esencja.";
    case "long":
      return "Streszczenie SZCZEGÓŁOWE: 4–6 zdań, kontekst, liczby, konsekwencje (maks. ~130 słów).";
    default:
      return "Streszczenie ŚREDNIE: 2–3 zdania, najważniejsze fakty (maks. ~60 słów).";
  }
}

/**
 * Streszcza nowe pozycje w domyślnej długości użytkownika — **wsadowo**, ze skrótu z kanału.
 *
 * Świadomie NIE pobieramy tu pełnych treści artykułów: to byłoby kilkadziesiąt żądań HTTP na
 * przebieg dla materiału, którego użytkownik w większości nawet nie otworzy. Pełny tekst dociąga
 * dopiero `resummarizeItem`, gdy ktoś poprosi o dłuższe streszczenie konkretnej pozycji.
 */
async function summarizeItems(
  itemIds: string[],
  defaultLength: string,
  sink: LlmSink,
  ctx: JobContext
): Promise<number> {
  if (itemIds.length === 0) return 0;

  const items = await prisma.newsItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, title: true, summary: true },
  });
  if (items.length === 0) return 0;

  const system =
    "Streszczasz wiadomości prasowe po polsku, rzeczowo i bez ozdobników. Nie dopisujesz niczego, " +
    "czego nie ma w materiale. Zwróć WYŁĄCZNIE JSON.";

  let done = 0;
  const batches = Math.ceil(items.length / SUMMARY_BATCH);
  for (let b = 0; b < batches; b++) {
    const batch = items.slice(b * SUMMARY_BATCH, (b + 1) * SUMMARY_BATCH);
    ctx.progress?.(`Streszczam (${Math.min((b + 1) * SUMMARY_BATCH, items.length)}/${items.length})…`);

    const blocks = batch
      .map((it, i) => `${i}. Tytuł: ${it.title}\n   Materiał: ${it.summary.slice(0, 600) || "(brak)"}`)
      .join("\n");

    const out = await llmJson<{ summaries?: Array<{ index: number; summary: string }> }>(
      "generation",
      system,
      `${lengthInstruction(defaultLength)}\n\nMATERIAŁY:\n${blocks}\n\n` +
        `Zwróć JSON: {"summaries":[{"index":0,"summary":"..."}]} dla KAŻDEGO materiału.`,
      2000,
      sink,
      "streszczenia"
    );

    for (const s of out.summaries ?? []) {
      const item = batch[s.index];
      const text = s.summary?.trim();
      if (!item || !text) continue;
      await prisma.newsItem.update({
        where: { id: item.id },
        data: { summary: text, summaryLength: defaultLength },
      });
      done++;
    }
  }
  return done;
}

// ─── Etap 4: linia czasu ────────────────────────────────────────────────────

/** Ile istniejących faktów pokazujemy modelowi jako kontekst „to już wiemy". */
const TIMELINE_CONTEXT_ENTRIES = 30;

export type DateConfidence = "exact" | "approx" | "published";
const DATE_CONFIDENCES: DateConfidence[] = ["exact", "approx", "published"];

function parseDateConfidence(value: unknown): DateConfidence {
  return DATE_CONFIDENCES.includes(value as DateConfidence) ? (value as DateConfidence) : "published";
}

const TIMELINE_SYSTEM =
  "Budujesz LINIĘ CZASU tematu: listę suchych faktów, każdy z datą ZDARZENIA (nie datą publikacji " +
  "artykułu, jeśli treść mówi, kiedy coś się wydarzyło). Jeden fakt = jedno zdanie, bez ocen, " +
  "komentarza i clickbaitu. Dostajesz fakty JUŻ ZAPISANE — nie powtarzaj ich ani innymi słowami. " +
  "Jeśli nowe materiały nie wnoszą żadnego nowego faktu, zwróć pustą listę. Pisz po polsku. " +
  "Zwróć WYŁĄCZNIE JSON.";

interface TimelineFact {
  fact: string;
  /** Data zdarzenia w formacie RRRR-MM-DD. */
  date: string;
  dateConfidence?: string;
  /** Indeks materiału, z którego fakt pochodzi. */
  index?: number;
}

/**
 * Dopisuje do linii czasu tematu wyłącznie **brakujące** fakty.
 *
 * Model dostaje istniejące pozycje z tego samego okresu (a nie całą historię — przy długo
 * monitorowanym temacie kontekst rósłby bez końca i z każdym przebiegiem kosztował więcej).
 * Drugą zaporą przed dublowaniem jest odcisk faktu: unikat `[topicId, fingerprint]` w bazie łapie
 * to, co model przepuści.
 */
async function buildTimeline(
  topic: TopicRow,
  itemIds: string[],
  sink: LlmSink
): Promise<number> {
  if (itemIds.length === 0) return 0;

  const items = await prisma.newsItem.findMany({
    where: { id: { in: itemIds }, topicId: topic.id },
    orderBy: { publishedAt: "asc" },
    select: {
      id: true,
      sourceId: true,
      articleId: true,
      title: true,
      summary: true,
      publishedAt: true,
    },
  });
  if (items.length === 0) return 0;

  const oldest = items[0].publishedAt;
  const known = await prisma.newsTimelineEntry.findMany({
    where: {
      topicId: topic.id,
      // „Ten sam okres" liczymy od najstarszego nowego materiału wstecz o dobę — tyle wystarczy,
      // by model rozpoznał powtórkę, a nie tyle, by kontekst puchł z każdym miesiącem monitoringu.
      eventDate: { gte: new Date(oldest.getTime() - FIRST_RUN_WINDOW_MS) },
    },
    orderBy: { eventDate: "desc" },
    take: TIMELINE_CONTEXT_ENTRIES,
    select: { fact: true, eventDate: true },
  });

  const knownBlock = known.length
    ? known.map((k) => `- ${k.eventDate.toISOString().slice(0, 10)}: ${k.fact}`).join("\n")
    : "(linia czasu jest jeszcze pusta)";
  const materialBlock = items
    .map(
      (it, i) =>
        `${i}. [opublikowano ${it.publishedAt.toISOString().slice(0, 10)}] ${it.title}\n   ${it.summary.slice(0, 500)}`
    )
    .join("\n");

  const out = await llmJson<{ facts?: TimelineFact[] }>(
    "reasoning",
    TIMELINE_SYSTEM,
    `TEMAT: „${topic.title}"\nFILTR SEMANTYCZNY: ${topic.semanticFilter}\n\n` +
      `FAKTY JUŻ ZAPISANE:\n${knownBlock}\n\nNOWE MATERIAŁY:\n${materialBlock}\n\n` +
      `Zwróć JSON: {"facts":[{"fact":"jedno zdanie","date":"RRRR-MM-DD",` +
      `"dateConfidence":"exact|approx|published","index":0}]}. ` +
      `dateConfidence: "exact" = data wprost z treści, "approx" = szacowana z treści, ` +
      `"published" = brak daty zdarzenia, użyto daty publikacji.`,
    2000,
    sink,
    "linia czasu"
  );

  const rows = [];
  for (const f of out.facts ?? []) {
    const fact = f.fact?.trim();
    if (!fact) continue;
    const source = typeof f.index === "number" ? items[f.index] : undefined;
    const parsed = f.date ? new Date(f.date) : null;
    const eventDate =
      parsed && !Number.isNaN(parsed.getTime()) ? parsed : source?.publishedAt ?? new Date();
    rows.push({
      topicId: topic.id,
      eventDate,
      dateConfidence: parseDateConfidence(f.dateConfidence),
      fact,
      fingerprint: fingerprintOf(fact),
      sourceId: source?.sourceId ?? null,
      articleId: source?.articleId ?? null,
    });
  }
  if (rows.length === 0) return 0;

  const res = await prisma.newsTimelineEntry.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

// ─── Handler ────────────────────────────────────────────────────────────────

/**
 * 041: TRWAŁY ślad przebiegu — osobna tabela, a nie odczyt z kolejki.
 *
 * `cleanupOldJobs` kasuje zakończone zadania po 24 godzinach, a `Job.result` i tak trzyma wyłącznie
 * ostatni przebieg. Zgłoszenie mówi wprost o odczytaniu kosztu „po fakcie", więc historia musi
 * przeżyć sprzątanie kolejki.
 *
 * Zużycie zapisujemy SUROWE: handler nie ma sesji, więc bramka widoczności kosztu działa dopiero
 * przy odczycie (ten sam podział co dla `Job.result` od 039).
 */
export const RUN_HISTORY_LIMIT = 30;

/** Eksportowane dla testu retencji — nieograniczony wzrost tabeli jest tu jedynym realnym ryzykiem. */
export async function recordRun(
  ownerId: string,
  startedAt: Date,
  status: "done" | "failed",
  result: NewsRefreshResult | null,
  error?: string
): Promise<void> {
  try {
    await prisma.newsRefreshRun.create({
      data: {
        ownerId,
        startedAt,
        status,
        sources: result?.sources ?? 0,
        fetched: result?.fetched ?? 0,
        assigned: result?.assigned ?? 0,
        summarized: result?.summarized ?? 0,
        timelineAdded: result?.timelineAdded ?? 0,
        usage: result?.usage ? JSON.stringify(result.usage) : null,
        error: error ?? null,
      },
    });

    // Przycinamy do ostatnich 30 przebiegów. Zgłoszenie prosi o możliwość odczytania kosztu, nie o
    // wieczyste archiwum — a bez przycinania tabela rosłaby w nieskończoność.
    const old = await prisma.newsRefreshRun.findMany({
      where: { ownerId },
      orderBy: { finishedAt: "desc" },
      skip: RUN_HISTORY_LIMIT,
      select: { id: true },
    });
    if (old.length > 0) {
      await prisma.newsRefreshRun.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
    }
  } catch {
    // Zapis historii to KRONIKA, nie część przebiegu. Awaria kroniki nie może zabrać użytkownikowi
    // wyniku odświeżania, na który właśnie czekał.
  }
}

export async function newsRefreshHandler(
  payload: NewsRefreshPayload,
  ctx: JobContext
): Promise<NewsRefreshResult> {
  if (!ctx.ownerId) throw new JobError("Zadanie bez właściciela", 400);
  const ownerId = ctx.ownerId;
  const startedAt = new Date();
  try {
    const result = await runNewsRefresh(payload, ctx, ownerId);
    await recordRun(ownerId, startedAt, "done", result);
    return result;
  } catch (e) {
    await recordRun(ownerId, startedAt, "failed", null, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

async function runNewsRefresh(
  payload: NewsRefreshPayload,
  ctx: JobContext,
  ownerId: string
): Promise<NewsRefreshResult> {
  const sink: LlmSink = [];

  // ── Etap 1: pobranie puli ────────────────────────────────────────────────
  const pool = await fetchPool(ownerId, payload?.force === true, ctx);

  const topics = await prisma.newsTopic.findMany({
    where: { ownerId, enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, semanticFilter: true },
  });
  const pref = await prisma.newsPref.findUnique({ where: { ownerId } });
  const defaultLength = pref?.defaultSummaryLength ?? "medium";

  const base: NewsRefreshResult = {
    sources: pool.sources,
    fetched: pool.fetched,
    assigned: 0,
    summarized: 0,
    timelineAdded: 0,
  };
  // Bez tematów pula i tak ma sens (żywi gorące tematy), ale nie ma czego przypisywać.
  if (topics.length === 0) return { ...base, usage: usageFromChat(sink) };

  try {
    // ── Etap 2: klasyfikacja ───────────────────────────────────────────────
    const articles = await unassignedPool(ownerId);
    const { assigned, newItemIds } = await classifyPool(articles, topics, defaultLength, sink, ctx);
    base.assigned = assigned;

    // ── Etap 3: streszczenia ───────────────────────────────────────────────
    base.summarized = await summarizeItems(newItemIds, defaultLength, sink, ctx);

    // ── Etap 4: linia czasu ────────────────────────────────────────────────
    if (newItemIds.length > 0) {
      const newIds = new Set(newItemIds);
      for (let i = 0; i < topics.length; i++) {
        ctx.progress?.(`Buduję linię czasu (${i + 1}/${topics.length})…`);
        const topicItems = await prisma.newsItem.findMany({
          where: { topicId: topics[i].id, id: { in: Array.from(newIds) } },
          select: { id: true },
        });
        base.timelineAdded += await buildTimeline(
          topics[i],
          topicItems.map((it) => it.id),
          sink
        );
      }
    }

    await prisma.newsTopic.updateMany({
      where: { id: { in: topics.map((t) => t.id) } },
      data: { lastRefreshedAt: new Date() },
    });
  } catch (e) {
    // Model nieskonfigurowany to nie awaria przebiegu: pula jest pobrana, pozycje mogły powstać,
    // a użytkownik ma dostać zdanie „skonfiguruj model", nie czerwony błąd zadania. Każdy inny
    // błąd leci dalej — cicha degradacja przy uciętej odpowiedzi była właśnie tym, co w 038
    // kazało użytkownikowi ponawiać w nieskończoność.
    if (e instanceof JobError && e.status === 503) {
      return { ...base, llmUnconfigured: true, usage: usageFromChat(sink) };
    }
    throw e;
  }

  return { ...base, usage: usageFromChat(sink) };
}
