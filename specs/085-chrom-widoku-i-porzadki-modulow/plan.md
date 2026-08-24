# Plan techniczny: Chrom widoku przy koncie, przyklejone akcje strony i porządki w Wiadomościach i Pogodzie

- **Spec:** ./spec.md (085-chrom-widoku-i-porzadki-modulow)
- **Status:** draft
- **Data:** 2026-08-24

## 1. Podejście

Trzy niezależne warstwy, robione w tej kolejności, bo druga i trzecia opierają się o pierwszą.
**(a) Powłoka:** chrom konta zbiera się w jednym rzędzie ikon (telefon — górny pasek, komputer —
stopka panelu bocznego), a wstrzykiwanie chromu do paska widoku znika razem z jedynymi trzema
rzeczami, które niosło. **(b) Rama widoku:** pasek widoku staje się przyklejony — strukturalnie,
przez przeniesienie go na poziom kontenera przewijania, nie przez `position: sticky` w zagnieżdżonym
opakowaniu (klasyczna pułapka: element `sticky` przykleja się tylko w granicach RODZICA). **(c) Dwa
moduły:** Wiadomości i Pogoda dostają porządki we własnych widokach.

Wzorzec do naśladowania dla warstwy (a) jest w repo: `PrzelacznikKosztow` już dziś stoi w chromie
konta w trzech miejscach (mobilny pasek, nagłówek sekcji Ulubione, nagłówek asystenta) — powielamy
ten sposób, a nie wymyślamy nowego. Dla warstwy (c) wzorcem jest `AiContentMeta`, który już scala
„kiedy powstało / nieaktualne / odśwież / tryb / koszt" w jedną linię — w Pogodzie po prostu
przenosimy go NAD listę i dokładamy do tego samego paska wybór układu.

## 2. Model danych (Prisma)

Dwie zmiany, obie w jednej migracji.

- **`NewsPref.showEmptyTopics`** — `Boolean @default(false)`. Preferencja użytkownika „pokazuj tematy
  bez nowych wiadomości". `Boolean`, bo to fakt dwustanowy, a nie status (C-12 nie dotyczy, ale warto
  zapisać: to nie jest kandydat na `String` + unię).
