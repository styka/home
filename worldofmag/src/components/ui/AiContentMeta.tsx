"use client";

import { RefreshCw, Loader2 } from "lucide-react";

/**
 * 038: podpis pod treścią wygenerowaną przez AI — kiedy powstała, czy jest nieaktualna i jak
 * poprosić o nową.
 *
 * Powstał jako jeden komponent, bo bez niego ta sama linijka („wygenerowano…", znacznik
 * nieaktualności, przycisk odświeżenia) musiałaby zostać napisana osobno w Pogodzie, Magazynie,
 * Petach i Kuchni — czyli cztery razy to samo, z czterema okazjami do rozjazdu (C-53).
 *
 * Zasada, którą ten komponent wyraża w UI: treść nie odświeża się sama. `stale` to **informacja**,
 * że warunki się zmieniły, a nie polecenie generowania — decyzję podejmuje użytkownik przyciskiem.
 */
export function AiContentMeta({
  generatedAt,
  stale,
  busy,
  onRefresh,
  refreshLabel = "Odśwież",
  staleHint = "Dane źródłowe zmieniły się od czasu wygenerowania tej treści",
}: {
  generatedAt?: string;
  stale?: boolean;
  busy?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
  staleHint?: string;
}) {
  if (!generatedAt && !onRefresh) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
      {generatedAt && <span>Wygenerowano {formatWhen(generatedAt)}</span>}
      {stale && (
        <span
          className="rounded px-1 py-0.5 text-[var(--accent-amber)]"
          style={{ border: "1px solid var(--accent-amber)" }}
          title={staleHint}
        >
          nieaktualne
        </span>
      )}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          title="Wygeneruj treść na nowo"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {refreshLabel}
        </button>
      )}
    </div>
  );
}

/** „dziś 14:20" / „wczoraj 9:05" / „12.07, 18:30" — krótko, bo to podpis, nie treść. */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return `dziś ${time}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (sameDay(d, yesterday)) return `wczoraj ${time}`;
  return `${d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}, ${time}`;
}
