# Zadania: Naprawa czatu asystenta AI po wyborze dostawcy Anthropic (`temperature`)

- **Plan:** ./plan.md (026-anthropic-temperature-fix)
- **Status:** todo
- **Data:** 2026-07-23

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Feature jest czysto backendowy (warstwa klienta LLM) — brak migracji, RBAC, UI i AIAction. Fazy
> danych/UI/AI są świadomie puste.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można robić równolegle

## Faza 0 — Fundament danych
- Brak. **Bez zmian w schemacie i migracjach** (plan §2) — C-10..C-12 nie dotyczą.

## Faza 1 — Warstwa serwera / biblioteka LLM
- [x] **T-1** — W `worldofmag/src/lib/llm/chat.ts` wyodrębniono budowę ciała żądania do czystych,
  eksportowanych funkcji: `anthropicBody(cfg, opts, stream)` i `openAiBody(cfg, opts, stream)`,
  zwracających obiekt body przed `JSON.stringify`. Bez zmiany zachowania sieciowego — refaktor w
  służbie testu (C-53). `anthropicComplete`, `anthropicStream`, `openAiComplete`, `openAiStream`
  używają nowych builderów.
- [x] **T-2** — W builderze Anthropic **usunięto pole `temperature`** z ciała żądania (oba warianty:
  jednorazowy i `stream:true`). Ścieżka OpenAI-compatible zachowuje `temperature: opts.temperature ??
  cfg.temperature ?? undefined`. Realizuje AC-1, AC-3, AC-4, AC-5.

## Faza 2 — UI
- Brak (plan §5) — naprawa backendowa.

## Faza 3 — AI / integracje
- Brak nowej `AIAction` ani read-toola (plan §6) — `check:actions` pozostaje zielone bez zmian.

## Faza 4 — Bramki i domknięcie
- [x] **T-3** — Nowy test jednostkowy `worldofmag/src/lib/llm/__tests__/anthropicBody.test.ts`
  (wzorzec: istniejące testy w `__tests__/`). Przypadki:
  (a) Anthropic + `opts.temperature=0.2` → body **bez** `temperature`;
  (b) Anthropic + `cfg.temperature=0.7`, bez `opts.temperature` → body **bez** `temperature`;
  (c) Anthropic stream (`stream:true`) → body **bez** `temperature`, zawiera `stream:true`;
  (d) OpenAI-compatible + `opts.temperature=0.2` → body **z** `temperature: 0.2`;
  (e) Anthropic → body zawiera `max_tokens`, `messages` (sanity). **Gotowe, gdy:** `npm run test:unit`
  (node:test) zielone dla nowego pliku. Realizuje/weryfikuje AC-1, AC-3, AC-4.
- [ ] **T-4** — Bramki: `npm run check:migrations`, `npm run check:actions`, `npx next lint`, `next build`
  (lokalny Postgres — C-13; **nie** odpalać `migrate.js`/pełnego `npm run build` przeciw prod DB).
  Uruchomić też pełny `npm run test:unit` (regresja `fallback.test.ts`, `rateLimitMessage.test.ts`,
  `tpmLimiter.test.ts`). **Gotowe, gdy:** wszystko zielone do `next build`.
  ✅ test:unit 347 pass/0 fail · check:migrations OK · check:actions OK · next lint (tylko istniejące
  ostrzeżenia) · tsc --noEmit czysto · next build exit 0.
- [x] **T-5** — Wpis-lekcja do `doświadczenia.md` (root, PL, format `## YYYY-MM-DD — tytuł` /
  `**Problem:**` / `**Rozwiązanie:**` / `**Lekcja:**`) o `temperature` deprecated w nowych modelach
  Anthropic i o tym, że błąd 400 przerywa łańcuch fallbacku (C-51).

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadanie(a) | Sposób weryfikacji |
|----|-----------|--------------------|
| AC-1 (Anthropic reasoning bez `temperature`, brak 400) | T-2, T-3 | Test jednostkowy (body bez `temperature`) |
| AC-2 (czat odpowiada) | T-2 | Wynika z AC-1; weryfikacja manualna na `develop` po deployu (dostawca Anthropic) |
| AC-3 (streaming bez `temperature`) | T-2, T-3 | Test jednostkowy przypadek (c) |
| AC-4 (Groq/OpenAI bez regresji) | T-2, T-3 | Test jednostkowy przypadek (d) + brak zmian w `openAi*` |
| AC-5 (dispatch/JSON Anthropic OK) | T-2 | Wynika z AC-1 (brak 400); determinizm prompt-based |

## Ścieżka krytyczna
T-1 (refaktor builderów) → T-2 (usunięcie `temperature` dla Anthropic) → T-3 (test) → T-4 (bramki) →
T-5 (lekcja). Wszystkie sekwencyjne w tym samym pliku — brak zadań `[P]`.

## Notatki / blokady
- Brak.
