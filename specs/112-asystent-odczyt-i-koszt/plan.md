# Plan techniczny: Asystent — kompletny odczyt, domknięcie tury i uczciwy koszt

- **Spec:** ./spec.md (112-asystent-odczyt-i-koszt)
- **Status:** draft
- **Data:** 2026-08-28

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

## 1. Podejście

Feature nie tworzy nowego modułu ani nowej powierzchni — **naprawia cztery istniejące mechanizmy
asystenta w miejscach, w których już żyją**. Wzorcem jest przebieg **036** (podział promptu na blok
stały i zmienny) oraz **032** (higiena pętli: dedup wywołań, wykrywanie bezproduktywnych iteracji,
uczciwe domknięcie przebiegu) — kontynuujemy dokładnie te dwie linie, bo obie zgłoszone usterki są
ich **niedokończeniem**, a nie nowym problemem.

Kolejność prac jest częścią projektu, nie kosmetyką: **najpierw pamięć podręczna** (mierzalna
oszczędność), **potem** podniesienie budżetu wyników — inaczej podnieślibyśmy koszt tury, którą
zgłoszenie krytykuje właśnie za koszt (ryzyko nr 1 ze speca).

Rekonesans wykazał trzy fakty, które zmieniają kształt planu wobec pierwotnego opisu zgłoszeń — są
opisane w § 11 i **zostały naniesione na `spec.md`** (C-54).

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Rekonesans potwierdził, że `Pet` ma już wszystkie pola potrzebne do
bogatszego profilu (AC-9): `birthDate`, `birthApprox`, `acquiredAt`, `acquiredFrom`, `microchipId`,
`identifier`, `color`, `notes`. Wąskim gardłem był wyłącznie **kontrakt akcji AI**, nie baza —
`add_pet` przyjmował 4 z tych pól. To potwierdza granicę ze speca („przebudowa modelu danych — poza
zakresem").

**Jedna migracja, wyłącznie DANE** (C-14) — seed raportu dokumentującego rachunek (AC-17):

- Numer z `npm run next:migration`: **`0271`**
- Katalog: `prisma/migrations/0271_raport_koszt_tury_asystenta/migration.sql`
- Treść: idempotentny `INSERT INTO "Report" (…) VALUES (gen_random_uuid()::text, …, $tag$…$tag$,
  'system', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("slug") DO NOTHING;`
  ze slugiem **globalnie unikalnym**: `asystent-koszt-tury-rozbicie`.
- Zero `CREATE`/`ALTER`/`DROP` — po wygenerowaniu sprawdzamy `grep -E "^(DROP|ALTER)"` (C-15).

## 3. Warstwa serwera (Server Actions — C-20)

**Nowych Server Actions nie ma.** Cała zmiana żyje w warstwie AI (trasa agenta, platforma LLM,
narzędzia odczytu, egzekutor Zwierząt), która nie jest warstwą mutacji danych użytkownika —
`revalidatePath` nie ma tu czego unieważniać. Jedyna mutacja (założenie zwierzęcia) idzie
**istniejącą** ścieżką: `/api/llm/home/execute` → egzekutor modułu Zwierzęta → `prisma.pet.create`
z `wlasnoscOsobistaDoZapisu(userId)`.

Guard dostępu (C-21/C-17) — **bez zmian i bez poszerzeń**. Read-toole Zadań już pytają
`requireTaskModuleAccess` i zawężają zapytania przez `accessibleProjectIds`. Stronicowanie i większy
budżet **nie mogą** rozszerzyć widocznego zbioru: `offset` działa na tym samym `where`, więc
zmieniamy okno, nigdy zakres. To jest wymaganie weryfikowane w testach, nie założenie.

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Korzystamy z istniejących slugów `module.tasks`, `module.pets`, `module.admin`.
Nowego modułu nie ma, więc `permissions.ts`, `modules.tsx` i `ModuleSidebar` zostają nietknięte.

## 5. UI (C-30, C-31, C-32)

Zmiany w interfejsie są **minimalne i tekstowe** — feature jest serwerowy.

- Nie powstaje żadna nowa trasa ani widok. Raport z AC-17 renderuje **istniejąca** strona
  `/reports/[slug]` — nie piszemy do niej ani jednej linii.
- Nowe teksty widoczne dla użytkownika (komunikat o brakach przy domkniętej turze) idą do
  `messages/pl.json` i są czytane przez `useTranslations` (C-32). **Ważne rozgraniczenie:** teksty
  wchodzące do **promptu modelu** oraz komunikat składany po stronie serwera w
  `agentPartialRun.ts` **nie są tekstem UI** — nie przechodzą przez `t()`, tak jak dziś nie
  przechodzą (są częścią protokołu albo treścią generowaną). Bramka `check:i18n` obejmuje
  komponenty, nie moduły serwerowe, więc to rozgraniczenie jest zgodne z jej zakresem.
- Zero nowych kolorów, więc C-30 nie jest dotykane. Zero nowego układu, więc C-31 nie jest dotykane.

## 6. AI / integracje (C-23, C-40) — rdzeń feature'a

### 6.1 Pamięć podręczna promptu — drugi punkt cięcia (AC-12, AC-13)

**Diagnoza:** `toAnthropicSystem` oznacza `cache_control` **wyłącznie na bloku stałym** (~1276 tok.),
a katalog (~12–18 tys. tok.) idzie zwykłym wejściem. W pętli agenta prompt systemowy jest zbudowany
**raz** (`buildSystemPromptParts` przed pętlą) i przekazywany do każdej iteracji **identyczny co do
znaku** — więc w sesji „pies Raj" ten sam katalog opłacono w pełnej cenie **sześć razy**.

**Zmiana:** `toAnthropicSystem` przyjmuje dodatkowo informację, czy oznaczyć **także blok zmienny**
(drugi punkt cięcia; Anthropic dopuszcza do czterech). Sterujemy tym z pętli agenta:

| Wywołanie w przebiegu | Blok stały | Blok zmienny | Dlaczego |
|---|---|---|---|
| pierwsze | oznaczony | **nie** | zapis kosztuje 1,25× — tura jednowywołaniowa nie może zdrożeć |
| drugie | oznaczony | **tak** (zapis) | od tego miejsca wiadomo, że przebieg iteruje |
| trzecie i dalsze | oznaczony | **tak** (odczyt 0,1×) | właściwa oszczędność |
| ostatnie (domknięcie) | oznaczony | **nie** | nic po nim nie nastąpi — AC-13 |

Rachunek jednostkowy dla katalogu w przebiegu 6-wywołaniowym: **dziś 6,0×** ceny wejścia →
**po zmianie 2,65×** (1,0 + 1,25 + 4 × 0,1). Wariant „oznaczaj od pierwszego wywołania" dałby 1,75×,
ale **podniósłby** koszt tury jednowywołaniowej o 0,25× — czyli dokładnie tego przypadku, którego
dotyczy zgłoszenie „30 groszy". Wybieramy wariant bez regresji (C-53: mniejsze zło, nie większy
sprytniejszy mechanizm).

