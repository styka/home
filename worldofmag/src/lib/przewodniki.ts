/**
 * 108 — PRZEWODNIKI UŻYTKOWNIKA: warstwa odpytywania.
 *
 * Jedyne miejsce, które wie, że moduł ma (albo nie ma) przewodnika. Dzięki temu włączenie pomocy
 * w kolejnym module to dopisanie treści plus jedna linia w jego widoku — bez ruszania ramy widoku
 * i bez drugiej listy modułów.
 *
 * Bez Reacta i bez Prismy: to czysta funkcja nad treścią wygenerowaną w czasie builda, więc wolno
 * ją wołać zarówno z komponentu serwerowego, jak i z klienckiego.
 */
import {
  PRZEWODNIKI,
  type Przewodnik,
  type RozdzialPrzewodnika,
} from "@/generated/przewodniki";
import type { WpisIndeksu } from "@/lib/przewodnikiSzukanie";

export type { Przewodnik, RozdzialPrzewodnika };

export const SCIEZKA_PRZEWODNIKOW = "/guide";

export function wszystkiePrzewodniki(): Przewodnik[] {
  return PRZEWODNIKI;
}

export function przewodnikPoSlugu(slug: string): Przewodnik | null {
  return PRZEWODNIKI.find((p) => p.slug === slug) ?? null;
}

export function hrefPrzewodnika(slug: string): string {
  return `${SCIEZKA_PRZEWODNIKOW}/${slug}`;
}

/**
 * Adres przewodnika danego modułu albo `undefined`, gdy przewodnika jeszcze nie ma.
 *
 * `undefined` jest tu treścią, a nie brakiem: widok podaje ten wynik wprost do slotu `help` ramy,
 * więc moduł bez przewodnika **nie rysuje ikony pomocy** — bez ani jednej gałęzi w kodzie modułu
 * i bez ryzyka, że pomoc poprowadzi na pustą stronę.
 */
export function hrefPrzewodnikaModulu(moduleId: string): string | undefined {
  const p = PRZEWODNIKI.find((x) => x.moduleId === moduleId);
  return p ? hrefPrzewodnika(p.slug) : undefined;
}

/** Zbiór id modułów, które mają już przewodnik — do podziału kafelków na „gotowe" i „wkrótce". */
export function moduleZPrzewodnikiem(): Set<string> {
  const out = new Set<string>();
  for (const p of PRZEWODNIKI) if (p.moduleId) out.add(p.moduleId);
  return out;
}

/**
 * Chudy indeks do wyszukiwania — sam tekst rozdziałów, bez markdownu.
 *
 * Budowany na SERWERZE i przekazywany hubowi w propsach. Gdyby hub sięgnął po `PRZEWODNIKI`
 * bezpośrednio, wiózłby do przeglądarki pełną treść wszystkich przewodników tylko po to, żeby dało
 * się w niej szukać.
 */
export function indeksWyszukiwania(): WpisIndeksu[] {
  return PRZEWODNIKI.flatMap((p) =>
    p.rozdzialy.map((r) => ({
      przewodnikSlug: p.slug,
      przewodnikTitle: p.title,
      rozdzialSlug: r.slug,
      rozdzialTitle: r.title,
      tekst: r.tekst,
    }))
  );
}
