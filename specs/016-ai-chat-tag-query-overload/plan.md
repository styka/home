# Plan techniczny: Zapytania odczytowe w asystencie AI nie giną na limicie modelu

- **Spec:** ./spec.md (016-ai-chat-tag-query-overload)
- **Status:** draft
- **Data:** 2026-07-21

> **Zasada planu:** to jest **JAK**. Pod istniejący kod i konwencje. Wzorzec do naśladowania:
> `buildActionCatalog(modules)` w `src/app/api/llm/home/agent/route.ts` — katalog akcji jest **już**
> filtrowany po wybranych modułach; robimy to samo dla katalogu narzędzi ODCZYTU.

## 1. Podejście (2–4 zdania)
Przyczyną przeciążenia jest strukturalne przekroczenie minutowego budżetu tokenów Groqa (12000 TPM):
proste zapytanie odczytowe odpala **dwa duże wywołania modelu** (query→answer), a w każdym z nich do
promptu wstrzykiwany jest **pełny** katalog ~50 narzędzi odczytu (`READ_TOOLS_PROMPT`, ~2000 tokenów),
mimo że router zawęził polecenie do 1 modułu. Naprawiamy to, **filtrując katalog narzędzi odczytu po
wybranych modułach** — dokładnie tak, jak już działa `buildActionCatalog(modules)`. To ścina ~1500
tokenów z każdego wywołania (~3000 na jedno polecenie), sprowadzając zapotrzebowanie dwóch wywołań
znacznie poniżej 12000 TPM. Odporność z 010 (retry + polski komunikat + brak pętli) zostaje bez zmian
jako druga linia obrony. **Bez zmian w schemacie bazy, bez nowej `AIAction`, bez RBAC.**

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Brak nowych modeli/kolumn, brak migracji. (C-10/C-11/C-12 nie dotyczą.)

