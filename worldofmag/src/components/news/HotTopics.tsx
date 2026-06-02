"use client";

import { useEffect, useState, useTransition } from "react";
import { Flame, Plus, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getHotTopics, createTopic, type HotTopic } from "@/actions/news";

export function HotTopics({ onAdded }: { onAdded: () => void }) {
  const { showToast } = useToast();
  const [topics, setTopics] = useState<HotTopic[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, startAdding] = useTransition();

  function load() {
    setLoading(true);
    getHotTopics()
      .then(setTopics)
      .catch((e) => {
        showToast(e.message ?? "Nie udało się pobrać gorących tematów", "error");
        setTopics([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function add(t: HotTopic) {
    startAdding(async () => {
      try {
        await createTopic({ title: t.title, semanticFilter: t.suggestedFilter });
        showToast(`Dodano temat „${t.title}"`, "success");
        onAdded();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-[var(--accent-orange)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Gorące tematy</h2>
          <span className="text-xs text-[var(--text-muted)]">ostatnie 24h · wszystkie źródła</span>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Odśwież
        </Button>
      </div>

      {loading || topics === null ? (
        <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-muted)]">
          <Loader2 className="animate-spin" />
          <span className="text-sm">Analizuję nagłówki z ostatnich 24 godzin…</span>
        </div>
      ) : topics.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          Brak świeżych nagłówków do analizy (sprawdź źródła w ustawieniach).
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {topics.map((t, i) => (
            <div
              key={i}
              className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4"
            >
              <h3 className="font-semibold text-[var(--text-primary)]">{t.title}</h3>
              <p className="mt-1 flex-1 text-sm text-[var(--text-secondary)]">{t.summary}</p>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                Źródła: {t.sources.join(", ") || "—"}
              </div>
              <div className="mt-3">
                <Button size="sm" onClick={() => add(t)} disabled={adding}>
                  <Plus size={14} /> Monitoruj ten temat
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
