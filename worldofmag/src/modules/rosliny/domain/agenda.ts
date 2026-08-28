import { WYMAGANIA_WODNE_DOMYSLNE, TRYBY_PRZESTRZENI, type TrybPrzestrzeni, type WymaganiaWodne } from "../lib/typy";

/**
 * 113 — TRZY REGUŁY, KTÓRE ZACZĘŁY ŻYCIE W PLIKACH AKCJI.
 *
 * Wyprowadzone stąd, bo plik z `"use server"` nie eksportuje funkcji synchronicznych: reguła w nim
 * zawarta jest **niesprawdzalna**, choćby była prosta. Zapadka `check:domain` złapała dokładnie te
 * trzy i miała rację — każda z nich podejmuje decyzję, którą da się pomylić po cichu.
 */

const MS_DZIEN = 86_400_000;

export type KubelekAgendy = "OVERDUE" | "TODAY" | "SOON";

/**
 * Do której grupy trafia zaplanowany zabieg.
 *
 * **Zaległe zaczynają się dopiero dobę po terminie, nie w chwili jego minięcia.** Bez tego zabieg
 * zaplanowany na dziś rano lądowałby po południu w „zaległych" i straszył czerwonym znacznikiem,
 * choć użytkownik ma jeszcze cały dzień — a lista, która alarmuje bez powodu, przestaje być czytana.
 *
 * „Dziś" liczymy do KOŃCA dnia lokalnego, a nie „w ciągu 24 godzin": użytkownik pyta o dobę
 * kalendarzową, nie o okno przesuwane względem chwili wejścia na stronę.
 */
export function kubelekAgendy(nextDueAt: Date | null, teraz: Date): KubelekAgendy {
  if (!nextDueAt) return "SOON";
  const koniecDnia = new Date(teraz);
  koniecDnia.setHours(23, 59, 59, 999);
  if (nextDueAt.getTime() < teraz.getTime() - MS_DZIEN) return "OVERDUE";
  if (nextDueAt.getTime() <= koniecDnia.getTime()) return "TODAY";
  return "SOON";
}

/**
 * Wymagania wodne gatunku zapisane jako JSON → cztery liczby.
 *
 * **Uszkodzony wpis traktujemy jak brak danych, nie jak błąd.** Wartości domyślne dadzą sensowny
 * termin, a wywalenie CAŁEJ agendy przez jeden zepsuty wiersz byłoby znacznie gorsze niż odstęp
 * policzony z domyślnych. Pojedyncze pole spoza zakresu też się nie przenosi na pozostałe — każde
 * ma własny zapas.
 */
export function czytajWymaganiaWodne(waterJson: string | null | undefined): WymaganiaWodne {
  if (!waterJson) return WYMAGANIA_WODNE_DOMYSLNE;
  try {
    const parsed = JSON.parse(waterJson) as Partial<Record<keyof WymaganiaWodne, unknown>>;
    const liczba = (v: unknown, zapas: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : zapas;
    };
    return {
      winter: liczba(parsed.winter, WYMAGANIA_WODNE_DOMYSLNE.winter),
      spring: liczba(parsed.spring, WYMAGANIA_WODNE_DOMYSLNE.spring),
      summer: liczba(parsed.summer, WYMAGANIA_WODNE_DOMYSLNE.summer),
      autumn: liczba(parsed.autumn, WYMAGANIA_WODNE_DOMYSLNE.autumn),
    };
  } catch {
    return WYMAGANIA_WODNE_DOMYSLNE;
  }
}

/**
 * Tryb przestrzeni odczytany z bazy.
 *
 * Kolumna jest `String` (C-12 — zero enumów Prisma), więc może zawierać wartość spoza unii:
 * po zmianie nazwy trybu, po ręcznej edycji w `psql`, po imporcie. Zapasem jest **mieszkanie**,
 * czyli tryb najbardziej zachowawczy — pokazuje najmniej pól, więc nieznana wartość nie odsłania
 * niczego, czego użytkownik nie zamawiał.
 */
export function trybLubDomyslny(kind: string | null | undefined): TrybPrzestrzeni {
  return TRYBY_PRZESTRZENI.includes(kind as TrybPrzestrzeni) ? (kind as TrybPrzestrzeni) : "home";
}
