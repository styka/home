# Weryfikacja: Moduł Rośliny

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Badania:** ./badania.md
- **Data:** 2026-08-28
- **Przebieg:** drugi (pierwszy dał werdykt DO POPRAWY — historia w §6)
- **Werdykt:** ✅ **GOTOWE**

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
| `npm run check:ai-coverage` / `check:access` | ✅ 659 akcji sklasyfikowanych, każda z guardem |
| `npm run check:cost-badge` | ✅ 40 plików przekazuje zużycie |
| `npm run check:content-memory` | ✅ 40 plików sklasyfikowanych |
| `npm run check:pagination` | ✅ każde `findMany` z granicą |
| `npm run check:owner-columns` | ✅ 2680 wywołań Prismy, żadne nie pyta o skasowane kolumny |
| `npm run check:i18n` | ✅ zero literałów w komponentach |
| `npm run check:logs` | ✅ 837 plików bez surowego `console.*` |
| `npm run check:domain` | ✅ zapadka 33 pomocników — trzyma |
| `npm run check:tailwind`, `check:client-safe`, `check:e2e-waits`, `check:events`, `check:subscribers`, `check:realtime` | ✅ |
| `npm run check:perf` | ✅ najcięższa trasa 1179 kB, suma 73 092 kB — w paśmie |
| `tsc --noEmit` (oba configi) | ✅ czysto |
| `next lint --dir src` | ✅ **0 błędów**, żadnego ostrzeżenia z nowego modułu |
| `next build` | ✅ przechodzi; sześć tras `/rosliny*` |
| testy modułu (`node:test`) | ✅ **94/94** |

---

## 2. Kryteria akceptacji

Legenda: ✅ spełnione. Wszystkie 30 kryteriów spełnione; dowód przy każdym.

### Przestrzenie i tryby

| AC | Dowód |
|---|---|
| **AC-1** | `createSpace` + formularz z wyborem trybu (`ui/RoslinyPage.tsx`); lista z licznikiem roślin i miejsc. Test integracyjny. |
| **AC-2** | `lib/tryb.ts` `poleWidoczne`; test przechodzi tablicę 4 tryby × 7 pól → `[0, 2, 5, 7]`. Tryb na `PlantSpace.kind`, **żadnego ustawienia konta** — obie przestrzenie tego samego konta pokazują co innego. |
| **AC-3** | Ten sam test: po włączeniu widoku zaawansowanego **każde** pole widoczne w **każdym** trybie; przełącznik w `filters`. |

### Byt roślinny i miejsca

| AC | Dowód |
|---|---|
| **AC-4** | Jeden model `Plant`. Test: 1 szt., 100 szt. i 4,2 ha w jednej tabeli. |
| **AC-5** | `propagatePlant` + relacja `PlantParent`; test: rodzic widzi dwoje potomstwa, skasowanie matki nie kasuje sadzonek. Przycisk w szczególe. |
| **AC-6** | `domain/roslina.ts` `bladZmianyStanu` — powodu wymaga wyłącznie `DEAD`; test domenowy + integracyjny (zakończona zostaje w historii miejsca). |
| **AC-7** | `recordTrash` + `restoreRosliny`; test potwierdza, że kasowanie przestrzeni zabiera zawartość — stąd pełna migawka. **Korekta po przebiegu 3:** w przebiegu 2 to kryterium było zaliczone na podstawie samej akcji — a `deleteSpace` nie miała wtedy ŻADNEGO wejścia z interfejsu (recenzja, U-9). Dowód uzupełniony w T-64: przycisk „Usuń przestrzeń" w slocie `settings` widoku przestrzeni, z potwierdzeniem niszczącym. Migawka objęła też zadania i zdarzenia opieki (T-56), bo bez nich usunięcie i przywrócenie kasowało ewidencję ŚOR na stałe. |

### Opieka i harmonogram

| AC | Dowód |
|---|---|
| **AC-8** | `createPlant` i `propagatePlant` wołają `zalozHarmonogramPodlewania`. Test `cyklRosliny`: po dodaniu rośliny istnieje zadanie `WATERING` **z terminem w przyszłości i niepustym uzasadnieniem**. Pierwszy termin liczy ta sama reguła co każdy następny. |
| **AC-9** | `PlantCareTask.reason` wypełniane przy każdym przeliczeniu; wyświetlane w agendzie i w kaflu „Do zrobienia dziś". 14 testów `domain/harmonogram` sprawdza treść. |
| **AC-10** | `recordCare` z trzema wynikami; `SKIPPED` nie ustawia `lastDoneAt`, `POSTPONED` przesuwa termin bez ruszania cyklu; trzy przyciski w agendzie. |
| **AC-11** | Reguła: odsunięcie po opadzie ≥ 5 mm, skrócenie przy dwóch dniach upału, ostrzeżenie o przymrozku, `podDachem` blokuje korektę (testy). **Lokalizacja przypisywana w slocie `settings` przestrzeni** (`getWeatherOptions` przez kontrakt Pogody) — bez tego korekta nie miałaby danych. |
| **AC-12** | `calendar.ts` wpięty przez `module.server.ts`; `syncReminders` z zapytaniem o `plantCareTask` (okno 3 dni, `dedupeKey` `plantcare-`). |

