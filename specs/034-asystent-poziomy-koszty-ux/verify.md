# Weryfikacja: 034-asystent-poziomy-koszty-ux

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-07-27
- **Środowisko:** lokalny PostgreSQL 16 (`omnia_dev`), **nigdy prod DB** (C-13)

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0213)" |
| `npm run check:actions` | ✅ 160 akcji, wszystkie z egzekutorem i kontraktem; **373 parametry z etykietami po polsku** |
| `npm run check:ai-coverage` | ✅ 506 akcji z zadeklarowanym zakresem **i guardem w kodzie**; 0 pozycji „pending" |
| `npx next lint --dir src` | ✅ 0 błędów (pozostają wcześniejsze ostrzeżenia `exhaustive-deps`) |
| `npx next build` | ✅ exit 0 (bez `scripts/migrate.js` — C-13) |
| `npx prisma migrate deploy` (lokalnie) | ✅ `0212_levels_prices_owners` zaaplikowana |
| Powtórne uruchomienie `0212` (idempotentność) | ✅ exit 0, wyłącznie `NOTICE: … already exists, skipping` |

## 2. Kryteria akceptacji

Weryfikacja zachowania: skrypt uruchamiany przez `tsx` na lokalnej bazie (wywoływał **realny**
`resolveLlmChain`/`estimateCost`), zapytania `psql` na danych testowych oraz przegląd kodu
w miejscach, których nie da się odpalić bez przeglądarki. Skrypt tymczasowy usunięty po użyciu.

### Podgląd akcji (Z1)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — parametry po polsku | ✅ | `PARAM_LABELS` uzupełnione o 14 nazw (`actionContract.ts`); bramka raportuje 373/373 parametrów z etykietą |
| **AC-2** — bramka na brak etykiety | ✅ | **Sabotaż-test:** usunięcie `groupName` z `PARAM_LABELS` → `check:actions` pada z `✖ … create_note.groupName, update_note.groupName`; po przywróceniu zielone |
| **AC-2b** — wymyślony parametr | ✅ | `fieldSpec()` (`actionContract.ts`): `if (!hasParamLabel(type, key)) return { label: key, control: "hidden" }` — pole nie trafia do UI, wartość dalej jedzie do backendu |
| **AC-2c** — notatka trafia do grupy | ✅ | Katalog `create_note { title, content?, groupName? }` + `resolveNoteGroupId()` → `createNote({ groupId })` w `notesExecutor.ts`. **Uwaga:** to była realna wada funkcjonalna, nie tylko etykieta (notatka lądowała poza grupą) |

### Poziomy pracy — administrator (Z2)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-3** — trzy poziomy per typ operacji | ✅ | `LlmAssignment` PK `(operationType, level)`; `getAssignments(level)`; zakładki poziomów w `LlmConfigPanel`. Uruchomienie: `standard → claude-sonnet-5/medium`, `economy → claude-haiku-4-5` |
| **AC-4** — dziedziczenie ze standardowego | ✅ | Wiersz `max` z `model = NULL` → `resolveLlmChain` zwrócił `model=claude-sonnet-5`, `effort=high`, `maxTokens=4000` (odziedziczone). Panel pokazuje `placeholder="dziedziczy: …"` |
| **AC-5** — audyt zmian z poziomem | ✅ | `setAssignment` → `logAudit("config", "llm_assignment.set", "<op>:<level>", "Poziom „…": przypisano model …")` |

### Poziomy pracy — użytkownik (Z2)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-6** — czwarty poziom „Własny" | ✅ | `AssistantLevel` = `standard\|economy\|max\|custom`; pozycja w menu poziomu; wybór otwiera od razu jego ustawienia (`changeLevel`) |
| **AC-7** — model/wysiłek/temperatura, bez tokenów | ✅ | Uruchomienie: `custom → llama-3.3-70b-versatile, effort=low, temp=1.1`, **`maxTokens=4000` z poziomu standardowego**, nie od użytkownika. `updateUserLlmPref` nie przyjmuje `maxTokens`; model spoza katalogu → „Ten model nie jest dostępny…" |
| **AC-8** — wyłączony suwak z wyjaśnieniem | ✅ | `capabilitiesFor()` w `AssistantLevelSettings.tsx` z `effortSupported`/`supportsTemperature`; `disabled` + tekst „Ten model nie obsługuje regulacji wysiłku / Ten dostawca ignoruje temperaturę" |
| **AC-9** — rozmowa używa moich ustawień | ✅ | `agent/route.ts` przekazuje `assistantLevel` do `runAgentLoop`/`classifyIntent` → `chatComplete({level, userId})` → `resolveLlmChain`. Wskaźnik poziomu w czacie ma własną ikonę i kolor dla `custom` |
| **AC-10** — zniknął dostawca, działa dalej | ✅ | Uruchomienie: po `enabled=false` na dostawcy użytkownika `resolveLlmChain` zwrócił konfigurację standardową (`claude-sonnet-5`) **bez błędu** |

