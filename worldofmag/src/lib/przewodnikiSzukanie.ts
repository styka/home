/**
 * 108 — normalizacja frazy do wyszukiwania w przewodnikach.
 *
 * Osobny, malutki moduł, a nie funkcja w `src/lib/przewodniki.ts`, i to jest wymóg poprawności,
 * nie porządek: `przewodniki.ts` importuje `@/generated/przewodniki`, czyli **cały markdown
 * wszystkich przewodników**. Hub jest komponentem KLIENCKIM — sięgnięcie tam po samą normalizację
 * wciągnęłoby całą treść do paczki przeglądarki, choć hub dostaje z serwera gotowy, chudy indeks.
 *
 * Ta sama funkcja po obu stronach jest natomiast wymogiem SPÓJNOŚCI: gdyby serwer i klient
 * normalizowały inaczej, ta sama fraza dawałaby dwa różne wyniki w zależności od tego, kto liczył.
 */

/**
 * Małe litery, bez polskich ogonków.
 *
 * **Nie zmienia długości tekstu znak w znak** i to jest celowe: pozycję trafienia znajdujemy
 * w kopii znormalizowanej, a fragment wycinamy z oryginału. Rozkład NFD dokłada znak łączący,
 * który zaraz usuwamy, więc bilans wychodzi na zero; `ł` podmieniamy jeden do jednego, bo NFD
 * go nie rozkłada. Gdyby ta funkcja zaczęła cokolwiek skracać (np. sklejać spacje), indeksy
 * przestałyby się zgadzać i fragmenty pokazywałyby tekst obok trafienia.
 */
export function normalizujFraze(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}