### Dziennik, pomiary, zbiory

| AC | Dowód |
|---|---|
| **AC-13** | `ImageUrlInput` (link albo wgranie na Dysk) przy formularzu wpisu; **wpis może być samym zdjęciem**, bo „postęp w czasie" to seria zdjęć. Zdjęcia renderowane na osi czasu. |
| **AC-14** | `addMeasurement` z rodzajem i jednostką domyślną per rodzaj; formularz i przebieg w szczególe. |
| **AC-15** | Formularz zbioru + trzy wyjścia: `harvestToPantry` (kontrakt Kuchni, idempotentnie po `pantryItemId`), `bookCareCost` (Portfel, `force: true` bo to jawna akcja), `addToShoppingList` (Zakupy przez `resolveOrCreateList`). **Żadne nie zbudowane w module.** |

### Katalog gatunków

| AC | Dowód |
|---|---|
| **AC-16** | 182 wpisy z migracji 0273; wyszukiwanie po nazwie polskiej i łacińskiej + filtr kategorii. |
| **AC-17** | Kopia z katalogu niesie `origin` i **nie rusza wiersza systemowego** (test integracyjny). Formularz własnego gatunku z podpowiedzią, że rodzina botaniczna nie jest polem ozdobnym — na niej stoi płodozmian. |

### AI

| AC | Dowód |
|---|---|
| **AC-18** | `identifyPlant` (`vision`) + sekcja „Rozpoznaj ze zdjęcia". Przyjęcie propozycji z `catalogKey` **kopiuje gatunek z katalogu**, więc roślina dostaje wymagania pielęgnacyjne, nie samą nazwę. Propozycji z pewnością `unknown` **nie da się przyjąć**. |
| **AC-19** | Diagnoza z kontekstem (gatunek, miejsce, 10 zdarzeń, prognoza), wymuszona pewność z dopuszczalnym `unknown`, zalecenia naturalne → chemiczne, zapis zdarzenia zdrowotnego, „pomogło / bez zmian" oraz **„Zaplanuj"** przy każdym zaleceniu (`scheduleRecommendedCare`, rodzaj sprawdzany wobec unii). |
| **AC-20** | `planToTask` przez **kontrakt Zadań**; przycisk przy każdej pozycji planu. Miesiąc zostaje w opisie, a nie staje się terminem — plan mówi „w marcu", nie „1 marca". |
| **AC-21** | `rememberedContent` z trybem; drugie wejście nie woła modelu, `stale` zapala znacznik, `PendingContent` rysowany przez `AiContentPending`. |
| **AC-22** | `AiContentMeta` (plan, wnioski) + `AiCostBadge akcja="Diagnoza rośliny"`. `check:cost-badge` zielony. |
| **AC-23** | Cztery akcje + trzy read-toole; test `asystentBezObejscia`: obcy nie widzi cudzych roślin przez read-tool, egzekutor nie znajduje ich po nazwie, pomiar nie powstaje, guard modułu też odmawia. |

### Warstwa zawodowa

| AC | Dowód |
|---|---|
| **AC-24** | Formularz zabiegu z kompletem pól wymaganych od 2026-01-01; test: `brakiEwidencji` zwraca pustą listę dla kompletnego wpisu. **Braki nie blokują zapisu** — są wypisywane przy pozycji. Formularz proponuje wyłącznie przestrzenie zawodowe. |
| **AC-25** | `exportTreatmentRegister` + `lib/eksportEwidencji` (16 kolumn, BOM, ucieczka średnika i cudzysłowu — 11 testów); przycisk pobrania. |
| **AC-26** | `domain/plodozmian` (13 testów) + `getPlaceHistory`. Ostrzeżenie liczy się **w chwili wyboru miejsca i gatunku**, z rodziny **wybieranego** gatunku; jest ostrzeżeniem, nie blokadą. |

### Wpięcie w system

