# Plan techniczny: Obszary zamiast grup projektów — jedno drzewo porządku w Zadaniach, z migracją danych

- **Spec:** ./spec.md (125-obszary-zamiast-grup)
- **Status:** draft
- **Data:** 2026-09-05

> **Zasada planu:** to jest **JAK**. Wzorce odczytane z kodu przed projektowaniem: 122 (dropdown
> zarządzania + sidebar + zdarzenie odświeżenia), 117/`obszary.ts` (drzewo: strażnik cyklu,
> poddrzewo, `paginacja: kompletny`), `TasksRouteView` (jeden widok listy dla wszystkich zakresów),
> `TasksHomePage` (sekcje `SectionHeading`).

## 1. Podejście (2–4 zdania)

**Tabela `TaskView` (dzisiejsze grupy) staje się nośnikiem obszarów-kategorii** — zero kopiowania
danych: te same wiersze i **te same id**, więc stare adresy `/tasks/zestaw/<id>` przekierowują 1:1
na `/tasks/obszar/<id>`, a kolumna `projectIds` zostaje nietknięta jako dane źródłowe (AC-8).
Migracja 0293 dokłada `TaskView.parentId` (drzewo kategorii) i `TaskProject.areaId`
(1:N, „pierwsza grupa wygrywa" przy konflikcie) — obie kolumny addytywne, z `ON DELETE SET NULL`,
więc usunięcie obszaru niczego poza przypisaniem nie kasuje (AC-7). Widok zbiorczy obszaru to
istniejąca ścieżka `viewMode="multi"` w `TasksRouteView` z zakresem liczonym z poddrzewa.
Obszary WEWNĄTRZ projektu (`TaskArea`, 117) pozostają fizycznie osobnym bytem — nietknięte (AC-9).

## 2. Model danych (Prisma)

- **Zmienione modele:**
  - Model Prisma `ProjectGroup` **zmienia nazwę na `ProjectArea`** (nadal `@@map("TaskView")`) —
    plik akcji i wszyscy konsumenci są w tym przebiegu przepisywani, więc rename nie zostawia
    osieroconych referencji. Pola: dotychczasowe + `parentId String?` (self-relacja
    `ProjectAreaTree`, `onDelete: SetNull` — dzieci awansują na szczyt, nigdy kaskada) +
    relacja `projects TaskProject[]`. `projectIds` zostaje w modelu z komentarzem „legacy 125 —
    dane źródłowe migracji, nie czytać" (drift gate wymaga zgodności z bazą).
  - `TaskProject` — nowe pole `areaId String?` + relacja do `ProjectArea`
    (`onDelete: SetNull`); indeks po `areaId`.
- **Typy TS:** `ObszarProjektow` w `@/types` (id, name, emoji, color, parentId, order,
  `projectCount`, `activeCount`) zastępuje `ProjectGroup`. Zero enumów (C-12).
- **Migracja (C-10, C-11, C-15):**
  - Numer z `npm run next:migration`: **0293**, katalog `prisma/migrations/0293_obszary_zamiast_grup/`.
  - Szkic DDL (ręczny, idempotentny gdzie się da):
    1. `ALTER TABLE "TaskView" ADD COLUMN "parentId" TEXT` + FK do `"TaskView"(id) ON DELETE SET NULL`
       + indeks `("workspaceId","parentId")`.
    2. `ALTER TABLE "TaskProject" ADD COLUMN "areaId" TEXT` + FK do `"TaskView"(id) ON DELETE SET NULL`
       + indeks `("areaId")`.
    3. **Dane („pierwsza grupa wygrywa", idempotentnie):**
       `UPDATE "TaskProject" p SET "areaId" = (SELECT v.id FROM "TaskView" v WHERE
       v."workspaceId" = p."workspaceId" AND v."projectIds" ~ '^\[' AND v."projectIds"::jsonb ? p.id
       ORDER BY v."order" ASC, v."createdAt" ASC, v.id ASC LIMIT 1) WHERE p."areaId" IS NULL AND
       EXISTS (…ten sam warunek…);` — strażnik `~ '^\['` chroni przed złomem w kolumnie tekstowej,
       `WHERE p."areaId" IS NULL` daje idempotencję i nie nadpisuje późniejszych ręcznych zmian.
    4. **Żadnego DROP/DELETE** — `projectIds` i wiersze zostają (AC-8; wycofanie = rollback kodu).
  - Po napisaniu: `grep -E "^(DROP|ALTER)"` na pliku (C-15) i `npm run check:schema-drift` na
    lokalnym PG (schemat musi domykać się do migracji).

## 3. Warstwa serwera (Server Actions — C-20)

Plik `src/modules/tasks/actions/projectGroups.ts` → **przepisany jako
`src/modules/tasks/actions/obszaryProjektow.ts`** (stary plik znika; wzorce guardów i liczników
przenoszone 1:1):

- `getObszaryProjektow()` — pełne drzewo kategorii przestrzeni (`filtrMoichRekordow`) + liczniki:
  projekty per obszar (`groupBy areaId`) i aktywne zadania (istniejący wzorzec `groupBy projectId`
  z `getProjectGroups`); `paginacja: kompletny — drzewo + liczniki muszą objąć całość` (wzorzec 117).
- `getObszarProjektow(id)` — jeden obszar + **poddrzewo**: lista id obszarów poddrzewa i id
  projektów w nim (helper czysty w `src/modules/tasks/lib/poddrzewoObszarow.ts` — mapa parentId,
  BFS; używany też po stronie klienta do filtra).
- `createObszarProjektow({name, emoji?, color?, parentId?})` — walidacja rodzica (mój, ta sama
  przestrzeń).
- `updateObszarProjektow(id, patch{name?, emoji?, color?, parentId?})` — **strażnik cyklu** przy
  zmianie rodzica (wzorzec `moveArea` z `obszary.ts`: nowy rodzic nie może leżeć w poddrzewie).
- `deleteObszarProjektow(id)` — twardy delete wiersza; FK `SET NULL` zdejmuje przypisania projektów
  i awansuje pod-obszary (AC-7); potwierdzenie destrukcyjne po stronie klienta (C-34). Bez kosza —
  jak dotychczasowe grupy (spec §6).
- `ustawProjektyObszaru(areaId, projectIds[])` — atomowe „projekty tego obszaru = lista": ustawia
  `areaId` wskazanym (tylko dostępnym — `accessibleProjectIds` z dotychczasowego pliku), zeruje
  tym, które były przypisane tu, a z listy zniknęły.
- Wszystkie: `requireAuth`, własność przez przestrzeń (`filtrMoichRekordow` /
  `wlasnoscOsobistaDoZapisu` — jak w dotychczasowym pliku), `revalidatePath("/tasks")` na końcu.
- **Manifest pokrycia** (`action-coverage.json`): wpisy `projectGroups:*` znikają, dochodzą
  `obszaryProjektow:*` z klasyfikacją analogiczną do grup; `check:ai-coverage` pilnuje obu stron.

## 4. RBAC / rejestr modułu (C-22)

Bez zmian: `module.tasks`; trasa `/tasks/obszar/[obszarId]` leży pod `src/app/tasks/layout.tsx`,
więc guard (098) obejmuje ją bez kodu. Manifest ui-contract kluczowany modułem — wpis `tasks`
istnieje; nowa trasa nie wymaga nowego wpisu.

## 5. UI (C-30, C-31, C-32)

- **Trasa widoku obszaru:** `src/app/tasks/obszar/[obszarId]/page.tsx` (cienki wrapper jak
  `zestaw/[zestawId]`) → `TasksRouteView` z `obszarId`. W `TasksRouteView` gałąź `obszarId`:
  `getObszarProjektow` → id projektów poddrzewa → `getTasksForProjects` → `viewMode="multi"`,
  `projectName = emoji + nazwa`; do `TasksPage` idzie obiekt `obszar` (dane + drzewo + projekty
  poddrzewa) zamiast dawnego `zestaw`.
- **Przekierowanie starych adresów:** `zestaw/[zestawId]/page.tsx` → `redirect("/tasks/obszar/<id>")`
  po sprawdzeniu, że wiersz istnieje i jest mój (inaczej `notFound()`); ścieżka
  `/tasks/multi?group=` przekierowuje jak dziś na `zestaw`, więc łańcuch domyka się sam (AC-3).
- **`FiltrObszarow`** (nowy, `src/modules/tasks/ui/FiltrObszarow.tsx`) — zastępuje
  `ProjectScopeFilter` (tamten plik znika):
  - **Tryb filtra** (widoki zbiorcze): kotwica z etykietą wybranego obszaru („Wszystkie obszary" /
    `emoji nazwa`), `AnchoredLayer` z drzewem (wcięcia), wybór **jednowartościowy**; pozycja
    „Wszystkie obszary" zdejmuje filtr (zakres nigdy nie degraduje do zera — 080). Stan w URL:
    parametr `obszar` przez `useViewState`; parametr `projekty` przestaje istnieć (ulubione, które
    go niosą, degradują NIESZKODLIWIE do „wszystkie" — reguła 080). Zawężenie po stronie klienta:
    `TasksPage` liczy zbiór dozwolonych projektów z poddrzewa (helper `poddrzewoObszarow` + mapa
    projekt→obszar z `allProjects.areaId`).
  - **Tryb zarządzania** (widok `/tasks/obszar/<id>`): mechanika ze 122 przeniesiona 1:1 —
    checkboxy projektów (= przypisane do TEGO obszaru; zapis przyciskiem przez
    `ustawProjektyObszaru`), pola nazwa/emoji/kolor, „Dodaj podobszar" (nazwa → `create` z
    `parentId`), „Usuń obszar" (`confirmDialog({destructive:true})` → `delete` →
    `router.push("/tasks/all")`), stan błędu z `role="alert"`, stan roboczy synchronizowany z
    rekordem po zapisie, zdarzenie okna **`tasks:areas-changed`** po każdej mutacji (nasłuch w
    sidebarze i na stronie głównej modułu — lekcja 122/T-10).
- **`TasksSideNav`:** sekcja „Grupy" → **„Obszary"**: drzewo kategorii (wcięcia, zwijanie —
  istniejący wzorzec `expanded`/localStorage), pod obszarem jego projekty (jak dziś pod grupą,
  źródłem `TaskProject.areaId` zamiast JSON-a), projekty bez obszaru w płaskiej liście „Projekty"
  jak dotąd; nasłuch `tasks:areas-changed` → `reload()`.
- **`TasksHomePage`:** nowa sekcja „Obszary" (`SectionHeading` + wiersze: emoji, nazwa, liczniki
  „N projektów · M aktywnych", link do `/tasks/obszar/<id>`, wcięcia dla pod-obszarów) — widoczna
  tylko przy ≥1 obszarze (spec); tworzenie pierwszego obszaru przez pozycję w istniejącej siatce
  „Zarządzanie" (formularz inline lub prompt w sekcji, wzorzec sąsiadów z tej strony).
- **`TasksPage`:** `ProjectScopeFilter`/`view.projekty` znikają; `FiltrObszarow` w widokach
  zbiorczych; w `viewMode="multi"` dropdown zarządzania obszarem. Teksty przez `t()` do
  `messages/pl.json` (`modules.tasks.FiltrObszarow`, klucze sekcji strony głównej); słowo „Grupy"
  znika z UI (AC-1).

## 6. AI / integracje (C-23)

**Usunięcie powierzchni grupowej asystenta, zero nowych akcji** *(korekta C-54 podczas
implementacji: akcje są TRZY, nie jedna, plus fragment read-toola)*: `create_project_group`,
`update_project_group`, `delete_project_group` znikają z `aiAction.ts` (delete także z listy
destrukcyjnych, jeśli tam figuruje), z egzekutora modułu (`modules/tasks/ai/executor.ts`),
z katalogu (`modules/tasks/ai/catalog.ts`), z `actionContract.ts` i z manifestu
(`action-coverage.json`); fragment `readTools.ts` listujący grupy (`getProjectGroups`) znika,
a eksporty grupowe z `contract.ts` przestają istnieć (po usunięciu AI nie mają żadnego
zewnętrznego konsumenta — akcje obszarów są wołane wyłącznie z wnętrza modułu, więc do kontraktu
NIE wchodzą, zgodnie z „kontrakt niesie to, co wołają konsumenci"). Wpięcie asystenta w obszary =
poza zakresem (spec §5). `check:actions` i `check:ai-coverage` pilnują obu kierunków.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0293_obszary_zamiast_grup/migration.sql` | nowy | DDL + dane (§2) |
| `prisma/schema.prisma` | edycja | `ProjectArea` (rename + parentId), `TaskProject.areaId` |
| `src/types/index.ts` | edycja | `ObszarProjektow` zamiast `ProjectGroup`; `TaskProject.areaId` w typie |
| `src/modules/tasks/actions/obszaryProjektow.ts` | nowy (zastępuje `projectGroups.ts`) | akcje §3 |
| `src/modules/tasks/lib/poddrzewoObszarow.ts` | nowy | czysty helper poddrzewa (serwer + klient) |
| `src/app/tasks/obszar/[obszarId]/page.tsx` | nowy | trasa widoku obszaru |
| `src/app/tasks/zestaw/[zestawId]/page.tsx` | edycja | redirect → `/tasks/obszar/<id>` |
| `src/modules/tasks/ui/TasksRouteView.tsx` | edycja | gałąź `obszarId`, prop `obszar` |
| `src/modules/tasks/ui/FiltrObszarow.tsx` | nowy (zastępuje `ProjectScopeFilter.tsx`) | filtr + zarządzanie |
| `src/modules/tasks/ui/TasksPage.tsx` | edycja | filtr obszarów, `view.obszar`, bez `projekty` |
| `src/modules/tasks/ui/TasksSideNav.tsx` | edycja | sekcja Obszary (drzewo) |
| `src/modules/tasks/ui/TasksHomePage.tsx` | edycja | sekcja Obszary + tworzenie |
| `src/lib/ai/aiAction.ts`, `actionContract.ts`, `.../execute`, `modules/tasks/ai/*` | edycja | usunięcie `create_project_group` (§6) |
| `src/lib/ai/action-coverage.json` | edycja | wymiana wpisów `projectGroups:*` → `obszaryProjektow:*` |
| `messages/pl.json` | edycja | nowe klucze i18n |
| `e2e/specs/zadania-zestawy.spec.ts` | edycja | łańcuch przekierowań → `/tasks/obszar`, seed z `areaId` |
| `doświadczenia.md` | ewent. | lekcja przy nieoczywistym problemie (C-51) |

## 8. Bramki i weryfikacja (C-50)

- Lokalny Postgres (C-13): `pg_ctlcluster 16 main start`, `omnia/omnia_dev`; **test migracji
  danych**: przed `migrate deploy` zasiać grupy odtwarzające przypadki AC-1 (projekt w 2 grupach,
  grupa pusta, złom w `projectIds`), po — sprawdzić `areaId` SQL-em; drugi `deploy` (idempotencja).
- Kolejność bramek: `check:schema-drift` → `tsc -p tsconfig.test.json` → `check:actions` +
  `check:ai-coverage` → `check:i18n` → `check:ui-contract` → `next lint` → pełny `npm run build`
  do `next build`; e2e: `zadania-zestawy.spec.ts` + pełna suita (`scripts/e2e-web.sh`).
- Mapowanie AC: AC-1/8 — test migracji na lokalnym PG (wyżej); AC-2 — gałąź `obszarId` w
  `TasksRouteView` + e2e widoku; AC-3 — e2e starych adresów (`/tasks/multi?group=`, `/tasks/zestaw/`);
  AC-4/5 — przegląd `TasksHomePage`/`TasksSideNav` + e2e nawigacji; AC-6 — `FiltrObszarow` w widoku
  zbiorczym (param `obszar`, poddrzewo, zdjęcie filtra); AC-7 — akcje + `confirmDialog destructive` +
  `tasks:areas-changed`; AC-9 — diff nie dotyka `obszary.ts`/`TaskArea` ani widoków 117; AC-10 — build.

## 9. Ryzyka techniczne i plan wycofania

- **Rzutowanie `projectIds::jsonb` na złomie** → strażnik `~ '^\['` w UPDATE (wiersz ze złomem po
  prostu nie przypisuje projektów — zgodnie z parserem `parseProjectIds`, który złom traktuje jak `[]`).
- **Cykl w drzewie kategorii** → strażnik w `updateObszarProjektow` (wzorzec `moveArea`).
- **Ulubione/urle z `projekty=`/`zestaw`** → redirect trasy + nieszkodliwa degradacja parametru (080).
- **Osierocone referencje po rename modelu** → `tsc` + `check:owner-columns` (klucze po modelu) +
  grep `projectGroup|ProjectGroup` na końcu implementacji.
- **Bramki obu kierunków (actions/ai-coverage)** → usunięcia i dodania robić w jednym zadaniu.
- **Rollback:** kod = revert na `develop`; migracja addytywna (dwie kolumny NULL-owalne + UPDATE) —
  zostaje bez szkody, `projectIds` nietknięte, więc powrót starego kodu odtwarza grupy 1:1.

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-15 — ręczna, idempotentna migracja 0293; bez enumów; bez `migrate diff` na ślepo; DDL czytany
- [x] C-20/C-21 — akcje z `revalidatePath("/tasks")`; własność przez przestrzeń (wzorce z dotychczasowego pliku)
- [x] C-23 — usunięcie `create_project_group` domknięte w egzekutorze/kontrakcie/manifestach
- [x] C-30..C-34 — tokeny motywu, mobile/44 px, `t()`/pl.json, `confirmDialog destructive`, `ModuleView` przez istniejący `TasksRouteView`
- [x] C-36 — wszystko wewnątrz modułu Tasks (importy względne), helper poddrzewa w `modules/tasks/lib`
- [x] C-53 — reuse tabeli i widoku multi zamiast nowych bytów; netto: jeden mechanizm zamiast dwóch
