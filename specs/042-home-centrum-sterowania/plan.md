# Plan techniczny: Strona główna jako centrum sterowania — ulubione widoki, briefing, asystent AI + porządki UX

- **Spec:** ./spec.md (042-home-centrum-sterowania)
- **Status:** draft
- **Data:** 2026-08-02

> **Zasada planu:** to jest **JAK**. Plan pisany pod istniejący kod — wzorce wzięte z modułów
> najbliższych funkcjonalnie, nie wymyślane od nowa (C-53).

---

## 1. Podejście

Feature dzieli się na **cztery niezależne strumienie**, które można wdrażać i cofać osobno:
(A) nowy byt danych **ulubione widoki** + jego powłoka nawigacyjna, (B) **przebudowa układu** strony
głównej, (C) **trzy punktowe poprawki UX**, (D) **zmiana nazewnictwa** w Notatkach.

Wzorcem dla (A) jest para **`UserMenuPref` / `menuPrefs.ts` / `MenuPrefsEditor`** — prywatna
preferencja użytkownika, prosty model, Server Actions z `revalidatePath("/", "layout")`, edytor
w `/settings`. Wzorcem dla (B) jest istniejący mechanizm `DashboardPref` — zmieniamy **oprawę
układu**, nie model personalizacji. (C) i (D) to zmiany czysto klienckie/tekstowe, bez schematu.

**Kluczowa zasada minimalizmu dla tego feature'a:** komponent asystenta (`AICommandSheet.tsx`,
2541 linii) **nie jest przepisywany ani duplikowany**. Dostaje jedno pole więcej w istniejącej
magistrali zdarzeń — i tyle.

---

## 2. Model danych (Prisma)

### 2.1 Nowy model — `FavoriteView`

```prisma
model FavoriteView {
  id        String   @id @default(cuid())
  ownerId   String                        // user-only (świadomie brak ownerTeamId — patrz §2.3)
  label     String                        // nazwa nadana przez użytkownika
  path      String                        // ścieżka wewnętrzna z parametrami, np. "/tasks/abc?status=IN_PROGRESS"
  icon      String   @default("⭐")        // emoji (jak Cookbook.emoji / ProjectGroup.emoji)
  color     String?                       // nazwa tokenu motywu, np. "var(--accent-blue)" (C-30)
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  owner User @relation("OwnedFavoriteViews", fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([ownerId, path])   // AC-9 — brak duplikatów tego samego adresu
  @@index([ownerId, order])
}
```

Do modelu `User` dochodzi `favoriteViews FavoriteView[] @relation("OwnedFavoriteViews")`.

**Bez enumów (C-12):** `icon` i `color` to zwykłe `String`. Zbiór dopuszczalnych kolorów zawężamy
w TypeScripcie unią `FavoriteColor` w `src/lib/favorites/favoriteViews.ts` (wzorzec: presety koloru
grupy w `TasksSideNav.tsx`), a nie typem bazodanowym.

### 2.2 Migracja (C-10, C-11)

- Numer z `npm run next:migration`: **`0221`** (zweryfikowane — ostatni katalog to `0220_kontrola_nad_ai`).
- Katalog: `prisma/migrations/0221_ulubione_widoki/migration.sql`
- DDL (ręcznie pisany, idempotentny):

