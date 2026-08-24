# Plan techniczny: Tryb czytania w Wiadomościach, jednolite ustawienia modułu i chrom nawigacji

- **Spec:** ./spec.md (087-tryb-czytania-i-chrom-nawigacji)
- **Status:** draft
- **Data:** 2026-08-24

## 1. Podejście

Dziewięć zgłoszeń rozkłada się na **trzy warstwy**, i to rozłożenie decyduje o kolejności prac.
Cztery usterki są **wadami RAMY** (kontrakt widoku, okno modalne) i naprawiamy je w powłoce, żeby
poprawka objęła wszystkie moduły naraz — to wprost reguła C-33 („gdy rama nie pasuje do widoku,
poszerz ramę, a nie rób wyjątku w module"). Cztery są **wewnątrz Wiadomości**. Jedna jest
**przebudową chromu konta** w powłoce.

Wzorce, które naśladujemy (C-53): menu pod trzema kropkami — `AnchoredLayer` tak jak `SourceFilter`
w tym samym module; stan widoku w adresie — `setViewState` z 084 (`tresc`, `zrodla`); slot ustawień
w pasku — `headerAction` z kontraktu widoku; przełącznik trybu czytania — wzorzec przycisku ikonowego
z `ContentSwitch`.

**Bez zmian w schemacie bazy i bez migracji.** Tryb czytania żyje w adresie (decyzja właściciela),
reorganizacja ikon nie ma stanu trwałego, a wszystkie pozostałe zgłoszenia to układ.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Żadnej migracji, żadnej kolumny, żadnego pola w `NewsPref`.

Konsekwencja dla bramek: `check:migrations` i `check:schema-drift` mają przejść **bez nowego pliku
migracji**; gdyby któraś zapaliła się na czerwono, to znaczy, że ktoś dopisał schemat przez pomyłkę.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych akcji i bez zmian w istniejących.** Feature jest w całości po stronie interfejsu.

Jedyne dotknięcie warstwy danych jest pośrednie: dialog ulubionych po scaleniu woła **te same** dwie
akcje co dziś — `addFavoriteView` i `removeFavoriteViewByPath` (`src/actions/favoriteViews.ts`),
razem z ich `revalidatePath` i guardami. Nie zmieniamy ich sygnatur ani zakresu; zmienia się tylko to,
z którego miejsca interfejsu są wołane.

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowych slugów.** `module.news`, `module.weather` i `module.home` bez zmian.
- **Uwaga na `module.home`:** usuwamy pozycję „Strona główna" z LISTY nawigacji, ale moduł zostaje
  w rejestrze (`src/lib/modules.tsx`), zachowuje trasę, uprawnienie i wpis w `check:module-registry`.
  Musi też **zniknąć z „Więcej…"**: pozycja wyłączona przez użytkownika trafia dziś do tej listy,
  więc bez jawnego wyłączenia strona główna wróciłaby tam jako „dział do włączenia".
- **Przełącznik trybu administratora** zachowuje dotychczasowy warunek widoczności (`isAdmin`) —
  przenosimy go o jeden wiersz wyżej, nie zmieniamy reguły.

## 5. UI

### 5.1 Rama widoku — trzy poprawki w `ModuleView`/`ViewBar` *(AC-6, AC-7, AC-8, AC-16)*

**(a) Odstęp pod nagłówkiem, gdy nie ma paska widoku (AC-16, Pogoda).**
Przyczyna jest w 085: dolne wypełnienie bloku nagłówka zostało wtedy przeniesione do GÓRNEGO
wypełnienia paska, żeby suma się nie zmieniła. Widok bez filtrów i bez akcji nie renderuje paska
(`pasekMaTresc === false`), więc razem z paskiem znika też ten odstęp — i treść przykleja się do
tytułu. Dotyczy to Pogody i pozostałych widoków bez paska (co najmniej dziesięć, m.in. Usługi,
Warsztaty). Poprawka: blok nagłówka dostaje dolne wypełnienie **wtedy i tylko wtedy**, gdy paska nie
będzie — wartość równa górnemu wypełnieniu paska, żeby widoki z paskiem nie drgnęły ani o piksel.

**(b) Akcje modułu na telefonie (AC-6).**
Dziś pierwszy wiersz paska to `div.flex.min-w-0.items-center.gap-2` z akcjami dosuniętymi `ml-auto`.
W wariancie gęstym tytuł jest `hidden md:flex`, więc **na telefonie w tym wierszu nie ma nic poza
akcjami** — stąd pusta lewa połowa. Poprawka: poniżej `md` akcje rozciągają się na całą szerokość
wiersza i dzielą ją równo (`flex-1` na dzieciach), co przy okazji powiększa cele dotyku (C-31).
Od `md` układ zostaje **dokładnie taki jak dziś** (`md:flex-none`, `md:ml-0`).

**(c) Slot ustawień modułu (AC-7, AC-8).**
`ModuleViewProps` dostaje pole `settings?: { onClick?: () => void; href?: string; active?: boolean;
label?: string }`. `ViewBar` rysuje je jako **ostatnią pozycję strefy akcji**: przycisk ikonowy
(koło zębate) z `aria-pressed` gdy `active`. Moduł bez `settings` wygląda identycznie jak dziś —
slot jest opcjonalny, więc żaden z 21 modułów nie wymaga zmiany.
Pierwszy konsument (C-35) to Wiadomości: czwarta zakładka `settings` znika z `VIEW_TABS`, a gear
w pasku **przełącza** widok ustawień i z powrotem (`active={view === "settings"}`), co rozwiązuje
problem powrotu — bez zakładki nie byłoby zaznaczonego widoku, do którego można wrócić.

### 5.2 Okno modalne — obszar gestów i treść potwierdzenia *(AC-13, AC-14)*

- `Modal` na telefonie jest arkuszem dolnym (`items-end`), a jego stopka z przyciskami leży na samej
  krawędzi ekranu — czyli na pasku gestów iPhone'a. Stopka dostaje **dolne wypełnienie powiększone
  o `env(safe-area-inset-bottom)`** (C-31, ten sam wzorzec co dolny pasek zakładek). Poprawka działa
  dla **wszystkich** okien aplikacji, nie tylko dla tego jednego.
- Potwierdzenie „Oznacz wszystkie" dostaje `description` mówiące, ilu wiadomości dotyczy i że nic nie
  ginie. `ConfirmProvider` już przepuszcza `description` — brakowało wyłącznie treści w wywołaniu.

### 5.3 Wiadomości — nagłówek sekcji i akcje tematu *(AC-9, AC-10, AC-11, AC-12)*

- **Chip licznika (AC-9, AC-10).** Dziś `h3` ma `flex-1`, więc zjada całą wolną szerokość i wypycha
  chip na przeciwny kraniec wiersza; do tego kontener ma `flex-wrap`, więc na wąskim ekranie całość
  łamie się na dwie linie. Poprawka: tytuł i licznik stają się **jedną grupą** (tytuł `min-w-0
  truncate`, chip `shrink-0` tuż obok), a rozpychanie do prawej przejmuje kontener akcji (`ml-auto`).
  `flex-wrap` znika — zawijanie było objawem, nie rozwiązaniem.
- **Menu pod trzema kropkami (AC-11, AC-12).** Akcje tematu (edycja, usunięcie) przenoszą się do
  `AnchoredLayer` otwieranego ikoną `MoreVertical` — ten sam prymityw i ten sam wzorzec, co
  `SourceFilter` w tym module (C-53), więc dostajemy zamykanie klikiem obok i pozycjonowanie za
  darmo. Usunięcie **zachowuje** `confirmDialog({ …, destructive: true })`.

### 5.4 Wiadomości — tryb czytania i szczelność pasków *(AC-1..AC-4, AC-15)*

- **Tryb czytania (AC-1..AC-4).** Nowy klucz stanu widoku `czytanie` obsługiwany przez istniejący
  `setViewState` (jak `tresc` i `zrodla` od 084) — dzięki temu widok w trybie czytania **da się
  zapisać w ulubionych** i wróci z adresu. Przy `czytanie=1` moduł:
  - nie renderuje `RefreshStatus`,
  - przekazuje do ramy `filters={undefined}` i `headerAction={undefined}` (zakładki i akcje główne
    znikają; pasek widoku sam przestaje się renderować, a `--view-bar-h` schodzi do zera — mechanizm
    z 086 już to obsługuje),
  - zostawia **własny** przyklejony pasek: nawigator tematów, filtr źródeł, przełącznik treści oraz
    **przełącznik trybu** (ikona), który jest wtedy jedynym wyjściem i dlatego musi w nim stać.
  - Lektor (`NewsReader`) to osobny, przyklejony pasek na dole — nietknięty.
  Przełącznik trybu w stanie wyłączonym stoi w tym samym miejscu (w pasku modułu), żeby wejście
  i wyjście były tym samym przyciskiem.
- **Szczelność pasków (AC-15).** Zgłoszenie mówi o dwóch rzeczach i obie sprawdzamy **pomiarem przed
  zmianą** (T-1), a nie z lektury kodu — lekcja z 086, gdzie diagnoza „z oka" okazała się
  nadinterpretacją:
  1. *pionowa przerwa* — treść widoczna między paskiem widoku a paskiem modułu,
  2. *boczny prześwit* — treść szersza niż paski.
  Hipotezy do potwierdzenia pomiarem: (1) pasek modułu jest przyklejony na `top: var(--view-bar-h)`,
  ale sam nie ma górnego wypełnienia równego swojemu `pt-1`, więc między dolną krawędzią tamtego
  a górną tego zostaje szczelina wysokości marginesu; (2) pasek modułu i nagłówki sekcji leżą
  w kontenerze `mx-auto max-w-6xl`, a **karty wiadomości** — w tym samym kontenerze, ale pasek widoku
  ramy rozciąga się na pełną szerokość, więc przy szerokim oknie tła nie pokrywają się na skrajach.
  Naprawa idzie w stronę **rozciągnięcia tła pasków na szerokość kontenera przewijania** (ujemne
  marginesy poziome równe wypełnieniu ramy albo tło na rodzicu), nigdy przez stałe liczby pikseli.

### 5.5 Asystent — wejście do logu rozumowania *(AC-5)*

`ReasoningLog` renderuje dziś **nad** stopką tury dwa przyciski tekstowe („Pokaż log rozumowania",
„Pokaż techniczny log rozumowania (admin)"), a ikona lektora stoi w stopce niżej. Rozdzielamy
komponent na dwie części: **przyciski ikonowe** (ikona `Brain` dla logu opisowego, `Bug` dla
technicznego — obie już są w repo) trafiają do **stopki tury**, obok lektora, kopiowania i ponowienia,
a **panel** z treścią renderuje się pod stopką, gdy rozwinięty. Stan `expanded`/`techExpanded`
przenosi się do komponentu tury; cztery miejsca renderujące `ReasoningLog` (tury `answer`, `report`,
`navigate`, `clarify`) dostają tę samą parę. Warunek `isAdmin && trybAdmina` dla logu technicznego
**zostaje bez zmian** (086).

### 5.6 Powłoka — chrom konta i nawigacja *(AC-17..AC-21)*

**Komputer (`ModuleSidebar`):**
- Wiersz z nazwą aplikacji dostaje po prawej: **przełącznik trybu administratora, a za nim dzwonek**
  (kolejność wprost ze zgłoszenia), wyrównane do prawej krawędzi wiersza.
- Rząd ikon pod nazwą aplikacji: **ikona strony głównej (link `/`), gwiazdka, skróty klawiszowe** —
  w tej kolejności, od lewej.
- `FavoritesSidebarSection` **znika z nawigacji** (i zostaje usunięty, bo traci jedynego konsumenta —
  C-53: martwy komponent w powłoce jest gorszy niż jego brak, lekcja z 084).
- Moduł `home` przestaje być pozycją listy: filtrujemy go z `enabled` **i** z `more`.

**Telefon (`AppShell`):**
- Znika przycisk `ArrowLeftRight` („Ulubione widoki") — po scaleniu dialogu gwiazdka robi jedno
  i drugie, a dwa wejścia do jednej rzeczy były właśnie przedmiotem zgłoszenia.
- Menu pełnoekranowe traci pozycje „Ulubione" i „Strona główna" (AC-21); powrót na stronę główną
  daje odnośnik z nazwą aplikacji w nagłówku menu, który już tam jest.
- Górny pasek zachowuje kolejność zgodną z komputerem: przełącznik admina, potem dzwonek.

**Dialog ulubionych (AC-18).** `FavoriteStarButton` ma dziś panel „zapisz to miejsce" (nazwa, ikona,
kolor), a osobno istnieje `FavoritesSwitcher` (lista z wyszukiwarką, `Alt+0`). Scalamy: gwiazdka
otwiera **jeden** panel z dwiema częściami — lista wszystkich zapisanych widoków (istniejący
`FavoritesSwitcher` jako część) oraz operacja na widoku bieżącym: „dodaj do ulubionych" albo „usuń
z ulubionych", zależnie od tego, czy bieżący adres już tam jest (ta informacja jest już liczona —
`fullPath` i porównanie z listą). `Alt+0` otwiera ten sam panel.

### 5.7 Teksty i motyw (C-30, C-32)

Każdy nowy tekst („Tryb czytania", „Wyjdź z trybu czytania", „Więcej działań", „Ustawienia modułu",
„Pokaż log rozumowania" jako `aria-label`, treść potwierdzenia „Oznacz wszystkie", „Dodaj do
ulubionych"/„Usuń z ulubionych") idzie do `messages/pl.json` pod przestrzenią wyprowadzoną ze ścieżki
pliku i jest czytany przez `useTranslations`. Bramka `check:i18n` jest od 097 regułą bezwzględną —
zero literałów w komponentach. Kolory wyłącznie ze zmiennych CSS; odstępy z `--view-padding`
i `env(safe-area-inset-*)`, nigdy ze stałych.

## 6. AI / integracje

**Nie dotyczy.** Zero nowych `AIAction`, zero read-tooli, zero wpięć w kalendarz, powiadomienia
i kosz. `check:actions`, `check:ai-coverage`, `check:cost-badge` i `check:content-memory` mają
przejść bez zmian w manifestach.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/components/ui/view/ModuleView.tsx` | edycja | odstęp pod nagłówkiem bez paska (AC-16); przekazanie slotu `settings` |
| `src/components/ui/view/ViewBar.tsx` | edycja | akcje na pełną szerokość poniżej `md` (AC-6); rysowanie slotu ustawień (AC-7, AC-8) |
| `src/components/ui/Modal.tsx` | edycja | stopka nad obszarem gestów systemowych (AC-14) |
| `src/modules/news/ui/sekcjeTematow.tsx` | edycja | chip przy tytule, bez zawijania (AC-9, AC-10) |
| `src/modules/news/ui/NewsPage.tsx` | edycja | menu trzech kropek (AC-11/12), tryb czytania (AC-1..4), gear zamiast czwartej zakładki (AC-7), szczelność pasków (AC-15) |
| `src/modules/news/ui/NewsStream.tsx` | edycja | treść potwierdzenia „Oznacz wszystkie" (AC-13) |
| `src/components/assistant/AICommandSheet.tsx` | edycja | przyciski logu rozumowania do stopki tury, z ikonami (AC-5) |
| `src/components/shell/ModuleSidebar.tsx` | edycja | dzwonek + przełącznik admina przy nazwie aplikacji, dom/gwiazdka/skróty w rzędzie, bez „Ulubionych" i „Strony głównej" (AC-17, 19, 20) |
| `src/components/shell/AppShell.tsx` | edycja | telefon: jedno wejście do ulubionych, menu bez dwóch pozycji (AC-21) |
| `src/components/favorites/FavoriteStarButton.tsx` | edycja | scalony dialog: lista + dodaj/usuń bieżący widok (AC-18) |
| `src/components/favorites/FavoritesSidebarSection.tsx` | **usunięcie** | traci jedynego konsumenta (C-53) |
| `messages/pl.json` | edycja | nowe teksty (C-32) |
| `e2e/specs/wiadomosci-tryb-czytania.spec.ts` | nowy | AC-1..AC-4, AC-9..AC-12, AC-15 |
| `e2e/specs/rama-i-chrom.spec.ts` | nowy | AC-6, AC-7, AC-14, AC-16, AC-17..AC-21 |
| `e2e/specs/chrom-konta.spec.ts` | edycja | dostosowanie testów 085/086 do nowego układu ikon |
| `e2e/specs/rama-widoku-przeglad.spec.ts` | edycja/bez zmian | przegląd dziesięciu tras ma nadal przechodzić |
| `doświadczenia.md` | edycja | wpisy za nieoczywiste problemy (C-51) |

## 8. Bramki i weryfikacja (C-50)

Lokalnie, na **lokalnym** Postgresie (C-13): `npm run build` (32 bramki + `next build` + budżet
wydajnościowy), `npm run test:unit`, pełna suita klikacza `bash scripts/e2e-web.sh`.

Mapowanie kryteriów na sposób sprawdzenia:

| AC | Jak sprawdzamy | AC | Jak sprawdzamy |
|----|----------------|----|----------------|
| AC-1 | klikacz: po włączeniu trybu brak paska stanu, zakładek i akcji; obecne nawigator, filtr, przełącznik treści | AC-12 | klikacz: obie akcje w menu działają, usunięcie pyta czerwonym przyciskiem |
| AC-2 | **pomiar**: odległość górnej krawędzi pierwszej wiadomości od góry ramy, przed i po (T-1) | AC-13 | klikacz: okno ma niepusty opis z liczbą |
| AC-3 | klikacz: przełącznik widoczny przy przewinięciu zero, powrót do stanu wyjściowego | AC-14 | **pomiar**: dolna krawędź stopki okna względem `env(safe-area-inset-bottom)` przy wymuszonej wartości |
| AC-4 | klikacz: adres z `czytanie` otwiera widok w trybie czytania | AC-15 | **pomiar** przy przewinięciu: brak piksela treści w prostokącie między paskami i po ich bokach |
| AC-5 | klikacz: przycisk logu jest w tym samym wierszu co lektor i ma ikonę | AC-16 | **pomiar**: odstęp między dolną krawędzią bloku nagłówka a górną pierwszego elementu > 0 |
| AC-6 | **pomiar** przy 360 px: brak pustej lewej połowy wiersza akcji, brak przycięcia | AC-17 | klikacz: w nawigacji nie ma pozycji „Ulubione" ani „Strona główna" |
| AC-7 | klikacz: gear w strefie akcji, nie wśród zakładek | AC-18 | klikacz: gwiazdka otwiera dialog z listą i z operacją na bieżącym widoku |
| AC-8 | test na **sondzie**: widok z `settings` rysuje gear w tym samym miejscu bez kodu w module | AC-19 | klikacz: w wierszu nazwy aplikacji admin-przełącznik przed dzwonkiem |
| AC-9 | **pomiar**: odległość chipu od tytułu | AC-20 | klikacz: kolejność ikon w rzędzie: dom, gwiazdka, skróty |
| AC-10 | **pomiar** przy 360 px: jeden wiersz, brak przycięcia licznika | AC-21 | klikacz (widok telefonu): menu bez dwóch pozycji, ikony w górnym pasku |
| AC-11 | klikacz: brak odsłoniętych ikon edycji/usuwania, jest ikona trzech kropek | | |

**Zasada pomiarów (lekcja 086):** każdy pomiar musi **odróżniać** naprawę od jej braku. Tam, gdzie
liczba przed i po może wyjść taka sama (AC-15, AC-16), test buduje warunek, w którym wersje się
rozjeżdżają, i sprawdzamy go **kontrolą negatywną** — cofnięciem poprawki.

## 9. Ryzyka techniczne i plan wycofania

- **Zmiana w `ViewBar` dotyka 21 modułów.** Mitygacja: `rama-widoku-przeglad` (dziesięć tras różnych
  klas) plus `check:ui-contract`; zmiana poniżej `md` jest zamknięta w wariancie mobilnym, a od `md`
  układ zostaje bit w bit.
- **Odstęp pod nagłówkiem zmienia wygląd ~10 widoków bez paska.** To jest zamierzone (te widoki mają
  dziś usterkę), ale przegląd ramy musi potwierdzić, że widoki **z** paskiem nie drgnęły.
- **Usunięcie pozycji z nawigacji odbiera drogę.** Mitygacja: ikona domu jest pierwsza w rzędzie
  chromu, gwiazdka otwiera pełną listę ulubionych, `Alt+0` działa jak dotąd.
- **Scalenie dwóch wejść do ulubionych** może zgubić funkcję wyszukiwarki. Mitygacja: `FavoritesSwitcher`
  wchodzi do dialogu **jako całość**, nie jest przepisywany.
- **Tryb czytania chowa pasek widoku**, więc `--view-bar-h` schodzi do zera i pasek modułu przykleja
  się na górze ramy. To ta sama ścieżka, którą 086 już opisuje i testuje.
- **Rollback:** feature nie ma migracji, więc wycofanie to `git revert` commitów. Żadne dane
  użytkownika nie zmieniają kształtu.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14 (migracje)** — bez zmian w schemacie; brak migracji jest świadomy i zapisany.
- [x] **C-20..C-25 (server/RBAC/AI/trash/audit)** — bez nowych akcji; ulubione wołają istniejące,
      z ich `revalidatePath`; `module.home` zostaje w rejestrze mimo zniknięcia z listy.
- [x] **C-30..C-32 (UX)** — zmienne CSS, `env(safe-area-inset-*)`, warianty mobilne, teksty przez `t()`.
- [x] **C-33 (kontrakt widoku)** — trzy poprawki idą do RAMY, nie do modułów; slot ustawień poszerza
      kontrakt zamiast tworzyć wyjątek.
- [x] **C-34 (potwierdzenia)** — okno „Oznacz wszystkie" dostaje treść; usunięcie tematu zostaje
      jawnie destrukcyjne.
- [x] **C-35 (komponent z konsumentem)** — slot ustawień dowozimy razem z Wiadomościami; martwy
      `FavoritesSidebarSection` usuwamy, zamiast zostawiać „na wszelki wypadek".
- [x] **C-53 (minimalizm)** — zero nowych zależności; menu na istniejącym `AnchoredLayer`, stan
      w istniejącym `setViewState`, dialog z istniejącego `FavoritesSwitcher`.
