/**
 * 111: PAMIĘĆ POZYCJI PRZEWIJANIA — czysta logika listy plus jej pamięć w przeglądarce.
 *
 * Zgłoszenie właściciela: „gdy cofam na poprzednią stronę, to jeśli byłem na tej stronie
 * zescrolowany, nie wraca do tego miejsca, tylko pokazuje stronę od samej góry".
 *
 * **Dlaczego przeglądarka sama tego nie robi.** Bo w Omnii nie przewija się okno. Rama widoku
 * (`ModuleView`) trzyma treść we WŁASNYM kontenerze z `overflow-y: auto` — to on ma pozycję
 * przewijania, a `<main>` powyżej ma `overflow: hidden`. Przywracanie pozycji przez przeglądarkę
 * i przez Next dotyczy okna, więc dla tego kontenera po prostu nie istnieje. Nic w aplikacji nie
 * zapisywało jego pozycji, więc nie było czego przywracać.
 *
 * Trzy decyzje, które warto znać, zanim się tu coś zmieni — te same, co przy historii nawigacji
 * (`historia.ts`), i z tych samych powodów:
 *
 * 1. **To nie jest tabela w bazie i nie powinno nią zostać.** Zapis szedłby przy każdym zdarzeniu
 *    przewijania — najczęstszym, jakie w ogóle zachodzi w aplikacji — dla danych, które tracą sens
 *    razem z zamkniętą kartą.
 * 2. **Przywracamy WYŁĄCZNIE przy powrocie w historii.** Wejście z odnośnika ma pokazać górę
 *    strony; przywracanie pozycji przy każdej nawigacji byłoby usterką, nie funkcją.
 * 3. **Brak pamięci jest stanem POPRAWNYM, nie błędem.** `sessionStorage` rzuca w prywatnym oknie
 *    części przeglądarek, przy zablokowanych danych witryn i przy zrzucie miniatury. Przywracanie
 *    pozycji jest wygodą; wyjątek stąd wywróciłby ramę widoku, czyli każdą stronę naraz.
 */

export interface PozycjaPrzewijania {
  /** Pełny adres wewnętrzny (ze stanem widoku w `?query`) — pozycja należy do konkretnego widoku. */
  sciezka: string;
  /** Odległość od góry kontenera w pikselach. */
  y: number;
}

/**
 * Ile pozycji pamiętamy. Dwanaście, tyle co historia nawigacji — dalej wstecz i tak nikt nie wraca
 * jednym gestem, a lista rosnąca bez granicy przestaje być pamięcią podręczną.
 */
export const LIMIT_POZYCJI = 12;

const KLUCZ = "omnia.pozycjePrzewijania";

/**
 * Poniżej tylu pikseli nie ma czego pamiętać.
 *
 * Zapisywanie zera dla każdej odwiedzonej strony zapełniłoby listę wpisami, które nic nie znaczą,
 * i wypchnęłoby z niej te, po które użytkownik faktycznie wraca.
 */
const PROG_ZAPISU = 40;

/** Dopisuje pozycję, awansując ją na początek listy. Zero (albo prawie zero) usuwa wpis. */
export function zapamietajW(
  lista: PozycjaPrzewijania[],
  sciezka: string,
  y: number,
  limit: number = LIMIT_POZYCJI,
): PozycjaPrzewijania[] {
  const bez = lista.filter((w) => w.sciezka !== sciezka);
  if (y < PROG_ZAPISU) return bez;
  return [{ sciezka, y }, ...bez].slice(0, Math.max(0, limit));
}

/** Odczyt z pamięci sesji. Brak pamięci, uszkodzony wpis albo obcy kształt → pusta lista. */
export function odczytajPozycje(): PozycjaPrzewijania[] {
  try {
    const surowe = window.sessionStorage.getItem(KLUCZ);
    if (!surowe) return [];
    const dane: unknown = JSON.parse(surowe);
    if (!Array.isArray(dane)) return [];
    return dane.filter(czyPozycja).slice(0, LIMIT_POZYCJI);
  } catch {
    return [];
  }
}

