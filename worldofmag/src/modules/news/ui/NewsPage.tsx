"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition, useMemo, type CSSProperties } from "react";
import { useViewState } from "@/hooks/useViewState";
import { oneOf, type RawParams } from "@/platform/viewState/viewState";
import { useRouter } from "next/navigation";
import {
  Newspaper,
  RefreshCw,
  Flame,
  Settings2,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { sourceColor } from "@/lib/news/sourceColor";
import { AiCostBadge } from "@/components/ui/AiCostBadge";
import { ModuleView } from "@/components/ui/view";
import { NewsItemCard } from "./NewsItemCard";
import { NewsTimeline } from "./NewsTimeline";
import { NewsStream } from "./NewsStream";
import { HotTopics } from "./HotTopics";
import { NewsSettings } from "./NewsSettings";
import { TopicPicker } from "./TopicPicker";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  getTopicView,
  getStreamView,
  type StreamTopicDTO,
  startNewsRefresh,
  getNewsRefreshState,
  getNewsRefreshHistory,
  createTopic,
  updateTopic,
  deleteTopic,
  setActiveSource,
  type TopicDTO,
  type SourceDTO,
  type SummaryLength,
  type NewsItemDTO,
  type TimelineEntryDTO,
  type NewsRefreshState,
  type NewsRefreshRunDTO,
} from "../actions/news";

type View = "feed" | "hot" | "settings";
/** 040: co pokazujemy w wybranym temacie. Domyślnie nowe wiadomości — po nie użytkownik tu wchodzi. */
type ContentTabKey = "items" | "timeline";
/**
 * 044: jak przeglądamy nowe wiadomości. Union TS, nie enum (C-12).
 * `stream` — wszystkie tematy jednym przewijaniem (domyślne, po to powstało zgłoszenie).
 * `topic`  — jeden temat naraz; zostaje, bo skupienie na jednym temacie to osobna potrzeba.
 */
type BrowseMode = "stream" | "topic";

