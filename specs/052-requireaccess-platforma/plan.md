# Plan techniczny: `requireAccess` — sprawdzanie dostępu jako zdolność platformy

- **Spec:** ./spec.md (052-requireaccess-platforma)
- **Status:** draft
- **Data:** 2026-08-12

> **Zasada planu:** to jest **JAK**.

## 1. Podejście

Platforma dostaje jedną funkcję odpowiadającą „czy wolno", która **nie zna żadnego modułu** —
wiedzę o zasobach bierze **parametrem wymaganym**, dokładnie jak `buildAiCatalog`. Moduł opisuje
swoje zasoby w jednym pliku (`src/modules/<x>/sharing.ts`), a korzeń kompozycji je zbiera. Wzorcem
jest **051/`platform/workspaces` + 050/`dashboardContributors`**: zdolność w platformie, wkłady
w modułach, per-troskowy korzeń kompozycji, bramka pilnująca wpięcia w obie strony.

Pilotem są **Zadania**, a przełączenie następuje **dopiero po** zbudowaniu tabeli prawdy — to ta
sama kolejność, która w 050 uratowała migawkę pulpitu i która tutaj jest ważniejsza, bo mówimy
o kontroli dostępu.

## 2. Model danych (Prisma)

**Bez zmian w schemacie i bez migracji.** Wszystko, czego trzeba, powstało w 051: `ResourceGrant`
(z indeksami „co mi udostępniono" i „komu udostępniłem to") oraz słownik czterech ról
w `platform/workspaces/types.ts`. Ten przebieg daje tym tabelom **pierwszego czytelnika**, nie
nowe kolumny.

## 3. Warstwa serwera

### 3.1. Platforma — `src/platform/sharing/`

- **`types.ts`**
  - `ResourceRef = { type: string; id: string }` — `type` jest **tekstem** (`"tasks.project"`),
    nigdy odwołaniem do modułu (C-36).
  - `ResourceDeclaration` — `{ label, operations: Record<string, ResourceRole>, children?: string[],
    resolve: (id) => Promise<ResourceFacts | null> }`.
  - `ResourceFacts = { ownerId: string | null; ownerTeamId: string | null; parent?: ResourceRef }` —
    **to jest szew pod zadanie 11**: dziś fakty o właścicielu to para `ownerId`/`ownerTeamId`,
    docelowo dojdzie `workspaceId`. Zadanie 11 dokłada pole i zmienia **jeden krok** decyzji, a nie
    całą funkcję.
  - `ResourceCatalog = Record<string, ResourceDeclaration>`.
- **`access.ts`**
  - `canAccess(userId, ref, operation, katalog, ctx): Promise<boolean>`
  - `requireAccess(userId, ref, operation, katalog, ctx): Promise<void>` — rzuca `Error("Access denied")`,
    **tym samym komunikatem co dzisiejsze guardy** (AC-10: te same odmowy).
  - `ctx = { teamIds, workspaceIds }` — przygotowane raz na żądanie.
  - **Kolejność rozstrzygania** (od najtańszego):
    1. **właściciel** — `facts.ownerId === userId` → `manager`, **zero dodatkowych zapytań**;
    2. **własność zespołowa** — `facts.ownerTeamId ∈ ctx.teamIds` → rola z deklaracji modułu
       (patrz §3.3: dla Zadań **wyłączona**, żeby nie poszerzyć dostępu — AC-5);
    3. **nadania** — jedno zapytanie po `ResourceGrant` dla **całego łańcucha** (zasób + przodkowie),
       `OR` po parach `(resourceType, resourceId)`, podmiot = użytkownik lub jego przestrzeń;
    4. **dziedziczenie po rodzicu** — gdy `facts.parent` istnieje, rekurencja po łańcuchu; łańcuch
       jest zbierany **przed** zapytaniem o nadania, więc nadania czyta się raz (AC-8).
  - Wynik: najwyższa rola z powyższych, porównana z rolą wymaganą przez operację
    (`resourceRoleAtLeast` z `platform/workspaces/types.ts` — słownik już istnieje, nie dublujemy).
- **`cache.ts`** — memoizacja `React.cache` na dwóch odczytach: fakty o zasobie i nadania dla
  łańcucha. `React.cache` żyje **tyle, co żądanie** i to jest dokładnie zakres z rozdz. 8.9 pkt 2.
  Poza kontekstem żądania (skrypt, zadanie w tle) degraduje się do zwykłego wywołania — bez błędu.

### 3.2. Korzeń kompozycji — `src/lib/sharingResources.ts` + `src/lib/sharing.ts`

- `sharingResources.ts` — mapa `id modułu → () => import("@/modules/<x>/sharing")`, **własny korzeń
  per troska**, nie pole w `module.server.ts`. Powód jest zmierzony w 050: wspólny obiekt leniwych
  loaderów to plik zbiorczy, więc import dla jednej troski płaci grafem za wszystkie.
- `sharing.ts` — funkcja aplikacyjna `requireAccess(userId, ref, operation)`, która **dostarcza
  katalog** i kontekst. To jest odpowiednik `src/lib/pathPermissions.ts`: platforma daje mechanizm,
  korzeń podaje wiedzę, moduły wołają wersję aplikacyjną.

