# Rozdział 11 — UX, design system, dostępność, i18n

## Kontekst / stan z kodu

- **Biblioteka UI** (`src/components/ui/`): `Button`, `IconButton`, `Card`, `Surface`, `Badge`,
  `Toast`, `EmptyState`, `LineChart`, `SmartTextarea`, `ImageUrlInput` + podkatalog `home/`
  (`PageHeader`, `StatTile`, `LoadingState`, `EmptyState` wariant, `styles.ts`).
- **Brakujące prymitywy:** brak współdzielonego `Modal/Dialog`, `Tooltip`, opakowań `Input/Select/
  Textarea`, `Dropdown`, `Pagination`, `Tabs` (Radix jest w zależnościach, ale nie owinięty w prymityw),
  oraz **brak `ErrorBoundary`/`error.tsx`**.
- **Tokeny:** `src/app/globals.css` — 43 zmienne CSS (tła, teksty, 11 akcentów, `--radius`,
  `--font-size-base`, `--on-accent`, `--color-scheme`). **Brak tokenów odstępów i typografii** —
  `gap/padding/fontSize` wpisywane inline.
- **Inline-style:** ~5000 wystąpień `style={{…}}` w ~245 plikach (kolory przez zmienne, układ ręcznie).
- **Stany:** ładowanie — `LoadingState` + **21** `loading.tsx` (dobrze). Pusty — **dwie** implementacje
  (`ui/EmptyState` i `ui/home/EmptyState`) = duplikacja. Błąd — **0** `error.tsx`, brak `ErrorBoundary`,
  obsługa tylko przez toasty.
- **a11y:** ~96 atrybutów `aria-*` w 65 plikach, 14 `role=`. `IconButton` **wymusza** `aria-label`;
  globalny `:focus-visible`. Braki: `<img>` często **bez `alt`** (~25 obrazów, nieliczne z altem),
  sygnalizacja **samym kolorem** (statusy), brak `sr-only`, niezweryfikowana nawigacja klawiaturą po
  modalach/overlayach.
- **i18n:** **brak** (zero bibliotek; UI zahardkodowany po polsku). `userTime.ts` obsługuje strefy
  (domyślnie `Europe/Warsaw`), ale brak lokalizowanych formatów dat/liczb/waluty (`formatMoney`
  ręczny, bez `Intl.NumberFormat`).
- **Mobile:** `hidden md:flex` sidebar + górny pasek i dolny tab bar (`md:hidden`), `safe-area-inset`
  uwzględnione. Typografia/odstępy **nieresponsywne** (stałe wartości).
- **Skórki:** `src/lib/skins.ts` — 21 sterowalnych tokenów, **silna walidacja** (`sanitizeTokenValue`:
  whitelist + regex, blokada wstrzyknięć CSS), podział na proste/zaawansowane; 5 skórek systemowych
  seedowanych migracją (Dark/Light/Casual/Blue/Pink).

## Głos Zespołu A — Strażnicy

**Joanna (UX):** „Mamy paradoks: **świetny, skinowalny system kolorów** i jednocześnie **brak systemu
odstępów/typografii** oraz brak kluczowych prymitywów (modal, select, tabs). Efekt: każdy ekran jest
robiony »ręcznie«, więc nieuchronnie się **rozjeżdża** — drobne różnice paddingów, rozmiarów, zachowań.
Spójność to nie estetyka, to **zaufanie i szybkość uczenia się** produktu.”

**Rafał (grafik):** „Dwie implementacje `EmptyState` to symptom. Potrzebujemy **jednego** zestawu
prymitywów i zakazu obchodzenia go inline-stylami tam, gdzie prymityw istnieje.”

**Anna (security/a11y):** „Brak `alt`, sygnalizacja samym kolorem, niezweryfikowana klawiatura w
modalach — to realne **bariery dostępności** i ryzyko prawne (EAA/WCAG). Plus brak `ErrorBoundary`:
jeden wyjątek w komponencie wywala cały ekran zamiast pokazać sensowny stan błędu.”

## Głos Zespołu B — Pionierzy

**Ola (UX):** „Bazą jest naprawdę dobry, minimalistyczny, keyboard-first UX i **skinowalność** —
to przewaga, nie problem. Zamiast wielkiego »redesignu«, zróbmy **3 ruchy o wysokim ROI**: (1) prymityw
`Modal` + `Tabs` (najczęściej powielane), (2) `error.tsx` + `ErrorBoundary`, (3) tokeny odstępów. Reszta
przyrostowo.”

**Kuba (UI):** „Skinowalność to **marketingowy atut** — »zrób apkę swoją«. Dołóżmy gotowe, ładne motywy
i tryb jasny/sepia (jak w tym czytniku audytu!). To buduje przywiązanie.”

