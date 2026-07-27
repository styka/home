# Plan techniczny: Asystent — poziomy pracy, rzetelne koszty, dopracowany UX czatu i właściciele encji

- **Spec:** ./spec.md (034-asystent-poziomy-koszty-ux)
- **Status:** draft
- **Data:** 2026-07-27

> **Zasada planu:** to jest **JAK**. Wzorce bierzemy z istniejącego kodu: `LlmAssignment` +
> `/admin/llm` (konfiguracja modeli), `AssistantPref` + `assistantPrefs.ts` (ustawienia per
> użytkownik), `notes`/`shopping` (model współwłasności `ownerId`/`ownerTeamId`).

## 1. Podejście

Osiem zgłoszeń dzieli się na cztery obszary techniczne, które robimy w jednej gałęzi, ale rozdzielnie:
**(A) kontrakt akcji** (Z1) — rozszerzenie istniejącego rejestru `actionContract.ts` o komplet nazw
parametrów + nowa bramka w `check-action-coverage.js`; **(B) poziomy pracy** (Z2) — rozszerzenie
`LlmAssignment` o wymiar „poziom" (klucz złożony) i nowa tabela preferencji modelowych użytkownika,
z rozstrzyganiem w `resolver.ts`; **(C) UX okna czatu** (Z3–Z6) — punktowe poprawki w
`AICommandSheet.tsx`; **(D) koszty** (Z7) — cennik przeniesiony z kodu do bazy, pełne rozbicie tokenów
i wydzielenie komponentu prezentacji; **(E) właściciele** (Z8) — `ownerId`/`ownerTeamId` na
`NoteGroup`/`Tag` i `ownerId` na `ItemHistory` wg wzorca z `Note`/`ShoppingList`.

Wzorzec do naśladowania: `src/actions/notes.ts` + `assertNoteAccess` (własność), `LlmConfigPanel.tsx`
(edycja przypisań), `src/actions/assistantPrefs.ts` (preferencje per użytkownik).

## 2. Model danych (Prisma)

### 2.1 Poziomy pracy — `LlmAssignment` zyskuje wymiar poziomu

Dziś `LlmAssignment.operationType` jest kluczem głównym (jeden zestaw ustawień). Dokładamy kolumnę
`level` i zamieniamy klucz na **złożony**:

```prisma
model LlmAssignment {
  operationType String
  // 034: AssistantConfigLevel ("economy" | "standard" | "max") — String + union TS (C-12).
  level         String   @default("standard")
  providerId    String
  model         String?      // 034: null = dziedzicz z poziomu "standard"
  temperature   Float?
  maxTokens     Int?
  effort        String?
  updatedAt     DateTime @updatedAt

  provider LlmProvider @relation(fields: [providerId], references: [id], onDelete: Restrict)

  @@id([operationType, level])
  @@index([providerId])
}
```

Dziedziczenie (AC-4): wiersz poziomu `economy`/`max` z pustym `model`/`temperature`/`maxTokens`/
`effort` bierze wartość z wiersza `standard` dla tego samego `operationType`. Brak wiersza w ogóle =
pełne dziedziczenie. `providerId` pozostaje wymagany, gdy wiersz istnieje (bez dostawcy nie ma czego
wołać) — dlatego „dziedziczenie na poziomie wiersza" realizujemy przez **brak wiersza**, a
„dziedziczenie pola" przez `NULL` w kolumnie.

### 2.2 Własny poziom użytkownika — nowa tabela `UserLlmPref`

```prisma
model UserLlmPref {
  id            String   @id @default(cuid())
  userId        String
  operationType String
  providerId    String?  // snapshot bez FK — nieistniejący/wyłączony dostawca degraduje do poziomu standard
  model         String?
  effort        String?  // LlmEffort
  temperature   Float?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation("UserLlmPrefs", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, operationType])
  @@index([userId])
}
```

**Świadomie brak `maxTokens`** — limit odpowiedzi zostaje przy adminie (AC-7). `providerId` bez
relacji Prisma (jak `AiCall.userId`): kasowanie dostawcy przez admina nie może wysadzić zapisu
użytkownika, a `resolver` i tak sprawdza istnienie i `enabled` (AC-10).

