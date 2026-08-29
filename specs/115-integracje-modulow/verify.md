# 115 — verify (etap 5)

Data: 2026-08-29 · gałąź `claude/project-analysis-refactor-8csym7` · baza: lokalny Postgres
(`omnia_dev`, C-13 — prod nietknięty).

## Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0284)" |
| `npm run check:actions` (check-action-coverage) | ✅ 168 akcji katalogu asystenta, wszystkie z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ 676 akcji sklasyfikowanych (wszystkie nowe akcje 115 w manifeście) |
| `npm run check:boundaries` | ✅ 4 sondy — granice modułów egzekwowane |
| `npm run check:module-registry` | ✅ 24 moduły, wkłady pulpitu wpięte w obie strony |
| `npm run check:i18n` | ✅ zero tekstów zaszytych (13 w świadomych wyjątkach) |
| `next lint --dir src` | ✅ „No ESLint warnings or errors" (w pełnym buildzie) |
| pełny `npm run build` (lokalny Postgres) | ✅ dwa pełne przebiegi (T-20 i verify): wszystkie ~30 bramek, tsc, lint, `next build` (147 stron), budżet wydajnościowy w pasmie ±5 % (najcięższa trasa 1180 kB), `migrate.js` z seedem (LLM defaults naprawione — patrz doświadczenia.md) |
| `npm run test:unit` | ✅ **1483/1483** (z `DATABASE_URL`; jedyna korekta: próg N+1 pulpitu 11→13 z notą — powtórzenia zostały 1, więc to nowe wkłady, nie pętla) |

## Kryteria akceptacji

Sposób sprawdzenia: uruchomione bramki + prześledzenie każdej ścieżki w kodzie (plik:funkcja)
+ testy jednostkowe tam, gdzie istnieją. Szczegółowa tabela dowodów: `weryfikacja.md` (T-22).

