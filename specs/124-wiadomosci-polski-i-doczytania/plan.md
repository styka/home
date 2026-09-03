# Plan techniczny: Wiadomości — tytuły/streszczenia po polsku + „do doczytania"

- **Spec:** ./spec.md (124-wiadomosci-polski-i-doczytania)
- **Status:** draft
- **Data:** 2026-09-03

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

## 1. Podejście (2–4 zdania)

Wzorcem jest sam moduł Wiadomości — oba zgłoszenia domykają jego istniejące mechanizmy, niczego nie
budujemy obok. **(A)** Tłumaczenie tytułu istnieje od 084 (`summarizeItems` zapisuje polski tytuł tym
samym wywołaniem co streszczenie), ale działa wyłącznie dla pozycji NOWYCH w danym przebiegu
(`newItemIds`) — pozycja, której partia padła (`summaryFailed`) albo której model pominął pole
`title`, zostaje z obcym tytułem NA ZAWSZE, bo żaden następny przebieg jej nie dotyka. Dokładamy do
przebiegu odświeżania etap naprawczy: ponowienie streszczeń dla `summaryFailed` (istniejącą
maszynerią partii) + tanie, osobne dotłumaczenie samych tytułów (operacja `dispatch`) dla pozycji
z poprawnym streszczeniem, ale obcym tytułem (heurystyka, testowana jednostkowo). **(B)** „Do
doczytania" to jedna kolumna `Boolean` na `NewsItem` + akcja przełączenia + filtr w widoku na
wzorcach modułu: stan w URL jak `czytanie` (084/087), filtrowanie TEGO SAMEGO zbioru, który zasila
nawigator tematów i czytnik (lekcja 085), przycisk stałej wysokości w pasku (083/100).

## 2. Model danych (Prisma)

- **Zmienione modele:**
  - `NewsItem` — nowe pole `readLater Boolean @default(false)` (fakt dwustanowy jak
    `summaryFailed` — Boolean, nie status; C-12 nie dotyczy). `status` zostaje bez zmian
    (`"PENDING" | "ACKNOWLEDGED"`): odłożona pozycja jest wciąż „nowa" (PENDING), więc nie znika
    z normalnego strumienia — odłożenie jest znacznikiem ortogonalnym do przeczytania.
- **Relacje / indeksy:** bez nowych indeksów — filtr „do doczytania" działa na kliencie na tym samym
  zbiorze PENDING, który `getStreamView` i tak wczytuje (spójność z nawigatorem, lekcja 085);
  osobne zapytanie z indeksem byłoby drugim źródłem prawdy.
- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: **0290**
  - Katalog: `prisma/migrations/0290_news_read_later/migration.sql`
  - Szkic DDL:
    ```sql
    ALTER TABLE "NewsItem" ADD COLUMN "readLater" BOOLEAN NOT NULL DEFAULT false;
    ```
  - `NewsItem` jest na liście tabel bez `workspaceId` (własność przez `NewsTopic`) — kolumna
    dwustanowa niczego nie zmienia w bramkach własności (`check:workspace-*` nie dotyczy).

## 3. Warstwa serwera (Server Actions — C-20)

Plik: `src/modules/news/actions/news.ts` (konwencja modułu po 046 — akcje w module, nie w
`src/actions/`).

- **Nowa akcja** `setItemReadLater(itemId: string, readLater: boolean): Promise<void>` — guard
  identyczny z `acknowledgeItem` (odczyt pozycji z `topic.workspaceId` + `czyMojRekord`), zapis
  `readLater`, `revalidatePath("/wiadomosci")`. Wpis do `src/lib/ai/action-coverage.json`:
  `"news:setItemReadLater": { "access": "owner", "reason": "interactive", "status": "excluded" }`
  (jak `acknowledgeItem`; bramka `check:ai-coverage` inaczej utnie build).
- **Zmiana** `acknowledgeItem` — `data: { status: "ACKNOWLEDGED", readLater: false }` (AC-8:
  przeczytanie zdejmuje odłożenie).
- **Zmiana** `acknowledgeTopicItems` i `acknowledgeAllItems` — `where` dostaje `readLater: false`
  (AC-7: zbiorcze „oznacz wszystkie" NIE zabiera pozycji odłożonych; jawna decyzja użytkownika jest
  silniejsza od hurtowego sprzątania). Komunikat zwrotny bez zmian (licznik dalej mówi prawdę —
  liczy faktycznie oznaczone).