`AssistantPref.level` (istniejąca kolumna `String`) przyjmuje dodatkowo `"custom"` — **bez zmiany
schematu**, tylko union TS: `AssistantLevel = "standard" | "economy" | "max" | "custom"`.

### 2.3 Cennik modeli — nowa tabela `LlmModelPrice`

```prisma
model LlmModelPrice {
  id             String   @id @default(cuid())
  modelPrefix    String   @unique   // dopasowanie po prefiksie, jak dziś w pricing.ts
  label          String?
  inputPer1M     Float
  outputPer1M    Float
  cacheReadMult  Float    @default(0.1)
  cacheWriteMult Float    @default(1.25)
  updatedAt      DateTime @updatedAt
}
```

Seed migracją z dzisiejszej tablicy w `src/lib/llm/pricing.ts` (`ON CONFLICT DO NOTHING`, C-14), więc
po wdrożeniu kwoty są identyczne jak przed nim.

### 2.4 Właściciele encji

```prisma
model NoteGroup { …; ownerId String?; ownerTeamId String?;  @@index([ownerId]) @@index([ownerTeamId]) }
model Tag       { …; ownerId String?; ownerTeamId String?;  @@unique([ownerId, name]) @@index([ownerTeamId]) }
model ItemHistory { …; ownerId String?;                      @@unique([ownerId, name]) @@index([ownerId]) }
```

- `Tag.name @unique` i `ItemHistory.name @unique` **znikają** (globalna unikalność nazwy blokowałaby
  drugiego użytkownika) i zastępuje je klucz złożony z właścicielem. `ItemHistory` jest
  upsertowany po nazwie (`items.ts`, `shoppingSync.ts`) — te wywołania przechodzą na klucz złożony
  `ownerId_name`.
- `ownerId`/`ownerTeamId` **nullowalne**: `NULL/NULL` = rekord systemowy, wspólny (AC-24).
- FK do `User`/`Team` z `onDelete: SetNull` (rekord po skasowanym koncie staje się systemowy, nie
  znika razem z notatkami innych).
- `ItemHistory` bez `ownerTeamId` — to prywatna historia podpowiedzi zakupowych, nie słownik zespołu
  (wzorzec: `Store` jest user-only). Odnotowane jako decyzja planu.

### 2.5 Migracja (C-10, C-11)

- Numer z `npm run next:migration`: **0212**, katalog `prisma/migrations/0212_levels_prices_owners/`.
- Jeden plik, w kolejności: (1) `LlmAssignment` — `ADD COLUMN "level"`, `DROP CONSTRAINT` starego PK,
  `ADD PRIMARY KEY ("operationType","level")`, `ALTER COLUMN "model" DROP NOT NULL`; (2) seed wierszy
  poziomów odtwarzający **dzisiejsze zachowanie**: `economy` = provider/model/effort z dzisiejszego
  przypisania `dispatch` dla każdego typu operacji (dziś `effectiveOperation()` przekierowywał tryb
  oszczędny na `dispatch`), `max` = kopia `standard` z wysiłkiem podniesionym o stopień (dziś
  `boostEffort`); (3) `CREATE TABLE "UserLlmPref"`; (4) `CREATE TABLE "LlmModelPrice"` + seed
  cennika; (5) kolumny właścicieli + indeksy + FK; (6) backfill właścicieli na konto administratora;
  (7) podmiana unikalności `Tag.name` / `ItemHistory.name` na klucze złożone.
- Wszystko idempotentnie: `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`, `ON CONFLICT DO NOTHING`, a operacje na
  kluczach opakowane w `DO $$ … $$` z `IF EXISTS` na `pg_constraint`.
- Backfill administratora (AC-22) jednym podzapytaniem, bez zgadywania e-maila:

