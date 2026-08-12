# Dziennik przebudowy — co zrobiono

> **Po co ten rozdział.** Reszta dokumentu opisuje stan **docelowy**. Ten opisuje stan
> **faktyczny**: co z 46 zadań checklisty zostało zrobione, a co nie. Bez niego kolejna sesja
> musiałaby wnioskować o postępie z historii gita — czyli zgadywać.
>
> **Zasada prowadzenia:** każdy przebieg pipeline'u dopisuje tu swój wpis i aktualizuje tabelę
> statusów. To część definicji „gotowe", nie dobra wola.

---

## Gdzie jesteśmy

**Faza 0 (siatka bezpieczeństwa) jest UKOŃCZONA.** Przebiegi 045/045b dowiozły warstwę, która
w checkliście nie ma numeru (rozdz. 10.4–10.5 — system komponentów i kontrakt widoku), oraz komplet
zadań 1–3 Fazy 0. Rozdz. 13 nazywał je „bezwarunkowo pierwszymi": *refaktor bez siatki bezpieczeństwa
to nie refaktor, tylko przepisywanie z nadzieją*.

**ZADANIE 5 JEST DOMKNIĘTE. Wszystkie 21 modułów stoi w `src/modules/`.** Trzy przebiegi: 046
postawił warstwę `src/platform/`, granicę egzekwowaną lintem i bramkami oraz deklarację
`defineModule` (4 moduły), 047 powtórzył wzorzec na siedmiu, 048 domknął pozostałe dziesięć — w tym
najbardziej sprzężone jądro: Zadania, Zakupy, Portfel, Kalendarz i pulpit.

**Lista przejściowa nie istnieje.** Tablica `LEGACY` została usunięta jako martwy kod, a
`PERMISSIONS` zawiera już wyłącznie powierzchnie **spoza** rejestru modułów: `SETTINGS`, `ADMIN`,
`INVITATIONS` i pięć podupranień Kuchni. To jest sprawdzalny dowód, że cel „8 → 1" z rozdz. 9.3
został osiągnięty: **żadnego sluga modułu nie ma już w równoległej liście.**

**Powłoka nie importuje wnętrza żadnego modułu.** Nawigacja boczna sześciu modułów przychodzi
z deklaracji (`sideNav`, ładowane leniwie), a globalny asystent został wyprowadzony z pulpitu do
`components/assistant/`.

**FAZA 1 JEST DOMKNIĘTA W CAŁOŚCI.** 049 dowiozło zadania 4 i 8 oraz kalendarzową połowę
zadania 7; 050 domknęło drugą połowę — **migawkę pulpitu**. Trasa `src/app/page.tsx` importowała
osiem kontraktów modułów i miała dziesięć gałęzi na uprawnienia; było to ostatnie miejsce w całej
aplikacji, w którym dodanie modułu wymagało edycji cudzego pliku.

**Odpowiedź na pytanie kontrolne z rozdz. 14 nie ma już przypisu:** *ile miejsc trzeba dotknąć, żeby
dodać moduł?* → **jeden katalog plus wpięcie w korzeń kompozycji.** Nie jest to deklaracja dobrych
chęci: `check:module-registry` ma dziś **osiem kontroli** i wywala build, gdy moduł opisze się poza
swoim katalogiem — łącznie z trasą pulpitu.

**FAZA 2 JEST OTWARTA.** 051 dowiozło zadanie 9: cztery modele fundamentu współdzielenia
(`Workspace`, `WorkspaceMember`, `ResourceGrant`, `ResourceInvitation`) **wraz z danymi** — każdy
istniejący zespół i każde konto ma już swoją przestrzeń. Aplikacja nadal liczy dostęp przez
`ownerId`/`ownerTeamId`; przestrzenie są na razie **lustrem, nie zamiennikiem**.

**052 dowiozło zadanie 10:** `requireAccess` istnieje w platformie, a Zadania są jego pierwszym
konsumentem. Nadania z 051 mają wreszcie czytelnika.

**Następny krok: zadanie 11** — `workspaceId` na 46 modelach. Rozdz. 8.10 nazywa je **najbardziej
ryzykownym krokiem całej przebudowy** i wymaga czterech osobnych etapów.

---

## Status 46 zadań

Legenda: ✅ zrobione · 🟡 częściowo · ⬜ nietknięte

### Faza 0 — Siatka bezpieczeństwa

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 1 | Klikacz ścieżki szczęśliwej dla 21/21 modułów | ✅ | `e2e/specs/modules-happy-path.spec.ts` — 25/25 zielonych. Lista modułów **wywodzona z rejestru** `src/lib/modules.tsx`, więc nowy moduł jest pokryty automatycznie |
| 2 | Generowany test izolacji najemcy | ✅ | `tenantIsolation.integration.test.ts` — lista 46 modeli z `ownerId` **generowana ze `schema.prisma`**; 37 zweryfikowanych, 9 pominiętych (wymagają relacji) i jawnie raportowanych. Zero wycieków |
| 3 | Bramka rozjazdu `schema.prisma` ↔ migracje | ✅ | `check:schema-drift` w buildzie; pomija bez `DATABASE_URL` i na zdalnej bazie (C-13); 2 świadome wyjątki dla granic Prismy |

### Faza 1 — Granice modułów

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 4 | `src/platform/` — przeniesienie wspólnych zdolności | ✅ | **049: domknięte.** Poza tym, co przeniosły 046–048, w platformie są `ai`, `llm` i `jobs`. `grep "@/modules/"` po `src/platform/` zwraca **zero**. Kod modułowy z tych warstw (egzekutory, read-toole, handlery zadań) wrócił do modułów |
| 5 | `src/modules/<x>/` — moduł po module | ✅ | **21 z 21.** 046: Trasy TIR, Kontakty, Raporty, QA · 047: Nawyki, Nauka języków, Warsztaty, Magazynowanie, Notatki, Flota, Zdrowie · 048: Wiadomości, Pogoda, Usługi, Kuchnia, Zwierzęta, Portfel, Zakupy, Zadania, Kalendarz, Strona główna. Każdy osobnym commitem. **Lista przejściowa usunięta** |
| 6 | `contract.ts` + reguła ESLint blokująca import przez granicę | ✅ | Dwie reguły `no-restricted-imports` (moduł↔moduł, platforma↛moduł) + bramka `check:boundaries`, która sama je łamie i wymaga błędu. Sprawdzone: wyłączenie reguły **i** zepsucie konfiguracji czerwienią bramkę |
| 7 | `defineModule` + wyprowadzenie rejestru, uprawnień, nawigacji | ✅ | Wszystkie 21 modułów deklaruje się jednym plikiem. `PERMISSIONS` zawiera już tylko powierzchnie spoza rejestru. Nawigacja boczna sześciu modułów pochodzi z pola `sideNav` (leniwie). Bramka `check:module-registry` wykrywa też moduł pisany „po staremu". **049: kalendarz wynika z deklaracji** (pole `calendar`, 7 wkładów, agregat schudł z 227 do 32 linii). **050: migawka pulpitu też** — 11 wkładów, trasa bez importów modułów, równoważność udowodniona zrzutem runtime pole po polu |
| 8 | Migracja asystenta AI na katalog składany z deklaracji | ✅ | **049.** Katalog akcji, egzekutory i 56 narzędzi odczytu pochodzą z pola `ai` w deklaracji; `buildAiCatalog` w platformie bierze wkłady parametrem. `check:actions` pilnuje mocniejszej własności: moduł z akcjami **musi** deklarować `ai` |

### Faza 2 — Współdzielenie i współbieżność

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 9 | Modele `Workspace`, `WorkspaceMember`, `ResourceGrant`, `ResourceInvitation` | ✅ | **051.** Cztery modele + migracja 0226 **z backfillem** (rozdz. 8.10 kroki 1–2): przestrzeń osobista na konto, zespołowa na zespół wraz ze składem. Lustro utrzymywane w przód (`platform/workspaces`), pilnowane bramką `check:workspace-mirror` i testem z testem negatywnym. Zero przełączonych odczytów |
| 10 | `platform/sharing` — `requireAccess`, dziedziczenie, cache | ✅ | **052.** Platforma bez importu modułu (katalog parametrem wymaganym); Zadania jako pilot; **tabela prawdy 25 komórek identyczna** przed i po; read-tool asystenta przez wspólne sprawdzanie z testem obejścia. Cache per żądanie — bez unieważniania, bo nie ma czego unieważniać |
| 11 | Migracja `ownerId`/`ownerTeamId` → `workspaceId` na 46 modelach | ⬜ | **Najgroźniejsze zadanie całej przebudowy** |
| 12 | Migracja `TaskProjectMember`/`TaskShare`/`PetShare` → `ResourceGrant` | ⬜ | |
| 13 | Deklaracje `resources` w `module.ts` | ⬜ | |
| 14 | `ShareDialog`, „Udostępnione mi", „Co udostępniłem" | ⬜ | Kontrakt widoku przyjmuje już prop `resource` — patrz wpis 045 |
| 15 | Kolumna `version` + `updateMany` z warunkiem na wersji | ⬜ | |
| 16 | `ConflictDialog` | ⬜ | j.w. |
| 17 | Test odwołania dostępu | ⬜ | |
| 18 | Test kontraktowy read-tooli AI | ⬜ | |

### Faza 3 — Domena i paginacja

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 19 | `domain/` w każdym module + testy bez bazy | ⬜ | |
| 20 | Paginacja kursorowa we wszystkich widokach listowych | ⬜ | `DataList` ma gotowy `onEndReached` — patrz wpis 045 |

### Faza 4 — Zdarzenia i koniec odpytywania

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 21 | `DomainEvent` + zapis w tej samej transakcji | ⬜ | |
| 22 | Publikacja przez worker | ⬜ | |
| 23 | SSE `/api/events` | ⬜ | |
| 24 | Usunięcie `setInterval` z `DataFreshness` | ⬜ | Interwał 45 s **nadal działa**; 045 tylko go uwidocznił |
| 25 | Subskrypcje międzymodułowe | ⬜ | |

### Faza 5 — Skala i koszt

| # | Zadanie | Status |
|---|---------|--------|
| 26 | Współdzielony rate-limit | ⬜ |
| 27 | Budżety AI | ⬜ |
| 28 | Pula połączeń, audyt N+1, indeksy | ⬜ |
| 29 | Cache agregatów i rozstrzygnięć dostępu | ⬜ |
| 30 | Retencja danych | ⬜ |