- **`WeatherPref.watchersFilter`** — **DROP**. Filtr statusów obserwatorów znika (AC-22), a kolumna
  bez konsumenta jest drugim nośnikiem stanu, który nikogo nie obchodzi (lekcja z 084: martwy nośnik
  usuwamy, nie zostawiamy „na wszelki wypadek"). `watchersLayout` **zostaje** — układ listy zostaje.

- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: **`0257`**
  - Katalog: `prisma/migrations/0257_news_show_empty_topics/migration.sql`
  - Szkic DDL (idempotentnie, wzorem 0256):
    ```sql
    ALTER TABLE "NewsPref"    ADD COLUMN IF NOT EXISTS "showEmptyTopics" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "WeatherPref" DROP COLUMN IF EXISTS "watchersFilter";
    ```
  - `schema.prisma` zsynchronizowany w tym samym kroku; `npm run check:schema-drift` musi przejść.

## 3. Warstwa serwera (Server Actions — C-20)

- **`src/modules/news/actions/news.ts`**
  - `getNewsPrefs()` (istniejąca, dziś zwraca samą długość streszczeń) → dokłada `showEmptyTopics`.
  - **nowa** `setShowEmptyTopics(show: boolean)` — `prisma.newsPref.upsert` po
    `filtrMoichRekordow(user.id)` / `wlasnoscOsobistaDoZapisu(user.id)`, na końcu
    `revalidatePath("/wiadomosci")`. Kopia wzorca `setDefaultSummaryLength`, bez odstępstw.
  - **`getStreamView` / `getStreamTimeline` nie filtrują.** Filtrowanie pustych tematów zostaje po
    stronie widoku, bo to samo źródło zasila listę treści **i** listę skoku (`GroupNavigator`), a
    filtr na serwerze rozjechałby je z licznikami tematów. Decyzja odnotowana tutaj, żeby recenzja
    nie czytała tego jako przeoczenia.
- **`src/modules/weather/actions/weather.ts`**
  - `WeatherPrefDTO` traci `watchersFilter`; `getWeatherPref` przestaje je czytać; `setWatchersView`
    przyjmuje już tylko `{ layout }`. Helpery `czytajFiltr`/`zapiszFiltr` — do usunięcia (martwe).
  - `revalidatePath("/pogoda")` bez zmian.
- **Guardy (C-21):** bez zmian — obie tabele idą przez `filtrMoichRekordow`, czyli przestrzeń
  osobistą właściciela. Żadnej nowej ścieżki dostępu.

## 4. RBAC / rejestr modułu (C-22)

Bez zmian: żadnego nowego sluga, żadnego nowego modułu, żadnych wpięć w `permissions.ts` /
`modules.tsx` / `ModuleSidebar` w rozumieniu rejestru.

**Jedna rzecz wymaga uwagi i jest świadomie NIE-RBAC-owa:** tryb administratora steruje wyłącznie
**rysowaniem**. Decyzja „czy konto w ogóle dostaje dane o koszcie" zostaje tam, gdzie jest —
w `visibleUsage` po stronie serwera (uprawnienie administratora ∧ `Config.ai_cost_badge_enabled`).
Dlatego dostępność samego przełącznika przestaje zależeć od `Config.ai_cost_badge_enabled`
(dziś `kosztyDostepne = isAdmin && readCostBadgeEnabled()`) i zaczyna zależeć **tylko od
`isAdmin`** — inaczej wyłączenie systemowego wyłącznika kosztów zabierałoby administratorowi także
możliwość ukrycia pozostałych dodatków. Koszty i tak nie pojawią się bez `usage` z serwera.

## 5. UI

### 5.1 Chrom konta — jeden rząd ikon *(AC-1..AC-3)*

- **Telefon** (`AppShell`, górny pasek): rząd staje się
  `[ulubione ⇄] [gwiazdka] [tryb admina] [dzwonek]`. Dokładamy `FavoriteStarButton placement="topbar"`
  (wariant już istnieje i był używany do 083 — wracamy do niego, nie piszemy nowego).
- **Komputer** (`ModuleSidebar`, stopka): powstaje **rząd chromu** nad pozycjami
  Zaproszenia/Ustawienia/Admin: `[dzwonek] [gwiazdka] [ściągawka skrótów] [tryb admina]`.
  Wymaga to jednej zmiany w `NotificationBell`: dzisiejsze `placement="sidebar"` to **wiersz
  z etykietą**, a `placement="topbar"` to **ikona z panelem otwieranym W DÓŁ**. Potrzebna trzecia
  kombinacja — ikona z panelem otwieranym **w górę**. Rozwiązanie: rozdzielić w komponencie dwie
  dziś sklejone decyzje (kształt: wiersz/ikona · kierunek panelu: góra/dół) i dodać
  `placement="chrome"`. To jest poszerzenie istniejącego wariantu, nie nowy komponent (C-53).
- `PrzelacznikKosztow` **przenosi się** z nagłówka sekcji „Ulubione" do tego rzędu (jedno miejsce na
  desktopie zamiast dwóch); w nagłówku asystenta zostaje bez zmian.
- `FavoriteStarButton`: wariant `viewbar-inline` staje się martwy → **usuwamy** go z typu
  `placement` (lekcja z 084 o martwym API w miejscu wspólnym). Wariant `viewbar` (pełny wiersz)
  jest martwy od 083 → też znika. Zostają `topbar` i nowy `chrome`.

### 5.2 Pasek widoku: koniec wstrzykiwania chromu *(AC-6, AC-7)*

- `ViewChrome.tsx`: usuwamy `ViewChrome`/`ViewChromeProvider`/`useViewChrome`. **`ViewResource`
  zostaje** — to osobny byt (prop `resource` na `ModuleView`, zarezerwowany dla Faz 2 i 4) i nic go
  nie dotyczy.
- `ViewChromeMenu.tsx` — **kasujemy** (bez zawartości nie ma czego zwijać).
- `ViewBar.tsx` — znika `hideChrome`, `chromeItems`, `gwiazdka`; zostają `filters`, `actions`,
  `title`. Warunek „pusty pasek nie zajmuje miejsca" upraszcza się do `!filters && !actions`.
- `FreshnessIndicator.tsx` — **kasujemy**. Razem z nim `src/lib/dataFreshnessBus.ts` (bez odbiorcy)
  i wywołanie `notifyDataRefreshed()` w `DataFreshness.tsx`. **Samo odświeżanie w tle zostaje** —
  kasujemy wskaźnik, nie mechanizm.
