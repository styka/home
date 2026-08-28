# Zadania: Asystent — kompletny odczyt, domknięcie tury i uczciwy koszt

- **Plan:** ./plan.md (112-asystent-odczyt-i-koszt)
- **Status:** todo
- **Data:** 2026-08-28

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami**. Każde zadanie jest małe, samodzielne i **weryfikowalne**. Odhaczamy `[ ]` → `[x]`
> w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

> **Uwaga o kształcie faz.** Szablon zakłada `migracja → akcje → UI → AI`. Ten feature nie rusza
> schematu, nie dodaje Server Actions ani widoków, a jedyna migracja to **seed danych**, który nic
> nie blokuje — dlatego trafia na koniec, a fazy porządkuje **kolejność wymuszona przez plan §1:
> najpierw oszczędność, potem podniesienie budżetu.** Odwrotna kolejność podniosłaby koszt tury,
> którą zgłoszenie krytykuje właśnie za koszt.

---

## Faza 0 — Tanie decyzje i pamięć podręczna (musi być PRZED Fazą 1)

- [x] **T-1** `[P]` — **Wysiłek nie przesłania budżetu wyjścia w klasyfikacji.**
  `routeModules` (`src/app/api/llm/home/agent/route.ts`) i `classifyIntent` (`src/lib/ai/fastPath.ts`)
  przekazują `effort: "none"` do `chatComplete`.
  *Gotowe, gdy:* oba wywołania mają jawny `effort`, a komentarz przy każdym mówi **dlaczego**
  (`applyEffort` podnosi `max_tokens` ze 120 do 7168, bo Anthropic tego wymaga przy rozszerzonym
  myśleniu). `npm run test:unit` zielony. → **AC-14**

- [x] **T-2** `[P]` — **Klasyfikacja, która nie może pomóc, nie kosztuje.**
  W `classifyIntent` dokładamy próg długości **przed** wywołaniem modelu, obok istniejącego odsiewu
  `READ_INTENT_RE`. Próg = `160` znaków, ta sama liczba co `isSimpleRead` w trasie (żadnej drugiej,
  niezgodnej stałej).
  *Gotowe, gdy:* test — długa wiadomość zwraca `{ kind: "complex" }` **bez** wywołania
  `chatComplete` (podmieniona zależność albo licznik wywołań). → **AC-15**

- [x] **T-2a** — **Granica słowa świadoma polskich liter** *(zadanie odkryte w implementacji, C-54 —
  patrz plan §6.2).* `\b` jest ASCII-owe, więc `READ_INTENT_RE.test("pokaż zadania")` zwracało
  `false`; martwe były wszystkie człony kończące się polską literą i zaczynające się od niej. Wspólny
  konstruktor `granicePolskie(rdzen)` w `src/lib/ai/fastPath.ts`, użyty w `READ_INTENT_RE`,
  `SIMPLE_READ_ANALYTIC_RE` i 16 wpisach `KEYWORD_ROUTES`.
  *Gotowe, gdy:* test pokazuje, że `pokaż`/`znajdź`/`sprawdź` są łapane, a dopasowanie **wewnątrz
  słowa** („podajnik", „opiszwierzak") nadal nie zachodzi. → **AC-14**, **AC-15** (ta sama usterka:
  płacimy za rozstrzygnięcie znane z góry)

- [x] **T-3** — **Drugi punkt cięcia pamięci podręcznej + koniec niemego fallbacku.**
  `toAnthropicSystem` (`src/platform/llm/chat.ts`) przyjmuje informację, czy oznaczyć **także blok
  zmienny**; gdy podział zostaje odrzucony (bo `stable + variable !== system`), zdarzenie idzie do
  `logEvent` jako `ai.prompt.podzialOdrzucony` zamiast po cichu oznaczać cały prompt.
  *Gotowe, gdy:* nowy plik `src/platform/llm/__tests__/systemBlocks.test.ts` sprawdza cztery
  przypadki — bez flagi (oznaczony tylko blok stały), z flagą (oba), podział niepasujący
  (jeden blok + wpis do logu), pusty prefiks (bez podziału). `npm run check:logs` zielony
  (żadnego `console.*`). → **AC-12** (część), **AC-13** (część)