## 3. Warstwa serwera (Server Actions — C-20)
**Bez zmian w Server Actions.** Zmiana dotyczy wyłącznie warstwy asystenta AI (budowa promptu agenta).
Odczyty nadal idą przez istniejące read-toole (`runReadTool`) respektujące dostęp (`ownerId`/`ownerTeamId`,
C-21) — nie ruszamy ich logiki ani guardów.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Asystent działa na `/` (`module.home`); brak nowego slugu, brak wpięć w `permissions.ts`,
`modules.tsx`, `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
**Bez zmian w UI.** Czat (`home/AICommandSheet.tsx`), bąbelki, Retry, historia — nietknięte. Ewentualny
komunikat awaryjny (już istniejący, po polsku — C-32) zostaje.

## 6. AI / integracje — rdzeń zmiany (C-23, C-40)
**a) `src/lib/ai/agentTools.ts` — filtrowanie płaskiego `READ_TOOLS_PROMPT` po module.**
> **Aktualizacja przy implementacji (C-54):** zamiast rozbijać tekst na `READ_TOOL_LINES_BY_MODULE`
> (transkrypcja ~57 wierszy = ryzyko rozjazdu), przyjęto rozwiązanie **minimalniejsze** (C-53): płaski
> `READ_TOOLS_PROMPT` **zostaje jedynym źródłem prawdy**, a builder go **filtruje** po nazwie narzędzia.
- **Zostawiamy** stałą `READ_TOOLS_PROMPT` bez zmian (źródło prawdy — cały tekst katalogu).
- Dodajemy mapę **`READ_TOOL_MODULE: Record<string, string>`** (nazwa narzędzia → moduł) — analogicznie do
  tego, jak `buildActionCatalog` grupuje akcje po module.
- Dodajemy zbiór **`CORE_READ_TOOLS: Set<string>`** — narzędzia przekrojowe **zawsze** dołączane:
  `list_calendar`, `web_search`, `list_trash` (kosz jest przekrojowy).
- Dodajemy funkcję **`buildReadToolsPrompt(modules: string[]): string`**: bierze `READ_TOOLS_PROMPT`,
  zachowuje nagłówek, a z wierszy-wypunktowań (`- <tool>: …`) **zostawia** tylko te, których narzędzie
  należy do wybranego modułu lub jest w core; narzędzie bez przypisania → zostaje (bezpiecznie). Gdy
  `modules` puste/nieznane → zwraca **cały** `READ_TOOLS_PROMPT` (bezpieczny fallback, zachowanie jak dziś).
- `READ_TOOL_NAMES` i `runReadTool` **bez zmian** — walidacja/wykonanie dowolnego poprawnego read-toola
  zostaje (gdyby model zawołał narzędzie spoza zawężonego opisu, i tak się wykona; brak regresji).
- **Mapowanie tool→moduł** (na podstawie obecnych opisów):
  - `tasks`: list_projects, list_tasks, get_task, list_task_tags, list_project_groups
  - `shopping`: list_shopping_lists, list_items, list_replenish_candidates
  - `notes`: list_notes, get_note, list_note_tags, list_note_groups
  - `pets`: list_pets, list_care_agenda, list_enclosures, get_pet_welfare, list_care_history
  - `magazynowanie`: list_storage_items, list_suppliers, list_low_stock, list_expiring_storage, get_storage_analytics
  - `habits`: list_habits
  - `health`: list_health_events, list_medications, get_test_trends
  - `portfel`: list_wallet, list_budgets, list_goals, get_wallet_overview, get_monthly_report
  - `kitchen`: list_recipes, get_recipe, list_cookbooks, list_meal_plan, list_todays_meals, list_pantry, list_expiring_pantry, get_meal_plan_cost
  - `flota`: list_vehicles
  - `warsztaty`: list_workshops, list_maintenance
  - `languages`: list_decks, list_due_cards, get_study_streak
  - `news`: list_news_topics, list_hot_topics, list_news_sources, get_news_topic_view
  - `weather`: list_weather_locations, get_weather, list_watchers
  - `contacts`: list_contacts
  - `reports`: search_reports
  - **core (zawsze):** list_calendar, web_search, list_trash

**b) `src/app/api/llm/home/agent/route.ts` — użyj buildera w prompcie systemowym.**
- W `buildSystemPrompt(modules)` (linia ~298) podmień `${READ_TOOLS_PROMPT}` na
  `${buildReadToolsPrompt(modules)}`; zaktualizuj import z `agentTools.ts`.
- Reszta `buildSystemPrompt` (scaffold reguł, `buildActionCatalog`, `NAVIGATION_CATALOG`, pety) — bez zmian.
- **Ścieżka wznowienia po `clarify`/`refine`** (linia ~700): tam `selectedModules` = pełny katalog, więc
  `buildReadToolsPrompt` zwróci pełny zestaw (jak dziś) — świadomie **nie** zawężamy wznowienia (rzadsze,
  wymaga szerszego kontekstu). Odnotowane w ryzykach.

**Bez nowej `AIAction`** → `check:actions` nie dotyczy. Kalendarz/powiadomienia/trash — bez zmian.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `src/lib/ai/agentTools.ts` | edycja | Rozbić `READ_TOOLS_PROMPT` na `READ_TOOLS_HEADER` + `READ_TOOL_LINES_BY_MODULE` + `CORE_READ_TOOL_LINES` + `buildReadToolsPrompt(modules)`; zachować zgodny wstecznie eksport `READ_TOOLS_PROMPT` |
| `src/app/api/llm/home/agent/route.ts` | edycja | Import `buildReadToolsPrompt`; w `buildSystemPrompt` użyć `buildReadToolsPrompt(modules)` zamiast pełnego `READ_TOOLS_PROMPT` |
| `src/lib/ai/__tests__/agentTools.test.ts` (lub istniejący) | edycja/nowy | Test: `buildReadToolsPrompt(["tasks"])` zawiera `list_tasks`+core, a **nie** zawiera np. `list_recipes`/`list_vehicles`; pełny fallback dla pustego wejścia zawiera wszystko |
| `doświadczenia.md` | edycja | Wpis o strukturalnym TPM vs „chwilowy limit" (C-51) |

## 8. Bramki i weryfikacja (C-50)
- **Lokalnie:** `npm run build` do kroku `next build` (bez `migrate.js` — C-13, brak migracji tu nie rusza
  bazy, ale zasada zostaje); `next lint`; testy jednostkowe (`npm test`/vitest) dla `buildReadToolsPrompt`.
- **Pomiar tokenów (AC-2/AC-3):** prosty skrypt/porównanie długości promptu — `buildReadToolsPrompt(["tasks"])`
  vs pełny — ma być istotnie krótszy (~4x mniej wierszy narzędzi); dwa wywołania mieszczą się < 12000 TPM.
- **Mapowanie AC → weryfikacja:**
  - **AC-1** (zapytanie po tagu zwraca listę): test manualny na `develop` po deployu + logika `list_tasks`
    z filtrem `tag` (już istnieje) — teraz nie odbija się o TPM.
  - **AC-2/AC-3** (mieści się w budżecie / mniej ciężkich wywołań): test jednostkowy długości promptu +
    potwierdzenie, że „pokaż zadania otagowane X" nie odpala klasyfikatora ani routera LLM (READ_INTENT +
    keywordRoute), więc pozostają dokładnie 2 wywołania reasoning o zredukowanym rozmiarze.
  - **AC-4/AC-5** (retry + brak pętli): kod 010 (fetchWithRetry, polski komunikat, MAX_ITERATIONS)
    pozostaje — potwierdzić brak regresji (bez zmian w tych ścieżkach).
  - **AC-6** (brak regresji pozostałych poleceń): test, że dla polecenia dotykającego wielu modułów
    (router zwraca kilka) prompt zawiera właściwe zestawy; dodawanie/edycja/raport działają jak dotąd
    (nie ruszamy `execute`, `buildActionCatalog`, scaffold).

## 9. Ryzyka techniczne i plan wycofania
- **Zawężony opis narzędzi → model nie „widzi" read-toola z innego modułu i nie pobierze danych krzyżowych.**
  Mitygacja: router (`routeModules`) już wybiera **wiele** modułów, gdy polecenie ich dotyczy; narzędzia
  przekrojowe (kalendarz, trash, web_search) są w core. Realne krzyżowe odczyty i tak przechodziły przez
  wybór wielu modułów.
- **Ścieżka wznowienia (clarify/refine) nadal wysyła pełny katalog** → potencjalnie duży prompt. Świadomie
  poza zakresem tej naprawy (rzadsze, druga tura); gdyby okazało się problemem — osobny follow-up.
- **Rozjazd mapy tool→moduł** (nowy read-tool bez przypisania) → wpada tylko do fallbacku/core; nic się nie
  psuje, najwyżej nie jest zawężony. Test pilnuje kompletności dla kluczowych modułów.
- **Rollback:** czysto kodowy (brak migracji) — rewert dwóch plików przywraca pełny `READ_TOOLS_PROMPT`.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak zmian schematu; jawnie odnotowane)
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — bez nowych akcji/slugów; read-toole i guardy nietknięte; C-23 (brak nowej AIAction) OK
- [x] C-30..C-32 (UX) — brak zmian UI; komunikaty PL zachowane
- [x] C-40 (routing modeli DB-driven) — nie hardkodujemy providera/modelu; działamy w istniejącym routingu
- [x] C-53 (minimalizm) — najmniejszy realny fix: jeden constant → builder filtrujący; zero nowych zależności; wzorzec z `buildActionCatalog`
- [x] C-54 (spójność) — plan zgodny z poprawionym założeniem speca (limit strukturalny, nie chwilowy)
