# Plan techniczny: Obszary w Zadaniach + trwała odzyskiwalność kosza

- **Spec:** ./spec.md (117-zadania-obszary)
- **Status:** draft
- **Data:** 2026-08-31

> Plan pisany pod istniejący kod: wzorcem dla drzewa obszarów jest moduł Tasks (sekcje `TaskGroup`,
> stan widoku w URL przez `platform/viewState`), dla przełącznika wariantów — `PrzelacznikSegmentowy`
> (100), dla nieusuwalności — istniejący kosz (`platform/trash` + `actions/trash.ts`), któremu
> zmieniamy semantykę „usuń wiersz" → „oznacz status".

## 1. Podejście

Dwie niezależne warstwy w jednym przebiegu:

**(A) Obszary** — nowy model `TaskArea` (drzewo per projekt, FK do `TaskProject`) + `Task.areaId`
(jeden obszar na zadanie, `SetNull`). CRUD obszarów jako akcje w module Tasks
(`src/modules/tasks/actions/obszary.ts`), przypisanie obszaru przez rozszerzenie istniejącego
`updateTask`. Przeglądanie „wg obszarów" to nowy `layout: "obszary"` w istniejącym stanie widoku
URL `TasksPage` + parametr wariantu (`sekcje | drill | panel`), z ostatnim wyborem pamiętanym w
`localStorage` jako domyślnym (wzorzec `ukladSzczegolow.ts`).

**(B) Nieusuwalność kosza** — `TrashItem.status` (`String` + union `"active" | "emptied" |
"expired" | "restored"`); wszystkie 6 miejsc kasujących `TrashItem` przechodzi na `updateMany`
statusu. Panel admina `/admin/kosz` (lista wszystkich wpisów + przywracanie do właściciela, wpis
audytu). Restoratory wyciągnięte z pliku `"use server"` do współdzielonego helpera, żeby akcja
użytkownika i admina wołały ten sam kod.

## 2. Model danych (Prisma)

- **`TaskArea` (nowy):**
  - `id String @id @default(cuid())`
  - `projectId String` → `TaskProject` (`onDelete: Cascade`)
  - `parentId String?` → `TaskArea` self-relation `"TaskAreaTree"` (`onDelete: Cascade` — tryb
    „usuń poddrzewo" to jeden delete korzenia; tryb „scal" najpierw przepina dzieci)
  - `name String`, `order Float @default(0)`, `createdAt`, `updatedAt`
  - `@@index([projectId, parentId])`
  - **Bez `workspaceId`** — tabela-dziecko projektu (jak `TaskProjectMember`); własność i dostęp
    rozstrzyga projekt. Bez `version` (struktura, nie treść współedytowana — minimalizm C-53).
- **`Task.areaId String?`** → `TaskArea` (`onDelete: SetNull`) + `@@index([areaId])`.
- **`TrashItem.status String @default("active")`** + `resolvedAt DateTime?` (kiedy opróżniono /
  wygasł / przywrócono) + `@@index([status, deletedAt])`. Union TS `TrashStatus` w platformie.
- **Migracje (C-10/C-11/C-12):** dwie, numery z `npm run next:migration` (obecnie wolne **0286**,
  potem **0287**):
  - `0286_task_areas`: `CREATE TABLE "TaskArea" (…)`; `ALTER TABLE "Task" ADD COLUMN "areaId" TEXT`;
    FK + `CREATE INDEX`. Ręczny DDL (nie surowy `migrate diff` — C-15).
  - `0287_trash_status`: `ALTER TABLE "TrashItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT
    'active', ADD COLUMN "resolvedAt" TIMESTAMP(3); CREATE INDEX …`.
  Zero enumów; po edycji `schema.prisma` bramka `check:schema-drift` musi wyjść pusta.

## 3. Warstwa serwera (Server Actions — C-20)

