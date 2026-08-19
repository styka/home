# Plan techniczny: Wiadomości — odświeżanie, biblioteka źródeł, pasek tematów; Pogoda — obserwatory wg stanu

- **Spec:** ./spec.md (082-wiadomosci-zrodla-i-pogoda-obserwatory)
- **Status:** draft
- **Data:** 2026-08-19

## 1. Podejście

Cztery niezależne zmiany w dwóch modułach, wykonywane w kolejności ryzyka: **najpierw naprawa
odświeżania** (bez niej reszta modułu Wiadomości nie ma danych), potem katalog źródeł (jedyna część
z migracją i nowym ekranem administracyjnym), na końcu dwie zmiany czysto interfejsowe.

Wzorce do naśladowania, po jednym na część:

- **Katalog systemowy + panel admina** → `Category` z `userId=null, teamId=null` obsługiwana przez
  `src/actions/adminCategories.ts` + `src/app/admin/categories/page.tsx` +
  `src/components/admin/SystemCategoryManager.tsx`. Kopiujemy ten układ jeden do jednego
  (`requireAdmin()`, `revalidatePath` na obie trasy, cienka trasa z `hasPermission(...)` i `redirect`).
- **Preferencja użytkownika w module** → `NewsPref` (`workspaceId @unique`, `upsert` przez
  `filtrMoichRekordow`/`wlasnoscOsobistaDoZapisu`). `WeatherPref` powstaje jako jego dokładny
  odpowiednik po stronie Pogody.
- **Zmiany UI** → istniejące `NewsSettings`, `TopicPicker`, `WatchersPanel`; żadnych nowych
  wspólnych komponentów (C-53, C-35).

## 2. Model danych (Prisma)

### 2.1 `NewsSourceCatalog` — systemowa biblioteka źródeł (nowy model)

Tabela **systemowa**: bez `workspaceId`, bez `ownerId`. To słownik jak `Category` na poziomie
systemowym — czytelny dla każdego zalogowanego, edytowalny wyłącznie przez administratora. Świadomie
**nie** dokładamy kolumny przestrzeni: gdyby katalog należał do przestrzeni, każdy użytkownik miałby
własną kopię 400+ wierszy, a poprawka administratora nie dotarłaby do nikogo.

| Pole | Typ | Uwagi |
|------|-----|-------|
| `id` | `String @id @default(cuid())` | |
| `key` | `String @unique` | stabilny klucz, np. `pl-onet-wiadomosci`; po nim idzie idempotentny seed i rozpoznanie „już dodane" |
| `name` | `String` | |
| `rssUrl` | `String` | |
| `homepageUrl` | `String @default("")` | |
| `descriptor` | `String @default("")` | ten sam sens co `NewsSource.descriptor` (040) — kolor liczy z niego `lib/news/sourceColor.ts` |
| `country` | `String @default("")` | kod kraju wielkimi literami (`PL`, `US`, `GB`, `DE`, …); `""` = międzynarodowe |
| `language` | `String @default("")` | kod języka małymi literami (`pl`, `en`, `de`, …) |
| `category` | `String @default("inne")` | **String + union TS (C-12)**, nigdy enum |
| `enabled` | `Boolean @default(true)` | wyłączenie = wpis znika użytkownikom, nie kasuje niczyich źródeł |
| `sortOrder` | `Int @default(0)` | |
| `checkStatus` | `String @default("unknown")` | **String + union TS** — `unknown \| ok \| error` |
| `checkedAt` | `DateTime?` | |
| `checkNote` | `String @default("")` | np. „12 pozycji" albo treść błędu |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

Indeksy: `@@unique([key])` (z pola), `@@index([enabled, country])`, `@@index([category])`.

Typy TS (w `src/lib/news/katalog.ts` — plik **bez** `"use server"`, bo eksportuje stałe; C-50 notka
o `"use server"`):

```ts
export type NewsCatalogCategory =
  | "wiadomosci" | "biznes" | "sport" | "technologia" | "nauka"
  | "kultura" | "rozrywka" | "zdrowie" | "lokalne" | "opinie" | "inne";
export type NewsCatalogCheckStatus = "unknown" | "ok" | "error";
export const NEWS_CATALOG_CATEGORIES: { key: NewsCatalogCategory; label: string }[] = [...];
```

