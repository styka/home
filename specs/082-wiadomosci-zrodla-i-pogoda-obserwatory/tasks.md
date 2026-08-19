# Zadania: Wiadomości — odświeżanie, biblioteka źródeł, pasek tematów; Pogoda — obserwatory wg stanu

- **Plan:** ./plan.md (082-wiadomosci-zrodla-i-pogoda-obserwatory)
- **Status:** todo
- **Data:** 2026-08-19

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie jest małe, samodzielne i weryfikowalne. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Naprawa blokująca (zadanie 1 zgłoszenia)

Idzie pierwsza, bo dopóki pula artykułów jest pusta, żadnej zmiany w module Wiadomości nie da się
obejrzeć na działających danych.

- [x] **T-1** — **Naprawa zapisu puli artykułów.** W `src/modules/news/jobs/newsRefresh.ts`
  (`fetchPool`): wyliczyć `const wlasnosc = await wlasnoscOsobistaDoZapisu(ownerId)` **przed pętlą**
  po źródłach i wstawić `...wlasnosc` zamiast `ownerId` w kształcie wiersza; poprawić komentarz nad
  `createMany` (unikalność to `[workspaceId, sourceId, url]`, nie `[ownerId, …]`). Przejrzeć cały
  plik: `ownerId` wolno tam występować wyłącznie jako nazwa parametru/zmiennej.
  *Gotowe, gdy:* `rg 'ownerId,' src/modules/news/jobs/newsRefresh.ts` nie pokazuje klucza obiektu
  danych, a `npx tsc --noEmit` przechodzi.

- [x] **T-2** — **Test kształtu wiersza puli.** W `src/modules/news/__tests__/` test jednostkowy
  wydzielonej (albo wprost sprawdzonej) budowy wiersza: wynik zawiera `workspaceId`, `sourceId`,
  `url`, `title`, `description`, `publishedAt` i **nie** zawiera `ownerId`.
  *Gotowe, gdy:* `npm run test:unit` zielony i test pada po przywróceniu `ownerId`.

