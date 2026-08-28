/**
 * 113 — SŁOWNIK POJĘĆ MODUŁU ROŚLINY.
 *
 * Wszystko tutaj to `String` + zawężający union TypeScript — **nigdy enum Prisma** (C-12).
 * Ten plik nie importuje ani Prismy, ani Reacta: czytają go zarówno akcje serwerowe, jak i widoki,
 * a także testy reguł domenowych.
 *
 * Trzy rozstrzygnięcia, które widać dopiero w unii i które łatwo cofnąć przez nieuwagę:
 *
 *  1. **`JednostkaLicznosci` istnieje, bo roślina to JEDEN byt w trzech skalach.** Mieszkaniec ma
 *     egzemplarz (`szt`), kwiaciarnia partię (`szt`, ale sto), rolnik powierzchnię (`ha`). Osobne
 *     tabele dla tych trzech przypadków są kuszące i błędne — wtedy ewidencja zabiegów, oś czasu
 *     i agenda opieki musiałyby scalać trzy źródła w kodzie (patrz `badania.md`, poziom 1).
 *  2. **`RodzajZabiegu` jest wspólny dla podlania i dla oprysku.** To ta sama unia dla parapetu
 *     i dla pola; różnicę robi wypełnienie pól ewidencyjnych, nie inny rodzaj bytu.
 *  3. **`PewnoscDiagnozy` ma wariant `unknown`, i to jest wymóg produktowy, nie wygoda typów.**
 *     Model, który zawsze nazywa chorobę, doprowadzi do opryskania zdrowej rośliny (AC-19).
 */

/** Tryb przestrzeni roślinnej. Steruje DOMYŚLNĄ widocznością pól — nigdy dostępem (AC-2, AC-3). */
export type TrybPrzestrzeni = "home" | "garden" | "production" | "field";

export const TRYBY_PRZESTRZENI: TrybPrzestrzeni[] = ["home", "garden", "production", "field"];

/** Czy w tym trybie w ogóle mówimy o ewidencji zabiegów i kosztach produkcji. */
export const TRYBY_ZAWODOWE: TrybPrzestrzeni[] = ["production", "field"];

/**
 * Miejsce w przestrzeni. Jedno pojęcie w czterech skalach — od parapetu po pole.
 * Skala jest cechą miejsca, nie osobnym bytem: to miejsce niesie nasłonecznienie, glebę
 * i powierzchnię, i to ono ma historię („co tu rosło"), z której liczy się płodozmian.
 */
export type RodzajMiejsca =
  | "windowsill"
  | "room"
  | "balcony"
  | "greenhouse"
  | "bed"
  | "zone"
  | "sector"
  | "field";

export type Naslonecznienie = "full" | "partial" | "shade" | "unknown";

/**
 * Lista do wyboru w interfejsie. Wyprowadzona obok typu, bo unia z `String`+union (C-12) nie da się
 * wyliczyć w czasie wykonania — a przepisana ręcznie w widoku rozjechałaby się przy pierwszej zmianie.
 */
export const NASLONECZNIENIA: Naslonecznienie[] = ["full", "partial", "shade", "unknown"];

export type JednostkaLicznosci = "szt" | "m2" | "ha";

/**
 * Cykl życia bytu roślinnego. `DEAD` **nie jest** stanem do ukrycia — razem z `statusReason`
 * jest najcenniejszą daną zwrotną, jaką moduł zbiera („co mi się nie udaje", `badania.md` poziom 3).
 */
export type StatusRosliny = "ACTIVE" | "SOLD" | "HARVESTED" | "DEAD" | "ARCHIVED";

/** Stany, które znikają z listy aktywnych, ale zostają w historii miejsca i w statystykach. */
export const STATUSY_ZAKONCZONE: StatusRosliny[] = ["SOLD", "HARVESTED", "DEAD", "ARCHIVED"];

export type RodzajZabiegu =
  | "WATERING"
  | "FERTILIZING"
  | "PRUNING"
  | "REPOTTING"
  | "SPRAYING"
  | "MULCHING"
  | "SOWING"
  | "HARVEST"
  | "CUSTOM";

/** Lista do wyboru w interfejsie — unii `String`+union (C-12) nie da się wyliczyć w czasie wykonania. */
export const RODZAJE_ZABIEGOW: RodzajZabiegu[] = [
  "WATERING",
  "FERTILIZING",
  "PRUNING",
  "REPOTTING",
  "SPRAYING",
  "MULCHING",
  "SOWING",
  "HARVEST",
  "CUSTOM",
];

/**
 * Wynik zaplanowanego zabiegu. `SKIPPED` i `POSTPONED` istnieją, bo harmonogram, którego nie da się
 * odłożyć, po tygodniu pokazuje wyłącznie zaległości i przestaje być czytany (AC-10).
 */
export type WynikZabiegu = "DONE" | "SKIPPED" | "POSTPONED";

export type RodzajPomiaru =
  | "HEIGHT_CM"
  | "LEAF_COUNT"
  | "TRUNK_CM"
  | "SOIL_MOISTURE"
  | "TEMP_C"
  | "PH"
  | "LIGHT"
  | "OTHER";

/**
 * Skąd wziął się pomiar. Dziś zawsze `manual`; pole istnieje od początku, żeby etap 2 (sensory)
 * był dopisaniem wierszy do TEJ SAMEJ tabeli, a nie migracją (spec §5).
 */
export type ZrodloPomiaru = "manual" | "sensor";

export type PewnoscDiagnozy = "low" | "medium" | "high" | "unknown";

export type ZrodloZdarzeniaZdrowia = "ai" | "manual";

export type WynikLeczenia = "helped" | "no_change" | "worse";

/**
 * Skąd pochodzi wiersz gatunku w przestrzeni użytkownika. Bez tego pola po pół roku nikt nie odróżni
 * faktu botanicznego od treści, którą zaproponował model i ktoś kliknął „zapisz" (AC-17;
 * ta sama lekcja co `UserFact.origin`).
 */
export type PochodzenieGatunku = "system" | "user" | "ai";

export type KategoriaGatunku =
  | "houseplant"
  | "vegetable"
  | "herb"
  | "fruit"
  | "cereal"
  | "ornamental"
  | "other";

/** Pora roku — wejście reguły terminu podlewania. Liczona z daty, nie przechowywana. */
export type PoraRoku = "winter" | "spring" | "summer" | "autumn";

/**
 * Wymagania pielęgnacyjne gatunku, przechowywane jako JSON w kolumnie `waterJson`.
 * Interwał podlewania jest **czterema liczbami, nie jedną** — „podlewaj co 7 dni" jest w styczniu
 * szkodliwe (zalanie), a w lipcu spóźnione. To jest ustalenie z przeglądu rynku (`badania.md` §4).
 */
export interface WymaganiaWodne {
  /** Bazowy odstęp w dniach dla każdej pory roku. */
  winter: number;
  spring: number;
  summer: number;
  autumn: number;
}

export const WYMAGANIA_WODNE_DOMYSLNE: WymaganiaWodne = {
  winter: 14,
  spring: 7,
  summer: 5,
  autumn: 10,
};