Plik trafia do `src/lib/news/` (a nie do modułu), bo mają go **dwaj** konsumenci: moduł Wiadomości i
panel administratora w `src/components/admin` — zgodnie z regułą „przynależność ustala lista
konsumentów" (C-36). Sąsiadują tam już `sources.ts`, `sourceColor.ts`, `rss.ts`.

### 2.2 `WeatherPref` — preferencja układu obserwatorów (nowy model)

Odpowiednik `NewsPref`. Jedna preferencja na przestrzeń osobistą.

| Pole | Typ | Uwagi |
|------|-----|-------|
| `id` | `String @id @default(cuid())` | |
| `watchersLayout` | `String @default("status")` | **String + union TS**: `status` (lista posortowana po stanie) \| `grouped` (sekcje po stanie) \| `manual` (kolejność dodania, stan sprzed zmiany) |
| `watchersFilter` | `String @default("")` | lista stanów po przecinku (`met,partial`); `""` = bez filtra |
| `updatedAt` | `DateTime @updatedAt` | |
| `workspaceId` | `String @unique` | FK do `Workspace`, `onDelete: Cascade` |

**Świadome odstępstwo od otoczenia:** `workspaceId` **bez** `@default(dbgenerated())`. Ten domyślnik
w pozostałych modelach jest pozostałością po etapie 1 zadania 11 (kolumna dokładana do istniejących
tabel i wypełniana wyzwalaczem). Nowa tabela nie ma czego wypełniać wstecz, a `dbgenerated()`
czyniłby pole **opcjonalnym w kliencie Prismy** — czyli zdejmowałby z kompilatora jedyną kontrolę
tego, że zapis podał przestrzeń. Konsekwencja dla bramek: kolumna jest `NOT NULL` i nie-nullable,
więc `check:workspace-fill` (dotyczy wyłącznie `workspaceId String?`) słusznie nie żąda wyzwalacza.

### 2.3 Migracje (C-10, C-11, C-14)

Numer bazowy z `npm run next:migration`: **0254**. Dwie migracje, świadomie rozdzielone (DDL osobno
od 400+ wierszy danych — inaczej przegląd zmiany schematu tonie w seedzie):

1. `prisma/migrations/0254_katalog_zrodel_rss_i_pref_pogody/migration.sql`
   - `CREATE TABLE "NewsSourceCatalog" (...)` + `CREATE UNIQUE INDEX "NewsSourceCatalog_key_key"` +
     dwa indeksy pomocnicze.
   - `CREATE TABLE "WeatherPref" (...)` + `CREATE UNIQUE INDEX "WeatherPref_workspaceId_key"` +
     `ALTER TABLE "WeatherPref" ADD CONSTRAINT "WeatherPref_workspaceId_fkey" … ON DELETE CASCADE`.
   - Wszystko `IF NOT EXISTS` tam, gdzie PostgreSQL na to pozwala.
2. `prisma/migrations/0255_seed_katalogu_zrodel_rss/migration.sql`
   - **Idempotentny seed ≥ 400 wpisów** (C-14): wielowierszowe `INSERT INTO "NewsSourceCatalog"
     ("id","key","name","rssUrl","homepageUrl","descriptor","country","language","category",
     "sortOrder","createdAt","updatedAt") VALUES (gen_random_uuid()::text, …), …
     ON CONFLICT ("key") DO NOTHING;`
   - `ON CONFLICT DO NOTHING`, **nigdy `DO UPDATE`** — ponowne uruchomienie nie może nadpisać
     poprawki administratora (ryzyko wypisane w specu).
   - Wsady po ~50 wierszy na instrukcję, pogrupowane komentarzem po kraju/regionie; `sortOrder`
     rośnie w obrębie grupy, więc lista w panelu układa się sensownie bez dodatkowej logiki.
   - Zakres (AC-13): Polska — ogólne, biznes, sport, technologia, nauka, kultura, zdrowie, regiony;
     świat — anglosaskie, niemieckie, francuskie, hiszpańskie, włoskie, skandynawskie, czeskie,
     ukraińskie, agencje, nauka/technologia (NASA, ESA, arXiv, Nature, Ars Technica, Hacker News…).
   - **`prisma migrate diff` NIE jest źródłem tego DDL** (C-15) — piszemy ręcznie; po napisaniu
     `grep -E "^(DROP|ALTER TABLE .* DROP)" ` na obu plikach musi być pusty poza planowanym FK.

