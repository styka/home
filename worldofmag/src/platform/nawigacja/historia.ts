/**
 * 103: HISTORIA ODWIEDZONYCH STRON — czysta logika listy plus jej pamięć w przeglądarce.
 *
 * Zgłoszenie właściciela: „nawigacja po przebytych stronach (zmiany URL-i). Lista nazw stron
 * chronologiczna tak by najbliżej do wyboru była poprzednia strona a coraz dalej dawniejsze strony".
 *
 * Trzy decyzje, które warto znać, zanim się tu coś zmieni:
 *
 * 1. **To NIE jest tabela w bazie i nie powinno nią zostać.** Zapis szedłby przy każdej zmianie
 *    adresu — czyli przy najczęstszej operacji w całej aplikacji — dla danych, które tracą sens
 *    razem z zamkniętą kartą. Stąd `sessionStorage`: przeżywa odświeżenie strony (a właśnie po
 *    odświeżeniu historia jest najbardziej potrzebna), nie przeżywa zamknięcia przeglądarki.
 *
 * 2. **Platforma nie zna modułów (C-36), więc etykieta przychodzi GOTOWA.** Nazwa „Zakupy" bierze
 *    się z rejestru modułów, a ten mieszka w korzeniu kompozycji. Gdyby ten plik sam próbował
 *    nazwać ścieżkę, musiałby zaimportować `@/lib/modules` — czyli platforma zaczęłaby znać moduły.
 *
 * 3. **Brak pamięci jest POPRAWNYM stanem, nie błędem.** `sessionStorage` rzuca w prywatnym oknie
 *    części przeglądarek, przy zablokowanych danych witryn i przy zrzucie miniatury. Historia jest
 *    wygodą; wyjątek stąd wywróciłby powłokę, czyli każdą stronę naraz.
 */

export interface WpisHistorii {
  /** Pełny adres wewnętrzny (ze stanem widoku w `?query`), pod który wraca gest. */
  sciezka: string;
  /** Nazwa pokazywana w wachlarzu — gotowa, podana przez wywołującego. */
  etykieta: string;
  /** Znacznik czasu odwiedzin; służy wyłącznie kolejności. */
  czas: number;
}

/**
 * Ile wpisów trzymamy. Dwanaście, bo wachlarz rysuje osiem podpowiedzi na pierwszym pierścieniu
 * i resztę na drugim — dłuższa lista nie jest już nawigacją, tylko archiwum, którego i tak nikt
 * nie przeczyta z łuku pod kciukiem.
 */
export const LIMIT_HISTORII = 12;

const KLUCZ = "omnia.historiaNawigacji";

/**
 * Dopisuje odwiedziny na POCZĄTEK listy (najświeższe pierwsze — tak układa je wachlarz, więc
 * poprzednia strona wypada najbliżej palca).
 *
 * Powtórzenie tej samej ścieżki **pod rząd** jest scalane, a nie dopisywane: przejście
 * `A → A` zdarza się przy każdym `router.refresh()` i przy każdej zmianie stanu widoku
 * w adresie, a lista złożona z dwunastu kopii bieżącej strony nie jest historią.
 * Ponowne odwiedzenie ścieżki, która była DAWNIEJ, awansuje ją na początek — inaczej ta sama
 * strona stałaby w liście dwa razy, w dwóch różnych miejscach.
 */
export function dopisz(lista: WpisHistorii[], wpis: WpisHistorii, limit: number = LIMIT_HISTORII): WpisHistorii[] {
  const bez = lista.filter((w) => w.sciezka !== wpis.sciezka);
  return [wpis, ...bez].slice(0, Math.max(0, limit));
}

/** Odczyt z pamięci sesji. Brak pamięci, uszkodzony wpis albo obcy kształt → pusta historia. */
export function odczytaj(): WpisHistorii[] {
  try {
    const surowe = window.sessionStorage.getItem(KLUCZ);
    if (!surowe) return [];
    const dane: unknown = JSON.parse(surowe);
    if (!Array.isArray(dane)) return [];
    return dane.filter(czyWpis).slice(0, LIMIT_HISTORII);
  } catch {
    return [];
  }
}

/** Zapis do pamięci sesji. Cisza przy niepowodzeniu — patrz decyzja 3 w nagłówku pliku. */
export function zapisz(lista: WpisHistorii[]): void {
  try {
    window.sessionStorage.setItem(KLUCZ, JSON.stringify(lista.slice(0, LIMIT_HISTORII)));
  } catch {
    // Pamięć niedostępna albo pełna — historia zostaje wyłącznie w stanie React na czas tej strony.
  }
}

function czyWpis(x: unknown): x is WpisHistorii {
  if (typeof x !== "object" || x === null) return false;
  const w = x as Record<string, unknown>;
  // Adres musi być wewnętrzny — wpis przerobiony ręcznie w pamięci przeglądarki nie może stać się
  // wyjściem poza aplikację. Ta sama reguła, którą `normalizeFavoritePath` stosuje do ulubionych.
  return (
    typeof w.sciezka === "string" &&
    w.sciezka.startsWith("/") &&
    !w.sciezka.startsWith("//") &&
    !w.sciezka.startsWith("/\\") &&
    typeof w.etykieta === "string" &&
    typeof w.czas === "number"
  );
}
