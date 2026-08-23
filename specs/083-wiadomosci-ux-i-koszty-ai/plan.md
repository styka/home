# Plan techniczny: Wiadomości — porządek w widoku i nawigator tematów; koszty AI poza treścią

- **Spec:** ./spec.md (083-wiadomosci-ux-i-koszty-ai)
- **Status:** draft
- **Data:** 2026-08-19

## 1. Podejście

Przebieg dzieli się na trzy warstwy o różnym zasięgu i **żadna nie rusza schematu bazy**.

1. **Powłoka (cała aplikacja):** duplikat gwiazdki i mylący wskaźnik świeżości mieszkają we wspólnym
   kontrakcie widoku — poprawka jest jedna i obejmuje 22 moduły (C-33).
2. **Koszty AI (przekrojowo):** komponent kosztu przestaje renderować cokolwiek, dopóki
   administrator nie włączy przełącznika, ale **melduje koszt zawsze**. Meldunek idzie klienckim
   autobusem zdarzeń do ulotnych powiadomień w rogu ekranu.
3. **Wiadomości:** widok chudnie (znika historia odświeżeń, przełącznik trybów i pas chipsów),
   a nawigacja przenosi się do jednego przyklejonego paska zbudowanego na **nowym wspólnym
   komponencie** `GroupNavigator`.

Wzorce do naśladowania: `ViewChrome`/`ViewBar` (chrom powłoki), `ToastProvider` (ulotne
powiadomienia w rogu — ten sam wzorzec montowania i warstwy), `platform/viewState` (stan widoku
w adresie, dzięki czemu filtry da się zapisać w ulubionych).

**Kluczowa decyzja upraszczająca: ZERO migracji.** Przełącznik kosztów to preferencja widokowa
administratora → `localStorage`. Wybór tematu i źródeł → stan widoku w adresie (043), czyli przy
okazji da się je zapisać gwiazdką jako ulubiony widok. Spec §6 dopuszcza oba warianty; wybieramy
tańszy, bo żadne z tych ustawień nie jest danymi użytkownika.

## 2. Model danych (Prisma)

**Bez zmian w schemacie. Bez migracji.** (Uzasadnienie w §1.)

Konsekwencja dla bramek: `check:migrations` i `check:schema-drift` mają przejść bez nowych plików;
gdyby w trakcie implementacji okazało się, że coś jednak wymaga kolumny — to jest sygnał, że
projekt zboczył, i trzeba wrócić do planu (C-54), a nie dokładać migracji po cichu.

## 3. Warstwa serwera (Server Actions — C-20)

Zmiany są niemal wyłącznie kliencko-widokowe. Wyjątki:

| Akcja | Zmiana | Guard |
|-------|--------|-------|
| `news:getNewsRefreshHistory` | **usunięcie** wraz z widokiem historii odświeżeń (C1/AC-16). Model `NewsRefreshRun` i zapis przebiegów **zostają** — to dane administracyjne, tylko bez widoku w module użytkownika | — |
| `news:getTopicTimeline` | rozszerzenie o wariant „wszystkie tematy": zwraca wpisy ze wszystkich tematów użytkownika z identyfikatorem i tytułem tematu przy każdym wpisie (AC-24, AC-25). `take: SUFIT_LISTY`, filtr własnościowy jak dziś | `requireAuth()` + `filtrMoichRekordow` |

Wpisy w `src/lib/ai/action-coverage.json`: usunięcie wpisu skasowanej akcji (bramka wywala się na
martwym wpisie), bez nowych akcji. `revalidatePath("/wiadomosci")` bez zmian tam, gdzie już jest.

## 4. RBAC / rejestr modułu (C-22)

**Bez nowych slugów i bez zmian w rejestrze.** Widoczność kosztów rozstrzyga istniejąca bramka
`visibleUsage` (administrator **i** `Config.ai_cost_badge_enabled`) — i to się nie zmienia, bo jest
**strukturalna**: konto bez `module.admin` nie dostaje danych o modelach i tokenach na drut (AC-6,
AC-15). Przełącznik z AC-8 steruje wyłącznie **rysowaniem** danych, które admin i tak już ma.

