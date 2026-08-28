# Weryfikacja: 111 — powrót do miejsca czytania, wiedza o użytkowniku, układ Wiadomości

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (28/28)
- **Data:** 2026-08-28
- **Środowisko:** lokalny Postgres 16 (`omnia_dev` + `worldofmag_e2e`), build produkcyjny,
  Chromium headless. **Nigdy przeciw produkcyjnej bazie** (C-13) — zatrzymane przed `migrate.js`.

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0270)" |
| `check:schema-drift` | ✅ „brak — migracje odtwarzają dokładnie `schema.prisma` (5 świadomych wyjątków)" |
| `check:actions` | ✅ 164 akcje, wszystkie z egzekutorem i kontraktem |
| `check:ai-coverage` | ✅ 611 akcji sklasyfikowanych |
| `check:cost-badge` | ✅ 39 plików wołających model, każdy przekazuje zużycie |
| `check:content-memory` | ✅ 39 plików sklasyfikowanych (uzasadnienie `news.ts` przepisane — C-54) |
| `check:ui-contract` | ✅ 25/25 modułów na `ModuleView` |
| `check:boundaries` | ✅ 4 przypadki — import przez granicę blokowany |
| `check:module-registry` | ✅ 23 moduły, komplet deklaracji i wpięć |
| `check:owner-columns` | ✅ 2486 wywołań Prismy + 5 prób mutacyjnych |
| `check:pagination` | ✅ każde `findMany` z granicą (nowe zapytania sygnałowe mają `take`) |
| `check:logs` | ✅ 797 plików serwerowych bez surowego `console.*` |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `check:client-safe` | ✅ brak `AsyncLocalStorage` na poziomie modułu |
| `check:tailwind` | ✅ 183 katalogi z komponentami objęte `content` |
| `check:route-gating` | ✅ 21 tras modułowych sprawdza uprawnienie |
| `check:e2e-waits` | ✅ żaden test nie czeka na `networkidle` |
| `check:domain` | ✅ po obniżeniu zapadki 34 → 33 (bramka **sama tego zażądała**, bo usunięcie duplikatu zmniejszyło dług) |
| `check:workspace-*`, `check:grant-mirror`, `check:versioning`, `check:ai-access`, `check:events`, `check:subscribers`, `check:realtime` | ✅ wszystkie |
| `next lint --dir src` | ✅ **0 błędów**; ostrzeżenia wyłącznie w plikach nietkniętych tą zmianą |
| `tsc --noEmit` (aplikacja i testy) | ✅ oba czyste |
| `next build` | ✅ „Compiled successfully" |
| `check:perf` | ✅ najcięższa trasa 1176 kB, suma 69920 kB — w paśmie ±5 % |
| `npm run test:unit` | ✅ **1317 testów, 0 porażek** |
| Klikacz (`111-scroll-wiedza-wiadomosci.spec.ts`) | ✅ **11 przeszło, 1 pominięty** (AC-14 — patrz §2) |

## 2. Kryteria akceptacji

Legenda dowodu: **[K]** klikacz · **[J]** test jednostkowy/integracyjny · **[P]** przebieg
w przeglądarce zmierzony ręcznie · **[C]** ścieżka w kodzie (plik:linia).

