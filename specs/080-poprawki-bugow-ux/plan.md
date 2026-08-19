# Plan techniczny: Fala poprawek — bugi i UX

- **Spec:** ./spec.md (080-poprawki-bugow-ux)
- **Status:** draft
- **Data:** 2026-08-19

> **Zasada planu:** to jest **JAK**. Każda pozycja poniżej ma **ustaloną z kodu przyczynę**, nie
> hipotezę — rekonesans przeprowadzono przed napisaniem planu i przyczyny są wskazane plikiem
> i linią. Gdzie przyczyny nie dało się ustalić bez uruchomienia (Z2, Z10), plan mówi to wprost
> i wskazuje naprawę, która działa niezależnie od wariantu przyczyny.

## 1. Podejście

Dwanaście zgłoszeń rozpada się na **cztery klasy**, a nie dwanaście osobnych łatek — i to jest cała
strategia tego planu:

1. **Warstwy przyklejone do elementu** (Z2, Z7) — jeden wspólny prymityw pozycjonowania zamiast
   pięciu ręcznych `position: absolute`.
2. **Zakres widoku ginący przy odświeżeniu** (Z3) — dane widoku przestają zależeć od źródła, które
   potrafi zniknąć.
3. **Treść AI i mowa bez odporności na odmowę** (Z4, Z5, Z6, Z10, Z11) — zatrzask porażki, ponowienie
   semantyczne, akcja wsadowa, pamięć treści.
4. **Drobne poprawki układu** (Z1, Z8, Z9, Z12) — lokalne zmiany w komponentach.

Wzorce, które naśladujemy zamiast wymyślać nowe (C-53): `rememberedContent` + `AiContentPending` +
`AiContentMeta` z sekcji „Co robić?" w Pogodzie (`src/modules/weather/actions/weather.ts:528`) dla
Z11; `useViewState` (043) dla filtrów Zadań; `ProjectGroup` jako gotowy nośnik „zapisanego zestawu
projektów" dla Z3; `resilientFetch` jako wzorzec ponowień dla Z5; `AssistantPref`/`UserMenuPref` jako
gotowe nośniki preferencji użytkownika.

---

## 2. Model danych (Prisma)

Zmiana schematu jest **minimalna** — trzy kolumny na dwóch istniejących modelach. Zapisane zestawy
projektów (AC-5) **nie tworzą nowego modelu**: `ProjectGroup` (`@@map("TaskView")`) już jest dokładnie
tym — nazwaną listą `projectIds` należącą do użytkownika. Dokładanie drugiego nośnika tej samej rzeczy
byłoby regresją wobec C-53 i wobec lekcji „jeden nośnik faktu" z 079.

- **`AssistantPref`** (`prisma/schema.prisma:1911`) — dwie kolumny dla lektora (Z12/AC-22, AC-23):
  - `readerRate  Float   @default(0.95)` — prędkość czytania. **Domyślna 0.95, nie 1.0**: dokładnie
    tyle wynosi dziś zaszyte `u.rate = 0.95` (`src/lib/tts.ts:333`), więc użytkownik, który niczego
    nie ustawi, nie usłyszy zmiany.
  - `readerFollow Boolean @default(true)` — „podążaj za czytaniem". Domyślnie `true`, bo tak
    zachowuje się dzisiejszy kod; zmieniamy możliwość wyłączenia, nie zachowanie domyślne.
- **`UserMenuPref`** (`prisma/schema.prisma:205`) — jedna kolumna dla menu (Z8/AC-16, AC-17):
  - `favoritesCollapsed Boolean @default(true)` — **domyślnie `true`**, bo to jest treść zgłoszenia:
    sekcja ma startować zwinięta. Nośnik wybrany świadomie: `ModuleSidebar` **już** czyta
    `UserMenuPref`, więc nie dokładamy ani jednego zapytania na stronę. `localStorage` odrzucone —
    pasek renderuje się na serwerze, a odczyt magazynu w pierwszym renderze to rozjazd hydratacji
    (lekcja z `doświadczenia.md` 2026-08-02, powtórzona w komentarzu `useViewState`).
- **Statusy/rodzaje:** żadna z tych kolumn nie jest wyliczeniem — C-12 nie ma tu zastosowania, ale
  odnotowane świadomie: gdyby tryb lektora urósł do zbioru wartości, idzie `String` + union TS.

**Migracja (C-10, C-11):**
- Numer z `npm run next:migration`: **`0253`** (sprawdzone).
- Katalog: `prisma/migrations/0253_poprawki_bugow_ux/migration.sql`
- Szkic DDL — idempotentny, żeby ponowne wejście nie wywracało deployu:
  ```sql
  ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "readerRate"   DOUBLE PRECISION NOT NULL DEFAULT 0.95;
  ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "readerFollow" BOOLEAN          NOT NULL DEFAULT true;
  ALTER TABLE "UserMenuPref"  ADD COLUMN IF NOT EXISTS "favoritesCollapsed" BOOLEAN    NOT NULL DEFAULT true;
  ```
- **C-15:** DDL piszemy ręcznie. Nie wklejamy wyjścia `prisma migrate diff --to-schema-datamodel` —
  ono zaproponowałoby skasowanie indeksów `pg_trgm` żyjących wyłącznie w surowym SQL
  (`src/lib/db/schema-drift-allowed.json`). Kontrola: `grep -E "^(DROP|ALTER TABLE .* DROP)"` na nowej
  migracji musi nie zwrócić nic.
- **C-13:** weryfikacja na lokalnym Postgresie, nigdy na produkcyjnym `DATABASE_URL`.

---

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 Zadania — zakres widoku (Z3)