### Faza 6 — Obserwowalność i procesy

| # | Zadanie | Status |
|---|---------|--------|
| 31 | Logi strukturalne | ⬜ |
| 32 | Metryki na `/admin/health` | ⬜ |
| 33 | Rozdzielenie `web` / `worker` / `cron` | ⬜ |

### Faza 7 — Wielojęzyczność

| # | Zadanie | Status |
|---|---------|--------|
| 34 | `next-intl` | ⬜ |
| 35 | Wyciągnięcie tekstów do `messages/pl.json` | ⬜ |
| 36 | Zmiana `C-32` w konstytucji | ⬜ |
| 37 | Formatowanie `Intl` + język przestrzeni | ⬜ |
| 38 | Język przestrzeni w promptach AI | ⬜ |

### Faza 8 — Gotowość produkcyjna

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 39 | Eksport danych użytkownika | ⬜ | |
| 40 | Usunięcie konta | ⬜ | |
| 41 | Próba odtworzenia z kopii + runbook | ⬜ | |
| 42 | **Stany błędów i puste w każdym module** | ✅ | 21/21 modułów na kontrakcie widoku, bramka `check:ui-contract` wpięta w build |
| 43 | Budżet wydajnościowy w CI | ⬜ | |

### Faza 9 — Domknięcie

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 44 | Aktualizacja `CLAUDE.md` i konstytucji | 🟡 | Opisany kontrakt widoku, silnik skórek, obie nowe bramki; konstytucja ma C-33/C-34/C-35. Reszta czeka na Fazy 1–8 |
| 45 | Aktualizacja `/admin/architecture` i tego dokumentu | 🟡 | |
| 46 | Wersja **Omnia 🧐** — wpis w historii wersji | ⬜ | |

---

## Luka w dokumencie źródłowym

