# Zadania: Strona główna jako centrum sterowania — ulubione widoki, briefing, asystent AI + porządki UX

- **Plan:** ./plan.md (042-home-centrum-sterowania)
- **Status:** todo
- **Data:** 2026-08-02

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami**. Każde zadanie jest małe, samodzielne i **weryfikowalne** — jedno zadanie ≈ jeden
> commit. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

> **Dlaczego poprawki UX są pierwsze, a nie ostatnie:** strumienie (C) i (D) z planu §1 nie zależą od
> niczego i nie mają wspólnych plików z resztą. Zrobione na starcie dają trzy zamknięte, cofalne
> commity i zdejmują ryzyko, że utoną pod większym strumieniem ulubionych.

---

## Faza 0 — Punktowe poprawki UX (plan §5.6–5.8)

- [x] **T-1** `[P]` — **Checkboxy zadań nie reagują na dotyk** (plan §5.6).
  `src/components/tasks/TaskRow.tsx` (~l. 132): gałąź poza trybem zaznaczania zmienia się z
  `opacity-0 group-hover:opacity-100` na `opacity-0 [@media(hover:hover)]:group-hover:opacity-100`.
  Gałęzi `selectionMode ? "opacity-100"` **nie ruszamy**.
  *Gotowe, gdy:* w emulacji dotyku dotknięcie i przeciągnięcie wiersza nie zapala checkboxa (AC-20),
  na myszy najechanie nadal go pokazuje (AC-21), a w trybie zaznaczania jest widoczny na obu (AC-22).

- [x] **T-2** `[P]` — **Pole opisu zadania rozciąga się w pionie** (plan §5.7).
  `src/components/tasks/TaskDetail.tsx` (~l. 458–465): `ref` na `<textarea>`, `rows={3}` na stałe,
  `useLayoutEffect` zależny od `description` ustawiający
  `el.style.height = "auto"` → `el.style.height = Math.min(el.scrollHeight, MAX) + "px"`,
  gdzie `MAX = 0.6 * window.innerHeight`. Reset do `"auto"` przed pomiarem jest obowiązkowy —
  bez niego wysokość nigdy nie zmaleje przy kasowaniu tekstu.
  *Gotowe, gdy:* opis złożony z jednego akapitu ~1500 znaków **bez** znaków nowej linii rozciąga pole
  bez wewnętrznego paska przewijania, a powyżej 60vh przewijanie wraca (AC-23).

- [x] **T-3** `[P]` — **Potwierdzenie przed wyczyszczeniem kupionych pozycji** (plan §5.8).
  `src/components/shopping/ShoppingPage.tsx` (~l. 262): przycisk „Wyczyść (n)" nie woła już
  `clearDoneItems` bezpośrednio, tylko otwiera `Modal` (wzorzec: sąsiedni `completeOpen` w tym samym
  pliku). Treść po polsku, z **liczbą pozycji** i informacją, że operacja jest nieodwracalna (bo
  `clearDoneItems` robi `deleteMany` bez zapisu do kosza). Przycisk potwierdzenia w
  `var(--accent-red)` z tekstem `var(--on-accent)`.
  *Gotowe, gdy:* „Anuluj" zostawia pozycje nietknięte, potwierdzenie usuwa, a liczba w oknie zgadza
  się z licznikiem na przycisku (AC-24).

## Faza 1 — Nazewnictwo (plan §5.9)

