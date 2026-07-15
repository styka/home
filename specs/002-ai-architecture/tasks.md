# Zadania: Architektura AI dla Asystenta Osobistego

- **Plan:** ./plan.md (002-ai-architecture)
- **Status:** done
- **Data:** 2026-07-15

> Kolejność: dane → warstwa LLM/serwer → UI → wpięcie AI → bramki. Każde zadanie ≈ jeden commit.
> Odhaczamy `[ ]`→`[x]` w `/implement`. `[P]` = niezależne pliki, można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego

## Faza 0 — Fundament danych
- [x] **T-1** — Model `AiCall` w `prisma/schema.prisma` (pola/indeksy wg planu §2, `String`+union, bez FK do User). `prisma generate` czysto.
- [x] **T-2** — Migracja `prisma/migrations/0205_ai_call_log/migration.sql` (CREATE TABLE "AiCall" + 3 indeksy). **Gotowe, gdy** `npm run next:migration` potwierdza 0205 i `npm run check:migrations` przechodzi.

## Faza 1 — Warstwa LLM (rdzeń)
- [x] **T-3** — `src/lib/llm/pricing.ts` (nowy): mapa `model→{inputPer1M,outputPer1M,cacheReadPer1M?}` + `estimateCostUsd(usage,model)`; wpisy Sonnet 5 (3/15), Haiku 4.5 (1/5), Groq/Llama domyślne; fallback 0. **Gotowe, gdy** funkcja liczy koszt „szacowany" z tokenów (w tym cacheRead 0.1×, cacheWrite 1.25×).
- [x] **T-4** — Prompt caching Anthropic w `src/lib/llm/chat.ts`: `toAnthropic` → `system` jako blok z `cache_control:{type:"ephemeral"}`; rozszerz `TokenUsage` o `cacheRead/cacheWrite`; odczyt `cache_read_input_tokens`/`cache_creation_input_tokens` w `anthropicComplete`/`anthropicStream`; Groq bez zmian. **Gotowe, gdy** typ się kompiluje i dla Anthropic usage niesie pola cache (AC-4).
- [x] **T-5** — Log per-wywołanie: `recordAiCall(entry)` w `src/lib/ai/usage.ts` (+ dzienna suma `costUsd` z `AiCall`, UTC) i wywołanie z `chatComplete` (pomiar `latencyMs` wokół fetch, koszt z T-3, fire-and-forget, `source` z opcji). **Gotowe, gdy** każde `chatComplete` zapisuje `AiCall` (AC-5 dane źródłowe).
- [x] **T-6** — Alert kosztowy w `usage.ts`: po `recordAiCall`, jeśli `Config.ai_cost_daily_alert_usd>0` i dzienna suma go przekracza → `notifyUser` do adminów (`module:"admin"`, `dedupeKey:"ai-cost-alert-<dzień>"`), bez blokowania. **Gotowe, gdy** przekroczenie progu daje jedno powiadomienie/dzień (AC-6).

## Faza 2 — Fast-path intencji
- [x] **T-7** — `src/lib/ai/fastPath.ts` (nowy): `classifyIntent(text,activeModules,userId)` — jedno `chatComplete({op:"dispatch",…, source:"fast_path"})` zwracające `{kind:"simple",action}` dla białej listy (add_item/create_task/create_note/add_expense/add_income/toggle_habit/add_pantry_item/plan_meal/add_fuel_log) albo `{kind:"complex"}`; niepewność/błąd → complex. Reużywa istniejące typy `AIAction` (bez nowych). **Gotowe, gdy** funkcja mapuje proste polecenie na `AIAction`, resztę na complex.
- [x] **T-8** — Wpięcie w `src/app/api/llm/home/agent/route.ts`: na ścieżce świeżego polecenia, przed `routeModules`/`runAgentLoop`, wywołaj `classifyIntent`; `simple` → zwróć `{step:"plan",actions,thought,log,messages}` (kształt jak `runAgentLoop`, `meta.source:"fast_path"`); `complex`/wznowienia → bez zmian. **Gotowe, gdy** „dodaj mleko" daje `plan` bez wpisu `reasoning` w logu, a „zaplanuj weekend" idzie pełną pętlą (AC-1, AC-2, AC-3).
- [x] **T-9** `[P]` — Audyt limitów read-toolów w `src/lib/ai/agentTools.ts`: dołóż `take`/limit tam, gdzie brak (historia już capowana ≤12). **Gotowe, gdy** żadne read-narzędzie nie zwraca nielimitowanego zbioru (AC-8).

