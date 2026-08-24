"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { SUMMARY_LENGTHS } from "@/lib/news/format";
import { NaglowekSekcji } from "./sekcjeTematow";
import { setDefaultSummaryLength, setShowEmptyTopics, type SummaryLength } from "../actions/news";

/**
 * 085 (AC-17): USTAWIENIA MODUŁU — osobno od listy źródeł.
 *
 * Zgłoszenie właściciela brzmiało jak pytanie („czy to nie dziwne, że ustawienia streszczeń są
 * w zakładce źródła?"), ale opisuje realny błąd porządkowania: długość streszczeń nie jest cechą
 * żadnego kanału RSS, więc w zakładce „Źródła" była gościem. Rozdzielenie kosztuje jedną zakładkę
 * i daje miejsce, w którym kolejne ustawienie modułu ma gdzie stanąć — pierwszym z nich jest
 * ukrywanie pustych tematów.
 */
export function NewsModuleSettings({
  defaultLength,
  showEmptyTopics,
  onShowEmptyTopics,
  onChanged,
}: {
  defaultLength: SummaryLength;
  showEmptyTopics: boolean;
  /** Natychmiastowe przełączenie w widoku — zapis do bazy leci równolegle. */
  onShowEmptyTopics: (show: boolean) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("modules.news.NewsModuleSettings");
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  function run(fn: () => Promise<void>, ok?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (ok) showToast(ok, "success");
        onChanged();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  function przelaczPuste(next: boolean) {
    // Widok reaguje od razu, baza dogania. Odwrotna kolejność dałaby przełącznik, który „nie
    // działa" przez czas obiegu do serwera — a to jest ustawienie, którego skutek widać na liście.
    onShowEmptyTopics(next);
    run(() => setShowEmptyTopics(next));
  }

  return (
    <div className="space-y-6">
      <section>
        <NaglowekSekcji tytul={t("domyslnaDlugoscStreszczen")} />
        <div className="mt-3 flex flex-wrap gap-2">
          {SUMMARY_LENGTHS.map((l) => (
            <button
              key={l.key}
              onClick={() => run(() => setDefaultSummaryLength(l.key), "Zapisano")}
              aria-pressed={defaultLength === l.key}
              className={cn(
                "rounded-md border px-3 py-2.5 text-sm transition-colors",
                defaultLength === l.key
                  ? "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{t("dlugoscOpis")}</p>
      </section>

      <section>
        <NaglowekSekcji tytul={t("listaTematow")} />
        <label className="mt-3 flex items-start gap-3 rounded-md border border-[var(--border)] p-3">
          {/* 20×20 px = minimalny cel dotyku dla pola wyboru (C-31). */}
          <input
            type="checkbox"
            checked={showEmptyTopics}
            onChange={(e) => przelaczPuste(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent-blue)]"
          />
          <span className="min-w-0">
            <span className="block text-sm text-[var(--text-primary)]">{t("pokazujPusteTematy")}</span>
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{t("pokazujPusteOpis")}</span>
          </span>
        </label>
      </section>
    </div>
  );
}