- [x] **T-3** — **Poszerzenie bramki `check-owner-columns.js`.** *(Zakres skorygowany po pomiarze —
  patrz plan §3.2 i „Notatki".)* Wzorzec klucza obejmuje **oba warianty składni** pola: pełny
  (`ownerId:`) i **skrócony** (`{ ownerId, … }`) — to ten drugi przepuścił błąd produkcyjny, i to
  w każdym kształcie, nie tylko w łańcuchu `.map()`. Skrócony wymaga `{`/`,` przed nazwą i `,`/`}`
  po niej, żeby `...ownerId` i `rekord.ownerId` nadal przechodziły. **Pięć prób mutacyjnych
  wbudowanych w skrypt** (dwie muszą paść, trzy muszą przejść), uruchamianych w każdym przebiegu.
  *Gotowe, gdy:* `npm run check:owner-columns` zielony na repo, próby zielone, a cofnięcie poprawki
  wzorca czerwieni dokładnie te dwie próby, które mają paść. **Bez manifestu wyjątków**.

---

## Faza 1 — Fundament danych (zadanie 2 i 3 zgłoszenia)

- [x] **T-4** — **Typy i słowniki katalogu.** Nowy `src/lib/news/katalog.ts` (bez `"use server"`):
  unie `NewsCatalogCategory`, `NewsCatalogCheckStatus`, tablice `NEWS_CATALOG_CATEGORIES` i
  `NEWS_CATALOG_COUNTRIES`/`NEWS_CATALOG_LANGUAGES` (klucz + polska etykieta) do zasilenia selektów
  w obu ekranach.
  *Gotowe, gdy:* plik istnieje, `tsc` czysto, zero importów Prismy i Reacta.

- [x] **T-5** — **Modele w `schema.prisma`.** `NewsSourceCatalog` i `WeatherPref` dokładnie wg planu
  §2.1/§2.2 — statusy jako `String` (C-12), `WeatherPref.workspaceId String @unique` **bez**
  `@default(dbgenerated())`, z komentarzem wyjaśniającym odstępstwo i relacją `onDelete: Cascade`.
  *Gotowe, gdy:* `npx prisma generate` czysto.

- [x] **T-6** — **Migracja DDL `0254_katalog_zrodel_rss_i_pref_pogody`.** Numer potwierdzić
  `npm run next:migration` bezpośrednio przed utworzeniem katalogu. `CREATE TABLE` obu tabel,
  unikalne indeksy (`NewsSourceCatalog_key_key`, `WeatherPref_workspaceId_key`), indeksy pomocnicze
  (`enabled,country` i `category`) oraz FK `WeatherPref → Workspace ON DELETE CASCADE`. DDL pisany
  **ręcznie** (C-15), nie z `migrate diff`.
  *Gotowe, gdy:* `npm run check:migrations` zielony, `npx prisma migrate deploy` na lokalnym
  Postgresie przechodzi, `npm run check:schema-drift` bez różnic, a
  `grep -E '^(DROP|ALTER TABLE .* DROP)' migration.sql` nie pokazuje nic nieplanowanego.

- [x] **T-7** — **Migracja seedu `0255_seed_katalogu_zrodel_rss` — Polska.** Idempotentne
  `INSERT … ON CONFLICT ("key") DO NOTHING` (C-14, `gen_random_uuid()::text`), wsady po ~50 wierszy
  z komentarzem grupującym. Zakres: ogólne, biznes, sport, technologia, nauka, kultura, zdrowie,
  opinie i regiony — **co najmniej 100 wpisów** `country='PL'`, `language='pl'`.
  *Gotowe, gdy:* `migrate deploy` przechodzi, a powtórne uruchomienie nie dodaje ani nie zmienia
  wierszy.

- [x] **T-8** — **Migracja seedu — świat** (ta sama migracja co T-7, kolejne wsady). Anglosaskie,
  niemieckie, francuskie, hiszpańskie, włoskie, skandynawskie, czeskie/słowackie, ukraińskie,
  agencje prasowe oraz nauka/technologia (NASA, ESA, arXiv, Nature, Ars Technica, Hacker News…).
  *Gotowe, gdy:* `SELECT count(*) FROM "NewsSourceCatalog"` **≥ 400**, a
  `count(DISTINCT country) ≥ 15` i `count(DISTINCT language) ≥ 6` (AC-13).

---

## Faza 2 — Warstwa serwera

- [x] **T-9** — **Akcje katalogu dla użytkownika.** Nowy `src/modules/news/actions/katalog.ts`:
  `getSourceCatalog(filter?)` (tylko `enabled: true`, `take: SUFIT_LISTY`, filtry serwerowe
  `contains`+`mode:"insensitive"`, pole `added` z jednego zapytania o klucze źródeł użytkownika) i
  `addSourceFromCatalog(catalogId)` (`NewsSource` w przestrzeni osobistej, `key` = klucz katalogu,
  `sortOrder = max+1`, `revalidatePath("/wiadomosci")`). Guard `requireAuth()` w obu.
  **Bez zmian** w `createSource`/`updateSource`/`deleteSource`, `DEFAULT_SOURCES` i
  `ensureNewsSetup` (AC-7, AC-8). Kontrakt modułu **nie rośnie**.
  *Gotowe, gdy:* `tsc` czysto, `npm run check:pagination` i `npm run check:boundaries` zielone.

- [x] **T-10** `[P]` — **Akcje katalogu dla administratora.** Nowy `src/actions/adminNewsCatalog.ts`
  wzorowany na `adminCategories.ts`: `getCatalogEntries`, `createCatalogEntry`, `updateCatalogEntry`,
  `setCatalogEntryEnabled`, `deleteCatalogEntry`, `checkCatalogEntry` (przez `fetchRss` z
  `@/lib/news/rss`; zapis `checkStatus`/`checkedAt`/`checkNote`), `exportCatalog`,
  `importCatalog(json)` (dopisuje po `key`, **nie nadpisuje**, zwraca `{added, skipped}`). Wszystkie
  z lokalnym `requireAdmin()`; mutujące z `logAudit("config", …)` i `revalidatePath` na
  `/admin/zrodla-rss` + `/wiadomosci`.
  *Gotowe, gdy:* `tsc` czysto, walidacja odrzuca pusty `key` i adres bez `http(s)`.

- [x] **T-11** `[P]` — **Preferencja obserwatorów pogody.** W
  `src/modules/weather/actions/weather.ts`: `getWeatherPref()` (`upsert` po
  `filtrMoichRekordow`, zawężenie nieznanych wartości do domyślnych) i
  `setWatchersView({ layout?, filter? })` z `revalidatePath("/pogoda")`. Unie
  `WatchersLayout = "status" | "grouped" | "manual"` obok istniejących typów modułu.
  *Gotowe, gdy:* `tsc` czysto; test jednostkowy zawężania wartości spoza unii do domyślnej.

- [x] **T-12** — **Manifest pokrycia AI.** Wpisy w `src/lib/ai/action-coverage.json` dla wszystkich
  nowych akcji z T-9/T-10/T-11 (wg planu §3.6): `katalog:*`, `adminNewsCatalog:*`, `weather:*`.
  Każdy z `access` i — dla odczytów — `kind: "read"`; guard musi być **w ciele** funkcji.
  *Gotowe, gdy:* `npm run check:ai-coverage` i `npm run check:actions` zielone.

---

## Faza 3 — UI

- [x] **T-13** — **Poziomy pasek tematów** (zadanie 4 zgłoszenia). `TopicPicker.tsx`: układ
  `[◀][pasek chipów przewijany w poziomie][⌄][▶]`, chipy `whitespace-nowrap px-3 py-3` w kolorach ze
  zmiennych CSS, aktywny wyróżniony; `useEffect` na `selectedId` dosuwający aktywny chip
  (`scrollIntoView({behavior:"smooth", inline:"center", block:"nearest"})`). Rozwijana lista z
  wyszukiwarką, `Esc`, zamknięcie kliknięciem poza i strzałki **bez zmian logiki** — przenosi się
  wyłącznie wyzwalacz listy na wąski przycisk z chevronem. Dopisać czwarty akapit historii w nagłówku
  pliku (dlaczego pasek wraca i dlaczego **nie zastępuje** listy). Bez wariantów `hidden md:*`.
  *Gotowe, gdy:* AC-22…AC-25 sprawdzone klikiem przy ≥ 5 tematach na wąskim i szerokim oknie.

- [x] **T-14** `[P]` — **Obserwatory pogody: układ i filtr** (zadanie 3 zgłoszenia).
  `WatchersPanel.tsx`: stała `STATUS_ORDER`, rząd chipów-liczników w nagłówku (klik = przełączenie
  stanu w filtrze), przełącznik układu *lista wg stanu / sekcje / kolejność dodania*. Sortowanie i
  grupowanie liczone po stronie klienta z `verdicts`. Dopóki `pending` albo `verdicts === null` —
  kolejność dodania, a liczniki i przełącznik **nieaktywne** z podpowiedzią (AC-20). Etykiety i
  `hint` stanów zostają tekstem (AC-21).
  *Gotowe, gdy:* AC-16…AC-18, AC-20, AC-21 sprawdzone klikiem.

- [x] **T-15** — **Wpięcie preferencji pogody w widok.** Trasa `/pogoda` (serwerowy wrapper) pobiera
  `getWeatherPref()` i podaje propsem przez `WeatherPage` do `WatchersPanel`; zmiana układu/filtra
  woła `setWatchersView` w `startTransition`.
  *Gotowe, gdy:* AC-19 — wybór przeżywa przeładowanie strony.

- [ ] **T-16** — **Przeglądarka biblioteki źródeł.** Nowy
  `src/modules/news/ui/SourceCatalogPicker.tsx` (modal na `@/components/ui/Modal`): wyszukiwarka z
  autofokusem i debounce ~250 ms, trzy selekty (kraj/język/kategoria), lista wyników z nazwą, opisem,
  krajem+językiem i kategorią, przycisk **Dodaj** albo etykieta **Dodane**. Stany ładowania/pustki/
  błędu wewnątrz modalu. Wpięcie w `NewsSettings.tsx` przyciskiem **„Dodaj z biblioteki"** obok
  dotychczasowego dodawania ręcznego.
  *Gotowe, gdy:* AC-4…AC-7 sprawdzone klikiem; powtórne dodanie tego samego źródła jest zablokowane.

- [ ] **T-17** `[P]` — **Panel administratora katalogu.** Cienka trasa
  `src/app/admin/zrodla-rss/page.tsx` (wzorzec `admin/categories/page.tsx`: `auth()` →
  `hasPermission(…, PERMISSIONS.ADMIN)` → `redirect("/")`) + komponent
  `src/components/admin/NewsSourceCatalogManager.tsx`: tabela z wyszukiwarką i filtrami, przełącznik
  `enabled`, edycja w miejscu, **Sprawdź** (wynik + data), **Usuń** za `confirmDialog` (C-34),
  a nad tabelą **Dodaj wpis**, **Eksport**, **Import**. Link „Źródła RSS" na `src/app/admin/page.tsx`.
  *Gotowe, gdy:* AC-9…AC-12, AC-14, AC-15 sprawdzone klikiem i podglądem `/admin/audit`.

- [ ] **T-18** — **Teksty do `messages/pl.json`** (C-32): przestrzenie
  `modules.news.SourceCatalogPicker`, uzupełnienia `modules.news.NewsSettings` i
  `modules.news.TopicPicker`, `modules.weather.WatchersPanel`, `app.admin.zrodlaRss.*`.
  *Gotowe, gdy:* `npm run check:i18n` zielony (zero literałów z diakrytykami w nowych komponentach,
  każde `t("klucz")` rozwiązuje się do istniejącego wpisu).

---

## Faza 4 — Bramki i domknięcie

- [ ] **T-19** — **Pełny przebieg bramek** na lokalnym Postgresie (C-13 — nigdy prod
  `DATABASE_URL`), wg listy z planu §8, zatrzymanie **przed** `scripts/migrate.js`:
  `check:migrations`, `check:owner-columns`, `check:schema-drift`, `check:ai-coverage`,
  `check:actions`, `check:pagination`, `check:i18n`, `check:ui-contract`, `check:boundaries`,
  `check:module-registry`, `check:workspace-fill`, `check:workspace-nullable`, `check:route-gating`,
  `check:test-types`, `tsc --noEmit`, `next lint --dir src`, `next build`.
  *Gotowe, gdy:* wszystkie zielone.

- [ ] **T-20** — **Aktualizacja `CLAUDE.md`**: tabela modułów (Wiadomości — biblioteka źródeł;
  Pogoda — układ obserwatorów), lista tras `/admin` (`/admin/zrodla-rss`), sekcja schematu bazy
  (`NewsSourceCatalog`, `WeatherPref`), lista Server Actions (`adminNewsCatalog`, `katalog`).
  *Gotowe, gdy:* tabela i listy zgadzają się z kodem („Keep this table honest").

- [ ] **T-21** — **Wpis do `doświadczenia.md`** (C-51, po polsku, format
  `## YYYY-MM-DD — tytuł` / `**Problem:**` / `**Rozwiązanie:**` / `**Lekcja:**`): zapis do skasowanej
  kolumny `ownerId` w `createMany` **i** luka w bramce, która go przepuściła (literał obiektu ukryty
  w `.map()` — bramka rozwiązywała tylko literał bezpośrednio po `=`).
  *Gotowe, gdy:* wpis dopisany i zacommitowany razem z poprawką.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) |
|----|-----------|
| AC-1 Odświeżanie kończy się sukcesem | T-1, T-2 |
| AC-2 Komunikat o błędzie znika | T-1 |
| AC-3 Bramka wyłapuje ten rodzaj błędu | T-3 |
| AC-4 Przeglądarka z wyszukiwarką i filtrami | T-9, T-16 |
| AC-5 Dodanie bez wpisywania | T-9, T-16 |
| AC-6 Już dodane oznaczone i zablokowane | T-9, T-16 |
| AC-7 Droga ręczna działa jak dotąd | T-9 (brak zmian), T-16 |
| AC-8 Zestaw startowy bez zmian | T-9 (brak zmian) |
| AC-9 Admin: pełny katalog + CRUD | T-10, T-17 |
| AC-10 Wyłączony wpis znika użytkownikom | T-9, T-10, T-17 |
| AC-11 Sprawdzenie kanału | T-10, T-17 |
| AC-12 Eksport/import bez duplikatów | T-10, T-17 |
| AC-13 ≥ 400 wpisów, PL + świat | T-7, T-8 |
| AC-14 Zmiany w dzienniku audytu | T-10 |
| AC-15 Odmowa dostępu bez roli admina | T-17 |
| AC-16 Sortowanie po stanie | T-14 |
| AC-17 Liczniki + filtr stanu | T-14 |
| AC-18 Grupowanie w sekcje | T-14 |
| AC-19 Wybór zapamiętany | T-11, T-15 |
| AC-20 Brak fałszywych stanów przed oceną | T-14 |
| AC-21 Stan dostępny tekstem | T-14 |
| AC-22 Poziomy pasek tematów | T-13 |
| AC-23 Aktywny temat sam się dosuwa | T-13 |
| AC-24 Lista z wyszukiwarką zostaje | T-13 |
| AC-25 Jeden mechanizm mobile+desktop | T-13 |

## Ścieżka krytyczna

`T-1 → T-3` (fix i bramka razem, jeden commit tematyczny) · `T-4 → T-5 → T-6 → T-7 → T-8` (katalog:
typy → schemat → DDL → dane) · `T-6 → T-11 → T-15` (pref pogody) · `T-9 → T-16`, `T-10 → T-17`
(akcje przed ekranami) · wszystko → `T-12` → `T-18` → `T-19` → `T-20`, `T-21`.

Równoległe: `T-10 ∥ T-11` (różne pliki), `T-13 ∥ T-14` (różne moduły), `T-17` niezależne od `T-16`.

## Notatki / blokady

- **T-3 — korekta hipotezy (C-54).** Plan zakładał, że luką jest literał ukryty w łańcuchu `.map()`.
  Pomiar na czterech wariantach tego nie potwierdził: łańcuch z zapisem `ownerId: "x"` bramka
  wykrywała poprawnie. Luką był **skrócony zapis pola** — szerszy i prostszy problem. `plan.md` §3.2
  poprawiony, zakres T-3 przeliczony. Poza `newsRefresh.ts` poszerzenie nie wskazało żadnego
  miejsca; bramka **nie dostaje** manifestu wyjątków.
- **T-7/T-8**: adresy kanałów pisane z wiedzy modelu — część może być nieaktualna. To jest świadomie
  przyjęte ryzyko wyboru właściciela („400+, maksymalnie szeroko"); ratunkiem jest akcja **Sprawdź**
  i wyłączenie wpisu (T-10/T-17), a nie odchudzanie katalogu.