**Rozdz. 10.4 i 10.5 — system komponentów i kontrakt widoku — nie mają numeru w checkliście**,
choć rozdz. 10 opisuje je jako konkretny, udokumentowany dług (przycisk zapisu widoku z wersji 043).
Checklista wspomina o nich tylko pośrednio, przez zadanie 42 („stany błędów i puste w każdym module").

To jest przeoczenie w dokumencie, nie w planie. Odnotowane, żeby kolejna sesja nie uznała tej pracy
za samowolkę spoza zakresu.

---

## Wpisy przebiegów

### 045 — System komponentów, kontrakt widoku i silnik skórek · 2026-08-04

**Specyfikacja:** `specs/045-system-komponentow-i-skorki/`

**Co zrobiono**

- **Migracja 21/21 modułów na kontrakt widoku.** Bez wyjątków „inny układ" w manifeście.
- **Sweep zaszytych kolorów: 73 podmiany.** Zero pozycji „do poprawy" — każdy pozostały literał
  (29 plików) ma świadome uzasadnienie: paleta danych z rekordów użytkownika, semantyka niezależna
  od motywu (przeterminowana żywność, progi magazynowe) albo ilustracja (logo, etykiety QR do druku,
  poradnik ze zrzutami).
- **Cztery skórki flagowe:** „Mostek", „Papier", „Terminal", „Zen" — dwa bieguny ciemny/jasny razy
  dwa charaktery (efektowny/oszczędny). Każda z kontrastem liczonym w testach.

- **Kontrakt widoku** (`components/ui/view/`): `ModuleView`, `ViewBar`, `ViewChrome`, `ViewState`,
  `ChromeFrame`. Moduł deklaruje tytuł, filtry, akcje i stan; ramę rysuje powłoka.
  Rozwiązanie odwraca zależność opisaną w 043: `AppShell` nie rysuje paska (nie zna tytułu modułu,
  więc dostałby podwójne nagłówki w ~20 modułach), tylko **udostępnia jego zawartość** przez
  `ViewChromeProvider`. Gwiazdka „zapisz widok", wskaźnik świeżości i wejście do ściągawki skrótów
  pojawiają się w pasku bez wiedzy modułu — **dług z 043 spłacony**.
- **Prop `resource`** przyjmowany od początku, choć dziś nieaktywny — żeby `ShareDialog`,
  `ConflictDialog` i awatary obecności (zadania 14, 16) dało się dołożyć bez wracania do 21 modułów.
- **Komponenty wspólne:** `ConfirmDialog`, `Field`, `DataList` (j/k, zaznaczanie; `onEndReached`
  gotowe pod zadanie 20), `BulkActionBar`.
- **Silnik skórek** rozszerzony daleko poza kolory: typografia, gęstość, zaokrąglenia, obramowania,
  cienie, tło (gradienty CSS), ruch, chrom powłoki. **Bez zmiany schematu** — `Skin.tokens` to JSON.
  Sanityzacja przepisana na whitelisty per rodzaj: `linear-gradient(` przechodzi, `url(`, `paint(`,
  `attr(` nie.
- **Skórki flagowe „Mostek" i „Papier"** (migracja 0224) z kontrastem **liczonym w testach**, nie
  ocenianym wzrokiem.
- **Generowanie skórki opisem słownym przez AI** — zakres dodany przez właściciela w trakcie
  przebiegu. Model **proponuje, nigdy nie zapisuje**; wynik przechodzi tę samą sanityzację co import
  pliku, bo model jest źródłem równie obcym.
- **Playground napisany od zera** — wywodzi listę z rejestru, więc nowy komponent pojawia się w nim
  sam; sterowanie właściwościami na żywo, warianty brzegowe, lokalny przełącznik skórki.
- **Bramka `check:ui-contract`** wpięta w `build`.

**Czego świadomie NIE zrobiono**

- Faza 0 i pozostałe fazy przebudowy — zgodnie z zasadą „jedna faza = jeden przebieg".

**Punkt kontrolny kontraktu (C-54)**

Plan zakładał sprawdzian: jeśli `ModuleView` nie uniesie najbardziej nietypowych widoków, wracamy do
planu zamiast obchodzić problem w module. **Nie uniósł** — i kontrakt został poszerzony **trzy razy**,
za każdym razem z tego samego powodu:

1. **`breadcrumb`** — link powrotny powtarzał się w ośmiu widokach podrzędnych, za każdym razem
   z innym odstępem i rozmiarem ikony.
2. **`layout="fill"`** — moduły wielopanelowe mają osobne przewijanie panelu bocznego i listy;
   kolumnowa rama narzuciłaby im jeden scroll na całość, czyli przebudowę układu.
3. **`density="compact"`** — Zadania, Zakupy i Notatki mają celowo gęsty pasek 48 px; standardowy
   nagłówek 22 px dołożyłby drugi wiersz chromu tam, gdzie liczy się każdy piksel listy.

Wszystkie trzy zmiany są **w kontrakcie**, nie w modułach. Efekt: ani jeden moduł nie figuruje
w manifeście jako wyjątek z powodu „inny układ". To jest test, który kontrakt zdał — bo poszerzenie
ramy jest tanie i jednorazowe, a wyjątek w module byłby długiem w dwudziestu miejscach.

**Decyzje warte zapamiętania**

- `--font-family-*` to **słowo kluczowe z zamkniętej listy**, nie dowolny stos czcionek. Dowolny
  `font-family` jest najtrudniejszym do sanityzacji tokenem (cudzysłowy i przecinki są w nim
  legalne), a stosy systemowe nie powodują żądań do sieci.
- Zaokrąglenia i gęstość zostały **wąskie** (px, max 3 cyfry). Promień w `em` skaluje się z tekstem,
  a `1000px` to nie zaokrąglenie, tylko awaria układu.
- Widoczność ramek narożnych rozstrzyga atrybut `data-chrome-frame` renderowany **serwerowo**, a nie
  odczyt tokenu w `useEffect` — inaczej dekoracja mignęłaby po hydratacji.
- `.omnia-skeleton` przeniesione z tekstowego dziecka `<style>` do `globals.css`. React escapuje tam
  cudzysłowy tylko na serwerze, a rozjazd hydratacji kładzie **całą** aplikację.

**Nawrót z weryfikacji**

`/verify` odrzucił pierwszą wersję z werdyktem DO POPRAWY — i słusznie. Powstały wspólne komponenty,
których **żaden moduł nie używał**: `ConfirmDialog` istniał, a w kodzie było 52 wywołania natywnego
`window.confirm()`. To jest dokładnie ten rodzaj długu, który cały ten przebieg spłaca: rozwiązanie
zadeklarowane, ale niewpięte, wygląda w raporcie jak zrobione i nie zmienia niczego dla użytkownika.

Domknięcie:
- **52 wywołania `window.confirm()` → wspólne okno aplikacji.** Natywne okno nie zna skórki, ma
  przyciski w języku systemu i blokuje wątek, więc nie da się przy nim pokazać, co zostanie usunięte.
  Podmiana jest jednolinijkowa w miejscu wywołania (`ConfirmProvider` z API obietnicowym), bo inaczej
  nikt by jej nie zrobił w 52 plikach.
- **Dwie implementacje stanu pustego scalone w jedną.** `ui/home/EmptyState` (21 widoków) stał się
  cienką nakładką na `ViewEmpty` z kontraktu. Przepisywanie 21 wywołań byłoby błędem — stan pusty
  bywa SEKCYJNY (pusta lista wewnątrz jednej z sekcji), a `ModuleView.empty` opisuje stan CAŁEGO
  widoku. Jedna implementacja, dwa wejścia.
- **Dwie implementacje pola formularza scalone.** `Field` w module Zwierząt robił mniej niż wspólny
  (etykieta wiązana tylko zagnieżdżeniem, bez `id`, więc błąd nie miał się do czego podpiąć przez
  `aria-describedby`).
- **`DataList` i wspólny `BulkActionBar` USUNIĘTE.** Nie miały konsumenta. Komponent bez użycia jest
  gorszy niż jego brak: w playgroundzie ogłasza wspólne rozwiązanie, którego nikt nie stosuje.
  Pasek akcji zbiorczych z rozdz. 10.6 zostaje **otwarty** — Zadania mają własny, z popoverami
  kotwiczonymi we własnym kontenerze, a wyprowadzenie go stanie się sensowne dopiero, gdy drugi moduł
  będzie potrzebował akcji zbiorczych. Lista z nawigacją `j`/`k` wraca przy zadaniu 20 (paginacja
  kursorowa), bo i tak wymaga zmian w zapytaniach.

### 045b — Domknięcie: dokumentacja, bramka rozjazdu, weryfikacja klikaczami · 2026-08-04

Uzupełnienie tego, bez czego praca z 045 by się nie utrzymała.

- **`CLAUDE.md` opisuje kontrakt widoku, zakaz `window.confirm()`, rozszerzony silnik skórek,
  generowanie skórki przez AI oraz obie nowe bramki.** To była najpoważniejsza luka: bramka trzymała
  nowe moduły, ale żaden dokument nie mówił, czego użyć — więc następna sesja i tak napisałaby własny
  nagłówek.
- **Konstytucja pipeline'u dostała `C-33`, `C-34` i `C-35`** — widok przez `ModuleView`, potwierdzenia
  przez `confirmDialog`, a nowy wspólny komponent dowozimy **razem z pierwszym konsumentem**. Ostatnia
  reguła wprost koduje lekcję z nawrotu weryfikacji.
- **Playground uzupełniony o 5 brakujących komponentów** (`Toast`, `ErrorState`, `LineChart`,
  `ImageUrlInput`, `AiCostBadge`). Galeria pokazująca część zestawu uczy, że reszty nie ma.
- **Klikacze: 12/12 zielonych.** To była największa nieznana z recenzji — 21 widoków zmieniło
  opakowanie i nic tego nie potwierdzało poza kontrolą typów. Nawigacja po wszystkich modułach
  i konsola admina działają.
- **Zadanie 3 z Fazy 0 zrobione:** `check:schema-drift`. Sprawdzone testem negatywnym — kolumna
  dodana do `schema.prisma` bez migracji czerwieni build ze wskazaniem brakującej instrukcji.

**Następny przebieg:** Faza 0, zadania **1 i 2** — klikacz ścieżki szczęśliwej dla 21/21 modułów
(dziś smoke pokrywa 8) oraz generowany test izolacji najemcy z manifestu 545 akcji. Ten drugi
dokument nazywa „najważniejszym testem w systemie", bo wyciek między najemcami kończy produkt.

### 046 — Faza 1: granice modułów (pionowy wycinek) · 2026-08-04

Pierwszy przebieg Fazy 1. Świadomie **wycinek pionowy, nie poziomy**: zamiast przenieść wszystkie
21 modułów na pół gwizdka, cztery przechodzą całą drogę — przenosiny, kontrakt, deklaracja,
egzekwowana granica — żeby wzorzec był **sprawdzony**, zanim powtórzy się go siedemnaście razy.

**Co powstało**

- **`src/platform/`** — jedenaście zdolności niezależnych od modułu. Kolejność przenoszenia szła od
  zera importujących do 155 (`prisma`, `auth`), żeby skrypt przepisujący importy był sprawdzony na
  małym zbiorze, zanim dotknie połowy repo. Łącznie ~490 podmian importu, poprawność potwierdzona
  kontrolą typów: zerwany import to błąd kompilacji, nie cicha awaria.
- **Cztery moduły w `src/modules/`** — Trasy TIR, Kontakty, Raporty, QA. Kolejność nieprzypadkowa:
  Truck nie ma zewnętrznego konsumenta (kontrakt jako sama granica), Kontakty mają jednego
  (egzekutor asystenta), Raporty czterech (panel admina, `AICommandSheet`, `agentTools`, egzekutor),
  QA sprawdzają granicę **moduł ↔ powierzchnia administracyjna** — ich formularze redakcyjne
  **zostały** w `components/admin/` właśnie po to, żeby granica miała co testować.
- **Egzekwowanie** — dwie reguły lintu plus bramka `check:boundaries`.
- **Jedna deklaracja** — `defineModule` w `module.ts`; stąd menu, uprawnienie i mapowanie ścieżek.
  Wpisy czterech modułów **zniknęły** z `lib/modules.tsx` i z `platform/auth/permissions.ts`.
  To jest sedno: deklaracja miała **zastąpić** listy, a nie dołożyć dziewiątą.

**Decyzje warte zapamiętania**

- **Wewnątrz modułu importujemy ścieżką względną.** Dla lintera plik w `modules/qa` importujący
  `@/modules/qa/actions/qa` wygląda **identycznie** jak import cudzego wnętrza — przy aliasach jedna
  reguła nie odróżni swojego od cudzego i trzeba by utrzymywać blok konfiguracji na każdy z 21
  modułów. Przy ścieżkach względnych granicę widać w samym imporcie: `./` = moje, `@/modules/…` = cudze.
- **Scalanie deklaracji nie mieszka w platformie.** Plan przewidywał `platform/registry.ts` jako
  miejsce składania modułów, ale platformie nie wolno importować modułów — to ta sama reguła, którą
  sami tu wprowadzamy. Platforma daje **typ i funkcje czyste**, składa **korzeń kompozycji**
  (`src/lib/modules.tsx`). Asymetria z rozdz. 7.1 obowiązuje też autora przebudowy.
- **Platforma, która potrzebuje wiedzy modułowej, przyjmuje ją parametrem.**
  `filterAccessibleFavorites` dostaje predykat `isPathLocked` **parametrem wymaganym**. Gdyby był
  opcjonalny z wariantem „historycznym" jako domyślnym, zapomniane przekazanie dawałoby **cichy
  przeciek RBAC** zamiast błędu kompilacji.
- **`platform/ui` jest re-eksportem, nie przenosinami.** Bramka kontraktu widoku skanuje
  `src/components`; przeniesienie plików wywróciłoby ją w tym samym commicie, w którym przenosimy
  granice. Dla modułu różnicy nie ma.

**Trzy dziury, które ten przebieg zamknął — wszystkie znalezione, nie przewidziane**

1. **Bramki miały zaszyte korzenie skanowania.** `check-ai-coverage` czytał tylko `src/actions/`,
   a kontrola zaszytych kolorów tylko `src/components/`. Przeniesienie modułu **wypisywało jego akcje
   z pokrycia AI i z kontroli dostępu**, a widok z zakazu zaszytych kolorów — bez jednego czerwonego
   komunikatu. Refaktor czysto organizacyjny osłabiłby bezpieczeństwo, nie zmieniając linijki logiki.
2. **`next lint` przy niepoprawnej konfiguracji kończy się kodem 0.** Wypisuje „ESLint configuration
   … is invalid" i przechodzi dalej. Reguła granic przestaje wtedy działać przy zielonym buildzie —
   czyli dokładnie to, przed czym ostrzega rozdz. 14. Stąd `check:boundaries`: bramka nie czyta
   konfiguracji, tylko ją **wywołuje**, próbując złamać obie reguły.
3. **`tsc` nie widzi plików testowych** (`tsconfig.json` wyklucza `src/**/*.test.ts`). Dwa testy
   importowały pliki przeniesione do `platform/`; typecheck był czysty, a wykrywał to dopiero
   40-sekundowy `test:unit`. Stąd `tsconfig.test.json` + `check:test-types` w buildzie.

**Weryfikacja**

Klikacz ścieżki szczęśliwej: **22/22** (21 modułów + odczyt rejestru) — w tym wszystkie cztery
przeniesione. Testy jednostkowe 566/566. Komplet bramek zielony, `next build` przechodzi.
Pełny zestaw klikaczy pokazał 19 czerwonych, wszystkie z powodów **niezwiązanych z przebudową**:
brak danych z seeda w tym środowisku (`QaEpic`, `ShoppingList`, `Note` mają po 0 wierszy) oraz trzy
przypadki niestabilne pod obciążeniem równoległym — `smoke.spec.ts` uruchomiony osobno daje 12/12.

**Poza zakresem — jawnie, żeby nic nie zginęło**

- **17 modułów czekających na przeniesienie:** Strona główna, Kalendarz, Zakupy, Zadania, Notatki,
  Zwierzęta, Kuchnia, Nauka języków, Zdrowie, Wiadomości, Pogoda, Nawyki, Usługi, Flota, Portfel,
  Magazynowanie, Warsztaty. Żyją na **jawnie nazwanej liście przejściowej** w `src/lib/modules.tsx`,
  która ma się kurczyć do zera.
- **Zdolności platformy odłożone:** `lib/ai` (25 plików / 97 importujących), `lib/llm` (8/55),
  `lib/jobs` (5/45). Nie były potrzebne modułom pilotażowym, a ich przeniesienie podwoiłoby diff.
- **Zadanie 8** (asystent AI składany z deklaracji) — dokument stawia je ostatnim w fazie.
- **Pulpit i kalendarz** nie wynikają jeszcze z deklaracji: zasilają je moduły, których w
  `src/modules/` jeszcze nie ma. Pola dojdą do `defineModule` razem z nimi.

### 047 — Faza 1, fala 2: siedem kolejnych modułów · 2026-08-05

Powtórzenie wzorca z 046 — bez wymyślania niczego nowego. Siedem modułów, **jeden commit na moduł**,
plus dwa długi nazwane w recenzji poprzedniego przebiegu.

**Przeniesione:** Nawyki, Nauka języków, Warsztaty, Magazynowanie, Notatki, Flota, Zdrowie.
Kolejność jak poprzednio — od jednego konsumenta zewnętrznego (Nawyki) do trzech, w tym pulpitu
i agregatu kalendarza (Zdrowie).

**Co ten przebieg pokazał o kontraktach**

Magazynowanie ma **47 eksportów akcji**; jego kontrakt ma **14**. To nie jest oszczędność dla
oszczędności — 47 pozycji w kontrakcie znaczyłoby dokładnie tyle samo, co brak kontraktu. Rozdz. 9
mówi, że rosnący kontrakt to **sygnał**, iż moduł robi za dużo; sygnał ma być widoczny, a nie
zagłuszony eksportem całości. Podobnie Warsztaty: 23 eksporty, 11 w kontrakcie.

**Trzy rzeczy, które NIE należą do modułów, mimo że tak brzmią**

Najciekawsza część tej fali okazała się nie „co przenieść", tylko **czego nie przenosić**:

- `lib/habitStats.ts` — nazwa mówi „Nawyki", a używają go `actions/medications`,
  `actions/notifications`, `kitchenExecutor` i `lib/medicationSchedule`. To wspólny helper dat.
- `lib/medicationSchedule.ts` — brzmi jak Zdrowie, ale korzysta z niego **agregat kalendarza**
  i narzędzia asystenta. Wciągnięcie go do modułu zmusiłoby kalendarz (jeszcze nie moduł) do importu
  kontraktu Zdrowia dla funkcji, która nawet nie dotyka bazy.
- `actions/tags.ts` — wygląda na część Notatek, ale tagi to **słownik współdzielony** z Kuchnią.
  Wciągnięcie ich do Notatek zabetonowałoby przypadkowe sprzężenie zamiast je rozwiązać. Docelowe
  miejsce: warstwa słowników platformy, razem z kategoriami i jednostkami — **osobne zadanie**.

Wniosek na kolejne fale: **przynależność pliku ustala się po jego konsumentach, nie po nazwie.**

**Świadome wyłączenie — nawigacja boczna powłoki**

`ModuleSidebar` importuje komponenty `*SideNav` wprost z `ui/` czterech modułów tej fali. Zostawiamy
to i **nazywamy**, zamiast udawać zgodność: kontrakt opisuje **dane, nie ekrany** (zasada przyjęta
w 046 przy Raportach), a przepuszczanie komponentu klienckiego przez plik importowany przez kod
serwerowy rozmywałoby granicę zamiast ją rysować. Właściwe rozwiązanie to **pole `sideNav`
w deklaracji, ładowane leniwie** — dokładnie ten wzorzec, który rozdz. 9.3 opisuje dla kafelka
pulpitu. To zmiana zachowania (import dynamiczny), więc nie mogła wejść do fali przenoszącej.
**Następny krok, nie przeoczenie.**

**Spłacone długi z 046**

- **Panel admina QA przez kontrakt.** `app/admin/qa/page.tsx` odpytywał Prismę z pominięciem
  kontraktu własnego modułu. `getAllEpics` się nie nadawał — zwraca **liczniki**, a drzewo
  redakcyjne potrzebuje treści; kontrakt dostał więc drugą funkcję (`getEpicTreeForAdmin`) zamiast
  rozdmuchanego wariantu jednej. Strona schudła o 30 linii mapowania.
- **Dane z seeda w środowisku klikaczy.** `scripts/e2e-web.sh` kończył na `migrate deploy`, więc
  ~16 testów było czerwonych z powodu pustych tabel. To gorsze niż czerwony test: **psuje wartość
  sygnału** — „czerwony" przestaje znaczyć „regresja". Skrypt odpala teraz istniejące seedy
  (idempotentne), a nie drugi zestaw danych obok.

**Lekcja o bramkach z 046, która zwróciła się dwa razy**

`check:test-types` (dodane w 046, bo `tsconfig.json` wyklucza pliki testowe) złapało w tej fali
**dwa** testy, które zostały w `src/lib` po przeniesieniu swojego kodu — SRS i wikilinków. Bez tej
bramki oba wyszłyby dopiero po 40 sekundach `test:unit`, albo wcale.

**Poza zakresem — jawnie**

- **10 modułów czekających:** Strona główna, Kalendarz, Zakupy, Zadania, Zwierzęta, Kuchnia,
  Wiadomości, Pogoda, Usługi, Portfel. To najbardziej sprzężone — zasilają pulpit i kalendarz.
- **Zdolności platformy:** `lib/ai` (25 plików / 97 importujących), `lib/llm` (8/55), `lib/jobs` (5/45).
- **Zadanie 8** (asystent AI składany z deklaracji) — dokument stawia je ostatnim w fazie.
- **Pole `sideNav` w deklaracji** — patrz wyżej.
- **Tagi do warstwy słowników platformy** — razem z kategoriami i jednostkami.
- **Zaostrzenie bramki rejestru** o wykrywanie modułów pisanych „po staremu" (AC-6 z 046) — możliwe
  dopiero przy **pustej** liście przejściowej, czyli po trzeciej fali.

### 048 — Faza 1, fala 3: DOMKNIĘCIE zadania 5 · 2026-08-05

Dziesięć ostatnich modułów — i nie były to resztki, tylko najbardziej sprzężone jądro aplikacji.
Po tym przebiegu **wszystkie 21 modułów stoi za granicą**, a lista przejściowa nie istnieje.

**Przeniesione:** Wiadomości, Pogoda, Usługi, Kuchnia, Zwierzęta, Portfel, Zakupy, Zadania,
Kalendarz, Strona główna.

**Sprzężenia międzymodułowe okazały się maleńkie — i to jest wynik pomiaru, nie szczęścia**

Rekonesans przed kodem pokazał, że cała „sieć zależności" między modułami to **pięć wywołań, każde
jednofunkcyjne**:

| Konsument | Dostawca | Co dokładnie |
|---|---|---|
| Kuchnia, Magazynowanie | Zakupy | `assertListAccess` |
| Pogoda, Nawyki | Zadania | `createTask` |
| Usługi | Portfel | `addEntry` |

Do tego Portfel wystawia `bookAutoExpense` dla Floty i Zakupów. Rozdz. 9 mówił, że kontrakt ma
**pokazać koszt sprzężenia**; okazało się, że koszt jest niski, tylko dotąd niewidoczny.

**Trzy rzeczy, które nie należały tam, gdzie leżały**

- **Słowniki zakupowe** (kategorie, jednostki, produkty, ikony) — spec zakładał, że są dzielone
  z Kuchnią. Sprawdzenie konsumentów tego **nie potwierdziło**: poza Zakupami nikt ich nie woła.
  Pojechały z Zakupami. Jedynym realnie współdzielonym słownikiem są **tagi** (Notatki + Kuchnia)
  i tylko one zostały poza modułami.
- **Globalny asystent** siedział w `components/home/`, choć powłoka montuje go na **każdej** stronie.
  To nie jest pulpit. Wyszedł do `components/assistant/` osobnym commitem — bez tego moduł Strona
  główna nie dałby się zamknąć bez importu z powłoki.
- **Feed aktywności** — jedynym konsumentem jest strona ustawień. Poszedł do `components/settings/`.

**Nawigacja boczna z deklaracji**

Powłoka importowała sześć komponentów `*SideNav` wprost z wnętrz modułów. Recenzja 047 nazwała to
warunkiem, nie życzeniem — i słusznie: po tej fali wszystkie sześć byłoby wnętrzami. `defineModule`
dostał pole `sideNav`, **ładowane leniwie**. Leniwość nie jest optymalizacją, tylko warunkiem
poprawności: `module.ts` czyta kod serwerowy, więc statyczny import komponentu klienckiego wciągnąłby
go do każdego takiego grafu. Drugi szczegół, który wygląda na kosmetykę, a nią nie jest: **cache
komponentów** — `dynamic()` wywołane w renderze tworzyłoby przy każdym przerysowaniu nowy typ, więc
React odmontowywałby nawigację i montował ją od nowa.

Efekt sprawdzalny: `grep` po `src/components/shell/` nie zwraca **ani jednego** importu wnętrza modułu.

**Cztery kolizje nazw plik/katalog**

Skrypt przepisujący importy dopuszcza `/` po aliasie — inaczej nie objąłby katalogów. Gdy jednak
**plik i katalog mają tę samą nazwę** (`actions/services.ts` + `actions/services/`, `lib/services.ts`
+ `lib/services/`, `lib/portfel.ts` + `lib/portfel/`, `lib/calendar.ts` + `lib/calendar/`), przepisuje
oba tak samo i importy pliku lecą w katalog. Wszystkie cztery złapał `tsc` natychmiast. Rozwiązanie:
katalogi dostały inne nazwy (`parts/`, `core/`), pliki weszły do modułu jako `lib/<nazwa>.ts` lub
`lib/index.ts`.

**Osiem zastanych porażek klikaczy — wszystkie okazały się błędami TESTÓW**

Dług nazwany w recenzji 047. Każdą odtworzono i zdiagnozowano; **żadna nie wymagała zmiany zachowania
aplikacji**:

- cztery scenariusze Zakupów — na `/shopping` są **trzy** przyciski „Nowa lista" (nawigacja boczna,
  nagłówek widoku, stan pusty); `.first()` trafiał w ten z paska bocznego, który nie otwiera
  formularza;
