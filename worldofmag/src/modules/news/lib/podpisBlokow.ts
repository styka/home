/**
 * 111: PODPIS ZESTAWU BLOKÓW LEKTORA — wyciągnięty z komponentu, żeby dało się go sprawdzić testem.
 *
 * Lektor ucisza poprzedni odczyt, gdy zmieni się zestaw czytanych wiadomości. Rozpoznaje tę zmianę
 * po PODPISIE, a nie po tożsamości tablicy: konsument buduje `blocks` w ciele komponentu, więc
 * każdy render daje nową tablicę i porównanie referencji uciszałoby lektora po pierwszym zdaniu.
 *
 * Do 111 podpis powstawał z samych TYTUŁÓW — i to było zgłoszenie właściciela: „jeśli wiadomość
 * streszczę na inny poziom, to lektor i tak będzie czytał ten pierwszy streszczony tekst".
 * Zmiana poziomu streszczenia nie rusza tytułu, więc podpis wychodził identyczny, efekt uciszający
 * się nie budził i lektor czytał zdania sprzed zmiany. Funkcja nazywała się „podpisem treści",
 * a treści nie obejmowała — to jest cała usterka.
 *
 * Rozdzielacze to znaki sterujące, a nie spacja czy przecinek: w tytule i w streszczeniu może stać
 * dowolny znak drukowalny, więc każdy „bezpieczny" separator dałoby się podrobić samą treścią
 * i dwa różne zestawy wiadomości miałyby ten sam podpis.
 */
export interface BlokDoPodpisu {
  title: string;
  text: string;
}

const SEP_POLA = "\u0000";
const SEP_BLOKU = "\u0001";

export function podpisBlokow(bloki: BlokDoPodpisu[]): string {
  return bloki.map((b) => `${b.title}${SEP_POLA}${b.text}`).join(SEP_BLOKU);
}
