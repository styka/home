/**
 * 081 (zadanie 26, Faza 5) — POLITYKI LIMITÓW.
 *
 * Osobny plik, bo to jedyna część limitera, która **nie dotyka bazy**: same liczby i komunikaty.
 * Dzięki temu „czy polityka jest sensowna" (okno godzinne nie mniejsze niż minutowe, komunikat po
 * polsku, dzierżawa dłuższa niż najdłuższa operacja) sprawdza test bez Postgresa, a bramka nie musi
 * czytać kodu wykonawczego.
 *
 * **Zakres, czyli po co to wyszło poza AI.** Rozdz. 11.2 wymienia cztery powierzchnie do objęcia
 * limitem: rejestrację, zaproszenia, nadania dostępu i wysyłkę e-maili. Dwie z nich w tym wdrożeniu
 * NIE ISTNIEJĄ i wpisanie ich tu byłoby atrapą:
 *   * rejestracja — jedynym logowaniem jest Google OAuth, konta zakłada dostawca tożsamości;
 *   * wysyłka e-maili — repozytorium nie ma ani jednego klienta pocztowego (zaproszenia są
 *     wewnątrzaplikacyjne, przez `TeamInvitation` i dzwonek).
 * Zostają zaproszenia i nadania — obie objęte niżej.
 */

export type Polityka = {
  /** Ile żądań w oknie minutowym. `null` = okno nieużywane. */
  naMinute: number | null;
  /** Ile żądań w oknie godzinnym. */
  naGodzine: number | null;
  /** Ile operacji tej klasy może TRWAĆ jednocześnie u jednego podmiotu. `null` = bez strażnika. */
  rownolegle: number | null;
  /**
   * Po ilu sekundach dzierżawa slotu wygasa sama. Musi być DŁUŻSZA niż najdłuższa operacja tej
   * klasy — inaczej limiter zwolniłby slot pod trwającą jeszcze pracą i strażnik przestałby cokolwiek
   * strzec. I krótsza niż cierpliwość użytkownika, bo tyle właśnie trwa blokada po awarii procesu.
   */
  dzierzawaSek: number;
  /** Komunikat po przekroczeniu okna minutowego. */
  komunikatMinuta: string;
  /** Komunikat po przekroczeniu okna godzinnego. */
  komunikatGodzina: string;
  /** Komunikat po zajęciu wszystkich slotów współbieżności. */
  komunikatSlot: string;
};

export const POLITYKI = {
  /** Pętla agenta — najdroższa operacja w aplikacji. Wartości przeniesione 1:1 z limitera w pamięci. */
  "ai.agent": {
    naMinute: 20,
    naGodzine: 250,
    rownolegle: 2,
    // Pojedyncza tura agenta z narzędziami potrafi trwać ~2 minuty; 5 minut daje zapas i nadal jest
    // krótsze niż czas, po którym użytkownik uzna aplikację za zepsutą.
    dzierzawaSek: 300,
    komunikatMinuta: "Za dużo zapytań do asystenta w krótkim czasie. Spróbuj za chwilę.",
    komunikatGodzina: "Wyczerpano godzinny limit zapytań do asystenta. Spróbuj później.",
    komunikatSlot: "Asystent przetwarza już Twoje poprzednie polecenie. Poczekaj na wynik.",
  },
  /** Serwerowa synteza mowy — ten sam budżet co reszta AI, bo płaci ten sam rachunek. */
  "ai.mowa": {
    naMinute: 20,
    naGodzine: 250,
    rownolegle: null,
    dzierzawaSek: 60,
    komunikatMinuta: "Za dużo zapytań do lektora w krótkim czasie. Spróbuj za chwilę.",
    komunikatGodzina: "Wyczerpano godzinny limit lektora. Spróbuj później.",
    komunikatSlot: "Lektor jest zajęty. Poczekaj chwilę.",
  },
  /**
   * Zaproszenia do zespołu. Limit nie chroni kosztu — chroni SKRZYNKĘ zapraszanego: bez niego jedno
   * konto może zasypać powiadomieniami dowolną liczbę osób.
   */
  zaproszenia: {
    naMinute: 5,
    naGodzine: 30,
    rownolegle: null,
    dzierzawaSek: 60,
    komunikatMinuta: "Za dużo zaproszeń w krótkim czasie. Spróbuj za chwilę.",
    komunikatGodzina: "Wyczerpano godzinny limit zaproszeń. Spróbuj później.",
    komunikatSlot: "Poprzednie zaproszenie jest jeszcze wysyłane.",
  },
  /**
   * Nadania dostępu do pojedynczego zasobu (`ResourceGrant`). Rozdz. 11.2 nazywa to wprost:
   * „ochrona przed masowym udostępnianiem". Polityka istnieje ZANIM powstanie strona zapisu
   * (zadanie 14) — świadomie, żeby wpięcie limitu było jedną linią, a nie osobną decyzją
   * podejmowaną w pośpiechu przy okazji nowej funkcji.
   */
  nadania: {
    naMinute: 10,
    naGodzine: 60,
    rownolegle: null,
    dzierzawaSek: 60,
    komunikatMinuta: "Za dużo zmian dostępu w krótkim czasie. Spróbuj za chwilę.",
    komunikatGodzina: "Wyczerpano godzinny limit zmian dostępu. Spróbuj później.",
    komunikatSlot: "Poprzednia zmiana dostępu jest jeszcze zapisywana.",
  },
} as const satisfies Record<string, Polityka>;

export type ZakresLimitu = keyof typeof POLITYKI;

/** Klucz wiersza w bazie. Rozdzielony dwukropkami, żeby dał się czytać w `psql` bez tłumacza. */
export function kluczOkna(zakres: ZakresLimitu, podmiot: string, okno: "min" | "godz"): string {
  return `${zakres}:${podmiot}:${okno}`;
}

export function kluczDzierzawy(zakres: ZakresLimitu, podmiot: string): string {
  return `${zakres}:${podmiot}`;
}