| AC | Werdykt | Dowód (skrót) |
|---|---|---|
| AC-1 | ✅ | `analiza.md`: rozdz. 4 — każda para 24 modułów ze statusem ✔/➕/◐/— i uzasadnieniem; rozdz. 6 — Z-INT-01…19 z kompletem pól (cel/uzasadnienie/moduły/operacje/opcjonalność/priorytet/AC) |
| AC-2 | ✅ | `health.ts:bookHealthEventCost` → `bookAutoExpense` (`lib/autoExpense.ts:40`): istniejący wpis po (`sourceModule`,`sourceId`) jest AKTUALIZOWANY z korektą salda o różnicę (linie 60–72) — powtórny klik koryguje, nie dubluje; `powod:"brak-konta"` niesiony do UI |
| AC-3 | ✅ | `petCare.ts:285 bookVetVisitCost` (wydatek), `petBreeding.ts:306 bookSaleIncome` (`kind:"income"` → dodatnia delta, `autoExpense.ts:53–54`; sourceId `sale-<id>`) |
| AC-4 | ✅ | `warsztat.ts:addWorkshopLowStockToShoppingList` — deficyt `max(min−qty,0)||min`, pozycje przez `addItemStructured` (guard listy w środku); UI `LowStockDoZakupow` w agendzie |
| AC-5 | ✅ | `warsztat.ts:bookProjectCost` (sourceId `projekt-<id>`), UI `WorkshopDetail.tsx:469`; idempotencja jak AC-2 |
| AC-6 | ✅ | `lib/kontaktZWpisu.ts` (dedup po nazwie, test `kontaktZWpisu.test.ts` zielony) + `saveDoctorToContacts` (health.ts:239), `saveVetToContacts` (petCare.ts:306), `saveProviderToContacts` (parts/providers.ts:157) — trzy przyciski z komunikatem `{istnial:true}` |
| AC-7 | ✅ | `calendar/actions/doZadan.ts` (termin z pozycji: `at` ?? południe dnia; opis z `href`), `contacts:createTaskFromContact`, `notes:createTaskFromNote`, `czat:zadanieZWiadomosci` (link `/czat?r=…#w-…`) — wszystkie przez `createTask` z kontraktu Zadań + pre-check uprawnienia |
| AC-8 | ✅ | `news.ts:saveItemAsNote` (streszczenie + „Źródło: <nazwa>\n<url>", markdown), `filmy.ts:zapiszFilmJakoNotatke` (streszczenie z `AiContent` bez generacji — zero kosztu; fallback opis; + kanał + `adresFilmu`) |
| AC-9 | ✅ | `FilmSzczegol` sekcja „Fiszki z filmu": widoczna tylko przy transkrypcji + taliach; propozycje z `/api/llm/languages/extract` na klik (on-demand), przegląd checkboxami, `bulkAddWords` po zatwierdzeniu, `AiCostBadge akcja="Fiszki z filmu"` z `res.usage` |
| AC-10 | ✅ | flota contract += `avgFuelPrice` (test: Σkoszt/Σlitry, `[]`→null — zielony); `TruckPlannerPage:73` metryka `dystans × spalanie/100 × cena` z komunikatem przy brakach; `zaksiegujKosztTrasy` sourceId = skrót(start|cel|dzień) — idempotentnie per trasa/dzień |
| AC-11 | ✅ | `WeatherPref.kalendarzPrognoza` (0282, default `true`); `getKalendarzPrognoza` przy wyłączonej zwraca `{wlaczona:false, dni:[]}` → komórka nie rysuje spanu (render warunkowy `prognozaByDay.has(key)`), logika siatki nietknięta; przełącznik w `WatchersPanel` |
| AC-12 | ✅ | `completeShopping(doSpizarni)`: pozycje DONE → `addPantryItem` PO transakcji archiwizacji (błąd → log + licznik, zakończenie stoi); checkbox widoczny przy `module.kitchen` + kupionych, domyślnie odznaczony, `localStorage wom_shopping_pantry`; serwerowy pre-check `kitchenModule.permission` |
| AC-13 | ✅ | 4 wkłady `dashboard.ts` + pola snapshotu + `DASHBOARD_CONTRIBUTORS` (bramka rejestru w obie strony ✅); render w sekcjach `today`/`modules`, które JUŻ podlegają personalizacji `DashboardPref` — nowe dane dziedziczą ją bez nowych kluczy (decyzja planu §2) |
| AC-14 | ✅ | `/rosliny/ewidencja/page.tsx`: pozycje Magazynu tylko przy `module.magazynowanie` (try/catch → pusta lista); `Ewidencja`: wybór środka wypełnia puste pole nazwy, po `recordTreatment` → `adjustStorageQuantity(−ilość,"wydanie","ewidencja zabiegu <data>")` osobno od zapisu — błąd stanu dopowiada w komunikacie, wpis ZOSTAJE; bez wyboru przepływ jak dotąd |
| AC-15 | ✅ | migracja `0283_raport_integracje_115` (idempotentny INSERT, C-14) zastosowana lokalnie; wiersz zweryfikowany: `SELECT title … WHERE slug='integracje-miedzymodulowe-115'` → „Integracje międzymodułowe 115 — analiza i lista zleceń" |
| AC-16 | ✅ | wszystkie mutacje przez Server Actions modułu źródłowego + kontrakty celów (`bookAutoExpense`/`createTask`/`createNote`/`addItemStructured`/`addPantryItem`/`bulkAddWords`/`adjustStorageQuantity`); `check:boundaries` + pełny build zielone |

## Zgodność z konstytucją

- **C-01/02/36** ✅ — cała praca w `worldofmag/`; cudze moduły wyłącznie przez `contract.ts`
  (trzy kontrakty poszerzone o deklaracje modułów: `notesModule`/`kitchenModule` — wzorzec
  `tasksModule`); własne wnętrza ścieżką względną; bramki granic zielone.
- **C-10/11/12/14** ✅ — cztery ręczne migracje (0280–0283), numery z `next:migration`, zero enumów
  (`kind` = String + union), raport seedowany idempotentnie dollar-quotingiem.
- **C-13** ✅ — oba pełne buildy na lokalnym Postgresie; prod `DATABASE_URL` nigdzie nie użyty.
- **C-20/21** ✅ — każda nowa akcja kończy się `revalidatePath`; guardy: własność
  (`czyMojRekord`/`assertOwnership`-rodzina), uczestnictwo (`assertUczestnik`), dostęp do listy
  (`assertListAccess` w `addItemStructured`), plus pre-check uprawnienia modułu docelowego.
- **C-30/31/32** ✅ — wyłącznie zmienne CSS; cele dotyku ≥ zwyczajowych rozmiarów przycisków
  otoczenia; wszystkie nowe teksty przez `t()` (bramka i18n zielona).
- **C-40/41** ✅ — jedyne wywołanie LLM (fiszki) idzie istniejącą trasą z resolverem operacji;
  żadnych kluczy w kodzie/logach.
- **C-50/51** ✅ — build przechodzi; wpis do `doświadczenia.md` (seed LLM w migrate.js).
- **C-53/54** ✅ — bez nowych zależności; odchylenia od planu odnotowane w `plan.md`/`weryfikacja.md`
  (barrel Usług, przełącznik prognozy w `WatchersPanel`, MyRequestsPage bez przycisku).

## Regresje

- **Pełna suita jednostkowa 1483/1483** — sąsiednie moduły nietknięte funkcjonalnie.
- **Cykl kontraktów Zakupy↔Kuchnia** (lists.ts importuje kontrakt Kuchni, akcje Kuchni importują
  kontrakt Zakupów): bezpieczny — wszystkie użycia w ciałach funkcji async, nic na poziomie modułu;
  pełny `next build` + dev-graf kompilują czysto.
- **Migawka pulpitu**: +2 zapytania jednorazowe (próg 11→13, powtórzenia = 1 — brak N+1); jedyny
  wkład sięgający poza bazę (Pogoda) ma twardy timeout 3 s → `null`.
- **completeShopping**: stary konsument (egzekutor AI) woła bez `doSpizarni` — zachowanie
  niezmienione (opcja opt-in); poszerzony wynik zgodny wstecz.
- **Kalendarz**: prognoza dokładana równolegle i tylko przy `module.weather`; awaria Open-Meteo
  zwraca pustą listę — agenda nie zależy od zewnętrznego API.
- **Stale wpisy manifestu**: usunięty nieosiągalny `providers:saveProviderToContacts` (skaner nie
  czyta `actions/parts/` — ograniczenie odnotowane, akcje `parts/*` są poza bramką pokrycia od
  refaktoru Z-213; nie jest to regres 115).

## Werdykt końcowy

**GOTOWE.** Wszystkie 16 AC spełnione z dowodami, bramki i pełny build zielone, testy 1483/1483.
Uwagi niewielkiej wagi (nie blokują): (1) skaner pokrycia AI nie widzi `actions/parts/*` — dług
sprzed 115, wart osobnego zadania; (2) weryfikacja czysto wzrokowa (klik w przeglądarce) zostaje
na teście na `develop` po merge — ścieżki prześledzone w kodzie i pokryte bramkami.
