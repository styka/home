import type { ResourceRole, WorkspaceMemberRole } from "@/platform/workspaces/types";

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
 * **Szew pod zadanie 11 zadziałał tak, jak zapowiadał ten komentarz w 052:** doszło **jedno pole**
 * (`workspaceId`), a w `access.ts` zmienił się **jeden krok** rozstrzygania. Reszta — łańcuch
 * rodziców, nadania jednym zapytaniem, cache — została bez zmian. Gdyby platforma pytała moduł
 * wprost „czy ten user ma dostęp", nie dałoby się tego podmienić w jednym miejscu, bo każdy moduł
 * odpowiadałby po swojemu.
 */
export interface ResourceFacts {
  /**
   * 056 (etap 3A) — **podstawowy fakt o własności**: przestrzeń, w której zasób żyje.
   *
   * 079 (etap 4): od usunięcia kolumn własnościowych to jest **jedyny** nośnik własności dla
   * zasobu, który przestrzeń ma. Opcjonalne zostaje z jednego, trwałego powodu: zasób
   * o własności **wyprowadzonej** tej kolumny nie ma i mieć nie będzie (`Task` — własność idzie
   * przez `createdById` albo przez projekt, więc nie było tam `ownerId` i migracja 0227 go nie
   * objęła). Drugi dawny powód — **sierota** po backfillu — zniknął razem z zaostrzeniem
   * `workspaceId` do NOT NULL w 0235.
   */
  workspaceId?: string | null;
  /**
   * WŁAŚCICIEL OSOBISTY zasobu, którego własność jest **wyprowadzona** — nie odczyt kolumny.
   *
   * 079: pole przestało być odbiciem kolumny `ownerId` (etap 4 usunął ją z 40 tabel) i jest
   * odtąd wyłącznie tym, czym zawsze było w zamyśle: **faktem, który moduł potrafi podać, choć
   * nie stoi on nigdzie w bazie**. Jedyny dzisiejszy użytkownik to zadanie bez projektu, gdzie
   * właścicielem jest twórca (`Task.createdById`).
   *
   * **Czego to pole NIE jest już siatką.** Do 078 podawały je wszystkie deklaracje i ratowało
   * dostęp właściciela, gdy przestrzeni zasobu nie było w jego kontekście (brak wiersza
   * `WorkspaceMember` — 056/075). Ta ochrona przeniosła się do `getAccessContext`, które czyta
   * przestrzeń osobistą po `Workspace.personalUserId`. Podawanie tu `ownerId` „dla pewności"
   * obok `workspaceId` nic nie doda, a zakłamie fakty o zasobie.
   */
  ownerId?: string | null;
  /**
   * 064 — zasób OTWARTY: rola, którą dostaje **każda zalogowana osoba**, niezależnie od relacji.
   *
   * Istnieje, bo dostępu „publiczny przepis" nie wyraża ani własność, ani nadanie per-osoba —
   * a bez tego pola moduł Kuchnia musiałby zostać przy własnym guardzie i zadanie 13 nie dałoby
   * się domknąć. Rozdz. 8.4 przewiduje pokrewne pojęcie (`subjectType: "link"`); tamto wymaga
   * wiersza nadania na zasób, to jest własnością samego zasobu.
   *
   * **Nazwa mówi o ROLI, nie o fladze** (`publicRole`, nie `isPublic`): platforma nie wie, skąd
   * moduł ją bierze, i nie ma wiedzieć. Kuchnia wyprowadza ją z kolumny `isPublic`, ale inny
   * moduł może z czegokolwiek innego.
   */
  publicRole?: ResourceRole | null;
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
  /**
   * Co daje WŁASNOŚĆ ZESPOŁOWA zasobu — czyli to, że jego przestrzeń jest przestrzenią zespołu
   * (do 079 czytane z kolumny `ownerTeamId`). Pole jest **opcjonalne i domyślnie puste**,
   * bo nie każdy moduł dziś ją honoruje — a milczące przyznanie dostępu na podstawie samej kolumny
   * byłoby poszerzeniem uprawnień bez decyzji (052/AC-5). Moduł, który chce ją uznawać, musi
   * powiedzieć to wprost i podać stopniowanie.
   */
  teamOwnership?: { member: ResourceRole; admin: ResourceRole };
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
  /** Podzbiór `teamIds`, w których użytkownik jest właścicielem albo adminem — daje wyższą rolę. */
  adminTeamIds: string[];
  workspaceIds: string[];
  /**
   * 056: MOJA przestrzeń osobista. `facts.workspaceId` równy tej wartości znaczy „mój zasób" —
   * odpowiednik dzisiejszego `facts.ownerId === userId`.
   */
  personalWorkspaceId: string | null;
  /**
   * 056: moja rola w każdej przestrzeni, której jestem członkiem. Czytane **tym samym** zapytaniem,
   * co `workspaceIds` — sprawdzenie dostępu nie może kosztować dodatkowej rundy do bazy.
   */
  workspaceRoles: Record<string, WorkspaceMemberRole>;
}

/** Komunikat odmowy. Ten sam tekst, co dotychczasowe guardy — użytkownik nie ma zauważyć zmiany. */
export const ACCESS_DENIED = "Access denied";
