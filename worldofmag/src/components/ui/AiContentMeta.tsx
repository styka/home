"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Loader2, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { AiCostBadge, type AiCostUsage } from "@/components/ui/AiCostBadge";
import { setSectionMode } from "@/actions/aiSections";
import { AI_SECTION_MODE_LABELS, type AiSectionMode } from "@/lib/ai/sectionMode";
import type { AiContentKind } from "@/lib/ai/contentMemory";

/**
 * 038/041: pasek pod treścią wygenerowaną przez AI — kiedy powstała, czy jest nieaktualna, ile
 * kosztowała, jak poprosić o nową i **kiedy ma powstawać sama**.
 *
 * Powstał jako jeden komponent, bo bez niego ta sama linijka musiałaby zostać napisana osobno w
 * Pogodzie, Wiadomościach, Magazynie, Petach i Kuchni — pięć razy to samo, z pięcioma okazjami do
 * rozjazdu (C-53).
 *
 * 041 dołożył dwie rzeczy. Po pierwsze **koszt stoi WEWNĄTRZ paska**, a nie obok: wcześniej każdy
 * moduł sam składał „meta + licznik" we własnym kontenerze, więc odstępy i zawijanie różniły się
 * między modułami. Po drugie **wybór trybu** (`⚙`), zwinięty domyślnie — sekcja ma w spoczynku
 * zajmować jedną linię, a nie panel ustawień.
 *
 * Zasada, którą ten komponent wyraża w UI: treść nie odświeża się sama, chyba że użytkownik sam o to
 * poprosił, wybierając tryb. `stale` to **informacja**, że warunki się zmieniły, a nie polecenie
 * generowania.
 */
export function AiContentMeta({
  generatedAt,
  stale,
  busy,
  onRefresh,
  refreshLabel = "Odśwież",
  staleHint = "Dane źródłowe zmieniły się od czasu wygenerowania tej treści",
  usage,
  sectionKind,
  mode,
  onModeChange,
}: {
  generatedAt?: string;
  stale?: boolean;
  busy?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
  staleHint?: string;
  /** 041: koszt tej konkretnej treści — pokazywany tylko wtedy, gdy serwer go przepuścił. */
  usage?: AiCostUsage;
  /** 041: rodzaj sekcji. Podany razem z `mode` włącza wybór trybu pod „⚙". */
  sectionKind?: AiContentKind;
  mode?: AiSectionMode;
  onModeChange?: (mode: AiSectionMode) => void;
}) {
  const [showModes, setShowModes] = useState(false);
  const [saving, startSaving] = useTransition();
  const canPickMode = !!sectionKind && !!mode;

  if (!generatedAt && !onRefresh && !usage && !canPickMode) return null;

  function pick(next: AiSectionMode) {
    if (!sectionKind || next === mode) {
      setShowModes(false);
      return;
    }
    startSaving(async () => {
      try {
        await setSectionMode(sectionKind, next);
        onModeChange?.(next);
      } catch {
        // Nieudany zapis zostawia poprzedni tryb — `onModeChange` się nie wykona, więc ekran nie
        // obieca ustawienia, którego serwer nie zna. Wyjątek MUSI być tu złapany: funkcja async
        // oddana do `startTransition` nie ma innego właściciela, więc odrzucenie poszłoby dalej
        // jako nieobsłużone.
      } finally {
        setShowModes(false);
      }
    });
  }

  return (
    <div className="text-[11px] text-[var(--text-muted)]">
      {/* Jedna linia w spoczynku (AC-5, AC-13). `flex-wrap` jest tu po to, żeby na wąskim ekranie
          pasek złamał się na dwie linie zamiast rozepchnąć stronę w bok.

          041/T-21: przyciski mają `py-3` — cel dotyku z C-31. Subtelność bierze się z ROZMIARU I
          KOLORU tekstu (11 px, `--text-muted`), a nie z ciasnego obszaru klikalnego; pasek zostaje
          jedną linią, tylko wyższą o kilkanaście pikseli. Ciasny przycisk nie jest „subtelny",
          tylko trudny do trafienia kciukiem. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
        {usage && <AiCostBadge usage={usage} align="left" />}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded px-2 py-3 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
            title="Wygeneruj treść na nowo"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {refreshLabel}
          </button>
        )}
        {canPickMode && (
          <button
            onClick={() => setShowModes((v) => !v)}
            aria-expanded={showModes}
            className="inline-flex items-center gap-1 rounded px-2 py-3 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Kiedy ta sekcja ma się odświeżać"
          >
            <Settings2 size={11} />
            {AI_SECTION_MODE_LABELS[mode!].label}
          </button>
        )}
      </div>

      {canPickMode && showModes && (
        <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-1">
          {(Object.keys(AI_SECTION_MODE_LABELS) as AiSectionMode[]).map((m) => (
            <button
              key={m}
              onClick={() => pick(m)}
              disabled={saving}
              aria-pressed={m === mode}
              // `py-3` = cel dotyku na telefonie (C-31). Wybór trybu ma być osiągalny kciukiem,
              // choć w spoczynku jest schowany.
              className={cn(
                "block w-full rounded-md px-2 py-3 text-left transition-colors disabled:opacity-50",
                m === mode
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              <span className="block text-xs font-medium">{AI_SECTION_MODE_LABELS[m].label}</span>
              <span className="block text-[11px] text-[var(--text-muted)]">
                {AI_SECTION_MODE_LABELS[m].hint}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 041: stan OCZEKIWANIA — treści jeszcze nie ma, bo tryb sekcji zabrania generować bez kliknięcia.
 *
 * Osobny komponent, a nie wariant pustego stanu, bo to musi WYGLĄDAĆ inaczej niż awaria. W 038
 * dokładnie ta pomyłka kosztowała nas dzień: nieudane generowanie i „nic nie znaleziono" były
 * jednakowo szarym zdaniem, więc użytkownik ponawiał w nieskończoność. Tutaj komunikat mówi wprost,
 * że nic się nie zepsuło — po prostu czekamy na decyzję. Stąd też ikona iskierek i przycisk w
 * kolorze akcentu zamiast bursztynowej ramki, którą zarezerwowaliśmy dla błędów.
 */
export function AiContentPending({
  title = "Treść powstanie po kliknięciu",
  hint = "Ta sekcja jest ustawiona na „na żądanie”, więc nic nie generuje się samo.",
  actionLabel = "Generuj",
  busy,
  onGenerate,
  sectionKind,
  mode,
  onModeChange,
}: {
  title?: string;
  hint?: string;
  actionLabel?: string;
  busy?: boolean;
  onGenerate: () => void;
  sectionKind?: AiContentKind;
  mode?: AiSectionMode;
  onModeChange?: (mode: AiSectionMode) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <p className="flex items-start gap-1.5 text-sm text-[var(--text-primary)]">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-[var(--accent-blue)]" />
        <span>
          <span className="font-medium">{title}</span>{" "}
          <span className="text-[var(--text-secondary)]">{hint}</span>
        </span>
      </p>
      <button
        onClick={onGenerate}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-blue)] px-3 py-3 text-sm text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {busy ? "Generuję…" : actionLabel}
      </button>
      {sectionKind && mode && (
        <div className="mt-3">
          <AiContentMeta sectionKind={sectionKind} mode={mode} onModeChange={onModeChange} />
        </div>
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
