# Zadania: Optymalizacja kosztów asystenta AI

- **Plan:** ./plan.md (028-ai-assistant-cost-optimization)
- **Status:** done
- **Data:** 2026-07-23

> **Zasada listy zadań:** od najłatwiejszego do najtrudniejszego, zgodnie z zależnościami. Feature **nie
> rusza schematu, Server Actions ani RBAC** — więc Faza 0/1 (migracja/akcje) i klasyczna Faza AIAction
> **nie dotyczą**. Praca skupia się w pętli agenta (`route.ts`), promptach (`agentTools.ts`), fast-path
> (`fastPath.ts`) i jednym komponencie UI (`AICommandSheet.tsx`).

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
- [x] **T-0** — **Bez zmian schematu i migracji** (plan §2). Potwierdzenie: `npm run check:migrations`
      przechodzi bez nowych katalogów migracji. *Gotowe, gdy:* brak zmian w `prisma/`.

## Faza 1 — Rdzeń oszczędności (pętla agenta) — ścieżka krytyczna
- [x] **T-1** — Helper `compactToolResults(results)` w `route.ts` (plan §6a): stałe
      `TOOL_RESULT_MAX_CHARS` / `PER_TOOL_MAX_CHARS`; obcięcie listy rekordów z czytelnym znacznikiem
      `"… [ucięto: pokazano X z Y — zawęź zapytanie]"`; **zachowany** delimiter `<<<DANE … DANE>>>` +
      adnotacja „NIEUFNE DANE". *Gotowe, gdy:* krok `query` wstrzykuje wynik przez helper; delimiter i
      adnotacja obecne. (AC-2, AC-8)
- [x] **T-2** — Test jednostkowy helpera (`src/lib/llm/__tests__/…` lub `src/lib/ai/__tests__/…` obok
      istniejących): (i) obcięcie do limitu, (ii) obecność znacznika „ucięto X z Y", (iii) zachowany
      delimiter/„NIEUFNE DANE". *Gotowe, gdy:* test przechodzi (`npm test` / vitest). (AC-2, AC-8)
- [x] **T-3** — **Zwijanie zużytych bloków** w `runAgentLoop` (plan §6a): przed kolejnym wywołaniem
      modelu starsze wiadomości z wynikami narzędzi (poza **ostatnim** blokiem) zastępujemy stubem
      `"[wyniki narzędzi z wcześniejszego kroku — już wykorzystane]"`; rozpoznawanie bloków po stałym
      prefiksie treści. *Gotowe, gdy:* w scenariuszu `query→query→answer` re-wysyłany jest tylko ostatni
      pełny blok danych; id do akcji pozostają w aktualnym bloku. (AC-1)

## Faza 2 — Odchudzenie promptów [P względem Fazy 1]
- [x] **T-4** `[P]` — Zwięźlejszy `buildSystemPrompt` w `route.ts` (plan §6b): usuń redundancje w
      `ZASADY`/nagłówkach protokołu **bez usuwania żadnej reguły** (protokół 6 kroków, BEZPIECZEŃSTWO,
      query-first, clarify-not-guess, bulk/chain, wybór modułu). *Gotowe, gdy:* prompt krótszy, komplet
      reguł zachowany (checklista reguł w opisie commita). (AC-3)
- [x] **T-5** `[P]` — Zwięźlejszy `READ_TOOLS_PROMPT` w `agentTools.ts` (plan §6b): opisy narzędzi do
      formy „sygnatura + 1 zdanie", **zachowując** nazwy pól wyników i parametry. *Gotowe, gdy:* każde
      narzędzie ma nadal komplet parametrów/pól; `buildReadToolsPrompt` filtruje jak dotąd. (AC-3)
- [x] **T-6** — Stabilizacja prefiksu pod cache (plan §6c): niezmienna preambuła na początku `system`,
      sekcje zmienne (katalog per-moduł) po niej; zero treści zmiennej (data/kontekst) w `system`.
      *Gotowe, gdy:* `system` nie zawiera pól zależnych od czasu/widoku; kolejność stała. (AC-4)
