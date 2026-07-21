# Zadania: Odporność asystenta AI na wyczerpanie limitu modelu

- **Plan:** ./plan.md (017-ai-model-limit-resilience)
- **Status:** todo
- **Data:** 2026-07-21

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego. Tu **nie ma** migracji ani
> nowej `AIAction` — zmiana jest czysto w warstwie LLM + trasie agenta.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

## Faza 0 — Fundament danych
- [ ] **T-0** — Brak: bez zmian w schemacie/migracjach/RBAC (plan §2/§4). Jawnie odnotowane.

## Faza 1 — Warstwa LLM (klasyfikacja + degradacja)
- [x] **T-1** — W `src/lib/llm/chat.ts` dodać i wyeksportować czyste funkcje:
  `classifyRateLimitKind(message): "daily" | "minute" | "generic"` (daily = `per day`/`TPD`/`tokens per day`;
  minute = `per minute`/`TPM`/`tokens per minute`; inaczej generic — bez rozróżniania wielkości liter) oraz
  `rateLimitUserMessage(kind): string` (polskie komunikaty wg planu §6b). Podnieść obcięcie treści błędu
  `slice(0, 200)` → `slice(0, 300)` w `openAiComplete`/`anthropicComplete`.
  **Gotowe, gdy:** funkcje istnieją, są eksportowane; treść błędu nie jest ucinana przed sygnałem TPD/TPM.
- [x] **T-2** — W `src/lib/llm/resolver.ts` w `resolveLlmChain`: dla `op === "reasoning"` dołożyć ostatnie
  ogniwo fallbacku — Groq (`GROQ_BASE_URL`, klucz z `Config.groq_api_key`) z modelem
  `OPERATION_TYPE_META.dispatch.defaultModel` (`llama-3.1-8b-instant`); tylko gdy klucz Groqa istnieje;
  dedup (`add()`) chroni przed duplikatem. Inne operacje bez zmian.
  **Gotowe, gdy:** `resolveLlmChain("reasoning")` przy kluczu Groqa zawiera 8b jako ostatnie ogniwo (po 70b),
  a przy adminowym Anthropic — Anthropic pozostaje 1. ogniwem.

## Faza 2 — Trasa agenta (komunikat)
- [x] **T-3** — W `src/app/api/llm/home/agent/route.ts` (`runAgentLoop`, blok `catch` dla `status === 429`)
  zamiast stałej treści użyć `classifyRateLimitKind(e.message)` → `rateLimitUserMessage(kind)`. Nigdy nie
  zwracać surowego `e.message` (C-41). Statusy ≠ 429 bez zmian.
  **Gotowe, gdy:** dla 429 użytkownik dostaje komunikat zależny od typu limitu (dzienny vs minutowy), po polsku.

## Faza 3 — Test / regresja
- [x] **T-4** `[P]` — `src/lib/llm/__tests__/rateLimitMessage.test.ts` (`node:test`): (a) `classifyRateLimitKind`
  na realnych treściach z logów — „…on tokens per day (TPD): Limit 100000…" → `daily`; „…tokens per minute
  (TPM): Limit 12000…" → `minute`; treść bez sygnału → `generic`; (b) `rateLimitUserMessage("daily")` wspomina
  o **dziennym** limicie i panelu LLM, `("minute")` mówi „za chwilę".
  **Gotowe, gdy:** `npm run test:unit` zielony dla nowego pliku.

## Faza 4 — Bramki i domknięcie
- [x] **T-5** — `next lint` + `next build` (lokalny Postgres, C-13); `check:actions`/`check:migrations`
  przechodzą bez zmian (brak nowej AIAction/migracji). **Gotowe, gdy:** build zielony.
- [x] **T-6** — Mapowanie AC → wynik (input do `/verify`): AC-1 (łańcuch reasoning 70b→8b), AC-2/AC-3/AC-4
  (klasyfikacja + polskie komunikaty, nigdy surowy tekst), AC-5 (Anthropic 1. ogniwem, bez regresji),
  AC-6 (pacing/retry/diagnostyka nietknięte).
- [x] **T-7** — Wpis do `doświadczenia.md` (C-51): limit Groqa bywa **dzienny** (TPD 100k), nie tylko
  minutowy; retry/pacing nie pomagają — degraduj na lżejszy model (osobny budżet) i mów prawdę
  (dzienny vs minutowy).

## Mapowanie AC → zadania
- **AC-1** → T-2 (+ istniejąca iteracja łańcucha w `chatComplete`)
- **AC-2, AC-3, AC-4** → T-1, T-3, T-4
- **AC-5** → T-2 (kolejność ogniw), T-5/T-6 (brak regresji)
- **AC-6** → T-5, T-6 (nietknięte ścieżki 010/016)

## Ścieżka krytyczna
T-1 (klasyfikacja) → T-3 (użycie w route). T-2 (resolver) niezależne od T-1/T-3 — `[P]`. T-4 po T-1.
T-5 (build) po T-1..T-3. T-6/T-7 domknięcie.

## Notatki / blokady
- Brak. Zmiana trzypunktowa (resolver + chat + route) + test; zero zależności zewnętrznych.
