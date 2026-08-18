/**
 * 089 (zadania 34–38, Faza 7) — JĘZYKI, KTÓRE APLIKACJA ZNA.
 *
 * Plik bez zależności (bez bazy, bez Reacta), żeby mógł go czytać zarówno serwer, jak i klient,
 * i żeby dało się go sprawdzić testem bez uruchamiania czegokolwiek.
 *
 * **Dlaczego lista jest zamknięta.** `locale` w bazie to zwykły tekst (C-12), ale wartość stamtąd
 * trafia do `Intl` i do nazwy pliku z tłumaczeniami. Nieznany kod języka dałby albo wyjątek przy
 * formatowaniu, albo próbę wczytania pliku, którego nie ma — i jedno, i drugie w miejscu, w którym
 * użytkownik chciał tylko zobaczyć swoją listę zakupów. Nieznany kod **degraduje się do polskiego**,
 * a nie wywraca strony.
 *
 * **Dziś język jest jeden i to jest w porządku.** Rozdz. 12.1 mówi wprost, że tłumaczenia na inne
 * języki NIE wchodzą w zakres tej fazy — wchodzi możliwość ich dodania bez programisty. Sygnał
 * kontrolny brzmi: „dodanie języka to praca tłumacza". Ten plik jest miejscem, w którym tłumacz
 * dopisuje jedną linię.
 */
export const JEZYKI = ["pl"] as const;
export type Jezyk = (typeof JEZYKI)[number];

export const JEZYK_DOMYSLNY: Jezyk = "pl";
export const STREFA_DOMYSLNA = "Europe/Warsaw";

/** Nazwa języka w NIM SAMYM — tak, jak wybiera się język w każdym poważnym interfejsie. */
export const NAZWY_JEZYKOW: Record<Jezyk, string> = {
  pl: "Polski",
};

export function czyJezyk(v: string | null | undefined): v is Jezyk {
  return typeof v === "string" && (JEZYKI as readonly string[]).includes(v);
}

/** Nieznany albo brakujący kod → polski. Nigdy wyjątek. */
export function jezykLubDomyslny(v: string | null | undefined): Jezyk {
  return czyJezyk(v) ? v : JEZYK_DOMYSLNY;
}

/**
 * Strefa czasowa: sprawdzamy przez `Intl`, bo lista stref jest własnością środowiska, nie nasza.
 * Wpisanie własnej listy IANA znaczyłoby utrzymywanie kopii bazy tz — z pewnością nieaktualnej.
 */
export function strefaLubDomyslna(v: string | null | undefined): string {
  if (!v) return STREFA_DOMYSLNA;
  try {
    new Intl.DateTimeFormat("pl", { timeZone: v });
    return v;
  } catch {
    return STREFA_DOMYSLNA;
  }
}
