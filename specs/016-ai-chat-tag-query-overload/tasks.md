# Zadania: Zapytania odczytowe w asystencie AI nie giną na limicie modelu

- **Plan:** ./plan.md (016-ai-chat-tag-query-overload)
- **Status:** todo
- **Data:** 2026-07-21

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Tu **nie ma** migracji ani nowej `AIAction` — zmiana jest czysto w warstwie promptu agenta AI.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

## Faza 0 — Fundament danych
- [ ] **T-0** — Brak: bez zmian w schemacie/migracjach (plan §2). Nic do zrobienia — jawnie odnotowane.

## Faza 1 — Warstwa serwera / RBAC
- [ ] **T-0b** — Brak: bez zmian w Server Actions i RBAC (plan §3/§4).

## Faza 2 — Rdzeń zmiany (warstwa AI — prompt agenta)
> **Aktualizacja przy implementacji (C-54):** zamiast rozbijać tekst na mapę wierszy, `READ_TOOLS_PROMPT`
> **zostaje źródłem prawdy**, a builder **filtruje** jego wiersze po nazwie narzędzia (rozwiązanie
> minimalniejsze, C-53). T-1 i T-2 zrealizowane w jednym pliku.
- [x] **T-1** — W `src/lib/ai/agentTools.ts` dodać mapę `READ_TOOL_MODULE` (nazwa narzędzia → moduł, wg
  planu §6a) oraz zbiór `CORE_READ_TOOLS` (`list_calendar`, `web_search`, `list_trash`). `READ_TOOLS_PROMPT`
  bez zmian (źródło prawdy). **Gotowe, gdy:** każde narzędzie z katalogu ma przypisany moduł lub jest w core.
- [x] **T-2** — W tym samym pliku dodać `buildReadToolsPrompt(modules: string[]): string`, który filtruje
  wiersze `READ_TOOLS_PROMPT` po `READ_TOOL_MODULE`/`CORE_READ_TOOLS`; **fallback**: puste/nieznane
  `modules` → cały `READ_TOOLS_PROMPT`. **Gotowe, gdy:** `buildReadToolsPrompt([])` === pełny katalog;
  `buildReadToolsPrompt(["tasks"])` zawiera `list_tasks` + core, a nie zawiera `list_recipes`/`list_vehicles`.
- [x] **T-3** — W `src/app/api/llm/home/agent/route.ts`: zaktualizować import z `agentTools.ts`
  (`buildReadToolsPrompt`) i w `buildSystemPrompt(modules)` podmienić `${READ_TOOLS_PROMPT}` na
  `${buildReadToolsPrompt(modules)}`. Reszta promptu (scaffold, `buildActionCatalog`, nawigacja, pety) — bez zmian.
  **Gotowe, gdy:** prompt systemowy dla zawężonego routingu zawiera tylko read-toole wybranych modułów + core.

## Faza 3 — Test / regresja
- [x] **T-4** `[P]` — Test jednostkowy dla `buildReadToolsPrompt` (`src/lib/ai/__tests__/buildReadToolsPrompt.test.ts`,
  `node:test`): (a) `["tasks"]` → zawiera `list_tasks`, `list_task_tags` i core, **nie** zawiera
  `list_recipes`; (b) pusty/nieznany input → pełny katalog (fallback); (c) prompt dla `["tasks"]` <50%
  pełnego (dowód redukcji tokenów — AC-2/AC-3); (d) wiele modułów → union + core.
  **Gotowe, gdy:** `npm run test:unit` zielony (4/4 nowe testy).

## Faza 4 — Bramki i domknięcie
- [x] **T-5** — `check:actions` (159 akcji OK) + `check:migrations` (OK) + `next lint` (bez błędów, tylko
  istniejące ostrzeżenia) + `next build` (zielony, lokalny Postgres — C-13, bez `migrate.js`) + `test:unit`
  (332 pass). **Gotowe.**
- [x] **T-6** — Mapowanie AC → wynik (input do `/verify`): AC-1 (tag zwraca listę — logika `list_tasks.tag`
  już jest, teraz bez TPM-odbicia), AC-2/AC-3 (redukcja wielkości promptu, dokładnie 2 wywołania reasoning
  bez klasyfikatora/routera LLM), AC-4/AC-5 (retry + brak pętli z 010 nietknięte), AC-6 (brak regresji
  pozostałych ścieżek — `execute`/`buildActionCatalog`/scaffold niezmienione).
- [x] **T-7** — Wpis do `doświadczenia.md` (C-51): „chwilowy" limit TPM okazał się **strukturalny** —
  pełny katalog read-tooli w każdym wywołaniu × 2 wywołania na proste zapytanie przebijał 12000 TPM;
  lekcja: filtruj katalog narzędzi po module (jak `buildActionCatalog`), a nie tylko dokładaj retry.

## Mapowanie AC → zadania
- **AC-1** → T-3 (+ istniejący filtr `tag` w `list_tasks`) → weryfikacja na develop
- **AC-2, AC-3** → T-1, T-2, T-3, T-4 (redukcja promptu; brak dodatkowych wywołań LLM dla „pokaż…")
- **AC-4, AC-5** → bez zmian (010) — potwierdzenie w T-6 (brak regresji)
- **AC-6** → T-4, T-5 (brak regresji; niezmienione ścieżki akcji/raportów)

## Ścieżka krytyczna
T-1 → T-2 → T-3 (sekwencyjne, ten sam obszar) → T-5 (build). T-4 `[P]` po T-2. T-6/T-7 na końcu.

## Notatki / blokady
- Brak. Zmiana jednoplikowa + użycie w route + test; zero zależności zewnętrznych.
