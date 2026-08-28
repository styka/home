import type { TrybPrzestrzeni } from "./typy";

/**
 * 113 — CO TRYB PRZESTRZENI ROBI Z INTERFEJSEM.
 *
 * **Reguła jest jedna i cała zawiera się w nazwie funkcji: tryb CHOWA DOMYŚLNIE, nigdy nie
 * blokuje** (AC-2 i AC-3 razem). To nie jest drobiazg implementacyjny, tylko rozstrzygnięcie
 * produktowe z `badania.md` §2: tryb, który *blokuje*, zmusza użytkownika do zakładania drugiej
 * przestrzeni po to, żeby raz wpisać pH. Tryb, który *domyślnie chowa*, kosztuje jedno kliknięcie
 * „pokaż zaawansowane".
 *
 * **Dlaczego tryb siedzi na przestrzeni, a nie na koncie.** Magazyn i Warsztaty mają Dom/Pro na
 * użytkownika i dla nich to wystarcza. Tutaj nie: kwiaciarnia i parapet w mieszkaniu istnieją
 * JEDNOCZEŚNIE w tym samym koncie (właściciel podał to wprost jako wymaganie). Ustawienie konta
 * musiałoby więc albo zasypać parapet parametrami, albo odebrać kwiaciarni to, czego potrzebuje.
 *
 * Funkcje są czyste i mają test — dzięki temu AC-2 da się zweryfikować tabelą, a nie klikaniem.
 */

/**
 * Pola, których widoczność zależy od trybu. Lista jest zamknięta celowo: gdyby była otwartym
 * `string`, literówka w nazwie pola dawałaby ciche „niewidoczne", czyli funkcję zniknięcia pola
 * bez śladu w kodzie.
 */
export type PoleZaawansowane =
  | "faza" // kod fazy rozwojowej (BBCH)
  | "licznosc" // liczba sztuk / powierzchnia — poza mieszkaniem, gdzie zawsze jest 1 szt.
  | "powierzchnia" // powierzchnia miejsca
  | "ewidencja" // rejestr zabiegów środkami ochrony roślin
  | "kosztJednostkowy"
  | "gleba"
  | "parametryChemiczne"; // pH, EC — segment hobby ma ZEROWĄ tolerancję na te pola

/**
 * Które pola tryb pokazuje **domyślnie**. Wszystkie pozostałe są dostępne po „pokaż zaawansowane" —
 * ta mapa nie mówi nic o dostępie.
 */
const DOMYSLNIE_WIDOCZNE: Record<TrybPrzestrzeni, PoleZaawansowane[]> = {
  // Mieszkanie: nic zaawansowanego. To jedyny segment o zerowej tolerancji na parametry.
  home: [],
  // Ogród: gleba i powierzchnia grządki mają sens; ewidencja i koszty jeszcze nie.
  garden: ["gleba", "powierzchnia"],
  // Produkcja: partia, faza i koszt jednostkowy to codzienność; ewidencja bywa wymagana.
  production: ["licznosc", "faza", "kosztJednostkowy", "gleba", "ewidencja"],
  // Pole: wszystko. Ewidencja zabiegów jest tu obowiązkiem prawnym, nie opcją.
  field: [
    "licznosc",
    "faza",
    "powierzchnia",
    "ewidencja",
    "kosztJednostkowy",
    "gleba",
    "parametryChemiczne",
  ],
};

/**
 * Czy pole ma być widoczne **bez** rozwijania sekcji zaawansowanej.
 *
 * `pokazZaawansowane` to stan przełącznika w widoku. Gdy jest włączony, funkcja zwraca `true`
 * dla każdego pola — i to jest cała treść reguły „tryb nie odbiera funkcji".
 */
export function poleWidoczne(
  tryb: TrybPrzestrzeni,
  pole: PoleZaawansowane,
  pokazZaawansowane = false,
): boolean {
  if (pokazZaawansowane) return true;
  return DOMYSLNIE_WIDOCZNE[tryb].includes(pole);
}

/**
 * Czy w tym trybie w ogóle proponujemy użytkownikowi ewidencję zabiegów.
 *
 * To JEDYNE miejsce, w którym tryb decyduje o czymś więcej niż widoczność: widok ewidencji nie
 * pokazuje przestrzeni domowych, bo obowiązek dotyczy profesjonalnych użytkowników środków ochrony
 * roślin. Nie jest to jednak blokada zapisu — zdarzenie z wypełnionymi polami zapisze się w każdej
 * przestrzeni; chodzi o to, żeby nie proponować parapetowi numeru zezwolenia.
 */
export function trybZawodowy(tryb: TrybPrzestrzeni): boolean {
  return tryb === "production" || tryb === "field";
}

/**
 * Jednostka liczności proponowana domyślnie przy dodawaniu rośliny.
 * Mieszkanie i ogród liczą sztuki, pole — hektary. Produkcja liczy sztuki, bo partia to nadal
 * sztuki, tylko dużo.
 */
export function domyslnaJednostka(tryb: TrybPrzestrzeni): "szt" | "ha" {
  return tryb === "field" ? "ha" : "szt";
}
