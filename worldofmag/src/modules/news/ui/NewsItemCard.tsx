"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ExternalLink, Check, X, Sparkles, Loader2, Headphones } from "lucide-react";
import { cn } from "@/lib/cn";
import { sourceColor } from "@/lib/news/sourceColor";
import { timeAgo, SUMMARY_LENGTHS } from "@/lib/news/format";
import { useToast } from "@/components/ui/Toast";
import { AiCostBadge, type AiCostUsage } from "@/components/ui/AiCostBadge";
import {
  acknowledgeItem,
  dismissItem,
  resummarizeItem,
  type NewsItemDTO,
  type SummaryLength,
} from "../actions/news";

export function NewsItemCard({
  item,
  onChanged,
  czytaneZdanie,
  czytana = false,
  onSluchaj,
}: {
  item: NewsItemDTO;
  onChanged: () => void;
  /** 084 (AC-5): zdanie, które lektor właśnie czyta — podświetlane w treści tej karty. */
  czytaneZdanie?: string | null;
  /** Czy lektor widoku czyta akurat tę pozycję. */
  czytana?: boolean;
  /** Prośba o odsłuch tej pozycji — lektor jest JEDEN, w ramie widoku, nie w karcie. */
  onSluchaj?: (itemId: string) => void;
}) {
  const t = useTranslations("modules.news.NewsItemCard");
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState(item.summary);
  const [length, setLength] = useState<SummaryLength>(item.summaryLength);
  const [resummarizing, setResummarizing] = useState(false);
  const [usage, setUsage] = useState<AiCostUsage | undefined>();
  const [imgError, setImgError] = useState(false);

  const color = sourceColor(item.sourceDescriptor);

  function changeLength(next: SummaryLength) {
    if (next === length || resummarizing) return;
    setResummarizing(true);
    resummarizeItem(item.id, next)
      .then((r) => {
        setSummary(r.summary);
        setUsage(r.usage);
        setLength(next);
      })
      .catch((e) => showToast(e.message ?? "Nie udało się zmienić streszczenia", "error"))
      .finally(() => setResummarizing(false));
  }

  function acknowledge() {
    startTransition(async () => {
      try {
        await acknowledgeItem(item.id);
        showToast("Oznaczono jako przeczytane", "success");
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
          style={{ color, border: `1px solid ${color}` }}
          // 040: opis w podpowiedzi, a nie obok nazwy — badge ma zostać krótki, a opis bywa
          // dowolnym tekstem użytkownika. Brak opisu = brak podpowiedzi, bez pustej plamy.
          title={item.sourceDescriptor || undefined}
        >
          {item.sourceName}
        </span>
        {item.sourceDescriptor && <span>· {item.sourceDescriptor}</span>}
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

      {/* 039: streszczenie albo lektor — nie oba naraz. Podwójny tekst na ekranie każe czytelnikowi
          zgadywać, który z nich jest „ten właściwy". */}
      {(
        <>
          {/* 084 (AC-5): czytany fragment podświetla się TUTAJ, przy treści, a nie w osobnym
              pudełku lektora. Dopasowanie po TREŚCI zdania: lektor i karta dzielą ten sam podział
              (`lib/speech/sentences`), więc porównanie jest jednoznaczne — indeks wymagałby
              utrzymywania zgodności dwóch list i psułby się przy pierwszej rozbieżności. */}
          <p className="mt-2 [overflow-wrap:anywhere] text-sm leading-relaxed text-[var(--text-secondary)]">
            {czytaneZdanie ? podswietl(summary, czytaneZdanie) : summary}
          </p>
          {/* 084 (AC-23): pozycja bez streszczenia MA to powiedzieć. Skrót z kanału bywa poprawnym
              zdaniem, więc bez tego znacznika lista wygląda na kompletną, a nie jest. */}
          {item.summaryFailed && (
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{t("bezStreszczenia")}</p>
          )}
        </>
      )}
      {usage && (
        <div className="mt-1 flex justify-end">
          <AiCostBadge akcja="Streszczenie wiadomości" usage={usage} />
        </div>
      )}

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
            onClick={() => onSluchaj?.(item.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs",
              czytana
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            )}
            aria-pressed={czytana}
          >
            <Headphones size={13} /> {czytana ? "Zamknij lektora" : "Słuchaj"}
          </button>
          <button
            onClick={dismiss}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={13} /> {t("odrzuc")}
          </button>
          <button
            onClick={acknowledge}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-green)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            <Check size={13} /> Przeczytane
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 084 (AC-5): podświetla w streszczeniu zdanie, które lektor właśnie czyta.
 *
 * Szukamy po TREŚCI, nie po pozycji: lektor dzieli tekst tą samą funkcją co my, więc zdanie musi
 * się w streszczeniu znaleźć — a gdyby się nie znalazło (zmiana długości streszczenia w trakcie
 * odsłuchu), po prostu nie podświetlamy niczego. Cichy brak podświetlenia jest znacznie lepszy niż
 * podświetlenie nie tego fragmentu.
 */
function podswietl(tekst: string, zdanie: string) {
  const szukane = zdanie.trim();
  if (!szukane) return tekst;
  const i = tekst.indexOf(szukane);
  if (i < 0) return tekst;
  return (
    <>
      {tekst.slice(0, i)}
      <mark
        // Kolory wyłącznie zmiennymi CSS — skórka musi móc to przemalować (C-30).
        style={{
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          boxShadow: "inset 2px 0 0 var(--accent-purple)",
          padding: "0 2px 0 6px",
          borderRadius: 3,
        }}
      >
        {szukane}
      </mark>
      {tekst.slice(i + szukane.length)}
    </>
  );
}