```sql
CREATE TABLE IF NOT EXISTS "FavoriteView" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "path"      TEXT NOT NULL,
    "icon"      TEXT NOT NULL DEFAULT '⭐',
    "color"     TEXT,
    "order"     INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoriteView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FavoriteView_ownerId_path_key" ON "FavoriteView"("ownerId", "path");
CREATE INDEX IF NOT EXISTS "FavoriteView_ownerId_order_idx"       ON "FavoriteView"("ownerId", "order");

ALTER TABLE "FavoriteView"
  ADD CONSTRAINT "FavoriteView_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

> `ADD CONSTRAINT` nie ma wariantu `IF NOT EXISTS` w Postgresie 15 — jest wykonywany raz, razem
> z `CREATE TABLE`. To zgodne z resztą migracji w repo.

**Brak seedów** — nie zakładamy użytkownikowi ulubionych z góry (pusty stan jest projektowany, AC-6).
Migracja nie dotyka uprawnień (brak nowego sluga, §4), więc C-14 nie ma tu zastosowania.

### 2.3 Decyzja: user-only, bez `ownerTeamId` (odstępstwo od C-21 — świadome)

C-21 opisuje model współwłasności dla **zasobów**. Ulubione widoki nie są zasobem, tylko **prywatną
preferencją nawigacyjną** — dokładnie jak `UserMenuPref`, `DashboardPref` i `AssistantPref`, które
też mają samo `userId` bez wariantu zespołowego. Dodanie `ownerTeamId` wymagałoby decyzji, co
znaczy „ulubiony widok zespołu" przy odmiennych uprawnieniach członków; spec jawnie wypycha to poza
zakres. Guard to zatem **własność bezpośrednia** (`ownerId = user.id`), nie `getUserTeamIds`.

---

## 3. Warstwa serwera (Server Actions — C-20)

**Nowy plik:** `src/actions/favoriteViews.ts` (wzorzec: `src/actions/menuPrefs.ts`).

| Funkcja | Sygnatura | Rewalidacja |
|---|---|---|
| `getFavoriteViews()` | `→ FavoriteViewDTO[]` (posortowane `order`, potem `createdAt`) | — (odczyt) |
| `addFavoriteView(input)` | `{label, path, icon?, color?} → FavoriteViewDTO` | `revalidatePath("/", "layout")` |
| `removeFavoriteView(id)` | `→ void` | `revalidatePath("/", "layout")` |
| `removeFavoriteViewByPath(path)` | `→ void` (przełącznik gwiazdki, AC-3) | `revalidatePath("/", "layout")` |
| `updateFavoriteView(id, patch)` | `{label?, icon?, color?} → void` | `revalidatePath("/", "layout")` |
| `reorderFavoriteViews(ids)` | `string[] → void` (przelicza `order`) | `revalidatePath("/", "layout")` |

**Wspólne reguły dla każdej mutacji:**
- `const user = await requireAuth();` — to jest guard dostępu (`access: "self"`, jak `menuPrefs`).
- Każde `update`/`delete` operuje przez `where: { id, ownerId: user.id }` (`updateMany`/`deleteMany`
  zwracające `count`), żeby cudzy identyfikator nigdy nie trafił w cudzy wiersz. **Nigdy**
  `delete({ where: { id } })` bez właściciela.
- `revalidatePath("/", "layout")` — bo ulubione renderują się w powłoce (sidebar, pasek mobilny) na
  **każdej** stronie, nie tylko na `/`. To ten sam argument, którego używa `updateMenuPrefs`.

**Walidacja `path` (bezpieczeństwo — kluczowe):** `path` pochodzi z przeglądarki, więc musi być
znormalizowany w **jednym** miejscu (`src/lib/favorites/favoriteViews.ts`, funkcja `normalizeFavoritePath`)
i wywoływany zarówno przy zapisie, jak i przy odczycie:
- musi zaczynać się od pojedynczego `/` i **nie** od `//` ani `/\` (inaczej przeglądarka potraktuje
  to jako adres zewnętrzny — otwarte przekierowanie),
- odrzucamy wszystko, co zawiera `:` przed pierwszym `/` (schematy `javascript:`, `data:`),
- ucinamy fragment `#…`, przycinamy do rozsądnej długości (512 znaków),
- `label` przycinamy do 60 znaków, pusty → nazwa wyprowadzona ze ścieżki.

**Limit:** maksymalnie **30** ulubionych na użytkownika (stała `MAX_FAVORITE_VIEWS`), sprawdzany
w `addFavoriteView` — proste zabezpieczenie przed „śmietnikiem" z §9 speca.

**Bramka pokrycia AI (`check:ai-coverage`, wpięta w `build`) — obowiązkowa:** każda z 6 funkcji
potrzebuje wpisu w `src/lib/ai/action-coverage.json`. Wzorzec do skopiowania to `menuPrefs:*`:

```json
"favoriteViews:getFavoriteViews": { "kind": "read", "status": "excluded", "reason": "settings", "access": "self" },
"favoriteViews:addFavoriteView":  { "status": "excluded", "reason": "settings", "access": "self" }
```
…i analogicznie dla pozostałych czterech. **Pominięcie tego wywala build** — to najczęstsza pułapka
przy dokładaniu nowego pliku akcji.

**Brak `AIAction` (C-23):** asystent nie dostaje możliwości zarządzania ulubionymi — spec tego nie
wymaga, a każda nowa `AIAction` pociąga egzekutor, wpis w kontrakcie akcji i humanizer. `status:
"excluded", reason: "settings"` jest tu uczciwą klasyfikacją (te same akcje co personalizacja menu).

**Brak wpięcia w Trash (C-24):** świadomie, zgodnie z §6 speca — usunięcie ulubionego to cofnięcie
zakładki, nie skasowanie treści.

---

## 4. RBAC / rejestr modułu (C-22)

- **Nowy slug: NIE.** Ulubione są elementem powłoki dostępnym dla każdej zalogowanej osoby; nie są
  modułem, więc nie wchodzą do `MODULES` w `src/lib/modules.tsx` ani do `ModuleSidebar` jako pozycja
  nawigacji modułowej.
- **Egzekwowanie uprawnień (AC-8) — jedno miejsce:** funkcja
  `filterAccessibleFavorites(views, permissions)` w `src/lib/favorites/favoriteViews.ts`, oparta
  o **istniejące** `permissionForPath` / `isPathLocked` z `src/lib/permissions.ts`. Wpis prowadzący
  pod ścieżkę, do której `isPathLocked` zwraca `true`, **nie jest renderowany jako klikalny** (nie
  jest też cicho kasowany z bazy — uprawnienie może wrócić).
  - Uwaga implementacyjna: `permissionForPath` przyjmuje samą ścieżkę, więc przed sprawdzeniem
    trzeba odciąć `?query`.
- Wpięcia w `permissions.ts` / `modules.tsx` / `ModuleSidebar` jako **nowy moduł**: brak. Do
  `ModuleSidebar` dokładamy jedynie sekcję listy ulubionych (§5.2).