- [x] **T-7** — Pomiar statyczny „przed/po" rozmiaru promptu (proxy tokenów = znaki/4) dla ustalonego
      zestawu modułów. *Gotowe, gdy:* liczby zapisane do `specs/028-…/report-przed-po.md`. (AC-3, wkład do AC-7)

## Faza 3 — Wskaźnik kosztu (dokładność + UI)
- [x] **T-8** — Rozszerz `AgentMeta` (serwer, `route.ts`) o `promptTokens/completionTokens/cacheRead/
      cacheWrite/costUsd`; w `callAgent` akumuluj rozbicie z `result.usage` i licz koszt przez
      `estimateCostUsd(…, result.model)` (import z `@/lib/llm/pricing`). *Gotowe, gdy:* `meta.costUsd`
      trafia do `result.body.meta` (SSE `final` i JSON). (AC-6)
- [x] **T-9** — Realność wskaźnika: `routeModules` (`route.ts`) i `classifyIntent`
      (`src/lib/ai/fastPath.ts`) przyjmują/zwracają `usage`, dokładany do `meta`; fast-path zwraca
      `meta` z realnym kosztem klasyfikacji zamiast `tokens:0`. *Gotowe, gdy:* koszt routera/fast-path
      wliczony do zwracanej `meta`. (AC-6, AC-7)
- [x] **T-10** — UI: rozszerz `AgentMeta` (klient) + `MetaFooter` w `AICommandSheet.tsx` o człon kosztu
      (`~$0.0009`), zmienne CSS (C-30), dyskretnie, teksty PL; gdy koszt=0 → pomiń człon. Uwzględnij
      koszt w eksporcie logu (~l. 186). *Gotowe, gdy:* build UI OK, footer pokazuje koszt. (AC-6)

## Faza 4 — Bramki i domknięcie
- [x] **T-11** — `npm run check:actions` + `npm run check:migrations` + `next lint` + `next build`
      (do `next build`; **nie** `migrate.js` na prod — C-13). *Gotowe, gdy:* zielone. (AC-9)
- [x] **T-12** — Uzupełnij `report-przed-po.md`: proxy tokenów promptu (T-7), szacowany wpływ
      kompaktowania/zwijania na zapytania wieloetapowe, instrukcja potwierdzenia live w `/admin/ai-calls`
      (niższe `promptTokens`/`cacheRead>0`). *Gotowe, gdy:* raport kompletny. (AC-7)
- [x] **T-13** — Mapowanie każdego AC → wynik (input do `/verify`); odnotuj AC weryfikowane
      strukturalnie teraz + live po deployu (AC-5/AC-7). *Gotowe, gdy:* tabela AC→dowód gotowa.
- [x] **T-14** — Wpis do `doświadczenia.md`, jeśli po drodze był nieoczywisty problem (C-51).

## Mapowanie AC → zadania
| AC | Zadania |
|----|---------|
| AC-1 (redukcja kontekstu pętli) | T-3 |
| AC-2 (limit rozmiaru danych) | T-1, T-2 |
| AC-3 (odchudzony prompt) | T-4, T-5, T-7 |
| AC-4 (cache prefiksu) | T-6 |
| AC-5 (bez utraty jakości) | T-3/T-4/T-5 (zachowanie reguł/danych) + T-13 (strukturalnie + live) |
| AC-6 (wskaźnik w oknie asystenta) | T-8, T-9, T-10 |
| AC-7 (spójny pomiar) | T-7, T-9, T-12 |
| AC-8 (bezpieczeństwo) | T-1, T-2 |
| AC-9 („gotowe" — build) | T-11 |

## Ścieżka krytyczna
`T-1 → T-2 → T-3` (rdzeń oszczędności) to sedno. Faza 2 (`T-4/T-5/T-6/T-7`) jest **równoległa** do Fazy
1 (inne fragmenty/pliki). Faza 3 (`T-8 → T-9 → T-10`) zależy od kształtu `meta` (T-8 przed T-10). Bramki
`T-11` po wszystkich zmianach kodu; `T-12/T-13/T-14` domykają.

## Notatki / blokady
- **Sandbox nie trafia płatnego modelu** → AC-5/AC-7 „live" potwierdzamy strukturalnie teraz i na
  `develop` po deployu (odnotowane w planie §8 i T-13). To nie jest luka, lecz świadome ograniczenie.