```sql
UPDATE "NoteGroup" SET "ownerId" = (
  SELECT ur."userId" FROM "UserRole" ur
  JOIN "RolePermission" rp ON rp."role" = ur."role"
  JOIN "Permission" p ON p."id" = rp."permissionId" AND p."slug" = 'module.admin'
  ORDER BY ur."createdAt" ASC LIMIT 1
) WHERE "ownerId" IS NULL AND "ownerTeamId" IS NULL;
```

Gdy w bazie nie ma jeszcze administratora (świeża instalacja), podzapytanie zwraca `NULL` — rekordy
zostają systemowe i nic się nie psuje.

## 3. Warstwa serwera (Server Actions — C-20)

| Plik | Zmiana |
|------|--------|
| `src/actions/llmConfig.ts` | `AssignmentDTO` + `level`; `getAssignments()` zwraca komplet 3 poziomów z informacją o dziedziczeniu; `setAssignment({ operationType, level, … })` waliduje poziom, effort, `temperature ∈ [0,2]`, `maxTokens ∈ [1,32000]` **przed** upsertem i loguje do `AuditLog` z poziomem w opisie (C-25). Nowe: `getModelPrices()` / `setModelPrice()` / `deleteModelPrice()` — też z `AuditLog` (kategoria `config`). |
| `src/actions/assistantPrefs.ts` | `getAssistantPrefs()` dokłada `custom` (lista wpisów `UserLlmPref` + katalog modeli dopuszczonych przez admina); `updateAssistantPrefs` przyjmuje `level: "custom"`; nowa `updateUserLlmPref({ operationType, providerId, model, effort, temperature })` i `resetUserLlmPrefs()`. Walidacja: model **musi** występować w katalogu admina (AC-7), `maxTokens` nieprzyjmowany w ogóle. `revalidatePath("/")`. |
| `src/actions/noteGroups.ts` | `getNoteGroups()` filtruje `OR: [{ownerId}, {ownerTeamId: {in: teamIds}}, {ownerId: null, ownerTeamId: null}]`; `create` ustawia `ownerId`; `update`/`delete` przez nowy guard `assertNoteGroupAccess`. |
| `src/actions/tags.ts` | analogicznie + guard `assertTagAccess`; `createTag` ustawia właściciela; nazwa unikalna w obrębie właściciela. |
| `src/actions/items.ts`, `src/actions/shoppingSync.ts` | `itemHistory.upsert` na kluczu `ownerId_name`; odczyt podpowiedzi filtrowany po `ownerId`. |
| `src/actions/privacy.ts` | eksport danych obejmuje grupy/etykiety/podpowiedzi po właścicielu, nie po relacji z notatkami. |
| `src/lib/ai/executors/notesExecutor.ts` | wyszukiwanie grupy notatek scoped do właściciela (AC-25). |
| `src/lib/ai/action-coverage.json` | `noteGroups:*`, `tags:*`, `items:getItemHistory` przechodzą z `access: "shared"` na `"owner"`; nowe akcje (`llmConfig:*Price`, `assistantPrefs:updateUserLlmPref`, `resetUserLlmPrefs`) dostają wpisy `status`/`access` (bez tego `check:ai-coverage` wywali build). |

Guardy (C-21) piszemy w `src/lib/server-utils.ts` obok istniejących, wzorowane na `assertNoteAccess`:
rekord systemowy (`ownerId=null, ownerTeamId=null`) jest **czytelny dla każdego zalogowanego**, ale
edytowalny/kasowalny wyłącznie przez administratora.

## 4. RBAC / rejestr modułu (C-22)