- **DTO:** `toItemDTO` + `NewsItemDTO` dostają `readLater: boolean` (jedno mapowanie, dwóch
  konsumentów — komentarz przy `toItemDTO` mówi wprost, czemu nie wolno kopiować).

### Przebieg odświeżania (`src/modules/news/jobs/newsRefresh.ts`)

- **Etap 3b — ponowienie nieudanych streszczeń.** Po `summarizeItems(newItemIds, …)` dobieramy
  pozycje użytkownika `status: "PENDING", summaryFailed: true` spoza `newItemIds` (najnowsze
  najpierw, limit `NAPRAWA_LIMIT = 40` na przebieg) i puszczamy przez **tę samą**
  `summarizeItems` — istniejąca maszyneria partii (`przetworzPartiami`) tłumaczy tytuł i streszczenie
  razem, ustawia `summaryFailed` zgodnie z wynikiem (AC-3, AC-4). Zero nowej ścieżki zapisu.
- **Etap 3c — dotłumaczenie samych tytułów.** Pozycje `status: "PENDING", summaryFailed: false`,
  których tytuł wygląda na obcojęzyczny (heurystyka niżej), limit `NAPRAWA_LIMIT` na przebieg:
  jedno tanie wywołanie `llmJson` na partię z operacją **`dispatch`** (C-40 — model z routingu,
  nic hardcodowanego), prompt: „przetłumacz tytuły na polski; nazwy własne i utrwalone terminy
  zostaw w oryginale; nie dopisuj niczego". Zapis wyłącznie pola `title` (streszczenie jest już
  poprawne — pełna regeneracja przez `generation` byłaby płaceniem drugi raz za to samo).
  Wynik, który nadal wygląda na obcy, ZOSTAJE (żadnej pętli w ramach przebiegu — ryzyko ze speca);
  kolejny przebieg spróbuje ponownie, a górne ograniczenie kosztu daje `NAPRAWA_LIMIT` + malejący
  zbiór (pozycje wypadają przez `ACKNOWLEDGED`).
- **Prompt streszczeń** — do istniejącej instrukcji tytułu dopisać zdanie o wyjątku: „nazwy własne,
  tytuły dzieł i utrwalone terminy branżowe zostaw w oryginale" (AC-1/AC-2 — wyjątek jest częścią
  kryterium). Liczniki wyniku przebiegu (`NewsRefreshResult`) dostają pole `repaired`
  (naprawione tytuły/streszczenia) — trafia do `NewsRefreshRun` przez istniejące `recordRun`?
  **Nie** — `NewsRefreshRun` ma stały zestaw kolumn; nie ruszamy schematu kroniki, `repaired`
  doliczamy do `summarized` i logujemy osobno przez `logEvent` (C-53: schemat kroniki bez migracji).

### Heurystyka języka (`src/modules/news/lib/jezykTytulu.ts` — nowy)

`tytulWyglada NaObcy(title: string): boolean` — **próg ostrożny** (ryzyko ze speca: lepiej zostawić
wątpliwy tytuł niż tłumaczyć w kółko):
- `false`, gdy tytuł zawiera polski znak diakrytyczny (ąćęłńóśźż — wystarczy jeden);
- `true` tylko, gdy bez diakrytyków **i** zawiera ≥ 2 różne obce słowa funkcyjne jako osobne wyrazy
  (the, of, and, for, with, from, how, why, what, is, are, to, in, on, der, die, und, le, la, les…);
  granice słów przez własny podział na wyrazy, **nie `\b`** (lekcja 112: `\b` w JS jest ASCII-only).
- Czysty moduł bez Prismy, testy jednostkowe w `lib/__tests__/jezykTytulu.test.ts` (tytuł polski
  bez diakrytyków, polski z angielskim terminem „tokeny w LLM", angielski z przykładu zgłoszenia,
  niemiecki, pusty).

## 4. RBAC / rejestr modułu (C-22)

