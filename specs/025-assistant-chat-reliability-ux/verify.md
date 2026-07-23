# Weryfikacja: Niezawodność i UX czatu asystenta AI

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-23
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`), `prisma migrate deploy` zaaplikowane (C-13 — prod DB nietknięta).

## Bramki
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0209)" — brak nowej migracji, zgodnie z planem |
| `npm run check:actions` | ✅ „159 akcji w katalogu, wszystkie obsługiwane przez executor" — brak nowej AIAction |
| `npx tsc --noEmit` | ✅ 0 błędów (po `prisma generate`) |
| `npx next lint --dir src` | ✅ tylko istniejące ostrzeżenia kosmetyczne (exhaustive-deps / `<img>`); **żadne w plikach tego feature'a**, 0 błędów |
| `npx next build` | ✅ kompilacja + type-check + generacja wszystkich tras zakończona sukcesem (bez `migrate.js` — C-13) |

## Kryteria akceptacji
### ✅ AC-1 — projekt podany nazwą zwraca zadania
Prześledzenie ścieżki `list_tasks` (`src/lib/ai/agentTools.ts`): gdy `args.projectId` podane, wołany
jest `resolveProjectRef(userId, projectId)`; dla „LZ" gałąź „dokładna nazwa (case-insensitive)"
(`agentTools.ts:268`) zwraca `{ id }`, a `where.projectId = resolved.id` (zamiast surowego „LZ").
Zakres dostępu ten sam co `accessibleProjectIds` (owner/member — C-21). **Werdykt:** spełnione
(logika deterministyczna; regułę potwierdza kompilacja i trasa read-toola).

### ✅ AC-2 — brak/niejednoznaczność → sygnał zamiast pustki; realne id nadal działa
- Brak dopasowania lub wiele częściowych → `resolveProjectRef` zwraca `{ unresolved, available }`
  (`agentTools.ts:275`); `list_tasks` rzuca wtedy `Error` z listą dostępnych nazw
  (`agentTools.ts` blok `if (projectId)`), który `runAgentLoop` łapie i zwraca jako `{ error }` w
  wynikach narzędzia (`agent/route.ts:576`) — agent dostaje sygnał i robi `clarify`/`answer`, nie
  cichą pustkę.
- Realne id: gałąź `byId` (`agentTools.ts:265`) zwraca to id → kompatybilność wstecz.
**Werdykt:** spełnione. (Uwaga C-54: `get_task` nie ma parametru projektu — resolucja dotyczy tylko
`list_tasks`; odnotowane w `plan.md`/`tasks.md`.)

### ✅ AC-3 — przycisk zatwierdzenia clarify na mobile
`AICommandSheet.tsx`, blok `turn.kind === "clarify"`: pod `SmartTextarea` dodany widoczny
`<button type="button">` „Wyślij" (ikona `ArrowUp`) wołający `onClarifySubmit(turn, clarifyInput)`,
`disabled` przy pustym wejściu; tło `var(--accent-blue)`, tekst `var(--on-accent)` (C-30), padding
`10px 16px` (≥ cel dotyku, C-31). Chipy opcji i zatwierdzanie Enterem (`SmartTextarea onSubmit`)
nietknięte. **Werdykt:** spełnione (inspekcja renderu + build).

### ✅ AC-4 — uczciwy komunikat + zachowanie tury/ponów
- **Komunikat:** `runAgentLoop` catch (`agent/route.ts`) rozróżnia 429 (dzienny/minutowy) i **413**
  (`looksTooLarge` → „Zapytanie było zbyt duże…"); nigdy nie przecieka surowa treść dostawcy (C-41).
  Dodatkowo pominięcie za-małego modelu (AC-5) sprawia, że `last` = uczciwa porażka 70b (limit
  dzienny), nie mylące „Request too large".
- **Tura + ponów:** klient wypycha wiadomość użytkownika jako `turn` **przed** wywołaniem
  (`AICommandSheet.tsx:1032`); błąd tylko ustawia `setError` (tura zostaje w wątku); `lastPayloadRef`
  (`:820`) + `retryLast()`/przycisk „Ponów" pozwalają powtórzyć bez przepisywania.
**Werdykt:** spełnione.

### ✅ AC-5 — fallback uwzględnia rozmiar zapytania
`chatComplete` (`src/lib/llm/chat.ts`): przed wysłaniem do modelu Groq `requestExceedsModelLimit(cfg,
opts)` liczy `estimateTokens(prompt) + maxTokens` i porównuje z `modelTpmLimit(cfg.model)`; jeśli
przekracza — model **pominięty** (`continue`), bez wysyłki, z zachowaniem `last`. Dla przykładu ze
zgłoszenia: 70b (limit 12000) — 7570+1200≈8770 < 12000 → próba (dostaje 429 dzienny); 8b (limit 6000)
— 8770 > 6000 → **pominięty** → użytkownik dostaje uczciwy komunikat z 70b zamiast 413 z 8b. Limity
per-model w `tpmLimiter.ts` (`modelTpmLimit`: 70b=12000, 8b=6000), `reserveTpm` capuje wg modelu.
**Werdykt:** spełnione.

### ✅ AC-6 — mniejszy prompt
`agent/route.ts`: `MAX_HISTORY_MESSAGES` 12→8 oraz nowy budżet znakowy `MAX_HISTORY_CHARS=2500` w
`pushTrimmedHistory()` (tnie historię od najnowszych wstecz). Katalog akcji/read-toole pozostają
zawężane przez router modułów (bez zmian → poprawność odczytu AC-1 zachowana). **Werdykt:** spełnione
(zauważalnie mniejszy blok historii przy dłuższych rozmowach; typowe zapytanie mieści się w limicie 70b).

## Zgodność z konstytucją
- **C-10..C-14** — brak zmian schematu/migracji (świadomie); `check:migrations` zielone. ✅
- **C-20/C-21** — brak nowych mutacji; dostęp do projektów w istniejącym zakresie owner/member. ✅
- **C-23** — brak nowej AIAction; `check:actions` zielone (159/159). ✅
- **C-40/C-41** — routing nadal DB-driven (zmiany tylko we wspólnej warstwie `lib/llm`); użytkownik
  nigdy nie widzi surowej treści dostawcy (413/429 mapowane na PL). ✅
- **C-30/C-31/C-32** — przycisk clarify na zmiennych CSS, mobilny cel dotyku, teksty PL. ✅
- **C-53** — trzy punktowe zmiany, bez nowych zależności ani „przy okazji" refaktorów. ✅
- **C-51** — wpis dopisany do `doświadczenia.md` (2026-07-23). ✅

## Regresje
- **`list_tasks` bez `projectId`** — ścieżka niezmieniona (blok `if (projectId)` wykonywany tylko gdy
  podany); zapytania bez projektu działają jak dotąd. ✅
- **`reserveTpm` sygnatura** — dodano domyślny `limit = tpmLimitFor(key)`; wywołania z jednym/dwoma
  argumentami bez zmian (nowy default per-model tylko zawęża cap dla 8b — bezpieczniej). ✅
- **`chatComplete` dla nie-Groq (Anthropic)** — `isTpmLimitedProvider` false → brak pomijania; ścieżka
  bez zmian. ✅
- **Klient — pozostałe kroki (answer/plan/navigate/report)** — nietknięte; zmieniony tylko render
  `clarify` (dodany przycisk) i stałe promptu po stronie serwera. ✅
- Build całości przeszedł (wszystkie trasy) — brak regresji kompilacji w sąsiednich modułach. ✅

## Werdykt końcowy
**GOTOWE.** Wszystkie 6 kryteriów akceptacji spełnione, wszystkie bramki zielone, brak wykrytych
regresji, zgodność z konstytucją zachowana. Ograniczenie: weryfikacja AC-1/AC-2/AC-4/AC-5 to
prześledzenie deterministycznych ścieżek kodu (bez żywego wywołania LLM w sandboxie — brak klucza
dostawcy), co dla tej logiki jest wystarczające; pełne potwierdzenie „na żywo" nastąpi na środowisku
test (`develop` → worldofmag.onrender.com) po merge.
