# Plan techniczny: Odporność generatora skórek AI na kształt odpowiedzi modelu

- **Spec:** ./spec.md (119-skin-generate-format-fix)
- **Status:** draft
- **Data:** 2026-08-30

## 1. Podejście

Bugfix w jednym pliku handlera + testy. Zdiagnozowana przyczyna: oba tryby
`skinGenerateHandler` czytają odpowiedź twardym `JSON.parse` po naiwnym zdjęciu płotków
(`.replace(/^```(?:json)?\s*/i,"").replace(/```$/,"")` — pada przy tekście wokół JSON-a
i nawet przy znaku nowej linii po płotku zamykającym) i rzucają `JobError("Model zwrócił
nieprawidłowy format", 502)` **bez ponowienia**, mimo że: (a) w repo istnieje
`parseJsonLoose` (`@/platform/llm/json`) — jest nawet już importowany w tym pliku,
a nieużywany na tej ścieżce; (b) `chatComplete` od 032 zwraca flagę `truncated`
(wyczerpany budżet wyjścia), którą handler ignoruje. Wzorzec naprawy = istniejący wzorzec
080/081 z tego samego pliku: nieudane odczytanie traktujemy jak nieudane podejście
(komunikat korygujący + ponowienie w ramach `SKIN_MAX_ATTEMPTS`), a ostateczna porażka
dostaje komunikat diagnostyczny w stylu `opisPorazki`.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Zero migracji.

## 3. Warstwa serwera (C-20)

Bez nowych Server Actions. Zmiany wyłącznie w handlerze
`src/platform/jobs/handlers/skinGenerate.ts`:

- **Nowy czysty helper (eksportowany do testów)** `odczytajOdpowiedzJson(content, truncated)`
  → `{ ok: true; parsed: Record<string, unknown> } | { ok: false; przyczyna: "ucieta" | "brak-json" }`:
  1) `parseJsonLoose(content)` (płotki z językiem i bez, tekst przed/po, wyciągnięcie
     pierwszego `{…}` — AC-1/AC-2); wynik nie-obiekt (tablica/null) = porażka;
  2) porażka + `truncated === true` → przyczyna `"ucieta"`; inaczej `"brak-json"`.
