"use client";

import type { SygnalKanalu } from "./bus";

/**
 * 107 — MAGISTRALA SYGNAŁU W PRZEGLĄDARCE.
 *
 * `DataFreshness` trzyma **jedno** połączenie ze strumieniem zdarzeń na kartę i dotąd robił
 * z niego jedną rzecz: `router.refresh()`. To wystarcza widokom rysowanym na serwerze, ale nie
 * wystarcza rozmowie: ta ma własny stan (pozycja przewijania, treść w polu, doczytane starsze
 * wiadomości), którego odświeżenie trasy nie dotyka.
 *
 * Zamiast otwierać drugie połączenie — a każde kosztuje tyle samo, ile pierwsze — publikujemy
 * sygnał, który już przyszedł. Magistrala jest celowo mikroskopijna: zbiór funkcji zwrotnych
 * i funkcja odsubskrybowania. Zwracanie odsubskrybowania nie jest wygodą, tylko wymogiem
 * poprawności — bez niego każdy odmontowany komponent zostawia słuchacza.
 *
 * 085 skasowało poprzedniczkę tej magistrali, bo straciła konsumenta i ogłaszała rozwiązanie,
 * którego nikt nie stosował. Wraca **razem z konsumentami** (C-35): wątkiem rozmowy i licznikiem
 * nieprzeczytanych w chromie.
 */
type Sluchacz = (sygnal: SygnalKanalu) => void;

const sluchacze = new Set<Sluchacz>();

/** Zapisuje słuchacza i **zwraca odsubskrybowanie**. */
export function subskrybujSygnal(sluchacz: Sluchacz): () => void {
  sluchacze.add(sluchacz);
  return () => {
    sluchacze.delete(sluchacz);
  };
}

/** Rozsyła sygnał. Błąd jednego słuchacza nie blokuje pozostałych. */
export function opublikujSygnal(sygnal: SygnalKanalu): void {
  sluchacze.forEach((s) => {
    try {
      s(sygnal);
    } catch {
      // Słuchacz odmontowanego komponentu potrafi rzucić — to nie jest awaria strumienia.
    }
  });
}