- lista raportów — `getByText` trafiał najpierw w **ukryty** element powłoki;
- formularz raportu — naruszenie trybu strict: wzorzec pasował też do pola treści;
- foldery notatek — asercja **nieaktualna**: widok mówi „Foldery notatek", nazwa „grupy" zniknęła
  z interfejsu dawno temu;
- dostęp do QA — „moduł dostępny w nawigacji" ma **dwie** poprawne postacie: włączony to link,
  domyślnie wyłączony (QA) siedzi w „Więcej…" jako **przycisk** do dołożenia go do menu.

**Domknięcie fazy**

Przy pustej liście przejściowej dało się wreszcie zrobić to, co 046 musiał odłożyć:
`check:module-registry` sprawdza teraz także **odwrotność** — identyfikator z rejestru nie może mieć
kodu poza swoim katalogiem (`src/actions/<id>.ts`, `src/components/<id>/`). Wcześniej reguła
zapaliłaby się na całym istniejącym kodzie. Sprawdzone testem negatywnym.

Usunięty martwy kod przejściowy: tablica `LEGACY`, parametr `legacy` w `mergeModules`, ostatnia gałąź
`legacyPermissionForPath`. Pusta tablica zostawiona „na wszelki wypadek" byłaby zaproszeniem, żeby
dopisać do niej moduł zamiast utworzyć katalog.

**Poza zakresem — co zostaje**

- **Zdolności platformy `ai` (25 plików / 97 importujących), `llm` (8/55), `jobs` (5/45)** — własny
  przebieg, następny w kolejce.
- **Zadanie 8** (asystent AI składany z deklaracji) — wymaga najpierw platformy `ai`. **To jedyne, co
  zostało z Fazy 1.**
- **Pola `dashboard`, `calendar`, `resources` w deklaracji** (rozdz. 9.3) — pulpit i kalendarz dopiero
  w tej fali stały się modułami; wyprowadzanie ich z deklaracji to następny krok.
- **Tagi do warstwy słowników platformy** — razem z ewentualnymi innymi słownikami wspólnymi.
- **Faza 2** (współdzielenie, `Workspace`, `ResourceGrant`) w całości.


### 049 — Faza 1: platforma AI i asystent z deklaracji (zadania 4 i 8) · 2026-08-11

Najbardziej sprzężony element systemu przeszedł za granicę. Po tym przebiegu **`src/platform/` nie
importuje ani jednego modułu** — ani wnętrza, ani kontraktu.

