/**
 * 088: TYTUŁ ROBOCZY ZGŁOSZENIA.
 *
 * Zgłoszenie z trybu wskazywania zapisuje się NATYCHMIAST, zanim cokolwiek trafi do modelu —
 * zamknięcie asystenta przerywa trwające żądanie (`abort()` w `handleClose`), więc każda droga,
 * która najpierw pyta model, a dopiero potem zapisuje, gubi zgłoszenie dokładnie w chwili, w której
 * zgłaszający uzna, że skończył. Tytuł roboczy jest ceną tej pewności: zadanie ma nazwę od razu,
 * a ładniejszą dostaje chwilę później z kolejki (`tasks.feedbackTitle`).
 *
 * Funkcja jest CZYSTA (bez bazy, bez Reacta, bez sesji) i zwraca dokładnie to samo po obu stronach:
 * serwer nadaje tytuł przy zapisie, a zadanie w tle porównuje go przed podmianą — dzięki temu
 * ręczna zmiana tytułu przez człowieka nigdy nie zostanie nadpisana kosmetyką modelu.
 */

/** Prefiks zgłoszeń z „robaczka" — po nim poznaje się je na liście administratora (029). */
export const PREFIKS_ZGLOSZENIA = "🐛 ";

/** Maksymalna długość tytułu zadania po stronie skrzynki zgłoszeń. */
const MAX_DLUGOSC = 80;

/**
 * Pierwsze zdanie opisu (albo jego początek) jako tytuł roboczy, z prefiksem 🐛.
 *
 * Pusty opis nie jest błędem — zgłoszenie ma powstać zawsze, więc zwracamy nazwę zastępczą.
 */
export function roboczyTytul(opis: string): string {
  const czysty = (opis ?? "").replace(/\s+/g, " ").trim();
  if (!czysty) return `${PREFIKS_ZGLOSZENIA}Zgłoszenie`;

  // Pierwsze zdanie: kropka/wykrzyknik/pytajnik ze spacją po nim, albo znak nowej linii (już zjedzony).
  const koniecZdania = czysty.search(/[.!?](\s|$)/);
  let tresc = koniecZdania > 0 ? czysty.slice(0, koniecZdania) : czysty;

  if (tresc.length > MAX_DLUGOSC) tresc = `${tresc.slice(0, MAX_DLUGOSC - 1).trimEnd()}…`;
  return `${PREFIKS_ZGLOSZENIA}${tresc}`;
}

/** Czy tytuł jest wciąż tym, który nadaliśmy przy zapisie (a nie zmienionym przez człowieka). */
export function czyTytulRoboczy(tytul: string, oczekiwany: string): boolean {
  return tytul.trim() === oczekiwany.trim();
}
