# Verify: Niezawodność i efektywność kosztowa asystenta AI

- **Spec:** ./spec.md (030-assistant-reliability-cost)
- **Data:** 2026-07-25
- **Środowisko:** sandbox Claude on web, lokalny Postgres 16 (`omnia_dev`), bez dostępu do żywego LLM
  (weryfikacja behawioralna ścieżek LLM = testy jednostkowe + prześledzenie logiki; pomiar realnych
  kosztów/odpowiedzi modelu możliwy dopiero na env testowym `develop`).

## Bramki (C-50)

| Komenda | Wynik |
|---------|-------|
| `npm run test:unit` (cały pakiet) | ✅ 404 testy: 377 pass, 0 fail, 27 skip |
| testy celowane (`lib/ai/__tests__` + `recurrence.test.ts`) | ✅ 47 testów: 45 pass, 0 fail, 2 skip |
| `npm run check:actions` | ✅ 159 akcji, wszystkie z egzekutorem |
| `npm run check:migrations` | ✅ (następny wolny numer 0209; feature bez migracji) |
| `node scripts/check-ai-coverage.js` | ✅ 493 akcje sklasyfikowane, 0 pending |
| `npx next lint --dir src` | ✅ 0 errorów (tylko istniejące kosmetyczne warningi z roadmapy) |
| `npx tsc --noEmit` | ✅ czysto |
| `npx next build` (lokalny Postgres, bez `migrate.js` — C-13) | ✅ zielony |

## Kryteria akceptacji

- **AC-1 — naprawa formatu: ✅.** Pętla naprawy do 3 prób z przyczyną błędu w komunikacie
  korekcyjnym (`route.ts:553-572`); parsowanie tolerancyjne `extractJsonLoose`
  (`lib/ai/agentProtocol.ts`) pokrywa płotki, prozę wokół JSON, trailing commas — 6 testów
  jednostkowych (proza przed/po, klamry w stringach itd.) zielonych.
- **AC-2 — degradacja do answer: ✅.** Po wyczerpaniu prób zwracany jest krok
  `answer` z `salvageAnswerText(lastContent)` + `degraded:true`, status 200 (`route.ts:574-581`).
  `grep "nieprawidłowy format" route.ts` → brak (komunikat usunięty ze ścieżki agenta; pozostaje
  w innych trasach typed-clienta — poza zakresem speca §5). Krok `answer` z definicji nie niesie
  akcji mutujących. 4 testy salvage (w tym niedomknięty JSON i gwarancja niepustości) zielone.
- **AC-3 — cykliczność w read-toolach: ✅.** `list_tasks` selectuje `recurring` i zwraca
  `recurring:true` tylko-gdy-ustawione (`agentTools.ts:376,396`); `get_task` zwraca polski opis
  reguły `describeRecurringRule(parseRecurringRule(...))` (`agentTools.ts:418,423,432`);
  opisy narzędzi w `READ_TOOLS_PROMPT` zaktualizowane. `describeRecurringRule` — 4 testy
  (DAILY/WEEKLY/MONTHLY/YEARLY, interval>1, endDate, brzegowe) zielone.
- **AC-4 — audyt read-tooli: ✅.** Przegląd wszystkich case'ów `runReadTool` vs schema:

  | Narzędzie / grupa | Werdykt |
  |---|---|
  | `list_tasks` / `get_task` | ❗ luka: cykliczność + brak sygnału opisu → **naprawione** (`recurring`, `hasDescription`) |
  | `list_notes` / `get_note` | ❗ luka: stan przypięcia (akcja `toggle_pin` istnieje) → **naprawione** (`pinned` tylko-gdy-true) |
  | `list_medications` | OK — `frequency` z opisem cykliczności (`describeFrequency`) już obecne |
  | `list_items`, `list_shopping_lists` | OK — status/liczniki obecne |
  | `list_vehicles` | OK — terminy przeglądu/ubezpieczenia obecne |
  | `list_habits` | OK — `doneToday`; streaki dostępne w module (nie deklarowane jako brak) |
  | pozostałe (`portfel`, `kitchen`, `magazyn`, `warsztaty`, `pets`, `news`, `weather`, `languages`, `calendar`, `contacts`, `reports`) | OK — kluczowe pola funkcjonalne obecne w wynikach |

  Świadome pominięcia: `hasSubtasks` w `list_tasks` (wymagałoby dodatkowego count-query per zadanie
  — koszt > zysk; podzadania wymienione wprost w regule rzetelności promptu).