---

## 5. UI (C-30, C-31, C-32)

### 5.1 Gwiazdka „dodaj do ulubionych" — punkt zapisu (AC-1, AC-3)

Zamiast dokładać przycisk do nagłówka **każdego** modułu (kilkanaście plików, C-53), montujemy go
**raz w powłoce**, która zna `pathname`:
- **desktop:** w `ModuleSidebar`, w dolnej sekcji obok dzwonka powiadomień;
- **mobile:** w górnym pasku `AppShell`, w tym samym kontenerze co `NotificationBell`
  (`<div className="ml-auto flex items-center flex-shrink-0">`).

Komponent: `src/components/favorites/FavoriteStarButton.tsx` (`"use client"`).

**Pułapka do obejścia:** `useSearchParams()` w komponencie powłoki wymusza granicę Suspense i potrafi
zepchnąć całą powłokę w renderowanie po stronie klienta. Dlatego bieżący adres czytamy **efektem po
stronie przeglądarki**: `usePathname()` + `window.location.search` w `useEffect` zależnym od
`pathname`. Bez `useSearchParams` w powłoce.

Zachowanie: ikona `Star` (pusta / wypełniona wg tego, czy `normalizeFavoritePath(bieżący adres)` jest
już w ulubionych). Klik gdy niezapisane → mały popover z **proponowaną, edytowalną nazwą** (§5.5)
i wyborem emoji + koloru → `addFavoriteView`. Klik gdy zapisane → `removeFavoriteViewByPath`.
Kolory wyłącznie z tokenów (`var(--accent-*)`), tekst na kolorze `var(--on-accent)` (C-30).
Cel dotyku ≥ 32×32 px, na mobile `py-3` w otaczającym wierszu (C-31).

### 5.2 Globalny przełącznik ulubionych (AC-4, AC-5)

Komponent: `src/components/favorites/FavoritesSwitcher.tsx` — nakładka zbudowana na **`cmdk`**
(zależność już w `package.json`, `^1.0.4`), wzorowana wizualnie na `CommandPalette.tsx`, ale
**niezależna od niej** (tamta jest osadzona wyłącznie w Zakupach — patrz korekta w `spec.md` §5).
Zawiera pole filtrowania (AC-4), listę ulubionych z ikoną/kolorem i skrótem, oraz stopkę z linkiem do
zarządzania w `/settings`.

Otwierany: kliknięciem w listę ulubionych w sidebarze / pasku mobilnym.

**Skróty klawiszowe (AC-5) — `Alt+1..9`.** Globalny listener żyje w
`src/components/favorites/FavoritesShortcuts.tsx`, montowanym raz w `AppShell` (istniejący
`useKeyboardShortcuts` jest wołany per-strona, więc się nie nadaje).

> **Krytyczny detal, którego nie wolno pominąć:** warunek to
> `e.altKey && !e.ctrlKey && !e.metaKey`. Na klawiaturze polskiej **AltGr = Ctrl+Alt** i służy do
> wpisywania `ą ć ę ł ń ó ś ź ż`. Bez wykluczenia `ctrlKey` skrót zjadałby polskie znaki podczas
> pisania — w aplikacji, której cały interfejs jest po polsku (C-32). Dodatkowo listener nie reaguje,
> gdy aktywny element to `input` / `textarea` / `contenteditable` (ta sama logika co
> `isTypingTarget` w `useKeyboardShortcuts.ts`).

Skrót prowadzi tylko do wpisów przechodzących `filterAccessibleFavorites` (AC-8).

### 5.3 Sekcja ulubionych na stronie głównej (AC-6, AC-18)

- Do `DASHBOARD_SECTIONS` w `src/lib/home/dashboardSections.ts` dochodzi klucz **`favorites`**.
  Ponieważ `sanitizeSectionKeys` filtruje po tej właśnie liście, nowy klucz jest automatycznie
  akceptowany przez `setDashboardPrefs`, a użytkownicy z zapisaną starą kolejnością dostaną go
  doklejonego na końcu — istniejąca logika `effectiveOrder` w `HomePage.tsx` już to robi. **AC-18
  wychodzi z tego za darmo, pod warunkiem że nie ruszamy tej logiki.**
