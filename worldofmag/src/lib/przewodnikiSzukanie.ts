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

/** Jeden rozdział w indeksie: tyle, ile trzeba, żeby znaleźć i pokazać trafienie. */
export interface WpisIndeksu {
  przewodnikSlug: string;
  przewodnikTitle: string;
  rozdzialSlug: string;
  rozdzialTitle: string;
  /** Treść rozdziału bez składni markdown. */
  tekst: string;
}

export interface WynikSzukania extends WpisIndeksu {
  /** Fragment treści wokół trafienia — z oryginalną wielkością liter i ogonkami. */
  fragment: string;
  href: string;
}

const DLUGOSC_FRAGMENTU = 170;
/** Ile znaków kontekstu PRZED trafieniem — żeby fraza nie stała na samym początku fragmentu. */
const KONTEKST_PRZED = 50;

/**
 * Wyszukiwanie po indeksie rozdziałów.
 *
 * Działa na **indeksie**, a nie na `PRZEWODNIKI`, i to jest sedno: hub jest komponentem klienckim,
 * więc dostaje z serwera chudy indeks (same teksty), a nie pełne przewodniki z markdownem. Ta sama
 * funkcja obsługuje więc obie strony — jedna implementacja, jeden wynik, jeden zestaw testów.
 * Osobne wyszukiwanie „dla serwera" i „dla klienta" oznaczałoby, że testy sprawdzają inną ścieżkę
 * niż ta, w którą klika czytelnik.
 */
export function szukajWIndeksie(indeks: WpisIndeksu[], fraza: string, limit = 24): WynikSzukania[] {
  const igla = normalizujFraze(fraza.trim());
  if (igla.length < 2) return [];

  const out: WynikSzukania[] = [];
  for (const w of indeks) {
    const oryginal = `${w.rozdzialTitle} ${w.tekst}`;
    const poz = normalizujFraze(oryginal).indexOf(igla);
    if (poz < 0) continue;

    // Fragment wycinamy z ORYGINAŁU, a pozycję znamy ze znormalizowanej kopii. Obie mają tę samą
    // długość znak w znak, więc indeks przenosi się wprost — patrz uwaga przy `normalizujFraze`.
    const start = Math.max(0, poz - KONTEKST_PRZED);
    const koniec = start + DLUGOSC_FRAGMENTU;
    out.push({
      ...w,
      fragment:
        (start > 0 ? "…" : "") +
        oryginal.slice(start, koniec).trim() +
        (koniec < oryginal.length ? "…" : ""),
      href: `/guide/${w.przewodnikSlug}#${w.rozdzialSlug}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}