- `ShortcutsButton` przenosi się do rzędu chromu na desktopie (patrz 5.1). Na telefonie znika —
  ściągawka skrótów klawiszowych nie ma tam zastosowania. Skrót „?" działa jak dotąd.
- Sprzątanie re-eksportów: `src/components/ui/index.ts`, `src/platform/ui/index.ts`.
- `src/lib/ui/playground/registry.tsx` — dwa użycia `hideChrome` do usunięcia.

### 5.3 Przyklejony pasek widoku *(AC-4, AC-5)*

Dziś w `ModuleView` (układ `column`) kontener przewijania zawiera **jedno** opakowanie z
`breadcrumb + PageHeader + ViewBar`, a potem treść. Gdyby nadać `position: sticky` samemu paskowi,
przykleiłby się **tylko w granicach tego opakowania** — czyli zniknąłby po przewinięciu o jego
wysokość. Dlatego przebudowa jest strukturalna:

```
kontener przewijania
├── blok nagłówka   (breadcrumb + PageHeader)     ← przewija się normalnie
├── ViewBar         (position: sticky; top: 0)    ← BEZPOŚREDNIE dziecko kontenera
└── treść
```

- Tło paska: `var(--bg-base)` (to samo, co nosi rama) + dolna krawędź — inaczej treść prześwituje
  pod przyklejonym paskiem. Warstwa `z-index` niższa niż warstwy modalne, wyższa niż treść.
- W układzie `fill` **nic się nie zmienia**: tam pasek już dziś nie przewija się (przewija się
  wyłącznie treść). Trzy widoki (`Zakupy`, `Zadania`, `Notatki`) są więc poza zasięgiem ryzyka.
- Odstępy: obecny `gap` opakowania rozdziela się między dwa bloki tak, żeby suma została ta sama —
  weryfikacja wzrokowa na widoku `comfortable` (Pogoda) i `compact` (Wiadomości).
- **Wysokość paska trafia do zmiennej CSS `--view-bar-h`** ustawianej na ramie (ResizeObserver, jak
  `pasekH` w Wiadomościach). Potrzebują jej moduły, które mają WŁASNY przyklejony pasek wewnątrz
  treści.
- **Wiadomości — jedyny taki moduł.** Ich pasek nawigacji ma `sticky top-0` i przykleiłby się pod
  paskiem widoku. Zmiana: `top: var(--view-bar-h, 0px)`, a przyklejone nagłówki sekcji
  `top: calc(var(--view-bar-h, 0px) + var(--news-pasek-h, 0px))`. Dodatkowo `pasekH` (używane jako
  zasłona przy przewijaniu do sekcji i w obserwatorze) liczymy jako **odległość dolnej krawędzi
  paska od górnej krawędzi ramy** (`getBoundingClientRect`), zamiast `offsetHeight` — jedna miara
  zamiast sumy dwóch i odporna na to, co jeszcze stanie wyżej.

### 5.4 Tryb administratora *(AC-8..AC-13)*