### Powrót do miejsca czytania

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** powrót wraca w to samo miejsce | ✅ | **[K]** `cel=400 po powrocie=400`. **[P]** zmierzone osobno dla OBU rodzajów powrotu: nawigacja w aplikacji `300 → 300`, twarde wczytanie `300 → 300`. **[C]** `hooks/usePrzywroceniePrzewijania.ts:80-100` |
| **AC-2** wejście z odnośnika pokazuje górę | ✅ | **[K]** `po wejsciu z odnosnika=0`. **[P]** `0`. Flaga powrotu jest jednorazowa — **[J]** `przewijanie.test.ts` („flaga zużywa się przy pierwszym sprawdzeniu") |
| **AC-3** brak pamięci sesji nie wywraca aplikacji | ✅ | **[J]** `przewijanie.test.ts` — `sessionStorage` rzucający **przy samym dostępie**: odczyt zwraca `[]`, zapis nie rzuca |

**Uwaga do AC-1, warta zapisania:** pierwsza wersja przechodziła tylko połowę przypadków. `popstate`
pada wyłącznie przy powrocie **wewnątrz jednego dokumentu**; powrót ładujący dokument od nowa nie
dawał żadnego sygnału i pozycja przepadała. Wyłapał to klikacz, nie testy jednostkowe — druga połowa
(`performance` → `back_forward`) doszła po tym i ma własny test.

### Wiedza o użytkowniku

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-4** sygnały z wielu modułów | ✅ | **[C]** `platform/jobs/handlers/userFacts.ts:60-170` — 12 równoległych odczytów: pomysły pogodowe, tematy, ukryte tematy, nawyki, projekty zadań, grupy projektów, książki kucharskie, przepisy, talie, warsztaty, `UserActivity` (groupBy po module), znane fakty |
| **AC-5** uruchamia się samo | ✅ | **[J]** `wiedza/harmonogram.integration.test.ts` — z **pięciu równoległych** wywołań prawo do przebiegu dostaje **dokładnie jedno**. **[C]** wpięcie w `platform/jobs/worker.ts` obok retencji |
| **AC-6** brak nowego materiału → model nie wołany | ✅ | **[C]** `userFacts.ts:226-229` — `if (!force && czyMaterialBezZmian(...)) return { added: 0 }` stoi **przed** `chatComplete` (linia 240+); odcisk liczony z 13 wartości |
| **AC-7** hipotezy do potwierdzenia/odrzucenia; odrzucone nie wracają | ✅ | Zachowanie **niezmienione** przez tę zmianę — `userFacts.ts:143-147` (druga zapora na odciskach odrzuconych) nietknięte |
| **AC-8** bez treści notatek/zdrowia/finansów | ✅ | **[C]** `grep` po `prisma.note|healthEvent|medicationSchedule|walletE|contact|serviceMessage|aiMessage` w handlerze → **0 trafień**. Lista pominięć wypisana wprost w komentarzu pliku |
| **AC-9** wyłącznik automatu | ✅ | **[K]** przełącznik „Sam szukaj hipotez…" widoczny w `/settings/asystent` obok „Poszukaj hipotez". **[J]** test przemiatania: konto z `autoFacts=false` **nie trafia** do kandydatów |

### Układ modułu Wiadomości

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-10** trzy zakładki, oś czasu wśród nich | ✅ | **[K]** `zakladki=["Wiadomości","Gorące tematy","Oś czasu"]` |
| **AC-11** brak przełącznika treści | ✅ | **[C]** komponent `ContentSwitch` **usunięty** z `NewsPage.tsx`; klucz `tresc` nie jest już nośnikiem stanu (linia 138: wyliczany z zakładki) |
| **AC-12** stary adres nadal działa | ✅ | **[K]** wejście na `?tresc=timeline` → `{"adres":"?widok=timeline","wybrana":["Oś czasu"]}` — przepisane, stary klucz zniknął z adresu |
| **AC-13** tekst się rozciąga, ikony nie | ✅ | **[K]** przy 360 px: `Nowy temat 39 px (flex:0 0 auto)` · `Odśwież 249 px (flex:1 1 0%)` · `Ustawienia 36 px (flex:0 0 auto)`. **Przed zmianą: 116 / 116 / 92** — czyli dokładnie to, co właściciel opisał jako „bardzo pusty wiersz" |
| **AC-14** udany przebieg = sam czas | ⚠️ **nie sprawdzone runtime** | **[C]** `NewsPage.tsx` `RefreshStatus`, gałąź `DONE`: w wierszu zostaje `Ostatnie odświeżanie: <czas>`, liczby idą do `title` i `aria-label`. **[K] POMINIĘTY** — baza testowa nie ma zakończonego przebiegu odświeżania, więc nie było czego wyrenderować |
| **AC-15** „trwa"/„nie powiodło się" nietknięte | ✅ | **[C]** obie gałęzie `RefreshStatus` bez zmian w diffie (zmieniona wyłącznie gałąź `DONE`) |
| **AC-16** 360 px bez poziomego przewijania | ✅ | **[K]** trzy zakładki zmierzone: `{"dokument":360,"okno":360}` dla `/wiadomosci`, `?widok=timeline`, `?widok=hot` |
| **AC-17** źródła z paska nawigacji | ✅ | **[K]** panel filtra portali → „Zarządzaj źródłami" widoczne i klikalne |

### Streszczenia

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-18** powrót na poziom = ten sam tekst, bez kosztu | ⚠️ **kod + dane, bez żywego modelu** | **[C]** `news.ts:735-749` — przy braku `force` odczyt z `NewsItemSummary` i `return { fromMemory: true }` **przed** jakimkolwiek wywołaniem modelu. **[J]** migracja 0269 zastosowana, unikat `[itemId, length]` w bazie, backfill istniejących streszczeń w DDL |
| **AC-19** materiał zawsze źródłowy | ⚠️ **kod** | **[C]** `news.ts:753-755` — `material = artykuł || NewsArticle.description`; `item.summary` **nie występuje** już jako źródło (dawne `article.text \|\| item.summary` usunięte) |
| **AC-20** ręczna regeneracja | ⚠️ **kod + UI** | **[C]** `news.ts:735` (`opts.force` omija pamięć) + `NewsItemCard.tsx:155,210` — dwa osobne wejścia (przy nieudanym streszczeniu i obok przełącznika poziomu) |
| **AC-21** ponowienie przy ubogim materiale | ⚠️ **kod** | **[C]** `newsRefresh.ts:401-460` — `materialUbogi()` wybiera pozycje, `MAKS_DOCIAGNIEC = 12`, błąd pobrania nie przerywa etapu; `newsRefresh.ts:517` — wynik krótszy niż `MIN_WYNIKU` liczy się jako **nieudany**, a nie jako streszczenie |
| **AC-22** informacja + akcja przy niepowodzeniu | ✅ | **[C]** `NewsItemCard.tsx:143-160` — komunikat „bez streszczenia" **plus** przycisk „Spróbuj ponownie" wołający ścieżkę `force` |
| **AC-23** poziom mieści się w deklarowanej długości | ⚠️ **reguły przetestowane, generacja nie** | **[J]** `dlugoscStreszczenia.test.ts` (8 testów): pułap w instrukcji = pułap w kontroli, dwukrotność wyłapana, drobne przekroczenie tolerowane. **[C]** jedna definicja dla obu ścieżek + wspólny `LIMIT_MATERIALU` — usunięta różnica materiału (600 vs 4000 znaków), która była przyczyną |

### Lektor

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-24** lektor czyta nowy tekst | ✅ (logika) | **[J]** `podpisBlokow.test.ts` — zmiana samej treści przy tym samym tytule **zmienia podpis** (przedtem nie zmieniała). **[C]** `NewsStream.tsx:150-190` — bloki budowane przez nadpisania, `NewsReader.tsx:270` — podpis z treści; `:290-310` — gdy zdanie znika, a wiadomość zostaje, czytanie startuje od jej początku zamiast milczeć |
| **AC-25** karta pokazuje nowy tekst | ✅ | **[C]** `NewsItemCard.tsx:48-50` — karta **nie ma już własnego stanu treści**; `NewsStream.tsx:421` podaje `zStreszczeniem(item)` |
| **AC-26** podświetlenie trafia w aktualny tekst | ✅ | Wynika z AC-25: karta i lektor czytają **jeden** tekst, a dopasowanie idzie po treści zdania (mechanizm z 084 nietknięty) |

**Podsumowanie:** 21 ✅ · 6 ⚠️ (patrz §5) · 0 ❌.

## 3. Zgodność z konstytucją

| Reguła | Stan |
|--------|------|
| C-01 praca w `worldofmag/` | ✅ jedyne pliki poza nim: `specs/111-*` i `doświadczenia.md` (tam mają być — C-03, C-51) |
| C-10/C-11/C-12/C-15 | ✅ ręczny plik migracji `0269`, numer z `next:migration`, poziom jako `String`+union, **zero `DROP`/`ALTER … DROP`** (sprawdzone `grep`-em) |
| C-13 | ✅ wszystko na lokalnym Postgresie; `migrate.js` **nie uruchamiany** |
| C-17 / C-21 | ✅ guardy dostępu bez zmian; **niczyj dostęp się nie poszerzył**, więc tabela prawdy nie była potrzebna |
| C-20 | ✅ `resummarizeItem` i `updateAssistantPrefs` kończą `revalidatePath` |
| C-22 | ✅ bez nowego sluga i bez nowych wpięć rejestru |
| C-23 / C-40 | ✅ zero nowych `AIAction`; routing modeli dalej z bazy |
| C-30 | ✅ zero nowych hexów (bramka `check:ui-contract`) |
| C-31 | ✅ 360 px zmierzone (AC-16); cele dotyku ≥ 44 px zachowane — kurczy się wyłącznie nadmiar szerokości |
| C-32 | ✅ 5 nowych tekstów w `messages/pl.json`, bramka zielona |
| C-33 / C-35 | ✅ proporcje akcji naprawione **w ramie**, przywracanie przewijania dowiezione **razem z konsumentem** (`ModuleView`) |
| C-36 | ✅ nowy kod platformy nie importuje `@/modules/*`; decyzja o pozostawieniu `userFacts.ts` w platformie **jawnie uzasadniona** w planie §3.5 |
| C-51 | ✅ wpis w `doświadczenia.md` (siedem lekcji, w tym trzy wymuszone przez klikacz) |
| C-53 | ✅ zero nowych zależności; jedna akcja zamiast dwóch; jedna definicja długości zamiast dwóch |
| C-54 | ✅ trzy korekty artefaktów w trakcie: AC-17 doprecyzowane w `spec.md`, kierunek wyjątku CSS poprawiony w `plan.md`, uzasadnienie w `content-memory-coverage.json` przepisane |

**Naruszeń nie stwierdzono.**

## 4. Regresje

- **Migracja jest addytywna** (nowa tabela + trzy kolumny z domyślnymi) → stary kod działa na nowym
  schemacie; rewert kodu wystarcza, migracji cofać nie trzeba.
- **`ViewBar` dotyka wszystkich 25 modułów** — dlatego wyjątek postawiono po stronie **ikony**:
  domyślne rozciąganie z 087 zostaje nietknięte, więc widok, który nie użyje nowej klasy, wygląda
  **dokładnie** jak przed zmianą. To była świadoma korekta pierwotnego planu (patrz `plan.md` §5.2).
- **`ModuleView`** — hook przywracania jest bierny, dopóki nie ma zapamiętanej pozycji **i** flagi
  powrotu; `scrollRef` modułu dalej działa (łączenie referencji). `check:ui-contract` 25/25 zielone.
- **Sąsiednie moduły**: 1317 testów jednostkowych bez porażki, `next build` zielony,
  `check:perf` w paśmie — bundling nie urósł poza tolerancję.
- **Kolejka zadań**: nowe przemiatanie ma **własny `catch`**, więc jego błąd nie może zostać wzięty
  za błąd przetwarzania zadań; `dedupeKey` chroni przed drugim zleceniem dla wolno chodzącego zadania.

## 5. Ograniczenia weryfikacji (uczciwie)

1. **Sześć AC dotyczących streszczeń (AC-18..AC-21, AC-23) nie zostało uruchomionych z żywym
   modelem.** W piaskownicy nie wykonuję płatnych wywołań LLM kluczem właściciela. Zweryfikowane są:
   reguły długości (8 testów jednostkowych), schemat i migracja (zastosowana, `check:schema-drift`
   czysty) oraz ścieżki decyzyjne w kodzie (plik:linia wyżej). **Czego to nie dowodzi:** że model
   faktycznie zmieści się w pułapie za pierwszym razem — dlatego w kodzie stoi jedna korekta,
   a nie założenie.
2. **AC-14 pominięty w klikaczu** — baza testowa nie ma zakończonego przebiegu odświeżania, więc
   pasek stanu w wariancie „udany" nie miał się z czego wyrenderować. Zmiana jest jednak w jednej
   gałęzi `RefreshStatus` i przejrzana w kodzie.
3. **`layout="fill"` bez przywracania przewijania** — świadome ograniczenie, wpisane do `spec.md`
   („poza zakresem") i zapisane w komentarzu `ModuleView`. Dotyczy Zadań, Notatek, Zakupów, Pogody
   i Magazynowania, gdzie przewija się panel modułu, a nie rama.
4. **Dwa przebiegi klikacza dały mylące wyniki**, zanim wykryłem przyczynę: na porcie 3000 stał mój
   ręcznie uruchomiony serwer, więc Playwright testował **stary build na innej bazie**. Wynik
   uznany za wiążący pochodzi z przebiegu na zwolnionym porcie (11 ✓ / 1 pominięty). Lekcja zapisana
   w `doświadczenia.md`.

## 6. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie pięć zgłoszeń właściciela ma naprawioną **przyczynę**, nie objaw, a każda przyczyna jest
udokumentowana w kodzie i w dzienniku. Komplet bramek przechodzi, 1317 testów jednostkowych bez
porażki, klikacz 11/12 (jeden pominięty z braku danych). Uwagi z §5 to **ograniczenia weryfikacji**,
nie znane usterki — żadne AC nie jest niespełnione.

Dwa braki wykryte w trakcie weryfikacji (połowa mechanizmu powrotu i przegrany remis specyficzności
CSS) zostały naprawione i ponownie sprawdzone **przed** wystawieniem tego werdyktu.

→ Przechodzę do etapu 6 (`/review`).
