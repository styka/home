"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { chatComplete } from "@/platform/llm/chat";
import { parseJsonLoose } from "@/platform/llm/json";
import { fetchArticle } from "@/lib/news/article";
import { DEFAULT_SOURCES } from "@/lib/news/sources";
import { fingerprintOf } from "@/lib/textKey";
import { usageFromChat, type AiUsageInfo } from "@/platform/ai/usage";
import { visibleUsage } from "@/platform/ai/costVisibility";
import { enqueue, MAX_ACTIVE_JOBS_PER_OWNER } from "@/platform/jobs/queue";
import { ensureJobWorker } from "@/lib/jobs/registry";
import type { DateConfidence, NewsRefreshResult } from "../jobs/newsRefresh";
import type { NewsItem, NewsSource } from "@prisma/client";
import { wlasnoscOsobistaDoZapisu, filtrMoichRekordow, czyMojRekord } from "@/platform/workspaces/zapis";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import { createNote, notesModule } from "@/modules/notes/contract";
import { SUFIT_LISTY } from "@/platform/pagination";
import { przeliczGoraceTematy, type HotTopic, type WynikGoracychTematow } from "../lib/goraceTematy";
import {
  czyZaDlugie,
  instrukcjaDlugosci,
  instrukcjaKorekty,
  poziomStreszczenia,
  LIMIT_MATERIALU,
} from "../lib/dlugoscStreszczenia";

export type SummaryLength = "short" | "medium" | "long";
/**
 * 086: `DISMISSED` USUNIĘTY. Zapisywała go akcja „Odrzuć", a **żaden odczyt go nie rozróżniał** —
 * z punktu widzenia użytkownika „Odrzuć" i „Przeczytane" robiły dokładnie to samo. Została jedna
 * akcja, a migracja 0258 znormalizowała istniejące wiersze. String + unia TS, bez enumów (C-12).
 */
export type ItemStatus = "PENDING" | "ACKNOWLEDGED";

const FRESHNESS_MS = 24 * 60 * 60 * 1000;

export interface SourceDTO {
  id: string;
  key: string;
  name: string;
  rssUrl: string;
  homepageUrl: string;
  /** 040: krótki opis własnymi słowami; pusty = bez opisu. */
  descriptor: string;
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
  sourceDescriptor: string;
  url: string;
  title: string;
  summary: string;
  summaryLength: SummaryLength;
  /** 084: mimo ponowień nie udało się streścić — karta pokazuje surowy skrót z kanału i mówi to. */
  summaryFailed: boolean;
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
  sourceDescriptor: string | null;
  /** Adres materiału źródłowego, jeśli znany — pozwala kliknąć w fakt i sprawdzić go u źródła. */
  url: string | null;
}

// ─── Setup / seed ──────────────────────────────────────────────────────────

/** Seeduje domyślne źródła + preferencje przy pierwszym wejściu użytkownika. */
export async function ensureNewsSetup(): Promise<void> {
  const user = await requireAuth();
  const count = await prisma.newsSource.count({ where: { ...(await filtrMoichRekordow(user.id)) } });
  if (count === 0) {
    // Jedno ustalenie przestrzeni na cały wsad, nie jedno na wiersz: `createMany` to jeden zapis,
    // a `wlasnoscOsobistaDoZapisu` potrafi domknąć brakującą przestrzeń — wołanie go w `map`
    // wykonałoby tę próbę tyle razy, ile jest domyślnych źródeł.
    const wlasnosc = await wlasnoscOsobistaDoZapisu(user.id);
    // 100: `skipDuplicates` NIE jest ostrożnościowe. „Policz, a jeśli zero — wstaw" to klasyczne
    // sprawdź-i-działaj: dwie równoległe karty (albo dwa procesy klikacza) widzą zero i obie
    // wstawiają, a `@@unique([workspaceId, key])` odbija drugą — z P2002 lecącym w górę i całą
    // stroną Wiadomości na 500. Złapane pomiarem w 100: dwaj pracownicy Playwrighta weszli na
    // /wiadomosci naraz i strona się nie wyrenderowała. Ten sam zapis stoi już w `newsRefresh.ts`.
    await prisma.newsSource.createMany({
      data: DEFAULT_SOURCES.map((s) => ({ ...s, ...wlasnosc })),
      skipDuplicates: true,
    });
  }
  await prisma.newsPref.upsert({
    where: { ...(await filtrMoichRekordow(user.id)) },
    create: { ...(await wlasnoscOsobistaDoZapisu(user.id)) },
    update: {},
  });
}

