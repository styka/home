# Zadania: Asystent — poziomy pracy, rzetelne koszty, dopracowany UX czatu i właściciele encji

- **Plan:** ./plan.md (034-asystent-poziomy-koszty-ux)
- **Status:** todo
- **Data:** 2026-07-27

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami
> (UX bez schematu → migracja → serwer → UI → bramki). Każde zadanie małe, samodzielne, weryfikowalne.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Poprawki UX bez zmian w schemacie (Z1, Z3–Z6)

- [x] **T-1** — **Etykiety parametrów akcji** (Z1): uzupełnij `PARAM_LABELS` w
  `src/lib/ai/actionContract.ts` o 13 brakujących nazw z katalogu + `groupName` → „Grupa notatek".
  *Gotowe, gdy:* każdy parametr występujący w `ACTION_CATALOG_BY_MODULE` i `petActions.ts` ma polską
  etykietę w `PARAM_LABELS` albo w `fields` swojej akcji. **(AC-1)**

- [x] **T-1b** — **Wymyślone parametry i realna obsługa grupy** (Z1, ustalenie C-54): `fieldSpec()`
  zwraca `control: "hidden"` dla klucza nieznanego kontraktowi i `PARAM_LABELS`; katalog akcji
  (`create_note`, `update_note`) przyjmuje `groupName?`, a `notesExecutor` rozwiązuje grupę po nazwie
  w zakresie właściciela.
  *Gotowe, gdy:* wymyślony przez model parametr nie pojawia się w podglądzie pod techniczną nazwą, a
  „do grupy X dodaj notatkę" faktycznie umieszcza notatkę w grupie X. **(AC-2b, AC-2c)**

- [x] **T-2** — **Bramka kompletności etykiet** (Z1): rozszerz `scripts/check-action-coverage.js` —
  parsuj sygnatury `- <akcja> { … }` z katalogu, wyciągnij nazwy parametrów, zażądaj etykiety.
  Wyjątki: `*Id`, `openAfter`, `searchQuery`.
  *Gotowe, gdy:* `npm run check:actions` przechodzi, a **celowe** usunięcie jednej etykiety wywala
  build z czytelnym komunikatem (sabotaż-test, potem przywróć). **(AC-2)**

- [ ] **T-3** `[P]` — **Kursor nad menu poziomu** (Z3): w `AICommandSheet.tsx` pole kompozytora
  dostaje `caretColor: showLevelMenu ? "transparent" : "var(--accent-blue)"`; komentarz wyjaśnia
  przyczynę (fokus trzymany przez `keepKeyboardOpen`, karetka rysowana ponad HTML).
  *Gotowe, gdy:* przy otwartym menu karetka nie jest rysowana, a klawiatura na telefonie zostaje. **(AC-11)**

- [ ] **T-4** `[P]` — **Kursor na końcu draftu** (Z4): po `focus()` w efekcie autofokusu oraz po
  wczytaniu rozmowy z draftem ustaw `setSelectionRange(len, len)`.
  *Gotowe, gdy:* otwarcie rozmowy z niewysłanym tekstem stawia kursor na końcu. **(AC-12)**

- [ ] **T-5** — **Jeden panel nagłówka naraz** (Z5): zamień `showPrefs`/`showReport`/`showHistory` na
  `headerPanel: "none"|"prefs"|"report"|"history"` + `togglePanel()`; historia zamykana ponownym
  klikiem; usuń z historii pozycję „Nowa rozmowa"; `Esc` zamyka najpierw panel.
  *Gotowe, gdy:* nie da się otworzyć dwóch sekcji naraz, każda zamyka się swoją ikoną, historia
  zawiera wyłącznie listę rozmów. **(AC-13, AC-14, AC-15)**

- [ ] **T-6** — **Skrót do poprzedniej rozmowy na mobile** (Z6): przenieś przycisk z rzędu ikon do
  osobnego, pełnoszerokościowego wiersza pod nagłówkiem (`minWidth: 0`, ellipsis); rząd ikon
  `flexShrink: 0`, nagłówek `minWidth: 0`.
  *Gotowe, gdy:* przy szerokości 320 px nagłówek się mieści i nie ma poziomego przewijania. **(AC-16)**

---

## Faza 1 — Fundament danych

- [x] **T-7** — **Migracja `0212_levels_prices_owners`** (plan §2.5): kolumna `level` +
  klucz złożony na `LlmAssignment`, `model` nullowalny, seed wierszy `economy`/`max` odtwarzający
  dzisiejsze zachowanie, `CREATE TABLE "UserLlmPref"`, `CREATE TABLE "LlmModelPrice"` + seed cennika
  z `pricing.ts`, kolumny właścicieli + indeksy + FK `SetNull`, backfill na administratora z RBAC,
  podmiana unikalności `Tag.name`/`ItemHistory.name` na klucze złożone. Wszystko idempotentnie.
  *Gotowe, gdy:* `npm run check:migrations` przechodzi, a `npx prisma migrate deploy` na **lokalnej**
  bazie kończy się bez błędu i jest odporny na powtórne uruchomienie (C-13). **(AC-22, AC-24)**

