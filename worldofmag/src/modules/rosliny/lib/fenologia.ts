import type { TrybPrzestrzeni } from "./typy";
import { trybZawodowy } from "./tryb";

/**
 * 113 — FAZY ROZWOJOWE: JEDEN SŁOWNIK DLA PARAPETU I DLA POLA.
 *
 * Oparte na skali BBCH — międzynarodowym, uznanym kodowaniu faz rozwoju roślin: **dziesięć faz
 * głównych (0–9)**, uszczegóławianych drugą cyfrą. Kluczowa własność, dla której ją wybraliśmy:
 * **ta sama skala opisuje pszenicę i pomidora na parapecie**. Alternatywą byłyby osobne „stadia"
 * per segment — czyli trzy słowniki, które trzeba by uzgadniać (`badania.md`, poziom 7).
 *
 * **Dwie prezentacje tego samego kodu.** Zawodowiec czyta `BBCH 65`, bo tak wygląda etykieta środka
 * ochrony roślin i tak rozmawia z doradcą. Hobbysta czyta „pełnia kwitnienia". To jest ta sama
 * dana — różnica jest wyłącznie w tym, komu ją pokazujemy.
 *
 * **Nieznany kod nie rzuca.** Etykiety preparatów i literatura podają fazy, których tu nie ma;
 * użytkownik ma prawo wpisać `BBCH 73`. Wtedy pokazujemy fazę główną („rozwój owoców") zamiast
 * odmawiać — wyjątek na wpisanym z ręki kodzie byłby awarią widoku, a nie ochroną danych.
 */

/** Dziesięć faz głównych skali BBCH. Indeks = pierwsza cyfra kodu. */
export const FAZY_GLOWNE: readonly string[] = [
  "kiełkowanie / rozwój pąka", // 0
  "rozwój liści", // 1
  "krzewienie / pędy boczne", // 2
  "wzrost pędu / rozeta", // 3
  "rozwój części jadalnych", // 4
  "wykształcanie kwiatostanu", // 5
  "kwitnienie", // 6
  "rozwój owoców", // 7
  "dojrzewanie", // 8
  "starzenie / spoczynek", // 9
];

/**
 * Fazy szczegółowe, które realnie padają w rozmowie o uprawie i na etykietach preparatów.
 * Lista jest krótka **celowo**: to nie jest przepisana monografia, tylko te kody, które użytkownik
 * wybierze z listy. Reszta i tak zadziała przez fazę główną (C-53).
 */
const FAZY_SZCZEGOLOWE: Record<string, string> = {
  "00": "spoczynek nasion",
  "05": "kiełkowanie — korzeń zarodkowy",
  "09": "wschody",
  "11": "pierwszy liść właściwy",
  "13": "trzy liście właściwe",
  "19": "dziewięć i więcej liści",
  "21": "początek krzewienia",
  "29": "koniec krzewienia",
  "30": "początek wzrostu pędu",
  "31": "pierwsze kolanko",
  "39": "liść flagowy widoczny",
  "41": "początek rozwoju części jadalnych",
  "49": "części jadalne osiągnęły wielkość typową",
  "51": "widoczny zawiązek kwiatostanu",
  "55": "widoczne pojedyncze pąki",
  "59": "pierwsze płatki widoczne",
  "61": "początek kwitnienia",
  "65": "pełnia kwitnienia",
  "69": "koniec kwitnienia",
  "71": "zawiązki owoców",
  "75": "owoce osiągnęły połowę wielkości",
  "79": "owoce osiągnęły wielkość typową",
  "81": "początek dojrzewania",
  "85": "dojrzewanie zaawansowane",
  "89": "pełna dojrzałość",
  "91": "koniec wzrostu, liście zielone",
  "95": "żółknięcie liści",
  "97": "części nadziemne obumarłe",
};

/** Znormalizowany kod: dwie cyfry, bez prefiksu, bez spacji. `null`, gdy to nie jest kod BBCH. */
export function normalizujKod(kod: string | null | undefined): string | null {
  if (!kod) return null;
  const cyfry = String(kod).replace(/[^0-9]/g, "");
  if (cyfry.length === 0) return null;
  // Jedna cyfra to faza główna — dopełniamy zerem, żeby „6" znaczyło to samo co „60".
  const dwie = cyfry.length === 1 ? `${cyfry}0` : cyfry.slice(0, 2);
  return dwie;
}

/**
 * Polska nazwa fazy. Zawsze coś zwraca dla kodu, który da się znormalizować — najpierw szuka fazy
 * szczegółowej, potem schodzi do głównej.
 */
export function nazwaFazy(kod: string | null | undefined): string | null {
  const k = normalizujKod(kod);
  if (!k) return null;
  const szczegolowa = FAZY_SZCZEGOLOWE[k];
  if (szczegolowa) return szczegolowa;
  const glowna = FAZY_GLOWNE[Number(k[0])];
  return glowna ?? null;
}

/**
 * Etykieta fazy dopasowana do trybu przestrzeni.
 *
 * Zawodowiec dostaje kod z nazwą (`BBCH 65 — pełnia kwitnienia`), hobbysta samą nazwę. Kod bez
 * nazwy nie pojawia się nigdzie: liczba, której użytkownik nie umie przeczytać, nie jest informacją.
 */
export function etykietaFazy(kod: string | null | undefined, tryb: TrybPrzestrzeni): string | null {
  const k = normalizujKod(kod);
  if (!k) return null;
  const nazwa = nazwaFazy(k);
  if (!nazwa) return trybZawodowy(tryb) ? `BBCH ${k}` : null;
  return trybZawodowy(tryb) ? `BBCH ${k} — ${nazwa}` : nazwa;
}

/** Lista do wyboru w formularzu: kod + nazwa, w kolejności rozwoju rośliny. */
export function listaFaz(): { kod: string; nazwa: string }[] {
  return Object.keys(FAZY_SZCZEGOLOWE)
    .sort()
    .map((kod) => ({ kod, nazwa: FAZY_SZCZEGOLOWE[kod] }));
}
