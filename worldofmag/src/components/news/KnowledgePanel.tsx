"use client";

import { useState } from "react";
import { History, BookOpen, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { LEANING_META } from "@/lib/news/sources";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { getKnowledgeHistory, type KnowledgeDTO } from "@/actions/news";
import { useToast } from "@/components/ui/Toast";

type ViewMode = "full" | "changes";

function ModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
      {(["full", "changes"] as ViewMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "px-2.5 py-1 text-xs transition-colors",
            mode === m
              ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          {m === "full" ? "Pełna wiedza" : "Co się zmieniło"}
        </button>
      ))}
    </div>
  );
}

function KnowledgeBody({ k, mode }: { k: KnowledgeDTO; mode: ViewMode }) {
  if (mode === "changes") {
    if (!k.changeNote) {
      return (
        <p className="text-sm text-[var(--text-muted)]">
          {k.version <= 1
            ? "To wersja bazowa — punkt wyjścia bazy wiedzy na ten temat."
            : "Brak opisu zmian dla tej wersji."}
        </p>
      );
    }
    return (
      <div
        className="markdown-body text-sm text-[var(--text-secondary)]"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(k.changeNote) }}
      />
    );
  }
  return (
    <div
      className="markdown-body text-sm text-[var(--text-secondary)]"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(k.content) }}
    />
  );
}

function SourceKnowledgeCard({
  k,
  onOpenHistory,
}: {
  k: KnowledgeDTO;
  onOpenHistory: () => void;
}) {
  const [mode, setMode] = useState<ViewMode>("full");
  const leaning = LEANING_META[k.leaning];
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium" style={{ color: leaning.color }}>
            {k.sourceName}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            aktualny stan · wersja {k.version}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle mode={mode} onChange={setMode} />
          <button
            onClick={onOpenHistory}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <History size={13} /> Historia
          </button>
        </div>
      </div>
      {k.headline && mode === "full" && (
        <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">{k.headline}</p>
      )}
      <KnowledgeBody k={k} mode={mode} />
    </div>
  );
}

export function KnowledgePanel({
  topicId,
  knowledge,
}: {
  topicId: string;
  knowledge: KnowledgeDTO[];
}) {
  const { showToast } = useToast();
  const [history, setHistory] = useState<KnowledgeDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [historySource, setHistorySource] = useState("");
  const [idx, setIdx] = useState(0); // indeks w historii (0 = najnowsza)
  const [histMode, setHistMode] = useState<ViewMode>("changes");

  function openHistory(sourceId: string, sourceName: string) {
    setHistorySource(sourceName);
    setLoading(true);
    setHistory([]);
    setIdx(0);
    setHistMode("changes");
    getKnowledgeHistory(topicId, sourceId)
      .then(setHistory)
      .catch((e) => {
        showToast(e.message ?? "Błąd", "error");
        setHistory(null);
      })
      .finally(() => setLoading(false));
  }

  if (knowledge.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">
        <BookOpen size={16} className="mb-1 inline" /> Baza wiedzy jest pusta. Przyjmij pierwsze
        wiadomości „do wiedzy", aby zbudować aktualny stan tematu (osobno dla każdego źródła). Jeśli z
        ostatnich 24h nic nie ma, „Odśwież teraz" zbuduje bazową bazę wiedzy z dostępnych materiałów.
      </div>
    );
  }

  const current = history && history.length > 0 ? history[idx] : null;

  return (
    <>
      <style>{MARKDOWN_STYLES}</style>
      <div className="space-y-3">
        {knowledge.map((k) => (
          <SourceKnowledgeCard
            key={k.sourceId}
            k={k}
            onOpenHistory={() => openHistory(k.sourceId, k.sourceName)}
          />
        ))}
      </div>

      {history !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setHistory(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text-primary)]">
                Historia stanu wiedzy — {historySource}
              </h3>
              <button
                onClick={() => setHistory(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-[var(--text-muted)]" />
              </div>
            ) : !current ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">Brak historii.</p>
            ) : (
              <>
                {/* Nawigacja w czasie: ◀ wersja k/N ▶ + tryb */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIdx((i) => Math.min(history!.length - 1, i + 1))}
                      disabled={idx >= history!.length - 1}
                      className="rounded-md border border-[var(--border)] p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
                      title="Starsza wersja"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-[var(--text-primary)]">
                      Wersja {current.version}
                      <span className="text-[var(--text-muted)]"> / {history!.length}</span>
                    </span>
                    <button
                      onClick={() => setIdx((i) => Math.max(0, i - 1))}
                      disabled={idx <= 0}
                      className="rounded-md border border-[var(--border)] p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
                      title="Nowsza wersja"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(current.createdAt).toLocaleString("pl-PL")}
                    </span>
                  </div>
                  <ModeToggle mode={histMode} onChange={setHistMode} />
                </div>

                {/* Oś wersji do szybkiego skoku */}
                <div className="mb-3 flex flex-wrap gap-1">
                  {history!.map((h, i) => (
                    <button
                      key={h.version}
                      onClick={() => setIdx(i)}
                      className={cn(
                        "h-6 min-w-6 rounded px-1.5 text-xs",
                        i === idx
                          ? "bg-[var(--accent-blue)] text-white"
                          : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                      )}
                      title={`Wersja ${h.version}`}
                    >
                      v{h.version}
                    </button>
                  ))}
                </div>

                <div className="overflow-y-auto border-t border-[var(--border)] pt-3">
                  {current.headline && histMode === "full" && (
                    <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">
                      {current.headline}
                    </p>
                  )}
                  <KnowledgeBody k={current} mode={histMode} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
