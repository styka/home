"use client";

import { useEffect } from "react";
import { ArrowLeft, Loader2, RefreshCw, Star, ListPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { AiCostBadge, type AiCostUsage } from "@/components/ui/AiCostBadge";
import type { IdeaDTO } from "@/lib/weather/ideas";

/**
 * 037: szczegółowy plan jednej propozycji.
 *
 * Dwa układy z jednego komponentu (C-31): na komputerze panel wsunięty w kolumnę, na telefonie widok
 * pełnoekranowy z jawnym „Wróć". Zamiast dwóch komponentów przełączamy klasy — treść i akcje są
 * identyczne, różni się tylko obudowa.
 */
export function IdeaDetailSheet({
  idea,
  detail,
  detailRuns,
  loading,
  regenerating,
  usage,
  usdPlnRate,
  canAddToTasks,
  onClose,
  onRegenerate,
  onSave,
  onAddToTasks,
}: {
  idea: IdeaDTO;
  detail: string | null;
  detailRuns: number;
  loading: boolean;
  regenerating: boolean;
  usage?: AiCostUsage;
  usdPlnRate?: number;
  canAddToTasks: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  onSave: () => void;
  onAddToTasks: () => void;
}) {
  // Esc zamyka — spójnie z resztą aplikacji (skróty klawiszowe, C-31).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // Jedno drzewo DOM, dwa układy sterowane klasami — renderowanie treści dwa razy (raz dla
    // telefonu, raz dla komputera) dublowałoby markdown i psuło odczyt przez czytniki ekranu.
    // Mobile: pełny ekran. Desktop: panel w kolumnie obok listy.
    <div
      role="dialog"
      aria-label={`Szczegóły propozycji: ${idea.title}`}
      className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[var(--bg-base)] md:static md:z-auto md:max-h-[70vh] md:rounded-xl md:border md:border-[var(--border)] md:bg-[var(--bg-surface)]"
    >
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <button
            onClick={onClose}
            className="mb-1 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] md:hidden"
          >
            <ArrowLeft size={13} /> Wróć do listy
          </button>
          <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{idea.title}</h3>
          {idea.summary && (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{idea.summary}</p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Zamknij szczegóły"
          className="hidden shrink-0 rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] md:block"
        >
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 size={14} className="animate-spin" /> Układam plan…
          </p>
        ) : detail ? (
          <>
            <style>{MARKDOWN_STYLES}</style>
            <div
              className="markdown-body text-sm text-[var(--text-secondary)]"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(detail) }}
            />
            {detailRuns > 1 && (
              <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                Wersja {detailRuns} — plan był generowany ponownie.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Nie udało się przygotować planu. Spróbuj wygenerować go ponownie.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button size="sm" variant="secondary" className="py-3" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Generuj ponownie
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="py-3"
          onClick={onSave}
          disabled={idea.state === "saved"}
          title={idea.state === "saved" ? "Już zapisana w bibliotece" : "Zapisz w bibliotece pomysłów"}
        >
          <Star size={14} /> {idea.state === "saved" ? "Zapisana" : "Zapisz"}
        </Button>
        {canAddToTasks && (
          <Button size="sm" variant="ghost" className="py-3" onClick={onAddToTasks} disabled={!idea.id}>
            <ListPlus size={14} /> Dodaj do zadań
          </Button>
        )}
        <AiCostBadge usage={usage} rate={usdPlnRate} />
      </div>
    </div>
  );
}