// ─── Reads ───────────────────────────────────────────────────────────────

export async function getSources(): Promise<SourceDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.newsSource.findMany({
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name,
    rssUrl: s.rssUrl,
    homepageUrl: s.homepageUrl,
    descriptor: s.descriptor,
    enabled: s.enabled,
    sortOrder: s.sortOrder,
  }));
}

export async function getTopics(): Promise<TopicDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.newsTopic.findMany({
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)) },
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

/**
 * 083: preferencje modułu to już TYLKO domyślna długość streszczeń.
 *
 * `activeSourceKey` (wybrane źródło) wyszedł stąd do stanu widoku w adresie — bo filtr źródeł stał
 * się wielokrotnym wyborem, a przede wszystkim dlatego, że widok zapisywany gwiazdką do ulubionych
 * musi nieść swój filtr w adresie. Zapis w bazie byłby DRUGIM nośnikiem tej samej informacji:
 * ulubiony „Wiadomości z jednego portalu" pokazywałby po powrocie coś innego niż w chwili zapisu.
 * Kolumna zostaje w tabeli (nic jej nie czyta) — kasowanie jej to osobna migracja porządkowa.
 */
export async function getNewsPref(): Promise<{
  defaultSummaryLength: SummaryLength;
  showEmptyTopics: boolean;
}> {
  const user = await requireAuth();
  const p = await prisma.newsPref.findUnique({ where: { ...(await filtrMoichRekordow(user.id)) } });
  return {
    defaultSummaryLength: (p?.defaultSummaryLength as SummaryLength) ?? "medium",
    // Brak wiersza = domyślne ukrycie pustych tematów, tak samo jak domyślnik kolumny. Dwa miejsca
    // z tą samą wartością są tu nieuniknione (odczyt bez wiersza vs. wstawienie wiersza), więc
    // trzymamy je obok siebie w jednym pliku, a nie w dwóch warstwach.
    showEmptyTopics: p?.showEmptyTopics ?? false,
  };
}

async function assertTopic(topicId: string, userId: string) {
  const t = await prisma.newsTopic.findUnique({ where: { id: topicId } });
  if (!t || !(await czyMojRekord(t, userId))) throw new Error("Temat nie istnieje");
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
    take: SUFIT_LISTY,
    where: { topicId, status: "PENDING" },
    orderBy: { publishedAt: "desc" },
    include: { source: true },
  });

  const timeline = await getTopicTimeline(topicId);

  return { items: items.map(toItemDTO), timeline };
}

/**
 * 044: mapowanie pozycji na DTO wyjęte z `getTopicView`, bo od teraz ma dwóch konsumentów —
 * widok jednego tematu i strumień wszystkich tematów. Dwie kopie tego samego mapowania rozjechałyby
 * się przy pierwszym nowym polu.
 */
function toItemDTO(i: NewsItem & { source: NewsSource }): NewsItemDTO {
  return {
    id: i.id,
    sourceId: i.sourceId,
    sourceName: i.source.name,
    sourceKey: i.source.key,
    sourceDescriptor: i.source.descriptor,
    url: i.url,
    title: i.title,
    summary: i.summary,
    summaryLength: i.summaryLength as SummaryLength,
    summaryFailed: i.summaryFailed,
    noveltyNote: i.noveltyNote,
    imageUrl: i.imageUrl,
    publishedAt: i.publishedAt.toISOString(),
    status: i.status as ItemStatus,
  };
}

/** 044: temat wraz z jego nowymi pozycjami — jednostka strumienia. */
export interface StreamTopicDTO {
  id: string;
  title: string;
  pendingCount: number;
  items: NewsItemDTO[];
}