export function NewsPage({
  topics,
  sources,
  defaultLength,
  activeSourceKey,
  viewParams = {},
}: {
  topics: TopicDTO[];
  sources: SourceDTO[];
  defaultLength: SummaryLength;
  activeSourceKey: string | null;
  /** 043: parametry adresu z serwera — zakładkę widoku czytamy stąd, nie z `window`. */
  viewParams?: RawParams;
}) {
  const t = useTranslations("modules.news.NewsPage");
  const confirmDialog = useConfirm();
  const router = useRouter();
  const { showToast } = useToast();
  // 043: zakładka widoku w adresie (AC-8a). Klucz `widok`, bo `view` bywa w Omnii zajęte przez
  // inne znaczenia — tu chodzi wprost o zakładkę Wiadomości.
  const viewSpec = useMemo(
    () => ({
      widok: oneOf(["feed", "hot", "settings"] as const, "feed"),
      // 044: tryb przeglądania też w adresie — dzięki temu przeżywa odświeżenie i „wstecz",
      // tak samo jak zakładka widoku (AC-B20). Zero kolumn w bazie.
      tryb: oneOf(["stream", "topic"] as const, "stream"),
    }),
    []
  );
  const [viewState, setViewState] = useViewState(viewSpec, viewParams);
  const view = viewState.widok;
  const setView = useCallback((value: View) => setViewState({ widok: value }), [setViewState]);
  const browseMode = viewState.tryb;
  const setBrowseMode = useCallback(
    (value: BrowseMode) => setViewState({ tryb: value }),
    [setViewState]
  );
  // Wybór treści jest CELOWO trzymany poza tematem: przełączenie na linię czasu przeżywa zmianę
  // tematu, bo użytkownik, który nadrabia kontekst, robi to zwykle w kilku tematach pod rząd.
  const [contentTab, setContentTab] = useState<ContentTabKey>("items");
  const [selectedId, setSelectedId] = useState<string | null>(topics[0]?.id ?? null);
  const [sourceFilter, setSourceFilter] = useState<string>(activeSourceKey ?? "all");
  const [data, setData] = useState<{ items: NewsItemDTO[]; timeline: TimelineEntryDTO[] } | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  // 044: dane strumienia trzymamy osobno od danych pojedynczego tematu — to dwa różne odczyty
  // i przełączenie trybu nie może kasować tego, co już wczytane.
  const [stream, setStream] = useState<StreamTopicDTO[] | null>(null);
  /**
   * 082 (poprawka): wysokość PRZYKLEJONEGO paska tematów, mierzona, a nie wpisana na sztywno.
   *
   * Potrzebują jej trzy rzeczy naraz: przyklejony nagłówek sekcji (musi stanąć POD paskiem, nie
   * na nim), margines celu przewijania (inaczej skok do tematu chowa jego nagłówek za paskiem)
   * i obserwator wyznaczający temat aktywny (musi wiedzieć, ile ekranu jest zasłonięte).
   *
   * Mierzymy, bo skórki Omnii zmieniają typografię i gęstość — wpisana liczba pikseli byłaby
   * poprawna dla jednej skórki i fałszywa dla ośmiu pozostałych.
   */
  const pasekRef = useRef<HTMLDivElement>(null);
  const [pasekH, setPasekH] = useState(0);
  const [loadingStream, setLoadingStream] = useState(false);
  // Funkcja „przewiń do tematu" udostępniana przez strumień — po niej selektor tematu przewija
  // stronę zamiast przeładowywać widok (AC-B4).
  const scrollToTopicRef = useRef<((topicId: string) => void) | null>(null);
  const [refresh, setRefresh] = useState<NewsRefreshState | null>(null);
  const [starting, startRefreshing] = useTransition();

  const enabledSources = sources.filter((s) => s.enabled);
  const selectedTopic = topics.find((t) => t.id === selectedId) ?? null;
  const refreshRunning = refresh?.status === "QUEUED" || refresh?.status === "RUNNING";

  const loadView = useCallback((topicId: string) => {
    setLoadingView(true);
    getTopicView(topicId)
      .then(setData)
      .catch(() => setData({ items: [], timeline: [] }))
      .finally(() => setLoadingView(false));
  }, []);

  const loadStream = useCallback(() => {
    setLoadingStream(true);
    getStreamView()
      .then(setStream)
      .catch(() => setStream([]))
      .finally(() => setLoadingStream(false));
  }, []);

  // Widok jednego tematu czytamy tylko wtedy, gdy jest na ekranie — w trybie strumienia byłby to
  // odczyt dokładnie tych samych pozycji drugi raz.
  useEffect(() => {
    if (selectedId && view === "feed" && browseMode === "topic") loadView(selectedId);
  }, [selectedId, view, browseMode, loadView]);

  useEffect(() => {
    if (view === "feed" && browseMode === "stream") loadStream();
  }, [view, browseMode, loadStream]);

  // Po zmianach serwerowych (np. odświeżenie listy tematów) zsynchronizuj wybór.
  useEffect(() => {
    if (selectedId && !topics.some((t) => t.id === selectedId)) {
      setSelectedId(topics[0]?.id ?? null);
    } else if (!selectedId && topics[0]) {
      setSelectedId(topics[0].id);
    }
  }, [topics, selectedId]);

  function pickSource(key: string) {
    setSourceFilter(key);
    setActiveSource(key === "all" ? null : key).catch(() => {});
  }

  // 039: stan przebiegu czytamy z KOLEJKI, nie z pamięci komponentu — dzięki temu powrót na stronę
  // (albo jej odświeżenie) pokazuje trwający przebieg zamiast udawać, że nic się nie dzieje.
  const loadRefreshState = useCallback(() => {
    getNewsRefreshState()
      .then(setRefresh)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRefreshState();
  }, [loadRefreshState]);

  // Odpytujemy tylko wtedy, gdy przebieg faktycznie trwa — skończony nie ma czego zgłaszać.
  useEffect(() => {
    if (!refreshRunning) return;
    const t = setInterval(loadRefreshState, 2000);
    return () => clearInterval(t);
  }, [refreshRunning, loadRefreshState]);

  // Domknięcie przebiegu = czas odświeżyć widok i listę tematów.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (refreshRunning) {
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current) return;
    wasRunning.current = false;

    const r = refresh?.result;
    if (refresh?.status === "FAILED") {
      showToast(refresh.error || "Odświeżanie nie powiodło się", "error");
    } else if (r?.llmUnconfigured) {
      showToast("Model nie jest skonfigurowany — ustaw go w Admin → LLM.", "error");
    } else if (r) {
      showToast(
        r.assigned > 0
          ? `Nowych wiadomości: ${r.assigned}`
          : "Brak nowych, istotnych wiadomości",
        r.assigned > 0 ? "success" : "info"
      );
    }
    if (selectedId) loadView(selectedId);
    // 044: świeża porcja musi trafić także do strumienia — po to właściciel klika „Odśwież".
    loadStream();
    router.refresh();
  }, [refreshRunning, refresh, selectedId, loadView, loadStream, router, showToast]);

  function startRefresh() {
    startRefreshing(async () => {
      try {
        await startNewsRefresh();
        loadRefreshState();
      } catch (e: any) {
        showToast(e.message ?? "Nie udało się uruchomić odświeżania", "error");
      }
    });
  }

  const onItemChanged = useCallback(() => {
    if (browseMode === "stream") loadStream();
    else if (selectedId) loadView(selectedId);
    router.refresh();
  }, [browseMode, selectedId, loadView, loadStream, router]);

  /**
   * 044: wybór tematu w trybie strumienia PRZEWIJA, a nie przeładowuje (AC-B4). Gdy strumień nie
   * zdążył jeszcze zarejestrować swojej funkcji przewijania, zostaje samo ustawienie wyboru —
   * gorsze byłoby zignorowanie dotknięcia.
   */
  const selectTopic = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (browseMode === "stream") scrollToTopicRef.current?.(id);
    },
    [browseMode]
  );

  const registerScrollToTopic = useCallback((fn: (topicId: string) => void) => {
    scrollToTopicRef.current = fn;
  }, []);

  useEffect(() => {
    const el = pasekRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const zmierz = () => setPasekH(el.offsetHeight);
    zmierz();
    const ro = new ResizeObserver(zmierz);
    ro.observe(el);
    return () => ro.disconnect();
    // Pasek istnieje tylko w widoku strumienia/tematu — przy zmianie widoku mierzymy od nowa.
  }, [view, browseMode, topics.length]);

  const filteredItems = (data?.items ?? []).filter(
    (i) => sourceFilter === "all" || i.sourceKey === sourceFilter
  );
  const filteredTimeline = (data?.timeline ?? []).filter(
    (t) => sourceFilter === "all" || t.sourceKey === null || t.sourceKey === sourceFilter
  );

  return (
    <ModuleView
      icon={<Newspaper size={22} />}
      iconColor="var(--accent-blue)"
      title={t("wiadomosci")}
      href="/wiadomosci"
      state="ready"
      headerAction={
        /* 039: „Odśwież" stoi w nagłówku MODUŁU, a nie przy temacie — bo jeden przebieg pobiera
           wspólne kanały i obsługuje wszystkie tematy naraz. Przycisk przy temacie sugerowałby,
           że da się odświeżyć jeden temat osobno, a tak już nie jest. */
        <Button size="sm" onClick={startRefresh} disabled={starting || refreshRunning}>
          <RefreshCw size={15} className={starting || refreshRunning ? "animate-spin" : ""} />
          {refreshRunning ? "Odświeżam…" : "Odśwież"}
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-6xl">
      {/* 040: pasek widoków modułu — obecny w KAŻDYM trybie, także na telefonie.
          Wcześniej „Gorące tematy" i „Źródła" były przełącznikami w nagłówku: po wejściu w któryś z
          nich nic nie wskazywało drogi powrotnej, bo przycisk zmieniał tylko swój wariant. Pasek z
          trzema równorzędnymi zakładkami mówi jednocześnie, gdzie jestem i jak wrócić. */}
      <ViewTabs view={view} onChange={setView} />

      <RefreshStatus state={refresh} running={refreshRunning} />

      <RefreshHistory />

      {/* 040: dodanie tematu odświeża listę, ale NIE przerzuca na widok główny — przegląd gorących
          tematów ma dać się zrobić za jednym posiedzeniem. */}
      {view === "hot" && <HotTopics onTopicsChanged={() => router.refresh()} />}

      {view === "settings" && (
        <NewsSettings
          sources={sources}
          defaultLength={defaultLength}
          onChanged={() => router.refresh()}
        />
      )}

      {/* 040/041: pionowy stos zamiast dwóch kolumn. Kolumna tematów zjadała jedną trzecią
          szerokości i i tak ucinała dłuższe nazwy — teraz wybór tematu to jeden wiersz nad treścią,
          a treść dostaje całą stronę. Ten sam układ działa na telefonie, więc nie ma dwóch osobnych
          nawigacji. */}
      {view === "feed" && (
        <div
          className="min-w-0"
          // Wysokość paska jako zmienna CSS: czytają ją `NewsStream` (przyklejony nagłówek sekcji
          // i margines celu przewijania), więc nie musi go obchodzić, skąd się bierze.
          style={{ "--news-pasek-h": `${pasekH}px` } as CSSProperties}
        >
          {/* 044: wybór sposobu przeglądania. Strumień jest domyślny — po niego przyszło
              zgłoszenie — ale skupienie na jednym temacie zostaje jako osobna potrzeba. */}
          <div className="mb-3 flex gap-1">
            <ContentTab
              label={t("strumien")}
              active={browseMode === "stream"}
              onClick={() => setBrowseMode("stream")}
            />
            <ContentTab
              label="Jeden temat"
              active={browseMode === "topic"}
              onClick={() => setBrowseMode("topic")}
            />
          </div>

          {/* 082 (poprawka): pasek tematów jest PRZYKLEJONY — to była druga połowa zgłoszenia
              („nie przykleja się na górze przy scrolowaniu"), i bez niej pierwsza połowa nie ma
              sensu: pasek, który odjeżdża razem z treścią, nie jest nawigacją, tylko nagłówkiem.
              `z-30` stawia go nad przyklejonymi nagłówkami sekcji (`z-20`), które od teraz
              zatrzymują się POD nim. */}
          <div
            ref={pasekRef}
            className="sticky top-0 z-30 -mx-1 border-b border-[var(--border)] bg-[var(--bg-base)] px-1 pt-1 pb-2"
          >
            <TopicBar
              topics={topics}
              selectedId={selectedId}
              onSelect={selectTopic}
              onChanged={() => router.refresh()}
            />
          </div>

          {/* Filtr źródeł stoi NAD oboma trybami: jest ustawieniem użytkownika, a nie własnością
              tematu, więc w strumieniu działa na całość (Z-4). */}
          <div className="mb-1 mt-3 flex flex-wrap gap-1.5">
            <SourceTab
              label={`Wszystkie (${enabledSources.length})`}
              active={sourceFilter === "all"}
              onClick={() => pickSource("all")}
            />
            {enabledSources.map((s) => (
              <SourceTab
                key={s.id}
                label={s.name}
                color={sourceColor(s.descriptor)}
                active={sourceFilter === s.key}
                onClick={() => pickSource(s.key)}
              />
            ))}
          </div>
          <p className="mb-4 text-[11px] text-[var(--text-muted)]">
            {sourceFilter === "all"
              ? "Widok zbiorczy ze wszystkich źródeł. Wybierz portal, żeby zobaczyć, jak ujmuje temat."
              : "Widok jednego portalu. Wróć do „Wszystkie”, żeby porównać ujęcia."}
          </p>

          {browseMode === "stream" ? (
            <NewsStream
              topics={stream ?? []}
              loading={loadingStream && stream === null}
              sourceFilter={sourceFilter}
              activeTopicId={selectedId}
              onActiveTopicChange={setSelectedId}
              onChanged={onItemChanged}
              registerScrollToTopic={registerScrollToTopic}
              zaslonaGory={pasekH}
            />
          ) : !selectedTopic ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-[var(--text-muted)]">
              {t("dodajPierwszyTematDo")}
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-[var(--text-muted)]">{selectedTopic.semanticFilter}</p>

              {/* 040: najpierw NOWE WIADOMOŚCI — po to użytkownik tu wchodzi. Linia czasu jest do
                  nadrabiania kontekstu, więc stoi za przełącznikiem, a nie nad wiadomościami. */}
              <div className="mb-3 flex gap-1">
                <ContentTab
                  label={`Nowe wiadomości (${filteredItems.length})`}
                  active={contentTab === "items"}
                  onClick={() => setContentTab("items")}
                />
                <ContentTab
                  label={`Linia czasu (${filteredTimeline.length})`}
                  active={contentTab === "timeline"}
                  onClick={() => setContentTab("timeline")}
                />
              </div>

              {/* 044: filtr źródeł przeniesiony NAD przełącznik trybu — jest wspólny dla strumienia
                  i widoku pojedynczego tematu, więc dwie kopie rozjechałyby się przy pierwszej
                  zmianie. */}

              {loadingView ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-[var(--text-muted)]" />
                </div>
              ) : contentTab === "timeline" ? (
                <NewsTimeline entries={filteredTimeline} />
              ) : filteredItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
                  {t("brakNowychIstotnychWiadomosci")}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <NewsItemCard key={item.id} item={item} onChanged={onItemChanged} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      </div>
    </ModuleView>
  );
}

const VIEW_TABS: Array<{ key: View; label: string; icon: typeof Newspaper }> = [
  { key: "feed", label: "Tematy", icon: Newspaper },
  { key: "hot", label: "Gorące tematy", icon: Flame },
  { key: "settings", label: "Źródła", icon: Settings2 },
];

/**
 * 040: nawigacja po widokach modułu — jedna dla desktopu i telefonu (C-31).
 *
 * Zakładki są równorzędne i zawsze widoczne, więc powrót do wiadomości to jedno dotknięcie z
 * każdego miejsca. Aktywna zakładka jest wyróżniona, więc z samego ekranu widać, gdzie się jest —
 * czego brakowało, gdy widoki przełączały się przyciskami zmieniającymi tylko swój wariant.
 */
function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const t = useTranslations("modules.news.NewsPage");
  return (
    <div
      className="mb-4 flex gap-1 border-b border-[var(--border)]"
      role="tablist"
      aria-label={t("widokiModuluWiadomosci")}
    >
      {VIEW_TABS.map((t) => {
        const Icon = t.icon;
        const active = view === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              // `py-3` = cel dotyku na telefonie (C-31); `-mb-px` wsuwa podkreślenie w krawędź paska.
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm transition-colors",
              active
                ? "border-[var(--accent-blue)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <Icon size={15} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 039: pasek stanu przebiegu odświeżania.
 *
 * Pokazuje ETAP („Pobieram źródła (3/5)…") czytany z kolejki, a nie z pamięci komponentu — więc
 * wraca po odświeżeniu strony i po powrocie z innej zakładki. Niepowodzenie ma własny, czerwony
 * komunikat: „nic nie znaleziono" i „coś się zepsuło" to dla użytkownika dwie różne wiadomości, a
 * mylenie ich każe mu bez sensu ponawiać (lekcja z 038).
 */
function RefreshStatus({ state, running }: { state: NewsRefreshState | null; running: boolean }) {
  const t = useTranslations("modules.news.NewsPage");
  if (!state) return null;

  if (running) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
        <Loader2 size={15} className="animate-spin text-[var(--accent-blue)]" />
        <span>{state.progress || "Przygotowuję odświeżanie…"}</span>
      </div>
    );
  }

  if (state.status === "FAILED") {
    return (
      <div
        className="mb-4 rounded-lg border bg-[var(--bg-surface)] px-3 py-2 text-sm"
        style={{ borderColor: "var(--accent-red)" }}
      >
        <span className="text-[var(--text-primary)]">{t("ostatnieOdswiezanieNiePowiodlo")}</span>
        {state.error && <span className="ml-2 text-xs text-[var(--text-muted)]">{state.error}</span>}
      </div>
    );
  }

  const r = state.result;
  if (state.status !== "DONE" || !r) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
      <span>
        Ostatnie odświeżanie: {formatWhen(state.startedAt)} · źródeł: {r.sources} · nowych
        materiałów: {r.fetched} · pozycji: {r.assigned} · faktów na osi: {r.timelineAdded}
      </span>
      {r.llmUnconfigured && (
        <span className="text-[var(--accent-amber)]">
          {t("modelNieskonfigurowanyMaterialPobrany")}
        </span>
      )}
      <AiCostBadge usage={r.usage} align="left" />
    </div>
  );
}

/**
 * 041: historia przebiegów odświeżania — koszt DA SIĘ odczytać po fakcie.
 *
 * Do 040 licznik kosztu widniał wyłącznie przy ostatnim przebiegu i znikał razem z zadaniem
 * sprzątanym z kolejki po 24 godzinach. Zwinięta w spoczynku, bo to informacja, po którą się sięga,
 * a nie taka, którą się śledzi.
 */
function RefreshHistory() {
  const t = useTranslations("modules.news.NewsPage");
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<NewsRefreshRunDTO[] | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    // Czytamy dopiero przy rozwinięciu — lista przebiegów nie jest potrzebna do niczego innego.
    if (next && runs === null) {
      setLoading(true);
      getNewsRefreshHistory(10)
        .then(setRuns)
        .catch(() => setRuns([]))
        .finally(() => setLoading(false));
    }
  }

  return (
    <div className="mb-4">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1 py-1 text-[11px] text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
      >
        <History size={12} /> {t("historiaOdswiezen")}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2">
          {loading ? (
            <p className="px-1 py-2 text-[11px] text-[var(--text-muted)]">{t("wczytuje")}</p>
          ) : !runs || runs.length === 0 ? (
            <p className="px-1 py-2 text-[11px] text-[var(--text-muted)]">
              {t("brakZapisanychPrzebiegowPierwszy")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded px-1 py-2 text-[11px] text-[var(--text-muted)]"
                >
                  <span className="text-[var(--text-secondary)]">{formatWhen(r.startedAt)}</span>
                  {r.status === "failed" ? (
                    <span style={{ color: "var(--accent-red)" }}>
                      nie powiodło się{r.error ? ` — ${r.error}` : ""}
                    </span>
                  ) : (
                    <span>
                      źródeł: {r.sources} · materiałów: {r.fetched} · pozycji: {r.assigned} ·
                      streszczeń: {r.summarized} · faktów: {r.timelineAdded}
                    </span>
                  )}
                  <AiCostBadge usage={r.usage} align="left" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function SourceTab({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-transparent bg-[var(--bg-elevated)] text-[var(--text-primary)]"
          : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
      )}
      style={active && color ? { boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
    >
      {color && <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}

/**
 * 041: pasek tematu — rozwijany selektor (`TopicPicker`) plus akcje tematu aktywnego.
 *
 * Poprzednia wersja (040) trzymała tematy w poziomym pasku zakładek. Pasek pokazywał pełne nazwy,
 * ale mieścił tylko kilka pierwszych tematów, a o pozostałych z ekranu nic nie mówiło — trzeba było
 * odgadnąć, że da się go przewinąć. Selektor pokazuje w spoczynku wyłącznie temat aktywny, a po
 * rozwinięciu **wszystkie** tematy z pełnymi nazwami i wyszukiwarką.
 *
 * Zarządzanie tematami zostaje tutaj: „+" dodaje nowy, a edycja i usunięcie dotyczą tematu
 * aktywnego — bo tylko on jest w danej chwili na ekranie.
 */
function TopicBar({
  topics,
  selectedId,
  onSelect,
  onChanged,
}: {
  topics: TopicDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("modules.news.NewsPage");
  const confirmDialog = useConfirm();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<TopicDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = topics.find((t) => t.id === selectedId) ?? null;

  async function remove(t: TopicDTO) {
    if (!(await confirmDialog(`Usunąć temat „${t.title}" wraz z linią czasu?`))) return;
    startTransition(async () => {
      try {
        await deleteTopic(t.id);
        onChanged();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  return (
    // Bez własnego marginesu: odstęp należy do przyklejonego opakowania w widoku, inaczej
    // powiększałby przyklejony pasek o pustą przestrzeń.
    <div>
      <div className="flex items-center gap-2">
        <TopicPicker topics={topics} selectedId={selectedId} onSelect={onSelect} />

        <div className="flex shrink-0 items-center gap-1">
          {selected && (
            <>
              <button
                onClick={() => setEditing(selected)}
                className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                title="Edytuj temat"
                aria-label={`Edytuj temat: ${selected.title}`}
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => remove(selected)}
                className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)]"
                title={t("usunTemat")}
                aria-label={`Usuń temat: ${selected.title}`}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          <button
            onClick={() => setCreating(true)}
            className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Nowy temat"
            aria-label="Nowy temat"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {(creating || editing) && (
        <TopicModal
          topic={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(id) => {
            setCreating(false);
            setEditing(null);
            onChanged();
            if (id) onSelect(id);
          }}
        />
      )}
    </div>
  );
}

/** Przełącznik treści tematu: nowe wiadomości (domyślnie) albo linia czasu. */
function ContentTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      {label}
    </button>
  );
}


function TopicModal({
  topic,
  onClose,
  onSaved,
}: {
  topic: TopicDTO | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const t = useTranslations("modules.news.NewsPage");
  const { showToast } = useToast();
  const [title, setTitle] = useState(topic?.title ?? "");
  const [filter, setFilter] = useState(topic?.semanticFilter ?? "");
  const [, startTransition] = useTransition();

  function save() {
    if (!title.trim() || !filter.trim()) {
      showToast("Podaj tytuł i opis filtra", "error");
      return;
    }
    startTransition(async () => {
      try {
        if (topic) {
          await updateTopic(topic.id, { title, semanticFilter: filter });
          onSaved(topic.id);
        } else {
          const r = await createTopic({ title, semanticFilter: filter });
          onSaved(r.id);
        }
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  return (
    <Modal
      onClose={onClose}
      title={topic ? "Edytuj temat" : "Nowy temat do monitorowania"}
      wide
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Anuluj
          </Button>
          <Button size="sm" onClick={save}>
            {topic ? "Zapisz" : "Dodaj temat"}
          </Button>
        </>
      }
    >
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">{t("tytulTematu")}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="np. Sprawa Zbigniewa Ziobry"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">
          {t("filtrSemantycznyOpiszDokladnie")}
        </label>
        <textarea
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          rows={3}
          placeholder={t("npPerypetieZbigniewaZiobry")}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>
    </Modal>
  );
}