- [x] **T-4** — **„Grupy" → „Foldery" w Notatkach** — wyłącznie warstwa widoczna.
  13 miejsc z tabeli w planie §5.9: `ModuleSidebar.tsx:45`, `AppShell.tsx:287`,
  `NotesHomePage.tsx:87,153`, `GroupsManager.tsx:62,70,85,121`, `QuickNoteBar.tsx:254`,
  `NoteRow.tsx:368`, `NoteList.tsx:43,51,52`, `NotesPage.tsx:251`, `noteGroups.ts:23`.
  **Uwaga:** w `NoteList.tsx` literał `"Bez grupy"` jest jednocześnie etykietą **i kluczem
  sortowania** — wydziel stałą i zmień wszystkie trzy wystąpienia razem, inaczej „bez folderu"
  przestanie lądować na końcu listy.
  Model `NoteGroup`, kolumna `groupId`, trasa `/notes/groups` i nazwy plików **zostają nietknięte**.
  Moduł Zadania („Grupy projektów") **bez zmian** — projekt może należeć do wielu grup.
  *Gotowe, gdy:* `grep -rniE "grup" src/components/notes src/app/notes` nie zwraca trafień w tekstach
  interfejsu (AC-25), `/notes/groups` nadal odpowiada, liczba `NoteGroup` i przypisań `Note.groupId`
  bez zmian (AC-27), a Zadania nadal mówią „Grupy projektów" (AC-26).

## Faza 2 — Fundament danych ulubionych (plan §2)

- [x] **T-5** — **Migracja `0221_ulubione_widoki`** (plan §2.2).
  `prisma/migrations/0221_ulubione_widoki/migration.sql` — DDL 1:1 z planu: `CREATE TABLE IF NOT
  EXISTS "FavoriteView"`, unikalny indeks `[ownerId, path]`, indeks `[ownerId, order]`, FK do `User`
  z `ON DELETE CASCADE`. Numer `0221` potwierdzony (ostatni katalog: `0220_kontrola_nad_ai`).
  Bramka: `npm run check:migrations`.
  *Gotowe, gdy:* `check:migrations` przechodzi, a `npx prisma migrate deploy` na **lokalnym**
  Postgresie (C-13 — nigdy prod) tworzy tabelę i oba indeksy.

- [x] **T-6** — **`schema.prisma`: model `FavoriteView`** zgodny z migracją + relacja
  `favoriteViews FavoriteView[] @relation("OwnedFavoriteViews")` w modelu `User`.
  Zero enumów Prisma — `icon`/`color` to `String` (C-12).
  *Gotowe, gdy:* `npx prisma generate` przechodzi czysto, a wygenerowany klient zna `FavoriteView`.

- [ ] **T-7** — **`src/lib/favorites/favoriteViews.ts`** — jedyne miejsce z logiką współdzieloną:
  typ `FavoriteViewDTO`, unia `FavoriteColor` (tokeny motywu), `MAX_FAVORITE_VIEWS = 30`,
  `normalizeFavoritePath(raw)` oraz `filterAccessibleFavorites(views, permissions)`.
  `normalizeFavoritePath` musi: wymusić pojedynczy wiodący `/`, **odrzucić** `//` i `/\` (otwarte
  przekierowanie), odrzucić wszystko ze schematem (`:` przed pierwszym `/`), uciąć `#fragment`,
  przyciąć do 512 znaków. `filterAccessibleFavorites` odcina `?query` i korzysta z **istniejącego**
  `isPathLocked` z `@/lib/permissions` — bez własnej mapy uprawnień.
  Plik jest czysto obliczeniowy (bez Prismy), żeby mogły go importować komponenty klienckie.
  *Gotowe, gdy:* funkcje są czyste i pokrywają przypadki `//zlo.pl`, `javascript:alert(1)`,
  `/tasks/x?status=DONE#a`.

## Faza 3 — Warstwa serwera (plan §3)

- [ ] **T-8** — **`src/actions/favoriteViews.ts`** — 6 Server Actions wg tabeli z planu §3:
  `getFavoriteViews`, `addFavoriteView`, `removeFavoriteView`, `removeFavoriteViewByPath`,
  `updateFavoriteView`, `reorderFavoriteViews`. Wzorzec: `src/actions/menuPrefs.ts`.
  Twarde reguły: `requireAuth()` w każdej; `update`/`delete` **wyłącznie** przez
  `updateMany`/`deleteMany` z `where: { id, ownerId: user.id }`; `normalizeFavoritePath` przy zapisie;
  limit `MAX_FAVORITE_VIEWS`; każda mutacja kończy się `revalidatePath("/", "layout")` (ulubione żyją
  w powłoce na **każdej** stronie, nie tylko na `/`).
  *Gotowe, gdy:* żaden identyfikator bez dopasowania `ownerId` nie zmienia cudzego wiersza, a próba
  zapisu istniejącej ścieżki nie tworzy duplikatu (chroni `@@unique`, AC-9).

- [ ] **T-9** — **Wpisy w `src/lib/ai/action-coverage.json`** dla wszystkich 6 akcji
  (`favoriteViews:*`), wzorzec `menuPrefs:*`: `"status": "excluded"`, `"reason": "settings"`,
  `"access": "self"`, a odczyt dodatkowo `"kind": "read"`.
  **To nie jest formalność — brak wpisu wywala `npm run build`.**
  Bramka: `npm run check:ai-coverage` (oraz `npm run check:actions`, który musi pozostać zielony —
  nie dodajemy żadnej `AIAction`).
  *Gotowe, gdy:* obie bramki przechodzą.

## Faza 4 — UI ulubionych (plan §5.1–5.3, §5.10)

- [ ] **T-10** — **`src/components/favorites/FavoriteStarButton.tsx`** (AC-1, AC-3).
  Ikona `Star` (pusta/wypełniona), popover z **proponowaną, edytowalną** nazwą + wybór emoji i koloru
  z presetów. Bieżący adres: `usePathname()` + `window.location.search` czytane w `useEffect`
  zależnym od `pathname` — **bez `useSearchParams`**, żeby nie zepchnąć powłoki w renderowanie po
  stronie klienta. Kolory tylko z tokenów, tekst na kolorze `var(--on-accent)` (C-30). Cel dotyku
  ≥32×32 px (C-31).
  *Gotowe, gdy:* zapis z `/tasks/<id>?status=…` zachowuje parametry, a ponowny klik usuwa wpis.

- [ ] **T-11** `[P]` — **`src/components/favorites/FavoritesSwitcher.tsx`** (AC-4).
  Nakładka na `cmdk` (zależność już obecna, `^1.0.4`), wizualnie wzorowana na
  `command-palette/CommandPalette.tsx`, ale **niezależna** — tamta jest osadzona wyłącznie w Zakupach.
  Pole filtrowania po nazwie, lista z emoji/kolorem i numerem skrótu, stopka z linkiem do `/settings`.
  Renderuje wyłącznie wpisy po `filterAccessibleFavorites` (AC-8). `Esc` zamyka (C-31).
  *Gotowe, gdy:* otwiera się z `/portfel`, `/notes`, `/kitchen` i filtruje po fragmencie nazwy.

- [ ] **T-12** `[P]` — **`src/components/favorites/FavoritesShortcuts.tsx`** (AC-5).
  Globalny listener `Alt+1..9` → nawigacja do n-tego **dostępnego** ulubionego.
  **Warunek obowiązkowy:** `e.altKey && !e.ctrlKey && !e.metaKey` — na klawiaturze polskiej
  AltGr = Ctrl+Alt i służy do wpisywania `ą ć ę ł ń ó ś ź ż`; bez wykluczenia `ctrlKey` skrót
  zjadałby polskie znaki. Dodatkowo listener milczy, gdy aktywny element to `input`/`textarea`/
  `contenteditable` (logika jak `isTypingTarget` w `useKeyboardShortcuts.ts`).
  *Gotowe, gdy:* `Alt+1` przechodzi do pierwszego wpisu, a wpisanie `ą ć ę` przez AltGr w polu
  tekstowym **nie** wyzwala nawigacji.

- [ ] **T-13** — **Wpięcie ulubionych w powłokę** (AC-4, AC-8) — zadanie scalające T-10..T-12.
  `ModuleSidebar.tsx` (desktop): gwiazdka + sekcja listy ulubionych w dolnej części, obok dzwonka.
  `AppShell.tsx` (mobile): gwiazdka w kontenerze `ml-auto` obok `NotificationBell`;
  `FavoritesShortcuts` montowany raz. Dane ulubionych dostarczane do powłoki z warstwy serwerowej
  (jak `menuPrefs`), przefiltrowane `filterAccessibleFavorites`.
  **Nigdy dwa sidebary na mobile** (C-31) — gwiazdka trafia do istniejącego paska, nie tworzy nowego.
  *Gotowe, gdy:* ulubione są dostępne z dowolnej strony, a odebranie `module.portfel` w
  `/admin/access` sprawia, że wpis do `/portfel` przestaje być klikalny we **wszystkich** miejscach.

- [ ] **T-14** `[P]` — **Sekcja ulubionych na pulpicie** (AC-6, AC-18).
  `src/lib/home/dashboardSections.ts`: nowy klucz `favorites` w `DASHBOARD_SECTIONS` (dzięki temu
  `sanitizeSectionKeys` go przepuszcza) + nowa **kolejność domyślna**
  `briefing → favorites → today → modules → quickActions → suggestions → recently` (AC-16).
  `HomePage.tsx`: `SECTION_LABELS.favorites = "Ulubione widoki"` + węzeł sekcji.
  `src/components/favorites/FavoriteCards.tsx`: karty z emoji/nazwą/akcentem oraz **pusty stan** —
  jedna linijka zachęty zamiast pustej ramki.
  **Logiki `effectiveOrder`/`order`/`hidden` nie ruszamy** — z niej wynika AC-18 za darmo.
  *Gotowe, gdy:* konto z zapisanym `DashboardPref` zachowuje swoją kolejność i ukrycia, a `favorites`
  doklejone na końcu daje się przestawić i ukryć.

- [ ] **T-15** `[P]` — **`src/components/settings/FavoriteViewsEditor.tsx`** (AC-7) + wpięcie
  w `src/app/settings/page.tsx` obok `MenuPrefsEditor` (wzorzec 1:1: strzałki góra/dół, edycja
  inline, usuwanie).
  *Gotowe, gdy:* zmiana kolejności, nazwy, ikony i usunięcie odbijają się w sidebarze, przełączniku
  i na pulpicie.

## Faza 5 — Strona główna (plan §5.4–5.5)

- [ ] **T-16** — **`prompt` w magistrali asystenta** (plan §5.5).
  `src/lib/ai/assistantBus.ts`: `AssistantOpenDetail` zyskuje `prompt?: string`.
  `src/components/home/AICommandSheet.tsx` (~l. 760–779, istniejący handler `onOpen`): gdy `prompt`
  jest ustawiony — otwórz panel i wyślij tę wiadomość jak wpisaną przez użytkownika.
  **Zakres twardo ograniczony do tego handlera** (~10 linii). Żadnego wariantu „dokowanego" panelu,
  żadnej drugiej instancji czatu — sheet pozostaje jedynym posiadaczem stanu rozmowy (C-53).
  *Gotowe, gdy:* `openAssistant({ prompt: "test" })` z konsoli otwiera asystenta z wysłanym pytaniem,
  a dotychczasowe otwarcie bez `prompt` działa jak wcześniej.

- [ ] **T-17** — **`src/components/home/HomeAssistantColumn.tsx`** (AC-11).
  Nagłówek z dużą ikoną `Sparkles`, **prawdziwe pole tekstowe gotowe do pisania od razu**
  (bez autofokusa — przewijałby stronę i przechwytywał skróty), kontekstowe podpowiedzi startowe,
  przycisk wysłania → `openAssistant({ prompt })`. Kolumna `position: sticky; top: 0`.
  *Gotowe, gdy:* na `/` przy ≥1280 px da się pisać bez żadnego kliknięcia, a panel nie znika przy
  przewijaniu strony.

- [ ] **T-18** — **Układ 3 / 2 / 1 kolumny na stronie głównej** (AC-16, AC-17, AC-12) — najtrudniejsze.
  `HomePage.tsx`: kontener sekcji jako siatka `grid-cols-1 md:grid-cols-2`, kolumna asystenta jako
  **osobny** element siatki na `xl:` (`xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]`), poniżej
  `xl` znikająca (asystent zostaje pod pływającym przyciskiem — AC-12).
  **`minmax(0, 1fr)` jest obowiązkowe** — domyślne `1fr` ma `min-width: auto` i długi tekst rozpycha
  siatkę w poziome przewijanie.
  Oprawa (poświata/rozmycie) **wyłącznie** z tokenów + `color-mix(in srgb, var(--accent-*) N%,
  transparent)` — zero hexów, zero `rgba()` z liczbami dobranymi pod ciemne tło (C-30).
  *Gotowe, gdy:* przy 390/900/1440 px widać kolejno 1/2/3 kolumny,
  `document.scrollingElement.scrollWidth === clientWidth` na każdej z tych szerokości (AC-16),
  a przełączenie skórki Dark → Light nie czyni niczego nieczytelnym (AC-17).

## Faza 6 — Bramki i domknięcie (plan §8)

- [ ] **T-19** — **Bramki jakości** na lokalnym Postgresie (C-13 — **nigdy** prod `DATABASE_URL`;
  pełne `npm run build` odpala na końcu `scripts/migrate.js`, więc kroki uruchamiamy osobno):
  ```
  npm run check:migrations && npm run check:actions && npm run check:ai-coverage \
    && npx next lint --dir src && npx prisma generate && npx next build
  ```
  *Gotowe, gdy:* wszystkie kroki do `next build` włącznie są zielone.

- [ ] **T-20** — **Kontrola pokrycia kryteriów akceptacji** — przejście po tabeli z planu §8
  i odnotowanie wyniku dla AC-1…AC-27 (wejście dla `/verify`).
  Osobno sprawdzić dwie rzeczy, o których łatwo zapomnieć:
  **AC-19** — wejście na `/` bez klikania **nie** generuje briefingu (brak zapytania do
  `/api/llm/home/briefing` w karcie sieci); **AC-17** — `grep` na nowych plikach nie znajduje
  `#rrggbb` ani `rgba(` z liczbami.
  *Gotowe, gdy:* każde AC ma odnotowany wynik.

- [ ] **T-21** — **Wpisy do `doświadczenia.md`** (C-51, po polsku, format `## YYYY-MM-DD — tytuł` /
  `**Problem:**` / `**Rozwiązanie:**` / `**Lekcja:**`). Trzy są znane już z etapu planowania:
  1. sticky `:hover` na ekranie dotykowym zapala i **zostawia** zapalony element ujawniany przy
     najechaniu → wariant `[@media(hover:hover)]:`;
  2. `rows` liczone po znakach nowej linii nie widzi zawijania długiego akapitu → pomiar
     `scrollHeight` z resetem do `"auto"`;
  3. `clearDoneItems` kasuje twardo (`deleteMany`, bez kosza) — nieodwracalna operacja pod ikoną bez
     potwierdzenia.
  Jeśli w trakcie implementacji pojawi się kolejny nieoczywisty problem — dopisz go tutaj.
  *Gotowe, gdy:* wpisy są w pliku i zacommitowane **razem z poprawkami**, nie osobno.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) |
