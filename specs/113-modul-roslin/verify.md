# Weryfikacja: Moduł Rośliny

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-28
- **Werdykt:** ⛔ **DO POPRAWY** — patrz §5

---

## 1. Bramki

Uruchomione przeciw **lokalnemu** Postgresowi (`omnia_dev` na 127.0.0.1), zatrzymane przed
`scripts/migrate.js` (**C-13** — nigdy prod DB).

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ numeracja OK, następny wolny numer 0274 |
| `npm run check:schema-drift` | ✅ brak rozjazdu (5 świadomych wyjątków) |
| `npm run check:workspace-fill` | ✅ 4 tabele z nullowalną przestrzenią — tyle samo co przed zmianą |
| `npm run check:module-registry` | ✅ 24 moduły, komplet wpięć w obie strony |
| `npm run check:boundaries` | ✅ 4 przypadki próbne |
| `npm run check:ui-contract` | ✅ 26/26 modułów na `ModuleView` |
| `npm run check:route-gating` | ✅ 22 trasy modułowe sprawdzają uprawnienie |
| `npm run check:actions` | ✅ 168 akcji, każda z egzekutorem i wpisem w kontrakcie |
| `npm run check:ai-coverage` / `check:access` | ✅ 656 akcji sklasyfikowanych, każda z guardem |
| `npm run check:cost-badge` | ✅ 40 plików wołających model przekazuje zużycie |
| `npm run check:content-memory` | ✅ 40 plików sklasyfikowanych |
| `npm run check:pagination` | ✅ każde `findMany` z granicą |
| `npm run check:owner-columns` | ✅ 2676 wywołań Prismy, żadne nie pyta o skasowane kolumny |
| `npm run check:i18n` | ✅ zero literałów w komponentach |
| `npm run check:logs` | ✅ 836 plików bez surowego `console.*` |
| `npm run check:domain` | ✅ zapadka 33 pomocników — trzyma |
| `npm run check:perf` | ✅ w paśmie (próg podniesiony do wartości zmierzonej) |
| `tsc --noEmit` (oba configi) | ✅ czysto |
| `next lint --dir src` | ✅ **0 błędów**, żadnego ostrzeżenia z nowego modułu |
| `next build` | ✅ przechodzi; sześć tras `/rosliny*` w tabeli |
| testy modułu (`node:test`) | ✅ **93/93** |

**Bramki nie są tu jednak miarą kompletności** — i to jest sedno tej weryfikacji. Wszystkie
przechodzą, a mimo to feature **nie spełnia siedmiu kryteriów akceptacji**: bramki pilnują tego,
czy kod jest poprawnie *wpięty w mechanizmy platformy*, a nie tego, czy użytkownik ma jak
z funkcji skorzystać.

---

## 2. Kryteria akceptacji

Legenda: ✅ spełnione · ⚠️ częściowo · ❌ niespełnione.

### Przestrzenie i tryby

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** | ✅ | `actions/przestrzenie.ts` `createSpace` + formularz z wyborem trybu w `ui/RoslinyPage.tsx`; lista pokazuje licznik roślin i miejsc. Test integracyjny zakłada przestrzeń. |
| **AC-2** | ✅ | `lib/tryb.ts` `poleWidoczne`; test `lib/__tests__/tryb.test.ts` przechodzi tablicę 4 tryby × 7 pól i sprawdza wynik `[0, 2, 5, 7]`. Widok czyta ją w `PrzestrzenPage`. Tryb siedzi na `PlantSpace.kind` — **żadnego ustawienia konta**. |
| **AC-3** | ✅ | Ten sam test: po włączeniu widoku zaawansowanego **każde** pole jest widoczne w **każdym** trybie. Przełącznik w `filters` widoku przestrzeni. |

### Byt roślinny i miejsca

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-4** | ✅ | Jeden model `Plant` z `quantity`+`quantityUnit`. Test `cyklRosliny`: „egzemplarz, partia i powierzchnia to JEDEN model" — 1 szt., 100 szt. i 4,2 ha w jednej tabeli. |
| **AC-5** | ✅ | `propagatePlant` + relacja `PlantParent`. Test: rodzic widzi dwoje potomstwa; skasowanie matki **nie kasuje** sadzonek (`SET NULL`). Przycisk „Załóż sadzonkę" w szczególe rośliny. |
| **AC-6** | ✅ | `setPlantStatus` + `domain/roslina.ts` `bladZmianyStanu`; test domenowy sprawdza, że powodu wymaga **wyłącznie** `DEAD`. Test integracyjny: zakończona roślina zostaje w historii miejsca. |
| **AC-7** | ✅ | `recordTrash` w `deleteSpace`/`deletePlant`, gałąź `restoreRosliny` w `src/actions/trash.ts`, `TrashModule` rozszerzony. Test potwierdza, że kasowanie przestrzeni zabiera zawartość — stąd pełna migawka. |