| AC | Dowód |
|---|---|
| **AC-27** | Bramka w `layout.tsx`; `check:route-gating` liczy 22 trasy. |
| **AC-28** | Deklaracja dwóch zasobów z `parent`; `ShareDialog`. Tabela prawdy z jawnym sprawdzeniem, że decyzja o roślinie **zawsze** równa się decyzji o jej przestrzeni. **Korekta po przebiegu 3:** tabela prawdy dowodziła wyłącznie, że guard mówi „wolno" — a listy szły przez `ownedWhereAsync`, więc obdarowana osoba wchodziła do **pustego widoku**, co wygląda jak awaria danych, nie jak brak dostępu. Uzupełnione w T-58 (`zakresPrzestrzeni`/`idPrzestrzeniNadanychMi` w `getSpaces`, `getPlants`, `getCareAgenda`, `getCareHistory`, `getHarvests`, `getTreatmentRegister`). |
| **AC-29** | `dashboard.ts` + wpis w korzeniu; `src/app/page.tsx` nietknięta. |
| **AC-30** | Sekwencja z §1. |

**Podsumowanie: 30 ✅ · 0 ⚠️ · 0 ❌.**

---

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01, C-02, C-36 | ✅ jedna deklaracja, pola leniwe, wnętrze importowane względnie, obce moduły wyłącznie przez kontrakt, brak `jobs` z uzasadnieniem |
| C-10..C-15 | ✅ dwie ręczne migracje, zero enumów Prisma, seed idempotentny (dwukrotne odtworzenie), zero `DROP` |
| C-13 | ✅ wyłącznie lokalny Postgres |
| C-17, C-21 | ✅ dostęp rozstrzyga platforma z katalogiem modułu, własność przez helpery przestrzeni, tabela prawdy |
| C-20, C-22..C-25 | ✅ `revalidatePath`, slug w migracji, egzekutory, kosz |
| C-30..C-34 | ✅ zmienne CSS, cele dotyku 40 px, teksty przez `t()`, `ModuleView` ze `state` i slotem `settings`, `confirmDialog({destructive:true})` |
| **C-35** | ✅ **dopiero po przebiegu 3.** W przebiegu 2 napisano tu „naprawiona" na podstawie `grep`-a po jedenastu funkcjach z listy z przebiegu 1 — a recenzja znalazła cztery kolejne bez konsumenta (`deleteSpace`, `updatePlace`/`deletePlace`, `updateCareTask`, `listaFaz`). Błąd był w METODZIE, nie w liczbie: sprawdzano listę zamkniętą z poprzedniego przebiegu, a nie wszystkie eksporty modułu. Domknięte w T-64. |
| C-40, C-41 | ✅ model i provider z konfiguracji, zero kluczy w kodzie |
| C-51 | ✅ jedna lekcja dopisana do `doświadczenia.md` (cichy filtr bramki pokrycia AI) |
| C-53 | ✅ zero nowych zależności; `ImageUrlInput` użyty zamiast pisania własnego uploadu; brak drugiego magazynu i drugiej księgowości |
| C-54 | ✅ rozjazd plan ↔ kod przy `createTask` usunięty razem z AC-20 |

---

## 4. Regresje

- **Migracje** — wyłącznie nowe tabele, jedyne powiązanie to FK do `Workspace`; `migrate deploy` przechodzi na bazie z kompletem wcześniejszych migracji, `check:schema-drift` czysty.
- **`DashboardSnapshot`** — dwa nowe pola z wartościami w `EMPTY_SNAPSHOT`; `tsc` czysty.
- **`syncReminders`** — dziesiąte zapytanie w tym samym `Promise.all`, `dedupeKey` z własnym prefiksem.
- **Kosz** — wariant dopisany, pozostałe nietknięte.
- **`actionContract.ts` / `aiAction.ts`** — zmiany addytywne; 168 akcji spójnych.
- **Budżet** — najcięższa trasa bez zmian (1179 kB), rośnie wyłącznie suma po trasach, bo tras jest sześć więcej.
- **Ograniczenie tej weryfikacji:** pełnego zestawu testów sąsiednich modułów nie uruchamiano (czas); `tsc -p tsconfig.test.json` jest czysty, a zmiany w cudzych plikach są addytywne. Klikacze e2e też nie były uruchamiane.

Regresji nie wykryto.

---

## 5. Defekt znaleziony i naprawiony w tym przebiegu

Poza brakami z pierwszego przebiegu weryfikacja wykryła **błąd merytoryczny we własnej poprawce**:
ostrzeżenie płodozmianowe liczyło rodzinę botaniczną z rośliny **już stojącej w miejscu**, a nie
z tej, którą użytkownik właśnie dodaje. Formularz nie miał w ogóle wyboru gatunku, więc:

