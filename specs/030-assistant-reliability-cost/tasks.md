# Zadania: Niezawodność i efektywność kosztowa asystenta AI

- **Plan:** ./plan.md (030-assistant-reliability-cost)
- **Status:** todo
- **Data:** 2026-07-25

> Kolejność od najłatwiejszego do najtrudniejszego, zgodna z zależnościami. `[P]` = można
> zrównoleglić. Feature bez migracji i bez UI — Faza 0 (dane) i Faza 2 (UI) nie występują.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 1 — Czyste funkcje pomocnicze (niezależne pliki)
- [x] **T-1** `[P]` — `src/lib/recurrence.ts`: helper `describeRecurringRule(rule): string`
  (krótki polski opis: „co tydzień: pn, śr", „co 2 dni", „co miesiąc 15.", z końcem `do <data>`
  gdy `endDate`). Test jednostkowy w układzie testów repo.
  Gotowe, gdy: testy opisu przechodzą dla DAILY/WEEKLY/MONTHLY/YEARLY + interval>1.
- [x] **T-2** `[P]` — nowy `src/lib/ai/agentProtocol.ts`: `extractJsonLoose(content)` (płotki,
  skan zbalansowanego `{…}` w tekście mieszanym, trailing commas, zwraca `null` zamiast throw)
  + `salvageAnswerText(content)` (preferuje pole `"answer"`, inaczej oczyszczony tekst).
  Testy `__tests__/agentProtocol.test.ts`: czysty JSON, JSON w płotkach, JSON z prozą
  przed/po, trailing comma, kompletnie popsuty tekst → salvage.
  Gotowe, gdy: testy przechodzą.
- [x] **T-3** `[P]` — `src/lib/ai/agentContext.ts`: `trimLongStrings(value, maxLen=700)`
  (rekurencyjne skracanie stringów w wynikach z markerem `…[SKRÓCONO z N znaków — pełna treść:
  get_task/get_note po id]`) + użycie w `compactToolResults` PRZED serializacją. Rozszerzyć
  `__tests__/agentContext.test.ts`: długi opis w rekordzie → wynik to poprawny JSON z markerem;
  bezpiecznik blokowy nadal działa.
  Gotowe, gdy: testy przechodzą, `compactToolResults` nigdy nie zwraca uciętego w połowie JSON-a
  dla danych mieszczących się po trimie.

## Faza 2 — Read-toole i klasyfikator (zależne od Fazy 1)
- [ ] **T-4** — `src/lib/ai/agentTools.ts` (zależy od T-1): w `list_tasks` select+wynik
  `recurring: true` (tylko gdy ustawione) i `hasDescription: true` (tylko gdy opis niepusty);
  w `get_task` pole `recurring` = `describeRecurringRule(parseRecurringRule(...))` (pomijane gdy
  null); aktualizacja linii `list_tasks`/`get_task` w `READ_TOOLS_PROMPT`; `clampLimit` def 40→25.
  Gotowe, gdy: `tsc --noEmit` czysto; opisy narzędzi w promptcie zgodne z nowymi polami.
- [ ] **T-5** `[P]` — `src/lib/ai/fastPath.ts`: eksport `READ_INTENT_RE` (bez zmiany zachowania).
  Gotowe, gdy: `tsc --noEmit` czysto, istniejące testy fastPath/readToolGating przechodzą.

## Faza 3 — Pętla agenta (`route.ts`; sekwencyjnie, jeden plik)
- [ ] **T-6** — Naprawa formatu (plan §3.1): pętla naprawy do 3 prób z komunikatem zawierającym
  przyczynę parse-błędu; po wyczerpaniu — `{ step:"answer", answer: salvageAnswerText(last),
  degraded:true }` (status 200) zamiast 502 „LLM zwrócił nieprawidłowy format" (komunikat znika
  ze ścieżki parsowania). Zależy od T-2.
  Gotowe, gdy: w kodzie nie ma ścieżki zwracającej błąd formatu do UI; grep po „nieprawidłowy
  format" pusty w route.ts.