|---|---|
| AC-1 (zapis z filtrami) | T-7, T-8, T-10 |
| AC-2 (powrót pod ten sam adres) | T-8, T-11 |
| AC-3 (gwiazdka jako przełącznik) | T-8, T-10 |
| AC-4 (dostęp z każdej strony + filtrowanie) | T-11, T-13 |
| AC-5 (skrót klawiszowy, AltGr) | T-12 |
| AC-6 (pusty stan) | T-14 |
| AC-7 (zarządzanie) | T-15 |
| AC-8 (RBAC) | T-7, T-11, T-13, T-14 |
| AC-9 (brak duplikatów) | T-5, T-8 |
| AC-10 (synchronizacja między urządzeniami) | T-5, T-6, T-8 |
| AC-11 (asystent widoczny, nie znika) | T-16, T-17 |
| AC-12 (mobile, jeden sidebar) | T-13, T-18 |
| AC-13, AC-14 (briefing + pusty stan) | T-18 *(istniejący `DailyBriefingCard` — bez zmian zachowania)* |
| AC-15 (skróty modułów wg uprawnień) | T-18 *(istniejący `ModuleSnapshotGrid`)* |
| AC-16 (3/2/1 kolumny, brak przewijania w poziomie) | T-14, T-18 |
| AC-17 (skórki, tylko tokeny) | T-18, T-20 |
| AC-18 (zachowana personalizacja pulpitu) | T-14 |
| AC-19 (tryb sekcji AI — nie generuj sam) | T-20 |
| AC-20, AC-21, AC-22 (checkboxy) | T-1 |
| AC-23 (rozciągane pole opisu) | T-2 |
| AC-24 (potwierdzenie czyszczenia) | T-3 |
| AC-25, AC-26, AC-27 (nazewnictwo) | T-4 |