/**
 * 044: WSZYSTKIE nowe wiadomości ze wszystkich tematów, w jednym odczycie.
 *
 * Zgłoszenie właściciela: „z wiadomości na mobile korzysta się niewygodnie" — żeby przejrzeć nową
 * porcję, trzeba było przełączać temat po temacie i za każdym razem czekać na wczytanie. Ten odczyt
 * pozwala złożyć jeden ciągły strumień.
 *
 * Tematy BEZ nowych pozycji zwracamy z pustą listą, a nie pomijamy: znikający temat wygląda jak
 * usterka, a pusta sekcja jest informacją („tu nic nowego nie przyszło").
 *
 * Jedno zapytanie z `include` zamiast N+1 — to te same dane, które użytkownik i tak by wczytał,
 * przechodząc temat po temacie.
 */
export async function getStreamView(): Promise<StreamTopicDTO[]> {
  const user = await requireAuth();
  const topics = await prisma.newsTopic.findMany({
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        where: { status: "PENDING" },
        orderBy: { publishedAt: "desc" },
        include: { source: true },
      },
    },
  });

  return topics.map((t) => ({
    id: t.id,
    title: t.title,
    pendingCount: t.items.length,
    items: t.items.map(toItemDTO),
  }));
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
    take: SUFIT_LISTY,
    where: { topicId },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    include: { source: true },
  });

  // Adres materiału bierzemy z puli — pozwala kliknąć w fakt i sprawdzić go u źródła.
  const articleIds = rows.map((r) => r.articleId).filter((id): id is string => !!id);
  const articles = articleIds.length
    ? await prisma.newsArticle.findMany({
      take: SUFIT_LISTY,
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
    sourceDescriptor: r.source?.descriptor ?? null,
    url: r.articleId ? urlById.get(r.articleId) ?? null : null,
  }));
}

/**
 * 083: ile faktów z osi czasu wczytujemy NA JEDEN TEMAT w widoku zbiorczym.
 *
 * Nie `SUFIT_LISTY`: przy kilkunastu tematach ten sam sufit na każdym z nich dałby kilkanaście
 * tysięcy wpisów w jednej odpowiedzi. Sto faktów to znacznie więcej, niż da się przeczytać jednym
 * posiedzeniem, a oś jest z natury chronologiczna — starsze wpisy czyta się w widoku pojedynczego
 * tematu (`getTopicTimeline`, tam sufit jest pełny).
 */
const SUFIT_OSI_NA_TEMAT = 100;

/** 083: linia czasu jednego tematu — jednostka przeglądu osi w tych samych sekcjach co wiadomości. */
export interface StreamTimelineTopicDTO {
  id: string;
  title: string;
  entries: TimelineEntryDTO[];
}

/**
 * 083: linia czasu WSZYSTKICH tematów w jednym odczycie.
 *
 * Zgłoszenie właściciela: „linia czasu nie działa przy wybranych wszystkich tematach i nie widać,
 * który wpis do którego tematu należy". Do 082 przełącznik `Wiadomości ⇄ Linia czasu` czytał
 * `getTopicTimeline(topicId)`, więc przy pozycji zbiorczej nie miał czego zapytać i pokazywał pustkę.
 *
 * Kształt jest CELOWO taki sam jak `getStreamView`: oba widoki rysuje ten sam układ sekcji z
 * przyklejonym nagłówkiem tematu, więc przynależność wpisu do tematu wynika z miejsca na ekranie,
 * a nie z dodatkowej etykietki przy każdym wierszu.
 *
 * Adresy materiałów dociągamy JEDNYM zapytaniem dla wszystkich tematów naraz — pętla po tematach
 * dawałaby N+1 przy każdym wejściu na oś.
 */