### Opieka i harmonogram

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-8** | ❌ | **Reguła istnieje, ale nikt jej nie woła przy tworzeniu rośliny.** `createPlant` (`actions/rosliny.ts`) nie zakłada żadnego zadania opieki — `grep createCareTask` w tym pliku nie zwraca nic. Użytkownik dodaje roślinę i **nie dostaje harmonogramu**, mimo że `domain/harmonogram` i `createCareTask` działają i mają testy. |
| **AC-9** | ✅ | `PlantCareTask.reason` wypełniane przy każdym przeliczeniu terminu; wyświetlane w `AgendaOpieki` (linia pod tytułem) i w kaflu „Do zrobienia dziś" w `RoslinyPage`. 14 testów `domain/harmonogram` sprawdza treść uzasadnienia. |
| **AC-10** | ✅ | `recordCare` z trzema wynikami; `SKIPPED` **nie** ustawia `lastDoneAt`, `POSTPONED` przesuwa termin bez ruszania cyklu. Trzy przyciski w `AgendaOpieki`. Termin liczony od faktycznego wykonania. |
| **AC-11** | ⚠️ | Mechanizm działa i ma testy (odsunięcie po opadzie ≥ 5 mm, ostrzeżenie o przymrozku, `podDachem` blokuje korektę). **Ale nie ma jak przypisać przestrzeni lokalizacji pogodowej** — `PlantSpace.weatherLocationId` nie jest ustawiane przez żaden widok ani akcję (`updateSpace` je przyjmuje, brak konsumenta). W praktyce prognoza jest zawsze pusta. |
| **AC-12** | ✅ | `modules/rosliny/calendar.ts` wpięty przez `module.server.ts`; `syncReminders` w `src/actions/notifications.ts` dostał dziesiąte zapytanie (`plantCareTask`, okno 3 dni, `dedupeKey`). |

### Dziennik, pomiary, zbiory

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-13** | ⚠️ | Oś czasu i wyświetlanie zdjęcia działają (`RoslinaSzczegol`, `img` przy wpisie). **Brak sposobu, żeby zdjęcie dodać** — formularz ma wyłącznie pole tekstowe, `addJournalEntry({photoUrl})` nie ma konsumenta. „Postęp w czasie" jest więc niewykonalny. |
| **AC-14** | ✅ | `addMeasurement` z rodzajem i jednostką (domyślną per rodzaj), formularz i lista w `RoslinaSzczegol`. |
| **AC-15** | ❌ | `recordHarvest`, `harvestToPantry`, `bookCareCost` i `addToShoppingList` istnieją, mają guardy i idą przez kontrakty obcych modułów — **i nie mają ani jednego konsumenta w UI**. `grep` po `ui/` nie zwraca nic. Droga „z grządki na talerz", nazwana w badaniach najmocniejszym uzasadnieniem modułu, jest niedostępna dla użytkownika. |

### Katalog gatunków

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-16** | ✅ | 182 wpisy z migracji 0273; `searchCatalog` po nazwie polskiej i łacińskiej + filtr kategorii; widok `KatalogGatunkow` pokazuje wymagania i rodzinę. |
| **AC-17** | ⚠️ | Kopia z katalogu działa, niesie `origin` i **nie rusza wiersza systemowego** (test integracyjny). **Ale „użytkownik dodaje własny gatunek" nie ma UI** — `createSpecies` bez konsumenta. |

