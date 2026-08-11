/**
 * 050 — WKŁAD MODUŁU DO MIGAWKI PULPITU (rozdz. 9.3).
 *
 * Ostatnia równoległa lista opisująca moduł żyła w trasie pulpitu: dziewięć importów z modułów
 * i dziesięć gałęzi na uprawnienia. Moduł, który chciał cokolwiek pokazać na stronie głównej,
 * musiał wejść do cudzego pliku.
 *
 * Typ jest **niewiedzący o żadnym module**: dostaje `userId` i kontekst, oddaje fragment migawki.
 * Kształt fragmentu zna korzeń kompozycji, nie platforma (C-36).
 */

/**
 * To, co trasa liczyła **raz** i podawała wszystkim blokom. Bez tego każdy wkład liczyłby granice
 * dnia od nowa, a `getUserTeamIds` poszłoby do bazy jedenaście razy zamiast raz.
 */
export interface DashboardContext {
  /** Moment złożenia migawki. Okna liczone „wstecz od teraz" (np. siedem dni) muszą wychodzić
   *  STĄD, nie z `todayEnd` — koniec dnia jest do ~24 h późniejszy, więc okno wyszłoby węższe. */
  now: Date;
  todayStart: Date;
  todayEnd: Date;
  teamIds: string[];
}

/**
 * Wkład jednego modułu. Zwraca **fragment** migawki — korzeń kompozycji scala fragmenty na
 * wartościach domyślnych.
 *
 * **Uwaga o `userId`:** część wkładów woła Server Actions swojego modułu, a te wywodzą użytkownika
 * z sesji, nie z tego parametru. Sygnatura go niesie, bo wkłady czytające bazę wprost go potrzebują
 * — ale nie zakładaj, że przekazanie innego `userId` przełączy wkład na innego użytkownika.
 * Odkryte przy zrzucie punktu odniesienia (050/T-3) i zapisane, żeby nie zmyliło następnego czytelnika.
 */
export type DashboardContributor<T = Record<string, unknown>> = (
  userId: string,
  ctx: DashboardContext,
) => Promise<T>;