- [x] **T-8** — **`schema.prisma`** zgodnie z migracją (§2.1–2.4); `npx prisma generate` czysto.
  *Gotowe, gdy:* typy Prisma zawierają `LlmAssignment.level`, `UserLlmPref`, `LlmModelPrice` oraz
  kolumny właścicieli, bez ani jednego enuma (C-12).

---

## Faza 2 — Warstwa serwera

- [ ] **T-9** — **Cennik z bazy** (Z7): `src/lib/llm/pricing.ts` — `ensurePricesLoaded()` z cache
  60 s + statyczna tablica awaryjna; nowe `estimateCost()` zwracające `{ usd, known, parts }`;
  `estimateCostUsd` jako cienka nakładka. Wywołanie `ensurePricesLoaded()` w `chatComplete`/`chatStream`.
  *Gotowe, gdy:* dla tokenów z przykładu ze zgłoszenia kwoty da się odtworzyć ręcznym rachunkiem, a
  model spoza cennika zwraca `known: false` (nie „0"). **(AC-18, AC-19)**

- [ ] **T-10** — **Rozbicie zużycia** (Z7): `src/lib/ai/usage.ts` — `UsageCall` o `cacheReadTokens`,
  `cacheWriteTokens`, `costKnown`, `operationType`; `UsageMeter.costKnown`; `accrueUsage` je wypełnia.
  *Gotowe, gdy:* suma `calls[].costUsd` nadal równa się `meter.costUsd`, a tokeny cache są w danych. **(AC-17)**

- [ ] **T-11** — **Rozstrzyganie poziomu** (Z2): `resolveLlmChain(op, { level, userId })` z
  dziedziczeniem pól po `standard`, obsługą `custom` (z `UserLlmPref`) i cichym zjazdem przy
  nieistniejącym/wyłączonym dostawcy. `ChatOptions.level`; **usuń** `boostEffort`,
  `effectiveOperation()`, `shouldBoostEffort()`; `agent/route.ts` i `fastPath.ts` przekazują `level`.
  *Gotowe, gdy:* skrypt na lokalnej bazie pokazuje poprawny model/effort dla każdego z 4 poziomów, a
  usunięcie dostawcy z `UserLlmPref` nie kończy się błędem. **(AC-9, AC-10)**

- [ ] **T-12** — **Akcje konfiguracji admina** (Z2, Z7): `src/actions/llmConfig.ts` — `level` w
  `AssignmentDTO`, `getAssignments()` z informacją o dziedziczeniu, walidacja przed upsertem, audyt z
  poziomem w opisie; `getModelPrices`/`setModelPrice`/`deleteModelPrice` + audyt.
  *Gotowe, gdy:* zapis dowolnego poziomu i ceny zostawia wpis w `AuditLog` kategorii `config`. **(AC-3, AC-5, AC-19)**

- [ ] **T-13** — **Akcje własnego poziomu** (Z2): `src/actions/assistantPrefs.ts` — poziom `custom`,
  `updateUserLlmPref`, `resetUserLlmPrefs`, katalog modeli dopuszczonych przez admina; walidacja
  odrzuca model spoza katalogu i **nie przyjmuje** `maxTokens`. `revalidatePath`.
  *Gotowe, gdy:* próba zapisu obcego modelu lub `maxTokens` kończy się błędem walidacji. **(AC-6, AC-7)**

- [ ] **T-14** — **Właściciele: guardy i akcje** (Z8): `assertNoteGroupAccess`/`assertTagAccess` w
  `src/lib/server-utils.ts`; `noteGroups.ts`, `tags.ts`, `items.ts`, `shoppingSync.ts`, `privacy.ts`
  filtrują i ustawiają właściciela; `notesExecutor.ts` szuka grupy w zakresie właściciela; rekord
  systemowy czytelny dla wszystkich, edytowalny tylko przez admina.
  *Gotowe, gdy:* `upsert` historii zakupów idzie po kluczu `ownerId_name`, a odczyty nie zwracają
  cudzych rekordów. **(AC-23, AC-25)**

- [ ] **T-15** — **Manifest pokrycia i dostępu**: `src/lib/ai/action-coverage.json` — `noteGroups:*`,
  `tags:*`, `items:getItemHistory` z `shared` na `owner`; wpisy dla nowych akcji.
  *Gotowe, gdy:* `npm run check:ai-coverage` przechodzi (deklaracja **i** realne wywołanie guarda).

---

## Faza 3 — UI

- [ ] **T-16** — **Komponent kosztu wielokrotnego użytku** (Z7): nowy
  `src/components/ui/AiCostBadge.tsx` (przeniesiony `CostChip`, props `{ usage, rate }`, zero wiedzy o
  asystencie); rozbicie pokazuje wejście / wyjście / zapis do cache / odczyt z cache i „koszt
  nieznany"; `AICommandSheet.tsx` używa komponentu zamiast lokalnej kopii.
  *Gotowe, gdy:* w `AICommandSheet.tsx` nie ma już własnego renderu kosztu, a komponent nie importuje
  niczego z `home/`. **(AC-17, AC-19, AC-21)**

- [ ] **T-17** — **Panel admina: poziomy + cennik** (Z2, Z7): `LlmConfigPanel.tsx` — przełącznik
  poziomów (oszczędny/standardowy/maksymalny) nad siatką typów operacji, znacznik „dziedziczy ze
  standardowego" na pustych polach, sekcja **Cennik modeli** (CRUD). Wyłącznie zmienne CSS, teksty PL.
  *Gotowe, gdy:* wszystkie trzy poziomy da się ustawić bez opuszczania ekranu, a dziedziczone pola są
  widocznie oznaczone. **(AC-3, AC-4)**

- [ ] **T-18** — **Ustawienia własnego poziomu** (Z2): nowy
  `src/components/home/AssistantLevelSettings.tsx` — widok prosty (jedna oś jakość ↔ koszt) +
  rozwijane „zaawansowane" per typ działania: wybór modelu z listy admina, suwak wysiłku, suwak
  temperatury; suwak wyłączony z wyjaśnieniem, gdy model danej opcji nie obsługuje; **brak** limitu
  tokenów. Wpięcie w panel ustawień asystenta i w menu poziomu (pozycja „Własny").
  *Gotowe, gdy:* użytkownik przełącza się na własny poziom i reguluje ustawienia w ≤2 kliknięciach,
  a nieobsługiwany suwak jest nieaktywny z komunikatem. **(AC-6, AC-7, AC-8, AC-9)**

- [ ] **T-19** `[P]` — **Diagnostyka AI**: `AiCallsPage.tsx` + `lib/ai/aiCallLog.ts` — kolumny tokenów
  cache, żeby log admina zgadzał się z rozbiciem w czacie.
  *Gotowe, gdy:* tabela i eksport tekstowy pokazują zapis/odczyt cache. **(AC-17)**

---

## Faza 4 — Bramki i domknięcie

- [ ] **T-20** — **Bramki**: `npm run check:migrations`, `npm run check:actions`,
  `npm run check:ai-coverage`, `npx next lint`, `npx next build` na **lokalnym** Postgresie (C-13,
  bez `scripts/migrate.js`).
  *Gotowe, gdy:* wszystkie zielone.

- [ ] **T-21** — **Dokumentacja**: `npm run check:ai-coverage -- --report` (regeneracja
  `docs/ai/kontrola-dostepu.md` i `docs/ai/pokrycie-akcji.md`) + aktualizacja `CLAUDE.md` (poziomy
  pracy, cennik w panelu, właściciele `NoteGroup`/`Tag`/`ItemHistory`).
  *Gotowe, gdy:* dokumentacja nie opisuje już tych encji jako „bez właściciela". **(AC-26)**

- [ ] **T-22** — **Weryfikacja liczbowa kosztów**: skrypt jednorazowy liczy koszt dla tokenów z
  przykładu ze zgłoszenia (wejście/wyjście/cache) i porównuje z cennikiem; wynik wchodzi do `verify.md`.
  *Gotowe, gdy:* różnica między kwotą aplikacji a rachunkiem ręcznym = 0. **(AC-18, AC-20)**

- [ ] **T-23** — **Lekcje** (C-51): wpis do `doświadczenia.md` — (a) koszt liczony z tokenów cache,
  których UI nie pokazywał, (b) karetka pola tekstowego ponad menu przy wymuszonym fokusie,
  (c) zmiana klucza głównego tabeli konfiguracyjnej w idempotentnej migracji.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie | AC | Zadanie |
|----|---------|----|---------|
| AC-1 | T-1 | AC-14 | T-5 |
| AC-2 | T-2 | AC-15 | T-5 |
| AC-3 | T-12, T-17 | AC-16 | T-6 |
| AC-4 | T-17 | AC-17 | T-10, T-16, T-19 |
| AC-5 | T-12 | AC-18 | T-9, T-22 |
| AC-6 | T-13, T-18 | AC-19 | T-9, T-12, T-16 |
| AC-7 | T-13, T-18 | AC-20 | T-22 |
| AC-8 | T-18 | AC-21 | T-16 |
| AC-9 | T-11, T-18 | AC-22 | T-7 |
| AC-10 | T-11 | AC-23 | T-14 |
| AC-11 | T-3 | AC-24 | T-7, T-14 |
| AC-12 | T-4 | AC-25 | T-14 |
| AC-13 | T-5 | AC-26 | T-21 |

## Notatki / blokady
- T-9…T-19 zależą od T-7/T-8 (schemat). Faza 0 (T-1…T-6) jest od nich niezależna — idzie pierwsza,
  żeby najkrótsze poprawki były gotowe zanim ruszymy migrację.
- T-11 usuwa `boostEffort`/`effectiveOperation` — musi iść **po** seedzie poziomów z T-7, inaczej
  tryb oszczędny chwilowo zachowywałby się jak standardowy.
