# Plan techniczny: Niezawodność i efektywność kosztowa asystenta AI

- **Spec:** ./spec.md (030-assistant-reliability-cost)
- **Status:** draft
- **Data:** 2026-07-25

> Plan pisany pod istniejący kod agenta Home: `src/app/api/llm/home/agent/route.ts` (pętla
> `runAgentLoop`), `src/lib/ai/agentTools.ts` (read-toole), `src/lib/ai/agentContext.ts`
> (higiena kontekstu, spec 028), `src/lib/ai/fastPath.ts` (klasyfikator dispatch).
> Wzorcem są istniejące optymalizacje 025/028 — rozszerzamy je, nie wymyślamy nowej architektury.

## 1. Podejście (2–4 zdania)

Cztery chirurgiczne zmiany w istniejącej pętli agenta: (a) tolerancyjne parsowanie + łagodna
degradacja zamiast błędu 502 „LLM zwrócił nieprawidłowy format"; (b) uzupełnienie read-tooli o
pomijane pola funkcjonalne (cykliczność zadań) + reguła rzetelności w promptcie; (c) pamięć
wywołań narzędzi w turze + przycinanie długich pól per-pole (zamiast cięcia bloku w połowie
JSON-a); (d) tani model (op `dispatch`) dla prostych tur odczytowych z auto-fallbackiem do
`reasoning`. Zero zmian schematu, zero nowych zależności, zero zmian UI.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** `Task.recurring` (String, JSON `RecurringRule`) już istnieje
(`schema.prisma:699`) — read-toole go tylko zaczną zwracać. Brak migracji.

## 3. Warstwa serwera

Feature nie dodaje Server Actions ani mutacji — zmiany żyją w route handlerze agenta i w
`src/lib/ai/*` (czyste funkcje). `revalidatePath` nie dotyczy (C-20 bez zmian). Guardy dostępu
read-tooli (`accessibleProjectIds`, `accessibleListWhere`, …) pozostają nietknięte (C-21).

### 3.1. Odporność na zły format (AC-1, AC-2)

Nowy plik **`src/lib/ai/agentProtocol.ts`** (czyste, testowalne funkcje — wzorzec
`agentContext.ts`):

- `extractJsonLoose(content: string): Record<string, unknown> | null` — obecny `extractJson`
  z `route.ts` + tolerancje: zdejmowanie płotków ```…```, **skan zbalansowanego bloku
  `{…}`** w tekście mieszanym (model czasem dokleja prozę przed/po JSON), usunięcie trailing
  commas. Zwraca `null` zamiast rzucać.
- `salvageAnswerText(content: string): string` — „ostatnia deska ratunku": jeśli w treści da się
  wyciąć wartość pola `"answer"` (regex po sparsowanym fragmencie) — użyj jej; inaczej zwróć
  treść oczyszczoną z płotków/nawiasów JSON-owych artefaktów, przyciętą do rozsądnej długości.

Zmiany w `runAgentLoop` (`route.ts`):

