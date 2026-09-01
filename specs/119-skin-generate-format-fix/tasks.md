# Zadania: Odporność generatora skórek AI na kształt odpowiedzi modelu

- **Plan:** ./plan.md (119-skin-generate-format-fix)
- **Status:** done
- **Data:** 2026-08-30

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane

## Faza 0 — Rdzeń naprawy (jeden plik)
- [x] **T-1** — `skinGenerate.ts`: czysty, eksportowany helper
  `odczytajOdpowiedzJson(content, truncated)` na `parseJsonLoose` (wynik musi być
  obiektem) z przyczynami `"ucieta" | "brak-json"`; funkcje komunikatów
  `korektaFormatu(przyczyna)` i `opisPorazkiFormatu(przyczyna)` (PL, wzorzec
  `korekta`/`opisPorazki` z 080). Gotowe, gdy: kompiluje się, pokryte w T-3.
- [x] **T-2** — Oba tryby (`skinGenerateHandler` + `skinGenerateAdvanced`): zamiana
  twardego `JSON.parse` na helper; `ok: false` = nieudane podejście (komunikat
  korygujący + `continue` w ramach `SKIN_MAX_ATTEMPTS`), po wyczerpaniu —
  `JobError(opisPorazkiFormatu(...), 502)`; odmowa `parsed.error` bez zmian.
  Tryb prosty: mapa tokenów przez `wyodrebnijTokeny(parsed)` (import już jest) zamiast
  `parsed.tokens ?? {}`, z raportem odrzuconych na jego wyniku. Gotowe, gdy:
  dosłowny komunikat „Model zwrócił nieprawidłowy format" znika z pliku.

## Faza 1 — Testy
- [x] **T-3** — `__tests__/skinGenerate.test.ts`: nowe przypadki — płotki z językiem,
  płotek zamykający z `\n` po nim, tekst przed/po JSON-ie, luźny odczyt, odpowiedź
  ucięta w połowie obiektu (z `truncated: true` → przyczyna `"ucieta"`), nie-obiekt
  (tablica/tekst) → `"brak-json"`, treść komunikatów porażki (rozróżnienie przyczyn),
  kontener tokenów (`variables`/`theme`) w trybie prostym po refaktorze. Istniejące
  testy przechodzą BEZ zmian oczekiwań. Gotowe, gdy: `node --test` zielone.
  Pokrywa AC-1, AC-2, AC-3, AC-4, AC-6.

## Faza 2 — Bramki i domknięcie
- [x] **T-4** — Bramki: `tsc -p tsconfig.test.json`, pełny `npm run test:unit`,
  `next lint --dir src`, `next build` (lokalny Postgres — C-13); `check:migrations`
  potwierdza brak zmian. Gotowe, gdy: wszystko zielone. Pokrywa AC-5.
- [x] **T-5** — Wpis do `doświadczenia.md` (C-51): strict parse obok gotowego
  `parseJsonLoose` + zignorowana flaga `truncated`; mapowanie AC → wynik dla `/verify`.

## Mapowanie AC → zadania
AC-1: T-1, T-3 · AC-2: T-1, T-2, T-3 · AC-3: T-2, T-3 · AC-4: T-1, T-3 ·
AC-5: T-3, T-4 · AC-6: T-3

## Notatki / blokady
- Ścieżka krytyczna: T-1 → T-2 → T-3 → T-4. Zero migracji, zero zmian UI.