## 5. UI

### 5.1 Powłoka — jedna gwiazdka, czytelny wskaźnik świeżości (AC-1..AC-5)

Dziś „zapisz ten widok" renderuje się w **trzech** miejscach:
`AppShell` → mobilny górny pasek (`md:hidden`), `FavoritesSidebarSection` (desktop, wiersz nagłówka
sekcji) i `ViewBar` przez `chrome.favorite`. Do tego sekcja „ULUBIONE" ma **własną ikonę gwiazdki
jako etykietę**, stojącą tuż obok tamtej akcji — stąd „dwie gwiazdki".

- **Jedno miejsce akcji: `ViewBar`.** Usuwamy `FavoriteStarButton` z `FavoritesSidebarSection`
  (zostaje lista ulubionych, wyszukiwarka i przełącznik) oraz z mobilnego paska w `AppShell`.
- **Etykieta sekcji traci gwiazdkę** — zostaje sam tekst i chevron; ikona gwiazdki ma odtąd jedno
  znaczenie w całej aplikacji: „zapisz/odznacz ten widok".
- **Ryzyko i mitygacja:** na trasach bez `ModuleView` (`/admin/*`, `/settings`) mobilny pasek był
  jedynym wejściem do zapisu widoku. W tym pasku **zostaje przełącznik ulubionych** (`⇄`), a lista
  ulubionych jest w menu — zapis widoku administracyjnego nie jest realną potrzebą. Odnotowane
  w §9.