- **Oba tryby** (pętle w `skinGenerateHandler` i `skinGenerateAdvanced`): zamiast
  `try { JSON.parse } catch { throw JobError(502) }` → wywołanie helpera; przy `ok: false`:
  - jeśli zostało podejście: dopchnij do historii komunikat korygujący
    `korektaFormatu(przyczyna)` (nowa funkcja obok `korekta`): dla `"ucieta"` — „odpowiedź
    została ucięta, zwróć zwięźlej: sam JSON, bez komentarzy, krótsze `rationale`";
    dla `"brak-json"` — „zwróć WYŁĄCZNIE obiekt JSON bez tekstu wokół"; i `continue`;
  - jeśli podejść brak: `throw JobError(opisPorazkiFormatu(przyczyna), 502)` — nowa
    funkcja komunikatu (PL) rozróżniająca ucięcie (spróbuj ponownie / prostszy opis)
    od braku JSON-a (problem z modelem → panel LLM, operacja „generation") — AC-3/AC-4.
  - `parsed.error` (odmowa „not-a-theme") — bez zmian: odpowiedź, nie awaria.
- **Tryb prosty — kontenery tokenów (AC-2):** po udanym parsowaniu tryb prosty ma czytać
  mapę tokenów przez `wyodrebnijTokeny(parsed)` (081) — w kodzie po 116 czyta
  `parsed.tokens ?? {}` wprost, co gubi znane pojemniki (`variables`/`theme`/…);
  przywrócić/wpiąć `wyodrebnijTokeny` (import już jest) i zachować raportowanie
  odrzuconych kluczy na jego wyniku.
- Flaga `truncated` z `ChatResult` jest już w typie — wystarczy ją przekazać do helpera.
- Limit podejść `SKIN_MAX_ATTEMPTS` — **bez zmian** (decyzja ze speca §8).

## 4. RBAC / rejestr modułu

Bez zmian (istniejący `module.settings`; trasa i limiter `ai.skorki` bez zmian).

## 5. UI (C-30..C-32)

Bez zmian w komponentach — panel już wyświetla `error` z trasy; poprawiają się tylko
TREŚCI komunikatów (żyją w handlerze serwerowym, nie w `messages/pl.json` — zgodnie
z zastanym wzorcem `opisPorazki`/`JobError` w tym pliku).

## 6. AI / integracje (C-23, C-40)

Bez nowej `AIAction`. Bez zmian promptów poza komunikatami korygującymi drugiego
podejścia (kształt odpowiedzi, nie treść zadania). Manifesty cost-badge/content-memory:
bez zmian (plik już sklasyfikowany; liczba wywołań LLM bez zmian).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/platform/jobs/handlers/skinGenerate.ts` | edycja | helper `odczytajOdpowiedzJson`, `korektaFormatu`, `opisPorazkiFormatu`; oba tryby na tolerancyjnym odczycie z ponowieniem; `wyodrebnijTokeny` w trybie prostym |
| `src/platform/jobs/handlers/__tests__/skinGenerate.test.ts` | edycja | testy AC-1/2/3/4/6: płotki (z językiem, z \n po zamknięciu), tekst wokół JSON-a, luźny odczyt, ucięcie (+flaga truncated), komunikaty porażki, kontener tokenów w trybie prostym |
| `doświadczenia.md` | edycja | lekcja C-51 (przyczyna: strict parse obok gotowego parseJsonLoose + zignorowana flaga truncated) |

## 8. Bramki i weryfikacja (C-50)

- Lokalnie: `tsc -p tsconfig.test.json`, `node --test` na plikach skórek/generatora,
  `next lint --dir src`, `next build` na lokalnym Postgresie (C-13) — bez migracji,
  więc `check:migrations` tylko potwierdza brak zmian.
- Mapowanie AC: AC-1/2 → testy helpera (kształty) + test kontenera w trybie prostym;
  AC-3 → test „ucięta odpowiedź → ponowienie; po wyczerpaniu komunikat z przyczyną";
  AC-4 → testy `opisPorazki`/`opisPorazkiFormatu` (istniejące + nowe); AC-5 → istniejące
  testy generatora i skórek bez modyfikacji oczekiwań; AC-6 → nowe przypadki testowe
  odtwarzają dokładnie dzisiejsze ścieżki „Model zwrócił nieprawidłowy format".

## 9. Ryzyka techniczne i plan wycofania

- **`parseJsonLoose` wyciągnie niepełny obiekt z uciętej odpowiedzi** (pierwszy `{`…
  ostatni `}` może się skleić w poprawny, ale okrojony JSON) → to nie regresja: okrojona
  treść przechodzi pełną walidację 116, a brak warstw kończy się dzisiejszą ścieżką
  `opisPorazki` z ponowieniem; ucięcie raportujemy z flagi `truncated`, nie z parsowania.
- **Zmiana zachowania trybu prostego (wyodrebnijTokeny)** → funkcja i jej testy istnieją
  od 081; wpięcie przywraca udokumentowane zachowanie, istniejące testy mapowania kryją.
- Rollback: revert jednego commita (bez migracji).

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — bez zmian schematu (wprost)
- [x] C-20..C-25 — bez nowych akcji/RBAC/AI; zachowane guardy tras
- [x] C-30..C-32 — bez zmian UI; komunikaty PL wg zastanego wzorca w handlerze
- [x] C-40 — bez hardcodowania modelu; budżety bez zmian
- [x] C-51 — wpis do doświadczeń razem z fixem
- [x] C-53 — minimalizm: jeden plik kodu + testy, reużycie parseJsonLoose/truncated/wzorca 080
