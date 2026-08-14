/**
 * 068 (zadanie 20) — PAGINACJA KURSOROWA (rozdz. 11.4).
 *
 * Rozdz. 11.4 wymienia „paginację kursorową we wszystkich widokach listowych" wśród zmian
 * potrzebnych przy 100 tys. użytkowników. Powód jest prostszy niż wydajność zapytania: **zapytanie
 * bez `take` zwraca wszystko**, a „wszystko" rośnie razem z kontem. Lista zadań osoby, która używa
 * Omnii od trzech lat, to nie jest ten sam obiekt, co lista z pierwszego tygodnia.
 *
 * **Kursor, nie `skip`/`offset`** — i to nie jest kwestia gustu. `OFFSET 5000` każe bazie policzyć
 * i odrzucić 5000 wierszy, więc koszt rośnie z numerem strony. Gorzej: przy dopisaniu rekordu
 * między jedną stroną a drugą element **przesuwa się** i użytkownik widzi go dwa razy albo wcale.
 * Kursor wskazuje konkretny wiersz, więc jest odporny na zmiany powyżej.
 *
 * **Kursorem jest identyfikator, nie data.** Daty się powtarzają (dwa rekordy w tej samej
 * milisekundzie to norma przy imporcie), a powtórzony kursor gubi wiersze. Sortowanie może iść po
 * dacie — kursor musi mieć **rozstrzygający** klucz na końcu.
 */

/** Jedna strona wyników. `nastepnyKursor === null` znaczy „to był koniec". */
export interface Strona<T> {
  pozycje: T[];
  nastepnyKursor: string | null;
}

/** Domyślny rozmiar strony. Kompromis: jeden ekran z zapasem, bez ładowania historii konta. */
export const DOMYSLNY_ROZMIAR = 50;

/** Górna granica, której wołający nie przeskoczy — także wtedy, gdy poprosi o 10 000. */
export const MAKS_ROZMIAR = 200;

export function rozmiarStrony(zadany?: number | null): number {
  if (!zadany || !Number.isFinite(zadany) || zadany <= 0) return DOMYSLNY_ROZMIAR;
  return Math.min(Math.floor(zadany), MAKS_ROZMIAR);
}

/**
 * Argumenty kursora dla Prismy. `skip: 1` pomija sam wiersz kursora — bez tego pierwszy element
 * kolejnej strony byłby duplikatem ostatniego z poprzedniej.
 */
export function argumentyKursora(kursor?: string | null): { cursor?: { id: string }; skip?: number } {
  return kursor ? { cursor: { id: kursor }, skip: 1 } : {};
}

/**
 * Zamienia wynik zapytania w stronę.
 *
 * **Pobieraj o jeden więcej, niż pokazujesz** (`rozmiar + 1`) i przekaż to tutaj. Inaczej nie da
 * się odróżnić „strona pełna, ale to koniec" od „jest więcej" bez drugiego zapytania z `count` —
 * a `count` na dużej tabeli jest dokładnie tym, czego paginacja miała uniknąć.
 */
export function zbudujStrone<T extends { id: string }>(wiersze: T[], rozmiar: number): Strona<T> {
  if (wiersze.length <= rozmiar) return { pozycje: wiersze, nastepnyKursor: null };
  const pozycje = wiersze.slice(0, rozmiar);
  return { pozycje, nastepnyKursor: pozycje[pozycje.length - 1]?.id ?? null };
}
