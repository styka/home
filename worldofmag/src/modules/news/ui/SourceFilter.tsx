"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Filter, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { sourceColor } from "@/lib/news/sourceColor";
import type { SourceDTO } from "../actions/news";

/**
 * 083: filtr portali jako JEDEN przycisk o stałej wysokości.
 *
 * Zgłoszenie właściciela: „ikonki źródeł zajmują za dużo miejsca". Do 082 filtr był pasem chipsów —
 * po jednym na źródło — więc **wysokość paska zależała od liczby źródeł**: przy trzech mieścił się
 * w jednym wierszu, przy piętnastu zawijał się w trzy i zjadał ekran treści. A pasek jest
 * PRZYKLEJONY, więc każdy jego wiersz odbiera miejsce na treść już na zawsze, nie tylko na starcie.
 *
 * Ta sama informacja mieści się w liczniku („Wszystkie", „3 z 12"), a wybór — w panelu, który
 * niczego nie przesuwa, bo leży NAD treścią (`AnchoredLayer`, portal do `body`).
 *
 * Wybór jest wielokrotny: porównanie dwóch portali („jak każdy z nich ujmuje temat") było w wersji
 * jednokrotnej niemożliwe — trzeba było przełączać tam i z powrotem. Pusty wybór znaczy
 * „wszystkie", a nie „nic": filtr, który po odznaczeniu ostatniej pozycji pokazuje pustą stronę,
 * wygląda jak usterka.
 */
export function SourceFilter({
  sources,
  wybrane,
  onZmiana,
}: {
  /** Wyłącznie źródła włączone — wyłączone nie mają czego filtrować. */
  sources: SourceDTO[];
  /** Klucze wybranych źródeł. Pusta lista = wszystkie. */
  wybrane: string[];
  onZmiana: (klucze: string[]) => void;
}) {
  const t = useTranslations("modules.news.SourceFilter");
  const [otwarty, setOtwarty] = useState(false);
  const [fraza, setFraza] = useState("");
  const kotwicaRef = useRef<HTMLDivElement>(null);

  const widoczne = useMemo(() => {
    const q = fraza.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.descriptor ?? "").toLowerCase().includes(q),
    );
  }, [sources, fraza]);

  const wszystkie = wybrane.length === 0;
  const etykieta = wszystkie ? t("wszystkie") : `${wybrane.length} z ${sources.length}`;

  function przelacz(key: string) {
    onZmiana(wybrane.includes(key) ? wybrane.filter((k) => k !== key) : [...wybrane, key]);
  }

  return (
    <div ref={kotwicaRef} className="shrink-0">
      <button
        type="button"
        onClick={() => setOtwarty((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={otwarty}
        title={t("filtrPortali")}
        className={cn(
          // `py-3` = cel dotyku (C-31). Szerokość zmienia się o kilka znaków licznika i ani razu
          // o wysokość — to jest cały sens tej zmiany.
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-3 text-xs transition-colors",
          wszystkie
            ? "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            : "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]",
        )}
      >
        <Filter size={14} className="shrink-0" />
        <span className="whitespace-nowrap">{etykieta}</span>
      </button>

      <AnchoredLayer
        anchorRef={kotwicaRef}
        open={otwarty}
        onClose={() => setOtwarty(false)}
        side="dol"
        align="koniec"
        width={300}
        ariaLabel={t("filtrPortali")}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          <Search size={14} className="shrink-0 text-[var(--text-muted)]" />
          <input
            value={fraza}
            onChange={(e) => setFraza(e.target.value)}
            placeholder={t("szukajPortalu")}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => onZmiana([])}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-3 text-left text-sm transition-colors",
              wszystkie
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            <span className="flex-1">{t("wszystkiePortale")}</span>
            <span className="text-[11px] text-[var(--text-muted)]">{sources.length}</span>
          </button>

          {widoczne.length === 0 ? (
            <p className="px-3 py-3 text-xs text-[var(--text-muted)]">{t("nicNiePasuje")}</p>
          ) : (
            widoczne.map((s) => {
              const zaznaczone = wybrane.includes(s.key);
              return (
                <button
                  key={s.id}
                  type="button"
                  role="checkbox"
                  aria-checked={zaznaczone}
                  onClick={() => przelacz(s.key)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-3 text-left text-sm transition-colors",
                    zaznaczone
                      ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: zaznaczone ? sourceColor(s.descriptor) : "var(--border)" }}
                  />
                  <span className="min-w-0 flex-1 break-words">{s.name}</span>
                  {s.descriptor && (
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{s.descriptor}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {!wszystkie && (
          <div className="border-t border-[var(--border)] px-3 py-2">
            <button
              type="button"
              onClick={() => onZmiana([])}
              className="py-1 text-xs text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
            >
              {t("wyczyscWybor")}
            </button>
          </div>
        )}
      </AnchoredLayer>
    </div>
  );
}