## Faza 3 — Konfiguracja i widok admina
- [x] **T-10** — Server Actions w `src/actions/llmConfig.ts`: `getAiCostBreakdown(days)`, `getCostAlertThreshold`/`setCostAlertThreshold` (+`revalidatePath("/admin/llm")`, log `AuditLog` kat. `config`). **Gotowe, gdy** akcje zwracają rozbicie per model/typ operacji (AC-5) i zapis progu działa.
- [x] **T-11** — Server Action `applyAnthropicProfile({apiKey})` w `src/actions/llmConfig.ts`: upsert providera Anthropic (`encryptSecret`), przypisania reasoning/generation→`claude-sonnet-5`, dispatch→`claude-haiku-4-5`, vision→`claude-sonnet-5`; Groq nietknięty; `revalidatePath` + `AuditLog`. **Gotowe, gdy** wywołanie ustawia Sonnet/Haiku, Groq zostaje fallbackiem (AC-7).
- [x] **T-12** — UI w `src/components/admin/LlmConfigPanel.tsx` + `src/app/admin/llm/page.tsx`: tabela kosztów (wywołania/tokeny in-out+cache/koszt „szacowany"/śr. czas per model+typ), pole progu alertu, przycisk „Zastosuj profil Anthropic (Sonnet + Haiku)" z polem klucza + instrukcja PL. Motyw: zmienne CSS, `var(--on-accent)`, tabela `overflow-x:auto`. **Gotowe, gdy** `/admin/llm` pokazuje koszty i pozwala ustawić profil/próg (AC-5, AC-6, AC-7).

## Faza 4 — Bramki i domknięcie
- [x] **T-13** — `npm run check:migrations` + `npm run check:actions` (brak nowych `AIAction` → zielone) + `next lint` + `next build` na lokalnym Postgresie (C-13, nigdy prod DB). **Gotowe, gdy** wszystkie zielone (AC-9).
- [x] **T-14** — Mapowanie każdego AC (AC-1…AC-9) na konkretny wynik/miejsce weryfikacji (input do `/verify`).
- [x] **T-15** — Wpis do `doświadczenia.md`, jeśli po drodze pojawił się nieoczywisty problem (C-51).

## Mapowanie AC → zadania
- AC-1 (fast-path bez reasoning) → T-7, T-8 · AC-2 (ActionDrawer) → T-8 · AC-3 (złożone → agent) → T-7, T-8
- AC-4 (prompt caching) → T-4 · AC-5 (widok kosztów) → T-5, T-10, T-12 · AC-6 (alert progowy) → T-6, T-10, T-12
- AC-7 (profil Anthropic) → T-11, T-12 · AC-8 (limity danych/historii) → T-9 · AC-9 (build zielony) → T-13

## Ścieżka krytyczna
T-1→T-2 (dane) → T-5/T-6 (log/alert zależą od `AiCall`) ; T-3→T-5 (koszt) ; T-4 niezależny (caching) ;
T-7→T-8 (fast-path) ; T-10/T-11→T-12 (UI zależy od akcji) ; wszystko → T-13 (bramki) → T-14/T-15.
`[P]`: T-9 równolegle do fast-path/UI.

## Notatki / blokady
- Brak. Zero nowych `AIAction` → `check:actions` bez nowych egzekutorów. Migracja/build tylko na lokalnym Postgresie.
