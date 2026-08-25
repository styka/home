"use client";

import { cn } from "@/lib/cn";

/**
 * 100: przełącznik segmentowy — zbiór **wykluczających się** list, każda z licznikiem.
 *
 * Zgłoszenie właściciela z /wiadomosci: „schowane te dwie opcje pod ikoną z trzykropkiem zbyt ukrywa
 * te listy no i gdy jest wybrana opcja odrzucone to nawet nie widać by była wybrana". Menu ⋮ ma dwie
 * wady naraz i obie są tu naprawiane: **nie mówi, co jest dostępne** (trzeba je otworzyć, żeby się
 * dowiedzieć) i **nie mówi, co jest wybrane** (stan siedzi w środku zamkniętej warstwy).
 *
 * Dlaczego to komponent wspólny, a nie kawałek JSX-a w Wiadomościach: ten sam kształt — „kilka list
 * tego samego rodzaju, jedna oglądana naraz" — wróci w innych modułach, a skopiowany blok rozjeżdża
 * się przy pierwszej zmianie stylu (dokładnie ten argument stoi za `GroupNavigator` z 083, który
 * mieszka piętro obok). Dowożony **razem z pierwszym konsumentem** (C-35).
 *
 * Segment z zerowym licznikiem jest **wyłączony, ale widoczny** — świadomie inaczej niż w menu ⋮
 * z 099, które takie pozycje pomijało. Znikająca pozycja zmienia szerokość paska w trakcie pracy
 * (lista rośnie z 0 do 1 i układ podskakuje) i ukrywa sam fakt, że taka lista istnieje — czyli
 * odtwarza wadę, którą ten komponent ma usunąć.
 */
export interface PozycjaSegmentu {
  id: string;
  etykieta: string;
  /** Pominięty = bez odznaki. Zero = pozycja widoczna, ale wyłączona. */
  licznik?: number;
  /** Wymuszenie wyłączenia niezależnie od licznika. */
  wylaczona?: boolean;
}

export function PrzelacznikSegmentowy({
  pozycje,
  wybrana,
  onWybor,
  ariaLabel,
  className,
}: {
  pozycje: PozycjaSegmentu[];
  wybrana: string;
  onWybor: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        // `min-w-0` + przewijanie w poziomie: przy trzech segmentach i 360 px wszystko się mieści,
        // ale liczniki bywają trzycyfrowe — wtedy pasek ma się przewinąć, a NIE złamać na drugi
        // wiersz. Wysokość przyklejonego nagłówka jest podstawą zasłony pod nim (086/087), więc
        // zawijanie kosztowałoby przesunięcie każdej sekcji poniżej.
        "flex min-w-0 items-center gap-1 overflow-x-auto rounded-md bg-[var(--bg-surface)] p-0.5",
        className,
      )}
    >
      {pozycje.map((p) => {
        const wyl = p.wylaczona ?? p.licznik === 0;
        const aktywna = p.id === wybrana;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={aktywna}
            aria-disabled={wyl || undefined}
            disabled={wyl}
            onClick={() => onWybor(p.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              aktywna
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--accent-blue)]"
                : wyl
                  ? "cursor-not-allowed text-[var(--text-muted)] opacity-50"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            {p.etykieta}
            {p.licznik !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  aktywna
                    ? "bg-[var(--accent-blue)] text-[var(--on-accent)]"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)]",
                )}
              >
                {p.licznik}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