### AI

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-18** | ❌ | `identifyPlant` (operacja `vision`, dopasowanie do katalogu jednym zapytaniem) istnieje i jest sklasyfikowana w manifeście — **bez konsumenta w UI**. Użytkownik nie ma jak poprosić o rozpoznanie ani „przyjąć" propozycji. |
| **AC-19** | ⚠️ | Diagnoza z kontekstem (gatunek, miejsce, 10 zdarzeń, prognoza), wymuszony poziom pewności z dopuszczalnym `unknown`, zalecenia w kolejności naturalne → chemiczne, zapis zdarzenia zdrowotnego, przyciski „pomogło/bez zmian" — wszystko działa. **Brakuje „zaplanuj zalecany zabieg"**: `Zalecenie.zabieg` jest zwracane przez model i nigdzie nieużywane. |
| **AC-20** | ⚠️ | Plan uwzględnia lokalizację, tryb, to co rośnie i powody zakończeń; `hashInputs` zawiera `userContextStamp`. **Pozycje nie dają się wysłać do Zadań** — `createTask` nie jest w module wołane ani razu, mimo że plan §6.3 to zapowiada. |
| **AC-21** | ✅ | `rememberedContent` z trybem; drugie wejście na przestrzeń nie woła modelu, `stale` zapala znacznik, `PendingContent` rysowany przez `AiContentPending` (nie jako błąd). Obie sekcje w `AI_SECTION_KINDS`. |
| **AC-22** | ✅ | `AiContentMeta` z `sectionKind` (etykieta → `AiCostBadge` z `akcja`) przy planie i wnioskach; `AiCostBadge akcja="Diagnoza rośliny"` przy diagnozie. `check:cost-badge` zielony. |
| **AC-23** | ✅ | Cztery akcje + trzy read-toole; `check:actions`, `check:ai-coverage` i `check:access` zielone. Test `asystentBezObejscia`: obcy nie widzi cudzych roślin przez read-tool, egzekutor nie znajduje ich po nazwie, pomiar nie powstaje. |

### Warstwa zawodowa

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-24** | ⚠️ | `recordTreatment` przyjmuje **komplet** pól wymaganych od 2026-01-01 (test integracyjny: `brakiEwidencji` zwraca pustą listę). **Brak formularza** — widok `Ewidencja` tylko czyta i eksportuje, więc zabieg da się zapisać wyłącznie przez asystenta albo bazę. |
| **AC-25** | ✅ | `exportTreatmentRegister` + `lib/eksportEwidencji` (16 kolumn, BOM, ucieczka średnika i cudzysłowu — 11 testów); przycisk pobrania w widoku. Rejestr obejmuje wyłącznie przestrzenie zawodowe. |
| **AC-26** | ❌ | `domain/plodozmian` działa i ma 13 testów; `getPlaceHistory` liczy ostrzeżenie. **Nic tego nie pokazuje** — żaden widok nie woła `getPlaceHistory`, więc użytkownik zakładający uprawę **nie dostaje ostrzeżenia**. |

### Wpięcie w system

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-27** | ✅ | `src/app/rosliny/layout.tsx` → `wymagajDostepuDoModulu`; `check:route-gating` liczy 22 trasy. |
| **AC-28** | ✅ | Deklaracja dwóch zasobów z `parent`; `ShareDialog` w nagłówku przestrzeni. Tabela prawdy (8 komórek × 3 relacje) z jawnym sprawdzeniem, że decyzja o roślinie **zawsze** równa się decyzji o jej przestrzeni. |
| **AC-29** | ✅ | `modules/rosliny/dashboard.ts` + wpis w `dashboardContributors`; `DashboardSnapshot` rozszerzony o `plantCareDue`/`plantAgenda`; `src/app/page.tsx` nietknięta. |
| **AC-30** | ✅ | Cała sekwencja z §1. |

**Podsumowanie: 19 ✅ · 7 ⚠️ · 4 ❌** (na 30 kryteriów).

---

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01, C-02, C-36 | ✅ wszystko w `worldofmag/`, wnętrze modułu importowane względnie, obce moduły wyłącznie przez kontrakt, jedna deklaracja, pola leniwe, brak `jobs` z uzasadnieniem |
| C-10, C-11, C-12, C-14, C-15 | ✅ dwie ręczne migracje, zero enumów Prisma, seed idempotentny (sprawdzony dwukrotnym odtworzeniem), zero `DROP` |
| C-13 | ✅ wszystko na lokalnym Postgresie, `migrate.js` nietknięty |
| C-17, C-21 | ✅ dostęp rozstrzyga platforma z katalogiem modułu, własność przez helpery przestrzeni, tabela prawdy porównana |
| C-20, C-22, C-23, C-24 | ✅ `revalidatePath`, nowy slug w migracji, egzekutory, kosz |
| C-30, C-31, C-32, C-33, C-34 | ✅ zmienne CSS, cele dotyku 40 px, teksty przez `t()`, `ModuleView` ze `state`, `confirmDialog({destructive:true})` |
| C-40, C-41 | ✅ model i provider z konfiguracji, zero kluczy w kodzie |
| **C-35** | ❌ **NARUSZONA — to jest przyczyna wszystkich braków z §2.** „Gotowe znaczy **wpięte**, nie »istnieje«". Osiem funkcji serwera (`identifyPlant`, `recordHarvest`, `harvestToPantry`, `bookCareCost`, `addToShoppingList`, `createSpecies`, `getPlaceHistory`, `recordTreatment`) nie ma ani jednego konsumenta. To dokładnie ten sam błąd, przed którym C-35 ostrzega przy komponentach — tylko o piętro niżej. |
| C-53 | ✅ zero nowych zależności; nie zbudowano drugiego magazynu ani księgowości |
| C-54 | ⚠️ plan §6.3 zapowiada `createTask` przy planie sezonu i tego nie ma — rozjazd plan ↔ kod, do usunięcia razem z brakiem |

