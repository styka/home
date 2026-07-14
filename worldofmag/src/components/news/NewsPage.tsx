"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
import { LEANING_META } from "@/lib/news/sources";
import { NewsItemCard } from "./NewsItemCard";
import { KnowledgePanel } from "./KnowledgePanel";
import { HotTopics } from "./HotTopics";
import { NewsSettings } from "./NewsSettings";
import {
  getTopicView,
  refreshTopic,
  createTopic,
  updateTopic,
  deleteTopic,
  setActiveSource,
  type TopicDTO,
  type SourceDTO,
  type SummaryLength,
  type NewsItemDTO,
  type KnowledgeDTO,
} from "@/actions/news";

type View = "feed" | "hot" | "settings";

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
  const [selectedId, setSelectedId] = useState<string | null>(topics[0]?.id ?? null);
  const [sourceFilter, setSourceFilter] = useState<string>(activeSourceKey ?? "all");
  const [data, setData] = useState<{ items: NewsItemDTO[]; knowledge: KnowledgeDTO[] } | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const enabledSources = sources.filter((s) => s.enabled);
  const selectedTopic = topics.find((t) => t.id === selectedId) ?? null;

  const loadView = useCallback((topicId: string) => {
    setLoadingView(true);
    getTopicView(topicId)
      .then(setData)
      .catch(() => setData({ items: [], knowledge: [] }))
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

  function refresh() {
    if (!selectedId) return;
    startRefresh(async () => {
      try {
        const r = await refreshTopic(selectedId);
        if (r.llmUnconfigured && r.added === 0 && r.initialized === 0) {
          showToast("LLM nie jest skonfigurowany — ustaw model w Admin → LLM.", "error");
        } else if (r.added > 0) {
          showToast(`Dodano ${r.added} nowych wiadomości`, "success");
        } else if (r.initialized > 0) {
          showToast(
            `Zainicjowano bazę wiedzy (${r.initialized} ${r.initialized === 1 ? "źródło" : "źródła"})`,
            "success"
          );
        } else {
          showToast("Brak nowych istotnych wiadomości", "info");
        }
        loadView(selectedId);
        router.refresh();
      } catch (e: any) {
        showToast(e.message ?? "Nie udało się odświeżyć", "error");
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
  const filteredKnowledge = (data?.knowledge ?? []).filter(
    (k) => sourceFilter === "all" || k.sourceKey === sourceFilter
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Nagłówek */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
          <Newspaper size={22} className="text-[var(--accent-blue)]" /> Wiadomości
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "hot" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView(view === "hot" ? "feed" : "hot")}
          >
            <Flame size={15} /> Gorące tematy
          </Button>
          <Button
            variant={view === "settings" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView(view === "settings" ? "feed" : "settings")}
          >
            <Settings2 size={15} /> Źródła
          </Button>
        </div>
      </div>

      {view === "hot" && (
        <HotTopics
          onAdded={() => {
            setView("feed");
            router.refresh();
          }}
        />
      )}

      {view === "settings" && (
        <NewsSettings
          sources={sources}
          defaultLength={defaultLength}
          onChanged={() => router.refresh()}
        />
      )}

      {view === "feed" && (
        <div className="grid gap-5 md:grid-cols-[240px_1fr]">
          {/* Lista tematów */}
          <TopicList
            topics={topics}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefreshList={() => router.refresh()}
          />

          {/* Treść tematu */}
          <div>
            {!selectedTopic ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-[var(--text-muted)]">
                Dodaj pierwszy temat do monitorowania albo zajrzyj w „Gorące tematy”.
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      {selectedTopic.title}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">{selectedTopic.semanticFilter}</p>
                  </div>
                  <Button size="sm" onClick={refresh} disabled={refreshing}>
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Pobieram…" : "Odśwież teraz"}
                  </Button>
                </div>

                {/* Przełącznik źródeł */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  <SourceTab label="Wszystkie" active={sourceFilter === "all"} onClick={() => pickSource("all")} />
                  {enabledSources.map((s) => (
                    <SourceTab
                      key={s.id}
                      label={s.name}
                      color={LEANING_META[s.leaning].color}
                      active={sourceFilter === s.key}
                      onClick={() => pickSource(s.key)}
                    />
                  ))}
                </div>

                {loadingView ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-[var(--text-muted)]" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <section>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Aktualny stan wiedzy
                      </h3>
                      <KnowledgePanel topicId={selectedTopic.id} knowledge={filteredKnowledge} />
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Nowe wiadomości (ostatnie 24h) · {filteredItems.length}
                      </h3>
                      {filteredItems.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
                          Brak nowych, istotnych wiadomości. Kliknij „Odśwież teraz”, aby pobrać
                          najświeższe materiały (tylko z ostatnich 24 godzin).
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {filteredItems.map((item) => (
                            <NewsItemCard key={item.id} item={item} onChanged={onItemChanged} />
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
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

function TopicList({
  topics,
  selectedId,
  onSelect,
  onRefreshList,
}: {
  topics: TopicDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefreshList: () => void;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<TopicDTO | null>(null);
  const [creating, setCreating] = useState(false);

  function remove(t: TopicDTO) {
    if (!confirm(`Usunąć temat „${t.title}" wraz z bazą wiedzy?`)) return;
    startTransition(async () => {
      try {
        await deleteTopic(t.id);
        onRefreshList();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Tematy</span>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="Nowy temat"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-1">
        {topics.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group flex items-center gap-1 rounded-md px-2 py-1.5",
              selectedId === t.id ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-hover)]"
            )}
          >
            <button onClick={() => onSelect(t.id)} className="flex-1 text-left">
              <div className="truncate text-sm text-[var(--text-primary)]">{t.title}</div>
            </button>
            {t.pendingCount > 0 && (
              <span className="rounded-full bg-[var(--accent-blue)] px-1.5 text-[10px] font-medium text-white">
                {t.pendingCount}
              </span>
            )}
            <button
              onClick={() => setEditing(t)}
              className="hidden text-[var(--text-muted)] hover:text-[var(--text-primary)] group-hover:block"
              title="Edytuj"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => remove(t)}
              className="hidden text-[var(--text-muted)] hover:text-[var(--accent-red)] group-hover:block"
              title="Usuń"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {topics.length === 0 && (
          <p className="px-2 py-4 text-xs text-[var(--text-muted)]">Brak tematów.</p>
        )}
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
            onRefreshList();
            if (id) onSelect(id);
          }}
        />
      )}
    </div>
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
