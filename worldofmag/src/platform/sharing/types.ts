import type { ResourceRole } from "@/platform/workspaces/types";

/**
 * Faza 2 przebudowy, zadanie 10 — SŁOWNIK POJĘĆ SPRAWDZANIA DOSTĘPU (rozdz. 8.4 i 8.9).
 *
 * Zasada nadrzędna rozdz. 8.1: **udostępnianie jest zdolnością platformy, nie funkcją modułu.**
 * Moduł mówi tylko dwie rzeczy: **jakie ma typy zasobów** i **co jego operacje znaczą** w skali
 * czterech ról. Wszystko pozostałe — własność, nadania, dziedziczenie, kolejność rozstrzygania —
 * robi platforma.
 *
 * **Platforma nie zna żadnego modułu** (C-36). `type` zasobu jest zwykłym **tekstem**
 * (`"tasks.project"`), a nie odwołaniem do kodu modułu; katalog przychodzi **parametrem
 * wymaganym**, tak jak wkłady do `buildAiCatalog`.
 */

/** Wskazanie konkretnego zasobu. `type` to tekst z deklaracji modułu, nie odwołanie do kodu. */
export interface ResourceRef {
  type: string;
  id: string;
}

/**
 * Fakty o zasobie, na których platforma opiera decyzję.
 *
 * **To jest SZEW POD ZADANIE 11.** Dziś własność opisuje para `ownerId`/`ownerTeamId`, bo tak
 * wygląda model przejściowy. Gdy zadanie 11 doda `workspaceId` do 46 modeli, dojdzie tu **jedno
 * pole**, a w `access.ts` zmieni się **jeden krok** rozstrzygania — reszta zostaje. Gdyby zamiast
 * tego platforma pytała moduł wprost „czy ten user ma dostęp", nie dałoby się tego podmienić
 * w jednym miejscu, bo każdy moduł odpowiadałby po swojemu.
 */
export interface ResourceFacts {
  ownerId: string | null;
  ownerTeamId: string | null;
  /** Zasób nadrzędny — stąd bierze się dziedziczenie, bez pisania go w module. */
  parent?: ResourceRef;
}

/**
 * Deklaracja JEDNEGO typu zasobu. Moduł **nie definiuje własnych ról** — mapuje swoje operacje
 * na cztery role z rozdz. 8.4.
 */
export interface ResourceDeclaration {
  /** Nazwa dla człowieka (UI udostępniania, audyt). Po polsku (C-32). */
  label: string;
  /** Operacja modułu → minimalna rola, która ją dopuszcza. */
  operations: Record<string, ResourceRole>;
  /** Typy zasobów dziedziczących po tym (projekt → zadanie). Dokumentacyjne i dla przyszłego UI. */
  children?: string[];
  /** Fakty o zasobie; `null` = zasób nie istnieje (wtedy odmowa, nie wyjątek Prismy). */
  resolve: (id: string) => Promise<ResourceFacts | null>;
  /**
   * Dostępy, których nie da się wyrazić własnością ani nadaniem — np. **osoba przypisana** do
   * zadania bez projektu.
   *
   * Pole istnieje, bo alternatywą było zwracanie w `ownerId` kogoś, kto właścicielem nie jest,
   * żeby wynik „wyszedł". To zakłamywałoby fakty o zasobie i pierwszy audyt „kto jest
   * właścicielem" pokazałby nieprawdę. Lepiej mieć wyjątek nazwany wprost niż ukryty
   * w interpretacji innego pola.
   */
  extraGrants?: (id: string) => Promise<{ userId: string; role: ResourceRole }[]>;
}

/** Katalog wszystkich typów zasobów w aplikacji — składany przez korzeń kompozycji. */
export type ResourceCatalog = Record<string, ResourceDeclaration>;

/**
 * Kontekst użytkownika przygotowany **raz na żądanie**. Bez tego każde sprawdzenie liczyłoby
 * zespoły i przestrzenie od nowa.
 */
export interface AccessContext {
  teamIds: string[];
  workspaceIds: string[];
}

/** Komunikat odmowy. Ten sam tekst, co dotychczasowe guardy — użytkownik nie ma zauważyć zmiany. */
export const ACCESS_DENIED = "Access denied";