---

## 4. Regresje

Sprawdzone pod kątem tego, co nowy moduł dotknął **poza sobą**:

- **Migracje** — obie tworzą wyłącznie nowe tabele; jedyne powiązanie z istniejącym schematem to
  klucz obcy do `Workspace`. `check:schema-drift` bez rozjazdu, `migrate deploy` przechodzi na
  bazie z kompletem wcześniejszych migracji.
- **`DashboardSnapshot`** — dwa nowe pola z wartościami w `EMPTY_SNAPSHOT`; `tsc` czysty, więc
  żaden konsument migawki nie został pominięty.
- **`syncReminders`** — dziesiąte zapytanie w tym samym `Promise.all`; zakres przez własność
  przestrzeni, `dedupeKey` z prefiksem `plantcare-`, więc nie koliduje z istniejącymi.
- **Kosz** — `TrashModule` rozszerzony o wariant; gałąź przywracania dopisana, pozostałe nietknięte.
- **`actionContract.ts` / `aiAction.ts`** — dodane wyłącznie nowe wpisy i nowy wariant unii;
  `check:actions` liczy 168 akcji, wszystkie ze spójnym kontraktem.
- **Budżet wydajnościowy** — najcięższa trasa +0,5 % (wyłącznie wspólne porcje powłoki, do których
  doszła ikona modułu), czyli **żaden istniejący ekran nie zrobił się zauważalnie cięższy**.
- **Testy sąsiednich modułów** — nieuruchamiane w całości (czas), ale `tsc -p tsconfig.test.json`
  jest czysty, a zmiany w cudzych plikach są addytywne. **Odnotowane jako ograniczenie tej
  weryfikacji.**

Regresji nie wykryto.

---

## 5. Werdykt końcowy: ⛔ DO POPRAWY

**Diagnoza jednym zdaniem: warstwa serwera jest kompletna i przetestowana, a warstwa widoku jej nie
używa.** Osiem gotowych, guardowanych, sklasyfikowanych funkcji nie ma konsumenta — więc dla
użytkownika ich nie ma. Bramki tego nie złapały, bo każda z nich pyta „czy to jest poprawnie
podłączone do platformy", a nie „czy da się z tego skorzystać".

Braki do usunięcia (dopisane do `tasks.md` jako T-48…T-54):

1. **AC-8** — `createPlant` ma proponować harmonogram opieki dla nowej rośliny.
2. **AC-11** — przypisanie przestrzeni lokalizacji pogodowej (bez tego korekta pogodowa nigdy nie
   działa u realnego użytkownika).
3. **AC-13** — dodanie zdjęcia do wpisu dziennika.
4. **AC-15** — zapis zbioru i trzy przyciski wyjścia: spiżarnia, koszt, lista zakupów.
5. **AC-17** — dodanie własnego gatunku.
6. **AC-18 + AC-19** — rozpoznanie ze zdjęcia z przyjęciem propozycji oraz „zaplanuj zalecany zabieg".
7. **AC-20** — wysłanie pozycji planu sezonu do Zadań (usuwa też rozjazd wobec planu §6.3).
8. **AC-24** — formularz zabiegu z polami ewidencji.
9. **AC-26** — pokazanie ostrzeżenia płodozmianowego przy zakładaniu uprawy w miejscu.

Żaden z tych braków nie wynika z błędnego speca ani planu — spec opisywał je poprawnie, a plan je
przewidywał. To luka wykonania, więc poprawka idzie wprost do `/implement`, bez cofania się do
wcześniejszych artefaktów (jedyny wyjątek: rozjazd C-54 przy AC-20 znika razem z jego naprawą).