**Ustalona przyczyna.** `src/app/tasks/[projectId]/page.tsx:86-105` wylicza zakres widoku
**wyłącznie z `searchParams`** (`?group=` / `?projects=`). Gdy `searchParams` przychodzi puste,
gałąź awaryjna daje `scopeIds = []` → `getTasksForProjects([])` → zero zadań i nagłówek
`🗂 Wiele projektów (0)` (linia 101) — **dokładnie ten tekst zgłosił właściciel**. Puste
`searchParams` po mutacji nie jest przypadkiem: `useViewState` zapisuje stan widoku przez natywne
`window.history.pushState` (`src/hooks/useViewState.ts`, decyzja 2 w komentarzu), a nie przez
`router.push`, więc drzewo routera i adres mogą się rozjechać; ponowne renderowanie wywołane
`revalidatePath` z akcji (`src/modules/tasks/actions/tasks.ts:194,384,410,513`) odtwarza trasę bez
parametrów zapytania. **Potwierdzenie pośrednie:** wszystkie pozostałe filtry też się wtedy resetują,
tylko tego nikt nie zgłosił, bo `oneOf(allowed, fallback)` degraduje je do wartości domyślnej —
nieszkodliwie. Zakres wielu projektów jako jedyny ma domyślną „nic".

**Naprawa — reguła: żadne źródło zakresu nie może degradować do „zero zasobów".**

- **Zapisany zestaw → segment ścieżki.** Nowa trasa `src/app/tasks/zestaw/[zestawId]/page.tsx`.
  `params` są częścią trasy, więc Next ma je zawsze — ta klasa błędu znika strukturalnie, a nie
  przez łatkę.
- **Zgodność wstecz (AC-6).** `/tasks/multi?group=<id>` → `redirect("/tasks/zestaw/<id>")`;
  `/tasks/multi?projects=a,b` → `redirect("/tasks/all?projekty=a,b")`. Ulubione widoki właściciela
  (`FavoriteView.path`) i linki w pasku bocznym działają dalej — przechodzą przez przekierowanie.
- **Doraźny multiselect → filtr kliencki (AC-5).** W widokach zbiorczych (`/tasks/all`, `today`,
  `upcoming`, `overdue`) serwer i tak ładuje wszystkie zadania użytkownika (`getAllUserTasks`,
  z sufitem `SUFIT_LISTY` z 096). Wybór projektów zawęża **po stronie klienta** i jest odbijany do
  adresu przez `useViewState` kluczem `projekty` — czyli ulubione dalej łapią filtr (043), a **utrata
  parametru degraduje do „wszystkie projekty", nigdy do „żadnego"**.
- **„Zapisz ten wybór" (AC-5).** Przycisk w filtrze woła istniejące
  `createProjectGroup`/`updateProjectGroup` (`src/modules/tasks/actions/projectGroups.ts:78,113`) i
  nawiguje na `/tasks/zestaw/<id>`. Zero nowych akcji, zero migracji danych — dzisiejsze grupy **są**
  zapisanymi zestawami.
- `revalidatePath` w akcjach Zadań dostaje dodatkowo `/tasks/zestaw/[zestawId]` w formie trasy
  (C-20 — inwalidacja zostaje w akcji, nie rozłazi się po komponentach).

### 3.2 Pogoda — obserwatory na żądanie (Z11)

**Ustalona przyczyna.** `src/modules/weather/ui/WatchersPanel.tsx:92` —
`useEffect(() => evaluate(), [coords, watchers.length])` uruchamia **wywołanie modelu przy każdym
wejściu na moduł**. `evaluateWatchers` (`src/modules/weather/actions/weather.ts:329`) woła
`chatComplete` bezpośrednio, bez `rememberedContent`. Stąd wieczny spinner i „bardzo często nie
działają" — każda odmowa modelu kończy się pustą listą i komunikatem błędu.

**Naprawa.** Dokładnie wzorzec `getIdeas` z tego samego pliku (linia 528):
- `evaluateWatchers` opakowane w `rememberedContent` z `kind: "weather.watchers"`, `scopeKey` = id
  lokalizacji, `hashInputs` = (lista obserwatorów + skrót prognozy + `userContextStamp`).
