# Weryfikacja: Architektura AI dla Asystenta Osobistego

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Data:** 2026-07-15

## Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)" |
| `npm run check:actions` | ✅ „95 akcji w katalogu, wszystkie obsługiwane przez executor" (brak nowych `AIAction`) |
| `next lint --dir src` | ✅ tylko wcześniejsze ostrzeżenia (exhaustive-deps/`<img>`); **zero** w nowych plikach |
| `next build` | ✅ „Compiled successfully"; `/admin/llm` zbudowane; lokalny Postgres (C-13, nie prod DB) |
| `prisma migrate deploy` (lokalnie) | ✅ zaaplikowano `0205_ai_call_log` |

## Kryteria akceptacji

- **AC-1** (proste polecenie bez `reasoning`) — ✅. `agent/route.ts:647` woła `classifyIntent` **przed**
  `routeModules`/`runAgentLoop`; przy `simple` zwraca krok `plan` i **nie** wchodzi do `callAgent`
  (jedyny wywoływacz `op:"reasoning"`, route:306). Klasyfikator używa `op:"dispatch"` + `source:"fast_path"`
  → w logu `AiCall` powstaje najwyżej jeden wpis `dispatch`, zero `reasoning`. Dowód: `fastPath.ts`
  `classifyIntent` + wpięcie w route.
- **AC-2** (ActionDrawer, destructive opt-in) — ✅. Fast-path zwraca `{step:"plan",actions,…}` w tym samym
  kształcie co pętla; klient (`AICommandSheet.tsx:451` fallback JSON) → `applyResponse` renderuje
  ActionDrawer bez zmian. Biała lista fast-path nie zawiera akcji destrukcyjnych, więc reguła
  odznaczania destrukcyjnych nietknięta.
- **AC-3** (złożone → pełna pętla) — ✅. `classifyIntent` przy niepewności/pytaniu/lookupie/analizie
  zwraca `complex`; route przechodzi dalej do `routeModules` + `runAgentLoop` (`op:"reasoning"`,
  `source:"home_agent"`). Bez regresji funkcjonalnej.
- **AC-4** (prompt caching Anthropic) — ✅ (z uwagą). `chat.ts` `toAnthropicSystem` opakowuje `system` w
  blok z `cache_control:{type:"ephemeral"}` w ścieżce complete (235) i stream (358); `anthropicComplete`
  odczytuje `cache_read_input_tokens`/`cache_creation_input_tokens` do `usage`. Groq (`openAiComplete`)
  nietknięty. Uwaga: krótkie prompty `dispatch` (poniżej minimalnego prefiksu ~4096 tok. dla Haiku)
  naturalnie się nie zacache'ują — to zamierzone „gdzie dostępne", bez błędu.
- **AC-5** (widok kosztów per model/operacja) — ✅. `recordAiCall` w `chatComplete` (chat.ts:111) zapisuje
  każde wywołanie; `getAiCostBreakdown` (`llmConfig.ts`) grupuje `AiCall` po `model`+`operationType`
  (liczba/tokeny/koszt/śr. czas); `LlmConfigPanel` renderuje tabelę na `/admin/llm`.
- **AC-6** (alert progowy) — ✅. `usage.ts` `maybeFireCostAlert`: czyta `Config.ai_cost_daily_alert_usd`,
  sumuje dzienny koszt, przy przekroczeniu `notifyUser` do adminów z `dedupeKey:"ai-cost-alert-<dzień>"`
  (jeden alert/dobę), bez blokowania asystenta. Próg ustawiany w UI (`setCostAlertThreshold`).
- **AC-7** (profil Anthropic; Groq domyślny) — ✅. `applyAnthropicProfile` upsertuje providera `anthropic`
  (`encryptSecret`) i przypisania reasoning/generation/vision→`claude-sonnet-5`, dispatch→`claude-haiku-4-5`;
  **nie** rusza providera Groq — resolver trzyma go jako fallback (`resolver.ts` krok 2, `groq_api_key`),
  więc środowisko bez klucza Anthropic działa. Modele edytowalne w tabeli przypisań.
- **AC-8** (guardy rozmiaru danych/historii) — ✅. Historia capowana `MAX_HISTORY_MESSAGES=12` (istniejące);
  dołożono `take:HARD_MAX` do 3 zapytań list zwracanych do modelu (`agentTools.ts`: list_projects,
  list_shopping_lists ×2); pozostałe read-toole już miały `take`/`clampLimit`.
- **AC-9** (`npm run build` zielony) — ✅. `next build` „Compiled successfully"; bramki `check:*` zielone.

## Zgodność z konstytucją
- C-10/C-11/C-12 ✅ — ręczna migracja `0205_ai_call_log`, pola `String`/`Float`, zero enumów.
- C-20 ✅ — nowe akcje kończą `revalidatePath("/admin/llm")`. C-23 ✅ — brak nowych `AIAction`.
- C-25 ✅ — `logAudit("config", …)` na progu i profilu. C-40/C-41 ✅ — routing DB-driven, klucz szyfrowany.
- C-30/C-31/C-32 ✅ — zmienne CSS + `var(--on-accent)`, tabela `overflow-x:auto`, teksty PL.
- C-53 ✅ — brak nowych zależności/modułu; rozbudowa istniejących plików; fast-path reużywa akcje.
- C-51 ✅ — wpis do `doświadczenia.md` (Prisma 7 vs 5 przy weryfikacji builda).

## Regresje
- `chat.ts` — zmiany addytywne; `recordAiCall` fire-and-forget z `.catch`, nie blokuje odpowiedzi.
  `system` jako blok-tablica jest poprawny dla Messages API (string LUB tablica). Groq bez zmian.
- `usage.ts` — nowe importy (`pricing`, `permissions`, `notifications`) bez cyklu (build przeszedł).
- Nowa tabela `AiCall` niezależna (bez FK) — brak wpływu na istniejące modele/migracje/RBAC.
- `agentTools.ts` — tylko dodane `take`, semantyka bez zmian.

## Werdykt końcowy
**GOTOWE Z UWAGAMI.** Wszystkie AC-1…AC-9 spełnione (prześledzone w kodzie + zielony build/bramki).
Uwagi (nie-blokujące): (1) cache promptu realnie działa dla dużego prefiksu `reasoning` (Sonnet);
krótkie prompty `dispatch` nie osiągają min. prefiksu — zamierzone. (2) Weryfikacja przez prześledzenie
logiki + build; pełny smoke na żywym providerze Anthropic wymaga klucza (środowisko testowe `develop`).