export async function getStreamTimeline(): Promise<StreamTimelineTopicDTO[]> {
  const user = await requireAuth();
  const topics = await prisma.newsTopic.findMany({
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      timeline: {
        // Sufit NA TEMAT, nie na całość. `NewsTimelineEntry` nie podlega retencji (patrz
        // `retention.ts` — kasujemy materiał z puli, nie fakty na osi), więc oś rośnie w
        // nieskończoność: po pół roku monitorowania kilkunastu tematów jedno kliknięcie „Linia
        // czasu" ściągałoby całą historię wszystkich tematów naraz. `getStreamView` nie ma tego
        // problemu, bo tam pozycje są zawężone do `status: "PENDING"` — tu odpowiednika nie ma,
        // więc granica musi być jawna.
        take: SUFIT_OSI_NA_TEMAT,
        orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
        include: { source: true },
      },
    },
  });

  const articleIds = Array.from(
    new Set(topics.flatMap((t) => t.timeline.map((r) => r.articleId).filter((id): id is string => !!id)))
  );
  const urlById = new Map(await adresyMaterialow(articleIds));

  return topics.map((t) => ({
    id: t.id,
    title: t.title,
    entries: t.timeline.map((r) => ({
      id: r.id,
      eventDate: r.eventDate.toISOString(),
      dateConfidence: r.dateConfidence as DateConfidence,
      fact: r.fact,
      sourceName: r.source?.name ?? null,
      sourceKey: r.source?.key ?? null,
      sourceDescriptor: r.source?.descriptor ?? null,
      url: r.articleId ? urlById.get(r.articleId) ?? null : null,
    })),
  }));
}

/**
 * Adresy materiałów źródłowych dla podanych identyfikatorów — pobierane PARTIAMI.
 *
 * Jedno zapytanie z `take: SUFIT_LISTY` wyglądałoby na bezpieczne, a przy większej liczbie
 * identyfikatorów po cichu zwracałoby część: brakujące wpisy dostawałyby `url: null`, czyli fakt na
 * osi traciłby odnośnik „sprawdź u źródła" — bez błędu i bez śladu, zależnie od kolejności zwróconej
 * przez bazę. Skoro pytamy o konkretne klucze główne, granicą jest ROZMIAR PARTII, nie sufit wyniku.
 */
