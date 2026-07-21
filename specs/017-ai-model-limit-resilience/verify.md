# Weryfikacja: Odporność asystenta AI na wyczerpanie limitu modelu

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-21

## Bramki techniczne
| Komenda | Wynik |
|--------|-------|
| `npm run check:actions` | ✅ 159 akcji, wszystkie z executorem |
| `npm run check:migrations` | ✅ OK (brak nowej migracji — następny wolny 0207) |
| `next lint --dir src` | ✅ Bez błędów (tylko wcześniejsze ostrzeżenia, niezwiązane) |
| `next build` (lokalny Postgres, C-13) | ✅ Kompilacja OK, trasy wygenerowane |
| `npm run test:unit` | ✅ 414 pass / 0 fail (w tym 6 nowych `rateLimitMessage`) |

## Kryteria akceptacji
- **AC-1** (degradacja odpowiada) — ✅ **spełnione.** Dowód: `resolveLlmChain("reasoning")` przy kluczu
  Groqa zwraca **`llama-3.3-70b-versatile → llama-3.1-8b-instant`** (uruchomione na lokalnej bazie). Skoro
  `chatComplete` iteruje łańcuch i przy 429 (retryable) próbuje kolejnego ogniwa (`chat.ts:214`), agent po
  429 na 70b degraduje na 8b (osobny budżet) i zwykle odpowiada. `dispatch` bez zmian (jedno ogniwo 8b).
- **AC-2** (limit dzienny → uczciwy komunikat) — ✅ **spełnione.** `classifyRateLimitKind(TPD)` → `"daily"`;
  `rateLimitUserMessage("daily")` = „Wyczerpano **dzienny** limit… po północy (UTC)… **Admin → LLM**"
  (test `rateLimitMessage.test.ts`). Route używa tej ścieżki (`route.ts` catch 429).
- **AC-3** (limit minutowy → „za chwilę") — ✅ **spełnione.** `classifyRateLimitKind(TPM)` → `"minute"`;
  komunikat zawiera „spróbuj za chwilę" (test).
- **AC-4** (nigdy surowy tekst dostawcy) — ✅ **spełnione.** Route zwraca wyłącznie
  `rateLimitUserMessage(...)` dla 429; test potwierdza, że żaden komunikat nie zawiera „Rate limit reached
  for model …". Treść dostawcy służy tylko klasyfikacji/logowi.
- **AC-5** (płatny Anthropic bez regresji) — ✅ **spełnione.** Dowód: z adminowym przypisaniem Anthropic
  łańcuch = **`anthropic:claude-sonnet-5 → 70b → 8b`** (uruchomione) — Anthropic jest **1. ogniwem**
  (używane najpierw), 8b to tylko last-resort. Ścieżka płatna niezmieniona.
- **AC-6** (brak regresji) — ✅ **spełnione.** Pacing (016), retry/backoff (010), diagnostyka `AiCall`
  (per rozmowa) nietknięte; `chatComplete` iteruje łańcuch jak dotąd i loguje każdą próbę (w tym
  degradację). Build + 414 testów zielone. Zmiana statusów ≠ 429 w route bez zmian.

## Zgodność z konstytucją
- **C-40** ✅ — degradacja rozszerza **istniejący** łańcuch w resolverze (DB-driven), nie hardkoduje modelu
  w kodzie cechy; admin nadal decyduje o 1. ogniwie.
- **C-41 / C-32** ✅ — komunikaty po polsku, nigdy surowy tekst/klucz dostawcy.
- **C-53** ✅ — 3 pliki + test; reuse łańcucha fallbacku; zero nowych zależności.
- **C-10..C-14** ✅ — nie dotyczą (brak zmian schematu). **C-23** ✅ — brak nowej AIAction.
- **C-51 / C-54** ✅ — wpis do `doświadczenia.md`; spec/plan/tasks spójne z implementacją.

## Regresje
- **Brak wykrytych.** Zmiana izolowana do warstwy LLM (resolver/chat) i jednego bloku `catch` w trasie
  agenta. Bez zmian w Server Actions, schemacie, RBAC, UI-nawigacji. `dispatch`/`vision`/`generation`
  nietknięte (8b-fallback tylko dla `reasoning`).

## Werdykt końcowy
**GOTOWE.** Wszystkie AC spełnione (AC-1/AC-5 potwierdzone uruchomieniem `resolveLlmChain`), bramki
zielone, brak regresji. Przechodzę do `/review`.