**Każde AC ma pokrycie.** AC-13/14/15 są kryteriami „nie zepsuj przy przebudowie układu" — realizują
je istniejące komponenty (`DailyBriefingCard`, `ModuleSnapshotGrid`), a T-18 ma je przenieść do nowej
siatki bez zmiany zachowania.

## Ścieżka krytyczna

```
T-5 → T-6 → T-7 → T-8 → T-9 → T-10 → T-13 → T-19 → T-20 → T-21
                                  ↘ T-11, T-12 (równolegle, wchodzą do T-13)
T-14, T-15 — po T-8 (potrzebują akcji), niezależne od siebie
T-16 → T-17 → T-18 — osobna gałąź, niezależna od ulubionych aż do T-19
T-1, T-2, T-3, T-4 — całkowicie niezależne, bez wspólnych plików z resztą
```

Wąskie gardło to **T-8** (Server Actions): blokuje całe UI ulubionych. **T-13** scala trzy komponenty
powłoki i jako jedyne dotyka `AppShell.tsx` oraz `ModuleSidebar.tsx` — te same pliki rusza T-4
(zmiana nazwy), więc **T-4 musi być zamknięte przed T-13**, żeby nie robić konfliktu na sobie samym.

## Notatki / blokady

- Brak blokad na starcie.
- **Uwaga na kolejność:** T-4 i T-13 dotykają `AppShell.tsx` oraz `ModuleSidebar.tsx`. T-4 jest
  wcześniej w kolejności właśnie z tego powodu.
- Weryfikacja lokalna wymaga uruchomionego Postgresa (`pg_ctlcluster 16 main start`) i wyeksportowanych
  `DATABASE_URL`/`DIRECT_URL` — skrypty w `scripts/` **nie czytają** `.env.local`.