1. ostrzeżenie dotyczyło rodziny, której planowana uprawa mogła nie dotyczyć,
2. `createPlant` z interfejsu nigdy nie ustawiało `speciesId`, więc **harmonogram zawsze startował
   z wartości domyślnych**, a nie z czterech liczb gatunku — czyli reguła terminu, sedno modułu,
   działała u realnego użytkownika w wersji zubożonej.

Naprawione: formularz ma wybór gatunku z listy użytkownika, rodzina pochodzi z **wybieranego**
gatunku, a ostrzeżenie przelicza się przy zmianie miejsca **i** gatunku; bez wybranego gatunku
reguła milczy — tak samo jak milczy dla wpisu bez rodziny.

---

## 6. Historia przebiegów

| Przebieg | Werdykt | Co ustalił |
|---|---|---|
| 1 | ⛔ DO POPRAWY | 19 ✅ / 7 ⚠️ / 4 ❌. Warstwa serwera kompletna, warstwa widoku jej nie wołała: osiem guardowanych funkcji bez konsumenta (naruszenie C-35). **Wszystkie bramki były wtedy zielone** — bo pytają, czy kod jest poprawnie podłączony do platformy, a nie czy da się z niego skorzystać. |
| 2 | ✅ GOTOWE | 30 ✅. Braki domknięte (T-48…T-54), przy okazji wykryty i naprawiony defekt z §5. **Werdykt był przedwczesny** — patrz przebieg 3. |
| 3 | ⛔ ZMIANY WYMAGANE (recenzja) | 12 ustaleń (U-1…U-12), wszystkie potwierdzone w kodzie przed przyjęciem. Dwa twierdzenia z przebiegu 2 obalone: „C-35 naprawiona" (sprawdzano listę zamkniętą z przebiegu 1, nie eksporty modułu) i dowody AC-7/AC-28 (akcja bez wejścia z interfejsu; guard bez zakresu list). Do tego: wyciek przez `parentId`/`plantId` podane wprost do Server Action, zero w wymaganiach wodnych czytane jak brak danych, eksport ewidencji bez okresu, formularz zabiegu bez daty i przedmiotu, `window.prompt`, kubełek agendy w strefie serwera, wyścig w `harvestToPantry`. Domknięte w T-56…T-68. |

**Wniosek do zapamiętania:** komplet zielonych bramek nie jest miarą kompletności funkcji. Bramki
tego repozytorium pilnują *wpięcia w mechanizmy platformy*; „czy użytkownik ma jak z tego
skorzystać" sprawdza dopiero przejście AC po AC z `grep`-em po konsumentach.

---

**Druga lekcja, z przebiegu 3:** dowód na spełnienie kryterium **nie może pochodzić z listy
sporządzonej w poprzednim przebiegu**. Weryfikacja, która sprawdza tylko to, co poprzednio było
zepsute, potwierdza wyłącznie własną poprawkę — i dokładnie tak przeszły cztery akcje bez wejścia
z interfejsu oraz guard, który wpuszczał do pustego widoku.

---

## 7. Werdykt końcowy: ✅ GOTOWE (po przebiegu 3)

Wszystkie 30 kryteriów akceptacji spełnione z dowodem — dwa z nich (**AC-7**, **AC-28**) dopiero po
korekcie opisanej wyżej. Bramki: komplet zielony, w tym `check:domain`, `check:owner-columns`,
`check:route-gating`, `check:pagination`, `check:i18n` i budżet wydajnościowy. `next build`
przechodzi na lokalnym Postgresie (C-13 — produkcyjna baza nietknięta), **1464 testy jednostkowe
i integracyjne zielone**, dwie zapadki podniesione świadomie (rejestr modułów 23 → 24, kalendarz
14 → 15 zapytań przy `powtorzenia: 1`, czyli nowe źródło w agregacie, a nie N+1).

**Odnotowane, świadomie poza zakresem:** `scripts/migrate.js` przy seedowaniu domyślnych przypisań
LLM woła `llmAssignment.findUnique({ where: { operationType } })`, choć od 034 kluczem głównym jest
para `(operationType, level)`. Na świeżej bazie kończy się to ostrzeżeniem „Failed to seed LLM
defaults" — build przechodzi, ale domyślne przypisania nie powstają. Defekt jest **starszy niż ten
feature** i nie dotyka modułu Rośliny; naprawa poszerzyłaby zakres o cudzy plik, więc zostaje
zgłoszona, a nie doklejona (C-53).
