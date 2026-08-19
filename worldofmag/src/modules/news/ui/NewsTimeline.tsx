"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, ExternalLink } from "lucide-react";
import { sourceColor } from "@/lib/news/sourceColor";
import type { TimelineEntryDTO } from "../actions/news";

/**
 * 039: linia czasu tematu — zastąpiła narracyjną, wersjonowaną „bazę wiedzy".
 *
 * Tamta była opisem stanu pisanym od nowa przy każdej wiadomości, osobno dla każdego źródła: rosła
 * bez końca, powtarzała się i nie dawało się z niej wyczytać, KIEDY co się wydarzyło. Tutaj jedna
 * pozycja = jeden fakt z datą zdarzenia, więc temat czyta się chronologicznie i widać, skąd fakt
 * pochodzi.
 */
export function NewsTimeline({ entries }: { entries: TimelineEntryDTO[] }) {
  const t = useTranslations("modules.news.NewsTimeline");
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
        {t("liniaCzasuJestJeszcze")}
      </p>
    );
  }

  return (
    <ol className="relative space-y-3 border-l border-[var(--border)] pl-4">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          {/* Kropka na osi — pozycjonowana na linii, nie obok niej. */}
          <span
            className="absolute -left-[21px] top-2 h-2 w-2 rounded-full"
            style={{ background: sourceColor(e.sourceDescriptor) }}
            aria-hidden
          />
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                <CalendarClock size={12} /> {formatEventDate(e.eventDate)}
              </span>
              {e.dateConfidence !== "exact" && (
                <span
                  className="rounded px-1 py-0.5"
                  style={{ border: "1px solid var(--border)" }}
                  title={
                    e.dateConfidence === "approx"
                      ? "Data oszacowana z treści materiału"
                      : "W materiale nie było daty zdarzenia — użyto daty publikacji"
                  }
                >
                  {e.dateConfidence === "approx" ? "data przybliżona" : "data publikacji"}
                </span>
              )}
              {e.sourceName && <span>· {e.sourceName}</span>}
            </div>
            <p className="text-sm text-[var(--text-primary)]">{e.fact}</p>
            {e.url && (
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--accent-blue)] hover:underline"
              >
                <ExternalLink size={11} /> {t("materialZrodlowy")}
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}