**Zadania 4 i 8 okazały się jednym ruchem, nie dwoma**

Rekonesans przed kodem pokazał, dlaczego zadanie 4 stało: osiemnaście plików w `lib/ai` i `lib/jobs`
importowało moduły. Przeniesienie ich do platformy „jak leci" złamałoby regułę, dla której cała Faza 1
powstała. Rozdz. 9.6 wskazywał wyjście — katalog asystenta ma się **składać z deklaracji** — więc
kolejność musiała być odwrotna do intuicyjnej: **najpierw kod modułowy wraca do modułów, dopiero
potem reszta jedzie do platformy jako czysta przenosina.**

**Co zniknęło**

| Równoległa lista | Było | Jest |
|---|---|---|
| Katalog akcji asystenta | mapa 16 bloków tekstu w `agentPrompt.ts` | `modules/<x>/ai/catalog.ts` |
| Rejestr egzekutorów | łańcuch 16 `if (module === …)` w trasie | pole `ai` w deklaracji |
| Narzędzia odczytu | `switch (name)` po 56 przypadkach, 1199 linii | `modules/<x>/ai/readTools.ts` |
| Handlery zadań w tle | ręczna mapa `JOB_HANDLERS` | pole `jobs` w deklaracji |
| Agregat kalendarza | 9 zapytań do tabel 6 modułów, 227 linii | pole `calendar` w deklaracji, 32 linie |

**Odstępstwo od rozdz. 9.3, świadome:** dokument pokazuje `ai: { actions, readTools }` jako pole
statyczne. W Omnii to by nie zadziałało — `MODULES` importuje `ModuleSidebar`, komponent **kliencki**,
a egzekutory to kod serwerowy. Wszystkie cztery nowe pola są więc **leniwe**, jak `sideNav` w 048.

**Dowód braku regresji, bo tu obietnica brzmiała „zero zmian"**

Przed pierwszą linijką kodu powstał zrzut powierzchni (`specs/049…/baseline.json`). Po przebudowie
porównany pozycja po pozycji: **read-toole 56 = 56 · egzekutory 16 = 16 · typy zadań 12 = 12 ·
akcje per moduł zgodne co do jednej (razem 160) · zdarzenia kalendarza 38 = 38, listy identyczne
co do znaku.**

Przy okazji wyszło, że **zwykły seed nie tworzy żadnych danych użytkownika** (konta powstają przez
OAuth), więc agregat kalendarza zwracał zero zdarzeń — a pusty wynik zgadza się z pustym nawet wtedy,
gdy przebudowa zgubi połowę źródeł. Stąd `scripts/fixture-calendar-surface.ts`: po jednym zdarzeniu
w każdym z siedmiu źródeł agendy.

**Trzy rzeczy, które złapały narzędzia, a nie oko**

- **Zgubiony `web_search`.** Rozbicie promptu na wkłady modułowe wycięło wiersz katalogu narzędzia,
  które nie ma implementacji w żadnym module (trasa obsługuje je osobno). Zapalił się test
  `buildReadToolsPrompt` — pierwszy raz, gdy zarobił na siebie.
- **O mało nie poszerzona allowlista zadań.** Pisząc rejestr platformowy odruchowo dopisałem
  `skins.generate`, którego **nigdy nie było** w `JOB_HANDLERS` (trasa woła je synchronicznie). To
  jest granica bezpieczeństwa — porównanie 12 = 12 nie jest formalnością.
- **Bramka rejestru na własnym kodzie.** Korzeń kompozycji agendy trafił najpierw do
  `src/lib/calendar/`, co po piątym teście z 048 czyta się jako „kod modułu Kalendarz poza jego
  katalogiem". Nazwa myliła, treść nie.

**Odpowiedź KODEM na pytanie kontrolne z rozdz. 14**

„Ile miejsc trzeba dotknąć, żeby dodać moduł?" → **jeden katalog + jeden import w korzeniu
kompozycji.** I nie jest to deklaracja, tylko rzecz wymuszona: `check:module-registry` ma teraz sześć
testów i wywala build, gdy kod modułu — albo jego wkład do asystenta czy kolejki — wyląduje poza
katalogiem modułu. Sprawdzone testem negatywnym.

**Poza zakresem — co zostaje z Fazy 1**

- **Migawka pulpitu z deklaracji** (druga połowa zadania 7) — **odłożona świadomie, z powodem**:
  w przeciwieństwie do kalendarza nie ma dla niej dowodu runtime. Agregat kalendarza jest funkcją,
  którą da się zawołać i porównać; migawka pulpitu powstaje **w miejscu**, w 322-liniowej trasie
  z dziesięcioma gałęziami na uprawnienia. Żeby zrzucić stan „przed", trzeba by ją najpierw
  wyodrębnić — czyli wykonać dokładnie tę zmianę, którą chcemy zweryfikować. Przenoszenie dziesięciu
  bloków obliczeń, którego jedynym sprawdzeniem byłby `tsc`, to ryzyko cichej regresji na produkcji.
  **Następny przebieg zaczyna od zbudowania tego dowodu**, dopiero potem przenosi.
- **Pole `resources`** (rozdz. 8.4) — należy do Fazy 2, ma sens dopiero z `Workspace`/`ResourceGrant`.
- **Read-toole przez `requireAccess`** (wymóg z rozdz. 9.6) — **realne zagrożenie bezpieczeństwa**
  i musi zostać zrobione, ale `requireAccess` powstaje dopiero w zadaniu 10. Zapisane, żeby nie
  zginęło przy przejściu do Fazy 2.

**Pierwszy krok Fazy 2:** zadanie 9 — modele `Workspace`, `WorkspaceMember`, `ResourceGrant`,
`ResourceInvitation`.

---

### 050 — Faza 1 DOMKNIĘTA: migawka pulpitu z deklaracji · 2026-08-11

**Zakres:** druga połowa zadania 7 — ostatnia równoległa lista opisująca moduł.
**Artefakty:** `specs/050-pulpit-z-deklaracji/`. **Wynik: Faza 1 zamknięta w całości.**

**Dlaczego 049 tego nie ruszyło i co się zmieniło**

Agregat kalendarza dało się porównać zdarzenie po zdarzeniu, bo jest **funkcją, którą można
zawołać**. Migawka pulpitu powstawała **w miejscu** — w 322-liniowej trasie z dziesięcioma gałęziami
na uprawnienia — więc żeby zrzucić stan „przed", trzeba było ją najpierw wyodrębnić, czyli wykonać
dokładnie tę zmianę, którą chcemy zweryfikować. Ten przebieg rozciął ten węzeł kolejnością:
**(1) czysta przenosina obliczeń do funkcji biorącej `userId` parametrem → (2) zrzut punktu
odniesienia → (3) dopiero potem rozbicie na wkłady.** Krok (2) był twardym warunkiem wstępnym: bez
niego przenosiny jedenastu bloków obliczeń miałyby za jedyne sprawdzenie kompilator.

**Trzy odkrycia, każde zmieniło plan (C-54)**

- **Skrypt nie wystarczył.** Pierwszy zrzut dał **6 niezerowych pól z 20**: siedem z jedenastu bloków
  woła kontrakty modułów, a te są Server Actions wywodzącymi użytkownika **z sesji** — poza żądaniem
  rzucają „headers was called outside a request scope", a `try/catch` zamienia to na zera. Zgodnie
  z własną zasadą listy zadań — *zrzut z zerami to brak dowodu, nie sukces* — punkt odniesienia
  powstał przez **tymczasową trasę diagnostyczną** odpytaną na działającym serwerze z ciasteczkiem
  sesji. Wynik: **19 z 20 pól niezerowych** (dwudzieste, `adminStats`, jest z założenia `null`).
- **Siedem bloków ignoruje parametr `userId`.** Wywodzą użytkownika z sesji, więc zasianie danych na
  osobnym koncie dawało zera — fixture musiał umieć siać **na istniejącym koncie** (`--email=`).
  Gdyby to wyszło po przenosinach, wyglądałoby jak regresja przenosin.
- **Raporty nie są bramkowane uprawnieniem modułu.** W zrzucie „bez uprawnień" `recentReports`
  zostało niezerowe. Korzeń kompozycji musi to uszanować: **moduł z `permission: null` wołamy
  zawsze.** Bramkowanie go „dla porządku" byłoby cichą zmianą zachowania — dokładnie tym, czego ten
  przebieg miał nie zrobić.

**Pomiar, który zmienił projekt — wspólny rejestr też jest plikiem zbiorczym**

Pierwsza wersja wpinała wkłady polem `dashboard` w `module.server.ts`, czyli tak jak `ai`, `jobs`
i `calendar`. Graf kompilacji strony głównej urósł z **1889 do 2117** modułów.

| wariant | `/auth/signin` | `/` |
|---|---|---|
| przed 050 (trasa importowała osiem kontraktów) | 1771 | **1889** |
| wkłady przez wspólny `MODULE_SERVER` | 1771 | **2117** |
| wkłady przez własny korzeń kompozycji | 1771 | **1903** |

Powód jest tą samą lekcją co kontrakt-barrel z 049, tylko **piętro wyżej**: `MODULE_SERVER` to obiekt
**czterech leniwych loaderów na moduł**, a webpack w trybie dev kompiluje cele `import()` osiągalne
ze statycznie zaimportowanego pliku. Kto importuje go dla **jednego** pola, płaci grafem za
**wszystkie cztery** — pulpit ciągnął egzekutory asystenta i handlery zadań w tle siedemnastu
modułów, których nie wywołuje ani razu. Wkłady pulpitu dostały więc **własny korzeń**
(`src/lib/dashboardContributors.ts`). Pozostałe **+14 to dokładnie liczba nowych plików** (jedenaście
wkładów, korzeń, składanie migawki, typ w platformie) — koszt kodu, nie napompowanego grafu.

**Cena tej decyzji i jak jest spłacona.** Wpięcie znikło z deklaracji modułu, więc nie widać go
w `module.server.ts`. Pilnuje go bramka, **w obie strony**: `dashboard.ts` bez wpięcia → build
czerwony; wpięcie wskazujące nieistniejący plik → build czerwony. Oba sprawdzone testem negatywnym.

> **Wskazanie na osobny krok:** `calendarContributors.ts`, `lib/ai/catalog.ts` i `lib/jobs/registry.ts`
> płacą dziś ten sam podatek — agenda kalendarza wciąga egzekutory asystenta. Rozdzielenie ich to ta
> sama operacja co tutaj. Nie zrobiliśmy tego w tym przebiegu, żeby nie mieszać dowodu równoważności
> migawki z przebudową trzech innych korzeni (C-53).

