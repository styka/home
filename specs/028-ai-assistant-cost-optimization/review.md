# Recenzja: Optymalizacja kosztów asystenta AI (028)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-23
- **Zakres diffa:** `git diff origin/master...HEAD -- worldofmag/src` — 7 plików, +210/−26.
  Pliki: `agent/route.ts`, `AICommandSheet.tsx`, `agentTools.ts`, `fastPath.ts`, `usage.ts`,
  `agentContext.ts` (nowy), `__tests__/agentContext.test.ts` (nowy).

## Ustalenia (od najpoważniejszego)

### 1. [correctness] Podwójne zliczanie tokenów fast-path w dziennym budżecie — **NAPRAWIONE w recenzji**
- **Plik:** `src/lib/ai/fastPath.ts:152` (przed fixem) + `src/app/api/llm/home/agent/route.ts` (finally `recordAiUsage`).
- **Opis:** `classifyIntent` wołało `chatComplete` z `userId`, więc jego tokeny były zaliczane do
  `AiUsage` już wewnątrz `chatComplete` (`chat.ts:252`). Po 028 te same tokeny wchodziły też do
  wspólnego `meta`, a na końcu ścieżki „complex" `recordAiUsage(userId, meta.tokens)` zaliczał je
  **drugi raz**.
- **Scenariusz awarii:** przy poleceniu „complex" (nie-simple) każde wywołanie doliczało ~300 tokenów
  klasyfikacji **dwukrotnie** do dziennego budżetu → użytkownik szybciej trafiał na limit `checkAiBudget`
  (ironiczne w feature o kontroli kosztów).
- **Poprawka (naniesiona):** jeden punkt rozliczania. Usunięto `userId` z `chatComplete` w
  `classifyIntent` (budżet i tak sprawdzany z góry w POST), a rozliczenie tokenów tury robi wyłącznie
  `recordAiUsage(meta.tokens)` — w ścieżce „complex" (finally) oraz **dodane** w ścieżce „simple"
  (early return, która omijała finally). Efekt: klasyfikacja + router + pętla liczone dokładnie raz.
  Weryfikacja: `tsc` czysto, testy AI 21 pass/0 fail, `next build` zielony.

## Rzeczy sprawdzone i OK (bez zastrzeżeń)
- **Rozpoznawanie bloków do zwinięcia** (`collapseUsedToolData`): dopasowanie po prefiksie
  `TOOL_DATA_HEADER` = początek treści wiadomości `query`; wiadomości historii/kontekstu/clarify
  zaczynają się inaczej → brak fałszywych trafień. Stub zaczyna się od `[` → nie jest ponownie
  dopasowywany. Zostaje pełny **tylko ostatni** blok (wielokrotne bloki testowane). ✅
- **Kolejność w pętli**: `collapseUsedToolData` woła się na górze iteracji, po dodaniu poprzedniego
  bloku — pierwszy blok jest pełny w iteracji, w której powstał; zwijany dopiero gdy pojawi się nowszy.
  Id do akcji zawsze w aktualnym, pełnym bloku → bez utraty jakości. ✅
- **Bezpiecznik znakowy** (`compactToolResults`): celowo produkuje „niepełny" JSON + czytelny marker —
  to treść promptu (nie parsowana przez nas), więc dopuszczalne; delimiter/„NIEUFNE DANE" dokłada
  wołający i pozostają nienaruszone (C-41/prompt-injection). ✅
- **Spójność kosztu z `AiCall`**: `accrueUsage` liczy koszt tym samym `estimateCostUsd` i tymi samymi
  polami co `recordAiCall` → wskaźnik w oknie czatu zgodny z sumą w `/admin/ai-calls`. ✅
- **UI** (`MetaFooter`): `var(--text-muted)` (nie hex, C-30), jeden dyskretny wiersz (nie łamie mobile,
  C-31), teksty PL (C-32); człon kosztu pomijany przy 0/nieznanym modelu. ✅
- **Router** (`routeModules`): `meta` opcjonalne; ścieżki keyword/`allowed<=3`/błąd nie wołają LLM →
  nic nie doliczają (poprawnie). ✅
- **Brak zmian**: schematu/migracji (C-10/11/12), Server Actions/RBAC (C-20/22), `AIAction`
  (C-23, `check:actions` OK), providera/modelu (C-40). ✅
- **Minimalizm** (C-53): helpery wydzielone do jednego czystego, testowalnego modułu; zero nowych
  zależności; odchudzenie promptu konserwatywne (bez ruszania opisów pól narzędzi). ✅

## Werdykt
**APPROVE Z UWAGAMI.** Jedyne istotne ustalenie (podwójne liczenie budżetu) zostało **naprawione w ramach
recenzji** i zweryfikowane (tsc/testy/build zielone). Uwaga niezmieniona z `verify.md`: AC-5/AC-7 w
części „na żywo" wymagają płatnego modelu (niedostępny w sandboxie) — potwierdzenie po deployu na
`develop` wg `report-przed-po.md §5`. To świadome ograniczenie, nie blokada. Domykam pipeline zgodnie ze
standing authorization: merge do `develop`, następnie automatyczna promocja `develop → master`.
