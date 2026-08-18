/**
 * PAGINACJA KURSOROWA (rozdz. 11.4) — JEDEN helper na całą aplikację.
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
 *
 * ---
 *
 * **095 — dlaczego ten plik jest teraz jedyny.** Do 095 tę samą ideę niosły DWA pliki:
 * `src/lib/pagination.ts` (Z-070, `keysetQuery`/`keysetResult`, jeden konsument — log audytu)
 * i `src/platform/pagination.ts` (068, `argumentyKursora`/`zbudujStrone`, **zero konsumentów**).
 * Drugi powstał, żeby domknąć zadanie 20, i nikt go nigdy nie zawołał — czyli dokładnie plik bez
 * konsumenta z C-35, tyle że w warstwie, która ma być wzorcem. Dwa nośniki jednej idei to ta sama
 * patologia, którą ta przebudowa likwidowała w ośmiu listach modułów: pierwsza osoba, która szuka
 * „jak się tu paginuje", znajduje jeden z nich losowo.
 *
 * Został wariant platformowy (bo platforma jest miejscem na zdolności współdzielone) z API
 * przeniesionym z tego, który miał konsumenta — bo API sprawdzone w użyciu jest lepszym punktem
 * wyjścia niż API sprawdzone w zamyśle.
 */

/** Jedna strona wyników. `nastepnyKursor === null` znaczy „to był koniec". */
export interface Strona<T> {
  pozycje: T[];
  nastepnyKursor: string | null;
  /** Wygodne dla interfejsu; równoważne `nastepnyKursor !== null`. */
  jestWiecej: boolean;
}

/** Domyślny rozmiar strony. Kompromis: jeden ekran z zapasem, bez ładowania historii konta. */
export const DOMYSLNY_ROZMIAR = 50;

/** Górna granica, której wołający nie przeskoczy — także wtedy, gdy poprosi o 10 000. */
export const MAKS_ROZMIAR = 200;

/**
 * SUFIT dla list, które nie mają („jeszcze") doładowania w interfejsie.
 *
 * To **nie jest strona** i nie udaje paginacji: to granica, powyżej której zapytanie przestaje być
 * listą, a staje się zrzutem tabeli. Stoi wysoko nad realną liczbą rekordów takiej listy (słowniki,
 * konfiguracja, kilkanaście–kilkadziesiąt pozycji), więc dla użytkownika jest niewidoczna, a chroni
 * przed jedynym scenariuszem, który naprawdę boli: kontem, które rośnie latami.
 */
export const SUFIT_LISTY = 1000;

export function rozmiarStrony(zadany?: number | null): number {
  if (!zadany || !Number.isFinite(zadany) || zadany <= 0) return DOMYSLNY_ROZMIAR;
  return Math.min(Math.max(Math.trunc(zadany), 1), MAKS_ROZMIAR);
}

/**
 * Argumenty `findMany` dla kursora. Pobiera **o jeden więcej**, niż strona pokaże — inaczej nie da
 * się odróżnić „strona pełna, ale to koniec" od „jest więcej" bez drugiego zapytania z `count`,
 * a `count` na dużej tabeli jest dokładnie tym, czego paginacja miała uniknąć.
 *
 * `skip: 1` pomija sam wiersz kursora; bez tego pierwszy element kolejnej strony byłby duplikatem
 * ostatniego z poprzedniej. Typ zwrotny jest **jawny i pojedynczy** (pola opcjonalne) — bez tego
 * spread tworzy unię, której typy Prismy nie przyjmują.
 */
export function zapytanieKursorowe(params: { kursor?: string | null; rozmiar?: number | null }): {
  take: number;
  cursor?: { id: string };
  skip?: number;
} {
  const take = rozmiarStrony(params.rozmiar) + 1;
  return params.kursor ? { take, cursor: { id: params.kursor }, skip: 1 } : { take };
}

/** Tnie nadmiarowy wiersz i wylicza następny kursor. */
export function stronaZWierszy<T extends { id: string }>(wiersze: T[], rozmiar?: number | null): Strona<T> {
  const n = rozmiarStrony(rozmiar);
  const jestWiecej = wiersze.length > n;
  const pozycje = jestWiecej ? wiersze.slice(0, n) : wiersze;
  return {
    pozycje,
    jestWiecej,
    nastepnyKursor: jestWiecej && pozycje.length > 0 ? pozycje[pozycje.length - 1].id : null,
  };
}
