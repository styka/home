"use client";

import { useState } from "react";
import { History, BookOpen, X, Loader2 } from "lucide-react";
import { LEANING_META } from "@/lib/news/sources";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { getKnowledgeHistory, type KnowledgeDTO } from "@/actions/news";
import { useToast } from "@/components/ui/Toast";

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
  const [historySource, setHistorySource] = useState<string>("");

  function openHistory(sourceId: string, sourceName: string) {
    setHistorySource(sourceName);
    setLoading(true);
    setHistory([]);
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
        wiadomości „do wiedzy", aby zbudować aktualny stan tematu (osobno dla każdego źródła).
      </div>
    );
  }

  return (
    <>
      <style>{MARKDOWN_STYLES}</style>
      <div className="space-y-3">
        {knowledge.map((k) => {
          const leaning = LEANING_META[k.leaning];
          return (
            <div
              key={k.sourceId}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium" style={{ color: leaning.color }}>
                    {k.sourceName}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    aktualny stan · wersja {k.version}
                  </span>
                </div>
                <button
                  onClick={() => openHistory(k.sourceId, k.sourceName)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <History size={13} /> Historia
                </button>
              </div>
              {k.headline && (
                <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">{k.headline}</p>
              )}
              <div
                className="markdown-body text-sm text-[var(--text-secondary)]"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(k.content) }}
              />
            </div>
          );
        })}
      </div>

      {history !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setHistory(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text-primary)]">
                Historia stanu wiedzy — {historySource}
              </h3>
              <button onClick={() => setHistory(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-[var(--text-muted)]" />
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((h) => (
                  <div key={h.version} className="border-l-2 border-[var(--border)] pl-3">
                    <div className="mb-1 text-xs text-[var(--text-muted)]">
                      Wersja {h.version} · {new Date(h.createdAt).toLocaleString("pl-PL")}
                    </div>
                    {h.headline && (
                      <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">{h.headline}</p>
                    )}
                    <div
                      className="markdown-body text-sm text-[var(--text-secondary)]"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(h.content) }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