/** Zapis do pamięci sesji. Cisza przy niepowodzeniu — patrz decyzja 3 w nagłówku pliku. */
export function zapiszPozycje(lista: PozycjaPrzewijania[]): void {
  try {
    window.sessionStorage.setItem(KLUCZ, JSON.stringify(lista.slice(0, LIMIT_POZYCJI)));
  } catch {
    // Pamięć niedostępna albo pełna — pozycja zostaje tylko na czas tej strony.
  }
}

/** Zapamiętuje pozycję bieżącego widoku (odczyt + dopisanie + zapis w jednym kroku). */
export function zapamietaj(sciezka: string, y: number): void {
  zapiszPozycje(zapamietajW(odczytajPozycje(), sciezka, y));
}

/** Zapamiętana pozycja tego widoku albo `null`, gdy nic o nim nie wiemy. */
export function pozycjaDla(sciezka: string): number | null {
  const wpis = odczytajPozycje().find((w) => w.sciezka === sciezka);
  return wpis ? wpis.y : null;
}

/**
 * FLAGA POWROTU — jedyna rzecz, która odróżnia „cofnąłem się" od „wszedłem z odnośnika".
 *
 * Nie da się jej wyczytać ze stanu Reacta ani z adresu: `popstate` jest jedynym momentem, w którym
 * przeglądarka mówi wprost, że to nawigacja w historii. Flaga jest **jednorazowa** — zużywa ją
 * najbliższe przywrócenie. Gdyby została zapalona, każde kolejne wejście na tę ścieżkę (z menu,
 * z odnośnika) przywracałoby pozycję, czyli dokładnie to, czego nie chcemy.
 *
 * Trzymamy ją w module, a nie w `sessionStorage`: dotyczy jednego przejścia, nie sesji.
 */
let powrot = false;

export function oznaczPowrot(): void {
  powrot = true;
}

/** Sprawdza i **zużywa** flagę powrotu. Drugie wywołanie z rzędu zwraca już `false`. */
export function zuzyjPowrot(): boolean {
  const byl = powrot;
  powrot = false;
  return byl;
}

/**
 * DRUGI RODZAJ POWROTU: taki, przy którym przeglądarka ŁADUJE DOKUMENT OD NOWA.
 *
 * `popstate` wyżej wyłapuje powrót wewnątrz jednego dokumentu — czyli nawigację po aplikacji
 * odnośnikami, najczęstszy przypadek. Ale gdy poprzednia strona weszła twardym wczytaniem (odświeżenie,
 * adres wklejony z paska, wejście z zewnątrz), cofnięcie tworzy **nowy dokument**: żaden `popstate` nie
 * pada, a moduł ładuje się od zera z opuszczoną flagą. Ten sam gest użytkownika, dwa różne mechanizmy —
 * i to jest dokładnie ta połowa, której brak wyszedł dopiero w klikaczu.
 *
 * Przeglądarka mówi to wprost przez Navigation Timing: `type === "back_forward"`. Czytamy to RAZ na
 * dokument (flaga poniżej), bo inaczej każde kolejne zamontowanie ramy w tym samym dokumencie —
 * np. przejście między modułami — uznałoby się za powrót.
 */
let powrotDokumentuSprawdzony = false;

export function zuzyjPowrotDokumentu(): boolean {
  if (powrotDokumentuSprawdzony) return false;
  powrotDokumentuSprawdzony = true;
  try {
    const wpis = window.performance?.getEntriesByType?.("navigation")?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    return wpis?.type === "back_forward";
  } catch {
    // Starsza przeglądarka albo zablokowane API pomiarów — brak informacji to nie powrót.
    return false;
  }
}

function czyPozycja(x: unknown): x is PozycjaPrzewijania {
  if (typeof x !== "object" || x === null) return false;
  const w = x as Record<string, unknown>;
  return typeof w.sciezka === "string" && typeof w.y === "number" && Number.isFinite(w.y);
}
