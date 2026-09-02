"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Tags, Search, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import type { TaskTagDef } from "@/types";
import { TaskTagBadge } from "./TaskTagBadge";

/**
 * 100: filtr etykiet jako JEDEN przycisk o stałej wysokości.
 *
 * Zgłoszenie właściciela: „jak jest dużo tagów a najczęściej jest dużo to ten pasek jest bardzo
 * długi i nie fajnie to wygląda". Do 100 pasek filtrów rysował **po jednym chipsie na każdą
 * istniejącą etykietę** — przy osiemnastu tagach był to długi pas przewijany w bok, po którym
 * szukało się nazwy wzrokiem, a wysokość paska rosła razem ze słownikiem użytkownika.
 *
 * To jest dokładnie ten sam problem i to samo lekarstwo, co `SourceFilter` w Wiadomościach (083):
 * ta sama informacja mieści się w liczniku („Wszystkie", „3 z 18"), a wybór — w panelu, który
 * niczego nie przesuwa, bo leży NAD treścią. Różnica jest jedna i celowa: obok przycisku zostaje
 * rząd chipsów **wybranych** etykiet. Jest ich tyle, ile zaznaczono (typowo 1–3), a nie tyle, ile
 * istnieje — i to jest cała różnica między starym paskiem a nowym.
 *
 * Plik mieszka w module, nie w `components/ui`, bo jedynym konsumentem są Zadania: przynależność
 * pliku ustala lista jego konsumentów, nie nazwa (C-36).
 */
export function FiltrTagow({
  wszystkie,
  wybrane,
  onPrzelacz,
  onWyczysc,
}: {
  wszystkie: TaskTagDef[];
  /** Identyfikatory wybranych etykiet. Pusta lista = wszystkie zadania. */
  wybrane: string[];
  onPrzelacz: (id: string) => void;
  onWyczysc: () => void;
}) {
  const t = useTranslations("modules.tasks.FiltrTagow");
  const [otwarty, setOtwarty] = useState(false);
  const [fraza, setFraza] = useState("");
  const kotwicaRef = useRef<HTMLDivElement>(null);

  const widoczne = useMemo(() => {
    const q = fraza.trim().toLowerCase();
    if (!q) return wszystkie;
    return wszystkie.filter((x) => x.name.toLowerCase().includes(q));
  }, [wszystkie, fraza]);

  const bezFiltru = wybrane.length === 0;
  const etykieta = bezFiltru ? t("wszystkie") : t("zIlu", { wybrane: wybrane.length, wszystkie: wszystkie.length });
  const wybraneTagi = wszystkie.filter((x) => wybrane.includes(x.id));

  // 118 (zgł. 1): bez własnego wypełnienia wiersza — komponent stoi teraz WEWNĄTRZ wspólnego
  // rzędu zakładek statusu (`TaskFilters`), nie w osobnym wierszu; odstępy nadaje rodzic.
  return (
    <div className="flex min-w-0 items-center gap-1.5 py-1">
      <div ref={kotwicaRef} className="shrink-0">
        <button
          type="button"
          onClick={() => setOtwarty((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={otwarty}
          title={t("filtrEtykiet")}
          // Nazwa dostępna musi mówić, CZYM ten przycisk jest, a nie tylko jaki ma stan: sama
          // treść („Wszystkie", „3 z 18") czytnikowi ekranu nic nie mówi, a to ona wygrywa
          // z atrybutem `title`. Stąd jawna etykieta z licznikiem doklejonym na końcu.
          aria-label={`${t("filtrEtykiet")}: ${etykieta}`}
          className={cn(
            // Szerokość zmienia się o kilka znaków licznika i ani razu o wysokość — to jest cały
            // sens tej zmiany (AC-6).
            "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
            bezFiltru
              ? "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              : "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]",
          )}
        >
          <Tags size={14} className="shrink-0" />
          <span className="whitespace-nowrap">{etykieta}</span>
        </button>

        <AnchoredLayer
          anchorRef={kotwicaRef}
          open={otwarty}
          onClose={() => setOtwarty(false)}
          side="dol"
          align="start"
          width={300}
          ariaLabel={t("filtrEtykiet")}
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size={14} className="shrink-0 text-[var(--text-muted)]" />
            <input
              value={fraza}
              onChange={(e) => setFraza(e.target.value)}
              placeholder={t("szukajEtykiety")}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto py-1">
            <button
              type="button"
              onClick={onWyczysc}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-3 text-left text-sm transition-colors",
                bezFiltru
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
              )}
            >
              <span className="flex-1">{t("wszystkieEtykiety")}</span>
              <span className="text-[11px] text-[var(--text-muted)]">{wszystkie.length}</span>
            </button>

            {widoczne.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--text-muted)]">{t("nicNiePasuje")}</p>
            ) : (
              widoczne.map((tag) => {
                const zaznaczony = wybrane.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onPrzelacz(tag.id)}
                    aria-pressed={zaznaczony}
                    className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <span className="flex w-4 shrink-0 justify-center">
                      {zaznaczony && <Check size={14} className="text-[var(--accent-blue)]" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <TaskTagBadge tag={tag} size="sm" />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </AnchoredLayer>
      </div>

      {/* Chipy WYBRANYCH etykiet — nie wszystkich. Rząd ma stałą wysokość; przy nietypowo długim
          wyborze przewija się w bok, zamiast łamać pasek na drugi wiersz. */}
      {wybraneTagi.length > 0 && (
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          {wybraneTagi.map((tag) => (
            <span key={tag.id} className="shrink-0">
              <TaskTagBadge tag={tag} size="xs" onRemove={() => onPrzelacz(tag.id)} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