- [x] **T-4** — **Polityka oznaczania per wywołanie w pętli agenta.**
  W `runAgentLoopRaw` sterujemy flagą z T-3 wg tabeli z planu §6.1: pierwsze wywołanie — nie,
  drugie i dalsze — tak, **wywołanie domykające przebieg — nie** (nic po nim nie nastąpi).
  *Gotowe, gdy:* test na czystej funkcji decydującej (numer wywołania + „czy ostatnie" → flaga)
  odtwarza całą tabelę; prompt systemowy nadal budowany **raz przed pętlą** i przekazywany bez
  modyfikacji. → **AC-12**, **AC-13**
  *Zależy od:* T-3.

---

## Faza 1 — Kompletny odczyt zamiast spirali zawężania

- [x] **T-5** — **Budżet wyników, komunikat i bezpiecznik, który nie psuje JSON-a.**
  W `src/platform/ai/agentContext.ts`: `PER_TOOL_MAX_RECORDS` 12 → **40**,
  `TOOL_RESULT_MAX_CHARS` 3500 → **12 000**; komunikat obcięcia wskazuje **konkretny następny krok**
  (`offset: <liczba pokazanych>`) zamiast ogólnikowego „zawęź zapytanie"; bezpiecznik znakowy
  **usuwa całe rekordy od końca**, aż blok się zmieści, zamiast ciąć string.
  *Gotowe, gdy:* testy w `src/platform/ai/__tests__/agentContext.test.ts` — (a) 60 rekordów → w
  znaczniku jest słowo „offset" i liczby 40/60; (b) zbiór mieszczący się w budżecie → **brak** pola
  `truncated`; (c) blok ponad budżet znaków → `JSON.parse` wyniku **nie rzuca** i rekordów jest
  mniej. → **AC-1**, **AC-3**, **AC-4**
  *Zależy od:* Faza 0 (oszczędność finansuje ten wzrost).

- [x] **T-6** — **Stronicowanie w narzędziu.**
  Wspólny `offsetOf(args)` w `src/lib/ai/readToolShared.ts` (obok `clampLimit`), wpięty w
  `list_tasks` jako `skip`; zdanie o `offset` w `readToolsPrompt` modułu Zadania.
  *Gotowe, gdy:* test — dwie porcje po 40 z projektu 60-zadaniowego są **rozłączne** i pokrywają
  całość (kolejność już deterministyczna: `dueDate`, `priority`, `order`). → **AC-2**
  *Zależy od:* T-5 (wspólny komunikat musi już mówić o `offset`).

- [x] **T-7** `[P]` — **Treść opisów bez 20 osobnych odczytów.**
  `list_tasks` przyjmuje `includeDescription: true` i dokłada `description` (skracane per-pole przez
  istniejący `trimLongStrings`); opis narzędzia w `readToolsPrompt` mówi, kiedy tego użyć.
  *Gotowe, gdy:* bez flagi wynik jest **bajt w bajt** taki jak dziś (zero kosztu dla zwykłych
  odczytów), z flagą zawiera treść opisów. → **AC-5**
  *Zależy od:* T-6 (ten sam plik).

---

## Faza 2 — Domknięcie tury wynikiem

- [x] **T-8** — **„Dokończ z tego, co masz" zamiast „streść, czego nie zrobiłeś".**
  `summarizePartialRun` w trasie agenta prosi o **dokończenie zadania**: `plan` (akcje do
  potwierdzenia) albo `answer`, **plus jawna lista braków**. Obsługa wyniku przyjmuje także
  `step: "plan"` i zwraca go istniejącą ścieżką (`normalizeActions` → panel potwierdzenia; akcje
  niszczące **domyślnie odznaczone**, bez zmian w `DESTRUCTIVE_ACTION_TYPES`).
  **Warunek nienaruszalny:** gdy `countSuccessfulReads(log) === 0`, model **nie jest wołany** —
  oddajemy dzisiejszy `partialRunFallbackMessage`. Ta funkcja zostaje też ścieżką awaryjną przy
  błędzie dodatkowego wywołania.
  *Gotowe, gdy:* test w `src/platform/ai/__tests__/agentPartialRun.test.ts` — log bez udanych
  odczytów daje dzisiejszy komunikat i **zero** wywołań modelu; nic z dorobku 032 nie skasowane.
  → **AC-6**, **AC-7**, **AC-8**

---

## Faza 3 — Zwierzę z profilem i raport braków (C-23)

- [x] **T-9** `[P]` — **Katalog akcji Zwierząt opisuje pełny profil + wymaga raportu braków.**
  W `src/modules/pets/ai/petActions.ts`: `add_pet` i `update_pet` dostają `birthDate`, `birthApprox`,
  `acquiredAt`, `acquiredFrom`, `microchipId`, `identifier`, `color`, `notes`; dochodzi reguła —
  przy przenoszeniu danych z innego modułu odpowiedź ma zawierać **wyodrębnioną listę informacji,
  których moduł nie potrafi przechować**, z powodem.
  *Gotowe, gdy:* opis parametrów zgadza się z polami `Pet` w `schema.prisma` (żadnego pola bez
  pokrycia w bazie). → **AC-10**

- [x] **T-10** — **Egzekutor zapisuje nowe pola.**
  W `src/modules/pets/ai/executor.ts`: `add_pet` i `update_pet` zapisują pola z T-9. Daty parsowane
  z ISO; **niepoprawna data → pole pominięte**, nigdy `Invalid Date` do bazy. Własność bez zmian
  (`wlasnoscOsobistaDoZapisu`).
  *Gotowe, gdy:* `npm run check:ai-coverage` i `npm run check:actions` zielone. → **AC-9**
  *Zależy od:* T-9.

- [x] **T-11** — **Kontrakt akcji: kontrolki i etykiety PL.**
  W `src/platform/ai/actionContract.ts` nowe pola `add_pet`/`update_pet` dostają kontrolki
  (`day("Data urodzenia")`, `longText("Notatki")` …) — ten rejestr rysuje panel potwierdzenia **i**
  waliduje po stronie serwera, więc pole bez wpisu byłoby obietnicą bez pokrycia.
  *Gotowe, gdy:* `npm run check:actions` zielony; panel potwierdzenia pokazuje polskie etykiety.
  → **AC-9** (część), **C-23**
  *Zależy od:* T-10.

---

## Faza 4 — Dokumentacja rachunku, bramki, domknięcie

- [ ] **T-12** `[P]` — **Raport z rozbiciem rachunku (migracja danych).**
  `prisma/migrations/0271_raport_koszt_tury_asystenta/migration.sql` — idempotentny `INSERT INTO
  "Report"` (dollar-quoting, `gen_random_uuid()::text`, `ON CONFLICT ("slug") DO NOTHING`), slug
  **`asystent-koszt-tury-rozbicie`**. Treść: sposób liczenia (wejście / wyjście / zapis 1,25× /
  odczyt 0,1×), **przeliczenie obu zgłoszonych sesji**, wniosek „**wycena poprawna — nieoptymalne
  było zużycie**", oraz ustalenie, że ścieżka kosztująca 30 groszy nie istnieje od 099.
  *Gotowe, gdy:* `npm run check:migrations` zielony; `grep -E "^(DROP|ALTER)"` na nowej migracji nic
  nie zwraca (C-15); slug nie koliduje z żadnym istniejącym raportem. → **AC-17**

- [ ] **T-13** — **Przegląd diffu pod kątem AC-18.**
  Potwierdź, że **nie ruszono** `AiCostBadge`, `visibleUsage` ani `costVisibility` — poprawiamy
  zużycie, nie prezentację kwot.
  *Gotowe, gdy:* `git diff` na tych plikach jest pusty, i to jest zapisane w `verify.md`. → **AC-18**

- [ ] **T-14** — **Bramki (C-50, lokalny Postgres — nigdy prod, C-13).**
  Kolejno: `check:migrations` · `check:actions` · `check:ai-coverage` · `check:cost-badge` ·
  `check:i18n` · `check:logs` · `test:unit` · `tsc --noEmit -p tsconfig.test.json` ·
  `next lint --dir src` · `next build`. **Zatrzymujemy się przed `scripts/migrate.js`.**
  *Gotowe, gdy:* wszystkie zielone.
  *Zależy od:* T-1…T-13.

- [ ] **T-15** — **Pomiar netto: czy naprawdę taniej (to jest bramka, nie formalność).**
  Odtworzenie scenariusza „pies Raj" (odczyt projektu zadań + założenie zwierzęcia), porównanie sumy
  z logu `AiCall` z zmierzonymi **1,36 zł** oraz sprawdzenie, że przebieg kończy się **planem**, a nie
  komunikatem o niedokończeniu. Wymagane: **≥ 50 % taniej**.
  *Gotowe, gdy:* liczby wpisane do `verify.md`. **Jeśli pomiar wypadnie gorzej** — obniż
  `PER_TOOL_MAX_RECORDS` do wartości wynikającej z pomiaru i **zaktualizuj `spec.md`/`plan.md`**
  (C-54), zamiast zostawić rozjazd „kod robi X, spec mówi Y". → **AC-16**
  *Zależy od:* T-14.

- [ ] **T-16** — **Ślad w dokumentacji projektu.**
  `CLAUDE.md` — akapit o 112 w sekcji asystenta (co się zmieniło w budżecie odczytu, pamięci
  podręcznej i domykaniu tury). `doświadczenia.md` — lekcja wg C-51: **dwa zgłoszenia o różnych
  objawach (cena / niedokończone zadanie) miały jedną przyczynę**, a trzy założenia z opisów
  zgłoszeń rekonesans obalił (znacznik ucięcia ze zrzutu rozmowy, istniejący strażnik pętli,
  nieistniejąca już ścieżka trybu wskazywania).
  *Gotowe, gdy:* oba pliki zaktualizowane i zacommitowane **razem z fixem** (C-51 — bez pytania
  o zgodę).

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) | AC | Zadanie(a) |
|---|---|---|---|
| AC-1 | T-5 | AC-10 | T-9 |
| AC-2 | T-6 | AC-11 | T-15 (warunek scenariusza) |
| AC-3 | T-5 | AC-12 | T-3, T-4 |
| AC-4 | T-5 | AC-13 | T-3, T-4 |
| AC-5 | T-7 | AC-14 | T-1 |
| AC-6 | T-8 | AC-15 | T-2 |
| AC-7 | T-8 | AC-16 | T-15 |
| AC-8 | T-8 | AC-17 | T-12 |
| AC-9 | T-10, T-11 | AC-18 | T-13 |

**Żaden AC nie został bez pokrycia** (18/18).

## Ścieżka krytyczna

```
T-3 → T-4 ─┐
           ├→ T-5 → T-6 → T-7 ─┐
T-1, T-2 ──┘                   ├→ T-14 → T-15 → T-16
T-8 ───────────────────────────┤
T-9 → T-10 → T-11 ─────────────┤
T-12, T-13 ────────────────────┘
```

- **T-3 → T-4 → T-5 to jedyna twarda kolejność merytoryczna** (nie techniczna): budżet wolno
  podnieść dopiero, gdy pamięć podręczna go finansuje.
- **T-1, T-2, T-8, T-9, T-12 są niezależne** i mogą iść równolegle do gałęzi cache/odczytu.
- **T-15 blokuje domknięcie**: dopóki pomiar nie potwierdzi oszczędności, feature nie jest gotowy —
  bo dokładnie o koszt pytało zgłoszenie.

## Notatki / blokady

- Brak. Plan pokrywa wszystkie zadania; nic nie wymaga decyzji właściciela (C-55).