- Wewnętrzna pętla naprawy: **3 próby** (dziś 2); komunikat korekcyjny do modelu zawiera
  krótko **co było nie tak** („odpowiedź nie była poprawnym JSON: …") zamiast ogólnika.
- Po wyczerpaniu prób: **zamiast `{status:502, error:"LLM zwrócił nieprawidłowy format"}`**
  zwróć `{ body: { step:"answer", answer: salvageAnswerText(lastContent), degraded:true, log } }`
  (status 200). Decyzja właściciela: treść zamiast błędu; `degraded:true` w body pozwala
  klientowi/telemetrii to odróżnić, a **żadne akcje mutujące nie są proponowane** (krok answer
  z definicji ich nie ma). Komunikat 502 znika z kodu ścieżki parsowania (zostaje tylko dla
  realnych błędów transportu LLM — te mają już swoje polskie komunikaty).

### 3.2. Rzetelność o funkcjach aplikacji (AC-3, AC-4, AC-5)

- **`src/lib/recurrence.ts`**: nowy helper `describeRecurringRule(rule: RecurringRule): string`
  — krótki polski opis („co tydzień: pn, śr", „co 2 dni", „co miesiąc 15."). Wykorzystywany
  przez read-toole (wzorzec: `describeFrequency` z `medicationSchedule.ts`).
- **`agentTools.ts` — `list_tasks`**: do selecta dochodzi `recurring`; w wyniku pole
  `recurring: true` **tylko gdy ustawione** (pomijane gdy null — zero kosztu tokenów dla
  zwykłych zadań). Dodatkowo `hasDescription: true` tylko gdy opis niepusty — model wie,
  czy warto wołać `get_task` (wspiera AC-8).
- **`agentTools.ts` — `get_task`**: select + wynik `recurring` jako opis z
  `describeRecurringRule(parseRecurringRule(task.recurring))` (null → pole pomijane).
- **Opisy narzędzi w `READ_TOOLS_PROMPT`**: aktualizacja linii `list_tasks`/`get_task`
  o nowe pola (model musi wiedzieć, że one istnieją).
- **Audyt pozostałych read-tooli** (AC-4): przegląd wykazał, że pozostałe narzędzia już niosą
  swoje pola funkcjonalne (`list_medications` ma `frequency` z opisem cykliczności,
  `list_habits` ma `doneToday`, pojazdy mają terminy przeglądów/ubezpieczeń itd.).
  Jedyna znaleziona luka tej klasy to cykliczność zadań. Implementer w trakcie prac
  weryfikuje to twierdzenie (szybki przegląd `runReadTool` case-по-case vs schema) i
  odnotowuje wynik w `verify.md`; ewentualne kolejne luki łata tym samym wzorcem
  (pole tylko-gdy-ustawione).
- **Prompt (ZASADY w `buildSystemPrompt`)**: nowa krótka reguła — „RZETELNOŚĆ O APLIKACJI:
  nie twierdź kategorycznie, że aplikacja nie ma jakiejś funkcji. Wiesz tylko to, co widzisz
  w narzędziach i wynikach. Gdy pytanie dotyczy możliwości aplikacji, których nie możesz
  zweryfikować — powiedz, że nie masz wglądu, zamiast zaprzeczać."

### 3.3. Pamięć wywołań + przycinanie długich pól (AC-6, AC-7, AC-8)

- **Deduplikacja** (`runAgentLoop`): mapa `toolCache = Map<string, unknown>` w zasięgu tury,
  klucz `tool + ":" + JSON.stringify(args)`. Powtórzone wywołanie: wynik z mapy (bez ponownego
  wykonania), a do bloku wyników dokładany marker
  `repeat: "to wywołanie już wykonano w tej turze — wynik z pamięci; nie powtarzaj identycznych zapytań"`.
  Dotyczy read-tooli i `web_search`.
- **`agentContext.ts` — przycinanie per-pole**: nowa funkcja
  `trimLongStrings(value, maxLen = 700)` — rekurencyjnie skraca **każdy string** w rekordach
  wyników do `maxLen` z markerem `…[SKRÓCONO z N znaków — pełna treść: get_task/get_note po id]`.
  `compactToolResults` stosuje ją PRZED serializacją. Twardy bezpiecznik blokowy
  (`TOOL_RESULT_MAX_CHARS`) zostaje, ale po per-pole trimie praktycznie nie będzie się
  uruchamiał — **koniec ucinania w połowie JSON-a**, które w zgłoszeniu #5 wprowadzało model
  w pętlę ponawiania.
- `MAX_ITERATIONS` zostaje 6 (minimalizm C-53) — dedup + poprawne oznaczanie skrótów usuwa
  przyczynę jałowych iteracji, nie leczymy objawu podnoszeniem limitu.

### 3.4. Tani model dla prostych tur odczytowych + koszty (AC-9, AC-10)

- **Parametr `op` w pętli**: `callAgent`/`runAgentLoop` przyjmują `op: "dispatch" | "reasoning"`
  (dziś zahardcodowane `"reasoning"`); trafia do `chatComplete({ op })`. **C-40 zachowane** —
  model nadal wybiera resolver z przydziału w `/admin/llm` (dla `dispatch` to dziś Haiku),
  zero hardcodu modelu.
- **Klasyfikacja prostej tury odczytowej** (deterministyczna, bez dodatkowego wywołania LLM,
  w `route.ts` obok fast-path): tura jest „prosta-odczytowa", gdy świeże polecenie (nie
  wznowienie clarify/refine) spełnia WSZYSTKIE: (a) `READ_INTENT_RE` z `fastPath.ts`
  (eksportować regex) pasuje, (b) tekst ≤ 160 znaków, (c) brak słów analitycznych
  (`oceń|przeanalizuj|porównaj|dlaczego|zaproponuj|raport|podsumuj|streść`). Wątpliwości →
  `reasoning` (konserwatywnie, zgodnie ze specem).
- **Auto-fallback**: pętla jedzie na `dispatch`; jeśli wynik to degradacja formatu
  (`degraded:true`), błąd LLM albo odpowiedź „limit kroków" — **jednorazowe ponowienie całej
  pętli na `reasoning`** ze świeżą kopią wyjściowych `messages` (kopię robimy przed pierwszym
  przebiegiem). Koszt obu przebiegów sumuje się w istniejącym `meta` (UsageMeter), więc
  wskaźnik kosztu pozostaje uczciwy. Źródło w logu wywołań: istniejące `source:"home_agent"`
  — rozróżnienie ścieżki widać po modelu/op w `AiCall`.
- **Redukcje tokenów**: (a) `clampLimit` w `agentTools.ts` — domyślny limit list 40 → **25**
  (`HARD_MAX` 60 bez zmian; narzędzia respektują jawny `limit` modelu); (b) per-pole trim
  z 3.3 tnie największy zmienny koszt (opisy-zgłoszenia w tytułach/opisach zadań);
  (c) bez odchudzania promptu systemowego ponad to — 025/028 już go zrouterowały, dalsze
  cięcia to ryzyko regresji przy małym zysku (świadoma decyzja, minimalizm).

## 4. RBAC / rejestr modułu (C-22)

Bez zmian — istniejący `module.home`; żadnych nowych stron, slugów ani wpisów w
`modules.tsx`/`ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)

Bez zmian w komponentach. Jedyny efekt widoczny: zamiast błędu „LLM zwrócił nieprawidłowy
format" użytkownik dostaje zwykłą odpowiedź tekstową (istniejący rendering kroku `answer`).
Wszystkie nowe teksty (markery skrótów, komunikaty korekcyjne, reguły promptu) po polsku (C-32).

## 6. AI / integracje (C-23, C-40)

- **Zero nowych `AIAction`** — `check:actions` bez zmian; manifest `action-coverage.json`
  nietknięty (read-toole nie zmieniają listy, tylko kształt wyników).
- C-40: routing przez op-type (`dispatch`/`reasoning`) z `/admin/llm` — patrz 3.4.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/lib/ai/agentProtocol.ts` | nowy | `extractJsonLoose`, `salvageAnswerText` (testowalne) |
| `worldofmag/src/lib/ai/__tests__/agentProtocol.test.ts` | nowy | testy tolerancyjnego parsowania i salvage |
| `worldofmag/src/app/api/llm/home/agent/route.ts` | edycja | 3 próby naprawy + degradacja do answer; dedup wywołań; param `op`; klasyfikacja prostej tury + fallback dispatch→reasoning; reguła RZETELNOŚĆ w ZASADY |
| `worldofmag/src/lib/ai/agentContext.ts` | edycja | `trimLongStrings` per-pole + użycie w `compactToolResults` |
| `worldofmag/src/lib/ai/__tests__/agentContext.test.ts` | edycja | testy trimowania per-pole (JSON zawsze poprawny) |
| `worldofmag/src/lib/ai/agentTools.ts` | edycja | `recurring`/`hasDescription` w `list_tasks`, `recurring` w `get_task`, opisy w `READ_TOOLS_PROMPT`, `clampLimit` def 25 |
| `worldofmag/src/lib/ai/fastPath.ts` | edycja | eksport `READ_INTENT_RE` (reużycie w route) |
| `worldofmag/src/lib/recurrence.ts` | edycja | `describeRecurringRule` (opis PL reguły) |
| `worldofmag/src/lib/__tests__/recurrence.test.ts` | edycja/nowy | test opisu reguły (dopasować do istniejącego układu testów) |
| `doświadczenia.md` | edycja | wpis lessons-learned (C-51) |

## 8. Bramki i weryfikacja (C-50)

- Lokalnie: `cd worldofmag && npm run check:actions && npm run check:migrations && npx next lint
  && npx tsc --noEmit && npx next build` (bez `migrate.js` — C-13; brak migracji w tym feature).
- Testy jednostkowe: istniejący runner repo (katalogi `__tests__` w `lib/ai`, `lib/llm`) — sposób
  uruchamiania wg `package.json` (implementer sprawdza i używa tego samego mechanizmu).
- Mapowanie AC → weryfikacja:
  - **AC-1/AC-2** — testy `agentProtocol` (JSON z prozą, z płotkami, popsuty → salvage);
    przegląd kodu: ścieżka 502-format usunięta; symulacja w teście jednostkowym pętli parsera.
  - **AC-3** — test/inspekcja: `get_task`/`list_tasks` zwracają `recurring` dla zadania z regułą
    (weryfikacja na lokalnym Postgresie lub przez test funkcji mapującej).
  - **AC-4** — przegląd case'ów `runReadTool` vs schema, wynik odnotowany w `verify.md`.
  - **AC-5** — inspekcja promptu (reguła obecna) + scenariusz ręczny w `verify.md`.
  - **AC-6** — test lub inspekcja dedupu (drugie identyczne wywołanie nie uruchamia narzędzia).
  - **AC-7** — testy `trimLongStrings`/`compactToolResults`: długi opis → poprawny JSON z markerem.
  - **AC-8** — analiza w `verify.md`: scenariusz zgłoszenia #5 przechodzi ścieżką
    dedup+trim (bez pętli powtórek) — uzasadnienie krok po kroku na podstawie logów zgłoszenia.
  - **AC-9** — inspekcja: klasyfikacja prostej tury + fallback; test klasyfikatora (regex+warunki).
  - **AC-10** — szacunek tokenów przed/po dla scenariuszy ze zgłoszeń (trim opisów, limit 25,
    dispatch-model) w `verify.md`.
  - **AC-11** — sekcja odpowiedzi dla administratora w podsumowaniu pipeline'u.

## 9. Ryzyka techniczne i plan wycofania

- **Haiku na turach odczytowych da słabsze odpowiedzi bez twardej porażki** (fallback nie
  triggeruje) → klasyfikacja konserwatywna (krótkie, nieanalityczne polecenia); w razie skarg
  łatwy rollback: jedna flaga wyboru `op` w route (kod, bez migracji).
- **Salvage pokaże użytkownikowi treść z artefaktami** → salvage preferuje wyciągnięte pole
  `answer`; czyszczenie płotków; degradacja oznaczona w body (`degraded`) do diagnostyki.
- **Per-pole trim zuboży odpowiedź, gdy użytkownik prosi o pełną treść** → marker wskazuje
  `get_task`/`get_note` po id; pełne narzędzia singlowe (get_*) dostają wyższy próg (1500 znaków)
  niż listingi (700).
- **Dedup zwróci nieświeże dane po akcji** → pamięć żyje tylko w jednej turze (`runAgentLoop`),
  a mutacje wykonują się poza pętlą (w `/execute`) — brak ścieżki unieważnienia w obrębie tury.
- Rollback: wyłącznie kod (git revert) — zero migracji, zero zmian danych.

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — bez zmian schematu/migracji (jawnie stwierdzone w §2)
- [x] C-20..C-25 — bez nowych akcji/mutacji; guardy read-tooli nietknięte; C-23 bez zmian manifestu
- [x] C-30..C-32 — bez zmian UI; wszystkie nowe teksty PL
- [x] C-40..C-41 — routing DB-driven przez op-type; klucze nietknięte
- [x] C-53 — minimalny zestaw zmian: 6 edytowanych plików + 1 nowy moduł czystych funkcji
- [x] C-54 — plan zgodny ze specem (decyzje właściciela wpięte w 3.1 i 3.4)