`schema.prisma` dostaje oba modele; `npm run check:schema-drift` (lokalny Postgres) potwierdza
zgodność schematu z migracjami.

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 Naprawa odświeżania (zadanie 1)

`src/modules/news/jobs/newsRefresh.ts`, funkcja `fetchPool`:

- Usunąć `ownerId` z obiektu wiersza (`~150`). Przestrzeń liczymy **raz na cały przebieg**, przed
  pętlą po źródłach — dokładnie jak w `ensureNewsSetup`, i z tego samego powodu (`createMany` to
  jeden zapis; wołanie `wlasnoscOsobistaDoZapisu` w `map` powtarzałoby próbę domknięcia przestrzeni
  dla każdego wiersza):
  ```ts
  const wlasnosc = await wlasnoscOsobistaDoZapisu(ownerId);   // przed pętlą
  …
  .map((f) => ({ ...wlasnosc, sourceId: source.id, url: f.link, … }))
  ```
- Poprawić komentarz nad `createMany`: unikalność to `@@unique([workspaceId, sourceId, url])`, nie
  `[ownerId, …]`. Komentarz mówiący o skasowanej kolumnie jest drugą, cichą wersją tego samego błędu.
- Przejrzeć **cały plik** pod kątem innych zapisów z `ownerId` (dziś `ownerId` występuje tam już
  wyłącznie jako **nazwa parametru**/zmiennej, co jest poprawne — zmienna niesie identyfikator
  użytkownika, nie kolumnę).

Brak zmian w akcjach — to jest handler zadania w tle, wołany z `startNewsRefresh`.

### 3.2 Poszerzenie bramki `check-owner-columns.js` (AC-3)

Bramka rozwiązuje identyfikatory stojące w miejscu warunku (`data: rows`) **do punktu stałego w
pliku**, ale nie zaglądała do wartości zdefiniowanej wyrażeniem łańcuchowym
(`const rows = feed.slice(…).map((f) => ({ ownerId, … }))`) — literał obiektu jest tam wewnątrz
wywołania, a nie bezpośrednio po `=`. Zmiana:

- przy rozwiązywaniu identyfikatora skanować **całe wyrażenie przypisania**, łącznie z literałami
  obiektu zagnieżdżonymi w wywołaniach (`.map(…)`, `.flatMap(…)`, `.concat(…)`), a nie tylko literał
  bezpośrednio po `=`;
- dopisać **próbę mutacyjną** (skrypt ma już pięć) odwzorowującą dokładnie ten kształt:
  `prisma.newsArticle.createMany({ data: feed.map((f) => ({ ownerId, sourceId: f.id })) })` — bramka
  musi ją odrzucić. Bez próby poprawka bramki jest niesprawdzalna.
- Poszerzenie może wskazać **istniejące** miejsca. Każde oglądamy osobno; żadnego nie uciszamy
  wyjątkiem (bramka nie ma manifestu i nie dostanie go tutaj).

### 3.3 Katalog źródeł — strona użytkownika

Nowy plik `src/modules/news/actions/katalog.ts` (`"use server"`):

| Funkcja | Opis | Guard | `revalidatePath` |
|---------|------|-------|------------------|
| `getSourceCatalog(filter?: { q?, country?, language?, category? })` | odczyt; tylko `enabled: true`; `take: SUFIT_LISTY`; filtrowanie **po stronie serwera** (`contains`, `mode: "insensitive"`); zwraca `NewsSourceCatalogDTO[]` z polem `added: boolean` policzonym z kluczy źródeł użytkownika | `requireAuth()` | — (odczyt) |
| `addSourceFromCatalog(catalogId)` | tworzy `NewsSource` w przestrzeni osobistej z danymi wpisu; `key` = klucz katalogu (dzięki `@@unique([workspaceId, key])` powtórne dodanie odbija się na poziomie bazy — AC-6); `sortOrder` = `max + 1` jak w `createSource` | `requireAuth()` + `wlasnoscOsobistaDoZapisu` | `/wiadomosci` |

`getSourceCatalog` liczy `added` jednym dodatkowym zapytaniem o klucze źródeł użytkownika
(`select: { key: true }`, `where: filtrMoichRekordow`) — nie N+1.

