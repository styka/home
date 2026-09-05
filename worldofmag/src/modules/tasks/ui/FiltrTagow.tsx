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
 * ta sama informacja mieści się w liczniku, a wybór — w panelu, który niczego nie przesuwa, bo
 * leży NAD treścią.
 *
 * 125 (zgł. 3): filtr wyprowadził się z wiersza zakładek statusów do GÓRNEGO PASKA AKCJI widoku
 * (obok lupy) — scalony wiersz ze 118 przy kilku wybranych tagach wypychał zakładki poza kadr.
 * Przycisk jest teraz ikoną z licznikiem wybranych (wzorzec sąsiadów paska), a rząd chipów
 * zniknął na życzenie właściciela: wybrane etykiety ogląda się i zdejmuje w panelu, który i tak
 * pokazuje je z ptaszkami.
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

  // 125 (zgł. 3): sam przycisk-ikona z licznikiem — stylistyka sąsiadów paska akcji (p-1.5,
  // size 15). Pełna treść („Filtr etykiet: 5 z 17") jedzie w title/aria; kolor akcentu mówi,
  // że filtr jest aktywny.
  return (
    <div ref={kotwicaRef} className="flex-shrink-0">
      <button
        type="button"
        onClick={() => setOtwarty((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={otwarty}
        title={`${t("filtrEtykiet")}: ${etykieta}`}
        // Nazwa dostępna musi mówić, CZYM ten przycisk jest, a nie tylko jaki ma stan: sam
        // licznik czytnikowi ekranu nic nie mówi. Stąd jawna etykieta z licznikiem na końcu.
        aria-label={`${t("filtrEtykiet")}: ${etykieta}`}
        className="flex items-center gap-1 rounded p-1.5 focus:outline-none"
        style={{ color: bezFiltru ? "var(--text-muted)" : "var(--accent-blue)" }}
      >
        <Tags size={15} />
        {!bezFiltru && (
          <span
            className="rounded-full px-1.5"
            style={{
              background: "var(--accent-blue)",
              color: "var(--on-accent)",
              fontSize: 10,
              minWidth: 16,
              textAlign: "center",
            }}
          >
            {wybrane.length}
          </span>
        )}
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
  );
}