Bez zmian: istniejący slug `module.news`, żadnych nowych tras (wszystko w `/wiadomosci`), zero
wpisów w `permissions.ts` / `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)

- **`NewsItemCard.tsx`** — przycisk przełączający „Doczytam" (ikona `Bookmark`/`BookmarkCheck`,
  Lucide) obok istniejącego „Przeczytane": wywołuje `setItemReadLater`, jest odwracalny w tym samym
  miejscu (AC-5), stan odłożenia widoczny na karcie (wypełniona ikona + akcent
  `var(--accent-amber)`; kolory WYŁĄCZNIE ze zmiennych CSS — C-30). Cel dotyku ≥ 44 px jak sąsiednie
  przyciski karty (C-31).
- **`NewsPage.tsx`** — stan w URL wg wzorca `czytanie`:
  `doczytania: oneOf(["0", "1"] as const, "0")` w tym samym `viewState` (AC-10 — widok ulubialny,
  wzorzec 084/087; zero czytania adresu na kliencie poza istniejącym mechanizmem — rozjazd
  hydratacji, wpis 2026-08-02). Przełącznik w pasku przyklejonym obok przełącznika trybu czytania /
  filtra źródeł: **jeden przycisk stałej wysokości z licznikiem** („Do doczytania · 3" — wzorzec
  `SourceFilter`/`FiltrTagow` 083/100), przy 0 odłożonych **widoczny, ale wyłączony** (100: ukrycie
  zmieniałoby szerokość paska i chowało, że funkcja istnieje). Poniżej `lg` sama ikona +
  `title`/`aria-label` (wzorzec 106). `aria-pressed` na przełączniku.
- **Filtrowanie** — w tym samym miejscu, gdzie działa filtr źródeł (`widoczneWiadomosci`):
  przy `doczytania === "1"` zostają pozycje `readLater === true`. Dzięki temu nawigator tematów,
  liczniki sekcji, czytnik („Słuchaj wszystkiego") i pusty stan konsumują ten sam przefiltrowany
  zbiór — treść i nawigacja nie mogą się rozjechać (lekcja 085). Filtr dotyczy widoku wiadomości
  (`tresc === "items"`); w widoku osi czasu przełącznik pozostaje widoczny i przełącza po powrocie
  do wiadomości (oś nie ma pojęcia odłożenia).
- **Teksty** — wszystkie nowe napisy przez `t()` do `messages/pl.json` (C-32, bramka `check:i18n`
  jest absolutna): „Doczytam", „Odłożone", „Do doczytania", opisy `aria`.
- **Pusty stan filtra** — gdy zawężenie włączone i nic nie zostało: komunikat przez istniejący
  mechanizm pustego stanu widoku (nie ręcznie — C-33).

## 6. AI / integracje (C-23, C-40)

- Żadnej nowej `AIAction` (spec: nie dotyczy) — `check:actions` bez zmian.
- Nowa akcja `setItemReadLater` → wpis w `action-coverage.json` (pkt 3), inaczej `check:ai-coverage`
  utnie build.
- Wywołanie tłumaczenia tytułów: operacja `dispatch` przez istniejące `llmJson` przebiegu (routing
  DB-driven, C-40); zużycie do wspólnego `sink` przebiegu — koszt raportuje istniejąca kronika
  (`NewsRefreshRun.usage`) i pasek „Ostatnie odświeżanie", bez nowych wpisów w
  `cost-badge-coverage.json` (plik przebiegu już tam jest / już przekazuje usage przez
  `usageFromChat`).
- Kalendarz / powiadomienia / trash / kontrakty innych modułów: bez zmian.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | `NewsItem.readLater Boolean @default(false)` |
| `prisma/migrations/0290_news_read_later/migration.sql` | nowy | `ALTER TABLE "NewsItem" ADD COLUMN "readLater" …` |
| `src/modules/news/lib/jezykTytulu.ts` | nowy | heurystyka „tytuł wygląda na obcojęzyczny" (czysta, bez Prismy) |
| `src/modules/news/lib/__tests__/jezykTytulu.test.ts` | nowy | testy heurystyki (przypadki z pkt 3) |
| `src/modules/news/jobs/newsRefresh.ts` | edycja | etap 3b (ponowienie `summaryFailed`), etap 3c (dotłumaczenie tytułów, `dispatch`), zdanie o nazwach własnych w prompcie |
| `src/modules/news/actions/news.ts` | edycja | `setItemReadLater`, `readLater` w `toItemDTO`/`NewsItemDTO`, `readLater:false` przy acknowledge, wyłączenie odłożonych z akcji zbiorczych |
| `src/lib/ai/action-coverage.json` | edycja | wpis `news:setItemReadLater` (owner/interactive/excluded) |
| `src/modules/news/ui/NewsItemCard.tsx` | edycja | przycisk „Doczytam" + znacznik odłożenia |
| `src/modules/news/ui/NewsPage.tsx` | edycja | klucz URL `doczytania`, przycisk filtra z licznikiem, filtrowanie wspólnego zbioru |
| `messages/pl.json` | edycja | nowe teksty modułu Wiadomości |
| `doświadczenia.md` | edycja | lekcja o „tłumaczenie tylko dla nowych pozycji = obcy tytuł na zawsze" (C-51) |

## 8. Bramki i weryfikacja (C-50)

- Lokalnie: lokalny Postgres (`pg_ctlcluster 16 main start`, `.env.local` + eksport zmiennych do
  shella — `scripts/migrate.js` nie czyta `.env.local`), `npx prisma migrate deploy`; **nigdy prod
  DB** (C-13). Pełny build do kroku `next build`.
- Bramki: `check:migrations` (0290 wolny), `check:ai-coverage` (nowa akcja), `check:i18n` (nowe
  teksty przez `t()`), `check:pagination` (nowe `findMany` etapów 3b/3c z `take`), `check:ui-contract`
  (bez zmian struktury widoku), `tsc -p tsconfig.test.json` (nowy test), `next lint`, `next build`.
- Mapowanie AC → sposób sprawdzenia:
  - **AC-1/AC-2** — test jednostkowy heurystyki + inspekcja promptu (instrukcja tytułu i wyjątku);
    na żywo: przebieg odświeżania na tematach z obcym źródłem (weryfikacja `develop` po deployu).
  - **AC-3** — seed/fixture: pozycja PENDING z angielskim tytułem i `summaryFailed:false` → po
    przebiegu ma polski tytuł (etap 3c); pozycja z `summaryFailed:true` → etap 3b.
  - **AC-4** — `summaryFailed:true` wchodzi do naprawy w KAŻDYM przebiegu (kod + test selekcji,
    jeśli selekcję da się wydzielić czysto; inaczej weryfikacja przez log `logEvent` naprawy).
  - **AC-5/AC-6/AC-7/AC-8** — e2e klikacz Wiadomości (istniejąca suita `scripts/e2e-web.sh`):
    odłóż → znacznik widoczny → filtr pokazuje tylko odłożone (licznik) → „oznacz wszystkie" nie
    zdejmuje → „Przeczytane" zdejmuje; plus asercje na akcjach (`acknowledgeAllItems` pomija
    `readLater`).
  - **AC-9** — viewport 360 px w klikaczu + oględziny: przycisk w pasku, stała wysokość
    (wzorzec zmierzony w 083).
  - **AC-10** — URL zawiera `doczytania=1` po włączeniu; wejście z takim adresem odtwarza zawężenie.

## 9. Ryzyka techniczne i plan wycofania

- **Heurystyka fałszywie oznaczy polski tytuł** (np. cały tytuł to angielski termin) → próg ostrożny
  (≥2 obce słowa funkcyjne, diakrytyk wyklucza), prompt każe „przepisać bez zmian" tytuł już polski,
  a zapis nie nadpisuje tytułu pustym wynikiem (wzorzec 084). Najgorszy przypadek: tytuł zostaje
  jak dziś.
- **Koszt naprawy rośnie na dużym backlogu** → `NAPRAWA_LIMIT = 40`/przebieg, tylko `PENDING`
  (zbiór maleje przez odhaczanie), operacja `dispatch` (najtańsza klasa), koszt widoczny w kronice.
- **`updateMany` z `readLater:false` zmienia liczniki „oznaczono N"** → licznik liczy faktycznie
  zmienione wiersze (wynik `updateMany`), więc mówi prawdę bez zmian w UI.
- **Rozjazd filtr ↔ nawigator** → filtr włączony w JEDNYM miejscu (to samo co `zrodla`), reszta
  konsumuje wynik; asercja w e2e.
- **Rollback:** kod — revert commitów feature'a; migracja — kolumna z `DEFAULT false` jest
  addytywna i nieszkodliwa (starszy kod jej nie czyta), więc wycofanie kodu NIE wymaga migracji
  w dół (runbook devops: kolumny addytywne zostają).

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — ręczna migracja 0290, bez enumów (Boolean), bez dotykania prod DB, bez zmian
  nazw zaaplikowanych migracji
- [x] C-20..C-25 — Server Action z `revalidatePath` + guard `czyMojRekord` (wzorzec
  `acknowledgeItem`); zbiorcze akcje nie szersze niż pojedyncza; bez zmian RBAC/trash/audytu
- [x] C-30..C-33 — zmienne CSS, cele dotyku, stała wysokość paska, stan przez `ModuleView`,
  URL jako nośnik widoku; C-32 — teksty przez `t()`
- [x] C-40 — tłumaczenie tytułów przez routing DB-driven (`dispatch`), zero hardcodowanego modelu
- [x] C-53 — minimalizm: jedna kolumna Boolean, jedna akcja, naprawa w istniejącym przebiegu,
  heurystyka zamiast detekcji języka nową zależnością; zero nowych bibliotek