- Do `SECTION_LABELS` w `HomePage.tsx`: `favorites: "Ulubione widoki"`.
- Komponent `src/components/favorites/FavoriteCards.tsx` — karty z emoji, nazwą i kolorowym
  akcentem. **Pusty stan (AC-6):** przy zerze ulubionych renderuje jedną linijkę zachęty
  („Zapisz miejsce gwiazdką w pasku, żeby wracać tu jednym kliknięciem"), a nie pustą ramkę.

### 5.4 Układ strony głównej 3 / 2 / 1 kolumny (AC-16, AC-17, AC-11, AC-12)

Zmieniamy **tylko oprawę** w `HomePage.tsx`; lista `sectionNodes`, `order`, `hidden`, `editing`
i cały tryb personalizacji zostają nietknięte.

- Kontener sekcji: siatka CSS, `gridTemplateColumns` sterowane klasami Tailwinda
  `grid-cols-1 md:grid-cols-2` (mobile → tablet). Sekcje **zachowują liniową kolejność użytkownika**
  wypełniając kolumny — dzięki temu personalizacja nadal znaczy to samo.
- **Trzecia kolumna (asystent)** jest osobnym elementem siatki na `xl:` (≥1280 px), **nie** częścią
  listy sekcji: `xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]`. Poniżej `xl` znika,
  a asystent pozostaje dostępny przez istniejący pływający przycisk (AC-12).
- Kolumna asystenta: `position: sticky; top: 0` → „nie znika przy przewijaniu" (AC-11).
- **Kolejność na wąskim ekranie** (AC-16): brak zmian w modelu — domyślna kolejność
  `DASHBOARD_SECTIONS` zostaje przestawiona tak, by zaczynała się od tego, co pilne:
  `briefing → favorites → today → modules → quickActions → suggestions → recently`.
  Zmiana dotyczy **tylko wartości domyślnej** dla osób bez zapisanej preferencji.
- **Bez poziomego przewijania** (AC-16): wszystkie kolumny siatki dostają `minmax(0, 1fr)`, bo
  domyślne `1fr` ma `min-width: auto` i długi, nieprzełamywalny tekst rozpycha siatkę.
- **Motyw (AC-17):** poświata/rozmycie realizowane przez `box-shadow` i `background` złożone
  z tokenów oraz `color-mix(in srgb, var(--accent-blue) 12%, transparent)`. **Zero hexów**,
  zero `rgba()` z liczbami dobranymi „na ciemne tło" (C-30). Ostrzeżenie: w istniejącym kodzie są
  takie miejsca (`rgba(168,85,247,0.15)` w `HomePage.tsx`) — nowy kod ich nie powiela.

### 5.5 Dokowany asystent na stronie głównej (AC-11) — bez ruszania `AICommandSheet`

Komponent: `src/components/home/HomeAssistantColumn.tsx`.

Zawartość: nagłówek z dużą ikoną `Sparkles`, **prawdziwe pole tekstowe gotowe do pisania od razu po
wejściu** (bez autofokusa — autofokus na desktopie przewijałby stronę i przechwytywał skróty),
kontekstowe podpowiedzi startowe, oraz przycisk wysłania.

Wysłanie → `openAssistant({ prompt })` z `src/lib/ai/assistantBus.ts`. To wymaga **jedynej** zmiany
w komponencie asystenta:
1. w `AssistantOpenDetail` dochodzi opcjonalne `prompt?: string`,
2. w istniejącym handlerze `onOpen` (`AICommandSheet.tsx`, ok. linii 760–779) — gdy `prompt` jest
   ustawiony, otwórz panel i wyślij tę wiadomość jak wpisaną przez użytkownika.

To ~10 linii w cudzym pliku zamiast wariantu „dokowanego" całego panelu. Sheet pozostaje jedynym
posiadaczem stanu rozmowy — nie powstaje druga instancja czatu ani drugi wątek.

**Decyzja (odnotowana):** pływający przycisk asystenta **zostaje widoczny również na stronie głównej**
na szerokim ekranie. Ukrywanie go wymagałoby przekazania informacji o szerokości okna z powłoki do
komponentu asystenta; spec żąda „braku znikania" magicznej ikony, więc jej zachowanie jest zgodne
z intencją, a nie wbrew niej.

### 5.6 Poprawka: checkboxy w liście zadań (AC-20, AC-21, AC-22)

**Przyczyna źródłowa** — `src/components/tasks/TaskRow.tsx`, linia ~132:
```
${selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
```
Na ekranie dotykowym przeglądarka emuluje `:hover` po dotknięciu i **utrzymuje go** aż do dotknięcia
gdzie indziej. Dotknięcie wiersza w celu przewinięcia zapala więc checkbox i zostawia go zapalonym —
dokładnie to, co zgłosił właściciel („pojawiają się i znikają w dziwnych momentach").

**Poprawka:** ograniczyć ujawnianie przy najechaniu do urządzeń, które **naprawdę** mają wskaźnik:
```
${selectionMode ? "opacity-100" : "opacity-0 [@media(hover:hover)]:group-hover:opacity-100"}
```
Wariant arbitralny `[@media(hover:hover)]:` jest wspierany przez Tailwind 3.4 (w repo `^3.4.17`),
więc nie trzeba nowej zależności ani wpisu w `tailwind.config.ts`. Na dotyku checkbox pozostaje
przezroczysty poza trybem zaznaczania (AC-20), na myszy działa jak dziś (AC-21), a w trybie
zaznaczania jest zawsze widoczny na obu (AC-22, gałąź `opacity-100` niezmieniona).

Rozmiar 20×20 px pozostaje bez zmian — spełnia C-31.

### 5.7 Poprawka: rozciągane pole opisu zadania (AC-23)

`src/components/tasks/TaskDetail.tsx`, linia ~463:
```
rows={Math.max(3, description.split("\n").length)}
```
Liczy **wyłącznie znaki nowej linii**, więc jeden długi akapit zawijający się na 12 wierszy nadal
dostaje `rows=3` i wewnętrzny pasek przewijania — to jest zgłoszony błąd.

**Poprawka:** pomiar rzeczywistej wysokości treści. `ref` na `<textarea>` + `useLayoutEffect` zależny
od `description`: `el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, MAX) + "px"`,
gdzie `MAX ≈ 60vh` („do rozsądnej granicy" z AC-23 — powyżej pole samo wraca do przewijania, żeby nie
wypchnąć przycisków poza ekran). `rows` schodzi do stałej wartości minimalnej (`rows={3}`).
`resize-none` zostaje. Reset do `"auto"` przed pomiarem jest konieczny — bez niego `scrollHeight`
nigdy nie zmaleje przy kasowaniu tekstu.

### 5.8 Poprawka: potwierdzenie czyszczenia kupionych pozycji (AC-24)

Zgłoszony element (kontekst DOM ze zgłoszenia: `main.flex-1 > div.flex > div.flex`, sekcja z nazwą
listy) to przycisk **„Wyczyść (n)"** w nagłówku listy — `src/components/shopping/ShoppingPage.tsx`,
linia ~262, wołający `clearDoneItems(effListId)`.

Waga sprawy: `clearDoneItems` w `src/actions/items.ts` robi
`prisma.item.deleteMany({ where: { listId, status: "DONE" } })` — **twarde usunięcie bez zapisu do
kosza**. Jedno przypadkowe dotknięcie kasuje bezpowrotnie wszystkie kupione pozycje listy. Dlatego
potwierdzenie jest tu istotne, a nie kosmetyczne.

**Poprawka:** stan `confirmClearOpen` + istniejący `src/components/ui/Modal.tsx` (ten sam wzorzec, co
`completeOpen` obok, w tym samym pliku — spójność ze stylem otoczenia, C-53). Treść po polsku,
z liczbą pozycji i informacją o nieodwracalności; akcja potwierdzająca w kolorze
`var(--accent-red)` z tekstem `var(--on-accent)`. Rezygnacja zamyka okno bez wywołania akcji.

Zakres świadomie ograniczony do tego przycisku: usuwanie **pojedynczej** pozycji
(`ItemRow.tsx`) zostaje bez zmian — dotyczy jednego elementu i nie było przedmiotem zgłoszenia.

### 5.9 Zmiana nazewnictwa „Grupy" → „Foldery" w Notatkach (AC-25, AC-27)

Wyłącznie **warstwa widoczna** (C-32). Model `NoteGroup`, kolumna `groupId`, akcje `noteGroups.ts`,
trasa `/notes/groups` i nazwy plików **zostają nietknięte** — stąd AC-27 (dane i adresy nienaruszone)
jest spełnione z konstrukcji, a nie przez ostrożność.

Miejsca do zmiany (pełna lista, ustalona przeglądem):

| Plik | Było | Będzie |
|---|---|---|
| `src/components/shell/ModuleSidebar.tsx:45` | `label="Grupy"` | `label="Foldery"` |
| `src/components/shell/AppShell.tsx:287` | `label: "Grupy"` | `label: "Foldery"` |
| `src/components/notes/NotesHomePage.tsx:87` | `label="Grupy"` | `label="Foldery"` |
| `src/components/notes/NotesHomePage.tsx:153` | `label: "Grupy"` | `label: "Foldery"` |
| `src/components/notes/GroupsManager.tsx:62` | „Grupy notatek" | „Foldery notatek" |
| `src/components/notes/GroupsManager.tsx:70` | „Nowa grupa" | „Nowy folder" |
| `src/components/notes/GroupsManager.tsx:85` | „Nazwa grupy..." | „Nazwa folderu…" |
| `src/components/notes/GroupsManager.tsx:121` | „Brak grup. Utwórz pierwszą." | „Brak folderów. Utwórz pierwszy." |
| `src/components/notes/QuickNoteBar.tsx:254` | „Bez grupy" | „Bez folderu" |
| `src/components/notes/NoteRow.tsx:368` | „Bez grupy" | „Bez folderu" |
| `src/components/notes/NoteList.tsx:43,51,52` | `"Bez grupy"` (klucz grupowania **i** sortowania) | `"Bez folderu"` |
| `src/components/notes/NotesPage.tsx:251` | „Wszystkie grupy" | „Wszystkie foldery" |
| `src/actions/noteGroups.ts:23` | `assertDictionaryAccess(…, "grupa notatek")` | `"folder notatek"` (tekst błędu dla użytkownika) |

> **Uwaga przy `NoteList.tsx`:** literał `"Bez grupy"` występuje tam trzy razy i pełni podwójną rolę —
> etykiety **oraz** klucza sortowania (`if (a === "Bez grupy") return 1`). Zmiana tylko części
> wystąpień cicho zepsuje sortowanie („bez folderu" przestanie lądować na końcu). Wszystkie trzy
> muszą pójść razem — najlepiej przez wydzielenie stałej.

Ikona już dziś jest `FolderOpen` (`NotesHomePage.tsx:153`), więc zmiana nazwy **zbliża** tekst do
istniejącej ikonografii, zamiast ją rozjeżdżać.

Moduł Zadania (**„Grupy projektów"**) pozostaje bez zmian — uzasadnienie w §5a speca (projekt może
należeć do wielu grup: `ProjectGroup.projectIds` to lista, więc „folder" byłby kłamstwem). AC-26 to
kryterium „nie ruszaj".

### 5.10 Zarządzanie ulubionymi w ustawieniach (AC-7)

`src/components/settings/FavoriteViewsEditor.tsx` — wzorzec 1:1 z `MenuPrefsEditor.tsx`
(strzałki góra/dół, edycja inline, usuwanie). Wpięcie w `src/app/settings/page.tsx` obok
`MenuPrefsEditor`, z danymi z `getFavoriteViews()`.

---

## 6. AI / integracje

- **Nowe `AIAction`: brak** (C-23) — nie ruszamy `check:actions`, `actionContract.ts` ani egzekutorów.
- **Read-tool w `agentTools.ts`: brak.**
- **Rozszerzenie `AssistantOpenDetail` o `prompt?: string`** (§5.5) — to magistrala zdarzeń UI, nie
  akcja AI; bramek nie dotyka.
- **Routing modeli (C-40): bez zmian** — nie wołamy `chatComplete`/`chatStream` w żadnym nowym pliku,
  więc bramki `check:cost-badge` i `check:content-memory` nie wymagają nowych wpisów.
- **AC-19 (tryb odświeżania sekcji AI) to kryterium „nie zepsuj":** `DailyBriefingCard` generuje
  briefing **wyłącznie po kliknięciu** (cache w `localStorage` na dobę), a `AISuggestions` jest
  regułowe i w ogóle nie wywołuje modelu. Przebudowa układu **nie może** dodać automatycznego
  generowania przy wejściu na stronę — to byłby regres wobec ustawień z 041.
- **Kalendarz / powiadomienia / auto-expense:** bez zmian. Briefing czyta istniejącą agregację.

---

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | model `FavoriteView` + relacja w `User` |
| `prisma/migrations/0221_ulubione_widoki/migration.sql` | nowy | DDL (C-10) |
| `src/lib/favorites/favoriteViews.ts` | nowy | typy, `normalizeFavoritePath`, `filterAccessibleFavorites`, presety kolorów, `MAX_FAVORITE_VIEWS` |
| `src/actions/favoriteViews.ts` | nowy | 6 Server Actions (C-20) |
| `src/lib/ai/action-coverage.json` | edycja | 6 wpisów `favoriteViews:*` — **inaczej build pada** |
| `src/components/favorites/FavoriteStarButton.tsx` | nowy | zapis/usunięcie bieżącego widoku (AC-1, AC-3) |
| `src/components/favorites/FavoritesSwitcher.tsx` | nowy | globalna lista z wyszukiwaniem (AC-4) |
| `src/components/favorites/FavoritesShortcuts.tsx` | nowy | `Alt+1..9`, z wykluczeniem AltGr (AC-5) |
| `src/components/favorites/FavoriteCards.tsx` | nowy | sekcja pulpitu + pusty stan (AC-6) |
| `src/components/settings/FavoriteViewsEditor.tsx` | nowy | zarządzanie (AC-7) |
| `src/components/home/HomeAssistantColumn.tsx` | nowy | dokowany asystent (AC-11) |
| `src/components/shell/AppShell.tsx` | edycja | gwiazdka + przełącznik (mobile), `FavoritesShortcuts`; „Grupy"→„Foldery" (l. 287) |
| `src/components/shell/ModuleSidebar.tsx` | edycja | gwiazdka + lista ulubionych (desktop); „Grupy"→„Foldery" (l. 45) |
| `src/app/layout.tsx` *(lub `AppShell`-owy loader)* | edycja | dostarczenie ulubionych do powłoki |
| `src/lib/home/dashboardSections.ts` | edycja | klucz `favorites` + nowa kolejność domyślna |
| `src/components/home/HomePage.tsx` | edycja | siatka 3/2/1, sekcja `favorites`, kolumna asystenta |
| `src/app/page.tsx` | edycja | pobranie ulubionych i przekazanie do `HomePage` |
| `src/lib/ai/assistantBus.ts` | edycja | `prompt?: string` w `AssistantOpenDetail` |
| `src/components/home/AICommandSheet.tsx` | edycja (mała) | obsługa `prompt` w `onOpen` (~10 linii) |
| `src/components/tasks/TaskRow.tsx` | edycja | `[@media(hover:hover)]:` (AC-20/21/22) |
| `src/components/tasks/TaskDetail.tsx` | edycja | autorozciąganie opisu (AC-23) |
| `src/components/shopping/ShoppingPage.tsx` | edycja | potwierdzenie „Wyczyść" (AC-24) |
| `src/components/notes/*` (6 plików), `src/actions/noteGroups.ts` | edycja | „Grupy" → „Foldery" (AC-25, §5.9) |
| `src/app/settings/page.tsx` | edycja | wpięcie `FavoriteViewsEditor` |
| `doświadczenia.md` | edycja | wpisy dla 3 naprawionych błędów (C-51) |

---

## 8. Bramki i weryfikacja (C-50)

**Środowisko lokalne (C-13 — nigdy prod DB):**
```bash
pg_ctlcluster 16 main start
# .env.local → DATABASE_URL/DIRECT_URL na 127.0.0.1:5432 (baza omnia_dev)
export DATABASE_URL=... DIRECT_URL=...   # scripts/* nie czytają .env.local
cd worldofmag && npx prisma migrate deploy && npx prisma generate
```
**Weryfikacja kończy się na `next build`.** Pełne `npm run build` odpala na końcu `scripts/migrate.js`,
które ruszyłoby prawdziwą bazę — dlatego uruchamiamy kroki osobno:
```bash
npm run check:migrations && npm run check:actions && npm run check:ai-coverage \
  && npx next lint --dir src && npx prisma generate && npx next build
```

**Mapowanie kryteriów akceptacji na sposób sprawdzenia:**

| AC | Jak weryfikujemy |
|---|---|
| AC-1, AC-3, AC-9 | Klik gwiazdki na `/tasks/<id>?status=…`; ponowny klik usuwa; próba ponownego zapisu tej samej ścieżki nie tworzy drugiego wiersza (chroni `@@unique([ownerId, path])`) |
| AC-2 | Otwarcie zapisanego wpisu ląduje pod identycznym adresem z parametrami |
| AC-4 | Przełącznik otwarty z `/portfel`, `/notes`, `/kitchen`; filtrowanie po fragmencie nazwy |
| AC-5 | `Alt+1` przechodzi do pierwszego wpisu; **osobno**: pisanie `ą ć ę ł ń ó ś ź ż` przez AltGr w polu tekstowym nie wyzwala nawigacji |
| AC-6 | Konto bez ulubionych — sekcja pokazuje jedną linijkę zachęty, nie pustą ramkę |
| AC-7 | `/settings`: zmiana kolejności, nazwy, ikony, usunięcie → odbicie w sidebarze i na pulpicie |
| AC-8 | Odebranie `module.portfel` w `/admin/access` → wpis do `/portfel` przestaje być klikalny wszędzie (karty, sidebar, przełącznik, skrót) |
| AC-10 | Ulubione są w bazie przy `ownerId`, nie w `localStorage` — przegląd kodu + druga sesja przeglądarki |
| AC-11 | `/` przy ≥1280 px: pole asystenta widoczne bez klikania, po przewinięciu strony nadal na ekranie |
| AC-12 | `/` przy 390 px: brak drugiego sidebara, asystent pod pływającym przyciskiem |
| AC-13, AC-14 | Konto z danymi vs konto puste — briefing pokazuje pozycje / komunikat pustego stanu |
| AC-15 | Konto bez części uprawnień — skróty modułów zawężone |
| AC-16 | 390 / 900 / 1440 px: 1/2/3 kolumny, `document.scrollingElement.scrollWidth === clientWidth` |
| AC-17 | Przełączenie skórki Dark → Light w `/settings`; **dodatkowo** `grep` na nowych plikach: brak `#rrggbb` i brak `rgba(` z liczbami |
| AC-18 | Konto z zapisanym `DashboardPref` — kolejność i ukrycia zachowane, `favorites` doklejone i przestawialne |
| AC-19 | Wejście na `/` bez klikania nie generuje briefingu (brak zapytania do `/api/llm/home/briefing` w karcie sieci) |
| AC-20, AC-21, AC-22 | DevTools z emulacją dotyku: dotknięcie+przeciągnięcie nie zapala checkboxa; mysz: zapala; tryb zaznaczania: zawsze widoczny na obu |
| AC-23 | Opis = jeden akapit ~1500 znaków bez znaków nowej linii → pole rozciąga się, brak wewnętrznego paska |
| AC-24 | Klik „Wyczyść (n)" → okno z liczbą; „Anuluj" zostawia pozycje; potwierdzenie usuwa |
| AC-25, AC-26 | `grep -rn "grup" src/components/notes src/app/notes` — brak trafień w tekstach UI; Zadania nadal „Grupy projektów" |
| AC-27 | Po zmianie: `/notes/groups` odpowiada, liczba `NoteGroup` i przypisań `Note.groupId` bez zmian |

---

## 9. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja |
|---|---|
| **Zapomniane wpisy w `action-coverage.json`** — najczęstsza przyczyna czerwonego builda przy nowym pliku akcji | Wpisy dokładane w tym samym kroku co `favoriteViews.ts`; `npm run check:ai-coverage` uruchamiany zaraz po |
| **`useSearchParams` w powłoce** wypycha całą aplikację w renderowanie po stronie klienta | Adres czytany z `window.location.search` w efekcie (§5.1) — `useSearchParams` nie pojawia się w powłoce |
| **`Alt+1..9` zjada polskie znaki** (AltGr = Ctrl+Alt) | Warunek `altKey && !ctrlKey && !metaKey` + pominięcie pól tekstowych; osobny przypadek testowy (AC-5) |
| **Otwarte przekierowanie przez zapisany `path`** | `normalizeFavoritePath` — jedno wejście, odrzuca `//`, `/\` i schematy; stosowane przy zapisie **i** odczycie |
| **Ulubione jako obejście RBAC** | `filterAccessibleFavorites` oparte o istniejące `isPathLocked`, stosowane we **wszystkich czterech** miejscach renderowania |
| **Przebudowa układu psuje `DashboardPref`** | Nie ruszamy `order`/`hidden`/`effectiveOrder` — zmienia się wyłącznie kontener CSS; AC-18 jako kryterium odbioru |
| **Nowa oprawa nieczytelna na jasnej skórce** | Tylko tokeny + `color-mix`; kontrola `grep`iem na hexy w nowych plikach (AC-17) |
| **`[@media(hover:hover)]:` nie zadziała** przy starszym Tailwindzie | Zweryfikowane: repo ma `tailwindcss ^3.4.17`, warianty arbitralne wspierane; brak zmian w konfiguracji |
| **Rozjazd literału `"Bez grupy"`** w `NoteList.tsx` (etykieta = klucz sortowania) | Wydzielenie stałej i zmiana wszystkich trzech wystąpień naraz (§5.9) |
| **Autorozciąganie opisu wypycha przyciski poza ekran** | Sufit `60vh`, powyżej wraca wewnętrzne przewijanie |

**Plan wycofania.** Cztery strumienie są rozdzielne:
- (C) i (D) — czysto klienckie/tekstowe: `git revert` pojedynczego commita, zero konsekwencji w bazie.
- (B) — układ strony głównej: `git revert`; `DashboardPref` nie zmienia formatu, więc dane przeżywają
  cofnięcie w obie strony.
- (A) — ulubione: cofnięcie **kodu** jest bezpieczne i wystarczające. Tabela `FavoriteView` może
  zostać w bazie (osierocona, nikomu nie przeszkadza). **Nie cofamy migracji** — zgodnie z C-11
  i runbookiem `docs/devops/runbook-deploy-rollback.md` rollback robimy kodem, nie odkręcaniem DDL.
  Jedyny wyjątkowy przypadek (usunięcie tabeli) wymagałby **nowej** migracji z `DROP TABLE`, nigdy
  edycji `0221`.

---

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczny plik migracji `0221_ulubione_widoki` (numer z `npm run next:migration`,
      zweryfikowany wobec `0220`), zero enumów Prisma, weryfikacja na lokalnym Postgresie do kroku
      `next build`, brak potrzeby seedów SQL.
- [x] **C-20** — 6 Server Actions w `src/actions/favoriteViews.ts`, każda mutacja kończy się
      `revalidatePath("/", "layout")` (ulubione żyją w powłoce, nie tylko na `/`).
- [x] **C-21** — świadome odstępstwo z uzasadnieniem (§2.3): preferencja prywatna, wzorzec
      `UserMenuPref`/`DashboardPref`, guard = własność bezpośrednia + `requireAuth`.
- [x] **C-22** — brak nowego sluga; egzekwowanie uprawnień przez istniejące `permissionForPath` /
      `isPathLocked` w jednym helperze (§4).
- [x] **C-23** — brak nowej `AIAction`; **ale** obowiązkowe wpisy w `action-coverage.json` dla bramki
      `check:ai-coverage` (§3).
- [x] **C-24** — Trash świadomie pominięty (ulubione to zakładka, nie treść) — zgodnie z §6 speca.
- [x] **C-25** — brak zmian RBAC/konfiguracji, więc `AuditLog` nie dotyczy.
- [x] **C-30** — wyłącznie tokeny motywu + `color-mix`; kontrola `grep`iem na hexy (AC-17).
- [x] **C-31** — mobile: jeden sidebar, `env(safe-area-inset-bottom)` zachowane, cele dotyku ≥32 px;
      klawiatura: `Alt+1..9` bez kolizji z `j/k/x/e/d/a/n///Ctrl+K/Esc` i bez zjadania AltGr.
- [x] **C-32** — całość interfejsu po polsku, łącznie z „Ulubione widoki" i „Foldery".
- [x] **C-50/C-51** — bramki rozpisane w §8; trzy wpisy do `doświadczenia.md` (sticky `:hover` na
      dotyku, `rows` po znakach nowej linii, twarde `deleteMany` bez potwierdzenia) ujęte w §7.
- [x] **C-53** — asystent nietknięty poza ~10 liniami w handlerze; gwiazdka montowana raz w powłoce
      zamiast w kilkunastu nagłówkach modułów; nazewnictwo zmieniane tylko tam, gdzie nazwa kłamie;
      istniejąca paleta poleceń Zakupów nie jest przebudowywana.
- [x] **C-54** — dwie rozbieżności wykryte na etapie planu **naprawione w `spec.md`** przed napisaniem
      planu: (1) AC-4 i §5 — brak globalnej palety poleceń w kodzie, ulubione dostają własny
      przełącznik; (2) AC-24 — zgłoszona ikona to zbiorcze „Wyczyść (n)" w pasku listy, a nie
      usuwanie pojedynczej pozycji.
- [x] **C-55** — plan nie zadaje pytań; wszystkie rozstrzygnięcia oparte o decyzje ze `spec.md` §8,
      wzorce sąsiednich modułów i minimalizm.