- **`FreshnessIndicator` przestaje wyglądać jak wyłączony przycisk:** renderujemy go jako
  **podpis** (ikona `aria-hidden` + tekst „Dane: 3 min temu"), bez tła, obramowania i stanu
  `hover`, z `title` wyjaśniającym, że to wiek danych. Nie zmieniamy mechanizmu odświeżania.
- **Wiadomości:** przycisk „Odśwież" zostaje **jedynym** wywołaniem odświeżenia modułu i stoi
  w `headerAction` `ModuleView` — czyli tam, gdzie akcje główne w pozostałych modułach (AC-4, AC-5).

### 5.2 Koszty AI (AC-6..AC-15)

Trzy nowe pliki w platformie + jeden provider w powłoce:

- `src/platform/ai/kosztBus.ts` — **kliencki** autobus zdarzeń (ten sam wzorzec co
  `lib/ai/feedbackBus.ts`): `zglosKoszt({ akcja, usage })` i `onKoszt(handler)`. Bez Reacta,
  bez Prismy, więc importuje się go z dowolnego komponentu.
- `src/platform/ai/kosztWidocznosc.tsx` — kontekst `PokazKosztyProvider` + hook
  `usePokazKoszty()`. Stan trzymany w `localStorage` (klucz `omnia.pokazKoszty`), **domyślnie
  wyłączony** (AC-7). Odczyt w `try/catch` — prywatne okno i zablokowane dane witryny są poprawnym
  stanem, nie błędem.
- `src/components/ui/KosztToasts.tsx` — nasłuchuje autobusu i rysuje ulotne powiadomienia
  w **prawym górnym rogu**, `position: fixed`, znikają po ~6 s, maks. 3 naraz (starsze wypadają),
  kolejne wywołania tej samej akcji **łączą się w jedno** z licznikiem („×3") zamiast układać
  w stos (ryzyko „zalania ekranu" ze speca §9). Warstwa **powyżej** modali i pływającego asystenta.

**Gdzie melduje koszt.** W `AiCostBadge` — dokładnie tam, gdzie dziś trafia `usage`. Komponent
zyskuje **wymagany** prop `akcja: string` (nazwa biznesowa) i:
- **melduje zawsze**, gdy dostanie zużycie (niezależnie od przełącznika) → AC-11,
- **renderuje `null`**, gdy przełącznik jest wyłączony → AC-7,
- renderuje jak dziś (kwota + rozwijane składowe), gdy włączony → AC-10.

To jest jedyny punkt, przez który przechodzi każde zużycie pokazywane użytkownikowi, więc jedno
miejsce daje pełne pokrycie. `akcja` jest **wymagana, bez wartości domyślnej** — opcjonalna
z „historycznym" domyślnikiem dałaby ciche „Nieznana akcja" w połowie miejsc (wzorzec C-36).
Konsumentów jest **26** (`rg -l AiCostBadge`); każdy dostaje krótką etykietę po polsku
(np. „Streszczenie wiadomości", „Ocena obserwatorów pogody", „Plan tygodnia") — mechaniczna zmiana,
jeden prop na plik. `AiContentMeta` przekazuje etykietę dalej z `AI_SECTION_LABELS[sectionKind]`,
więc jego sześciu konsumentów nie zmienia się wcale.

**Przełącznik.** Ikona (`Coins`) w mobilnym górnym pasku obok dzwonka **oraz** w wierszu nagłówka
`FavoritesSidebarSection` na desktopie — czyli w tym samym miejscu, z którego właśnie zabraliśmy
gwiazdkę; renderowana **tylko** gdy `visibleUsage` przepuszcza cokolwiek (admin + wyłącznik
systemowy), więc nie-administrator nie widzi nawet przełącznika (AC-15). W asystencie AI: ta sama
ikona w jego własnym nagłówku, obok istniejących przycisków panelu (AC-9).

**Skąd powłoka wie, że to administrator.** `AppShell` dostaje już `userPermissions`; dokładamy
jeden boolean `kosztyDostepne` liczony po stronie serwera (admin ∧ `ai_cost_badge_enabled`) — nie
przenosimy tej decyzji do klienta.

### 5.3 Wiadomości — nawigator, źródła, linia czasu (AC-16..AC-25)

**Nowy wspólny komponent** `src/components/ui/nav/GroupNavigator.tsx` (AC-29, AC-30):
przyjmuje `grupy: {id, etykieta, licznik?}[]`, `aktywnaId`, `onWybor`, opcjonalne `akcje`
(dodatkowe kontrolki po prawej) i `pozycjaWszystkie` (etykieta pozycji zbiorczej). Rysuje:
`[◀] [etykieta bieżącej pozycji jako wyzwalacz listy] [▶] [akcje]`. **Nie wie nic o wiadomościach** —
dostaje dane i wywołania zwrotne. Pierwszym (i na razie jedynym) konsumentem jest moduł Wiadomości;
C-35 wymaga konsumenta, nie dwóch.

Zmiany w module:
- **Znika `RefreshHistory`** i przełącznik `Strumień / Jeden temat` (AC-16, AC-17).
- **Znika pasek chipsów tematów z 082** — zastępuje go `GroupNavigator` ze strzałkami i listą,
  gdzie **pierwszą pozycją jest „Wszystkie"** (AC-17, AC-18). Pasek **nie pokazuje nazwy tematu
  bieżącego** jako osobnego znacznika — nazwa jest w przyklejonym nagłówku sekcji.
  > Uwaga do 082: wyzwalacz listy w nawigatorze pokazuje etykietę **wybranej pozycji filtru**
  > („Wszystkie" albo nazwa tematu), a nie „temat, który akurat mijam przewijając". To jest inna
  > informacja i dlatego nie jest duplikatem nagłówka sekcji.
- **Przejście w bok (AC-19, AC-20).** Kontener sekcji tematów dostaje klasę przejścia
  `transform: translateX(...)` na czas zmiany tematu (±24 px, ~180 ms, z poszanowaniem
  `prefers-reduced-motion`), po czym wraca do zera i wykonuje **pionowe** przewinięcie do sekcji.
  **Przewijamy wyłącznie ramę widoku**, nigdy przez mechanizm sięgający przodków — to jest wprost
  lekcja z 082-poprawki i warunek utrzymania AC-20.
- **Akcje tematu** (edycja, usunięcie, dodanie) przenoszą się z paska do **przyklejonego nagłówka
  sekcji tematu**, obok istniejących akcji („słuchaj", „oznacz jako przeczytane") — AC-21.
  „Dodaj temat" jako akcja modułu ląduje w `headerAction` obok „Odśwież".
- **Filtr źródeł** (AC-22, AC-23): ikona `Filter` z licznikiem w `akcje` nawigatora, otwierająca
  panel (`AnchoredLayer`, ten sam co rozwinięcie kosztu) z listą źródeł, polem szukania
  i „zaznacz/odznacz wszystkie". Stała wysokość paska niezależnie od liczby źródeł.
- **Linia czasu dla wszystkich tematów** (AC-24, AC-25): przełącznik `Wiadomości ⇄ Linia czasu`
  przestaje zależeć od wyboru pojedynczego tematu; przy „Wszystkie" wpisy grupują się w te same
  sekcje z przyklejonym nagłówkiem tematu, co widok wiadomości — jedna metafora dla obu widoków.

### 5.4 Zakładka Źródła (AC-26..AC-28)

- Wiersz źródła dostaje **stałą strukturę**: nazwa + opis (znacznik) w kolumnie rosnącej, adres jako
  drugi wiersz z `truncate`, akcje w stałej kolumnie po prawej. Dziś nazwa, adres i akcje siedzą
  w jednym `flex-wrap`, przez co przy różnych długościach nazw wiersze „skaczą" — stąd „krzywo".
- **Domyślna długość streszczeń przenosi się nad listę** źródeł (AC-27): to ustawienie modułu,
  a nie pozycja listy; jest małe i ma stać tam, gdzie się je znajduje bez przewijania.
- Zakładka dostaje **ten sam nagłówek sekcji** co pozostałe dwie (AC-28).

### 5.5 Ramki skórki (AC-31)

`ChromeFrame` jest dziś renderowany **wewnątrz** przewijanego kontenera `ModuleView`
(`position: absolute; inset: 0`), więc `inset` odnosi się do całej przewijanej treści, a nie do
okna. W modułach o krótkiej treści nie widać różnicy — w Wiadomościach narożniki odjeżdżają.
Poprawka: `position: sticky` na opakowaniu narożników albo wyniesienie ich **poza** element
z `overflow-y` (do warstwy rodzica z `position: relative`). Wybieramy wyniesienie — `sticky`
z `inset: 0` nie da dolnych narożników we właściwym miejscu. Sprawdzamy na module krótkim
(np. `/pogoda`) i długim (`/wiadomosci`).

### 5.6 Teksty i motyw

Wszystkie nowe napisy do `messages/pl.json` (C-32); kolory wyłącznie ze zmiennych CSS (C-30);
cele dotyku `py-3`, `Esc` zamyka panele, jeden mechanizm na telefon i desktop (C-31).

## 6. AI / integracje

**Bez nowych `AIAction` i read-toolów** (C-23). Bez zmian w routingu modeli (C-40). Zmiana dotyczy
wyłącznie **prezentacji** kosztu; `visibleUsage`, `estimateCost` i przepływ zużycia zostają.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/platform/ai/kosztBus.ts` | nowy | kliencki autobus zdarzeń kosztu |
| `src/platform/ai/kosztWidocznosc.tsx` | nowy | kontekst + hook przełącznika (localStorage) |
| `src/components/ui/KosztToasts.tsx` | nowy | ulotne powiadomienia w prawym górnym rogu |
| `src/components/ui/AiCostBadge.tsx` | edycja | wymagany prop `akcja`; meldunek zawsze, render pod przełącznikiem |
| `src/components/ui/AiContentMeta.tsx` | edycja | przekazuje etykietę sekcji jako `akcja` |
| 24 pliki modułów wołające `AiCostBadge` | edycja | dodanie propu `akcja` z polską nazwą |
| `src/components/shell/AppShell.tsx` | edycja | provider przełącznika + `KosztToasts`; usunięcie gwiazdki z mobilnego paska; `kosztyDostepne` |
| `src/components/favorites/FavoritesSidebarSection.tsx` | edycja | usunięcie duplikatu gwiazdki i ikony-etykiety; miejsce na przełącznik kosztów |
| `src/components/shell/FreshnessIndicator.tsx` | edycja | podpis zamiast pozornego przycisku |
| `src/components/ui/view/ChromeFrame.tsx` + `ModuleView.tsx` | edycja | narożniki poza przewijaną treścią |
| `src/components/ui/nav/GroupNavigator.tsx` | nowy | wspólny nawigator po grupach |
| `src/modules/news/ui/NewsPage.tsx` | edycja | nawigator, „Wszystkie", filtr źródeł, bez historii i trybów |
| `src/modules/news/ui/TopicPicker.tsx` | **usunięcie** | zastąpiony przez `GroupNavigator` |
| `src/modules/news/ui/NewsStream.tsx` | edycja | akcje tematu w nagłówku sekcji, przejście w bok |
| `src/modules/news/ui/NewsTimeline.tsx` | edycja | linia czasu dla wszystkich tematów, sekcje po temacie |
| `src/modules/news/ui/NewsSettings.tsx` | edycja | równy wiersz źródła, ustawienie nad listą |
| `src/modules/news/ui/RefreshHistory` (w `NewsPage.tsx`) | usunięcie | AC-16 |
| `src/modules/news/actions/news.ts` | edycja | usunięcie `getNewsRefreshHistory`, wariant „wszystkie" w linii czasu |
| `src/components/assistant/AICommandSheet.tsx` | edycja | przełącznik kosztów w nagłówku asystenta |
| `src/lib/ai/action-coverage.json` | edycja | usunięcie wpisu skasowanej akcji |
| `messages/pl.json` | edycja | nowe teksty |
| `e2e/specs/news-stream-scroll.spec.ts` | edycja | dostosowanie selektorów do nawigatora (test z 082 musi dalej pilnować AC-20) |
| `src/lib/ui/view-contract.json` | ewentualna edycja | jeśli zmieni się plik wejściowy widoku |
| `CLAUDE.md`, `doświadczenia.md` | edycja | tabela modułu, lekcje |

## 8. Bramki i weryfikacja (C-50)

Lokalnie (C-13 — nigdy prod `DATABASE_URL`), zatrzymanie **przed** `scripts/migrate.js`:
`check:i18n`, `check:ui-contract`, `check:boundaries`, `check:module-registry`, `check:ai-coverage`,
`check:actions`, `check:pagination`, `check:tailwind`, `check:client-safe`, `check:e2e-waits`,
`check:logs`, `check:owner-columns`, `tsc --noEmit` (główny + testowy), `test:unit`,
`next lint --dir src`, `next build`, `check:perf`.

**Weryfikacja w przeglądarce jest obowiązkowa** — to jest wprost lekcja z 082: bramki statyczne nie
mają reprezentacji dla układu strony. Uruchamiamy aplikację lokalnie (`next start` + lokalny
Postgres + zaseedowane tematy) i mierzymy.

| AC | Sposób weryfikacji |
|----|--------------------|
| AC-1, AC-2 | zliczenie ikon gwiazdki w DOM na desktopie i mobile (klikacz), na module i poza modułem |
| AC-3 | brak `role="button"`/`cursor:pointer` na wskaźniku świeżości; obecny tekst |
| AC-4, AC-5 | przegląd: jedno wejście „Odśwież"; porównanie rozmieszczenia z 2–3 innymi modułami |
| AC-6 | konto bez `module.admin`: brak `usage` w odpowiedzi (test integracyjny na `visibleUsage`) |
| AC-7, AC-8, AC-10 | klikacz: brak kosztu → przełącznik → koszt widoczny → rozwinięcie składowych |
| AC-9 | obecność przełącznika w nagłówku asystenta |
| AC-11..AC-14 | klikacz: wywołanie AI → powiadomienie z kwotą i nazwą akcji → znika; dwa różne komponenty → dwie różne nazwy; brak w dzwonku; test warstwy nad modalem |
| AC-15 | `ai_cost_badge_enabled=0` → brak przełącznika i powiadomień |
| AC-16, AC-17 | brak sekcji historii i przełącznika trybów; „Wszystkie" pierwsze na liście |
| AC-18 | pasek nie zawiera nazwy tematu bieżącego jako osobnego znacznika |
| AC-19, AC-20 | **pomiar w przeglądarce**: `scrollTop` nie maleje przy przewijaniu przez tematy (rozszerzony spec z 082) |
| AC-21 | akcje tematu w nagłówku sekcji, nie w pasku |
| AC-22, AC-23 | wysokość paska przy 3 i przy 15 źródłach — **taka sama**; panel wyboru działa |
| AC-24, AC-25 | „Wszystkie" + linia czasu → widok się renderuje, każdy wpis ma temat |
| AC-26..AC-28 | zrzut zakładki Źródeł; ustawienie długości widoczne bez przewijania |
| AC-29, AC-30 | `GroupNavigator` nie importuje niczego z `modules/news`; ma konsumenta |
| AC-31 | pomiar położenia narożników przed i po przewinięciu, na module krótkim i długim |

## 9. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja |
|--------|-----------|
| Usunięcie gwiazdki z mobilnego paska zabiera zapis widoku na trasach bez `ModuleView` (`/admin/*`) | świadome: przełącznik ulubionych i lista zostają; zapis widoku administracyjnego nie jest realną potrzebą. Gdyby okazało się potrzebny — gwiazdka wraca do paska, a znika z `ViewBar` (jedno miejsce, nie zero) |
| **26 plików z nowym wymaganym propem** — łatwo o pominięcie | prop **wymagany**, więc pominięcie to błąd kompilacji, nie ciche „Nieznana akcja" |
| Przejście w bok może odtworzyć szarpanie strony z 082 | przewijamy wyłącznie ramę widoku; klikacz z 082 zostaje i jest rozszerzony o nawigator (AC-20) |
| Ulotne powiadomienia mogą zalać ekran | maks. 3 naraz, łączenie powtórzeń tej samej akcji z licznikiem, auto-znikanie |
| `localStorage` bywa niedostępny (prywatne okno, zablokowane dane) | odczyt i zapis w `try/catch`, brak wartości = wyłączone; komponent renderuje się poprawnie bez zapisu |
| Usunięcie `TopicPicker` psuje test z 082 | test jest **aktualizowany w tym samym commicie** i dalej pilnuje braku szarpania |
| Wyniesienie `ChromeFrame` zmienia wygląd tam, gdzie problemu nie było | porównanie zrzutów modułu krótkiego i długiego przed/po |

**Wycofanie:** czysty `git revert` scalenia — brak migracji oznacza brak stanu do cofnięcia w bazie.
Trzy warstwy (§1) są w osobnych commitach, więc da się cofnąć samą warstwę kosztów albo sam moduł.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — nie dotyczy: **zero zmian w schemacie i zero migracji** (§2)
- [x] **C-20/C-21** — jedyne zmiany akcji to usunięcie martwej i rozszerzenie odczytu; guardy i filtr własnościowy bez zmian
- [x] **C-22** — bez nowych slugów; widoczność kosztów dalej rozstrzyga bramka serwerowa
- [x] **C-23/C-40** — zero nowych `AIAction`; routing modeli nietknięty
- [x] **C-30/C-31/C-32/C-34** — zmienne CSS, jeden mechanizm mobile+desktop, `py-3`, `Esc`, teksty w `messages/pl.json`, potwierdzenia przez `confirmDialog`
- [x] **C-33** — poprawka chromu idzie do **wspólnego kontraktu widoku**, nie do modułu
- [x] **C-35** — `GroupNavigator` dowieziony **razem z konsumentem** (Wiadomości)
- [x] **C-36** — `GroupNavigator`, autobus kosztu i przełącznik nie znają żadnego modułu; powłoka nie sięga do wnętrza modułu
- [x] **C-53** — bilans netto **ujemny**: znikają `TopicPicker`, historia odświeżeń, przełącznik trybów, pas chipsów i dwa duplikaty gwiazdki; dochodzą trzy małe pliki platformy i jeden wspólny komponent
- [x] **C-50/C-51/C-52** — build do `next build`, lekcje do dziennika, merge i promocja
