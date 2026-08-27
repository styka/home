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

export interface WynikSzukania {
  przewodnikSlug: string;
  przewodnikTitle: string;
  rozdzialSlug: string;
  rozdzialTitle: string;
  /** Fragment treści wokół trafienia — z oryginalną wielkością liter. */
  fragment: string;
  href: string;
}

/**
 * Normalizacja do porównywania: małe litery i polskie znaki sprowadzone do łacińskich.
 *
 * Bez tego „wikilink" nie znalazłby „Wikilinki", a „zalacznik" — „załącznik". Osoba szukająca
 * pomocy zwykle pisze szybko i bez ogonków; wyszukiwarka, która tego nie wybacza, jest odbierana
 * jako „nic nie ma", a nie jako „źle wpisałem".
 */
function znormalizuj(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0142/g, "l");
}

const DLUGOSC_FRAGMENTU = 160;

export function szukajWPrzewodnikach(fraza: string, limit = 20): WynikSzukania[] {
  const igla = znormalizuj(fraza.trim());
  if (igla.length < 2) return [];

  const out: WynikSzukania[] = [];
  for (const p of PRZEWODNIKI) {
    for (const r of p.rozdzialy) {
      const stog = znormalizuj(`${r.title} ${r.summary} ${r.tekst}`);
      const poz = stog.indexOf(igla);
      if (poz < 0) continue;

      // Fragment wycinamy z ORYGINAŁU, ale pozycję znamy ze znormalizowanej kopii. Obie mają tę
      // samą długość znak w znak (normalizacja niczego nie usuwa ani nie dokłada), więc indeks
      // przenosi się wprost — dlatego `znormalizuj` nie może zacząć skracać białych znaków.
      const oryginal = `${r.title} ${r.summary} ${r.tekst}`;
      const start = Math.max(0, poz - DLUGOSC_FRAGMENTU / 3);
      const fragment =
        (start > 0 ? "…" : "") +
        oryginal.slice(start, start + DLUGOSC_FRAGMENTU).trim() +
        (start + DLUGOSC_FRAGMENTU < oryginal.length ? "…" : "");

      out.push({
        przewodnikSlug: p.slug,
        przewodnikTitle: p.title,
        rozdzialSlug: r.slug,
        rozdzialTitle: r.title,
        fragment,
        href: `${hrefPrzewodnika(p.slug)}#${r.slug}`,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