**Dowód braku regresji**

Zrzut porównany z punktem odniesienia **po każdej grupie wkładów**, nie raz na końcu: cztery razy
(T-6, T-7, T-8, T-10) plus po zmianie korzenia — za każdym razem **20 pól, IDENTYCZNE, w obu
wariantach** (z uprawnieniami i bez). Wariant „bez uprawnień" równa się `EMPTY_SNAPSHOT` w 19 polach
na 20; dwudzieste to `recentReports`, z powodu opisanego wyżej.

**Co zostało w trasie i dlaczego**

Celem było usunięcie gałęzi **modułowych**, nie opróżnienie pliku za wszelką cenę. Zostały:
aktywność, zaproszenia, preferencje pulpitu i ulubione widoki (**dane konta** — sięgają po sesję,
nie po dziedzinę modułu) oraz statystyki admina (**przekrój całej instalacji** — nie ma modułu,
którego byłyby własnością). Wciśnięcie ich w jakiś moduł na siłę byłoby gorsze niż zostawienie
w kompozycji z zapisanym powodem.

**Bramki:** build **exit 0**, `test:unit` **657/657**, liczniki **160 / 551 / 35 / 35** bez spadku,
`check:module-registry` **8 kontroli**, `check:boundaries` i `check:ui-contract` zielone.

**Pierwszy krok Fazy 2:** zadanie 9 — modele `Workspace`, `WorkspaceMember`, `ResourceGrant`,
`ResourceInvitation`. Do zabrania z Fazy 1: **read-toole asystenta wciąż nie przechodzą przez
`requireAccess`** (rozdz. 9.6) — wykonalne dopiero po zadaniu 10, i przy zasobach współdzielonych
przestaje to być teoretyczne.

---

### 051 — Faza 2 OTWARTA: przestrzenie i nadania (zadanie 9) · 2026-08-12

**Zakres:** fundament danych pod współdzielenie — cztery modele z rozdz. 8.3 **wypełnione danymi**,
przy zerowej zmianie zachowania aplikacji. **Artefakty:** `specs/051-przestrzenie-i-nadania/`.

**Dlaczego samo dodanie tabel by nie wystarczyło**

Puste tabele niczego nie dowodzą i niczego nie zabezpieczają. Dlatego migracja 0226 robi dwie rzeczy
naraz: tworzy tabele **i** wypełnia je z istniejących zespołów oraz kont. Backfill jest **w migracji,
nie w seedzie** — seed nie odpala się automatycznie po wdrożeniu, więc niezmiennik „każde konto ma
przestrzeń osobistą" wszedłby w życie dopiero wtedy, gdyby ktoś pamiętał go uruchomić.

**Dwa pola, których nie ma w szkicu rozdz. 8.3 — i bez których nic by nie działało**

`Workspace.personalUserId` i `Workspace.teamId`, oba nullowalne i **unikalne**. Dokument nie mówi,
czym przestrzeń jest połączona ze swoim źródłem, a bez tego połączenia trzy kryteria akceptacji są
niewykonalne: powtórzenie backfillu nie ma na czym oprzeć `ON CONFLICT`, zmiana składu zespołu nie ma
jak odnaleźć jego przestrzeni, a „dokładnie jedna przestrzeń osobista" zostaje obietnicą zamiast
więzem bazy. W PostgreSQL wartości `NULL` są w indeksie unikalnym traktowane jako różne, więc **jeden
indeks daje dwa niezmienniki naraz** i nie przeszkadza drugiemu rodzajowi przestrzeni. Kasowanie
lustra robi kaskada klucza obcego — ani jednej linijki kodu aplikacji.

**Najbardziej prawdopodobny cichy błąd, wypatrzony przed napisaniem kodu**

`Team.ownerId` jest **niezależny** od tabeli `TeamMember` — nic nie wymusza, żeby właściciel miał tam
wiersz. Odwzorowanie „po członkach" wygląda przy tym na kompletne i po cichu gubi właściciela.
Dlatego właściciel dochodzi **osobnym krokiem, po członkach**, przez `DO UPDATE` (żeby wygrał
z ewentualnym wierszem `member`) — i ma własny przypadek testowy oraz własny fixture.

**Uzgadnianie JEST detektorem rozjazdu**

Przez okres przejściowy ta sama informacja mieszka w dwóch miejscach, a rozjazd **nie objawia się
niczym**, bo nic przestrzeni jeszcze nie czyta — wyszedłby dopiero przy zadaniu 11. Zamiast pisać
osobne API „sprawdź, czy jest rozjazd", `reconcileWorkspaces` **zwraca liczbę zmian**: zero przy
drugim uruchomieniu to jednocześnie dowód idempotencji i dowód spójności. Dwa API byłyby dwiema
interpretacjami jednej reguły — czyli tym samym problemem, który tu naprawiamy, piętro wyżej.

Weryfikacja krzyżowa, która się opłaciła: `reconcileWorkspaces()` uruchomione na bazie **po backfillu
SQL** zwróciło `{0,0,0}`. TypeScript i SQL interpretują mapowanie ról identycznie — a to są dwa
niezależne zapisy tej samej reguły (prod nie wykona kodu TS przy `migrate deploy`).

**Defekt złapany przez testy, nie przez oko — i moja własna pomyłka w diagnozie**

DDL wygenerowałem przez `prisma migrate diff --to-schema-datamodel` i **dopisałem wyjście bez
przeczytania**. Diff dorzucił `DROP INDEX` na obu indeksach trigramowych wyszukiwania notatek oraz
trzy `ALTER COLUMN "updatedAt" DROP DEFAULT` na niezwiązanych tabelach — bo te obiekty żyją wyłącznie
w surowym SQL-u i z punktu widzenia schematu „nie powinny istnieć". Na produkcji objawiłoby się to
cicho: wyszukiwanie notatek spada na skan sekwencyjny.

Zmyliło mnie to dwa razy. Najpierw wziąłem padające testy `notesFts` za stan lokalnej bazy
i **odtworzyłem indeksy ręcznie** zamiast szukać przyczyny — po czym zniknęły znowu. Sprawcę pokazał
dopiero `grep "DROP INDEX" prisma/`: moja własna migracja. Naprawa: pięć instrukcji usunięte,
w migracji został komentarz wymieniający je **z nazwy** wraz z powodem, a cykl przeliczony od zera
z jawnym sprawdzeniem, że indeksy migrację **przeżywają**.

**Bramka, która milczała dokładnie tam, gdzie była potrzebna**

`check:schema-drift` tworzy bazę cienia i toleruje wyłącznie błąd „already exists". Rola bez
`CREATEDB` dostaje jednak „permission denied" **także wtedy, gdy baza cienia istnieje** — więc bramka
**pomijała całą kontrolę** i kończyła się sukcesem. Poprawka: zamiast ufać treści błędu, sprawdzamy
stan faktyczny (czy da się połączyć z bazą cienia). Po niej bramka po raz pierwszy realnie ruszyła
i **to ona wyłapała** `DROP INDEX` opisany wyżej. „Pominięty" nie jest zielony — to brak pomiaru.

**Co zostało świadomie niezrobione**

- **`ResourceGrant` i `ResourceInvitation` nie mają konsumenta** — pierwszy przyjdzie z zadaniami 10
  i 12. Odstępstwo od zasady „dowozimy razem z konsumentem", przyjęte, bo kształt jest rozstrzygnięty
  w rozdz. 8.3, a checklista trzyma wszystkie cztery byty w jednym zadaniu: jedna migracja zamiast
  dwóch na tych samych tabelach. **Nie kasować „w ramach porządków".**
- **Unikalność nadań linkowych nie działa** (`subjectType: "link"`, `subjectId: NULL`) — ta sama
  własność PostgreSQL, która wyżej pomaga, tu przeszkadza: `NULL != NULL`, więc dwa nadania linkowe
  do jednego zasobu przejdą. Poprawka to częściowy indeks w surowym SQL-u; robimy ją w zadaniu 12,
  gdy będzie wiadomo, czy nadania linkowe w ogóle wchodzą w pierwszej odsłonie.
- **Zadanie 11** (`workspaceId` na 46 modelach) — rozdz. 8.10 nazywa je najbardziej ryzykownym krokiem
  całej przebudowy i wymaga czterech osobnych etapów. Ten przebieg nie dotknął ani jednego z nich.

**Bramki:** build **exit 0**, `test:unit` **666/666**, liczniki **160 / 551 / 35 / 35** bez ruchu,
`check:workspace-mirror` (nowa) zielona, `git diff` **bez ani jednego pliku** w `src/app/`
i `src/components/` — maszynowy dowód, że przebieg jest dla użytkownika niewidzialny.

**Co znalazła recenzja — dwa punkty, oba przechodziłyby build na zielono**

- **Trzeci punkt mutacji zespołów, o którym twierdziłem, że nie istnieje.** Wzorzec bramki szukał
  `prisma.team…`, a w transakcji interaktywnej mutacja nazywa się `tx.team…`. Po poszerzeniu wzorca
  wyszedł `lib/privacy/purge.ts`: przy usuwaniu konta przekazuje własność zespołu następcy, więc
  bez uzgodnienia przestrzeń zostawałaby **bez właściciela** — a po zadaniu 10 następca straciłby
  prawo zarządzania własnym zespołem. Bramka raportuje dziś **3 pliki**, nie 2.
- **Lustro mogło wywalić logowanie i tworzenie zespołu.** Wpięcia były zwykłym `await`, więc awaria
  zapisu, którego nikt nie czyta, przerywała operację użytkownika. Ryzyko jest asymetryczne, więc
  ścieżki użytkownika wołają teraz jawnie nazwane warianty ciche (`mirrorTeamWorkspace`,
  `mirrorPersonalWorkspace`), a wersje ścisłe zostają dla testów i uzgadniania. **W kodzie stoi,
  kiedy to przestaje być bezpieczne:** gdy przestrzenie dostaną pierwszego czytelnika.

**Uwaga procesowa:** pierwsze podejście do tego przebiegu przepadło razem z kontenerem — siedem
ukończonych zadań istniało wyłącznie w lokalnych commitach. Odtworzone z artefaktów i tej lekcji:
**push po każdym zadaniu**, nie po całym przebiegu.

