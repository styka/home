/**
 * 124: heurystyka „tytuł wygląda na obcojęzyczny" — dla etapu naprawczego przebiegu odświeżania.
 *
 * Tłumaczenie tytułu istnieje od 084, ale działa wyłącznie dla pozycji NOWYCH w danym przebiegu:
 * pozycja, której partia streszczeń padła albo której model pominął pole `title`, zostawała z obcym
 * tytułem NA ZAWSZE — i to jest zgłoszenie właściciela („The economics of agent scale…" na liście).
 * Naprawa musi najpierw umieć wskazać kandydatów, stąd ten plik.
 *
 * Próg jest ŚWIADOMIE ostrożny (spec 124, ryzyka): fałszywe „obcy" na polskim tytule oznaczałoby
 * płatne tłumaczenie w kółko, więc wolimy przepuścić wątpliwy tytuł niż oznaczyć polski.
 * - jeden polski znak diakrytyczny przesądza o polskości (obce języki ich nie używają);
 * - „obcy" wymaga co najmniej DWÓCH RÓŻNYCH obcych słów funkcyjnych jako osobnych wyrazów —
 *   pojedyncze „the" w tytule dzieła („The Economist ostrzega…") nie wystarcza;
 * - granice wyrazów przez własny podział, NIE `\b` — `\b` w JS jest ASCII-only (lekcja 112),
 *   więc przy polskich literach kładzie granice w środku słowa.
 *
 * Czysty moduł bez Prismy — testowalny jednostkowo (`__tests__/jezykTytulu.test.ts`).
 */

const POLSKIE_DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Słowa funkcyjne najczęstszych języków źródeł RSS (angielski, niemiecki, francuski, hiszpański).
 * Tylko słowa, które w polskim tytule nie występują jako samodzielne wyrazy — dlatego nie ma tu
 * np. „on" (po polsku zaimek) ani „a" (po polsku spójnik).
 */
const OBCE_SLOWA_FUNKCYJNE = new Set([
  // angielski
  "the", "of", "and", "for", "with", "from", "how", "why", "what", "is", "are",
  "in", "at", "by", "into", "will", "has", "have", "his", "her", "its", "their",
  "this", "that", "new", "after", "over", "more", "your", "you", "not",
  // niemiecki
  "der", "die", "das", "und", "für", "mit", "von", "nach", "über", "ist", "sind",
  "ein", "eine", "nicht", "wird",
  // francuski
  "le", "la", "les", "des", "une", "est", "dans", "pour", "avec", "sur", "aux",
  // hiszpański
  "el", "los", "las", "una", "del", "por", "para", "con", "más", "está",
]);

/** Podział na wyrazy bez `\b`: wszystko, co nie jest literą (Unicode), tnie. */
function wyrazy(tekst: string): string[] {
  return tekst
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

/**
 * Czy tytuł wygląda na napisany w całości w języku obcym.
 *
 * `false` NIE znaczy „na pewno polski" — znaczy „nie dość dowodów, by płacić za tłumaczenie".
 */
export function tytulWygladaNaObcy(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  if (POLSKIE_DIAKRYTYKI.test(t)) return false;

  const trafione = new Set<string>();
  for (const w of wyrazy(t)) {
    if (OBCE_SLOWA_FUNKCYJNE.has(w)) trafione.add(w);
  }
  return trafione.size >= 2;
}