### 3.3. Moduł pilotażowy — `src/modules/tasks/sharing.ts`

Dwa typy zasobów, mapowanie operacji na cztery role:

| Typ | Operacja | Rola minimalna |
|---|---|---|
| `tasks.project` | `project.read` | `viewer` |
| `tasks.project` | `task.create`, `task.edit`, `task.delete` | `editor` |
| `tasks.project` | `project.rename`, `project.delete`, `project.share` | `manager` |
| `tasks.task` | `task.read` | `viewer` |
| `tasks.task` | `task.edit`, `task.delete` | `editor` |

`children: ["tasks.task"]` na projekcie; `resolve` zadania zwraca `parent: { type: "tasks.project",
id }` — **dziedziczenie przestaje być kodem modułu** (dziś to ręczne `if (task.projectId)`
w `assertTaskAccess`).

Odwzorowanie dzisiejszych ról (`TaskProjectMember`): `OWNER`/`ADMIN` → `manager`, `MEMBER` →
`editor`. Właściciel projektu (`ownerId`) → `manager`.

> **DECYZJA, KTÓRA JEST ZMIANĄ ZACHOWANIA, GDYBY JEJ NIE PODJĄĆ (AC-5).**
> `TaskProject` **ma** kolumnę `ownerTeamId`, ale **ani dzisiejszy guard zapisu**
> (`assertProjectAccess`), **ani ścieżka odczytu** (`accessibleProjectIds` w read-toolach) jej nie
> uwzględniają — obie sprawdzają wyłącznie `ownerId` i `TaskProjectMember`. Krok 2 z §3.1 jest więc
> dla Zadań **wyłączony**: deklaracja nie mapuje własności zespołowej na żadną rolę. Włączenie go
> „bo tak jest logiczniej" **dałoby członkom zespołu dostęp, którego dziś nie mają** — czyli
> poszerzenie uprawnień ukryte w przebudowie uprawnień. Rozbieżność (projekt zespołowy bez
> członkostwa jest dziś niedostępny **obiema** ścieżkami) idzie do ustaleń weryfikacji jako osobna
> rzecz do decyzji właściciela.

### 3.4. Konsumenci w module Zadania

- `assertProjectAccess(projectId, userId, minRole)` — ciało zastąpione wywołaniem aplikacyjnego
  `requireAccess`; **sygnatura i komunikaty bez zmian**, żeby nie ruszać dwudziestu wywołań
  i nie zmienić niczego widocznego. `minRole: "MEMBER" | "ADMIN"` mapuje się na operacje
  (`task.edit` / `project.rename`).
- `assertTaskAccess(task, userId)` — dziedziczenie znika z ciała; woła `requireAccess` na
  `tasks.task`.
- **Zadanie bez projektu** (`projectId: null`) — przypadek, którego cztery role same nie opisują.
  Dziś dostęp ma **twórca albo przypisany**; `resolve` zwraca `ownerId: task.createdById` i brak
  rodzica, więc przypisany wypadłby z modelu. Kuszące obejście — zwrócić `ownerId` równy `userId`,
  gdy użytkownik jest przypisany — **odrzucone**: to zakłamywałoby fakty o zasobie, żeby wynik
  wyszedł, i pierwszy audyt „kto jest właścicielem" pokazałby nieprawdę. Zamiast tego deklaracja
  dostaje jawne pole `extraGrants?: (id) => Promise<{ userId: string; role: ResourceRole }[]>`,
  które dla zadania bez projektu zwraca twórcę i przypisanego jako `editor`. Pole jest **ogólne**
  (przypisania ma nie tylko ten moduł), nazwane wprost i widoczne w deklaracji — a nie ukryte
  w interpretacji pola `ownerId`.

### 3.5. Asystent (rozdz. 9.6)

- `get_task` — odczyt **pojedynczego** zasobu przechodzi przez `requireAccess` (`task.read`).
- `list_tasks`, `list_projects` — to **zawężanie listy**, nie sprawdzanie zasobu; zostają na
  `accessibleProjectIds`, **ale** helper przenosi się do modułu i liczy zakres z tej samej
  deklaracji, żeby lista i sprawdzenie nie mogły się rozjechać.
- Test obejścia: użytkownik B prosi o zadanie użytkownika A **po identyfikatorze i po tytule** —
  obie drogi mają nic nie zwrócić.

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Zero nowych slugów, zero wpięć w `permissions.ts`/`modules.tsx`/`ModuleSidebar`.
Uprawnienia modułowe i role zasobu pozostają rozdzielnymi wymiarami.

## 5. UI (C-30, C-31, C-32)

**Brak UI.** Żadnej trasy ani komponentu; komunikaty odmowy **identyczne** co do treści (AC-10).

## 6. AI / integracje