---

### 052 — Zadanie 10: `requireAccess` jako zdolność platformy · 2026-08-12

**Zakres:** jedna odpowiedź na pytanie „czy wolno" — w platformie, z dziedziczeniem i cache'em per
żądanie — plus pierwszy konsument. **Artefakty:** `specs/052-requireaccess-platforma/`.

**Kolejność, która jest tu ważniejsza niż gdziekolwiek indziej**

To jest kod decydujący o dostępie do danych: błąd nie objawia się wolniejszą stroną, tylko cudzymi
danymi albo zablokowaną pracą. `tsc` nie ma tu nic do powiedzenia — stary i nowy guard mają tę samą
sygnaturę i mogą różnić się każdą pojedynczą odpowiedzią. Dlatego **tabela prawdy powstała przed
napisaniem mechanizmu**: macierz pięciu relacji × pięciu operacji, 25 komórek, zapisana jako punkt
odniesienia. Po przełączeniu — **identyczna**.

**Co pokazał sam punkt odniesienia, zanim cokolwiek zmieniliśmy**

Projekt zadań należący do **zespołu** jest dziś niedostępny **dla nikogo** — łącznie z właścicielem
zespołu. `TaskProject` ma kolumnę `ownerTeamId`, ale ani guard zapisu, ani ścieżka odczytu asystenta
jej nie czytają. Nowy mechanizm mógłby to „przy okazji" naprawić i **właśnie dlatego tego nie robi**:
poprawka uprawnień ukryta w przebudowie uprawnień jest nie do odróżnienia od błędu. Zachowanie
zostało co do znaku, a rozbieżność jest zgłoszona jako osobna rzecz do decyzji właściciela.

**Trzy decyzje projektowe, każda z ceną wypisaną w kodzie**

- **Katalog zasobów jest parametrem wymaganym**, bez wartości domyślnej — zapomniany argument
  zamieniłby się w ciche przyzwolenie. Podaje go korzeń kompozycji.
- **Moduł woła platformę z własnym katalogiem**, nie przez korzeń: sięgnięcie po `@/lib/sharing`
  z wnętrza modułu odwróciłoby zależność (moduł → korzeń → wszystkie moduły) i powtórzyło regresję
  z 049. Granica tego rozwiązania jest nazwana zawczasu: zasób, którego rodzic mieszka w innym
  module, będzie znakiem, że wołający należy do warstwy kompozycji.
- **Zadanie w projekcie nie ma własnego właściciela.** Kuszące `ownerId: createdById` dałoby twórcy
  dostęp **po wypisaniu go z projektu** — czyli więcej niż dziś. Osoba przypisana do zadania bez
  projektu dostała za to jawne pole `extraGrants`, zamiast zakłamywania pola `ownerId`.

**Co złapały testy, a nie oko**

- **`React.cache` nie degraduje się poza kontekstem żądania** — nie jest tam nawet funkcją i rzuca
  `cache is not a function`. Bez jawnej degradacji `requireAccess` wywalałby każde zadanie w tle
  i każdy skrypt. Wyszło przy pierwszym uruchomieniu tabeli prawdy.
- **`id` w `assertTaskAccess` musiało stać się wymagane.** Przy opcjonalnym wołający, którego
  `select` go nie pobiera, po cichu wracałby do starej reguły i nowy mechanizm nigdy by się tam nie
  uruchomił. Kompilator wskazał jedno takie miejsce.
- **Test izolacji budował syntetyczne zadanie bez wiersza w bazie.** Nowy guard czyta fakty
  o zasobie, więc test tworzy teraz prawdziwe zadanie — sprawdza tę samą regułę bliżej tego, jak
  działa aplikacja.

**Asystent (rozdz. 9.6)**

`get_task` pyta o dostęp tym samym mechanizmem co zapis, a zakres list przeniósł się z warstwy AI do
modułu — obok guardu, żeby lista i sprawdzenie nie mogły się rozjechać. Test obejścia sprawdza
**obie** drogi wejścia (identyfikator i tytuł, bo `get_task` rozwiązuje też nazwy) i został
**zobaczony na czerwono**: po podłożeniu dziury w zawężeniu zapytania oba przypadki padają.

**Pomiary (rozdz. 8.9)**

Właściciel rozstrzyga się **bez** pytania o nadania. Obcy: nadania czytane **dokładnie raz**, mimo
dwóch ogniw łańcucha. Sprawdzenie dostępu do projektu = **jedno** zapytanie, jak dawniej. Test mówi
też wprost, czego **nie** udaje: „zero zapytań dla właściciela" z rozdz. 8.9 opiera się na
`workspaceId`, którego zasoby jeszcze nie mają.

**Co dokładnie zamienia zadanie 11**

`ResourceFacts` to dziś `{ ownerId, ownerTeamId, parent }`. Zadanie 11 dokłada `workspaceId`
i zmienia **krok 1–2 rozstrzygania** w `platform/sharing/access.ts` — reszta (łańcuch, nadania
jednym zapytaniem, cache, deklaracje modułów) zostaje bez zmian. To ma być zamiana jednego kroku,
nie przepisanie.

**Co świadomie zostało**

- **Osiemnaście modułów bez deklaracji zasobów** (rozdz. 8.10 krok 8) — każdy wymaga własnej tabeli
  prawdy, więc dziewiętnaście naraz to dziewiętnaście niesprawdzonych zmian w kontroli dostępu.
- **Migracja `TaskProjectMember`/`TaskShare`/`PetShare` na nadania** — zadanie 12. Pilot **czyta**
  dzisiejsze mechanizmy, nie rusza danych.
- **Unieważnianie cache zdarzeniem** (rozdz. 8.9 pkt 3) — wymaga warstwy zdarzeń z Fazy 4.
- **Warianty ciche lustra przestrzeni z 051** — mają zniknąć razem z pierwszym czytelnikiem
  przestrzeni; `requireAccess` czyta dziś nadania, ale nie przestrzenie zasobów, więc termin
  przesuwa się na zadanie 11.

**Bramki:** build **exit 0**, `test:unit` **680/680**, liczniki **160 / 551 / 35 / 35** bez ruchu,
`check:module-registry` **dziewięć kontroli**, `git diff` **bez ani jednego pliku** w `src/app/`
i `src/components/`.


---

### 053 — Projekty zespołowe przestają być martwe · 2026-08-12

**Skąd się wziął ten przebieg.** Nie z listy zadań, tylko z **tabeli prawdy zbudowanej w 052**.
Punkt odniesienia pokazał, że projekt zadań należący do zespołu jest niedostępny **dla nikogo** —
`ownerTeamId` nie dawało niczego ani przy zapisie, ani przy odczycie. Funkcja istniała w modelu
danych i nie istniała w praktyce: projekt widoczny, każda operacja odmówiona.

**Dlaczego osobno, a nie „przy okazji" w 052.** Bo to jest **rozszerzenie dostępu**, a 052 miało
dowieść równoważności. Poprawka wpleciona tam byłaby nie do odróżnienia od błędu przenosin,
a tabela prawdy przestałaby cokolwiek dowodzić. Tu widać dokładnie, co się zmienia.

**Zmieniła się DOKŁADNIE JEDNA komórka macierzy** — członek zespołu w projekcie zespołowym,
z „odmowa" na „dozwolone". Pozostałe 24 bez ruchu, co potwierdza porównanie. Punkt odniesienia
zaktualizowany **świadomie**, a asercja pilnująca dawnego zachowania zamieniona na dwie: nowy
zamiar i sprawdzenie, że osoby spoza zespołu nadal nic nie zyskują.

**Jak to jest wyrażone.** Deklaracja zasobu dostała opcjonalne pole `teamOwnership`
(`{ member, admin }`) — **domyślnie puste**, bo nie każdy moduł honoruje własność zespołową
i milczące przyznanie dostępu na podstawie samej obecności kolumny byłoby dokładnie tym, czego
052 zabroniło. Zadania deklarują `member: "editor"`, `admin: "manager"`: członek pracuje
w projekcie, właściciel/admin zespołu nim zarządza. Kontekst dostępu niesie teraz `adminTeamIds`,
czytane **razem** z resztą, więc sprawdzenie nie kosztuje dodatkowego zapytania.

**Rzecz, którą trzeba było domknąć razem ze zmianą:** zakres list. Bez tego członek zespołu miałby
prawo działać w projekcie, **którego nie widzi**, a asystent twierdziłby, że taki projekt nie
istnieje. `accessibleProjectIds` obejmuje więc teraz projekty zespołu — z tego samego miejsca, co
sprawdzanie dostępu.