**Druga naprawa w tym samym pliku:** dzisiejszy podział jest przyjmowany tylko wtedy, gdy
`stable + variable === system` **co do znaku**; gdy równość nie zachodzi, funkcja **po cichu**
oznacza `cache_control` na **całym** prompcie — czyli płaci 1,25× za wszystko. To wyjaśnia
zaobserwowany zapis **11 860 tokenów w ostatnim wywołaniu** sesji „pies Raj" ($0,044 wyrzucone).
Fallback zostaje (jest bezpieczny dla treści), ale przestaje być niemy: logujemy zdarzenie
`ai.prompt.podzialOdrzucony` (`platform/observability/log`) i zliczamy je metryką, żeby rozjazd był
widoczny, a nie tylko drogi.

### 6.2 Tanie decyzje pozostają tanie (AC-14, AC-15)

**Diagnoza — to jest błąd, nie ustawienie.** `routeModules` deklaruje `maxTokens: 120`, a
`classifyIntent` `maxTokens: 300`. Zaobserwowano **1326** i **494** tokenów wyjścia. Przyczyna:
`applyEffort` dla Anthropic przy poziomie `medium` ustawia `thinking.budget_tokens = 6144` i
**podnosi `max_tokens` ze 120 do 7168**, bo dostawca tego wymaga. Deklarowany przez wołającego
budżet wyjścia — będący stwierdzeniem o **kształcie odpowiedzi** („zwróć listę modułów") — jest więc
przesłaniany sześćdziesięciokrotnie, a tokeny myślenia rozliczane jako wyjście.

**Zmiana:** oba wywołania klasyfikacyjne przekazują `effort: "none"`. Pole `ChatOptions.effort`
istnieje od 033 dokładnie w tym celu („nadpisanie poziomu wysiłku, rzadko potrzebne"), więc nie
powstaje nowy mechanizm.

**To nie jest naruszenie C-40.** C-40 zabrania zaszywania w kodzie **dostawcy i modelu** — te nadal
pochodzą z `/admin/llm` i z przydziału per typ operacji. Tutaj call-site oświadcza jedynie, że jego
własna odpowiedź ma być krótka i deterministyczna; wybór modelu zostaje po stronie konfiguracji.

**Ustalenie z implementacji (naniesione wstecz, C-54): `\b` w JavaScripcie jest ASCII-owe, więc
strażniki intencji były częściowo martwe.** Pisząc test do AC-15 okazało się, że
`READ_INTENT_RE.test("pokaż zadania")` zwraca **`false`**: po „ż" i po spacji stoją dwa znaki
nie-słowne, więc granicy słowa tam nie ma. Martwe były wszystkie człony kończące się polską literą
(`pokaż`, `znajdź`, `sprawdź`, `doradź`, `oceń`, `streść`, `przychód`, `odhaczyć`, `wąż`) oraz
zaczynające się od niej (`śniadanie`, `słówka`) — przy działających wariantach bez diakrytyków.

To **nie jest poszerzenie zakresu, tylko ta sama usterka co AC-14/AC-15**: strażnik, który nie łapie
„pokaż zadania", wysyła turę do **płatnego** klasyfikatora i **płatnego** routera, choć odpowiedź obu
była znana z góry. Naprawa: jeden wspólny konstruktor `granicePolskie(rdzen)` (asercje „nie litera"
z flagą `u`) użyty w `READ_INTENT_RE`, `SIMPLE_READ_ANALYTIC_RE` i wszystkich 16 wpisach
`KEYWORD_ROUTES`. Zakres speca bez zmian; nowe zadanie **T-2a** w `tasks.md`.

**AC-15 (klasyfikacja, która nie może pomóc):** `classifyIntent` odsiewa już `READ_INTENT_RE` przed
wywołaniem modelu. Dokładamy drugi tani odsiew tego samego rodzaju — **próg długości** — bo
„pojedyncza prosta operacja dodania" jest z definicji krótka, a zgłoszona wiadomość była długim
zdaniem sugestii. Próg bierzemy z istniejącej konwencji w trasie (`isSimpleRead`: `length <= 160`),
żeby nie wprowadzać drugiej, niezgodnej liczby.

### 6.3 Kompletny odczyt zamiast spirali zawężania (AC-1…AC-5)

**Diagnoza:** limit siedzi w **kontekście**, nie w zapytaniu — `PER_TOOL_MAX_RECORDS = 12` obcina
listę po stronie kompaktowania, a komunikat mówi modelowi „**zawęź zapytanie (search/status/limit)**".
Model wykonał więc dokładnie polecenie: pociął projekt po statusie, tagu i priorytecie. Podniesienie
`limit` nic nie dawało, bo cap jest za nim. Stąd jedenaście odczytów.

Trzy zmiany w `platform/ai/agentContext.ts` + jedna w narzędziach Zadań:

1. **Komunikat mówi, jak dobrać resztę, a nie „zawęź".** Nowa treść wskazuje **konkretny następny
   krok**: powtórz to samo wywołanie z `offset: <liczba już pokazanych>`. Ogólnik wyprodukował
   spiralę — konkret jest tu wymaganiem funkcjonalnym (ryzyko nr 5 ze speca).
2. **Podniesienie budżetu:** `PER_TOOL_MAX_RECORDS` 12 → **40**, `TOOL_RESULT_MAX_CHARS` 3500 →
   **12 000**. Sfinansowane oszczędnością z § 6.1; netto tura ma być tańsza (AC-16).
3. **Bezpiecznik znakowy przestaje ciąć JSON w połowie (AC-4).** Dziś jest to `json.slice(...)`, co
   produkuje niepoprawną strukturę — a `doświadczenia.md` odnotowuje już raz, że model wtedy nie
   rozumie wyniku i **ponawia zapytanie do wyczerpania limitu kroków**. Zamiast ciąć string,
   **usuwamy całe rekordy** od końca, aż blok się zmieści, i dopisujemy ten sam znacznik
   stronicowania. Wynik zawsze pozostaje poprawnym, zamkniętym JSON-em.
4. **Stronicowanie w narzędziu (AC-2):** `list_tasks` przyjmuje `offset` (wspólny helper
   `offsetOf(args)` obok istniejącego `clampLimit` w `src/lib/ai/readToolShared.ts`), przekazywany do
   `prisma.findMany` jako `skip`. Kolejność jest już deterministyczna (`dueDate`, `priority`,
   `order`), więc porcje nie zachodzą na siebie.
   **Świadoma granica (C-53):** `offset` wpinamy w `list_tasks` — narzędzie ze zgłoszonego
   scenariusza — a konwencję (helper + zdanie w prompcie) zostawiamy gotową dla pozostałych list.
   Zmiana 56 narzędzi „przy okazji" byłaby refaktorem bez zgłoszenia; odnotowane jako następny krok.
5. **Treść opisów bez 20 osobnych odczytów (AC-5):** `list_tasks` przyjmuje
   `includeDescription: true` i dokłada `description` do wyników (skracane per-pole przez istniejący
   `trimLongStrings`, więc JSON zostaje poprawny). To mniejsza zmiana niż nowe narzędzie
   `get_tasks`, a usuwa dokładnie tę przeszkodę: dziś `hasDescription: true` mówi „są szczegóły",
   ale jedyną drogą do nich jest `get_task` **po jednym**, przy `MAX_TOOLS_PER_TURN = 4`.

Opis narzędzia w `readToolsPrompt` (moduł Zadania) dostaje zdania o `offset` i `includeDescription`.

### 6.4 Domknięcie tury wynikiem (AC-6…AC-8)

**Diagnoza:** `summarizePartialRun` prosi model o **streszczenie tego, czego nie zrobił** („podsumuj:
co udało się ustalić, czego nie udało się dokończyć, jak dopytać"). W zgłoszonej sesji komplet
danych był w kontekście — zabrakło wyłącznie polecenia, żeby ich użyć.

**Zmiana:** to samo, jedno dodatkowe wywołanie prosi o **DOKOŃCZENIE zadania z zebranych danych**:
`plan` (akcje do potwierdzenia) albo `answer` (pełna odpowiedź), **plus jawna lista braków**.
Konsekwentnie rozszerzamy obsługę wyniku: dziś czytane jest tylko pole `answer`, więc trzeba przyjąć
także `step: "plan"` i zwrócić go tą samą ścieżką co zwykły plan z pętli (`normalizeActions`, panel
potwierdzenia, akcje niszczące domyślnie odznaczone — bez zmian).

**AC-8 zostaje nienaruszone:** gdy nie zebrano żadnych danych (`countSuccessfulReads(log) === 0`),
**nie wołamy modelu o dokończenie** — nie ma z czego — tylko oddajemy dzisiejszy uczciwy komunikat
`partialRunFallbackMessage`. Ta sama funkcja pozostaje ścieżką awaryjną, gdy dodatkowe wywołanie
zawiedzie. Nic z 032 nie jest kasowane.

### 6.5 Zwierzę z profilem i raport braków (AC-9…AC-11) — C-23

`add_pet` i `update_pet` przyjmują pola, które model danych **już ma**: `birthDate`, `birthApprox`,
`acquiredAt`, `acquiredFrom`, `microchipId`, `identifier`, `color`, `notes`.

Trzy wpięcia są obowiązkowe, bo inaczej build pada (C-23) i — co gorsza — prompt obiecywałby pole
bez pokrycia:

1. `src/modules/pets/ai/petActions.ts` — opis parametrów w katalogu promptu.
2. `src/modules/pets/ai/executor.ts` — zapis pól (daty parsowane z ISO; niepoprawna data → pole
   pomijane, nigdy `Invalid Date` do bazy). `update_pet` przekazuje dziś tylko `name`/`breed` —
   rozszerzamy tak samo, żeby oba wejścia opisywały ten sam profil.
3. `src/platform/ai/actionContract.ts` — kontrolki i etykiety PL dla nowych pól (`day("Data
   urodzenia")`, `longText("Notatki")` …), bo to ten rejestr rysuje panel potwierdzenia **i**
   waliduje po stronie serwera.

**AC-10 (raport braków)** to zmiana **promptu**, nie kodu: w katalogu akcji Zwierząt dopisujemy
regułę — gdy użytkownik prosi o przeniesienie danych z innego modułu, w odpowiedzi ma być
wyodrębniona lista informacji, których moduł nie potrafi przechować, z powodem. Zgodne z tym, jak
prompt już formułuje wymagania („WAŻNE (czytelność dla użytkownika): …").

**AC-11 (projekt źródłowy nietknięty)** nie wymaga kodu: przebieg czyta Zadania read-toolami i pisze
wyłącznie akcjami Zwierząt; żadna akcja mutująca Zadania nie jest proponowana. Weryfikujemy to jako
warunek scenariusza (§ 8), a nie jako nową blokadę — blokada byłaby mechanizmem bez zgłoszenia.

### 6.6 Dokumentacja rachunku (AC-17, AC-18)

Raport systemowy (slug `asystent-koszt-tury-rozbicie`) zawiera: sposób liczenia (wejście, wyjście,
zapis 1,25×, odczyt 0,1×), **przeliczenie obu zgłoszonych sesji** na cenniku z `LlmModelPrice`,
wniosek „**wycena jest poprawna — nieoptymalne było zużycie**", oraz co ten przebieg zmienił.
AC-18 realizuje się **przez brak zmian**: nie ruszamy `AiCostBadge`, `visibleUsage` ani progu
widoczności kosztu — kwoty pozostają widoczne i niezmienione co do zasady.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/platform/llm/chat.ts` | edycja | `toAnthropicSystem`: drugi punkt cięcia (blok zmienny) sterowany flagą; log `ai.prompt.podzialOdrzucony` przy niemym fallbacku (§ 6.1) |
| `src/app/api/llm/home/agent/route.ts` | edycja | polityka oznaczania cache per iteracja; `effort:"none"` w `routeModules`; domknięcie przez „dokończ" zamiast „streść", obsługa `step:"plan"` z domknięcia (§ 6.1, 6.2, 6.4) |
| `src/lib/ai/fastPath.ts` | edycja | `effort:"none"` w `classifyIntent` + próg długości przed wywołaniem modelu (§ 6.2) |
| `src/platform/ai/agentContext.ts` | edycja | budżety 12→40 i 3500→12 000; komunikat ze wskazaniem `offset`; bezpiecznik usuwa całe rekordy zamiast ciąć JSON (§ 6.3) |
| `src/lib/ai/readToolShared.ts` | edycja | wspólny `offsetOf(args)` obok `clampLimit` (§ 6.3) |
| `src/modules/tasks/ai/readTools.ts` | edycja | `list_tasks`: `offset` → `skip`, `includeDescription`; opis w `readToolsPrompt` (§ 6.3) |
| `src/modules/pets/ai/petActions.ts` | edycja | nowe parametry `add_pet`/`update_pet` + reguła raportu braków (§ 6.5) |
| `src/modules/pets/ai/executor.ts` | edycja | zapis nowych pól profilu, parsowanie dat (§ 6.5) |
| `src/platform/ai/actionContract.ts` | edycja | kontrolki i etykiety PL nowych pól (C-23) |
| `src/platform/ai/__tests__/agentContext.test.ts` | edycja | testy budżetu, znacznika `offset`, poprawności JSON po obcięciu (AC-1…AC-4) |
| `src/platform/ai/__tests__/agentPartialRun.test.ts` | edycja | test: brak danych → dzisiejszy komunikat (AC-8) |
| `src/platform/llm/__tests__/systemBlocks.test.ts` | **nowy** | tabela oznaczania cache per wywołanie + odrzucony podział (AC-12, AC-13) |
| `prisma/migrations/0271_raport_koszt_tury_asystenta/migration.sql` | **nowy** | idempotentny seed raportu (AC-17, C-14) |
| `messages/pl.json` | edycja | teksty UI, jeśli domknięcie tury doda komunikat w interfejsie (C-32) |
| `doświadczenia.md` | edycja | lekcja: dwa zgłoszenia = jedna przyczyna (C-51) |
| `CLAUDE.md` | edycja | akapit o 112 w sekcji asystenta (utrzymanie tabeli w prawdzie) |

## 8. Bramki i weryfikacja (C-50)

Lokalnie: Postgres z obrazu (`pg_ctlcluster 16 main start`), `.env.local` na `127.0.0.1:5432`,
`npx prisma migrate deploy`. **Nigdy prod `DATABASE_URL`** (C-13) — weryfikujemy **do kroku
`next build`**, bez `scripts/migrate.js`.

Kolejno: `npm run check:migrations` · `npm run check:actions` · `npm run check:ai-coverage` ·
`npm run check:cost-badge` · `npm run check:i18n` · `npm run check:logs` · `npm run test:unit` ·
`tsc --noEmit -p tsconfig.test.json` · `next lint --dir src` · `next build`.

| AC | Jak sprawdzamy |
|---|---|
| AC-1 | test jednostkowy `compactToolResults`: 25 rekordów → znacznik zawiera „offset" i liczby „40/25"; brak słowa „zawęź" jako jedynej rady |
| AC-2 | test `list_tasks` z `offset`: dwie porcje po 40 z projektu 60-zadaniowego są rozłączne i pokrywają całość |
| AC-3 | test: zbiór mieszczący się w budżecie → **brak** pola `truncated` w wyniku |
| AC-4 | test: blok przekraczający budżet znaków → wynik **parsuje się** jako JSON (`JSON.parse` nie rzuca) i ma mniej rekordów |
| AC-5 | scenariusz ręczny w `/admin/llm` + log przebiegu: komplet zadań z opisami po ≤ 3 iteracjach |
| AC-6, AC-7 | scenariusz „pies Raj": przebieg kończy się krokiem `plan` z listą braków |
| AC-8 | test `agentPartialRun`: log bez udanych odczytów → dzisiejszy komunikat, bez dodatkowego wywołania modelu |
| AC-9 | ręcznie: „dodaj psa Raj, golden retriever, ur. 2021-03-14, mikroczip 123" → pola w rekordzie |
| AC-10 | ręcznie: odpowiedź zawiera wyodrębnioną listę nieprzenoszalnych informacji |
| AC-11 | ręcznie: po przebiegu liczba i treść zadań w projekcie źródłowym bez zmian |
| AC-12 | test `toAnthropicSystem` (tabela z § 6.1) + kolumna „cache zapis/odczyt" w logu `AiCall` po realnym przebiegu |
| AC-13 | test: ostatnie wywołanie przebiegu nie oznacza bloku zmiennego |
| AC-14 | log `AiCall`: `dispatch_route` — tokeny wyjścia poniżej deklarowanego `maxTokens`, czas radykalnie niższy niż 15 s |
| AC-15 | test `classifyIntent`: długa wiadomość → `complex` **bez** wywołania modelu |
| AC-16 | **pomiar netto**: powtórzenie scenariusza „pies Raj", porównanie sumy `AiCall` z 1,36 zł; wymagane ≥ 50 % mniej |
| AC-17 | raport widoczny pod `/reports/asystent-koszt-tury-rozbicie` |
| AC-18 | przegląd diffu: zero zmian w `AiCostBadge`, `visibleUsage`, `costVisibility` |

## 9. Ryzyka techniczne i plan wycofania

- **Drugi punkt cięcia nie trafia w pamięć** (blok zmienny musi być identyczny co do znaku między
  wywołaniami). Mitygacja: prompt jest budowany **raz przed pętlą** i przekazywany bez modyfikacji —
  sprawdzamy to testem, a dowodem końcowym jest kolumna „cache odczyt" w logu, nie sam kod.
- **Większy budżet wyników podnosi koszt zamiast go obniżyć.** Mitygacja: kolejność prac (§ 1) i
  AC-16 jako pomiar netto. Jeśli pomiar wyjdzie gorzej — obniżamy `PER_TOOL_MAX_RECORDS` do wartości
  wynikającej z pomiaru i **aktualizujemy spec** (C-54), zamiast zostawiać rozjazd.
- **`effort:"none"` pogarsza trafność routingu modułów.** Mitygacja: `routeModules` przy każdej
  wątpliwości zwraca **pełny** katalog (`catch` → `allowed`), więc błąd degraduje koszt, nigdy
  poprawność. Zachowanie bez zmian.
- **Domknięcie „dokończ zadanie" proponuje plan na niepełnych danych.** Mitygacja: wymóg listy
  braków (AC-7) + plan i tak trafia do panelu potwierdzenia; akcje niszczące pozostają domyślnie
  odznaczone (bez zmian w `DESTRUCTIVE_ACTION_TYPES`).
- **Rollback:** czysto kodowy — wszystkie zmiany to logika bez migracji schematu. Wycofanie =
  `git revert` commitów. Migracja `0271` wstawia jeden wiersz `Report` z `ON CONFLICT DO NOTHING`,
  jest idempotentna i **nie wymaga wycofania** (brak DDL, brak zmian w istniejących danych) — zgodnie
  z runbookiem `docs/devops/runbook-deploy-rollback.md` rozdzielamy rollback kodu od migracji.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — jedna migracja, wyłącznie dane, ręcznie pisana, numer `0271` z
      `npm run next:migration`, idempotentna z dollar-quotingiem i globalnie unikalnym slugiem.
      Zero enumów (C-12), bo zero nowych kolumn. `grep -E "^(DROP|ALTER)"` po wygenerowaniu (C-15).
- [x] **C-20..C-25** — brak nowych Server Actions (nie ma czego rewalidować); guardy dostępu
      **niezmienione i nieposzerzone**, stronicowanie zmienia okno, nie zakres (C-21/C-17); każda
      zmieniona `AIAction` ma egzekutor i wpis w kontrakcie akcji (C-23); brak kasowania → C-24 nie
      dotyczy; brak zmian RBAC/konfiguracji → C-25 nie dotyczy.
- [x] **C-30..C-32** — zero hardcodowanych kolorów i zero zmian układu; nowe teksty UI przez `t()`
      z polskim jako źródłem, przy jawnym rozgraniczeniu „tekst UI vs. treść promptu".
- [x] **C-36** — granice modułów zachowane: platforma (`platform/ai`, `platform/llm`) **nie
      importuje** żadnego modułu; zmiany w Zadaniach i Zwierzętach żyją w `src/modules/<x>/` i
      importują własne wnętrze ścieżką względną.
- [x] **C-40** — dostawca i model nadal wyłącznie z `/admin/llm`; `effort:"none"` to deklaracja
      call-site'u o kształcie własnej odpowiedzi, nie wybór modelu (uzasadnienie w § 6.2).
- [x] **C-51** — wpis do `doświadczenia.md` jest pozycją w tabeli plików, nie dobrą chęcią.
- [x] **C-53 (minimalizm)** — świadomie sprawdzone: **zero nowych zależności**, zero nowych tras,
      zero nowych modeli, zero nowych wspólnych komponentów. Świadomie **odrzucone** jako nadmiarowe:
      nowe narzędzie `get_tasks` (wystarczy flaga na istniejącym), kursor zamiast `offset`
      (deterministyczna kolejność wystarcza), `offset` we wszystkich 56 narzędziach (refaktor bez
      zgłoszenia), własny mechanizm nadpisywania wysiłku (pole `ChatOptions.effort` istnieje od 033).
- [x] **C-54** — trzy ustalenia z rekonesansu naniesione na `spec.md` (§ 11).

## 11. Ustalenia z rekonesansu naniesione na spec (C-54)

1. **Znacznik „…(ucięto)" ze zrzutu zgłoszenia NIE pochodzi z narzędzi.** Powstaje w
   `AICommandSheet.tsx` przy składaniu zrzutu rozmowy (próg 4000 znaków) — to obcięcie **relacji dla
   developera**, nie danych, które widział model. Faktycznym ograniczeniem był `PER_TOOL_MAX_RECORDS
   = 12` po stronie kompaktowania kontekstu. Kierunek naprawy zostaje ten sam, ale przyczyna jest w
   innym pliku, niż sugerowało zgłoszenie.
2. **Strażnik pętli istnieje i nie on zatrzymał przebieg.** `unproductiveIterations >= 2` przerywa
   przy dwóch jałowych iteracjach; w sesji „pies Raj" **każda** iteracja przynosiła nowe dane, więc
   strażnik nigdy nie zadziałał — przebieg dobił do `MAX_ITERATIONS = 6`. Punkt (c) zgłoszenia
   („brak wyjścia z pętli") jest więc **spełniony**; brakowało nie strażnika, lecz **domknięcia
   wynikiem** (AC-6).
3. **Ścieżka, która kosztowała 30 groszy, już nie istnieje.** Od 099 tryb wskazywania elementu
   zapisuje zgłoszenie **natychmiast, bez pytania modelu**. Zgłoszenie zachowuje jednak pełną moc:
   wskazane przez nie nieoptymalności (pamięć podręczna, wysiłek w klasyfikacji, fast-path)
   obciążają **każdą zwykłą turę** i to je naprawiamy. Fakt ten ma trafić do odpowiedzi dla
   właściciela i do raportu z AC-17 — przemilczenie go byłoby nieuczciwe.