**Magda (delivery):** „i18n to duży projekt — **nie teraz**, ale **nie zamykajmy sobie drogi**: od dziś
nowe teksty przez jedną warstwę (słownik), nawet jeśli na razie tylko PL. Inaczej za rok refaktor będzie
koszmarny. To warunek wejścia na rynki poza PL (a 100M userów to nie tylko Polska).”

## Punkty sporne

- **Redesign vs przyrost.** Zgoda: **przyrost** — prymitywy + tokeny + stany błędów, bez wielkiego
  przepisania.
- **i18n: teraz vs później.** Strażnicy: warstwa od zaraz (tania prewencja). Pionierzy: pełne PL/EN
  później, ale **owijać nowe stringi** już teraz. **Konsensus:** wprowadzić warstwę i owijać nowe teksty;
  pełne tłumaczenia gdy pojawi się rynek nie-PL.
- **a11y: ile na start.** **Konsensus:** P1 — alt, kontrast, focus, role/aria w prymitywach,
  klawiatura w modalach; pełny audyt WCAG etapami.

## Głos użytkowników

**Helena (68):** „Litery za małe, a niektóre przyciski bez podpisu — nie wiem, co robią.” → gęstość
(`--font-size-base`) i `aria-label`/podpisy to dla niej różnica między „używam” a „rezygnuję”.

**Zofia (16):** „Na telefonie czasem coś jest za małe do kliknięcia.” → responsywność odstępów i
minimalne cele dotykowe.

**Marek (29):** „Podoba mi się, że mogę zmienić wygląd.” → skinowalność realnie cieszy early adopterów.

## Konsensus i zalecenia

- **Z-110** *(P1 · M)* — **Uzupełnić brakujące prymitywy:** współdzielony `Modal/Dialog`, `Tabs`,
  `Tooltip`, opakowania `Input/Select/Textarea`, `Pagination` (na bazie Radix). Eliminują powielanie i
  rozjazdy.
- **Z-111** *(P0 · S)* — **Globalny `error.tsx` + `ErrorBoundary`** na poziomie tras/modułów; sensowny
  stan błędu zamiast białego ekranu. (Powiązane z observability, Z-090.)
- **Z-112** *(P1 · S)* — **Tokeny odstępów i typografii** (skala spacing/rozmiarów) + migracja
  najczęstszych inline-styli na nie; warunek spójnej gęstości i przyszłej responsywności.
- **Z-113** *(P1 · S)* — **Ujednolicić `EmptyState`** do jednej implementacji; pełne pokrycie stanów
  pustych w modułach.
- **Z-114** *(P1 · M)* — **Audyt i poprawki a11y:** `alt` dla obrazów, brak sygnalizacji samym kolorem
  (ikona/tekst obok), `role`/`aria` w prymitywach, pułapka focusu i obsługa klawiatury w modalach,
  helper `sr-only`. Wykonalne offline, wysoka wartość.
- **Z-115** *(P1 · M)* — **Warstwa i18n (PL/EN) + formaty `Intl`** (daty/liczby/waluta); od zaraz
  owijać nowe teksty, nawet przy jednym języku. Warunek skali poza PL.
- **Z-116** *(P2 · S)* — **Responsywna typografia/odstępy** i weryfikacja minimalnych celów dotykowych
  (≥44 px) na mobile.
- **Z-117** *(P2 · S)* — **Rozbudować ofertę skórek** (gotowe motywy, tryb jasny/sepia/system) jako
  atut produktowy i marketingowy.
- **Z-118** *(P2 · S)* — **Reguła „prymityw przed inline”** w przeglądach: nowe UI używa
  `Button/Card/Surface/Modal`, nie surowych `style` tam, gdzie jest prymityw.

## Dobre vs złe praktyki

**Dobre:**
- Skinowalność z silną walidacją (whitelist + regex, brak wstrzyknięć CSS) — wyróżnik.
- Spójne stany ładowania (`LoadingState` + 21 `loading.tsx`).
- `IconButton` wymuszający `aria-label`; globalny `:focus-visible`; minimalistyczny keyboard-first UX.
- Przemyślany layout mobilny z `safe-area-inset`.

**Złe / do poprawy:**
- Brak prymitywów (modal/tabs/select) i tokenów odstępów → rozjazdy i ~5000 inline-styli.
- Brak `ErrorBoundary`/`error.tsx` — kruche stany błędów.
- Luki a11y (alt, kolor-jako-jedyny-sygnał, klawiatura w modalach).
- Brak i18n i lokalizowanych formatów — bariera wejścia poza PL.
