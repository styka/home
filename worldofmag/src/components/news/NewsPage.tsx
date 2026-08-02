"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { sourceColor } from "@/lib/news/sourceColor";
import { AiCostBadge } from "@/components/ui/AiCostBadge";
import { NewsItemCard } from "./NewsItemCard";
import { NewsTimeline } from "./NewsTimeline";
import { HotTopics } from "./HotTopics";
import { NewsSettings } from "./NewsSettings";
import { TopicPicker } from "./TopicPicker";
import {
  getTopicView,
  startNewsRefresh,
  getNewsRefreshState,
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
} from "@/actions/news";

type View = "feed" | "hot" | "settings";
/** 040: co pokazujemy w wybranym temacie. Domyślnie nowe wiadomości — po nie użytkownik tu wchodzi. */
type ContentTabKey = "items" | "timeline";

export function NewsPage({
  topics,
  sources,
  defaultLength,
  activeSourceKey,
}: {
  topics: TopicDTO[];
  sources: SourceDTO[];
  defaultLength: SummaryLength;
  activeSourceKey: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [view, setView] = useState<View>("feed");
  // Wybór treści jest CELOWO trzymany poza tematem: przełączenie na linię czasu przeżywa zmianę
  // tematu, bo użytkownik, który nadrabia kontekst, robi to zwykle w kilku tematach pod rząd.
  const [contentTab, setContentTab] = useState<ContentTabKey>("items");
  const [selectedId, setSelectedId] = useState<string | null>(topics[0]?.id ?? null);
  const [sourceFilter, setSourceFilter] = useState<string>(activeSourceKey ?? "all");
  const [data, setData] = useState<{ items: NewsItemDTO[]; timeline: TimelineEntryDTO[] } | null>(null);
  const [loadingView, setLoadingView] = useState(false);
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

  useEffect(() => {
    if (selectedId && view === "feed") loadView(selectedId);
  }, [selectedId, view, loadView]);

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
    router.refresh();
  }, [refreshRunning, refresh, selectedId, loadView, router, showToast]);

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
    if (selectedId) loadView(selectedId);
    router.refresh();
  }, [selectedId, loadView, router]);

  const filteredItems = (data?.items ?? []).filter(
    (i) => sourceFilter === "all" || i.sourceKey === sourceFilter
  );
  const filteredTimeline = (data?.timeline ?? []).filter(
    (t) => sourceFilter === "all" || t.sourceKey === null || t.sourceKey === sourceFilter
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Nagłówek */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
          <Newspaper size={22} className="text-[var(--accent-blue)]" /> Wiadomości
        </h1>
        {/* 039: „Odśwież" stoi w nagłówku MODUŁU, a nie przy temacie — bo jeden przebieg pobiera
            wspólne kanały i obsługuje wszystkie tematy naraz. Przycisk przy temacie sugerowałby,
            że da się odświeżyć jeden temat osobno, a tak już nie jest. */}
        <Button size="sm" onClick={startRefresh} disabled={starting || refreshRunning}>
          <RefreshCw size={15} className={starting || refreshRunning ? "animate-spin" : ""} />
          {refreshRunning ? "Odświeżam…" : "Odśwież"}
        </Button>
      </div>

      {/* 040: pasek widoków modułu — obecny w KAŻDYM trybie, także na telefonie.
          Wcześniej „Gorące tematy" i „Źródła" były przełącznikami w nagłówku: po wejściu w któryś z
          nich nic nie wskazywało drogi powrotnej, bo przycisk zmieniał tylko swój wariant. Pasek z
          trzema równorzędnymi zakładkami mówi jednocześnie, gdzie jestem i jak wrócić. */}
      <ViewTabs view={view} onChange={setView} />

      <RefreshStatus state={refresh} running={refreshRunning} />

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
        <div className="min-w-0">
          <TopicBar
            topics={topics}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChanged={() => router.refresh()}
          />

          {!selectedTopic ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-[var(--text-muted)]">
              Dodaj pierwszy temat do monitorowania albo zajrzyj w „Gorące tematy”.
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

              {/* 039: „Wszystkie" bez opisu wyglądało na zbędne. Licznik i podpis mówią wprost,
                  że to widok zbiorczy, a pozostałe zakładki zawężają do jednego portalu. */}
              <div className="mb-1 flex flex-wrap gap-1.5">
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

              {loadingView ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-[var(--text-muted)]" />
                </div>
              ) : contentTab === "timeline" ? (
                <NewsTimeline entries={filteredTimeline} />
              ) : filteredItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
                  Brak nowych, istotnych wiadomości. Kliknij „Odśwież” w nagłówku, żeby pobrać
                  najświeższe materiały (tylko z ostatnich 24 godzin).
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
    </div>
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
  return (
    <div
      className="mb-4 flex gap-1 border-b border-[var(--border)]"
      role="tablist"
      aria-label="Widoki modułu Wiadomości"
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
        <span className="text-[var(--text-primary)]">Ostatnie odświeżanie nie powiodło się.</span>
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
          model nieskonfigurowany — materiał pobrany, analiza pominięta
        </span>
      )}
      <AiCostBadge usage={r.usage} align="left" />
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
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<TopicDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = topics.find((t) => t.id === selectedId) ?? null;

  function remove(t: TopicDTO) {
    if (!confirm(`Usunąć temat „${t.title}" wraz z linią czasu?`)) return;
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
    <div className="mb-3">
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
                title="Usuń temat"
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
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">Tytuł tematu</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="np. Sprawa Zbigniewa Ziobry"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">
          Filtr semantyczny (opisz dokładnie, co Cię interesuje)
        </label>
        <textarea
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          rows={3}
          placeholder="np. perypetie Zbigniewa Ziobry w sprawie zarzutów prokuratorskich i postępowań sądowych"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>
    </Modal>
  );
}