Bez nowego sluga i bez zmian w `modules.tsx`/`ModuleSidebar`. Konfiguracja poziomów i cennika siedzi
w istniejącym `/admin/llm` (`module.admin`), ustawienia własnego poziomu — w panelu ustawień
asystenta, dostępnym dla każdego zalogowanego (jak dzisiejsze „Stałe preferencje").

## 5. Rozstrzyganie modelu (C-40)

`src/lib/llm/resolver.ts`:

```ts
resolveLlmChain(op, opts?: { level?: AssistantLevel; userId?: string })
```

1. `level === "custom"` + `userId` → `UserLlmPref` dla `op`; brakujące pola i `maxTokens` uzupełnia
   wiersz `standard`; nieistniejący/wyłączony dostawca → cichy zjazd na `standard` (AC-10).
2. Poziom `economy`/`standard`/`max` → wiersz `(op, level)`, pola `NULL` uzupełniane z `(op, "standard")`.
3. Dalej bez zmian: fallback Groq + lżejszy model dla `reasoning`.

`src/lib/llm/chat.ts`: `ChatOptions` zyskuje `level?: AssistantLevel` i przekazuje je do resolvera.
**Usuwamy** `boostEffort` z `ChatOptions` oraz `effectiveOperation()`/`shouldBoostEffort()` z
`operationTypes.ts` — po tej zmianie o wysiłku i modelu decyduje konfiguracja poziomu, a nie ukryta
reguła w kodzie (dawne zachowanie odtwarza seed z §2.5, więc nic się nie zmienia dla użytkownika).
`src/app/api/llm/home/agent/route.ts` i `src/lib/ai/fastPath.ts` przekazują `level` zamiast
`boostEffort`; skrót „prosty odczyt → `dispatch`" zostaje, ale nie stosuje się przy poziomie `max`
(jak dziś). To jest zmiana w `plan.md` względem dotychczasowego kodu — świadoma i odnotowana (C-54).

## 6. Koszty (Z7)

**Diagnoza (potwierdzona w kodzie).** `estimateCostUsd()` wlicza `cacheReadTokens` i
`cacheWriteTokens` (mnożniki 0,1× i 1,25× ceny wejścia), ale rozbicie w `CostChip` pokazuje wyłącznie
`prompt+completion`. Dla wywołania `agent` z przykładu zgłoszenia: 181 wejścia + 125 wyjścia daje
$0,0008, a pokazane $0,0090 to efekt ok. 6,5 tys. tokenów **zapisu do cache promptu**, których UI w
ogóle nie wypisuje. Kwota była więc policzona dobrze, ale **nie dało się jej zweryfikować z tego, co
widać** — i to naprawiamy (AC-17/AC-18).

Zmiany:
- `src/lib/llm/pricing.ts` — cennik z bazy: `ensurePricesLoaded()` (async, cache w module z TTL 60 s,
  wołany w `chatComplete`/`chatStream`, które i tak idą do bazy po konfigurację) + zachowana statyczna
  tablica jako wartość startowa/awaryjna. Nowe `estimateCost(usage, model)` zwraca
  `{ usd, known, parts: { input, output, cacheRead, cacheWrite } }`; `estimateCostUsd` zostaje cienką
  nakładką (nie ruszamy wszystkich wywołań).
- `src/lib/ai/usage.ts` — `UsageCall` dostaje `cacheReadTokens`, `cacheWriteTokens`, `costKnown` i
  `operationType`; `accrueUsage` je wypełnia. `UsageMeter` dostaje `costKnown` (fałsz, gdy choć jedno
  wywołanie miało model spoza cennika).
- **Nowy komponent** `src/components/ui/AiCostBadge.tsx` (`AiCostBadge` + `AiCostBreakdown`) —
  przenosimy tam dzisiejszy `CostChip` z `AICommandSheet.tsx`, z propsem `{ usage: UsageMeter; rate }`
  bez żadnej wiedzy o asystencie (AC-21). W tym wdrożeniu używa go **wyłącznie** asystent.
- Rozbicie pokazuje na wywołanie: model, `wejście / wyjście / zapis do cache / odczyt z cache` i kwotę;
  model spoza cennika → „koszt nieznany" zamiast „—"/zera (AC-19).
- `/admin/llm` dostaje sekcję **Cennik modeli** (tabela `LlmModelPrice`, dodaj/edytuj/usuń).
- Wpływ effort/temperature na cenę (AC-20): **temperatura nie zmienia ceny jednostkowej**; **wysiłek
  nie zmienia ceny za token, ale zwiększa liczbę tokenów wyjścia** (Anthropic rozlicza tokeny myślenia
  jako wyjściowe i raportuje je w `output_tokens`; rodziny OpenAI-reasoning w `completion_tokens`) —
  czyli koszt już to uwzględnia. To samo dotyczy poziomów pracy: zmieniają model/wysiłek, a nie
  cennik. Zapisujemy to w komentarzu w `pricing.ts` i w opisie sekcji cennika.

## 7. UX okna czatu (Z3–Z6) — `src/components/home/AICommandSheet.tsx`

- **Z3 (kursor nad menu).** Przyczyna: przyciski kompozytora mają `onPointerDown` +
  `preventDefault` (`keepKeyboardOpen`), żeby nie chować klawiatury — fokus **zostaje w polu
  tekstowym**, więc przeglądarka rysuje karetkę (na iOS w warstwie kompozytora systemu, ponad HTML).
  Podbijanie `z-index` tego nie naprawi. Rozwiązanie: gdy menu poziomu jest otwarte, pole dostaje
  `caretColor: "transparent"` (fokus i klawiatura zostają, karetka znika). Zamknięcie menu przywraca
  `var(--accent-blue)`.
- **Z4 (kursor na końcu draftu).** W efekcie autofokusu po `ta.focus()` dokładamy
  `ta.setSelectionRange(len, len)`; to samo po wczytaniu rozmowy z draftem (`loadConversation`
  ustawia `inputText`, więc kursor przesuwamy w `useEffect` zależnym od wczytanego wątku).
- **Z5 (ikony nagłówka).** Trzy niezależne flagi (`showPrefs`, `showReport`, `showHistory`) zamieniamy
  na jeden stan `headerPanel: "none" | "prefs" | "report" | "history"` z funkcją `togglePanel(p)`.
  Skutki: ponowny klik zamyka (AC-13), otwarcie jednej zamyka pozostałe (AC-14), historia przestaje
  mieć pozycję „Nowa rozmowa" (jest ikona `+`) i zamyka się klikiem w ikonę historii (AC-15).
  `Esc` domyka najpierw panel, potem cały arkusz.
- **Z6 (mobile).** Skrót „wróć do poprzedniej rozmowy" wychodzi z rzędu ikon i ląduje **we własnym,
  pełnoszerokościowym wierszu pod nagłówkiem** (widoczny tylko przy pustym wątku, jak dziś), z
  `minWidth: 0` + `textOverflow: ellipsis`; rząd ikon dostaje `flexShrink: 0`, a nagłówek
  `minWidth: 0`. Znika konkurencja o szerokość i poziome przewijanie (AC-16).

## 8. Kontrakt akcji (Z1)

**Ustalenie z implementacji (C-54).** `groupName` **nie występuje w katalogu akcji** — katalog notatek
zna tylko `create_note { title, content? }`. Parametr został **wymyślony przez model**, bo nie miał
czym wyrazić prośby „dodaj notatkę do grupy"; executor go ignorował, więc notatka lądowała poza grupą.
Wniosek: sama bramka statyczna nie domyka AC-1, bo nie zna parametrów wymyślonych. Robimy trzy rzeczy:

1. **Uzupełnienie katalogu i executora** — `create_note` i `update_note` przyjmują `groupName?`
   (rozwiązywane po nazwie w zakresie właściciela, jak `projectName` w zadaniach). To naprawia
   funkcję, nie tylko etykietę (AC-2c).
2. **Runtime fallback** — `fieldSpec()` dla klucza, którego kontrakt nie zna i którego nie ma w
   `PARAM_LABELS`, zwraca `control: "hidden"` zamiast surowej nazwy technicznej. Użytkownik nigdy nie
   zobaczy identyfikatora z kodu, nawet gdy model wymyśli nowy parametr (AC-2b).
3. **Etykiety** — uzupełniamy `PARAM_LABELS` o wszystkie brakujące nazwy z katalogu (13 pozycji:
   `bookToPortfel`, `breed`, `days`, `daysOfWeek`, `durationMin`, `freqType`, `goalName`, `horizon`,
   `leaning`, `priority`, `rawText`, `specialty`, `timesOfDay`) + `groupName`.
- `scripts/check-action-coverage.js` — nowa bramka: parsujemy sygnatury z `ACTION_CATALOG_BY_MODULE`
  (`- <akcja> { p1, p2?, p3:"A"|"B" }`) oraz z `petActions.ts`, wyciągamy nazwy parametrów i żądamy,
  by każda była opisana w `PARAM_LABELS` **albo** w `fields` kontraktu danej akcji. Wyjątki: nazwy
  kończące się na `Id` (i tak ukrywane w panelu) oraz `openAfter`/`searchQuery` (metaparametry
  opisane osobno). Brak opisu = błąd builda z listą nazw i podpowiedzią (AC-2).

## 9. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0212_levels_prices_owners/migration.sql` | nowy | poziomy, `UserLlmPref`, cennik, właściciele + backfill |
| `prisma/schema.prisma` | edycja | modele wg §2 |
| `src/lib/llm/effort.ts` | edycja | eksport typu poziomu konfiguracji + pomocnicze etykiety |
| `src/lib/llm/operationTypes.ts` | edycja | usunięcie `effectiveOperation`/`shouldBoostEffort`, typ `AssistantLevel` z `custom` |
| `src/lib/llm/resolver.ts` | edycja | rozstrzyganie per poziom + własny poziom użytkownika |
| `src/lib/llm/chat.ts` | edycja | `level` w `ChatOptions`, `ensurePricesLoaded()` |
| `src/lib/llm/pricing.ts` | edycja | cennik z bazy + `estimateCost` z rozbiciem |
| `src/lib/ai/usage.ts` | edycja | rozbicie tokenów cache + `costKnown` |
| `src/components/ui/AiCostBadge.tsx` | nowy | wielokrotnego użytku prezentacja kosztu |
| `src/components/home/AICommandSheet.tsx` | edycja | Z3–Z6 + użycie `AiCostBadge` |
| `src/components/home/AssistantLevelSettings.tsx` | nowy | własny poziom użytkownika (suwaki, wybór modelu) |
| `src/components/admin/LlmConfigPanel.tsx` | edycja | zakładki poziomów + sekcja cennika |
| `src/actions/llmConfig.ts` | edycja | poziomy + CRUD cennika + audyt |
| `src/actions/assistantPrefs.ts` | edycja | poziom `custom` + `UserLlmPref` |
| `src/actions/{noteGroups,tags,items,shoppingSync,privacy}.ts` | edycja | własność danych |
| `src/lib/server-utils.ts` | edycja | `assertNoteGroupAccess`, `assertTagAccess` |
| `src/lib/ai/executors/notesExecutor.ts` | edycja | wyszukiwanie grupy w zakresie właściciela |
| `src/lib/ai/actionContract.ts` | edycja | komplet etykiet parametrów |
| `scripts/check-action-coverage.js` | edycja | bramka kompletności etykiet parametrów |
| `src/lib/ai/action-coverage.json` | edycja | nowe akcje + zmiana `shared` → `owner` |
| `src/app/api/llm/home/agent/route.ts`, `src/lib/ai/fastPath.ts` | edycja | przekazanie poziomu |
| `src/components/admin/AiCallsPage.tsx`, `src/lib/ai/aiCallLog.ts` | edycja | kolumny tokenów cache w diagnostyce |
| `docs/ai/kontrola-dostepu.md`, `docs/ai/pokrycie-akcji.md` | regeneracja | `npm run check:ai-coverage -- --report` |
| `CLAUDE.md`, `doświadczenia.md` | edycja | aktualizacja konwencji + lekcje (C-51) |

## 10. Bramki i weryfikacja (C-50)

- Lokalny Postgres 16 (`pg_ctlcluster 16 main start`, rola/baza `omnia/omnia_dev`), `.env.local` +
  eksport zmiennych, `npx prisma migrate deploy` — **nigdy prod DB (C-13)**.
- `npm run check:migrations`, `npm run check:actions`, `npm run check:ai-coverage`, `npx next lint`,
  `npx next build` (bez `scripts/migrate.js`).
- Mapowanie AC → weryfikacja: AC-1/AC-2 → bramka + celowa sabotaż-próba (usunięcie etykiety musi
  wywalić build); AC-3…AC-5 → skrypt na lokalnej bazie (zapis 3 poziomów, odczyt przez `resolveLlmChain`,
  wpis w `AuditLog`); AC-6…AC-10 → skrypt: zapis `UserLlmPref`, rozstrzygnięcie, symulacja usunięcia
  dostawcy; AC-11…AC-16 → inspekcja kodu + kryteria obserwowalne opisane w `verify.md` (brak testów
  wizualnych w repo); AC-17…AC-21 → test liczbowy: te same tokeny co w zgłoszeniu muszą dać kwoty
  wyliczalne ręcznie z cennika; AC-22…AC-26 → migracja na lokalnej bazie z danymi testowymi + `--report`.

## 11. Ryzyka techniczne i plan wycofania

- **Zmiana klucza głównego `LlmAssignment`** — najgroźniejszy krok migracji. Mitygacja: `DO $$` z
  `IF EXISTS`, brak `DROP TABLE`, kolumna `level` z domyślnym `standard` (istniejące wiersze stają się
  poziomem standardowym bez utraty danych). Rollback: migracja odwrotna przywracająca PK po
  `operationType` (dane poziomów `economy`/`max` do skasowania).
- **Podmiana unikalności `Tag.name`/`ItemHistory.name`** — jeśli w bazie istnieją duplikaty nazw po
  przypisaniu właściciela, `CREATE UNIQUE INDEX` padnie. Dziś nazwy są globalnie unikalne, więc po
  backfillu na jednego administratora duplikatów być nie może; mimo to indeks tworzymy **po** backfillu.
- **Cennik z bazy** — pusta tabela wyzerowałaby koszty. Mitygacja: seed w migracji + statyczna tablica
  jako wartość awaryjna w kodzie, gdy odczyt zawiedzie.
- **Usunięcie `effectiveOperation`/`boostEffort`** — ryzyko cichej zmiany zachowania dla użytkownika
  z poziomem `economy`/`max`. Mitygacja: seed wierszy poziomów odtwarzający dotychczasowe działanie
  (§2.5 pkt 2) + weryfikacja przez `resolveLlmChain` na lokalnej bazie.
- **`caretColor: transparent`** — gdyby okazało się niewystarczające na iOS, zapasowo przy otwartym
  menu ustawiamy `readOnly` na polu (klawiatura zostaje, karetka znika). Zapisujemy w `verify.md`.
- Rollback ogólny: kod cofalny commitem; migracja — zgodnie z `docs/devops/runbook-deploy-rollback.md`
  (kolumny nullowalne i nowe tabele są bezpieczne do zostawienia po cofnięciu kodu).

## 12. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczna, idempotentna migracja 0212; `String`+union zamiast enumów; seed
      dollar-quoting/`ON CONFLICT`; weryfikacja wyłącznie na lokalnym Postgresie.
- [x] **C-20..C-25** — mutacje jako Server Actions z `revalidatePath`; własność `ownerId`/`ownerTeamId`
      z guardami; brak nowych `AIAction` (kontrakt tylko uzupełniany); zmiany konfiguracji do `AuditLog`.
- [x] **C-30..C-32** — nowe kontrolki (suwaki, zakładki poziomów, rozbicie kosztu) wyłącznie na
      zmiennych CSS; poprawki nagłówka i kompozytora celują w telefon; wszystkie teksty po polsku.
- [x] **C-40** — model nadal wybiera admin; własny poziom użytkownika ogranicza się do modeli z jego
      katalogu, a nie do dowolnego stringa.
- [x] **C-53** — rozszerzamy istniejące byty (`LlmAssignment`, `actionContract`, `CostChip`) zamiast
      budować równoległe; jedyne nowe tabele to te, bez których nie da się spełnić AC.
