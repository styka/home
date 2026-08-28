# Plan techniczny: Moduł Rośliny — od parapetu do hektara

- **Spec:** ./spec.md (113-modul-roslin) · **Badania:** ./badania.md
- **Status:** draft
- **Data:** 2026-08-28

> **Zasada planu:** to jest **JAK**. Plan pisany pod istniejący kod: wzorcem jest **moduł Zwierzęta**
> (byt + opieka + pomiary + rodowód + udostępnianie), a wzorcem *rejestracji nowego modułu* — **102
> (YouTube)**, najświeższy moduł dołożony do rejestru po przebudowie 046–050.

---

## 1. Podejście

Nowy moduł `src/modules/rosliny/` zbudowany **jeden do jednego na wzorcu Zwierząt**: byt (`Pet` →
`Plant`), harmonogram opieki + log wykonania (`PetCareTask`/`PetCareLog`), pomiary, rodowód
(`sireId`/`damId` → `parentId`), deklaracja udostępniania, wkład do pulpitu i kalendarza. Nadbudowa
ponad Zwierzęta to trzy rzeczy, których tam nie ma: **przestrzeń z trybem**, **miejsce o zmiennej
skali** i **liczność bytu** (egzemplarz / partia / powierzchnia).

Rejestracja modułu idzie ścieżką 102: `module.ts` (klient) + `module.server.ts` (leniwe `ai`
i `calendar`), bramka uprawnienia w `layout.tsx`, wpisy w manifestach bramek. **Zero nowych zależności**
(C-53) — wszystko stoi na tym, co repo już ma: `lib/recurrence.ts`, `rememberedContent`,
`AiCostBadge`, `ModuleView`, `platform/sharing`, `platform/workspaces/zapis`.

**Katalog gatunków idzie wzorcem Wiadomości (082):** systemowy katalog bez przestrzeni + kopia
w przestrzeni użytkownika. Powód techniczny jest twardy, nie estetyczny — patrz §2.1.

---

## 2. Model danych (Prisma)

### 2.1 Trzy rozstrzygnięcia, z których wynika cała reszta