**Nowy plik `src/modules/tasks/actions/obszary.ts`** (`"use server"`; guard = istniejący
`assertProjectAccess(projectId, userId, "MEMBER")` — obszary są treścią projektu jak zadania):

- `getProjectAreas(projectId) → ObszarDTO[]` — płaska lista z `parentId`/`order`; zapytanie z
  komentarzem `paginacja: kompletny — drzewo obszarów projektu; ucięte drzewo gubi sekcje i zadania`
  (096).
- `createArea(projectId, name, parentId?)` — walidacja: rodzic należy do tego samego projektu.
- `renameArea(id, name)`.
- `moveArea(id, { parentId, order })` — **walidacja cyklu**: cel nie może być potomkiem
  przenoszonego (czysta funkcja w `src/modules/tasks/lib/obszary.ts`, z testem).
- `deleteArea(id, tryb: "scal" | "poddrzewo")`:
  - snapshot do kosza (`recordTrash`, moduł `"obszary"`): usuwane obszary (id/projectId/parentId/
    name/order) + mapa przypisań `[{taskId, areaId}]` z całego dotkniętego zakresu;
  - `"scal"`: dzieci → `parentId` usuwanego (lub `null`), zadania usuwanego → obszar nadrzędny
    (`null` na szczycie); potem delete jednego wiersza;
  - `"poddrzewo"`: delete korzenia — kaskada zdejmuje poddrzewo, `Task.areaId` idzie na `SetNull`;
  - wszystko w `prisma.$transaction`.
- Każda mutacja kończy się `revalidatePath("/tasks")`.
- **Przypisanie obszaru zadaniu:** rozszerzenie istniejącego `updateTask` w
  `src/modules/tasks/actions/tasks.ts` o pole `areaId?: string | null` (walidacja: obszar należy do
  projektu zadania; zmiana projektu zadania zeruje `areaId`, jeśli obszar nie pasuje). Snapshot
  zadania do kosza (`deleteTask`) dokłada `areaId`, restorator zadania go odtwarza (gdy obszar
  wciąż istnieje).

**Kosz — `src/platform/trash/trash.ts` + `src/actions/trash.ts`:**

- `TrashModule` += `"obszary"`.
- `recordTrash`: inline-cleanup `deleteMany` → `updateMany { status: "expired", resolvedAt }`
  (tylko `status: "active"`).
- `purgeExpiredTrash`: jw. (`updateMany`, zwraca `count`); wołający `/api/cron/retention` bez zmian.
- `getTrash`: filtr `status: "active"`; sprzątanie wejściowe jak wyżej.
- `restoreTrashItem`: po udanym przywróceniu `update { status: "restored", resolvedAt }` zamiast
  `delete`.
- `purgeTrashItem` / `emptyTrash`: `update(Many) { status: "emptied", resolvedAt }` zamiast delete.
- **Refaktor restoratorów:** ciała `restoreNote/…/restoreRosliny` + dispatch przenoszą się do
  helpera poza `"use server"` (`src/lib/trash/przywracanie.ts`, eksport
  `przywrocZMigawki(item)`); `actions/trash.ts` i akcja admina wołają go. Nowy restorator
  `restoreObszary`: odtwarza obszary (`createMany skipDuplicates`, w kolejności rodzic→dziecko;
  `parentId` wraca tylko gdy rodzic istnieje/wrócił; pomija gdy projekt zniknął — komunikat jak we
  wzorcu Roślin), potem `updateMany` przypisań zadań (`where: { id: taskId, areaId: null }`).
- **RODO bez zmian**: `lib/privacy/purge.ts` i kaskada FK `TrashItem.user` zostają — prawny wyjątek
  ze speca.

**Admin — nowy plik `src/actions/adminTrash.ts`:**

- `getAdminTrash({ kursor?, status?, modul?, szukaj? })` — `requireAdmin`; kursorowa paginacja
  (`zapytanieKursorowe`) po `deletedAt`; zwraca też e-mail właściciela (join `user`).