async function adresyMaterialow(articleIds: string[]): Promise<Array<[string, string]>> {
  const pary: Array<[string, string]> = [];
  for (let i = 0; i < articleIds.length; i += SUFIT_LISTY) {
    const partia = articleIds.slice(i, i + SUFIT_LISTY);
    if (partia.length === 0) break;
    // paginacja: kompletny — pytamy o konkretne klucze główne jednej partii (rozmiar partii JEST
    // granicą); brak choćby jednego wiersza znaczy „fakt bez odnośnika", a nie „krótsza lista".
    const rows = await prisma.newsArticle.findMany({
      where: { id: { in: partia } },
      select: { id: true, url: true },
    });
    for (const a of rows) pary.push([a.id, a.url]);
  }
  return pary;
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
    where: { ...(await filtrMoichRekordow(user.id)) },
    _min: { sortOrder: true },
  });
  const t = await prisma.newsTopic.create({
    data: {
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
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

/** 040: maksymalna długość opisu źródła — etykieta na karcie, nie miejsce na notatkę. */
const MAX_DESCRIPTOR_LEN = 60;

export async function createSource(data: {
  name: string;
  rssUrl: string;
  homepageUrl: string;
  descriptor?: string;
}): Promise<void> {
  const user = await requireAuth();
  const name = data.name.trim();
  if (!name) throw new Error("Nazwa źródła jest wymagana");
  if (!/^https?:\/\//i.test(data.rssUrl.trim())) throw new Error("Adres RSS musi być poprawnym URL");
  const key = `custom-${Date.now().toString(36)}`;
  const max = await prisma.newsSource.aggregate({
    where: { ...(await filtrMoichRekordow(user.id)) },
    _max: { sortOrder: true },
  });
  await prisma.newsSource.create({
    data: {
      ...(await wlasnoscOsobistaDoZapisu(user.id)),
      key,
      name,
      rssUrl: data.rssUrl.trim(),
      homepageUrl: data.homepageUrl.trim() || data.rssUrl.trim(),
      descriptor: (data.descriptor ?? "").trim().slice(0, MAX_DESCRIPTOR_LEN),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/wiadomosci");
}

export async function updateSource(
  id: string,
  patch: { name?: string; rssUrl?: string; homepageUrl?: string; descriptor?: string; enabled?: boolean }
): Promise<void> {
  const user = await requireAuth();
  const s = await prisma.newsSource.findUnique({ where: { id } });
  if (!s || !(await czyMojRekord(s, user.id))) throw new Error("Źródło nie istnieje");
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.rssUrl !== undefined) data.rssUrl = patch.rssUrl.trim();
  if (patch.homepageUrl !== undefined) data.homepageUrl = patch.homepageUrl.trim();
  // Pusty opis jest dozwolony (AC-5) — dlatego sprawdzamy `undefined`, a nie prawdziwość.
  if (patch.descriptor !== undefined)
    data.descriptor = patch.descriptor.trim().slice(0, MAX_DESCRIPTOR_LEN);
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  await prisma.newsSource.update({ where: { id }, data });
  revalidatePath("/wiadomosci");
}

export async function deleteSource(id: string): Promise<void> {
  const user = await requireAuth();
  const s = await prisma.newsSource.findUnique({ where: { id } });
  if (!s || !(await czyMojRekord(s, user.id))) throw new Error("Źródło nie istnieje");
  await prisma.newsSource.delete({ where: { id } });
  revalidatePath("/wiadomosci");
}

export async function setDefaultSummaryLength(length: SummaryLength): Promise<void> {
  const user = await requireAuth();
  await prisma.newsPref.upsert({
    where: { ...(await filtrMoichRekordow(user.id)) },
    create: { ...(await wlasnoscOsobistaDoZapisu(user.id)), defaultSummaryLength: length },
    update: { defaultSummaryLength: length },
  });
  revalidatePath("/wiadomosci");
}

/**
 * 085 (AC-15): pokazywanie tematów bez nowych wiadomości.
 *
 * Osobna akcja, a nie parametr `setDefaultSummaryLength`: te dwie preferencje zmieniają się
 * niezależnie i w interfejsie stoją jako dwie osobne kontrolki. Jedna akcja na obie kusiłaby do
 * przekazywania „niezmienionej" wartości drugiej — czyli do nadpisywania jej tym, co akurat było
 * w pamięci klienta.
 */
export async function setShowEmptyTopics(show: boolean): Promise<void> {
  const user = await requireAuth();
  await prisma.newsPref.upsert({
    where: { ...(await filtrMoichRekordow(user.id)) },
    create: { ...(await wlasnoscOsobistaDoZapisu(user.id)), showEmptyTopics: show },
    update: { showEmptyTopics: show },
  });
  revalidatePath("/wiadomosci");
}

// ─── LLM helpers ───────────────────────────────────────────────────────────

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
  // Worker kolejki startuje LENIWIE i tylko z tras `/api/jobs` (patrz `instrumentation.ts` — nie da
  // się go wystartować globalnie, bo instrumentacja bundluje się też dla runtime edge). Ta ścieżka
  // omija te trasy w całości, więc bez tego wywołania zadanie zostałoby w QUEUED, a pasek stanu
  // pokazywałby „Odświeżam…" w nieskończoność. Wywołanie jest idempotentne.
  ensureJobWorker();
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
  // Powrót na stronę też musi ruszyć workera: jeśli proces zdążył się w międzyczasie zrestartować
  // (na wolnym tierze usypia po 15 min), zaległe zadanie czekałoby, aż ktoś trafi w `/api/jobs`.
  ensureJobWorker();
  const job = await prisma.job.findFirst({
    // 098: `Job` należy do PIĘCIU tabel, które zostały przy `ownerId` (`workspace-nullable.json`) —
    // zadanie w tle bywa systemowe, więc przestrzeni nie ma. `filtrMoichRekordow` zwraca
    // `{ workspaceId }`, czyli kolumnę, której ta tabela nie ma; Prisma odrzucała każde wywołanie
    // („Unknown argument workspaceId"), a stan odświeżania Wiadomości nie wczytywał się nigdy.
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
  /** 111: czy tekst przyszedł z pamięci (nie kosztował). UI nie pokazuje wtedy wskaźnika kosztu. */
  fromMemory: boolean;
  /** 111: czy powstał z pełnej treści artykułu, czy tylko ze skrótu z kanału. */
  fromArticle: boolean;
  usage?: AiUsageInfo;
}

/**
 * 111: STRESZCZENIE NA WYBRANYM POZIOMIE — zapamiętane, a nie generowane od nowa przy każdym kliknięciu.
 *
 * Zgłoszenie właściciela: „jak streszczę na poziom krótki, a następnie znowu na średni, to jest
 * streszczenie około dwa razy dłuższe, mimo że poziom ten sam". Przyczyny były trzy i wszystkie
 * siedziały w tej funkcji:
 *
 * 1. **Nie sprawdzała, czy poziom już istnieje.** Każde przełączenie było nową, płatną generacją,
 *    a wynik modelu przy tej samej instrukcji nie jest identyczny. Teraz poziom raz wygenerowany
 *    zostaje — powrót do niego jest natychmiastowy i darmowy (AC-18).
 * 2. **Streszczała poprzednie streszczenie.** `const body = article.text || item.summary` znaczyło:
 *    gdy pobranie artykułu się nie uda, streść to, co akurat stoi w `summary` — czyli tekst już raz
 *    skrócony. Streszczenie streszczenia gubi fakty i za każdym przejściem gubi ich więcej. Materiał
 *    jest teraz zawsze ŹRÓDŁOWY: pełny artykuł, a gdy go nie ma — surowy skrót z kanału z puli
 *    artykułów, nigdy `item.summary` (AC-19).
 * 3. **Limit długości był miękki.** Instrukcja mówiła „maks. ~60 słów" przy kilkakrotnie większym
 *    materiale niż widzi przebieg wsadowy. Pułap jest teraz twardy i sprawdzany, a wynik grubo poza
 *    nim dostaje JEDNĄ korektę (AC-23).
 *
 * `force` to ręczne „wygeneruj ponownie" (AC-20): jedyna droga do nadpisania zapamiętanego tekstu.
 * Świadomie nie ma drugiej akcji o tym samym ciele — dwa wejścia do jednej reguły to dwa miejsca,
 * w których trzeba pamiętać o tej samej poprawce.
 */
export async function resummarizeItem(
  itemId: string,
  length: SummaryLength,
  opts: { force?: boolean } = {}
): Promise<ResummarizeResult> {
  const user = await requireAuth();
  const item = await prisma.newsItem.findUnique({
    where: { id: itemId },
    include: { topic: true, source: true, article: true },
  });
  if (!item || !(await czyMojRekord(item?.topic, user.id))) throw new Error("Pozycja nie istnieje");

  const poziom = poziomStreszczenia(length);

  // 1. Pamięć. Bez `force` zapamiętany poziom wraca DOKŁADNIE taki, jaki użytkownik już czytał —
  //    bez wywołania modelu, więc i bez kosztu.
  if (!opts.force) {
    const zapamietane = await prisma.newsItemSummary.findUnique({
      where: { itemId_length: { itemId, length: poziom } },
    });
    if (zapamietane) {
      // Wskaźnik „który poziom jest teraz pokazywany" musi nadążyć za wyborem, inaczej po
      // odświeżeniu strony karta wróciłaby do poprzedniego poziomu.
      await prisma.newsItem.update({
        where: { id: itemId },
        data: { summary: zapamietane.text, summaryLength: poziom, summaryFailed: false },
      });
      revalidatePath("/wiadomosci");
      return { summary: zapamietane.text, fromMemory: true, fromArticle: zapamietane.fromArticle };
    }
  }

  // 2. Materiał ZAWSZE źródłowy. Kolejność: pełny artykuł → surowy skrót z kanału. Nigdy
  //    `item.summary`, bo to jest wynik poprzedniego streszczania (patrz punkt 2 w nagłówku).
  const article = await fetchArticle(item.url);
  const zArtykulu = (article.text ?? "").trim();
  const material = zArtykulu || (item.article?.description ?? "").trim();
  if (!material) {
    /**
     * Brak materiału to nie jest awaria modelu i nie wolno go zapisać jako streszczenia.
     *
     * 111 (recenzja): znacznika „bez streszczenia" NIE stawiamy, gdy pozycja ma już jakikolwiek
     * zapamiętany poziom. `NewsArticle` kasuje retencja (relacja `SetNull`), a `fetchArticle`
     * zwraca pustkę przy paywallu — więc próba dołożenia CZWARTEGO poziomu do pozycji, która ma
     * poprawne trzy, przekreślałaby je wszystkie. Karta pisałaby wtedy „bez streszczenia" nad
     * tekstem, który streszczeniem JEST, a stan bazy przeczyłby sam sobie.
     */
    const maJakiekolwiek =
      (await prisma.newsItemSummary.count({ where: { itemId } })) > 0 || item.summary.trim().length > 0;
    if (!maJakiekolwiek) {
      await prisma.newsItem.update({ where: { id: itemId }, data: { summaryFailed: true } });
      revalidatePath("/wiadomosci");
    }
    throw new Error("Nie udało się pobrać treści artykułu — spróbuj ponownie za chwilę.");
  }

  const system =
    "Streszczasz artykuł prasowy po polsku. Zwróć WYŁĄCZNIE JSON {\"summary\":\"...\"}.";
  const sink: LlmSink = [];
  const userPrompt =
    `Tytuł: ${item.title}\nTreść: ${material.slice(0, LIMIT_MATERIALU)}\n\n${instrukcjaDlugosci(poziom)}`;
  const out = await llmJson<{ summary: string }>("generation", system, userPrompt, 2000, sink, "streszczenie");
  let summary = out.summary?.trim();
  if (!summary) throw new Error("Pusta odpowiedź LLM");

  // 3. JEDNA korekta, gdy wynik grubo przekracza pułap poziomu. Nie tniemy tekstu sami — ucięcie
  //    streszczenia w połowie zdania jest gorsze niż streszczenie o kilkanaście słów za długie.
  if (czyZaDlugie(summary, poziom)) {
    const poprawka = await llmJson<{ summary: string }>(
      "generation",
      system,
      `${userPrompt}\n\nDotychczasowa odpowiedź: ${summary}\n\n${instrukcjaKorekty(poziom)}`,
      2000,
      sink,
      "streszczenie (korekta długości)"
    );
    const krotsze = poprawka.summary?.trim();
    // Gdy korekta zawiodła, zostaje pierwszy wynik: za długie streszczenie jest lepsze niż żadne.
    if (krotsze) summary = krotsze;
  }

  const fromArticle = zArtykulu.length > 0;
  await prisma.$transaction([
    prisma.newsItemSummary.upsert({
      where: { itemId_length: { itemId, length: poziom } },
      create: { itemId, length: poziom, text: summary, fromArticle },
      update: { text: summary, fromArticle },
    }),
    prisma.newsItem.update({
      where: { id: itemId },
      data: { summary, summaryLength: poziom, summaryFailed: false },
    }),
  ]);
  revalidatePath("/wiadomosci");
  return { summary, fromMemory: false, fromArticle, usage: await visibleUsage(usageFromChat(sink)) };
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
    include: { topic: { select: { workspaceId: true } } },
  });
  if (!item || !(await czyMojRekord(item?.topic, user.id))) throw new Error("Pozycja nie istnieje");
  await prisma.newsItem.update({ where: { id: itemId }, data: { status: "ACKNOWLEDGED" } });
  revalidatePath("/wiadomosci");
}

/**
 * 115 (Z-INT-11): „Zapisz jako notatkę" — opłacone streszczenie artykułu można utrwalić.
 * Guard własności pozycji (jak `acknowledgeItem`) + uprawnienie modułu Notatki; notatka
 * powstaje przez kontrakt Notatek, więc ląduje w przestrzeni WOŁAJĄCEGO z jego guardami.
 */
export async function saveItemAsNote(itemId: string): Promise<{ id: string }> {
  const user = await requireAuth();
  const session = await auth();
  if (!hasPermission(session, notesModule.permission)) throw new Error("Brak dostępu do modułu Notatki");

  const item = await prisma.newsItem.findUnique({
    where: { id: itemId },
    include: { topic: { select: { workspaceId: true } }, source: { select: { name: true } } },
  });
  if (!item || !(await czyMojRekord(item.topic, user.id))) throw new Error("Pozycja nie istnieje");

  const streszczenie = item.summaryFailed ? "" : (item.summary ?? "").trim();
  const zrodlo = [`Źródło: ${item.source?.name ?? "—"}`, item.url].join("\n");
  const note = await createNote({
    title: item.title,
    content: [streszczenie || null, zrodlo].filter(Boolean).join("\n\n"),
    isMarkdown: true,
  });

  revalidatePath("/notes");
  return { id: note.id };
}

/**
 * 044: „nadrobiłem cały temat" jednym gestem.
 *
 * Guard jest ten sam co przy pozycji pojedynczej, tylko postawiony raz: `assertTopic` rzuca, gdy
 * temat nie należy do użytkownika, więc `updateMany` niżej nie może wyjść poza jego dane. Akcja
 * zbiorcza NIE MOŻE być szerszym wektorem niż pojedyncza (C-21).
 */
export async function acknowledgeTopicItems(topicId: string): Promise<{ count: number }> {
  const user = await requireAuth();
  await assertTopic(topicId, user.id);
  const r = await prisma.newsItem.updateMany({
    where: { topicId, status: "PENDING" },
    data: { status: "ACKNOWLEDGED" },
  });
  revalidatePath("/wiadomosci");
  return { count: r.count };
}

/**
 * 044: „nadrobiłem całą porcję" — wszystkie tematy naraz.
 *
 * Właściciela filtrujemy W ZAPYTANIU (`topic.ownerId`), a nie po fakcie w kodzie: przy `updateMany`
 * nie ma etapu, na którym dałoby się odsiać cudze wiersze po odczycie, więc warunek musi być
 * częścią zapytania. Potwierdzenie tej masowej akcji należy do UI — z serwera nie da się cofnąć.
 */
export async function acknowledgeAllItems(): Promise<{ count: number }> {
  const user = await requireAuth();
  const r = await prisma.newsItem.updateMany({
    where: { status: "PENDING", topic: await filtrMoichRekordow(user.id) },
    data: { status: "ACKNOWLEDGED" },
  });
  revalidatePath("/wiadomosci");
  return { count: r.count };
}

// ─── Hot topics ────────────────────────────────────────────────────────────

/**
 * 086: kształt wyniku jest JEDEN — ten z rdzenia (`WynikGoracychTematow`). Akcja różni się od
 * rdzenia wyłącznie tym, komu pokazuje koszt, a nie zestawem pól; osobna, ręcznie powtórzona
 * deklaracja rozjechałaby się przy pierwszym nowym polu, bo `return { ...wynik, usage }` przepuszcza
 * nadmiarowe właściwości bez błędu kompilacji.
 */
export type HotTopicsResult = WynikGoracychTematow;

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
  // 086: cała logika mieszka w rdzeniu, który przyjmuje właściciela parametrem — bo woła go też
  // zadanie odświeżania, a ono nie ma sesji. Akcja robi trzy rzeczy: sprawdza sesję, woła rdzeń
  // i decyduje, komu wolno zobaczyć koszt.
  const wynik = await przeliczGoraceTematy(user.id, { force });
  return { ...wynik, usage: await visibleUsage(wynik.usage) };
}

/** „Nie proponuj tego tematu" — odrzucenie po odcisku tytułu (gorący temat nie ma własnego id). */
export async function hideHotTopic(title: string): Promise<void> {
  const user = await requireAuth();
  const clean = title.trim();
  if (!clean) throw new Error("Pusty tytuł tematu");
  const fingerprint = fingerprintOf(clean);
  await prisma.newsHiddenTopic.upsert({
    where: { workspaceId_fingerprint: { ...(await filtrMoichRekordow(user.id)), fingerprint } },
    create: { ...(await wlasnoscOsobistaDoZapisu(user.id)), fingerprint, title: clean },
    update: { title: clean },
  });
  revalidatePath("/wiadomosci");
}

/** Cofnięcie odrzucenia — temat wraca na listę propozycji. */
export async function unhideHotTopic(id: string): Promise<void> {
  const user = await requireAuth();
  const row = await prisma.newsHiddenTopic.findUnique({ where: { id } });
  if (!row || !(await czyMojRekord(row, user.id))) throw new Error("Nie znaleziono odrzuconego tematu");
  await prisma.newsHiddenTopic.delete({ where: { id } });
  revalidatePath("/wiadomosci");
}

export async function getHiddenTopics(): Promise<HiddenTopicDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.newsHiddenTopic.findMany({
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)) },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.createdAt.toISOString() }));
}