Zero nowych `AIAction` i read-tooli — zmienia się droga odczytu, nie katalog. Liczniki
`check:actions` (160) i `check:ai-coverage` (551) **nie mają prawa się ruszyć**.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/platform/sharing/types.ts` | nowy | `ResourceRef`, `ResourceDeclaration`, `ResourceFacts`, katalog |
| `src/platform/sharing/access.ts` | nowy | `canAccess` / `requireAccess`, katalog **parametrem wymaganym** |
| `src/platform/sharing/cache.ts` | nowy | memoizacja per żądanie (`React.cache`) |
| `src/lib/sharingResources.ts` | nowy | korzeń kompozycji (leniwe wkłady modułów) |
| `src/lib/sharing.ts` | nowy | wersja aplikacyjna: dostarcza katalog i kontekst |
| `src/modules/tasks/sharing.ts` | nowy | deklaracja `tasks.project` + `tasks.task` |
| `src/modules/tasks/actions/taskProjects.ts` | edycja | `assertProjectAccess` woła `requireAccess` |
| `src/modules/tasks/lib/access.ts` | edycja | `assertTaskAccess` bez ręcznego dziedziczenia |
| `src/modules/tasks/ai/readTools.ts` | edycja | `get_task` przez `requireAccess` |
| `src/lib/ai/readToolShared.ts` | edycja | `accessibleProjectIds` przenosi się do modułu |
| `scripts/check-module-registry.js` | edycja | dziewiąta kontrola: wpięcie `sharing.ts` w obie strony |
| `src/platform/sharing/__tests__/truthTable.integration.test.ts` | nowy | **tabela prawdy** (AC-4) |
| `src/platform/sharing/__tests__/queryCount.integration.test.ts` | nowy | liczba zapytań (AC-6, AC-7, AC-8) |
| `src/modules/tasks/__tests__/assistantBypass.integration.test.ts` | nowy | brak obejścia (AC-9) |
| `content/architektura/15-dziennik.md`, `CLAUDE.md`, `constitution.md` | edycja | zadanie 10 + reguła |

## 8. Bramki i weryfikacja (C-50)

Lokalnie: Postgres `worldofmag_e2e`, **nigdy prod** (C-13).

| AC | Sposób weryfikacji |
|---|---|
| AC-1 | `grep "@/modules/" src/platform/sharing/` → pusto; sygnatura z parametrem **bez** wartości domyślnej |
| AC-2 | deklaracja Zadań: mapa operacji → cztery role; `grep` po własnych rolach w module → pusto |
| AC-3 | test: dostęp do zadania rozstrzyga dostęp do projektu |
| AC-4 | **tabela prawdy**: macierz (7 relacji) × (6 operacji) — decyzja starego guardu vs nowego, pozycja po pozycji |
| AC-5 | w macierzy jest wiersz „projekt zespołowy, użytkownik w zespole, brak członkostwa" — obie strony muszą **odmówić** |
| AC-6 | licznik zapytań Prismy (`$on("query")`) dla właściciela: nowy ≤ stary |
| AC-7 | ten sam licznik: drugie sprawdzenie w jednym żądaniu = **0 zapytań** |
| AC-8 | licznik zapytań do `ResourceGrant` przy łańcuchu zadanie→projekt = **1** |
| AC-9 | test obejścia asystenta, **widziany na czerwono** przed naprawą |
| AC-10 | brak zmian w `src/app`/`src/components`; komunikaty odmowy porównane co do treści |
| AC-11 | komplet bramek + `test:unit` + `next build` |
| AC-12 | przegląd dziennika |

## 9. Ryzyka techniczne i plan wycofania

- **To jest kod kontroli dostępu** → tabela prawdy **przed** przełączeniem; przełączenie osobnym
  commitem od dodania mechanizmu, żeby dało się wycofać samo przełączenie.
- **`React.cache` poza kontekstem żądania** (zadania w tle, skrypty) → degraduje się do zwykłego
  wywołania; test uruchamiany poza żądaniem to potwierdza (inaczej cache byłby „sprawdzony"
  wyłącznie tam, gdzie i tak działa).
- **Rekurencja po rodzicu** przy zapętlonej deklaracji (`A → B → A`) → twardy limit głębokości
  łańcucha i błąd konfiguracji zamiast nieskończonej pętli; pokryte testem.
- **Rollback:** czysto kodowy, zero migracji. Wycofanie commitu przełączającego przywraca stare
  guardy co do znaku.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — nie dotyczą: **zero zmian schematu i migracji**
- [x] **C-20..C-25** — zero nowych akcji i `AIAction`; guardy zachowują sygnatury i komunikaty;
      RBAC nietknięty; własność `ownerId`/`ownerTeamId` **czytana**, nie zastępowana
- [x] **C-30..C-32** — brak UI; komunikaty bez zmian
- [x] **C-36** — platforma bez importu modułu, katalog **parametrem wymaganym**; wkład modułu
      w jego katalogu, wpięty własnym korzeniem kompozycji i pilnowany bramką
- [x] **C-35** — zdolność dowieziona **razem z pierwszym konsumentem** (Zadania)
- [x] **C-53** — minimalizm: jeden moduł pilotażowy, zero migracji danych, zero nowych zależności;
      świadomie **nie** włączamy własności zespołowej, choć „by pasowała"