- `adminRestoreTrashItem(id)` — `requireAdmin` → `przywrocZMigawki` → `status: "restored"` →
  `logAudit("admin", "trash.restore", entityId, …)`; `AuditCategory` w `platform/audit/audit.ts`
  += `"admin"` (kolumna to `String`, bez migracji; viewer `/admin/audit` dostaje nową kategorię
  w filtrze, jeśli filtruje po zamkniętej liście).
- Wpisy w `src/lib/ai/action-coverage.json` dla wszystkich nowych akcji: obszary →
  `status: "excluded", reason: "interactive"`, `access: "owner"`, `guardedVia`/guard
  `assertProjectAccess`; admin → `access: "admin"`.

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowych slugów**: obszary pod `module.tasks`, panel przywracania pod `module.admin`
  (layout `/admin` już gated). Bez zmian w `modules.tsx` / `ModuleSidebar`.
- `/admin/kosz` **musi** dostać wpis w rejestrze `src/lib/admin/narzedzia.ts` (grupa „Dostęp
  i bezpieczeństwo", klucze tekstów — nie literały) — inaczej `check:admin-links` wywali build.

## 5. UI (C-30, C-31, C-32, C-33)

**Widok „wg obszarów" w projekcie** (tylko widok projektu, nie widoki wirtualne):

- Stan widoku (URL, `platform/viewState`): `layout: oneOf(["list","kanban","timeline","obszary"])`
  + nowy parametr `obszary: oneOf(["sekcje","drill","panel"], "sekcje")`. Ostatnio użyty wariant
  zapamiętany w `localStorage` (nowy mały helper wzorem `ukladSzczegolow.ts`) i używany jako
  domyślny, gdy URL go nie niesie; URL nadal wygrywa (widoki ulubione — AC-4).
- Nowe komponenty w `src/modules/tasks/ui/`:
  - `ObszaryWidok.tsx` — kontener: buduje drzewo z płaskiej listy, `PrzelacznikSegmentowy`
    (z `components/ui/nav/`) do wyboru wariantu, deleguje do trzech prezentacji **tego samego**
    zbioru zadań (lekcja 085 — jedna lista źródłowa, różni się wyłącznie prezentacja);
  - `ObszarySekcje.tsx` — wariant domyślny: zwijane sekcje wg drzewa (wcięcie
    `padding-left` proporcjonalne do głębokości, capowane wizualnie), sekcja „Bez obszaru" na
    końcu; wiersze zadań renderowane istniejącym `TaskRow`/`TaskList`;
  - `ObszaryDrill.tsx` — wariant mobilny: bieżący obszar → jego pod-obszary (kafle z licznikami)
    + jego zadania; okruszki/„wstecz" zawsze widoczne;
  - `ObszaryPanel.tsx` — drzewo w bocznej kolumnie (`hidden lg:block` — desktop only, C-31),
    klik filtruje listę do obszaru (z pod-obszarami);
  - `WyborObszaru.tsx` — dropdown przypisania obszaru (opcje z wcięciem) używany w `TaskDetail`
    i `FormularzZadania`; wybór „Brak" = `null`.
- Zarządzanie drzewem w widoku „wg obszarów": „Nowy obszar" w pasku widoku, menu ⋮ przy sekcji
  (zmień nazwę / nowy pod-obszar / przenieś / usuń). Usunięcie = mały modal (istniejący `Modal`)
  z wyborem trybu „Scal do rodzica" / „Usuń całe poddrzewo" + przycisk destrukcyjny (C-34 —
  `confirmDialog` nie uniesie wyboru trybu, więc dedykowany dialog z `destructive`).
- Kosz użytkownika `/trash`: mapa etykiet modułów += `"obszary"`.
- **Admin `/admin/kosz`**: `src/app/admin/kosz/page.tsx` (server wrapper, wzór innych stron admina)
  + `src/components/admin/KoszAdmina.tsx` (klient): tabela wpisów (właściciel, moduł, tytuł,
  status, daty), filtry status/moduł + szukajka, przycisk „Przywróć właścicielowi"
  (`confirmDialog` neutralny), paginacja „załaduj więcej" po kursorze; `PowrotDoPanelu`.
  Wpis w `src/lib/ui/view-contract.json` (bramka `check:ui-contract`).
- Wszystkie teksty do `messages/pl.json` (`check:i18n` — zero literałów z diakrytykami w JSX);
  kolory wyłącznie ze zmiennych CSS.

## 6. AI / integracje

- **Bez nowych `AIAction`** (decyzja ze speca) — `check:actions` nietknięty. Read-toole bez zmian.
- Rozszerzenie `updateTask` nie zmienia jego wpisu w coverage (ta sama akcja); nowe akcje dostają
  wpisy w `action-coverage.json` (pkt 3), inaczej `check:ai-coverage` wywali build.
- Kalendarz / powiadomienia / dashboard — nie dotyczy.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | `TaskArea`, `Task.areaId`, `TrashItem.status/resolvedAt` |
| `prisma/migrations/0286_task_areas/migration.sql` | nowy | DDL obszarów |
| `prisma/migrations/0287_trash_status/migration.sql` | nowy | DDL statusu kosza |
| `src/modules/tasks/actions/obszary.ts` | nowy | CRUD drzewa + delete z trybami |
| `src/modules/tasks/lib/obszary.ts` (+ test w `__tests__`) | nowy | budowa drzewa, walidacja cyklu, plan scalania — czyste funkcje |
| `src/modules/tasks/actions/tasks.ts` | edycja | `updateTask.areaId`, snapshot kosza z `areaId` |
| `src/modules/tasks/ui/{ObszaryWidok,ObszarySekcje,ObszaryDrill,ObszaryPanel,WyborObszaru}.tsx` | nowe | trzy warianty + picker |
| `src/modules/tasks/ui/TasksPage.tsx` (+ `TasksRouteView`/`page.tsx` projektu) | edycja | `layout: "obszary"`, przekazanie obszarów |
| `src/modules/tasks/ui/TaskDetail.tsx`, `FormularzZadania.tsx` | edycja | pole „Obszar" |
| `src/modules/tasks/lib/wariantObszarow.ts` | nowy | localStorage ostatniego wariantu |
| `src/platform/trash/trash.ts` | edycja | statusy zamiast delete; `TrashModule` += `"obszary"`; union `TrashStatus` |
| `src/lib/trash/przywracanie.ts` | nowy | restoratory + dispatch wyniesione z akcji; `restoreObszary` |
| `src/actions/trash.ts` | edycja | filtr `active`, statusy, delegacja do helpera |
| `src/actions/adminTrash.ts` | nowy | lista + przywracanie przez admina (audyt) |
| `src/platform/audit/audit.ts` | edycja | `AuditCategory` += `"admin"` |
| `src/app/admin/kosz/page.tsx` + `src/components/admin/KoszAdmina.tsx` | nowe | panel przywracania |
| `src/lib/admin/narzedzia.ts` (+ test kluczy) | edycja | wpis `/admin/kosz` |
| `src/lib/ui/view-contract.json` | edycja | wpis nowej trasy admina |
| `src/lib/ai/action-coverage.json` | edycja | wpisy nowych akcji |
| `src/components/trash/…` (strona `/trash`) | edycja | etykieta modułu `"obszary"` |
| `messages/pl.json` | edycja | wszystkie nowe teksty |
| `doświadczenia.md` | edycja | lekcje z implementacji (C-51) |

## 8. Bramki i weryfikacja (C-50)

- Lokalnie: lokalny Postgres (`pg_ctlcluster 16 main start`, `.env.local` + eksport zmiennych),
  `npx prisma migrate deploy`, `npm run db:seed` — nigdy prod (C-13).
- Bramki, które ta zmiana realnie zahacza: `check:migrations`, `check:schema-drift`,
  `check:ai-coverage`, `check:ui-contract`, `check:admin-links`, `check:pagination`,
  `check:i18n`, `check:owner-columns`, `check:boundaries`, `tsc -p tsconfig.test.json`,
  `next lint`, `next build`.
- Mapowanie AC → weryfikacja:
  - AC-1/AC-2 — test jednostkowy czystych funkcji drzewa + ręcznie w dev (tworzenie 3 poziomów,
    przypisanie/odpięcie w `TaskDetail`).
  - AC-3 — dev: projekt z zadaniami w obszarach i bez; sekcje = drzewo, „Bez obszaru" osobno,
    suma zadań w sekcjach == liczba zadań projektu (jedno źródło danych w kodzie).
  - AC-4 — dev: przełączenie wariantu, odświeżenie i wejście bez parametru → wraca ostatni;
    URL z parametrem wygrywa; domyślny „sekcje".
  - AC-5 — test jednostkowy planu scalania + dev: oba tryby na obszarze z dziećmi i zadaniami.
  - AC-6 — dev: usuń → `/trash` → przywróć → struktura i przypisania wracają.
  - AC-7 — test/dev: `emptyTrash` + symulowany upływ retencji → wiersze `TrashItem` istnieją ze
    statusem `emptied`/`expired` (zapytanie do DB), kosz użytkownika pusty.
  - AC-8 — dev: `/admin/kosz` pokazuje wpis „emptied", „Przywróć" odtwarza zasób właścicielowi,
    wpis w `/admin/audit`.
  - AC-9 — dev: projekt zespołowy — obszary widoczne dla członka (dostęp przez projekt).

## 9. Ryzyka techniczne i plan wycofania

- **Regresja kosza (6 miejsc delete → status)** — zmiana skupiona w 2 plikach + helper; istniejące
  testy kosza muszą przejść; ręczny smoke wszystkich ścieżek (restore/purge/empty/cron).
- **Restorator obszarów a kolejność rodzic→dziecko** — sortowanie topologiczne w czystej funkcji
  z testem; `skipDuplicates` czyni przywracanie idempotentnym.
- **Cykl w drzewie** — walidacja w akcji `moveArea` po stronie serwera (nie tylko UI).
- **Rozjazd trzech wariantów** — jeden zbiór zadań + jedna funkcja budowy drzewa; warianty to
  wyłącznie render.
- **Rozrost `TrashItem`** — świadoma decyzja właściciela; indeks po statusie trzyma zapytania
  kosza użytkownika na `active`.
- Rollback: kod = revert commita; migracje są addytywne (nowa tabela + kolumny nullable/z default)
  — bez rollbacku DB, zgodnie z runbookiem (kolumny mogą zostać).

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-15 — ręczne migracje 0286/0287, brak enumów, DDL czytany, bez prod DB
- [x] C-20/C-21 — Server Actions + `revalidatePath`; dostęp przez `assertProjectAccess` (przestrzeń
  projektu, model po 079); C-24 — kosz (zaostrzony); C-25 — audyt akcji admina
- [x] C-22/C-23 — bez nowych slugów i AIAction; coverage uzupełnione
- [x] C-30..C-34 — zmienne CSS, mobile-first (panel tylko desktop, drill na telefon), teksty w
  `pl.json`, `ModuleView` nietknięty (widoki wewnątrz istniejącej ramy Tasks; nowa trasa admina
  z wpisem w manifeście), dialog destrukcyjny
- [x] C-36 — kod obszarów w `src/modules/tasks/`; platforma kosza nie zna modułów (restoratory
  żyją w `src/lib/trash/`, jak dotąd w `src/actions/`)
- [x] C-53 — bez nowych zależności, bez refaktorów „przy okazji" (jedyny refaktor — wyniesienie
  restoratorów — jest wymuszony przez współdzielenie user/admin)