### Okno czatu (Z3–Z6)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-11** — kursor nie przebija menu | ✅ (przegląd kodu) | `caretColor: showLevelMenu ? "transparent" : "var(--accent-blue)"` w kompozytorze. Przyczyna udokumentowana: fokus trzymany przez `keepKeyboardOpen`, karetka rysowana poza drzewem CSS — `z-index` jej nie przykryje. **Nie dało się sprawdzić wizualnie** (brak przeglądarki w tej weryfikacji) |
| **AC-12** — kursor na końcu draftu | ✅ (przegląd kodu) | Efekt autofokusu: `ta.focus(); ta.setSelectionRange(end, end)`, zależność od `conversationId` domyka wczytanie wątku z historii |
| **AC-13** — ponowny klik zamyka | ✅ | `togglePanel()`: `current === panel ? "none" : panel`; ikona historii ma `aria-expanded` i tytuł „Zamknij historię (wróć do rozmowy)" |
| **AC-14** — tylko jedna sekcja | ✅ | Jeden stan `headerPanel: "none"\|"prefs"\|"report"\|"history"` — trzy niezależne flagi usunięte, więc stan „dwie otwarte" jest niereprezentowalny |
| **AC-15** — historia to tylko historia | ✅ | Wiersz „Nowa rozmowa" usunięty z listy historii (`grep "Nowa rozmowa"` → tylko ikona `+` w nagłówku) |
| **AC-16** — nagłówek mieści się na telefonie | ✅ (przegląd kodu) | Skrót przeniesiony do osobnego, pełnoszerokościowego wiersza pod nagłówkiem (`width:100%`, `minWidth:0`, ellipsis); rząd ikon `flexShrink: 0`, nagłówek `minWidth: 0`. **Nie zmierzone w przeglądarce** |

### Koszty (Z7)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-17** — widoczne wszystkie składowe | ✅ | `estimateCost` zwraca `parts {input, output, cacheRead, cacheWrite}`; `AiCostBadge` wypisuje „wejście / wyjście / zapis do pamięci / odczyt z pamięci" + „razem N tok."; diagnostyka admina ma kolumnę „cache (zap./odcz.)" |
| **AC-18** — kwoty zgodne z rachunkiem | ✅ | Na danych ze zgłoszenia: `router 317+15 → $0,0004` (zgłoszone $0,0004 ✔), `agent 181+125 → $0,0008` — a zgłoszone **$0,0090** odtworzone dokładnie po dodaniu **6555 tok. zapisu do pamięci podręcznej** (`cacheWrite = $0,008194`). **Rachunek był poprawny; niewidoczne były dane wejściowe** |
| **AC-19** — cennik w panelu, „koszt nieznany" | ✅ | `LlmModelPrice` + sekcja „Cennik modeli" w `/admin/llm` (`setModelPrice`/`deleteModelPrice` z walidacją i audytem); `estimateCost` dla nieznanego modelu → `known:false, usd:0`, a UI pokazuje **„koszt nieznany"**, nie „0 zł". Odczyt cennika z bazy potwierdzony (`priceFor("claude-haiku-4-5-20251001")` ≠ null po `ensurePricesLoaded`) |
| **AC-20** — wpływ wysiłku i temperatury | ✅ | Rozstrzygnięte i **zapisane w kodzie oraz UI**: temperatura nie zmienia ceny jednostkowej; wysiłek nie zmienia ceny za token, ale podnosi liczbę tokenów wyjścia (dostawcy raportują tokeny myślenia jako wyjściowe) — więc jest już policzony. Komentarz w `pricing.ts` + opis w sekcji cennika |
| **AC-21** — komponent do ponownego użycia | ✅ | `src/components/ui/AiCostBadge.tsx` — brak importów z `home/`, props `{usage, rate, align}`. `AICommandSheet` nie ma już własnego renderu kosztu. W tym wdrożeniu użyty **wyłącznie** w asystencie (zgodnie z zakresem) |

