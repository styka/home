# Weryfikacja: Wierne ikony pogody „teraz" + strumień nowych wiadomości na telefonie

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-04
- **Zakres:** 28 kryteriów akceptacji (8× Pogoda, 20× Wiadomości)

## 1. Bramki techniczne (C-50)

| Komenda | Wynik |
|---|---|
| `node scripts/check-migrations.js` | ✅ `✔ Numeracja migracji OK (następny wolny numer: 0224)` — brak nowych migracji, zgodnie z planem §2 |
| `node scripts/check-action-coverage.js` | ✅ 160 akcji w katalogu, wszystkie z egzekutorem i kontraktem |
| `node scripts/check-ai-coverage.js` | ✅ 548 akcji z zadeklarowanym zakresem **i guardem w kodzie**; MUTACJE 159 ai / 1 pending / 220 excluded · ODCZYTY 65 ai / 3 pending / 100 excluded |
| `node scripts/check-cost-badge.js` | ✅ 34 pliki wołające model, każdy przekazuje zużycie |
| `node scripts/check-content-memory.js` | ✅ 34 pliki sklasyfikowane |
| `npm run test:unit` | ✅ **599 testów, 599 pass, 0 fail, 0 skipped** (w tym 14 nowych dla `observedWmo`/`wmo`) |
| `npx next lint --dir src` | ✅ zero zastrzeżeń w plikach zmienionych przez 044 (pozostałe ostrzeżenia to znany, wcześniejszy dług — Polish JSX quotes + exhaustive-deps w innych modułach) |
| `npx tsc --noEmit` | ✅ czysto |
| `npx next build` | ✅ `Compiled successfully`, `Generating static pages (134/134)`, exit 0. `/pogoda` 18,7 kB · `/wiadomosci` 20,4 kB |

**C-13 respektowane:** build uruchamiany do kroku `next build` przeciw **lokalnemu** Postgresowi 16
(`127.0.0.1:5432/omnia_dev`, `prisma migrate deploy` zastosował 0223 migracji). `scripts/migrate.js`
(ostatni krok pełnego `npm run build`) **nie był** uruchamiany — rusza prawdziwą bazę Neon.

## 2. Kryteria akceptacji

### Część A — Pogoda

| AC | Werdykt | Jak sprawdzone / dowód |
|---|---|---|
| **AC-A1** — opad widoczny mimo kodu „pochmurno" | ✅ | Test `pochmurno + zmierzony deszcz → ikona i opis mówią o deszczu` (`openMeteo.test.ts:11`) — `observedWmo({code:3, precip:1.2})` daje `label: "Deszcz"` i emoji różne od `wmo(3)`. Ścieżka do UI: `ForecastView.tsx:46` `observedWmo(cur)` |
| **AC-A2** — brak regresji przy zerowym opadzie | ✅ | Dwa testy: `pochmurno bez opadu → bez zmiany` (`:21`, `deepEqual` z `wmo(3)`) oraz `opad śladowy (0,05 mm) NIE uruchamia korekty` (`:27`). Próg `PRECIP_MM_MIN = 0.1` (`openMeteo.ts`) |
| **AC-A3** — każdy odsetek jawnie podpisany | ✅ | `ForecastView.tsx:69–78`: osobny wiersz `Teraz · … · szansa opadu {nowHour.precipProb}%` i osobny `Dziś … opady maks. {today.precipProbMax}%`. Żaden odsetek nie stoi bez etykiety czasowej |
| **AC-A4** — ilość opadu w mm, gdy pada | ✅ | `ForecastView.tsx:70` — `opad {mm.toFixed(1)} mm/h`, renderowane tylko gdy `precipKind(cur) !== "none"` (`:52`). `precipAmount()` przetestowane pośrednio przez progi natężenia (`:70`) |
| **AC-A5** — brak słońca po zmroku | ✅ | Test `żaden wariant nocny nie zawiera słońca` (`:75`) przechodzi po **14 kodach** (0,1,2,3,45,51,53,55,61,71,80,81,82,95) wobec listy `["☀️","🌤️","⛅","🌦️"]`. Luka domknięta dla 51–55 i 80–82 (`openMeteo.ts`, warianty nocne `🌧️`) |
| **AC-A6** — prognoza dzienna z ikonami dziennymi | ✅ | `ForecastView.tsx:159,161` — `ForecastDays` woła `wmo(d.code)` **bez** drugiego argumentu, więc `isNight=false`. Potwierdzone gerpem: to jedyne wywołania `wmo()` w komponencie |
| **AC-A7** — brak danych nie wywraca strony | ✅ | Test `brak danych o opadzie → zachowanie sprzed 044` (`:31`) sprawdza zarówno `precip: null`, jak i **całkowity brak pól**. W `fetchForecast` helper `num()` odsiewa `undefined`/`null`/`NaN` do `null` |
| **AC-A8** — ekran i AI mówią to samo | ✅ | `actions/weather.ts` — `hourlyDigest` i `digestHours` przestawione na `observedWmo`. Grep potwierdza: **jedyne** pozostałe wywołania `wmo()` w module to `wmo(d.code)` na prognozie **dobowej** (`weather.ts:179,489`, `ForecastView.tsx:159,161`) — świadome, wymagane przez AC-A6 |