`createSource`/`updateSource`/`deleteSource` **bez zmian** (AC-7: droga ręczna działa jak dotąd).
`DEFAULT_SOURCES` i `ensureNewsSetup` **bez zmian** (AC-8).

Kontrakt modułu (`src/modules/news/contract.ts`) **nie rośnie** — nowe akcje mają jednego konsumenta
w obrębie modułu (C-36: kontrakt to to, czego potrzebują konsumenci, nie „wszystko na wszelki wypadek").

### 3.4 Katalog źródeł — strona administratora

Nowy plik `src/actions/adminNewsCatalog.ts` (`"use server"`), wzorowany na `adminCategories.ts`:

| Funkcja | Opis |
|---------|------|
| `getCatalogEntries(filter?)` | pełna lista (także wyłączone), `take: SUFIT_LISTY`, filtry serwerowe |
| `createCatalogEntry(data)` | walidacja: `key` niepusty i unikalny, `rssUrl` musi być `http(s)` |
| `updateCatalogEntry(id, patch)` | j.w. dla pól podanych |
| `setCatalogEntryEnabled(id, enabled)` | **domyślna droga „usunięcia"** (odwracalna, AC-10) |
| `deleteCatalogEntry(id)` | twarde skasowanie wpisu katalogu, za `confirmDialog` |
| `checkCatalogEntry(id)` | pobiera kanał przez `fetchRss` z `@/lib/news/rss`, zapisuje `checkStatus`/`checkedAt`/`checkNote` (AC-11) |
| `exportCatalog()` | zwraca JSON `{ omniaNewsCatalog: 1, entries: [...] }` (wzorzec wersjonowanego eksportu skórek) |
| `importCatalog(json)` | dopisuje brakujące po `key`, **nie nadpisuje** istniejących; zwraca `{ added, skipped }` (AC-12) |

Wszystkie: `requireAdmin()` (lokalny helper z `auth()` + `hasPermission(session, PERMISSIONS.ADMIN)`,
jak w `adminCategories.ts`), a mutujące dodatkowo `logAudit("config", "<akcja>", key, detail)`
(C-25, AC-14) i `revalidatePath("/admin/zrodla-rss")` + `revalidatePath("/wiadomosci")`.

**Kosz (C-24):** świadomie pominięty. `TrashItem` odzyskuje dane **użytkownika**; katalog jest
słownikiem systemowym, a jego odwracalną „drogą usunięcia" jest wyłączenie wpisu. Tak samo działa
`adminCategories`.

### 3.5 Preferencja obserwatorów pogody

W `src/modules/weather/actions/weather.ts` (istniejący plik akcji modułu):

| Funkcja | Opis | Guard | `revalidatePath` |
|---------|------|-------|------------------|
| `getWeatherPref()` | `upsert` po `filtrMoichRekordow(user.id)`, zwraca `{ watchersLayout, watchersFilter }` z zawężeniem nieznanej wartości do domyślnej | `requireAuth()` | — |
| `setWatchersView(patch: { layout?, filter? })` | jedna akcja na obie preferencje (razem się zmieniają w tym samym pasku) | `requireAuth()` | `/pogoda` |

Uwaga na `check-ai-coverage`: bramka pomija funkcje o przedrostkach
`assert|ensure|find|preview|describe|has|is|count|resolve|read`, a `get`/`set` **nie są** wśród nich —
obie funkcje wymagają wpisu w manifeście (`getWeatherPref` jako `kind: "read"`).

### 3.6 Manifest pokrycia AI (`src/lib/ai/action-coverage.json`)

Nowe wpisy (klucz = `<plik>:<funkcja>`), wszystkie ze statusem `excluded` — żaden z tych ekranów nie
jest czynnością, o którą sensownie prosi się asystenta (C-53; nowa `AIAction` = nowy egzekutor,
którego nikt nie zawoła):

```
"katalog:getSourceCatalog"          { kind:"read", status:"excluded", reason:"interactive", access:"owner" }
"katalog:addSourceFromCatalog"      { status:"excluded", reason:"redundant", access:"owner" }   // asystent ma create_news_source
"adminNewsCatalog:*"                { status:"excluded", reason:"admin", access:"admin" }
"weather:getWeatherPref"            { kind:"read", status:"excluded", reason:"interactive", access:"owner" }
"weather:setWatchersView"           { status:"excluded", reason:"interactive", access:"owner" }
```

Każda z nich musi mieć **w ciele** wywołanie guardu (`requireAuth()` / `requireAdmin()`) — bramka
sprawdza kod, nie deklarację.

## 4. RBAC / rejestr modułu (C-22)

**Bez nowego slugu.** Strona użytkownika działa pod `module.news` i `module.weather` (trasy
`/wiadomosci`, `/pogoda` już bramkowane przez `wymagajDostepuDoModulu` w swoich `layout.tsx`).
Ekran administracyjny `/admin/zrodla-rss` idzie pod istniejącym `PERMISSIONS.ADMIN` — tak jak
wszystkie pozostałe podstrony `/admin` (AC-15). Bez zmian w `permissions.ts`, `modules.tsx` i
`ModuleSidebar`; bez migracji seedującej uprawnienie.

## 5. UI (C-30, C-31, C-32, C-33, C-34)

### 5.1 Przeglądarka biblioteki (Wiadomości)

- Nowy komponent `src/modules/news/ui/SourceCatalogPicker.tsx` — modal (`@/components/ui/Modal`)
  otwierany przyciskiem **„Dodaj z biblioteki"** obok istniejącego „Dodaj ręcznie" w `NewsSettings`.
- Zawartość: pole wyszukiwania (autofokus, `Esc` zamyka — C-31), trzy selekty (kraj / język /
  kategoria) i lista wyników; wpis pokazuje nazwę, opis, kraj+język, kategorię, a po prawej przycisk
  **Dodaj** albo etykietę **Dodane** (AC-6).
- Filtrowanie idzie na serwer (debounce ~250 ms) — 400+ wpisów nie ładujemy w całości do klienta.
- Stany brzegowe (ładowanie / pusto / błąd) rysowane wewnątrz modalu; `ModuleView`/`state` dotyczy
  **widoku trasy**, a nie zawartości modalu — trasa `/wiadomosci` ma już swój wpis w manifeście
  kontraktu widoku i go nie zmieniamy (C-33).
- Kolory wyłącznie ze zmiennych CSS; cele dotyku `py-3` (C-30, C-31).

### 5.2 Panel administratora

- Trasa `src/app/admin/zrodla-rss/page.tsx` — **cienka**, kopia wzorca z `admin/categories/page.tsx`
  (`auth()` → `hasPermission(…, PERMISSIONS.ADMIN)` → `redirect("/")` → pobranie danych → render).
  Katalog `admin` jest wyłączony z bramki kontraktu widoku (`NOT_MODULES` w `check-ui-contract.js`),
  więc wpis w manifeście nie jest potrzebny.
- Komponent `src/components/admin/NewsSourceCatalogManager.tsx` — tabela z wyszukiwarką i filtrami,
  wiersz z przełącznikiem `enabled`, edycją w miejscu, przyciskiem **Sprawdź** (pokazuje wynik i datę)
  oraz **Usuń** za `confirmDialog` (C-34, **nigdy** `window.confirm`). Nad tabelą: **Dodaj wpis**,
  **Eksport** (pobranie JSON), **Import** (`<input type="file">`).
- Kafelek/link **„Źródła RSS"** dopisany do listy narzędzi na `src/app/admin/page.tsx`.

### 5.3 Obserwatory pogody (`WatchersPanel.tsx`)

- Stała `STATUS_ORDER: WatcherVerdict["status"][] = ["met","partial","unmet","unknown"]` obok
  istniejącego `STATUS_STYLE` (etykieta i `hint` już tam są — zostają, AC-21: znaczenie stanu jest
  tekstem, nie samym kolorem).
- Nagłówek sekcji dostaje **rząd liczników** — po jednym chipie na stan, z liczbą; kliknięcie
  przełącza stan w filtrze (AC-17). Obok przełącznik układu: *lista wg stanu* / *sekcje* / *kolejność
  dodania* (AC-16, AC-18).
- Sortowanie i grupowanie liczone **po stronie klienta** z już posiadanego `verdicts` — zero nowych
  zapytań i zero kosztu modelu.
- **Dopóki `pending` albo `verdicts === null`** (ocena nie została policzona): lista w kolejności
  dodania, liczniki i przełącznik układu **nieaktywne** z podpowiedzią „najpierw oceń" — nie wolno
  udawać stanów, których nie znamy (AC-20).
- Wybór wczytywany z `getWeatherPref()` przez stronę serwerową `/pogoda` i przekazywany propsem;
  zmiana woła `setWatchersView` w `startTransition` (AC-19).
- Teksty przez `useTranslations("modules.weather.WatchersPanel")` → `messages/pl.json` (C-32).

### 5.4 Poziomy pasek tematów (`TopicPicker.tsx`)

Jeden wiersz, cztery elementy: `[◀] [przewijany pasek chipów] [⌄] [▶]`.

- Pasek chipów: `overflow-x-auto` + `snap-x`, `scrollbar` ukryty klasą narzędziową (bez nowej
  zależności), chipy `whitespace-nowrap px-3 py-3` (cel dotyku, C-31), aktywny wyróżniony obramowaniem
  i tłem ze zmiennych CSS.
- **Automatyczne dosunięcie aktywnego** (AC-23): `useEffect` na `selectedId` woła
  `el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })` na referencji do
  aktywnego chipa. Działa niezależnie od tego, czy zmiana przyszła z chipa, strzałki czy listy — bo
  wszystkie trzy drogi wołają to samo `onSelect` (ta sama zasada, dla której 080 dołożyło strzałki).
- **Rozwijana lista z wyszukiwarką zostaje bez zmian** (AC-24) — przenosi się tylko jej wyzwalacz:
  z całej szerokości na wąski przycisk z chevronem po prawej stronie paska. Cała logika otwierania,
  wyszukiwania, `Esc` i kliknięcia poza listą pozostaje ta sama.
- Strzałki `◀`/`▶` bez zmian (pokazują się przy ≥ 2 tematach).
- Bez wariantów `hidden md:*` — jeden mechanizm na telefon i desktop (AC-25, C-31), zgodnie z notatką
  w nagłówku pliku.
- Nagłówek pliku dostaje **czwarty akapit historii**: dlaczego poziomy pasek wraca (widoczność
  sąsiednich tematów) i dlaczego **nie zastępuje** listy (to był powód jego odrzucenia w 041).

## 6. AI / integracje (C-23, C-40)

**Nie dotyczy.** Zero nowych `AIAction`, zero nowych narzędzi odczytu, zero wpięć w kalendarz,
powiadomienia i auto-wydatek. `checkCatalogEntry` uderza wyłącznie w kanał RSS (`lib/news/rss.ts`) —
żadnego modelu językowego, więc `check:cost-badge` i `check:content-memory` tej zmiany nie dotyczą.
Ocena obserwatorów pogody (`evaluateWatchers`) pozostaje nietknięta: zmieniamy **układ** listy, nie
generowanie.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/modules/news/jobs/newsRefresh.ts` | edycja | zadanie 1 — `ownerId` → przestrzeń liczona raz na przebieg; poprawka komentarza o unikalności |
| `scripts/check-owner-columns.js` | edycja | rozwiązywanie identyfikatora przez literał w `.map()` + szósta próba mutacyjna (AC-3) |
| `prisma/schema.prisma` | edycja | modele `NewsSourceCatalog`, `WeatherPref` |
| `prisma/migrations/0254_katalog_zrodel_rss_i_pref_pogody/migration.sql` | nowy | DDL obu tabel |
| `prisma/migrations/0255_seed_katalogu_zrodel_rss/migration.sql` | nowy | idempotentny seed ≥ 400 wpisów |
| `src/lib/news/katalog.ts` | nowy | typy unijne + etykiety kategorii/krajów (dwaj konsumenci: moduł i panel admina) |
| `src/modules/news/actions/katalog.ts` | nowy | `getSourceCatalog`, `addSourceFromCatalog` |
| `src/modules/news/ui/SourceCatalogPicker.tsx` | nowy | modal przeglądarki biblioteki |
| `src/modules/news/ui/NewsSettings.tsx` | edycja | przycisk „Dodaj z biblioteki" + osadzenie modalu |
| `src/modules/news/ui/TopicPicker.tsx` | edycja | zadanie 4 — poziomy pasek chipów + dosuwanie aktywnego |
| `src/actions/adminNewsCatalog.ts` | nowy | CRUD katalogu dla administratora + sprawdzenie kanału + import/eksport |
| `src/app/admin/zrodla-rss/page.tsx` | nowy | cienka trasa panelu |
| `src/components/admin/NewsSourceCatalogManager.tsx` | nowy | ekran zarządzania katalogiem |
| `src/app/admin/page.tsx` | edycja | link do nowego narzędzia |
| `src/modules/weather/actions/weather.ts` | edycja | `getWeatherPref`, `setWatchersView` |
| `src/modules/weather/ui/WatchersPanel.tsx` | edycja | sortowanie/grupowanie/filtr + liczniki |
| `src/modules/weather/ui/WeatherPage.tsx` (+ trasa `/pogoda`) | edycja | przekazanie preferencji propsem |
| `src/lib/ai/action-coverage.json` | edycja | wpisy dla wszystkich nowych akcji |
| `messages/pl.json` | edycja | teksty nowych ekranów (C-32) |
| `doświadczenia.md` | edycja | lekcja z zadania 1 + luki w bramce (C-51) |
| `CLAUDE.md` | edycja | tabela modułów, lista tras `/admin`, schemat bazy, lista akcji |

## 8. Bramki i weryfikacja (C-50)

Lokalnie (C-13 — **nigdy** prod `DATABASE_URL`):

```bash
pg_ctlcluster 16 main start
export DATABASE_URL=postgresql://omnia:omnia@127.0.0.1:5432/omnia_dev DIRECT_URL=$DATABASE_URL
cd worldofmag
npx prisma migrate deploy && npx prisma generate
npm run check:migrations && npm run check:owner-columns && npm run check:schema-drift
npm run check:ai-coverage && npm run check:actions && npm run check:pagination
npm run check:i18n && npm run check:ui-contract && npm run check:boundaries && npm run check:module-registry
npm run check:workspace-fill && npm run check:workspace-nullable && npm run check:route-gating
npm run check:test-types && npx tsc --noEmit && npx next lint --dir src && npx next build
```

Zatrzymujemy się **przed** `scripts/migrate.js` (C-13/C-50).

Mapowanie kryteriów akceptacji:

| AC | Sposób weryfikacji |
|----|--------------------|
| AC-1, AC-2 | test jednostkowy kształtu wiersza w `fetchPool` (bez `ownerId`, z `workspaceId`) + ręczne odświeżenie na lokalnej bazie z jednym źródłem |
| AC-3 | `npm run check:owner-columns` z nową próbą mutacyjną — bramka **musi** odrzucić kształt `data: feed.map(() => ({ ownerId }))` |
| AC-4, AC-5, AC-6, AC-7 | klik po `/wiadomosci → Źródła` na lokalnej bazie (po seedzie): szukanie, filtry, dodanie, powtórne dodanie odbite, dodanie ręczne |
| AC-8 | nowe konto na lokalnej bazie → `ensureNewsSetup` daje dokładnie `DEFAULT_SOURCES` |
| AC-9…AC-12, AC-14 | klik po `/admin/zrodla-rss` + podgląd `AuditLog` w `/admin/audit`; import pliku wyeksportowanego chwilę wcześniej daje `added: 0` |
| AC-13 | `SELECT count(*), count(DISTINCT country), count(DISTINCT language) FROM "NewsSourceCatalog"` na lokalnej bazie po `migrate deploy` |
| AC-15 | wejście na `/admin/zrodla-rss` bez roli admina → przekierowanie na `/` |
| AC-16…AC-19, AC-21 | klik po `/pogoda`: ocena, sortowanie, liczniki, filtr, grupowanie, przeładowanie strony |
| AC-20 | `/pogoda` przed kliknięciem „Oceń": kolejność dodania, sterowanie układem nieaktywne |
| AC-22…AC-25 | klik po `/wiadomosci` przy ≥ 5 tematach, na wąskim i szerokim oknie; sprawdzenie dosunięcia po zmianie chipem, strzałką i z listy |

Testy jednostkowe (Vitest, katalog `__tests__` modułu): kształt wiersza puli, zawężanie
`watchersLayout`/`watchersFilter` do wartości dozwolonych, sortowanie i grupowanie werdyktów.

## 9. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja |
|--------|-----------|
| Seed 400+ wpisów rozdyma migrację i utrudnia przegląd | DDL i dane w **osobnych** migracjach; dane wsadami po ~50 wierszy z komentarzem grupującym |
| Martwe kanały wśród 400+ | `checkStatus`/`checkedAt`/`checkNote` + akcja **Sprawdź**; wyłączenie wpisu jednym kliknięciem; odświeżanie u użytkownika i tak liczy próg per źródło, więc jedno martwe źródło nie psuje przebiegu |
| Poszerzenie `check-owner-columns` wskaże istniejące miejsca | to jest cel bramki — każde miejsce oglądamy i naprawiamy; **bez** manifestu wyjątków |
| Powrót odrzuconego w 041 poziomego paska | pasek **uzupełnia**, nie zastępuje listy z wyszukiwarką (AC-24); powód zapisany w nagłówku pliku, żeby następna sesja nie „posprzątała" jednego z dwóch |
| `WeatherPref` bez `dbgenerated()` odstaje od reszty schematu | odstępstwo opisane w pkt 2.2 i w komentarzu przy modelu; efekt jest **ostrzejszy**, nie luźniejszy (kompilator wymusza podanie przestrzeni) |
| Kolizja numerów migracji z równoległym branchem | `npm run next:migration` tuż przed utworzeniem katalogów + `npm run check:migrations` w buildzie |

**Wycofanie.** Kod: `git revert` scalenia — cztery części są niezależne, więc da się cofnąć samą
część interfejsową. Migracje: obie są **wyłącznie dokładające** (dwie nowe tabele, dane tylko w
nich), więc rewert kodu nie wymaga rewertu bazy — osierocone tabele nikomu nie przeszkadzają.
Awaryjnie `DROP TABLE "NewsSourceCatalog"`, `DROP TABLE "WeatherPref"` (żadnych danych użytkownika
poza preferencją układu listy). Reszta wg `docs/devops/runbook-deploy-rollback.md`.

## 10. Zgodność z konstytucją — checklista

- [x] **C-01/C-02/C-03** — cały kod w `worldofmag/`, alias `@/*` na zewnątrz modułu, ścieżki
      względne wewnątrz `src/modules/<x>/`, artefakty w `specs/082-…/`.
- [x] **C-10/C-11** — dwa **ręcznie pisane** pliki migracji, numery 0254/0255 z `next:migration`.
- [x] **C-12** — `category`, `checkStatus`, `watchersLayout` jako `String` + union TS. Zero enumów.
- [x] **C-13** — weryfikacja na lokalnym Postgresie, zatrzymanie przed `migrate.js`.
- [x] **C-14** — seed idempotentny (`gen_random_uuid()::text`, `ON CONFLICT ("key") DO NOTHING`).
- [x] **C-15** — DDL pisany ręcznie, nie z `migrate diff`; `grep` na `DROP`/`ALTER … DROP`.
- [x] **C-20** — wszystkie mutacje jako Server Actions z `revalidatePath`.
- [x] **C-21** — własność przez `wlasnoscOsobistaDoZapisu`/`filtrMoichRekordow`/`czyMojRekord`;
      katalog świadomie **systemowy** (bez przestrzeni), z uzasadnieniem w pkt 2.1.
- [x] **C-22** — bez nowego slugu; `/admin/zrodla-rss` pod `PERMISSIONS.ADMIN`.
- [x] **C-23** — brak nowych `AIAction`; wpisy w manifeście pokrycia dla wszystkich nowych akcji.
- [x] **C-24** — kosz świadomie pominięty (słownik systemowy; odwracalne wyłączenie wpisu).
- [x] **C-25** — mutacje katalogu w `AuditLog` (kategoria `config`).
- [x] **C-30/C-31/C-32/C-33/C-34** — zmienne CSS, jeden mechanizm mobile/desktop, `py-3`, `Esc`,
      teksty w `messages/pl.json`, brak zmian w kontrakcie widoku, `confirmDialog`.
- [x] **C-35** — zero nowych wspólnych komponentów bez konsumenta; wszystko wpięte od razu.
- [x] **C-36** — kontrakt modułu Wiadomości **nie rośnie**; panel admina sięga po tabelę katalogu,
      nie po wnętrze modułu; wspólne typy w `src/lib/news/` (dwaj konsumenci).
- [x] **C-50/C-51** — build do `next build`; lekcja dopisana do `doświadczenia.md`.
- [x] **C-53** — najmniejszy zestaw: dwie tabele, dwa pliki akcji, jeden ekran administracyjny,
      trzy edytowane komponenty. Bez nowych zależności.