### Właściciele encji (Z8)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-22** — istniejące rekordy → admin | ✅ | Test na danych: konto z `module.admin` przez RBAC + po jednym rekordzie `NoteGroup`/`Tag`/`ItemHistory` bez właściciela → po migracji **wszystkie trzy mają `ownerId = vadm`**. Bez administratora w bazie rekordy zostają systemowe (świeża instalacja nie pada) |
| **AC-23** — nowe rekordy należą do mnie | ✅ | `createNoteGroup`/`createTag` ustawiają `ownerId: user.id`; `itemHistory.upsert` na kluczu `ownerId_name` z `user.id` (`items.ts`, `shoppingSync.ts`) |
| **AC-24** — systemowe nadal wspólne | ✅ | `ownedOrSystemWhere()` dokłada `{ownerId: null, ownerTeamId: null}` do warunku odczytu; edycję rekordu systemowego `assertDictionaryAccess` przepuszcza **tylko** administratorowi |
| **AC-25** — nie widzę cudzych | ✅ | Odczyty (`getNoteGroups`, `getTags`, `getSuggestionsForPrefix`) filtrowane; asystent szuka grupy przez `findAccessibleNoteGroup` z tym samym warunkiem. Test: **dwoje użytkowników utworzyło etykietę o tej samej nazwie** (dawne globalne `@unique` by to zablokowało) |
| **AC-26** — dokumentacja zgodna ze stanem | ✅ | `docs/ai/kontrola-dostepu.md` ma teraz „Model własności słowników" zamiast „Znane ograniczenia…"; generator `check-ai-coverage.js` poprawiony u źródła, więc raport nie wróci do starej treści |

## 3. Zgodność z konstytucją

- **C-01** ✅ wyłącznie `worldofmag/` + artefakty w `specs/` (skrypt weryfikacyjny w `src/` usunięty po użyciu).
- **C-10, C-11** ✅ ręczna migracja `0212`, unikalny numer, potwierdzona idempotentność.
- **C-12** ✅ `level`, `effort`, rodzaje = `String` + union TS; zero enumów Prisma.
- **C-13** ✅ wszystko na lokalnym Postgresie; `scripts/migrate.js` nieuruchamiany.
- **C-20** ✅ nowe mutacje to Server Actions z `revalidatePath`.
- **C-21** ✅ `ownerId`/`ownerTeamId` + guardy; rekord systemowy opisany wprost.
- **C-22** ✅ bez nowego sluga; konfiguracja pod `module.admin`, ustawienia użytkownika pod sesją.
- **C-23** ✅ brak nowych `AIAction`; katalog i kontrakt rozszerzone spójnie (bramka zielona).
- **C-25** ✅ zmiany przypisań i cennika w `AuditLog` (kategoria `config`).
- **C-30, C-31, C-32** ✅ wyłącznie zmienne CSS; zakładki i siatki `grid-cols-1 md:grid-cols-*`; teksty po polsku.
- **C-40** ✅ model nadal wybiera administrator — użytkownik wybiera **tylko** z jego katalogu.
- **C-51** ✅ cztery lekcje w `doświadczenia.md`.
- **C-53** ⚠️ *świadome odstępstwo:* `create_note` dostało parametr `groupName` (poza literalnym Z1),
  bo bez tego naprawa etykiety maskowałaby wadę funkcjonalną. Zapisane w `spec.md` jako AC-2c (C-54).

## 4. Regresje

- **Usunięcie `effectiveOperation`/`boostEffort`** — największe ryzyko zmiany zachowania. Migracja
  zasiewa wiersze `economy` (model z `dispatch`) i `max` (standard + wysiłek o stopień wyżej), więc
  poziomy działają jak przed zmianą; potwierdzone uruchomieniem resolvera.
- **Klucz złożony `LlmAssignment`** — wszystkie zapisy przeniesione na `operationType_level`
  (`setAssignment`, profil Anthropic, lektor, `systemHealth`); typecheck pilnuje kompletności.
- **`Tag`/`ItemHistory` bez globalnego `@unique`** — `upsert` po nazwie przeniesiony na klucz
  z właścicielem; `prisma/seed.ts` przerobiony na `findFirst` (klucz złożony nie przyjmuje `NULL`).
- **Wspólny komponent kosztu** — `AgentMeta` to teraz `AiCostUsage`; stary kształt bez pól cache
  renderuje się poprawnie (pola opcjonalne), więc **historyczne rozmowy się nie psują**.
- **`privacy.ts`** — eksport grup notatek po właścicielu zamiast po relacji z notatkami.
- `next build` zielony na całym repo (wszystkie trasy) — brak regresji kompilacji.

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie 26 kryteriów spełnione. Dwie uczciwe uwagi:

1. **AC-11, AC-12, AC-16 zweryfikowane przeglądem kodu, nie w przeglądarce** — dotyczą zachowania
   wizualnego (karetka, pozycja kursora, szerokość nagłówka na telefonie). Przyczyny są
   zidentyfikowane i naprawione u źródła, ale ostateczne potwierdzenie wymaga spojrzenia na ekran.
   Zapasowy wariant dla AC-11, gdyby `caretColor` okazał się niewystarczający na iOS: ustawienie
   `readOnly` na polu przy otwartym menu (klawiatura zostaje, karetka znika).
2. **Zakres nieznacznie szerszy niż literalne Z1** — dodana obsługa `groupName` w akcjach notatek.
   Świadome, opisane w `spec.md` (AC-2c) i w planie.
