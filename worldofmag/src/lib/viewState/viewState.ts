// 043: stan widoku (filtry, zakładki, układ) zapisany w ADRESIE strony.
//
// Po co: właściciel chciał zapisywać w ulubionych „zadania projektu X w statusie Y", ale żaden
// moduł nie trzymał stanu widoku w adresie — filtry były zwykłym stanem komponentu, więc ulubione
// zapisywały gołą ścieżkę modułu i po powrocie widok był inny niż zapisany.
//
// Ten moduł jest czysto obliczeniowy (bez Reacta, bez Prismy) — hook `useViewState` dokłada do
// niego integrację z przeglądarką. Podział jest celowy: reguły kodowania da się przetestować
// i wywołać z serwera, a hooka nie.
//
// TRZY REGUŁY, każda z konkretnego powodu:
//
//  1. **Do adresu trafiają wyłącznie wartości RÓŻNE od domyślnej.** Inaczej adres puchłby od
//     parametrów przy pierwszym wejściu, a `/tasks` przestałoby wyglądać jak `/tasks`.
//  2. **Kolejność parametrów jest stabilna** (kolejność kluczy w specyfikacji). To warunek
//     konieczny dla ulubionych: `FavoriteView` ma `@@unique([ownerId, path])`, więc ten sam widok
//     zapisany dwa razy pod różną kolejnością parametrów byłby DWOMA wpisami.
//  3. **Niepoprawna wartość → wartość domyślna, nigdy wyjątek.** Adres jest wejściem użytkownika
//     i może zawierać cokolwiek.

/** Surowe parametry tak, jak dostaje je `page.tsx` z Next.js. */
export type RawParams = Record<string, string | string[] | undefined>;

// Metody, a nie właściwości-funkcje: składnia metody jest w TS **biwariantna**, dzięki czemu
// konkretny `ParamCodec<string>` daje się podstawić pod `ParamCodec<unknown>` w `ViewSpec`.
// Przy zapisie `parse: (raw) => T` TS odrzuciłby to na `strictFunctionTypes`.
export interface ParamCodec<T> {
  parse(raw: string | undefined): T;
  /** `null` = wartość domyślna → parametr NIE trafia do adresu. */
  serialize(value: T): string | null;
}

export type ViewSpec = Record<string, ParamCodec<unknown>>;

/** Wartości wyliczone ze specyfikacji — `useViewState` zwraca dokładnie ten kształt. */
export type ViewValues<S> = { [K in keyof S]: S[K] extends ParamCodec<infer T> ? T : never };

function firstValue(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * Wartość z zamkniętej listy (zakładka, układ, sortowanie).
 * Nieznana wartość w adresie → `fallback`, więc podmieniony ręcznie adres nie wywali widoku.
 */
export function oneOf<T extends string>(allowed: readonly T[], fallback: T): ParamCodec<T> {
  return {
    parse: (raw) => (raw !== undefined && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback),
    serialize: (value) => (value === fallback ? null : value),
  };
}

/** Dowolny tekst (szukajka). Domyślnie pusty — pusty tekst nie trafia do adresu. */
export function text(fallback = ""): ParamCodec<string> {
  return {
    parse: (raw) => (raw === undefined ? fallback : raw),
    serialize: (value) => (value === fallback ? null : value),
  };
}

/** Lista identyfikatorów rozdzielona przecinkami (np. wybrane tagi). Pusta lista = domyślna. */
export function idList(): ParamCodec<string[]> {
  return {
    parse: (raw) => (raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : []),
    serialize: (value) => (value.length === 0 ? null : value.join(",")),
  };
}

/** Przełącznik. W adresie zapisywany jako `1`/`0`, ale tylko gdy różny od domyślnego. */
export function flag(fallback: boolean): ParamCodec<boolean> {
  return {
    parse: (raw) => (raw === undefined ? fallback : raw === "1" || raw === "true"),
    serialize: (value) => (value === fallback ? null : value ? "1" : "0"),
  };
}

/** Odczyt stanu widoku z parametrów adresu. Brak parametrów = komplet wartości domyślnych (AC-8). */
export function parseViewParams<S extends ViewSpec>(spec: S, raw: RawParams): ViewValues<S> {
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(spec)) {
    const codec = spec[key];
    out[key] = codec.parse(firstValue(raw[key]));
  }
  return out as ViewValues<S>;
}

/**
 * Zapis stanu widoku do fragmentu zapytania (bez wiodącego `?`).
 * Kolejność wynika z kolejności kluczy w `spec` — patrz reguła 2 na górze pliku.
 */
export function buildViewQuery<S extends ViewSpec>(spec: S, values: ViewValues<S>): string {
  const parts: string[] = [];
  for (const key of Object.keys(spec)) {
    const codec = spec[key];
    const serialized = codec.serialize((values as Record<string, unknown>)[key]);
    if (serialized === null || serialized === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(serialized)}`);
  }
  return parts.join("&");
}

/**
 * Pełny adres widoku: ścieżka + ewentualne parametry. Bez parametrów zwraca samą ścieżkę,
 * więc „wejście gołe" i „wejście z domyślnymi ustawieniami" dają identyczny adres.
 */
export function buildViewUrl<S extends ViewSpec>(pathname: string, spec: S, values: ViewValues<S>): string {
  const query = buildViewQuery(spec, values);
  return query ? `${pathname}?${query}` : pathname;
}

/** Parametry z gotowego `URLSearchParams` (używane po `popstate`, gdzie nie ma propsa z serwera). */
export function rawParamsFromSearch(search: string): RawParams {
  const out: RawParams = {};
  const params = new URLSearchParams(search);
  params.forEach((value, key) => {
    if (out[key] === undefined) out[key] = value;
  });
  return out;
}