### Część B — Wiadomości

| AC | Werdykt | Jak sprawdzone / dowód |
|---|---|---|
| **AC-B1** — wszystko jednym przewijaniem | ✅ | `getStreamView()` (`actions/news.ts`) zwraca **wszystkie** tematy z pozycjami `PENDING` w jednym zapytaniu; `NewsStream` renderuje je jako sekcje w jednym, ciągłym strumieniu |
| **AC-B2** — temat stale widoczny | ✅ | `NewsStream.tsx` — nagłówek sekcji `sticky top-0 z-20` z tłem `var(--bg-base)`; natywny CSS, więc podąża przez całe przewijanie sekcji, nie tylko na jej granicy |
| **AC-B3** — wybór podąża za przewijaniem | ✅ | `IntersectionObserver` (`rootMargin: "-64px 0px -55% 0px"`) wybiera sekcję **najwyżej na ekranie** spośród widocznych (sort po `boundingClientRect.top`) → `onActiveTopicChange` → `setSelectedId` w `NewsPage`, co przestawia `TopicPicker` |
| **AC-B4** — wybór przewija, nie przeładowuje | ✅ | `NewsPage.selectTopic` woła `scrollToTopicRef.current?.(id)`; `NewsStream.scrollToTopic` robi `scrollIntoView({behavior:"smooth", block:"start"})`. Żadnego `router.push` ani ponownego odczytu — dane są już wczytane |
| **AC-B5** — gest nie psuje przewijania | ✅ | `handleTouchStart`/`handleTouchEnd` — **brak** nasłuchu `touchmove` i **brak** `preventDefault`, więc przewijanie pionowe pozostaje w pełni natywne. Gest liczy się dopiero przy `|dx| ≥ 60 px` **i** `|dx| > 1.5·|dy|`; gest zaczęty na `button/a/input/textarea/select/[role=button]/[data-no-swipe]` jest ignorowany |
| **AC-B6** — temat pusty oznaczony, nie ukryty | ✅ | `getStreamView` zwraca tematy bez pozycji z `items: []` (brak filtrowania po stronie zapytania); `NewsStream` renderuje dla nich notkę „Brak nowych wiadomości w tym temacie." |
| **AC-B7** — czytelny stan pusty | ✅ | `NewsStream` — przy `totalItems === 0` komunikat z podpowiedzią „Kliknij «Odśwież» w nagłówku…"; osobny wariant, gdy pusto **przez filtr źródła** („Wróć do «Wszystkie»") |
| **AC-B8** — lektor pojedynczej wiadomości bez regresji | ✅ | `NewsItemCard` przekazuje jeden blok (`useMemo`). W `NewsReader` wszystkie dodatki są za `multi = blocks.length > 1`: skok o wiadomość, kreska rozdzielająca i rozszerzony licznik. Przy jednym bloku pasek i licznik (`${current+1}/${sentences.length}`) są **identyczne** jak przed 044 |
| **AC-B9** — lektor tematu | ✅ | Przycisk `Headphones` w nagłówku sekcji → `toggleReader({kind:"topic", topicId})`; `readerBlocks` mapuje pozycje tego tematu |
| **AC-B10** — lektor strumienia z zapowiedzią | ✅ | Przycisk „Słuchaj wszystkiego" → `{kind:"stream"}`; w `readerBlocks` **pierwsza** pozycja każdego tematu dostaje `lead: "Temat: ${t.title}"`, a `NewsReader` czyta `lead` jako osobne zdanie przed tytułem |
| **AC-B11** — widok podąża za czytanym fragmentem | ✅ | `NewsReader.onBlockChange` (wywoływane **tylko** przy faktycznej zmianie bloku, strażnik `lastReportedBlock`) → `NewsStream.handleBlockChange` → `scrollIntoView({block:"center"})` na `[data-news-item="<id>"]`. Wewnątrz karty lektora podświetlenie nadal przewija się do zdania |
| **AC-B12** — sterowanie zdanie ↔ wiadomość + stan | ✅ | `NewsReader`: pauza/wznowienie, `SkipBack`/`SkipForward` (zdanie), `ChevronLeft`/`ChevronRight` (`stepBlock`, cała wiadomość), `Square` (stop). Licznik przy wielu blokach: `wiadomość i/n · zdanie j/m`, gdzie `j/m` liczone **w obrębie wiadomości** |
| **AC-B13** — mowa milknie przy wyjściu | ✅ | Trzy ścieżki: (1) cleanup `useEffect` przy odmontowaniu → `stopSpeaking()`; (2) efekt na `blocksKey` ucisza przy zmianie zestawu bloków; (3) `toggleReader` przełącza zakres, co odmontowuje poprzedni `NewsReader`. Zmiana zakładki widoku lub trybu odmontowuje cały `NewsStream` |
| **AC-B14** — nic nie znika samo | ✅ | Grep: `acknowledgeItem(` występuje **wyłącznie** w `NewsItemCard.tsx:49`, w obsłudze kliknięcia. Brak wywołań z obserwatora przecięć i z `onEnd` lektora — obserwator zmienia tylko wskazanie tematu |
| **AC-B15** — oznacz temat | ✅ | `acknowledgeTopicItems(topicId)` — `assertTopic(topicId, user.id)` **przed** `updateMany({where:{topicId, status:"PENDING"}})`, `revalidatePath("/wiadomosci")`. UI: przycisk `CheckCheck` w nagłówku sekcji; pozostałe tematy nietknięte (warunek `topicId` w zapytaniu) |
| **AC-B16** — oznacz wszystkie, z potwierdzeniem | ✅ | `acknowledgeAllItems()` — `updateMany({where:{status:"PENDING", topic:{ownerId:user.id}}})`, filtr właściciela **w zapytaniu**. UI: `markAll()` zaczyna od `confirm(...)` z liczbą pozycji |
| **AC-B17** — pozycja przewijania zachowana | ✅ | Po `onChanged` odświeżamy dane (`loadStream`) i nie wołamy żadnego `scrollIntoView` — ekran nie skacze na górę. Pozycje mają stabilne klucze (`data-news-item={item.id}`), a przeglądarkowe `overflow-anchor` (domyślnie `auto`, nigdzie nie wyłączane) utrzymuje kotwicę przy widocznej treści |
| **AC-B18** — jedna nawigacja telefon/desktop | ✅ | Grep: w `NewsStream.tsx` **brak** jakiegokolwiek `hidden md:` / `md:hidden`. Cele dotyku `py-2`/`py-3` na przyciskach nagłówka i paska strumienia |
| **AC-B19** — brak regresji w reszcie modułu | ✅ | Gałąź `browseMode === "topic"` renderuje dokładnie dotychczasowy widok (przełącznik „Nowe wiadomości ⇄ Linia czasu", `NewsTimeline`, lista `NewsItemCard`). `ViewTabs`, `HotTopics`, `NewsSettings`, `RefreshStatus`, `RefreshHistory` nietknięte. Filtr źródeł **przeniesiony wyżej** i wspólny dla obu trybów — jedna kopia zamiast dwóch |
| **AC-B20** — wybór przeżywa odświeżenie | ✅ | `viewSpec` rozszerzony o `tryb: oneOf(["stream","topic"], "stream")` w `useViewState`; wartość startowa przychodzi **propsem z serwera** (`app/wiadomosci/page.tsx` → `searchParams.tryb` → `viewParams`), więc bez rozjazdu hydratacji. `popstate` obsługiwany przez istniejący hook |

**Podsumowanie:** 28/28 ✅ · 0 ⚠️ · 0 ❌

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| **C-01, C-02** | ✅ Cały kod w `worldofmag/`; wszystkie importy przez `@/*` (sprawdzone w 5 nowych/zmienionych plikach) |
| **C-10, C-11, C-14** | ✅ Nie dotyczy — brak zmian w schemacie i brak migracji. `check:migrations` potwierdza, że nic się nie wkradło |
| **C-12** | ✅ Nowe rodzaje jako union TS: `PrecipKind` (`openMeteo.ts`), `BrowseMode` (`NewsPage.tsx`), `ReaderScope` (`NewsStream.tsx`). Zero enumów Prisma |
| **C-13** | ✅ Build wyłącznie przeciw lokalnemu Postgresowi; `scripts/migrate.js` nie uruchamiany. `.env.local` nie jest w repo (`.gitignore`) |
| **C-20** | ✅ Obie nowe mutacje kończą się `revalidatePath("/wiadomosci")`; brak ręcznej inwalidacji gdziekolwiek indziej |
| **C-21** | ✅ `acknowledgeTopicItems` — guard `assertTopic` przed zapisem; `acknowledgeAllItems` — filtr `topic.ownerId` **w zapytaniu** (przy `updateMany` nie ma etapu na odsianie cudzych wierszy po odczycie); `getStreamView` — `where: { ownerId: user.id }`. Żadna akcja zbiorcza nie jest szerszym wektorem niż pojedyncza |
| **C-22** | ✅ Bez nowych slugów — `module.weather` i `module.news` istniały. `permissions.ts`, `modules.tsx`, `ModuleSidebar` nietknięte |
| **C-23** | ✅ Nie dotyczy — brak nowych `AIAction`. Trzy nowe akcje zadeklarowane w manifeście (`excluded`/`interactive`, `access: owner`); `check:ai-coverage` zielone |
| **C-24, C-25** | ✅ Nie dotyczy — zmiana statusu, nie usunięcie (trash bez zastosowania); brak zmian RBAC/konfiguracji (audit bez zastosowania) |
| **C-30** | ✅ Grep po nowych plikach: **zero** literałów `#rrggbb`. Wyłącznie `var(--bg-base)`, `var(--border)`, `var(--accent-blue)`, `var(--text-*)`, `var(--on-accent)` |
| **C-31** | ✅ Brak `hidden md:*` w `NewsStream` — jedna nawigacja dla obu ekranów; cele dotyku `py-2`/`py-3`; pasek lektora zachowuje `env(safe-area-inset-bottom)`; gest nie przechwytuje przewijania |
| **C-32** | ✅ Wszystkie teksty UI i zapowiedzi lektora po polsku („Temat: …", „Słuchaj wszystkiego", „Oznacz wszystkie", „Brak nowych wiadomości w tym temacie.") |
| **C-50** | ✅ Wszystkie bramki zielone (tabela §1) |
| **C-51** | ✅ Dwa wpisy w `doświadczenia.md` (2026-08-04): ikona liczona z niepobieranego pola; poziomy gest a natywne przewijanie |
| **C-53** | ✅ Zero nowych zależności. Jeden nowy komponent widoku (`NewsStream`); lektor **uogólniony**, nie zduplikowany; mapowanie pozycji na DTO wyjęte do jednej funkcji zamiast skopiowane |
| **C-54** | ✅ Jedno odstępstwo od planu wykryte i **naprawione u źródła**, nie obejściem: plan zakładał dopasowanie bieżącej godziny „po prefiksie z `current`", nie zauważając, że `CurrentPoint` nie niósł znacznika czasu. Zamiast liczyć godzinę z zegara przeglądarki (co przekłamywałoby wynik dla lokalizacji w innej strefie) dodano pole `time` do typu. Rozwiązanie zgodne z intencją planu |

## 4. Regresje

| Obszar | Sprawdzenie | Wynik |
|---|---|---|
| Widok pojedynczego tematu | Gałąź `browseMode === "topic"` renderuje niezmieniony blok: filtr treści, `NewsTimeline`, lista kart | ✅ bez zmian |
| Filtr źródeł | Przeniesiony **nad** przełącznik trybu; ta sama akcja `pickSource` → `setActiveSource`; działa w obu trybach | ✅ jedna kopia zamiast dwóch (usunięta duplikacja) |
| „Gorące tematy", „Źródła", historia odświeżeń | Pliki nietknięte; `ViewTabs` bez zmian | ✅ |
| Odświeżanie modułu | Po domknięciu przebiegu odświeżany jest **i** widok tematu, **i** strumień | ✅ rozszerzone, nie zmienione |
| `NewsReader` u innych konsumentów | Grep: jedyni konsumenci to `NewsItemCard` i `NewsStream` — oba na nowym interfejsie | ✅ brak osieroconych wywołań |
| Moduł Pogoda — „Co robić?", czujki, pomysły | `IdeasPanel`, `WatchersPanel`, `getIdeas` korzystają z digestów, które przeszły na `observedWmo` — zmiana **poprawia** opis, nie zmienia kontraktu | ✅ |
| Pamięć treści AI (`AiContent`) | Zmiana treści digestów wpływa na `hashInputs` → sekcje mogą pokazać „nieaktualne". To **informacja, nie błąd** — dokładnie zaprojektowane zachowanie z 038 | ✅ zgodne z projektem |
| Pozostałe moduły | `next build` 134/134 stron, `tsc` czysto, `check:actions`/`check:ai-coverage` na pełnym katalogu 548 akcji | ✅ |

## 5. Werdykt końcowy

### ✅ GOTOWE

Wszystkie **28 kryteriów akceptacji** spełnione, wszystkie bramki jakości zielone, brak wykrytych
regresji, brak naruszeń konstytucji.

**Ograniczenia weryfikacji — uczciwie:**
- Weryfikacja jest **statyczna i jednostkowa**: prześledzenie ścieżek w kodzie + 599 testów
  jednostkowych. Klikacze E2E (Playwright) **nie były uruchamiane** — to świadoma decyzja zapisana
  w planie §8 (na tym środowisku wymagają osobnego skryptu `scripts/e2e-web.sh`), a zakres zmian
  jest weryfikowalny bez nich.
- Zachowania czysto przeglądarkowe — **płynność gestu na fizycznym telefonie**, dokładny moment
  przełączenia przyklejonego nagłówka i **zachowanie kotwicy przewijania po usunięciu karty** —
  zostały sprawdzone przez analizę implementacji (brak `preventDefault`, progi gestu, `sticky`,
  brak wyłączenia `overflow-anchor`), a nie przez pomiar na urządzeniu. To pierwsza rzecz do
  obejrzenia na środowisku testowym po wdrożeniu na `develop`.
- Korekta ikony pogody została zweryfikowana **na danych syntetycznych** (testy jednostkowe), bo
  odtworzenie realnego rozjazdu „kod mówi pochmurno, a pada" wymagałoby trafienia na taką pogodę.
  Reguła jest jednak celowo wąska i przy braku danych degraduje do zachowania sprzed zmiany, więc
  najgorszy możliwy skutek błędu to brak korekty — nigdy fałszywy deszcz przy suchej pogodzie.