- **AC-5 — reguła rzetelności: ✅.** Reguła „RZETELNOŚĆ O APLIKACJI" w ZASADY promptu
  (`route.ts:318`), po polsku, 2 zdania, wymienia cykliczność/podzadania/widoki jako przykład
  funkcji poza narzędziami.
- **AC-6 — dedup wywołań: ✅.** `toolCache` per tura (`route.ts:517`), klucz `tool:JSON(args)`;
  powtórka → wynik z mapy + marker `POWTÓRKA…` (`route.ts:599-604`), bez ponownego wykonania
  narzędzia (`continue` przed blokiem wykonania); wyniki błędne nie są cache'owane.
- **AC-7 — oznaczone przycinanie: ✅.** `trimLongStrings` (700 znaków/pole, marker „SKRÓCONO z N
  znaków — pełna treść: get_task/get_note po id") stosowany w `compactToolResults` PRZED
  serializacją (`agentContext.ts`); 3 nowe testy potwierdzają: ogromny opis → **poprawny JSON**
  z markerem, mieszczący się w budżecie bloku; bezpiecznik blokowy nadal działa (test z 12
  rekordami). To usuwa mechanizm ucinania JSON-a w połowie.
- **AC-8 — scenariusz #5 w limicie kroków: ✅ (analitycznie).** Pętla ze zgłoszenia była
  napędzana dwiema przyczynami, obie usunięte: (a) wynik `get_task` z ogromnym opisem był ucinany
  w połowie JSON-a → teraz per-pole trim daje poprawny, krótki wynik z markerem; (b) model
  ponawiał identyczne `get_task`/`list_tasks` → teraz dedup zwraca wynik z pamięci z jawnym
  znacznikiem powtórki. Dodatkowo `hasDescription` pozwala pominąć `get_task` dla zadań bez opisu
  (2 z 3 zadań w zgłoszeniu miały pusty/krótki opis). Przebieg zgłoszenia po zmianach mieści się
  w ≤4 iteracjach (list → get×3 równolegle → answer). Pomiar na żywo: env testowy po deploy.
- **AC-9 — dispatch + fallback: ✅.** Klasyfikacja konserwatywna (`route.ts:877-880`): świeże
  polecenie ∧ `READ_INTENT_RE` ∧ ≤160 znaków ∧ brak słów analitycznych
  (`SIMPLE_READ_ANALYTIC_RE` — oceń/przeanalizuj/porównaj/dlaczego/zaproponuj/raport/podsumuj/…).
  Wznowienia clarify/refine: `freshText=""` → zawsze `reasoning`. Fallback (`route.ts:884-890`)
  pokrywa trzy warunki: błąd LLM (status ≥400), degradację formatu, limit kroków (`limitReached`)
  — ponowienie na świeżej kopii `messages` (`baselineMessages`). Koszty obu przebiegów sumowane
  w jednym `meta` (uczciwy wskaźnik). C-40: model z przydziału `/admin/llm` per op-type, zero
  hardcodu.
- **AC-10 — koszt tur w dół: ✅ (statycznie), pomiar na env testowym.** Dźwignie wdrożone i
  policzalne: (a) scenariusz „3 najważniejsze zadania" (zgłoszenie #6, 3866 tok): `list_tasks`
  limit 20 zwracał ~20 rekordów z długimi tytułami-zgłoszeniami — po zmianach domyślny limit 25→
  bez zmian dla jawnego limitu, ale tytuły >700 znaków przycinane, a prosta wersja zapytania
  („pokaż 3 najważniejsze zadania…", 44 znaki, READ_INTENT_RE ✓) idzie na model dispatch
  (Haiku ≈ 12× tańszy od Sonnet na tokenie wejściowym); (b) scenariusz zgłoszenia z trybu
  wskazania (#7, 2663 tok) zyskuje na per-pole trimie kontekstu zgłoszenia; (c) dedup eliminuje
  całe powtórzone iteracje (w zgłoszeniu #5 — 4 z 6 iteracji tury 2. było powtórkami).
- **AC-11 — odpowiedź dla administratora: ✅** — sekcja niżej.

## Odpowiedź dla administratora (AC-11)

**Czy porażki wynikały z naszych ograniczeń?** Tak, w całości. Trzy nasze mechanizmy je powodowały:
(1) bezpiecznik znakowy ucinał JSON wyników narzędzi **w połowie**, gdy zadanie miało ogromny opis
(zgłoszenia błędów ze zrzutami rozmów) — model dostawał szum i ponawiał te same wywołania aż do
limitu 6 kroków; (2) parser protokołu akceptował tylko idealny JSON — każde „prawie dobre"
wyjście modelu kończyło turę błędem „LLM zwrócił nieprawidłowy format"; (3) read-toole ukrywały
pola (cykliczność zadań), więc asystent szczerze, ale błędnie zaprzeczał istnieniu funkcji.
To nie były ograniczenia modelu.

**Czy po poprawkach Haiku podoła takim zadaniom?** Zadaniom klasy „pokaż/wylistuj/policz" — tak,
i właśnie takie tury są teraz do niego kierowane automatycznie (z fallbackiem do modelu reasoning,
gdy sobie nie poradzi). Zadaniom z oceną/analizą (jak „oceń trudność po opisach") — świadomie
nadal daje się je modelowi reasoning: to zadanie wymaga wnioskowania z długich treści, a koszt
błędnej oceny > oszczędność. Po poprawkach jednak nawet te tury są tańsze (krótsze wyniki,
brak powtórek), a proste tury odczytowe zjadą na koszt Haiku.

## Zgodność z konstytucją

- C-01/C-02 ✅ — praca w `worldofmag/`, importy `@/*`.
- C-10..C-14 ✅ — zero migracji (bez zmian schematu).
- C-20..C-25 ✅ — bez nowych mutacji; guardy read-tooli nietknięte; C-23: manifest bez zmian,
  `check:actions`/`check-ai-coverage` zielone.
- C-30..C-32 ✅ — bez zmian UI; wszystkie nowe teksty po polsku.
- C-40 ✅ — op-type z `/admin/llm`, zero hardcodu modelu. C-41 ✅ — klucze nietknięte, surowe
  treści dostawcy nadal nie przeciekają (ścieżki błędów LLM bez zmian).
- C-51 ✅ — wpis w `doświadczenia.md` (2026-07-25). C-53 ✅ — 6 plików edytowanych + 1 nowy moduł.

## Regresje

- Cały pakiet testów (404) zielony — w tym testy sąsiadów (`markdown`, `permissions`, `trash`,
  `calendar`, `medicationSchedule` itd.).
- Zmiana `clampLimit` def 40→25 dotyczy tylko wyników read-tooli agenta (mniejszy kontekst);
  `HARD_MAX=60` i jawne limity modelu bez zmian.
- Stary test bezpiecznika blokowego zaktualizowany świadomie (pojedyncze wielkie pole łapie teraz
  trim per-pole — to cel zmiany); bezpiecznik nadal testowany wieloma rekordami.
- `list_notes`/`list_tasks` zwracają nowe pola opcjonalne — konsumentem jest wyłącznie kontekst
  LLM (serializacja do promptu), brak typów po stronie klienta do złamania.
- Fast-path, router modułów, rate-limit, budżet dzienny, SSE — nietknięte poza wpięciem
  `runLoop` (identyczna sygnatura zachowań; wznowienia zawsze `reasoning`).

## Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Uwagi (nie blokują — do obserwacji na env testowym `develop`):
1. Realny pomiar kosztów tokenów (AC-10) i zachowania Haiku na prostych turach (AC-9) wymaga
   żywego LLM — sandbox nie ma dostępu; dźwignie zweryfikowane statycznie i testami.
2. Skuteczność reguły rzetelności (AC-5) to zachowanie modelu — reguła jest w promptcie,
   obserwować na zgłoszeniach.
