# Weryfikacja: Zapytania odczytowe w asystencie AI nie giną na limicie modelu

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-21

## Bramki techniczne
| Komenda | Wynik |
|--------|-------|
| `npm run check:actions` | ✅ 159 akcji w katalogu, wszystkie z executorem |
| `npm run check:migrations` | ✅ Numeracja OK (następny wolny: 0206) — brak nowej migracji |
| `next lint --dir src` | ✅ Bez błędów (tylko wcześniej istniejące ostrzeżenia `no-img-element`/`exhaustive-deps`, niezwiązane ze zmianą) |
| `next build` (lokalny Postgres, C-13) | ✅ Kompilacja OK, wszystkie trasy wygenerowane |
| `npm run test:unit` | ✅ 332 pass / 27 skip (DB-gated) / 0 fail; w tym 4 nowe testy `buildReadToolsPrompt` |

## Kryteria akceptacji
- **AC-1** (tag zwraca listę, powtarzalnie) — ✅ **spełnione.** Filtr po tagu w `list_tasks` istnieje
  (`agentTools.ts:245`: `where.tags = { some: { tag: { name: { contains: tag, mode:"insensitive" } } } }`).
  Ścieżka „pokaż zadania otagowane raj": `classifyIntent` → `complex` bez LLM (`READ_INTENT_RE` łapie
  „pokaż", `fastPath.ts:87,138`); `routeModules` → keyword „zadani" ⇒ `["tasks"]` bez LLM
  (`route.ts:423`). Zostają **dokładnie 2 wywołania reasoning** (query→answer) o zredukowanym rozmiarze,
  które mieszczą się w TPM → polecenie kończy się listą, nie komunikatem o przeciążeniu. Powtarzalność:
  zapotrzebowanie na minutę nie przekracza limitu, więc kolejne próby też przechodzą.
- **AC-2** (proste zapytanie mieści się w budżecie minuty) — ✅ **spełnione.** Pomiar: katalog read-tooli
  dla `["tasks"]` = **466 tok.** vs pełny **2023 tok.** (−77%). Szacunek na wywołanie: scaffold ~2200 +
  read-toole ~466 + katalog akcji tasks ~500 + nawigacja ~354 ≈ ~3600 tok.; dwa wywołania ≈ ~7300 tok. +
  drobne wyniki narzędzia — poniżej 12000 TPM. Brak dodatkowych wywołań LLM przed pętlą (patrz AC-1).
- **AC-3** (usunięcie przyczyny, nie objawu; bez zwielokrotniania ciężkich wywołań) — ✅ **spełnione.**
  Przyczyna (pełny katalog ~50 narzędzi w każdym wywołaniu) usunięta przez `buildReadToolsPrompt(modules)`
  filtrujący katalog do modułów z routera (`route.ts` `buildSystemPrompt` → `buildReadToolsPrompt(modules)`).
  Liczba ciężkich wywołań na proste polecenie bez zmian (2), ale każde istotnie mniejsze.
- **AC-4** (retry + ludzki komunikat dla PRAWDZIWIE chwilowych limitów) — ✅ **spełnione (bez zmian).**
  `fetchWithRetry` (`chat.ts`) i polski komunikat 429 w `runAgentLoop` (`route.ts`) nietknięte —
  potwierdzone brakiem zmian w tych ścieżkach.
- **AC-5** (brak zapętlenia) — ✅ **spełnione (bez zmian).** `MAX_ITERATIONS` i terminalne kroki
  agenta niezmienione; zmiana dotyczy wyłącznie rozmiaru promptu.
- **AC-6** (brak regresji pozostałych poleceń) — ✅ **spełnione.** `execute`, `buildActionCatalog`,
  scaffold reguł, pety — nietknięte. `buildReadToolsPrompt`: dla wielu modułów zwraca **union** ich
  narzędzi + core (test „wiele modułów"); dla pustego/nieznanego wejścia — **pełny** katalog (fallback,
  test); narzędzie bez przypisania → zostaje. Ścieżka wznowienia (clarify/refine) nadal dostaje pełny
  katalog (świadomie, plan §6b). Build + pełny zestaw testów zielone.

## Zgodność z konstytucją
- **C-40** ✅ — brak hardkodowania providera/modelu; działa w istniejącym routingu per typ operacji.
- **C-41 / C-32** ✅ — komunikaty użytkownika po polsku, brak surowego tekstu dostawcy.
- **C-53** ✅ — minimalny fix: mapa `READ_TOOL_MODULE` + `CORE_READ_TOOLS` + builder filtrujący istniejący
  `READ_TOOLS_PROMPT` (źródło prawdy), wzorem `buildActionCatalog`; zero nowych zależności/abstrakcji.
- **C-10..C-14** ✅ — nie dotyczą (brak zmian schematu/migracji).
- **C-23** ✅ — brak nowej `AIAction`; `check:actions` zielony.
- **C-51 / C-54** ✅ — wpis do `doświadczenia.md`; plan/tasks zsynchronizowane z faktyczną implementacją.

## Regresje
- **Brak wykrytych.** Zmiana jest izolowana do budowy promptu systemowego agenta. Nie rusza Server
  Actions, `revalidatePath`, RBAC, schematu, ani innych modułów. Egzekutor akcji i katalog akcji bez
  zmian. Fallback do pełnego katalogu gwarantuje „w najgorszym razie jak dotąd".

## Werdykt końcowy
**GOTOWE.** Wszystkie AC spełnione, wszystkie bramki zielone, brak regresji. Przechodzę do `/review`.