- `src/platform/ai/kosztWidocznosc.tsx` → **`src/platform/admin/trybAdmina.tsx`**:
  `TrybAdminaProvider` / `useTrybAdmina` → `{ dostepne, wlaczony, przelacz }`. Klucz w magazynie
  przeglądarki: **`omnia.trybAdmina`** (nowy — stara wartość `omnia.pokazKoszty` zostaje zignorowana;
  domyślny stan „wyłączony" jest tu właściwym startem, bo o to właśnie prosi zgłoszenie). Cały odczyt
  i zapis dalej w `try/catch` (prywatne okno = poprawny stan).
- `PrzelacznikKosztow.tsx` → **`PrzelacznikTrybuAdmina.tsx`**, etykieta „Tryb administratora" /
  „Wyłącz tryb administratora", ikona tarczy zamiast monet.
- Pod przełącznik wchodzą **cztery** rzeczy — lista skończona i wypisana, żeby dało się ją sprawdzić:
  1. `AiCostBadge` (dziś już),
  2. `KosztToasts` (mocowane w `AppShell`),
  3. `FeedbackInspector` (pływający przycisk zgłaszania + tryb wskazywania; **skrót Ctrl+Shift+B
     również**, inaczej „ukryte" narzędzie dałoby się odpalić i wyglądałoby to na usterkę),
  4. `TaskListClipboardButton` (administracyjny eksport listy zadań).
- **Poza przełącznikiem zostają** (AC-9): sam przełącznik, pozycja „Admin" w nawigacji, całe `/admin/*`.
- `src/app/layout.tsx`: `kosztyDostepne` → `trybAdminaDostepny = isAdmin` (uzasadnienie w §4).
  `readCostBadgeEnabled()` przestaje być tu potrzebne — zostaje tam, gdzie decyduje naprawdę
  (`visibleUsage`).

### 5.5 Powiadomienia o koszcie *(AC-12, AC-13)*

- Pozycja: `top: calc(12px + env(safe-area-inset-top))` zamiast `top-4`. To jest cała naprawa
  wcięcia aparatu — ten sam wzorzec, którego używa już `FeedbackInspector`.
- Zachowanie „jak powiadomienie": wjazd od prawej krawędzi + wygaszanie, animacja przez
  `--motion-duration` / `--motion-easing` (tokeny skórki, C-30), oraz **kliknięcie zamyka** wpis
  (dziś `pointer-events: none` na całym kontenerze — zdejmujemy je z kafelków, zostawiając na
  kontenerze, żeby nie blokować treści pod spodem).
- Warstwa i szerokość bez zmian.

### 5.6 Wiadomości *(AC-14..AC-17)*

- `NewsPage.tsx`:
  - `widoczneWiadomosci` / `widocznaOs` odsiewają tematy o zerowej liczbie pozycji, gdy
    `showEmptyTopics` jest wyłączone. **Ta sama lista zasila `grupy` dla `GroupNavigator`**, więc
    lista skoku i treść nie mogą się rozjechać (AC-14).
  - Gdy po odsianiu nie zostaje nic, a tematy istnieją → komunikat „nic nowego, odśwież" przez
    istniejący mechanizm pustki widoku, nie ręcznie rysowany blok (C-33) (AC-16).
  - Zakładki: `feed | hot | sources | settings` — „Źródła" (ikona biblioteki) i **nowa** „Ustawienia"
    (ikona koła zębatego). Klucz stanu widoku w adresie rozszerza się o `"sources"`; dotychczasowa
    wartość `"settings"` prowadziła do źródeł, więc **zapisany ulubiony widok
    `/wiadomosci?widok=settings` po zmianie pokaże ustawienia, a nie źródła** — świadomy, jednorazowy
    koszt, odnotowany tutaj i w ryzykach.
- `NewsSettings.tsx` → zostaje **wyłącznie listą źródeł** (sekcja długości streszczeń wychodzi).
- **nowy** `src/modules/news/ui/NewsModuleSettings.tsx` — domyślna długość streszczeń (przeniesiona
  1:1) + przełącznik „Pokazuj tematy bez nowych wiadomości", oba w `NaglowekSekcji`, jak reszta modułu.

### 5.7 Pogoda *(AC-18..AC-23)*

- `WatchersPanel.tsx`:
  - **Chipsy statusów i cały filtr znikają** (AC-22): stan `filtr`, `przelaczStan`, `licznikiStanow`
    w roli filtra, `filtrNicNieZostawil`. Liczby stanów zostają widoczne w układzie „sekcje", który
    już dziś pokazuje licznik przy każdej grupie.
  - **Jeden pasek NAD listą** (AC-18, AC-21): w lewo — trzy przyciski układu (bez zmian), w prawo —
    `AiContentMeta` z dotychczasowym kompletem (`generatedAt`, `stale`, `onRefresh`, `usage`,
    `swiezy`, `sectionKind`, `mode`, `onModeChange`). Blok na dole znika. To jest przeniesienie
    gotowego komponentu, nie nowy pasek — dlatego „nie pominąć żadnej funkcji" (AC-19) jest
    sprawdzalne przez porównanie propsów, a nie przez oględziny.
  - Mieszczenie się w jednym wierszu przy 360 px: przyciski układu to ikony (już są), a
    `AiContentMeta` sam skraca się do ikon — weryfikacja pomiarem, nie założeniem.
  - **`refreshLabel`** (AC-20): „Oceń ponownie" → **„Przeanalizuj pogodę na nowo"**, z krótszym
    wariantem na wąskim ekranie, jeśli pomiar pokaże, że pełny nie wchodzi.
- `IdeasPanel.tsx` (AC-23): u góry sekcji „Co robić?" **przełącznik dwóch równorzędnych wejść**
  („Nowe propozycje" · „Zapisane pomysły"), wzorowany na `ContentSwitch` z Wiadomości; drugie
  prowadzi do `/pogoda/pomysly`. Odnośnik ze stopki znika.

### 5.8 Teksty (C-32)

Wszystkie nowe napisy do `messages/pl.json` pod namespace wyprowadzonym ze ścieżki pliku; usuwane
komponenty zabierają ze sobą swoje klucze (`ui.viewChromeMenu`, świeżość, `PrzelacznikKosztow`,
`filtrNicNieZostawil`, etykiety statusów użyte wyłącznie przez chipsy). `check:i18n` jest regułą
bezwzględną — zero literałów z polskimi znakami w komponentach i każdy `t("klucz")` musi się
rozwiązywać.

## 6. AI / integracje

Nie dotyczy: zero nowych `AIAction`, zero narzędzi odczytu, brak wpięć w kalendarz, powiadomienia
i kosz. `check:actions` i `check:ai-coverage` muszą pozostać zielone bez zmian w manifestach —
`setShowEmptyTopics` to nowa Server Action, więc **wymaga wpisu w `src/lib/ai/action-coverage.json`**
(klasyfikacja ekspozycji + `access`), inaczej bramka wywali build. To jedyny dotyk warstwy AI.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | `NewsPref.showEmptyTopics` +, `WeatherPref.watchersFilter` − |
| `prisma/migrations/0257_news_show_empty_topics/migration.sql` | nowy | DDL obu zmian |
| `src/components/shell/AppShell.tsx` | edycja | gwiazdka w pasku telefonu, koniec `ViewChromeProvider`, bramkowanie `KosztToasts` i `FeedbackInspector` trybem admina |
| `src/components/shell/ModuleSidebar.tsx` | edycja | rząd chromu w stopce |
| `src/components/shell/NotificationBell.tsx` | edycja | wariant `chrome` (ikona + panel w górę) |
| `src/components/shell/FreshnessIndicator.tsx` | **kasacja** | wskaźnik mierzył co innego, niż mówił |
| `src/components/shell/DataFreshness.tsx` | edycja | bez `notifyDataRefreshed` (odświeżanie zostaje) |
| `src/lib/dataFreshnessBus.ts` | **kasacja** | bez odbiorcy |
| `src/components/favorites/FavoriteStarButton.tsx` | edycja | `placement`: zostają `topbar` i nowy `chrome` |
| `src/components/favorites/FavoritesSidebarSection.tsx` | edycja | przełącznik wyprowadzony do rzędu chromu |
| `src/components/ui/view/ViewChrome.tsx` | edycja | zostaje sam `ViewResource` |
| `src/components/ui/view/ViewChromeMenu.tsx` | **kasacja** | brak zawartości |
| `src/components/ui/view/ViewBar.tsx` | edycja | bez chromu; filtry + akcje + tytuł |
| `src/components/ui/view/ModuleView.tsx` | edycja | przyklejony pasek, `--view-bar-h` |
| `src/components/ui/index.ts`, `src/platform/ui/index.ts` | edycja | re-eksporty |
| `src/lib/ui/playground/registry.tsx` | edycja | `hideChrome` |
| `src/platform/ai/kosztWidocznosc.tsx` → `src/platform/admin/trybAdmina.tsx` | przeniesienie | tryb administratora zamiast samych kosztów |
| `src/components/ui/PrzelacznikKosztow.tsx` → `PrzelacznikTrybuAdmina.tsx` | przeniesienie | nazwa i zakres |
| `src/components/ui/AiCostBadge.tsx` | edycja | nowy kontekst |
| `src/components/ui/KosztToasts.tsx` | edycja | obszar bezpieczny, zachowanie, bramkowanie |
| `src/components/shell/FeedbackInspector.tsx` | edycja | bramkowanie (przycisk **i** skrót) |
| `src/modules/tasks/ui/TasksPage.tsx` | edycja | bramkowanie eksportu do schowka |
| `src/components/assistant/AICommandSheet.tsx` | edycja | nowa nazwa przełącznika |
| `src/app/layout.tsx` | edycja | `trybAdminaDostepny = isAdmin` |
| `src/modules/news/actions/news.ts` | edycja | `showEmptyTopics` + `setShowEmptyTopics` |
| `src/lib/ai/action-coverage.json` | edycja | wpis dla nowej akcji |
| `src/modules/news/ui/NewsPage.tsx` | edycja | odsiew pustych tematów, czwarta zakładka, `--view-bar-h` |
| `src/modules/news/ui/NewsSettings.tsx` | edycja | tylko źródła |
| `src/modules/news/ui/NewsModuleSettings.tsx` | nowy | ustawienia modułu |
| `src/modules/news/ui/sekcjeTematow.tsx` | edycja | przyklejenie nagłówków względem paska widoku |
| `src/modules/weather/actions/weather.ts` | edycja | koniec filtra w preferencji |
| `src/modules/weather/ui/WatchersPanel.tsx` | edycja | jeden pasek u góry, koniec chipsów |
| `src/modules/weather/ui/IdeasPanel.tsx` | edycja | równorzędny wybór propozycje/zapisane |
| `messages/pl.json` | edycja | nowe klucze, usunięcie osieroconych |
| `e2e/specs/chrom-konta.spec.ts` | nowy | AC-1..AC-5, AC-8..AC-11 |
| `e2e/specs/pogoda-obserwatory-pasek.spec.ts` | nowy | AC-18, AC-21, AC-22 |
| `e2e/specs/*` (istniejące) | edycja | selektory gwiazdki po przeprowadzce |

## 8. Bramki i weryfikacja (C-50)

Lokalnie, przeciw **lokalnemu** Postgresowi (C-13 — nigdy prod): `npx prisma migrate deploy`,
`npm run check:migrations`, `check:schema-drift`, `check:i18n`, `check:ui-contract`,
`check:boundaries`, `check:module-registry`, `check:actions`, `check:ai-coverage`,
`check:owner-columns`, `check:client-safe`, `check:e2e-waits`, `tsc` ×2, `next lint`, `next build`,
`check:perf`, testy jednostkowe, pełna suita klikacza.

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1, AC-3 | klikacz: gwiazdka w pasku telefonu i w stopce panelu bocznego; zapis widoku na trasie `/admin` |
| AC-2 | klikacz: w obszarze treści **zero** przycisków zapisu widoku |
| AC-4 | klikacz: po przewinięciu ramy o 800 px pasek widoku nadal w polu widzenia (Pogoda = `column`, Wiadomości = `compact`) |
| AC-5 | pomiar przy 360 px: zero elementów szerszych od pola widzenia; brak dwóch nagłówków; pierwszy element treści nie pod paskiem |
| AC-6, AC-7 | klikacz: brak wskaźnika świeżości i menu „⋯"; ściągawka otwiera się z rzędu chromu i skrótem „?" |
| AC-8..AC-11 | klikacz na koncie administratora: przełącznik wył. → zero elementów administratora (koszty, powiadomienie, pływający przycisk, eksport), przełącznik i „Admin" nadal widoczne; wł. → wszystko wraca. Konto bez uprawnień: nic z tego nie widzi |
| AC-12 | pomiar: górna krawędź powiadomienia ≥ wartość `env(safe-area-inset-top)` (emulacja iPhone'a z wcięciem) |
| AC-13 | klikacz: powiadomienie znika samo, daje się zamknąć kliknięciem |
| AC-14..AC-16 | klikacz: temat bez pozycji niewidoczny w treści **i** na liście skoku; po włączeniu wraca; wszystko puste → komunikat |
| AC-17 | klikacz: zakładka „Ustawienia" ma oba ustawienia, „Źródła" nie ma żadnego |
| AC-18..AC-20 | klikacz: pasek nad listą zawiera układ + „wygenerowano" + ponowną analizę + tryb; **porównanie propsów `AiContentMeta` przed/po** jako dowód kompletności |
| AC-21 | pomiar przy 360 px: pasek w jednym wierszu (wysokość ≤ jednego wiersza kontrolki) |
| AC-22 | klikacz: zero chipsów statusów; liczby stanów obecne w układzie „sekcje" |
| AC-23 | klikacz: oba wejścia widoczne u góry sekcji bez przewijania |

Testy sprawdzamy **w obie strony** (wstrzyknięcie regresji → czerwony, przywrócenie → zielony) —
przynajmniej dla AC-4, AC-8 i AC-22.

## 9. Ryzyka techniczne i plan wycofania

- **Przyklejony pasek dotyka 41 z 44 widoków.** To największe ryzyko przebiegu. Mitygacja:
  przebudowa strukturalna (nie `sticky` w zagnieżdżonym opakowaniu), zero zmian w układzie `fill`,
  przegląd widoków nietypowych: gęste (`compact`: Zadania, Zakupy, Notatki, Wiadomości), wąskie
  (`width="narrow"`), z okruszkiem (`breadcrumb`) i z wirtualizacją (Kontakty, Magazynowanie —
  `scrollRef` musi dalej wskazywać element, który faktycznie się przewija).
- **Wiadomości mają własny przyklejony pasek** — bez korekty `top` skleiłby się z paskiem widoku.
  Mitygacja: `--view-bar-h` i pomiar zasłony jedną miarą; test wizualny przewijania.
- **Zmiana klucza zakładki Wiadomości** unieważnia zapisany ulubiony `?widok=settings` (pokaże
  ustawienia zamiast źródeł). Świadome; jednorazowe; alternatywa (utrzymanie starej wartości dla
  źródeł) zostawiłaby nazwę kłócącą się z treścią.
- **Tryb administratora może ukryć narzędzie w trakcie pracy.** Mitygacja: skończona lista czterech
  elementów, przełącznik i wejście do panelu jawnie wyłączone spod reguły, nowy klucz w magazynie
  przeglądarki (start = wyłączony, czyli stan, o który prosi zgłoszenie).
- **Kasujemy trzy pliki powłoki** (menu chromu, wskaźnik świeżości, magistrala świeżości).
  Wycofanie: czysto kodowe, `git revert` — nic nie zależy od danych.
- **Rollback migracji:** `showEmptyTopics` jest addytywne i domyślne, więc starszy kod działa z nową
  kolumną. `DROP COLUMN watchersFilter` jest **nieodwracalne co do danych** — ale to preferencja
  widoku, nie dane użytkownika; wycofanie kodu nie wymaga wycofania migracji (starszy kod czytałby
  brakującą kolumnę, więc rollback KODU poniżej tej wersji wymagałby ponownego dodania kolumny —
  odnotowane, żeby nie odkryć tego w trakcie awarii).

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — jedna ręczna migracja `0257`, numer z narzędzia, `schema.prisma`
      zsynchronizowany, weryfikacja wyłącznie na lokalnej bazie, zero enumów Prisma.
- [x] **C-20/C-21** — nowa akcja kończy się `revalidatePath`, idzie przez `filtrMoichRekordow` /
      `wlasnoscOsobistaDoZapisu`; żadnej nowej ścieżki dostępu.
- [x] **C-22** — bez nowych slugów; tryb administratora nie jest mechanizmem RBAC i to jest zapisane
      wprost (§4).
- [x] **C-23** — brak nowych `AIAction`; nowa Server Action dostaje wpis w manifeście pokrycia.
- [x] **C-30** — kolory i animacje wyłącznie tokenami skórki.
- [x] **C-31** — przyklejony pasek i powiadomienia sprawdzane pomiarem przy 360 px; obszar bezpieczny
      ekranu; cele dotyku bez zmian; ściągawka skrótów nie udaje przydatnej na telefonie.
- [x] **C-32** — nowe teksty w `messages/pl.json`, osierocone klucze usuwane razem z komponentami.
- [x] **C-33** — zmiana idzie **przez ramę**: rama zyskuje przyklejanie i traci chrom, moduły nie
      dostają wyjątków. Pustka Wiadomości przez `state`, nie ręcznie.
- [x] **C-35** — odwrotny kierunek tej samej reguły: mechanizm bez zawartości (wstrzykiwanie chromu)
      zostaje usunięty, a nie zostawiony jako martwe API w miejscu wspólnym.
- [x] **C-51** — wnioski do dziennika doświadczeń.
- [x] **C-53** — bez nowych zależności; poszerzamy istniejące warianty (`NotificationBell`,
      `AiContentMeta`, `ContentSwitch`) zamiast pisać nowe komponenty; nie dorabiamy globalnego
      paska na komputerze; nie zastępujemy usuniętego filtra innym.
- [x] **C-54** — spec nie wymagał korekty na tym etapie; decyzje przyjęte w planie (odsiew po stronie
      widoku, klucz zakładki, dostępność przełącznika) są tu odnotowane.