- Nowy rodzaj `"weather.watchers"` w `AiContentKind` (`src/platform/ai/contentMemory.ts:28`),
  w `AI_SECTION_KINDS` i `AI_SECTION_LABELS` (`src/platform/ai/sectionMode.ts:28,37`, etykieta
  „Pogoda — obserwatory"). Wtedy użytkownik steruje nim tak samo jak resztą sekcji AI.
- Wpis w `src/lib/ai/content-memory-coverage.json` **nie jest nowy** — plik
  `src/modules/weather/actions/weather.ts` już jest sklasyfikowany `remembered`; **uzupełniamy jego
  `reason`** o obserwatory, żeby bramka `check:content-memory` opisywała prawdę (C-54).
- Panel: usuwamy auto-`useEffect`, renderujemy `AiContentPending` przy `{pending:true}` i
  `AiContentMeta` (data powstania, znacznik „nieaktualne", koszt, przycisk odświeżenia) —
  te same komponenty co reszta sekcji AI. **`stale` nadal tylko zapala znacznik, nigdy nie generuje.**

### 3.3 Wiadomości — ponowienia (Z5)

**Ustalona przyczyna.** Ponowienia istnieją, ale **na złym poziomie**. `resilientFetch`
(`src/lib/integrations/resilientFetch.ts:23`, `retries = 2`) ponawia wyłącznie **awarie transportu i
statusy 429/5xx**. `fetchArticle` (`src/lib/news/article.ts:76`) zwraca `{ text: "" }` bez ponowienia,
gdy status jest inny niż te (403/404 za paywallem), **albo gdy odpowiedź jest poprawna (200), ale
ekstrakcja daje pusty tekst** — czyli w najczęstszym przypadku. Streszczanie (`summarizeItems`,
`src/modules/news/jobs/newsRefresh.ts:341`) nie ponawia pozycji, dla której model nie zwrócił wpisu.

**Naprawa — ponowienie SEMANTYCZNE, ponad transportowym:**
- `fetchArticle`: pętla do **3 prób** liczonych na poziomie artykułu; próba, która zwróciła 200, ale
  tekst krótszy od progu użyteczności, **liczy się jako nieudana** i jest ponawiana z odstępem.
  Wykładniczy odstęp jak w `resilientFetch` (wspólny helper, nie druga implementacja).
- `summarizeItems`: pozycje bez streszczenia po pierwszym przebiegu wracają do modelu, łącznie do
  **3 prób**; postęp raportowany przez `ctx.progress` (039), żeby UI czytające `Job.progress`
  pokazywało, co się dzieje.
- „Brak treści materiału." pokazuje się **dopiero po wyczerpaniu prób** — komunikat i stan bez zmian
  (AC-11 nie wprowadza nowego stanu błędu).

### 3.4 Lektor — odmowa dostawcy (Z4)

**Ustalona przyczyna — dwie, obie potwierdzone w kodzie:**
1. **Cisza.** Zapasowa ścieżka *istnieje* (`speak()` → `speakViaServer` → przy `false`
   `speakViaBrowser`, `src/lib/tts.ts:301-315`), ale jest **per wypowiedź i asynchroniczna**.
   Każde zdanie płaci nieudane żądanie sieciowe, a `speechSynthesis.speak()` odpala się **poza
   gestem użytkownika** — WebKit takie wywołanie po cichu odrzuca (opisane w komentarzu przy
   `primeSpeech`, `src/lib/tts.ts`). Lektor Wiadomości łańcuchuje zdania z `onEnd`
   (`src/modules/news/ui/NewsReader.tsx:146`), więc **żadne** zdanie poza pierwszym nie jest w geście.
   Efekt: cisza, a nie przełączenie głosu.
2. **Mylący komunikat (AC-10).** `synthesizeSpeech` **zna** status dostawcy
   (`src/lib/tts/serverTts.ts:53`), ale trasa `/api/tts` łyka wyjątek i zwraca zawsze 502
   (`src/app/api/tts/route.ts:45`), a panel administratora mapuje każde `!res.ok` na jedno zdanie
   „Sprawdź klucz API i wybrany model" (`src/components/admin/SpeechAssignmentRow.tsx:110`). Dlatego
   wymiana klucza nic nie zmieniała — komunikat nie opisywał rzeczywistej odmowy.

**Naprawa:**
- **Zatrzask porażki (AC-8).** W `src/lib/tts.ts` moduł zapamiętuje, że ścieżka serwerowa odmówiła,
  i od tej chwili `speak()` idzie **od razu, synchronicznie** do przeglądarki — w geście, bez żądania
  sieciowego. Zatrzask kasuje zmiana głosu/konfiguracji. Jednorazowe, nieblokujące powiadomienie
  („Lektor serwerowy nie odpowiada — czytam głosem systemowym"). **Bez zatrzasku naprawa byłaby
  pozorna:** samo poprawienie ścieżki zapasowej nie pomoże, dopóki każde zdanie startuje od nieudanego
  obiegu sieciowego poza gestem.
- **Przyczyna zamiast zgadywanki (AC-10).** `synthesizeSpeech` rzuca błąd niosący **kod powodu**
  wyprowadzony ze statusu dostawcy (401/403 → `auth`, 400/404 → `model`, 429 → `quota`, 5xx →
  `provider`, wyjątek sieci → `network`). `/api/tts` zwraca ten **kod**, nigdy treści od dostawcy —
  **C-41: odpowiedź dostawcy może zawierać fragment konfiguracji, więc nie przechodzi do klienta**
  (to zabezpieczenie już tam jest i zostaje). Panel administratora tłumaczy kod na polskie zdanie.
- **Głos systemowy jako świadomy wybór administratora (AC-9).** Nowy klucz `Config`:
  `speech_force_browser` (`"1"`/`"0"`, brak wiersza = `"0"`). Czytany na początku `synthesizeSpeech`
  → `null` → trasa 501 → klient płynnie na głos przeglądarki (ścieżka, która już działa).
  W `/admin/llm` to jedna opcja w wierszu `speech`. Zapis przez `actions/llmConfig.ts` z wpisem do
  `AuditLog` (**C-25** — to zmiana konfiguracji). `Config` jest magazynem klucz-wartość, więc
  **migracji nie potrzeba**; C-40 zachowane, bo nie hardkodujemy dostawcy — wyłączamy warstwę.

### 3.5 Asystent — zlecenie wsadowe (Z6)

**Ustalona przyczyna — arytmetyczna, nie „model się pomylił".** `AGENT_MAX_TOKENS = 1200`
(`src/app/api/llm/home/agent/route.ts:119`). W logu zgłoszenia **każde** wywołanie kończy się
`+1200` tokenów wyjścia — to jest odcięcie limitem, nie odpowiedź. Katalog Zakupów ma wyłącznie
`add_item { rawText }` — **jedna akcja na jedną pozycję** (`src/modules/shopping/ai/catalog.ts:9`),
więc plan na ~100 pozycji to ~100 obiektów JSON; nie mieści się w 1200 tokenach, plan wraca ucięty,
pętla powtarza i po `MAX_ITERATIONS = 6` (linia 28) kończy się „zabrakło kroków"
(`src/platform/ai/agentPartialRun.ts:53`). Dwie tury po ~60 tys. tokenów to koszt tych nieudanych prób.

**Naprawa — mniej akcji, nie więcej kroków** (zgodnie z założeniem ze speca: zwiększanie liczby
kroków mnoży koszt, który właściciel już dwa razy zapłacił bez efektu):
- Nowa akcja `add_items { rawText, listName?, listId? }`, gdzie `rawText` to **jeden tekst
  wielolinijkowy** — po jednej pozycji w linii. Sto pozycji to jedna akcja i ~700 tokenów zamiast stu
  obiektów. Egzekutor rozbija po liniach i wywołuje istniejące `addItem` (które już parsuje ilość i
  jednostkę przez `parseQuantity`), zwracając liczbę dodanych pozycji (AC-13).
- Wymagane wpięcia, inaczej build pada (**C-23**): egzekutor w `/api/llm/home/execute` przez
  `executeShoppingAction`, wpis w `src/platform/ai/actionContract.ts` (obok `add_item`, linia 319),
  klasyfikacja w `src/lib/ai/action-coverage.json`, opis w katalogu promptu. **Nie** trafia do
  `DESTRUCTIVE_ACTION_TYPES` — dodawanie jest bezpieczne, więc działa z auto-zatwierdzaniem (041).
- Prompt Zakupów dostaje jedno zdanie: przy wielu pozycjach użyj `add_items`, nie powtarzaj `add_item`.
- **Podniesienie limitu wyjścia dla kroku planu** z 1200 do wartości mieszczącej długi plan
  (rząd 4000, jak `REPORT_MAX_TOKENS` dla raportów, linia 857 — istniejący precedens w tym pliku).
  Bez tego sama akcja wsadowa nie wystarczy, gdy model dołoży uzasadnienie. Limit dotyczy **wyjścia**,
  więc rośnie tylko wtedy, gdy plan naprawdę jest długi.

### 3.6 Skórka z opisu (Z10)

**Stan ustalony.** `src/platform/jobs/handlers/skinGenerate.ts:172` rzuca „Model nie zwrócił ani
jednego poprawnego tokenu", gdy `validateTokens(rawTokens)` odrzuci **wszystkie** klucze. Czy dla
opisu „Star Trek" model odmawia, zwraca inne nazwy kluczy, czy wartości niezgodne z whitelistą —
**nie da się rozstrzygnąć bez uruchomienia**; plan mówi to wprost zamiast zgadywać. Naprawa jest
dobrana tak, żeby działała w **każdym** z tych wariantów:
- **Jedno automatyczne ponowienie** z komunikatem korygującym, który wymienia klucze odrzucone
  w pierwszej próbie i żąda dokładnych nazw z katalogu. Katalog w promptcie jest generowany
  z `ALL_CONTROLS`, więc nie może się rozjechać — korekta korzysta z tego samego źródła.
- **Uczciwy komunikat** przy porażce po ponowieniu: ile kluczy przyszło, ile odrzucono i **które**
  (AC-19: „mówi, czego zabrakło"). Dzisiejszy tekst nie niesie żadnej informacji diagnostycznej.
- **Sanityzacja bez zmian.** `validateTokens` zostaje dokładnie taka, jaka jest — model jest źródłem
  równie obcym jak cudzy plik (komentarz w tym pliku), a rozluźnienie whitelisty pod jeden opis
  otwierałoby wstrzyknięcie CSS. Naprawiamy ponowienie i komunikat, nie bramkę bezpieczeństwa.

---

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Żadnego nowego sluga `module.*`, żadnego nowego modułu, żadnych wpięć w
`src/lib/permissions.ts`, `src/lib/modules.tsx` ani `ModuleSidebar` jako pozycji menu.

Jedno wymaganie do sprawdzenia, nie do dodania: nowa trasa `src/app/tasks/zestaw/[zestawId]/` leży
pod `/tasks`, którego `layout.tsx` po 098 woła `wymajajDostepuDoModulu` (`src/lib/gatingTrasy.ts`) —
kontrola uprawnienia **dziedziczy się z układu nadrzędnego**, więc bramka `check:route-gating`
przechodzi bez nowego kodu. Weryfikujemy to jawnie zamiast zakładać.

Zmiana `Config.speech_force_browser` przechodzi przez `actions/llmConfig.ts` i **jest audytowana**
(C-25) — tak samo jak istniejące przełączniki `assistant_followups_enabled` i `ai_cost_badge_enabled`.

---

## 5. UI (C-30, C-31, C-32)

### 5.1 Wspólna warstwa przyklejona — `AnchoredLayer` (Z7, Z2) — sedno fali

**Ustalona przyczyna.** `AiCostBadge` (`src/components/ui/AiCostBadge.tsx:180`) ma na sztywno
`bottom: "calc(100% + 6px)"` — **zawsze otwiera się w górę** — a jego `reposition` liczy wyłącznie oś
**poziomą** (`offsetLeft`, `maxPanelWidth`). Pionu nie sprawdza nikt, więc przy przycisku blisko
górnej krawędzi panel wychodzi ponad ekran. Do tego `position: absolute` + `zIndex: 5` daje się
przyciąć każdemu przodkowi z `overflow: hidden`.

**Nowy komponent** `src/components/ui/AnchoredLayer.tsx` (+ eksport przez `src/platform/ui`):
- Renderuje treść w **portalu do `document.body`** — to jedyny sposób, który wyklucza *jednocześnie*
  przycięcie przez `overflow` i uzależnienie od bloku zawierającego.
- Pozycja liczona z `getBoundingClientRect()` wyzwalacza i zmierzonego rozmiaru panelu:
  **odbicie w pionie** (strona preferowana, druga gdy się nie mieści), **przesunięcie w poziomie**
  do wnętrza okna, przeliczenie przy przewijaniu i zmianie rozmiaru.
- Wspólne zachowanie, dziś powielane w każdym miejscu osobno: zamykanie `Esc`, zamykanie kliknięciem
  poza obszarem, `aria-expanded`/`role`, zwrot ogniskowania na wyzwalacz (**C-31 keyboard-first**).
- Wyłącznie zmienne CSS — `--bg-elevated`, `--border`, cień z tokenów skórki (**C-30**).
- Warstwa: jedna stała `z-index` uzgodniona z `useOverlayState` (`src/hooks/useOverlayState.ts`),
  żeby nie powtórzyć konfliktu warstw opisanego w `doświadczenia.md` 2026-06-08.

**Konsumenci — wszyscy naraz, bo „gotowe" znaczy „wpięte" (C-35).** Komponent bez konsumentów jest
gorszy niż jego brak: ogłasza wspólne rozwiązanie, którego nikt nie stosuje.

| Miejsce | Plik | Dziś |
|---|---|---|
| Koszt LLM (zgłoszony) | `src/components/ui/AiCostBadge.tsx:180` | `absolute`, tylko oś X |
| Panele paska zbiorczego (zgłoszone, 6 szt.) | `src/modules/tasks/ui/BulkActionBar.tsx:78` | `absolute bottom-full` |
| Dzwonek powiadomień | `src/components/shell/NotificationBell.tsx:146` | `absolute`, ręczna kotwica |
| Menu projektu | `src/modules/tasks/ui/ProjectActionsMenu.tsx:85` | `absolute right-0 mt-1` |
| Menu przepisu | `src/modules/kitchen/ui/recipes/RecipeList.tsx:143` | `absolute right-0 mt-1` |

Wpis do galerii komponentów (`src/lib/ui/playground/registry.tsx`) — z wariantami brzegowymi
(wyzwalacz przy górnej i przy dolnej krawędzi). To jednocześnie **pierwszy materiał dowodowy dla
przyszłej bramki Z14**, którą właściciel odłożył do osobnego speca.

**Pasek zbiorczy na komputerze (AC-3).** Zewnętrzny kontener zostaje `fixed` przy dolnej krawędzi
z `env(safe-area-inset-bottom)` (C-31), ale wewnętrzny traci pełną szerokość na desktopie:
`md:w-auto` już jest, dokładamy ograniczenie szerokości i wyśrodkowanie, żeby pasek był obiektem,
a nie belką przez cały ekran. Mobile bez zmian.

> **Uczciwa uwaga o Z2.** Nie udało się z samego kodu odtworzyć, dlaczego panel ląduje *poniżej*
> widoku (żaden przodek `ModuleView`/`AppShell` nie tworzy bloku zawierającego przez `transform`).
> Dlatego `/implement` **najpierw odtwarza błąd**, a dopiero potem naprawia. Przejście na
> `AnchoredLayer` usuwa **całą klasę** przyczyn (blok zawierający, przycięcie `overflow`, brak
> miejsca po preferowanej stronie), więc naprawa nie zależy od tego, który wariant okaże się prawdziwy.

### 5.2 Kolumna zaznaczeń (Z1)

`src/modules/tasks/ui/TaskRow.tsx:137-150` — checkbox renderuje się **zawsze**, a poza trybem
zaznaczania dostaje `opacity-0 pointer-events-none`. Jest niewidoczny, ale **zajmuje 20 px + odstęp**,
czyli kolumna istnieje. Zmiana: poza trybem zaznaczania **nie renderujemy go wcale**.

To **świadomie cofa ujawnianie przy najechaniu z 042** (komentarz w tym pliku). Uzasadnienie:
właściciel prosi wprost o ukrywanie kolumny, a ujawnianie przy najechaniu było właśnie powodem, dla
którego kolumna musiała stale zajmować miejsce. Ikona w pasku narzędzi
(`src/modules/tasks/ui/TasksPage.tsx:621`) zostaje **jedyną** drogą wejścia — jest widoczna, opisana
i podświetlana na `--accent-blue`, więc funkcja nie znika z zasięgu. Wyjście z trybu czyści
zaznaczenia (już to robi `finishSelection`). Odnotowane w `doświadczenia.md`, żeby następna osoba nie
„przywróciła" 042 jako regresji.

### 5.3 Ulubione w menu (Z8)

`src/components/favorites/FavoritesSidebarSection.tsx` — sekcja renderuje nagłówek, punkt zapisu
widoku (`FavoriteStarButton`) i do 6 pozycji (`VISIBLE_LIMIT`), **zawsze rozwinięta**.
Zmiana: nagłówek staje się przyciskiem zwijania z licznikiem („Ulubione · 4"), stan z
`UserMenuPref.favoritesCollapsed`, zapis przez `actions/menuPrefs.ts` (C-20, `revalidatePath`).
Zwinięta sekcja to **jeden wiersz**. Ten sam komponent obsługuje nakładkę mobilną
(`AppShell.tsx:177`), więc AC-17 wychodzi z jednej zmiany — pilnujemy `py-3` i celów dotyku (C-31).
Sekcja **nadal renderuje się przy zerze wpisów** (decyzja z 043) — zwijamy ją, nie usuwamy.

### 5.4 Kolejność na stronie głównej (Z9)

`src/modules/home/ui/HomePage.tsx:346-356` — `HomeAssistantCard` stoi pierwszy, blok powitania po nim;
oba **poza** listą sekcji personalizowanych. Zamiana miejscami tych dwóch bloków. `DASHBOARD_SECTIONS`
i `DashboardPref` **nietknięte**, więc niczyja zapisana kolejność się nie zmienia (AC-18).
Komentarz z 043 („widget stoi PIERWSZY") **aktualizujemy** — zostawienie go byłoby rozjazdem
kod↔komentarz (C-54); nowy komentarz notuje, że właściciel zmienił zdanie i dlaczego decyzja
o trzymaniu obu bloków poza personalizacją zostaje w mocy.

### 5.5 Lektor Wiadomości (Z12)

**Ustalona przyczyna skakania — dwa niezależne przewijania walczą o ten sam ekran:**
- `NewsReader.tsx:161` — `scrollIntoView({block:"nearest"})` przy **każdym zdaniu**, przewija do
  bieżącego zdania (a `nearest` rusza też przewijanym przodkiem — całą stroną).
- `NewsStream.tsx:197` — `scrollIntoView({block:"center"})` przy **każdej wiadomości**.

Sekwencja jest dokładnie ta ze zgłoszenia: zmiana wiadomości → strona skacze do karty; następne
zdanie → przewijanie lektora ściąga widok z powrotem na panel lektora.

**Naprawa:**
- **Jeden właściciel przewijania.** Przewijanie do zdania ograniczone do **własnego kontenera
  lektora** (jawny `scrollTop` na kontenerze zamiast `scrollIntoView` na elemencie), więc nigdy nie
  rusza stroną. Przewijaniem strony steruje wyłącznie `handleBlockChange` — i tylko przy zmianie
  wiadomości.
- **Przełącznik „podążaj za czytaniem"** (`AssistantPref.readerFollow`): wyłączony ⇒ **żadne** z tych
  przewijań nie rusza strony (AC-23).
- **Prędkość (AC-22).** `src/lib/tts.ts` przyjmuje prędkość: ścieżka przeglądarki ustawia `u.rate`
  zamiast zaszytego `0.95` (linia 333), ścieżka serwerowa — `playbackRate` na współdzielonym elemencie
  audio. Wartość z `AssistantPref.readerRate`, suwak w pasku lektora.
- **Pasek sterowania.** `NewsReader.tsx:274` już jest `sticky bottom-0`, ale `flex-wrap` zawija go na
  desktopie w kilka rzędów — stąd „dziwnie przypinają się elementy". Układ przechodzi na jeden rząd
  z grupami (nawigacja | odtwarzanie | prędkość | podążanie), zawijanie tylko na wąskim ekranie.
- **Zmiana tematu (AC-24).** `SWIPE_MIN_PX = 60` i `SWIPE_DOMINANCE = 1.5`
  (`NewsStream.tsx:44-45`) obniżamy do łagodniejszych wartości (rząd 40 px / 1.2) — gest zostaje
  **skrótem**, nie jedyną drogą. Widoczne strzałki ‹ › przy nazwie tematu w `TopicPicker.tsx`
  wołają tę samą funkcję skoku co gest, więc obie drogi mają jedną implementację.

### 5.6 Teksty (C-32)

Każdy nowy tekst widoczny dla użytkownika idzie do `messages/pl.json` w przestrzeni wyprowadzonej ze
ścieżki pliku i jest czytany przez `useTranslations`. Dotyczy: etykiet paska lektora (prędkość,
podążanie, poprzedni/następny temat), licznika ulubionych, powiadomienia o zejściu na głos systemowy,
polskich zdań dla kodów przyczyn odmowy lektora, komunikatu diagnostycznego generatora skórek, stanu
oczekiwania obserwatorów pogody, etykiet multiselectu projektów i „zapisz zestaw".
`npm run check:i18n` jest od 097 **regułą bezwzględną** — literał z polskimi znakami w komponencie
wywala build. Bramka sprawdza też, że **każde `t("klucz")` istnieje** w `pl.json`.

---

## 6. AI / integracje (C-23, C-40)

| Rzecz | Zmiana | Wymagane wpięcie (inaczej build pada) |
|---|---|---|
| `add_items` (Z6) | nowa `AIAction` | egzekutor w `executeShoppingAction` (**C-23**, `check:actions`), wpis w `actionContract.ts`, klasyfikacja w `action-coverage.json` (`check:ai-coverage`, wraz z `access`), opis w `shopping/ai/catalog.ts` |
| `weather.watchers` (Z11) | nowy `AiContentKind` | `contentMemory.ts`, `AI_SECTION_KINDS` + `AI_SECTION_LABELS`, uzupełniony `reason` w `content-memory-coverage.json` (`check:content-memory`) |
| Obserwatory — koszt | `usage` przez `visibleUsage` | już jest w `evaluateWatchers`; `check:cost-badge` zostaje zielony, wskaźnik ląduje w `AiContentMeta` |
| Limit wyjścia agenta (Z6) | stała w trasie agenta | bez wpięć; **C-40 nietknięte** — model i dostawca dalej z bazy |
| Głos systemowy (Z4) | `Config.speech_force_browser` | `actions/llmConfig.ts` + `AuditLog` (**C-25**); **C-40 nietknięte** — wyłączamy warstwę, nie hardkodujemy dostawcy |

Kalendarz, powiadomienia i kosz: **nie dotyczy** — nic w tej fali nie tworzy zdarzeń agendy,
powiadomień ani zasobów usuwalnych.

---

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0253_poprawki_bugow_ux/migration.sql` | nowy | 3 kolumny (Z8, Z12) |
| `prisma/schema.prisma` | edycja | te same 3 kolumny — inaczej `check:schema-drift` wywala build |
| `src/components/ui/AnchoredLayer.tsx` | nowy | wspólna warstwa przyklejona (Z7, Z2) |
| `src/lib/ui/playground/registry.tsx` | edycja | wpis do galerii z wariantami brzegowymi (C-35) |
| `src/components/ui/AiCostBadge.tsx` | edycja | konsument `AnchoredLayer` — zgłoszone miejsce (Z7) |
| `src/modules/tasks/ui/BulkActionBar.tsx` | edycja | 6 paneli na `AnchoredLayer` + układ desktop (Z2) |
| `src/components/shell/NotificationBell.tsx` | edycja | konsument `AnchoredLayer` (Z7) |
| `src/modules/tasks/ui/ProjectActionsMenu.tsx` | edycja | konsument `AnchoredLayer` (Z7) |
| `src/modules/kitchen/ui/recipes/RecipeList.tsx` | edycja | konsument `AnchoredLayer` (Z7) |
| `src/modules/tasks/ui/TaskRow.tsx` | edycja | kolumna zaznaczeń znika poza trybem (Z1) |
| `src/app/tasks/zestaw/[zestawId]/page.tsx` | nowy | zakres z **segmentu ścieżki** (Z3) |
| `src/app/tasks/[projectId]/page.tsx` | edycja | `multi` → przekierowania zgodności (Z3, AC-6) |
| `src/modules/tasks/ui/TasksPage.tsx` | edycja | multiselect projektów + „zapisz zestaw" + wspólny nagłówek (Z3, AC-5, AC-7) |
| `src/modules/tasks/actions/tasks.ts` | edycja | `revalidatePath` dla nowej trasy (C-20) |
| `src/components/favorites/FavoritesSidebarSection.tsx` | edycja | sekcja zwijana z licznikiem (Z8) |
| `src/components/shell/ModuleSidebar.tsx` | edycja | przekazanie stanu zwinięcia (Z8) |
| `src/actions/menuPrefs.ts` | edycja | zapis `favoritesCollapsed` + `revalidatePath` (Z8) |
| `src/modules/home/ui/HomePage.tsx` | edycja | powitanie przed asystentem + korekta komentarza (Z9) |
| `src/lib/tts.ts` | edycja | zatrzask porażki + prędkość obu ścieżek (Z4, Z12) |
| `src/lib/tts/serverTts.ts` | edycja | `speech_force_browser` + kod przyczyny (Z4) |
| `src/app/api/tts/route.ts` | edycja | zwrot kodu przyczyny, nadal bez treści dostawcy (Z4, C-41) |
| `src/components/admin/SpeechAssignmentRow.tsx` | edycja | prawdziwa przyczyna + wybór głosu systemowego (Z4) |
| `src/actions/llmConfig.ts` | edycja | odczyt/zapis `speech_force_browser` + audyt (Z4, C-25) |
| `src/lib/news/article.ts` | edycja | ponowienie semantyczne, do 3 prób (Z5) |
| `src/modules/news/jobs/newsRefresh.ts` | edycja | ponowienie streszczeń, do 3 prób (Z5) |
| `src/modules/news/ui/NewsReader.tsx` | edycja | pasek sterowania, prędkość, przewijanie w kontenerze (Z12) |
| `src/modules/news/ui/NewsStream.tsx` | edycja | jeden właściciel przewijania, łagodniejszy gest (Z12) |
| `src/modules/news/ui/TopicPicker.tsx` | edycja | widoczne strzałki zmiany tematu (Z12, AC-24) |
| `src/actions/assistantPrefs.ts` | edycja | `readerRate` / `readerFollow` (Z12) |
| `src/modules/weather/actions/weather.ts` | edycja | obserwatory przez `rememberedContent` (Z11) |
| `src/modules/weather/ui/WatchersPanel.tsx` | edycja | koniec auto-`useEffect`, stan oczekiwania (Z11) |
| `src/platform/ai/contentMemory.ts` | edycja | rodzaj `weather.watchers` (Z11) |
| `src/platform/ai/sectionMode.ts` | edycja | rodzaj + etykieta sekcji (Z11) |
| `src/lib/ai/content-memory-coverage.json` | edycja | uzupełniony `reason` (Z11, C-54) |
| `src/modules/shopping/ai/catalog.ts` | edycja | opis `add_items` w promptcie (Z6) |
| `src/modules/shopping/ai/executor.ts` | edycja | egzekutor `add_items` (Z6, C-23) |
| `src/platform/ai/actionContract.ts` | edycja | kontrakt `add_items` (Z6) |
| `src/lib/ai/action-coverage.json` | edycja | klasyfikacja + `access` (Z6) |
| `src/app/api/llm/home/agent/route.ts` | edycja | limit wyjścia dla długiego planu (Z6) |
| `src/platform/jobs/handlers/skinGenerate.ts` | edycja | ponowienie + diagnostyczny komunikat (Z10) |
| `messages/pl.json` | edycja | wszystkie nowe teksty (C-32) |
| `doświadczenia.md` | edycja | wpisy dla Z1, Z3, Z4, Z6, Z7, Z11 (C-51) |

---

## 8. Bramki i weryfikacja (C-50)

**Środowisko.** Lokalny Postgres (`pg_ctlcluster 16 main start`), `.env.local` + **eksport do
powłoki** (`scripts/migrate.js` nie czyta `.env.local`), `npx prisma migrate deploy`.
**C-13: weryfikujemy do kroku `next build` włącznie i ani kroku dalej** — `migrate.js` ruszyłby
produkcyjną bazę Neon.

Bramki, które ta fala realnie może złamać, więc uruchamiamy je świadomie, a nie „przy okazji builda":
`check:actions` i `check:ai-coverage` (Z6), `check:content-memory` i `check:cost-badge` (Z11),
`check:migrations` i `check:schema-drift` (0253), `check:ui-contract` (nowy komponent, brak
zaszytych hexów), `check:i18n` (nowe teksty — reguła bezwzględna od 097), `check:route-gating`
(nowa trasa `/tasks/zestaw`), `check:owner-columns` i `check:pagination` (nowe zapytania),
`check:client-safe`, `check:tailwind`, `check:e2e-waits` (nowe testy klikacza), `check:perf`
(pasmo ±5 % — portal i nowy komponent zmieniają bajty tras).

**Mapowanie AC → sposób weryfikacji:**

| AC | Jak sprawdzamy |
|---|---|
| AC-1 | Klikacz: włącz tryb → checkbox obecny w DOM; wyłącz → **nieobecny** (nie „przezroczysty") |
| AC-2, AC-14 | Test jednostkowy pozycjonowania `AnchoredLayer` (prostokąt przy górnej i dolnej krawędzi → panel w oknie) + klikacz na `/tasks/multi` i `/wiadomosci` |
| AC-3 | Klikacz na szerokości desktop: pasek nie zajmuje pełnej szerokości okna |
| AC-4 | **Klikacz regresyjny** — wejście na zestaw, zmiana statusu, lista **nadal niepusta**. To jest test, którego brak przepuścił ten błąd |
| AC-5 | Klikacz: multiselect zawęża listę; „zapisz" tworzy zestaw i otwiera go |
| AC-6 | Test przekierowań: stary adres z `?group=` i z `?projects=` → ten sam zakres co przed zmianą |
| AC-7 | Przegląd kodu: oba widoki renderują ten sam nagłówek `ModuleView` |
| AC-8 | Test jednostkowy `speak()` z podstawioną nieudaną ścieżką serwerową: pierwsze wywołanie schodzi na przeglądarkę, **drugie nie wykonuje już żądania** (zatrzask) |
| AC-9 | Ustaw `speech_force_browser=1` → `/api/tts` zwraca 501; wpis w `AuditLog` |
| AC-10 | Test jednostkowy odwzorowania statusu dostawcy na kod przyczyny; **asercja negatywna: klucz nie występuje w odpowiedzi** (C-41) |
| AC-11 | Test jednostkowy `fetchArticle` z podstawionym `fetch`: 200 + pusta treść ⇒ **3 próby**, potem pusto |
| AC-12, AC-13 | Test jednostkowy egzekutora `add_items` na ~100 liniach + szacunek tokenów planu poniżej limitu |
| AC-15 | Przegląd: żadne z pięciu miejsc nie ma już własnego `position:absolute` dla warstwy |
| AC-16, AC-17 | Klikacz desktop i mobile: sekcja zwinięta, pozycje modułów widoczne; rozwinięcie przeżywa przeładowanie |
| AC-18 | Klikacz: kolejność bloków na `/`; test, że `DashboardPref` użytkownika nie jest ruszony |
| AC-19 | Test jednostkowy: pierwsza odpowiedź bez poprawnych tokenów ⇒ ponowienie; komunikat po porażce zawiera **liczbę i nazwy** odrzuconych kluczy |
| AC-20, AC-21 | Klikacz: wejście na `/pogoda` **bez** wywołania modelu (licznik wywołań = 0), stan oczekiwania; klik ⇒ wynik; ponowne wejście ⇒ wynik z pamięci |
| AC-22, AC-23 | Klikacz: suwak prędkości przeżywa przeładowanie; z wyłączonym „podążaj" pozycja przewinięcia strony **nie zmienia się** przy przejściu do kolejnej wiadomości |
| AC-24 | Klikacz: strzałki zmieniają temat; test progu gestu na wartościach granicznych |

**Klikacz e2e** uruchamiamy przygotowanym skryptem (`nohup bash scripts/e2e-web.sh`), nigdy
`test:e2e:local` — w tym środowisku sieć blokuje pobieranie przeglądarek i Dockera. Żadnych
`networkidle` (`check:e2e-waits`): aplikacja trzyma otwarty strumień zdarzeń od 072, więc sieć
**nigdy** nie jest bezczynna i takie oczekiwanie może się skończyć wyłącznie przekroczeniem czasu.

---

## 9. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja |
|---|---|
| `AnchoredLayer` dotyka pięciu miejsc naraz — regresja w czymś, co dziś działa | Komponent **odtwarza** dzisiejsze zachowanie i różni się wyłącznie mieszczeniem w oknie. Każde miejsce wpinane i sprawdzane osobnym zadaniem, nie hurtem. Wpis do galerii daje ręczny podgląd wariantów brzegowych |
| Portal do `body` mógłby wyjść spod skórki | Skórka jest inline na `<html>`, a zmienne CSS dziedziczą — portal w `body` je widzi. Weryfikacja na skórce niestandardowej („Terminal") w galerii |
| Przekierowania Zadań mogą zgubić ulubiony widok właściciela | AC-6 jest kryterium akceptacji z własnym testem; przekierowania zachowują parametry filtrów |
| Podniesiony limit wyjścia agenta = droższe odpowiedzi | Limit dotyczy **wyjścia**, więc rośnie tylko przy realnie długim planie. Punkt odniesienia ze speca: dziś to dwie tury po ~60 tys. tokenów **bez wyniku** |
| Zatrzask porażki lektora mógłby utrwalić głos zapasowy po chwilowej awarii | Zatrzask jest **na sesję strony** i kasuje go zmiana głosu/konfiguracji; nie jest zapisywany w bazie |
| Przyczyn Z2 i Z10 nie ustalono z kodu | `/implement` **najpierw odtwarza błąd**, potem naprawia. Obie naprawy są dobrane tak, żeby działały w każdym wariancie przyczyny (klasa przyczyn, nie jedna) |
| Obserwatory na żądanie mogą zostać odebrane jako utrata funkcji | Wynik jest **zapamiętywany**, więc kolejne wejścia pokazują go bez klikania; użytkownik może wybrać tryb `always`, jeśli chce jak dziś |

**Wycofanie.** Kod: cofnięcie merge'a `develop` (fala jest addytywna — nie kasujemy kolumn ani
danych). Migracja: 0253 dokłada trzy kolumny z wartościami domyślnymi, więc **starszy kod działa na
nowszej bazie** — wycofanie samego kodu jest bezpieczne i nie wymaga wycofania migracji (zgodnie
z granicą build↔migracja z runbooka `docs/devops/runbook-deploy-rollback.md`).

---

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-15** — ręczna migracja `0253`, numer z `next:migration`, DDL idempotentny, bez enumów
      (C-12 odnotowane), bez wklejania `migrate diff` (C-15), weryfikacja na lokalnym Postgresie (C-13)
- [x] **C-20** — mutacje przez Server Actions z `revalidatePath`; naprawa Z3 **nie** polega na ręcznej
      inwalidacji obok akcji, tylko na usunięciu zależności od gubionego źródła
- [x] **C-21/C-17** — bez zmian w modelu własności i dostępu; zestawy projektów dziedziczą własność
      `ProjectGroup`. **Żadna reguła dostępu nie jest ruszana, więc tabela prawdy nie jest potrzebna**
- [x] **C-22** — bez nowego sluga; nowa trasa dziedziczy kontrolę uprawnienia z `/tasks/layout.tsx`
      (weryfikowane, nie zakładane)
- [x] **C-23** — `add_items` z egzekutorem, kontraktem i klasyfikacją pokrycia
- [x] **C-25** — `speech_force_browser` audytowany jak pozostałe przełączniki konfiguracji
- [x] **C-30/C-31** — wyłącznie zmienne CSS, `--on-accent` na kolorowych tłach; mobile i klawiatura
      w `AnchoredLayer`, pasku zbiorczym, lektorze i menu; `env(safe-area-inset-bottom)` zachowane
- [x] **C-32** — wszystkie nowe teksty w `messages/pl.json`; `check:i18n` jako reguła bezwzględna
- [x] **C-33** — nowa trasa Zadań przez `ModuleView` ze `state`; stan „czeka na kliknięcie"
      w Pogodzie idzie przez istniejący `AiContentPending`, nie rysowany ręcznie
- [x] **C-34** — nie dodajemy potwierdzeń; istniejące zostają na `confirmDialog`
- [x] **C-35** — `AnchoredLayer` dowieziony **razem z pięcioma konsumentami** i wpisem do galerii
- [x] **C-40/C-41** — routing modeli dalej z bazy; treść odpowiedzi dostawcy **nie** wychodzi do
      klienta, wychodzi wyłącznie kod przyczyny
- [x] **C-51** — wpisy do `doświadczenia.md` dla Z1, Z3, Z4, Z6, Z7, Z11
- [x] **C-53** — bez nowych zależności; jeden nowy komponent (zamiast pięciu łatek), zero nowych
      modeli (zestawy = istniejący `ProjectGroup`), trzy kolumny na istniejących modelach
- [x] **C-54** — komentarz z 043 na stronie głównej i komentarz z 042 w `TaskRow` **aktualizujemy**
      razem z kodem; rozjazd kod↔komentarz jest tak samo niedopuszczalny jak kod↔spec
