"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Check, X, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { LEANING_META } from "@/lib/news/sources";
import { timeAgo, SUMMARY_LENGTHS } from "@/lib/news/format";
import { useToast } from "@/components/ui/Toast";
import {
  acknowledgeItem,
  dismissItem,
  resummarizeItem,
  type NewsItemDTO,
  type SummaryLength,
} from "@/actions/news";

export function NewsItemCard({ item, onChanged }: { item: NewsItemDTO; onChanged: () => void }) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState(item.summary);
  const [length, setLength] = useState<SummaryLength>(item.summaryLength);
  const [resummarizing, setResummarizing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const leaning = LEANING_META[item.leaning];

  function changeLength(next: SummaryLength) {
    if (next === length || resummarizing) return;
    setResummarizing(true);
    resummarizeItem(item.id, next)
      .then((s) => {
        setSummary(s);
        setLength(next);
      })
      .catch((e) => showToast(e.message ?? "Nie udało się zmienić streszczenia", "error"))
      .finally(() => setResummarizing(false));
  }

  function acknowledge() {
    startTransition(async () => {
      try {
        await acknowledgeItem(item.id);
        showToast("Dodano do bazy wiedzy tematu", "success");
        onChanged();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  function dismiss() {
    startTransition(async () => {
      try {
        await dismissItem(item.id);
        onChanged();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <span
          className="rounded px-1.5 py-0.5 font-medium"
          style={{ color: leaning.color, border: `1px solid ${leaning.color}` }}
        >
          {item.sourceName}
        </span>
        <span>· {timeAgo(item.publishedAt)}</span>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-start gap-1.5 text-[var(--text-primary)] hover:text-[var(--accent-blue)]"
      >
        <span className="min-w-0 [overflow-wrap:anywhere] font-semibold leading-snug">{item.title}</span>
        <ExternalLink size={14} className="mt-1 shrink-0 opacity-60" />
      </a>

      {item.imageUrl && !imgError && (
        // Linkujemy do obrazu z portalu (bez pobierania/przechowywania bajtów).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="mt-2 max-h-52 w-full rounded-md border border-[var(--border)] object-cover"
        />
      )}

      <p className="mt-2 [overflow-wrap:anywhere] text-sm leading-relaxed text-[var(--text-secondary)]">{summary}</p>

      {item.noveltyNote && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
          <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--accent-amber)]" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span className="font-medium text-[var(--text-primary)]">Co nowego: </span>
            {item.noveltyNote}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {resummarizing ? (
            <Loader2 size={13} className="animate-spin text-[var(--text-muted)]" />
          ) : null}
          {SUMMARY_LENGTHS.map((l) => (
            <button
              key={l.key}
              onClick={() => changeLength(l.key)}
              disabled={resummarizing}
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                length === l.key
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={dismiss}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={13} /> Odrzuć
          </button>
          <button
            onClick={acknowledge}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-green)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            <Check size={13} /> Przyjmij do wiedzy
          </button>
        </div>
      </div>
    </div>
  );
}
