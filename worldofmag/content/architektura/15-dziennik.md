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

**Faza 1 jest ZROBIONA W CZĘŚCI — jako pionowy wycinek** (przebieg 046). Powstała warstwa
`src/platform/`, cztery moduły stoją w `src/modules/` z kontraktami, granica jest **egzekwowana
lintem i dwiema bramkami**, a rejestr, uprawnienia i mapowanie ścieżek dla tych czterech modułów
wynikają z **jednej deklaracji**. Poza wycinkiem zostaje **17 modułów** i **zadanie 8** (asystent AI).
Lista jest jawna niżej — to jest dług nazwany, a nie cisza.

**Następny krok: kolejne fale Fazy 1** — przenoszenie modułów od najmniej do najbardziej sprzężonych,
po jednym commicie na moduł, tym samym wzorcem, który 046 sprawdził na czterech.

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
| 4 | `src/platform/` — przeniesienie wspólnych zdolności | 🟡 | Przeniesione: `auth/{session,permissions,serverUtils,ownership}`, `db/prisma`, `trash`, `audit`, `notifications`, `viewState`, `shortcuts`, `favorites`, `registry`. `platform/ui` jest **re-eksportem** `components/ui` (świadomie — patrz wpis 046). **Zostaje:** `ai` (25 plików / 97 importujących), `llm` (8/55), `jobs` (5/45) |
| 5 | `src/modules/<x>/` — moduł po module | 🟡 | **4 z 21**: Trasy TIR, Kontakty, Raporty, QA — każdy osobnym commitem. **Zostaje 17** (lista niżej) |
| 6 | `contract.ts` + reguła ESLint blokująca import przez granicę | ✅ | Dwie reguły `no-restricted-imports` (moduł↔moduł, platforma↛moduł) + bramka `check:boundaries`, która sama je łamie i wymaga błędu. Sprawdzone: wyłączenie reguły **i** zepsucie konfiguracji czerwienią bramkę |
| 7 | `defineModule` + wyprowadzenie rejestru, uprawnień, nawigacji | 🟡 | `defineModule` + `module.ts` dla 4 modułów; ich wpisy **usunięte** z `lib/modules.tsx` i `platform/auth/permissions.ts`. Bramka `check:module-registry`. Pulpit i kalendarz **jeszcze nie** wynikają z deklaracji — dojdą razem z modułami, które je zasilają |
| 8 | Migracja asystenta AI na katalog składany z deklaracji | ⬜ | Dokument stawia je **ostatnim w fazie**, po wszystkich modułach — świadomie nietknięte |

### Faza 2 — Współdzielenie i współbieżność

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 9 | Modele `Workspace`, `WorkspaceMember`, `ResourceGrant`, `ResourceInvitation` | ⬜ | |
| 10 | `platform/sharing` — `requireAccess`, dziedziczenie, cache | ⬜ | |
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