**(a) Nowa tabela ma `workspaceId` WYMAGANY — nigdy nullable.**
`check:workspace-fill` żąda triggera `omnia_fill_workspace` dla każdego modelu z *nullable*
`workspaceId`, a jednocześnie **odrzuca trigger na tabeli spoza pięcioosobowej listy wyjątków**
(079: „pokryty zbiór i lista wyjątków muszą być tym samym zbiorem"). Nullable `workspaceId` na nowej
tabeli jest więc niemożliwy do przeprowadzenia przez bramkę. Nie stosujemy też
`@default(dbgenerated())` — to domyślnik dla tabel *backfillowanych* w 054; na nowej tabeli nie ma
czego wypełniać wstecz, a domyślnik uczyniłby pole opcjonalnym w kliencie Prismy (lekcja
`WeatherPref`, 082).

**(b) Stąd katalog gatunków musi być DWIEMA tabelami, dokładnie jak w Wiadomościach.**
Wpis systemowy nie ma przestrzeni (nie należy do nikogo), a wpis użytkownika ma. Skoro jedna tabela
nie może mieć obu, mamy `PlantSpeciesCatalog` (systemowy, **bez kolumny przestrzeni**, seedowany
migracją — odpowiednik `NewsSourceCatalog`) i `PlantSpecies` (w przestrzeni — odpowiednik
`NewsSource`). Dodanie z katalogu **kopiuje** wiersz. Efekt uboczny jest pożądany: użytkownik może
zmienić parametry pielęgnacji „swojej" Monstery, nie ruszając wiersza systemowego, a wyłączenie
martwego wpisu w katalogu nikomu nie kasuje historii (ta sama korzyść, którą 082 opisuje dla RSS).
To także realizuje AC-17 („pochodzenie" = `PlantSpecies.origin`).

**(c) Jedna tabela zdarzeń dla podlania i dla oprysku.**
`PlantCareEvent` niesie wykonanie zabiegu **i** komplet pól ewidencji ŚOR **i** zbiór (`kind:
"HARVEST"` + `quantity`/`quantityUnit`). Rozbicie na „czynności hobbysty" i „zabiegi rolnika" jest
kuszące i błędne: ewidencja z AC-24/AC-25 nie miałaby wtedy jednego źródła, a oś czasu rośliny
musiałaby scalać dwie tabele w kodzie (ustalenie z `badania.md`, poziom 3). Pola zawodowe są
nullowalne i **niewidoczne w trybie `home`** — to jest różnica prezentacji, nie schematu.

### 2.2 Nowe modele (10)

Wszystkie statusy/rodzaje to `String` + union TS (**C-12 — zero enumów Prisma**). Uniony mieszkają
w `src/modules/rosliny/lib/typy.ts`.

| Model | Przestrzeń | Kluczowe pola |
|---|---|---|
| **PlantSpeciesCatalog** | — (systemowy) | `key @unique`, `namePl`, `nameLatin`, `family`, `category`, `light`, `waterJson` (JSON: interwał dni per sezon), `soil`, `tempMinC`, `phenologyJson`, `notes`, `active` |
| **PlantSpecies** | `workspaceId` | `catalogKey?`, `origin` (`system\|user\|ai`), te same pola pielęgnacyjne (kopia, edytowalna), `@@unique([workspaceId, nameLatin])` |
| **PlantSpace** | `workspaceId` | `name`, `kind` (`home\|garden\|production\|field`), `weatherLocationId?`, `notes` |
| **PlantPlace** | przez `spaceId` | `spaceId`, `name`, `kind` (`windowsill\|room\|balcony\|bed\|zone\|sector\|field`), `sun` (`full\|partial\|shade\|unknown`), `soil?`, `areaValue?`, `areaUnit?`, `notes` |
| **Plant** | `workspaceId` | `spaceId`, `placeId?`, `speciesId?`, `customName?`, `name`, `quantity Float @default(1)`, `quantityUnit` (`szt\|m2\|ha`), `stage?` (kod BBCH), `status` (`ACTIVE\|SOLD\|HARVESTED\|DEAD\|ARCHIVED`), `statusReason?`, `statusAt?`, `sownAt?`, `acquiredAt?`, `parentId?`, `photoUrl?`, `notes?` |
| **PlantCareTask** | przez `spaceId` | `spaceId`, `plantId?`, `placeId?`, `kind`, `title`, `recurring?` (JSON `RecurringRule`), `lastDoneAt?`, `nextDueAt?`, `reason?` (**uzasadnienie terminu — AC-9**), `active` |
| **PlantCareEvent** | przez `spaceId` | `spaceId`, `plantId?`, `placeId?`, `taskId?`, `kind`, `occurredAt`, `outcome` (`DONE\|SKIPPED\|POSTPONED`), `note?`, **ewidencja:** `productName?`, `permitNumber?`, `applicationKind?`, `doseValue?`, `doseUnit?`, `areaValue?`, `areaUnit?`, `locationText?`, `operator?`, `conditions?`, `withdrawalDays?`, **zbiór:** `quantity?`, `quantityUnit?`, `pantryItemId?` |
| **PlantJournalEntry** | przez `plantId` | `plantId`, `occurredAt`, `text?`, `photoUrl?` |
| **PlantMeasurement** | przez `plantId` | `plantId`, `measuredAt`, `kind` (`HEIGHT_CM\|LEAF_COUNT\|TRUNK_CM\|SOIL_MOISTURE\|TEMP_C\|PH\|LIGHT\|OTHER`), `value Float`, `unit`, `source` (`manual\|sensor`), `note?` |
| **PlantHealthEvent** | przez `plantId` | `plantId`, `occurredAt`, `source` (`ai\|manual`), `symptom?`, `diagnosis?`, `confidence?` (`low\|medium\|high\|unknown`), `recommendationJson?`, `photoUrl?`, `resolvedAt?`, `outcome?` (`helped\|no_change\|worse`) |

**Dwa pola założone teraz, choć funkcja jest etapem 2** (spec §5 — żeby etap 2 nie był migracją):
`PlantMeasurement.source` (szew pod sensory IoT — sensor tylko dopisuje do tej samej tabeli) oraz
`PlantCareEvent.withdrawalDays` (karencja).

**Relacje i indeksy:** `Plant.parentId → Plant` (`onDelete: SetNull`, relacja nazwana `PlantParent`
+ `offspring`), `Plant.spaceId/placeId/speciesId`, wszystkie dzieci `onDelete: Cascade` po rodzicu,
`workspaceId → Workspace` (`onDelete: Cascade`). Indeksy: `@@index([workspaceId])` na
`PlantSpace`/`Plant`/`PlantSpecies`, `@@index([spaceId])`, `@@index([placeId])`,
`@@index([parentId])`, `@@index([nextDueAt])` na `PlantCareTask`, `@@index([spaceId, occurredAt])`
na `PlantCareEvent`, `@@index([plantId, measuredAt])`, `@@index([plantId, occurredAt])`.

### 2.3 Migracje (C-10, C-11, C-14)

Numer wolny z `npm run next:migration`: **0272**. Dwa katalogi (drugi jest duży i czysto danymi —
rozdzielenie ułatwia czytanie i ewentualny rollback):

| Katalog | Treść |
|---|---|
| `prisma/migrations/0272_modul_roslin/migration.sql` | `CREATE TABLE` dla 10 modeli + indeksy + FK; **seed uprawnienia** `module.rosliny` idempotentnie (`gen_random_uuid()::text`, `ON CONFLICT ("slug") DO NOTHING`) i nadanie go roli administratora — wzorzec z poprzednich modułów |
| `prisma/migrations/0273_katalog_gatunkow/migration.sql` | Seed `PlantSpeciesCatalog`: **150–250 pozycji** (rośliny doniczkowe, warzywa, zioła, owoce, zboża), dollar-quoting `$tag$…$tag$` dla opisów, `ON CONFLICT ("key") DO NOTHING` — idempotentnie |

**C-15:** DDL piszemy ręcznie. Jeśli posiłkujemy się `prisma migrate diff`, zostawiamy **wyłącznie**
instrukcje tej zmiany — kontrola: `grep -E "^(DROP|ALTER)" ` na obu plikach musi zwrócić tylko nasze
`ALTER TABLE … ADD CONSTRAINT`.

**Bez triggera `omnia_fill_workspace`** — patrz §2.1(a); `check:workspace-fill` musi dalej raportować
dokładnie pięć tabel.

---

## 3. Warstwa serwera (C-20, C-21, C-17)

Akcje mieszkają w **`src/modules/rosliny/actions/`** (C-36 — moduł trzyma swoje wnętrze u siebie;
`src/actions/` to warstwa sprzed przebudowy). Każda mutacja kończy się `revalidatePath`.

| Plik | Funkcje | `revalidatePath` |
|---|---|---|
| `actions/przestrzenie.ts` | `getSpaces`, `getSpace`, `createSpace`, `updateSpace`, `deleteSpace` | `/rosliny` |
| `actions/miejsca.ts` | `getPlaces`, `createPlace`, `updatePlace`, `deletePlace`, `getPlaceHistory` | `/rosliny/[spaceId]` |
| `actions/rosliny.ts` | `getPlants`, `getPlant`, `createPlant`, `updatePlant`, `setPlantStatus`, `propagatePlant`, `deletePlant`, `assertPlantAccess` | `/rosliny`, szczegół |
| `actions/opieka.ts` | `getCareAgenda`, `createCareTask`, `updateCareTask`, `completeCare`, `skipCare`, `postponeCare`, `getCareHistory` | `/rosliny/opieka` |
| `actions/dziennik.ts` | `getJournal`, `addJournalEntry`, `deleteJournalEntry`, `getMeasurements`, `addMeasurement` | szczegół rośliny |
| `actions/zbiory.ts` | `recordHarvest`, `harvestToPantry`, `getHarvests` | szczegół, `/rosliny` |
| `actions/ewidencja.ts` | `recordTreatment`, `getTreatmentRegister`, `exportTreatmentRegister` | `/rosliny/ewidencja` |
| `actions/gatunki.ts` | `searchCatalog`, `getSpeciesList`, `addSpeciesFromCatalog`, `createSpecies`, `updateSpecies` | `/rosliny/katalog` |
| `actions/ai.ts` | `identifyPlant`, `diagnosePlant`, `getSeasonPlan`, `getSpaceInsights` | szczegół / przestrzeń |

**Własność (C-21 w brzmieniu po 079 — `CLAUDE.md` jest tu źródłem prawdy; konstytucja opisuje stan
sprzed migracji 0244):** zapis przez `wlasnoscDoZapisu(user.id, teamId)`; odczyt listy przez
`ownedWhereAsync` / `ownedOrAsync`; „ściśle moje" przez `filtrMoichRekordow`. **Nigdy** ręcznie
`ownerId`. Wariant dobieramy według zastępowanego warunku — podstawienie szerszego jest zakazane
(dziś zwróciłyby to samo, więc błąd wyszedłby dopiero na koncie z ograniczeniami).

**Guard (C-17):** `src/modules/rosliny/lib/sharingGuard.ts` woła `requireAccess` **z własnym
katalogiem** (nie przez korzeń kompozycji — to odwróciłoby zależność, regresja z 049).
`assertPlantAccess(plantId, userId, needEdit)` jest cienką nakładką na dwie operacje, dokładnie jak
`assertPetAccess`.

**Paginacja (C-50 / `check:pagination`):** każdy `findMany` dostaje `take: SUFIT_LISTY` albo
`...zapytanieKursorowe(...)`. Rejestr zabiegów i agenda liczone „w całości" (sumy, komplet do
eksportu) dostają komentarz `paginacja: kompletny — <powód>` **przy wywołaniu**.

**Logi (`check:logs`):** żadnego `console.*` — wyłącznie `logEvent` z
`@/platform/observability/log`.

---

## 4. RBAC / rejestr modułu (C-22, C-36)

- **Slug: nowy — `module.rosliny`**, seedowany w migracji 0272.
- `src/modules/rosliny/module.ts` — `defineModule({ id: "rosliny", label: "Rośliny",
  href: "/rosliny", permission: "module.rosliny", color: "var(--accent-green)", Icon: Sprout,
  sideNav: () => import("./ui/RoslinySideNav")…, szybkieCele: […], defaultEnabled: true })`.
  **Bez** statycznych importów kodu serwerowego — pola leniwe (wymóg poprawności, nie optymalizacja).
- `src/modules/rosliny/module.server.ts` — `{ ai: () => import("./ai"), calendar: () => import("./calendar") }`.
  **Bez `jobs`** — patrz §9: moduł nie ma handlera w tle, a pusty rejestr byłby plikiem bez konsumenta (C-35).
- Wpięcia (bramka `check:module-registry` sprawdza je **w obie strony**):
  `src/lib/modules.tsx` (import + `DECLARED` + kolejność), `src/lib/modules.server.ts`,
  `src/lib/dashboardContributors.ts`, `src/lib/sharingResources.ts`, `src/lib/retention/polityki.ts`,
  `src/lib/ai/catalog.ts`.
- **`src/platform/auth/permissions.ts` NIE dostaje wpisu** — po 046 `PERMISSIONS` trzyma wyłącznie
  powierzchnie spoza modułów; ścieżka → uprawnienie wynika z `module.ts` i składa je
  `src/lib/pathPermissions.ts`. Dopisanie modułu do `PERMISSIONS` byłoby regresją „równoległej listy".
  *(Konstytucja C-22 opisuje tu stan sprzed 046 — postępujemy wg `CLAUDE.md` i kodu.)*
- **Bramka trasy (`check:route-gating`, AC-27):** `src/app/rosliny/layout.tsx` woła
  `wymagajDostepuDoModulu(roslinyModule.permission)` — w **layoucie**, bo obejmuje podtrasy.
- `ModuleSidebar` i mobilny pasek biorą moduł z rejestru — **żadnej ręcznej edycji** poza kolejnością
  w `modules.tsx`.

---

## 5. UI (C-30, C-31, C-32, C-33, C-34)

### 5.1 Trasy i widoki

| Trasa | Server wrapper | Widok kliencki | Treść |
|---|---|---|---|
| `/rosliny` | `app/rosliny/page.tsx` | `ui/RoslinyPage.tsx` | Lista przestrzeni + kafel „do zrobienia dziś" |
| `/rosliny/[spaceId]` | `.../[spaceId]/page.tsx` | `ui/PrzestrzenPage.tsx` | Rośliny w przestrzeni, miejsca, plan sezonu (AI), wnioski (AI) |
| `/rosliny/[spaceId]/roslina/[plantId]` | `.../page.tsx` | `ui/RoslinaSzczegol.tsx` | Oś czasu: dziennik, pomiary, opieka, zdrowie, potomstwo |
| `/rosliny/opieka` | `.../opieka/page.tsx` | `ui/AgendaOpieki.tsx` | Agenda ze wszystkich przestrzeni, z uzasadnieniem terminu |
| `/rosliny/katalog` | `.../katalog/page.tsx` | `ui/KatalogGatunkow.tsx` | Wyszukiwarka gatunków, dodanie do swoich |
| `/rosliny/ewidencja` | `.../ewidencja/page.tsx` | `ui/Ewidencja.tsx` | Rejestr zabiegów + eksport (tylko przestrzenie `production`/`field`) |

Każdy widok renderuje **`ModuleView` z propem `state`** (`check:ui-contract` inaczej wywali build);
stany brzegowe wyłącznie przez `state` + `empty`/`error`/`noAccess`. Ustawienia przestrzeni idą w
**slot `settings`** (jedyne miejsce na konfigurację w całej aplikacji — C-33), nie w zakładkę.
Widok szczegółu dostaje `breadcrumb`, lista przestrzeni `density="comfortable"`.

Wpis w `src/lib/ui/view-contract.json`: klucz **`rosliny`** (klucz to moduł, nie plik),
`status: "done"`, `entries: [6 plików wyżej]`.

### 5.2 Tryb przestrzeni steruje prezentacją, nie uprawnieniem

`src/modules/rosliny/lib/tryb.ts` — czysta funkcja `poleWidoczne(kind, pole)` + `etykietaFazy(kod,
kind)`. Reguła z AC-2/AC-3: tryb **domyślnie chowa** pola zawodowe, ale każdy widok ma „pokaż
zaawansowane"; **nic nie jest blokowane**. Funkcja jest czysta i testowana jednostkowo — to jest
najprostszy sposób, żeby AC-2 dało się zweryfikować bez klikania.

### 5.3 Reszta zasad

- **Kolory wyłącznie ze zmiennych CSS** (C-30); na kolorowych przyciskach `var(--on-accent)`.
  Faza rozwojowa i status roślin dostają kolory z `--accent-*`, **nie** hexy — inaczej
  `check:ui-contract` zażąda deklaracji roli koloru.
- **Mobile-first (C-31):** brak własnego sidebara na telefonie (nawigacja boczna modułu idzie przez
  `sideNav` deklaracji i rysuje ją powłoka); cele dotyku `py-3`; stopki modali z
  `env(safe-area-inset-bottom)`. Segment hobby to głównie telefon — widok rośliny projektujemy jako
  jednokolumnowy, a „dziś do zrobienia" jest pierwszą rzeczą na `/rosliny`.
- **Potwierdzenia (C-34):** `confirmDialog({ title: "Usunąć roślinę?", destructive: true })` —
  `destructive` deklarowane **jawnie**; nigdy `window.confirm`.
- **Teksty (C-32):** wszystkie do `messages/pl.json` pod `modules.rosliny.<Komponent>.<klucz>`,
  czytane przez `useTranslations`. `check:i18n` jest **regułą bezwzględną** (097) — zero literałów
  z polskimi znakami w komponentach; każde `t("klucz")` musi się rozwiązywać do istniejącego wpisu.
- **Daty i liczby** przez `@/platform/i18n/format`; „dziś/zaległe" wyłącznie przez `userTime.ts`
  (strefa użytkownika) — inaczej agenda kłamie o północy.

---

## 6. AI i integracje (C-23, C-40)

### 6.1 Cztery zastosowania modelu, cztery typy operacji

| Funkcja | Typ operacji (`resolver.ts`) | Pamięć treści | Sekcja |
|---|---|---|---|
| Identyfikacja ze zdjęcia | `vision` | **on-demand** (każde zdjęcie inne) | — |
| Diagnoza ze zdjęcia + kontekst | `vision` | **on-demand** (klik = żądanie) | — |
| Plan sezonu przestrzeni | `reasoning` | **remembered** | `rosliny.planSezonu` |
| Wnioski o przestrzeni | `reasoning` | **remembered** | `rosliny.wnioski` |

Model i provider **wyłącznie z konfiguracji** (C-40) — zero hardcode'u. Diagnoza dostaje w prompcie
kontekst rośliny (gatunek, miejsce, ostatnie zabiegi, pogoda) i **wymuszony poziom pewności z
dopuszczalnym „nie wiem"** (AC-19); odpowiedź jest JSON-em walidowanym `lib/llm/json.ts`.

`hashInputs` dla planu sezonu: id przestrzeni + tryb + miesiąc + lista gatunków + `userContextStamp`.
Dla wniosków: + liczba roślin i zdarzeń. Oba wołane z `mode` z `resolveSectionMode` → mogą wrócić
`PendingContent` (AC-21), rysowane przez `AiContentPending`, nigdy jako błąd.

**Wpisy wymagane przez bramki:**
- `src/platform/ai/contentMemory.ts` → `AiContentKind` += `"rosliny.planSezonu" | "rosliny.wnioski"`.
- `src/platform/ai/sectionMode.ts` → **obie** etykiety w `AI_SECTION_LABELS` (mapa pokrywa całą unię,
  więc brak wpisu = błąd typów) + obie w `AI_SECTION_KINDS` (pokazują się przy wejściu).
- `src/lib/ai/content-memory-coverage.json` → wpis dla `src/modules/rosliny/actions/ai.ts`
  z klasyfikacją i powodem.
- `src/lib/ai/cost-badge-coverage.json` → **nie trzeba**, jeśli plik importuje `usageFromChat`
  i przekazuje zużycie dalej (a przekazuje — `AiCostBadge` z **wymaganym** propem `akcja`:
  „Diagnoza rośliny", „Plan sezonu", „Rozpoznanie rośliny", „Wnioski o przestrzeni").

### 6.2 Asystent — odczyty i akcje

`src/modules/rosliny/ai/` = `catalog.ts` (tekst promptu), `readTools.ts`, `executor.ts`, `index.ts`
(wzorzec 102, ładowany leniwie z `module.server.ts`).

- **Read-toole:** `list_plant_spaces`, `list_plants` (filtry: przestrzeń, status, gatunek; `offset`,
  `take` — lekcja 112), `plant_care_agenda`.
- **Akcje zapisu:** `create_plant_space`, `create_plant`, `log_plant_care`, `add_plant_measurement`.
  Żadna nie jest destrukcyjna — usuwanie świadomie **nie** wchodzi (spec AC-23 go nie wymaga,
  a `DESTRUCTIVE_ACTION_TYPES` to lista, którą trzeba by rozszerzać bez potrzeby; C-53).
- Wymagane wpięcia, inaczej build pada:
  `src/platform/ai/aiAction.ts` → `AIActionModule` += `"rosliny"`;
  `src/platform/ai/actionContract.ts` → cztery wpisy z **polskimi etykietami** i kontrolkami pól;
  egzekutor w `/api/llm/home/execute` (`check:actions`);
  `src/lib/ai/action-coverage.json` → wpis dla **każdej** akcji i **każdego odczytu** modułu
  (`kind`, `status`, `access: "owner"`, `action`) — `check:ai-coverage` + `check:ai-access` żądają
  też **faktycznego guardu w ciele akcji** (mamy `assertPlantAccess`).

### 6.3 Integracje wychodzące — wyłącznie przez kontrakty

| Kierunek | Wywołanie | Gdzie |
|---|---|---|
| Pogoda → Rośliny | `getWeather`, `getLocations` z `@/modules/weather/contract` | wyliczanie terminu opieki, ostrzeżenie o przymrozku |
| Rośliny → Zadania | `createTask` z `@/modules/tasks/contract` | pozycje planu sezonu (AC-20) |
| Rośliny → Zakupy | `resolveOrCreateList` + dodanie pozycji | nasiona/nawozy (AC-15) |
| Rośliny → Portfel | `bookAutoExpense` (`sourceModule: "rosliny"`, `sourceId`) | koszt zabiegu (AC-15) |
| Rośliny → Kuchnia | dodanie do spiżarni z kontraktu Kuchni | zbiór → spiżarnia (AC-15) |

**Moduł nie buduje u siebie zapasów, faktur ani księgowości** — to jest granica ze speca §5 i
recenzja ma jej pilnować.

### 6.4 Kalendarz, powiadomienia, pulpit, kosz, retencja

- **Kalendarz:** `src/modules/rosliny/calendar.ts` — zaplanowane zabiegi w zakresie dat; wpięcie
  przez `calendar` w `module.server.ts` (korzeń zbiera sam).
- **Powiadomienia:** `syncReminders` w `src/actions/notifications.ts` dostaje **dziesiąte** zapytanie
  — `plantCareTask` z `nextDueAt` w oknie 3 dni. **Decyzja odnotowana:** to nie jest „równoległa
  lista modułów" w rozumieniu C-36 (ta reguła dotyczy rejestracji modułu); `syncReminders` jest
  istniejącym agregatem warstwy aplikacji, który tak samo czyta `petCareTask` i osiem innych tabel.
  Dołożenie jedenastego wzorca (własny job) byłoby *większą* zmianą niż jedno zapytanie (C-53).
- **Pulpit:** `src/modules/rosliny/dashboard.ts` (ile roślin czeka na opiekę + krótka agenda) +
  wpis w `src/lib/dashboardContributors.ts`; `DashboardSnapshot` w `@/modules/home/contract`
  dostaje `plantCareDue` i `plantAgenda`. **Trasa `app/page.tsx` pozostaje nietknięta.**
- **Kosz (C-24):** `TrashModule` w `src/platform/trash/trash.ts` += `"rosliny"`; `recordTrash` przy
  usuwaniu rośliny i przestrzeni; gałąź przywracania w `src/actions/trash.ts` + `revalidatePath`.
- **Retencja:** `src/modules/rosliny/retention.ts` — polityka na zdjęcia dziennika roślin
  zakończonych; **rejestr zabiegów jawnie WYŁĄCZONY** z automatycznego usuwania (dokumentacja
  o wymogu ustawowym) — powód zapisany w pliku, bo tam go przeczyta recenzent.
- **Udostępnianie (C-17):** `src/modules/rosliny/sharing.ts` deklaruje `rosliny.space` (operacje
  `space.read: viewer`, `space.edit: editor`) i `rosliny.plant` z **rodzicem** `rosliny.space`
  (dziedziczenie robi platforma — moduł nie pisze własnej reguły). `ShareDialog` wpięty w nagłówek
  przestrzeni. Wpis w `src/lib/sharing-classification.json` (`rodzaj: "zasob"`).

---

## 7. Pliki do utworzenia / zmiany

**Nowe — moduł (`src/modules/rosliny/`)**

| Plik | Po co |
|---|---|
| `module.ts`, `module.server.ts`, `contract.ts` | Deklaracja + wkład serwerowy + granica |
| `sharing.ts`, `dashboard.ts`, `calendar.ts`, `retention.ts` | Wkłady do platformy |
| `actions/{przestrzenie,miejsca,rosliny,opieka,dziennik,zbiory,ewidencja,gatunki,ai}.ts` | Server Actions |
| `lib/{typy,tryb,sharingGuard,fenologia,eksportEwidencji}.ts` | Uniony TS, reguła trybu, guard, słownik BBCH, eksport |
| `domain/{harmonogram,plodozmian}.ts` | **Czyste reguły z testami**: termin następnego zabiegu (gatunek × miejsce × sezon × pogoda) + uzasadnienie; ostrzeżenie płodozmianowe z historii miejsca i rodziny |
| `ai/{catalog,readTools,executor,index}.ts` | Wkład do asystenta |
| `ui/*.tsx` (6 widoków + `RoslinySideNav`, formularze, karty) | Interfejs |
| `domain/__tests__/*.test.ts`, `lib/__tests__/tryb.test.ts` | Testy reguł |

**Nowe — trasy i migracje**

`src/app/rosliny/layout.tsx` (bramka), `page.tsx`, `[spaceId]/page.tsx`,
`[spaceId]/roslina/[plantId]/page.tsx`, `opieka/page.tsx`, `katalog/page.tsx`, `ewidencja/page.tsx`;
`prisma/migrations/0272_modul_roslin/migration.sql`,
`prisma/migrations/0273_katalog_gatunkow/migration.sql`.

**Zmiany w istniejących plikach**

| Plik | Zmiana |
|---|---|
| `prisma/schema.prisma` | 10 modeli + relacja `Workspace` |
| `src/lib/modules.tsx`, `src/lib/modules.server.ts` | Rejestracja modułu |
| `src/lib/dashboardContributors.ts`, `src/lib/sharingResources.ts`, `src/lib/retention/polityki.ts`, `src/lib/ai/catalog.ts` | Korzenie kompozycji |
| `src/modules/home/contract.ts` | `DashboardSnapshot` += `plantCareDue`, `plantAgenda` |
| `src/platform/ai/aiAction.ts`, `actionContract.ts`, `contentMemory.ts`, `sectionMode.ts` | Unie + kontrakt akcji + rodzaje treści |
| `src/app/api/llm/home/execute/route.ts` | Egzekutory czterech akcji |
| `src/actions/notifications.ts` | `syncReminders` += zapytanie o zabiegi |
| `src/platform/trash/trash.ts`, `src/actions/trash.ts` | Kosz dla roślin i przestrzeni |
| `messages/pl.json` | Teksty modułu |
| `src/lib/ui/view-contract.json`, `src/lib/ai/action-coverage.json`, `src/lib/ai/content-memory-coverage.json`, `src/lib/sharing-classification.json`, `src/lib/domain-coverage.json` | Manifesty bramek |

---

## 8. Bramki i weryfikacja (C-50, C-13)

**Lokalnie — nigdy przeciw prod DB (C-13):**
```bash
pg_ctlcluster 16 main start
# .env.local → DATABASE_URL/DIRECT_URL na 127.0.0.1:5432 (omnia/omnia_dev)
cd worldofmag && npx prisma migrate deploy && npx prisma generate
npm run check:migrations && npm run check:schema-drift && npm run check:module-registry \
  && npm run check:boundaries && npm run check:ui-contract && npm run check:route-gating \
  && npm run check:actions && npm run check:ai-coverage && npm run check:cost-badge \
  && npm run check:content-memory && npm run check:pagination && npm run check:i18n \
  && npm run check:owner-columns && npm run check:logs && npm run check:workspace-fill \
  && npm run check:tailwind && npm run check:test-types
npx tsc --noEmit -p tsconfig.test.json && npx next lint --dir src && npx next build
```
**Zatrzymujemy się przed `scripts/migrate.js`** — ten krok rusza prod DB.

### Mapowanie AC → sposób weryfikacji

| AC | Weryfikacja |
|---|---|
| AC-1, AC-4, AC-5, AC-6 | Test integracyjny modułu na lokalnej bazie (wzorzec `pets/__tests__/profilZwierzecia.integration.test.ts`) |
| AC-2, AC-3 | **Test jednostkowy `lib/tryb.ts`** — tablica (tryb × pole) → widoczność; plus przegląd widoku |
| AC-7 | Test: usunięcie → wiersz w `TrashItem` → przywrócenie odtwarza byt |
| AC-8, AC-9, AC-10, AC-11 | **Testy `domain/harmonogram.ts`**: termin i uzasadnienie dla (gatunek, miejsce, sezon, prognoza); przeliczenie od faktycznego wykonania; odsunięcie po opadach |
| AC-12 | Wkład kalendarza zwraca zabiegi w zakresie; `syncReminders` tworzy powiadomienie (idempotentnie po `dedupeKey`) |
| AC-13, AC-14 | Test integracyjny: wpis z fotografią i pomiar z jednostką na osi czasu |
| AC-15 | Test: zbiór → wywołanie kontraktu Kuchni / Portfela / Zakupów (mock kontraktu) |
| AC-16, AC-17 | Test: wyszukanie w katalogu; kopia do przestrzeni ma `origin` i nie rusza wiersza systemowego |
| AC-18, AC-19 | Test kontraktu odpowiedzi modelu (walidacja JSON, `confidence`, dopuszczalne „nie wiem"); przegląd promptu pod kątem kontekstu rośliny |
| AC-20 | Test: pozycja planu → `createTask`; `hashInputs` zawiera lokalizację i tryb |
| AC-21 | Test `rememberedContent` z `mode` — drugie wejście nie woła modelu; `stale` zapala znacznik |
| AC-22 | `check:cost-badge` + przegląd: `AiCostBadge` z propem `akcja` w czterech miejscach |
| AC-23 | `check:actions`, `check:ai-coverage`, `check:ai-access` + test „bypass" (wzorzec `assistantBypassPets`) |
| AC-24, AC-25 | Test: zapis kompletu pól ewidencji; eksport za okres zawiera wszystkie kolumny |
| AC-26 | **Test `domain/plodozmian.ts`** — historia miejsca + rodzina → ostrzeżenie, nie blokada |
| AC-27 | `check:route-gating` + test scenariusza „adres wpisany z ręki" |
| AC-28 | **Tabela prawdy** dla `rosliny.space`/`rosliny.plant` (wzorzec `truthTablePets`), porównana komórka po komórce |
| AC-29 | Test wkładu pulpitu + `check:module-registry` (wpięcie w obie strony) |
| AC-30 | Pełna sekwencja bramek wyżej |

---

## 9. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja |
|---|---|
| **Pokusa zadeklarowania `jobs` „na zapas"** — wzorzec 102 ma to pole, więc łatwo je skopiować | **Decyzja: modułu nie deklarujemy z `jobs`.** Nie ma handlera: powiadomienia idą przez `syncReminders`, a treści AI przez `rememberedContent` na żądanie. Pusty rejestr byłby plikiem bez konsumenta (C-35) i wciągałby graf serwerowy bez powodu |
| **`check:i18n` jest regułą bezwzględną** — jeden literał z polskim znakiem wywala build | Teksty piszemy od razu do `messages/pl.json`; zdania rozbite `<strong>` unikamy (albo `t.rich`) |
| **`check:pagination` bez wyjątków** | Każdy `findMany` z `take` lub komentarzem `paginacja: kompletny — <powód>` przy wywołaniu |
| **`check:owner-columns`** — dynamiczne `where` ukrywa złą nazwę kolumny przed `tsc` | Filtry budujemy helperami własności, nie ręcznymi obiektami |
| **`check:tailwind`** — klasy używane tylko w `src/modules/` bywały wycinane | Globy już pokrywają `src/modules`; nie dokładamy nowego katalogu UI poza nim |
| **Rozjazd katalogu systemowego i kopii użytkownika** | Kopia trzyma `catalogKey`; zmiana wiersza systemowego **nie** wraca do kopii — świadomie (użytkownik mógł ją zmienić), tak jak w Wiadomościach |
| **Prompt diagnozy rośnie i drożeje** | Kontekst ograniczony do 10 ostatnich zdarzeń i jednej prognozy; `effort` z konfiguracji; koszt widoczny |
| **Duży diff utrudnia recenzję** | Warstwy w `tasks.md`: migracja → domena+testy → akcje → widoki → AI → wpięcia → bramki, każda kończy się zieloną bramką |

**Rollback.** Kod: rewert commitów feature'a. Migracja: tabele są **nowe i niepowiązane z istniejącymi
danymi** poza FK do `Workspace`, więc wycofanie to `DROP TABLE` w odwrotnej kolejności FK +
`DELETE FROM "Permission" WHERE slug='module.rosliny'`. Nic istniejącego nie jest modyfikowane
destrukcyjnie — **żadnego `ALTER … DROP COLUMN`** na tabelach sprzed tego feature'a. Zgodnie z
runbookiem: rollback kodu i rollback migracji są rozłączne i w tej kolejności.

---

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-15** — ręczne migracje 0272/0273 z `next:migration`, seed idempotentny SQL, zero
      enumów Prisma (wszystkie rodzaje to `String` + union TS), weryfikacja bez prod DB, DDL czytany
      pod kątem `DROP`/`ALTER`
- [x] **C-20..C-25** — Server Actions z `revalidatePath`, własność przez helpery przestrzeni (stan po
      079), guard modułu jako nakładka na `platform/sharing` z **własnym** katalogiem, nowy slug
      RBAC seedowany migracją, każda `AIAction` z egzekutorem, soft-delete do kosza
- [x] **C-30..C-35** — kolory ze zmiennych CSS, mobile-first bez drugiego sidebara, teksty przez
      `t()` do `messages/pl.json`, widoki przez `ModuleView` ze `state` i slotem `settings`,
      `confirmDialog` z jawnym `destructive`, brak komponentu bez konsumenta
- [x] **C-36** — jedna deklaracja modułu, pola leniwe, `contract.ts` niosący tylko to, czego chcą
      konsumenci, wnętrze importowane względnie, obce moduły wyłącznie przez kontrakt, wpięcia
      w korzenie kompozycji sprawdzane w obie strony
- [x] **C-40, C-41** — model i provider z konfiguracji per typ operacji, zero hardcode'u, żadnych
      kluczy w kodzie
- [x] **C-53 (minimalizm)** — **zero nowych zależności**; brak własnego magazynu, księgowości i
      sprzedaży (integracja przez kontrakty); brak akcji usuwających w asystencie; **wykreślony
      `jobs/index.ts`**, gdy okazało się, że nie ma handlera; katalog gatunków wzorcem istniejącym
      (082), a nie nowym pomysłem
- [x] **C-54** — plan zgodny ze `spec.md`; dwa miejsca, w których konstytucja opisuje stan sprzed
      079/046 (C-21 „ownerId", C-22 „`permissions.ts`"), rozstrzygnięte na korzyść `CLAUDE.md`
      i kodu, z odnotowaniem powodu w §3 i §4 — bez cichego odstępstwa