**Znane ograniczenie, świadomie zostawione:** właściciel zespołu **bez wiersza `TeamMember`** nadal
nic nie zyskuje, bo `getUserTeamIds` (całoaplikacyjne pojęcie „moje zespoły") czyta członkostwa.
W praktyce `createTeam` zakłada właścicielowi taki wiersz; rozbieżność dotyczy zespołów tworzonych
z pominięciem tej ścieżki i jest tą samą, którą 051 rozwiązało po stronie lustra przestrzeni.

**Bramki:** build **exit 0**, `test:unit` **681/681**, liczniki **160 / 551 / 35 / 35** bez ruchu.


---

### 054 — `workspaceId` w bazie, etap 1 z czterech · 2026-08-12

**Co ten przebieg zrobił aplikacji: nic.** I to jest jego treść. Rozdz. 8.10 nazywa zadanie 11
najgroźniejszym krokiem całej przebudowy i podaje kolejność, której nie wolno skracać:
*(a) dodać kolumnę nullable, (b) wypełnić migracją, (c) przełączyć zapytania, (d) uczynić
wymaganą. **Nigdy w jednym kroku.*** Wykonane zostały **(a) i (b)**. Kolumna `workspaceId`
istnieje na **45 modelach**, jest wypełniona i **nie ma ani jednego czytelnika** — dostęp
i własność liczą się dalej przez `ownerId`/`ownerTeamId`.

**Dlaczego 45, a nie 46 z checklisty.** Zbiór wyznacza własność, nie licznik: kolumnę dostaje
model mający `ownerId` lub `ownerTeamId`. Dwa wykluczenia są świadome i zapisane w kodzie.
`Task` nie ma żadnej z tych kolumn — jego własność idzie przez `createdById`/`assigneeId`
i przez projekt, więc nie ma z czego wyliczyć przestrzeni. `Team` jest **źródłem** przestrzeni
(`Workspace.teamId`), a nie zasobem, który w jakiejś przestrzeni żyje; nadanie mu `workspaceId`
zamknęłoby pętlę „zespół należy do przestrzeni, która należy do zespołu".

**Pułapka, która wywaliła pierwszy przebieg backfillu:** `@@map`. `ADD COLUMN` generuje Prisma,
więc pisze nazwy **tabel**; backfill pisałem ręcznie i użyłem nazw **modeli**. Wyszło na
`ProjectGroup`, zmapowanym na `TaskView` — jedynym takim modelu w całym schemacie. Ręcznie pisany
SQL musi `@@map` uwzględnić sam, a jeden wyjątek na kilkadziesiąt tabel jest dokładnie tym
rodzajem różnicy, której się nie zauważa przy przeglądaniu.

**C-15 zadziałała za drugim razem z rzędu.** `prisma migrate diff` dopisał — niezamówione —
`DROP INDEX` na dwóch indeksach trigramowych notatek i trzy `ALTER COLUMN … DROP DEFAULT`.
Te same instrukcje, które w 051 skasowały wyszukiwanie notatek. Zostały usunięte, a nagłówek
migracji **wymienia je z nazwy**, żeby ich brak nie wyglądał na przeoczenie.

**Dowód kompletności wyprowadza listę tabel ze schematu**, zamiast ją powtarzać. Ręczna lista
sprawdziłaby to, o czym pamiętałem w dniu pisania testu, a pytanie brzmi odwrotnie: czy backfill
objął **wszystkie**. Test porównuje przy okazji dwa źródła prawdy — zbiór modeli z `workspaceId`
w schemacie i zbiór `ADD COLUMN` w migracji — bo rozjazdu w tę stronę `check:schema-drift` nie
złapie. Rozróżnia też **lukę** (właściciel ma przestrzeń, kolumna pusta → awaria) od **sieroty**
(właściciel przestrzeni nie ma, np. konto usunięte → liczba do raportu). Kontrola negatywna:
wyzerowanie kolumny na jednym rekordzie świeci test na czerwono, więc wiadomo, że mierzy.

**Zgodność SQL-a z TypeScriptem sprawdzona wprost:** `reconcileWorkspaces()` uruchomiony po
backfillu zwrócił `{0, 0, 0}` — obie implementacje tej samej reguły rozumieją ją identycznie.

#### Pozostałe trzy etapy zadania 11 — co obejmuje każdy

| Etap | Zakres | Dlaczego osobno |
|------|--------|-----------------|
| **2** | Utrzymywanie `workspaceId` dla **nowych** rekordów: każda ścieżka zapisu ustawia kolumnę razem z `ownerId`/`ownerTeamId` | Dotyka **każdej** akcji tworzącej zasób. Etap 1 był jednorazowy i odwracalny przez `DROP COLUMN`; ten wchodzi w kod aplikacji |
| **3** | Przełączenie **odczytów**: `ResourceFacts` dostaje `workspaceId`, kroki 1–2 rozstrzygania w `platform/sharing/access.ts` czytają przestrzeń zamiast pary właścicieli; zakresy list idą po `workspaceId` | To jest moment zmiany zachowania. Wymaga **tabeli prawdy przed i po**, tak jak 052 — porównania komórka po komórce |
| **4** | `NOT NULL` + rozstrzygnięcie losu sierot; usunięcie `ownerId`/`ownerTeamId` z odczytów; usunięcie **cichych wariantów lustra** z 051 | Nieodwracalne. Wolno dopiero, gdy etap 3 działa na produkcji i liczba sierot jest znana i wyzerowana |

Etap 3 jest tym, który wprowadza pierwszego czytelnika przestrzeni — a więc dopiero on zdejmuje
dług zapisany w 051 i przypomniany w 049: ciche warianty `mirrorTeamWorkspace`/
`mirrorPersonalWorkspace` mają wtedy zniknąć, bo rozjazd lustra przestanie być niewidoczny.

**Jedyna rzecz, która wyszła poza bazę — i to nie z wyboru.** Przebieg miał nie tknąć kodu
aplikacji i prawie się to udało: `next build` padł na `TagsManager`, gdzie podgląd etykiety
**jeszcze nieistniejącej w bazie** buduje się z literału obiektowego, a `TagChip` deklarował
`tag: Tag`. Kolumna dołożona do modelu weszła do wygenerowanego typu i literał przestał go
spełniać. „Zmiana tylko w schemacie" nie istnieje, dopóki typy Prismy są propsami komponentów.
Poprawka zwęża propsa do `Pick<Tag, "name" | "color">` zamiast dopisywać `workspaceId: null` —
komponent rysujący dwa pola nie ma powodu wymagać kompletu kolumn tabeli, a dopisanie pola
wróciłoby przy każdej następnej kolumnie, w tym w etapie 4. Kryterium AC-4 zostało z tego powodu
skorygowane w specu (C-54): mierzy **zachowanie aplikacji**, nie nietykalność sygnatur.

**Bramki:** build **exit 0**, `test:unit` **683/683**, liczniki **160 / 551 / 35 / 35** bez ruchu,
`check:schema-drift` zielony (schemat = katalog migracji), `git diff` **bez ani jednego pliku**
w `src/app/`, `src/components/` i `src/actions/`; w `src/` poza testem wyłącznie dwa pliki
powyższej poprawki typu.


---

### 055 — `workspaceId` utrzymywany dla nowych rekordów, etap 2 z czterech · 2026-08-12

**Dług, który rósł sam.** Po 054 kolumna była kompletna wobec danych z chwili migracji i
**niekompletna wobec przyszłych**: rekord utworzony później dostawał `NULL`, bo nic go nie
ustawiało. Etap 3 (przełączenie odczytów) takiego rekordu **po prostu by nie zobaczył** — zasób
zniknąłby właścicielowi z listy. Dlatego etap 2 idzie zaraz po etapie 1, a nie „kiedyś".

**Najważniejsza decyzja tego przebiegu: wyzwalacz w bazie, nie kod w ścieżkach zapisu.**
Własność ustawiają dziś **224** wywołania `create`/`createMany`/`upsert` w **75** plikach.
Dopisanie kolumny w każdym z nich miałoby jedno sprawdzenie — kompilator — a **kompilator nie widzi
BRAKU pola opcjonalnego**. To ten sam kształt, co lekcja „opcjonalny identyfikator w guardzie =
ciche wracanie do starej reguły".

Naturalnym drugim odruchem było **rozszerzenie klienta Prismy**. Odrzucone świadomie: widzi tylko
zapisy przechodzące przez ten konkretny egzemplarz klienta i tylko na najwyższym poziomie wywołania.
Omijają je zapisy zagnieżdżone, surowy SQL (repo go używa — seedy w migracjach, `lib/privacy/purge.ts`),
skrypty i wszystko, co ktoś napisze importując `PrismaClient` wprost. Byłoby to rozwiązanie, które
**wygląda** na jedno miejsce, a i tak wymagałoby bramki ścigającej obejścia.

Wyzwalacza nie omija nic. To jest ta sama zamiana, którą Omnia robi wszędzie: zamiast **wykrywać**
pominięcie — uczynić je **niemożliwym**. Bramka `check:workspace-fill` pilnuje wobec tego
**mechanizmu**, nie wywołań: jedyne, co można pominąć, to założenie wyzwalacza na nowej tabeli.

**Jedna funkcja na 45 tabel.** `to_jsonb(NEW)` pozwala tej samej implementacji obsłużyć tabele
z obiema kolumnami własności i te z samym `ownerId` — brakujący klucz w JSON-ie to po prostu `NULL`,
bez dynamicznego SQL-a i bez dwóch wariantów. Reguła jest więc zapisana **raz**, i jest tą samą,
którą stosuje backfill 0227 i `resolveRole`: `ownerId` przed `ownerTeamId`.

**Czego wyzwalacz nie robi — trzy świadome ograniczenia.** Nie działa na `UPDATE` (przeniesienie
zasobu między przestrzeniami przy zmianie właściciela to operacja etapu 3; dziś zmieniałaby dane,
których nikt nie czyta, i zabrałaby etapowi 3 możliwość porównania stanu). Nie nadpisuje wartości
podanej wprost (etap 3, testy i migracje danych muszą móc ustawić przestrzeń same). Nie wywraca
zapisu, gdy właściciel nie ma przestrzeni — zostawia `NULL`, bo **zapis użytkownika jest ważniejszy
niż kompletność kolumny, której nikt jeszcze nie czyta**. Ten ostatni przypadek jest w teście
najważniejszy: mechanizm siedzi na ścieżce zapisu każdego modułu, więc błąd w nim objawiłby się nie
brakującym polem, tylko **odrzuconym zapisem**.

**Kiedy to znika:** w etapie 4, razem z kolumnami `ownerId`/`ownerTeamId`, z których wywodzi wartość.
Wyzwalacz jest urządzeniem **przejściowym**, nie elementem architektury docelowej — nagłówek migracji
mówi to wprost, żeby za trzy miesiące nikt nie uznał go za stan pożądany.

#### Co zostaje na etapy 3 i 4

| Etap | Zakres | Warunek wejścia |
|------|--------|-----------------|
| **3** | `ResourceFacts` dostaje `workspaceId`; kroki 1–2 rozstrzygania w `platform/sharing/access.ts` czytają przestrzeń zamiast pary właścicieli; zakresy list idą po `workspaceId`; przeniesienie zasobu przy zmianie właściciela | **Tabela prawdy przed i po**, porównana komórka po komórce (C-17). To pierwszy moment, w którym kolumna cokolwiek znaczy |
| **4** | `NOT NULL`; rozstrzygnięcie losu sierot; usunięcie `ownerId`/`ownerTeamId`; **usunięcie wyzwalacza i cichych wariantów lustra z 051** | Etap 3 działa na produkcji, a liczba sierot jest znana i wyzerowana |

**Bramki:** build **exit 0**, `test:unit` **689/689**, liczniki **160 / 551 / 35 / 35** bez ruchu,
`check:workspace-fill` **45/45 tabel**, `check:schema-drift` zielony **bez nowych wyjątków**
(wyzwalacze są niewidoczne dla `prisma migrate diff`), `git diff` **bez ani jednego pliku**
w `src/app/`, `src/components/`, `src/actions/` i `src/modules/`.