- [ ] **T-7** — Deduplikacja wywołań narzędzi (plan §3.3): `toolCache` per tura
  (klucz `tool:JSON.stringify(args)`); powtórka → wynik z pamięci + marker `repeat` w bloku
  wyników. Dotyczy read-tooli i `web_search`.
  Gotowe, gdy: powtórzone wywołanie nie wykonuje narzędzia (inspekcja/test) i model dostaje
  jasny znacznik powtórki.
- [ ] **T-8** `[P]` — Reguła rzetelności (plan §3.2): w `buildSystemPrompt` sekcja ZASADY —
  „RZETELNOŚĆ O APLIKACJI: …" (nie zaprzeczaj kategorycznie istnieniu funkcji, których nie
  możesz zweryfikować narzędziami).
  Gotowe, gdy: reguła w promptcie, tekst PL, zwięzła (≤3 zdania).
- [ ] **T-9** — Tani model + fallback (plan §3.4): param `op` w `callAgent`/`runAgentLoop`;
  klasyfikacja prostej tury odczytowej (READ_INTENT_RE ∧ ≤160 znaków ∧ brak słów analitycznych,
  tylko świeże polecenie); przebieg na `dispatch`, przy degradacji/błędzie/limicie kroków —
  jednorazowe ponowienie na `reasoning` ze świeżą kopią `messages`; koszty obu przebiegów w
  jednym `meta`. Zależy od T-5 i T-6.
  Gotowe, gdy: prosta tura idzie op `dispatch` (widoczne w AiCall), fallback pokrywa wszystkie
  trzy warunki, wznowienia clarify/refine zawsze na `reasoning`.

## Faza 4 — Audyt, bramki i domknięcie
- [ ] **T-10** `[P]` — Audyt AC-4: przegląd wszystkich case'ów `runReadTool` vs schema pod kątem
  pomijanych pól funkcjonalnych; wynik (tabelka: narzędzie → werdykt) do `verify.md`; ewentualne
  znalezione luki załatane wzorcem „pole tylko-gdy-ustawione" (aktualizując plan §3.2 — C-54).
  Gotowe, gdy: tabelka audytu kompletna dla wszystkich narzędzi.
- [ ] **T-11** — Bramki (C-50): testy jednostkowe repo zielone, `npm run check:actions`,
  `npm run check:migrations`, `npx next lint`, `npx tsc --noEmit`, `npx next build`
  (bez `migrate.js` — C-13; brak migracji).
  Gotowe, gdy: wszystko zielone lokalnie.
- [ ] **T-12** — Mapowanie AC-1…AC-11 na wyniki (tabela do `verify.md`), w tym: analiza AC-8
  (scenariusz zgłoszenia #5 po zmianach), szacunek AC-10 (tokeny przed/po) i szkic odpowiedzi
  AC-11 dla administratora (ograniczenia → wykonalność dla Haiku).
  Gotowe, gdy: każdy AC ma przypisany wynik/uzasadnienie.
- [ ] **T-13** — Wpis do `doświadczenia.md` (C-51) o naprawionych bugach (błąd formatu, pętla
  powtórek przez ucinany JSON) + commit razem z fixem.
  Gotowe, gdy: wpis w formacie repo (Problem/Rozwiązanie/Lekcja) dodany.

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadania |
|----|---------|
| AC-1 (naprawa formatu) | T-2, T-6 |
| AC-2 (degradacja do answer) | T-2, T-6 |
| AC-3 (cykliczność w read-toolach) | T-1, T-4 |
| AC-4 (audyt pól read-tooli) | T-10 |
| AC-5 (reguła rzetelności) | T-8 |
| AC-6 (dedup wywołań) | T-7 |
| AC-7 (oznaczone przycinanie) | T-3 |
| AC-8 (limit kroków — scenariusz #5) | T-3, T-4, T-7, T-12 |
| AC-9 (dispatch + fallback) | T-5, T-9 |
| AC-10 (koszt tur w dół) | T-3, T-4, T-9, T-12 |
| AC-11 (odpowiedź dla admina) | T-12 |

## Notatki / blokady
- Brak migracji i UI — fazy danych/UI świadomie pominięte (plan §2, §5).
- Ścieżka krytyczna: T-2 → T-6 → T-9 (route.ts sekwencyjnie); T-1 → T-4; reszta `[P]`.
