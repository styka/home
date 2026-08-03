# Plan techniczny: Nawigacja po widokach, widget asystenta i układ strony głównej

- **Spec:** ./spec.md (043-nawigacja-widoki-asystent)
- **Status:** draft
- **Data:** 2026-08-03

> **Zasada planu:** to jest **JAK**. Plan pisany pod istniejący kod — najpierw rekonesans
> w sąsiednich modułach, potem projekt (C-53).

---

## 1. Podejście

Spec dotyka **czterech niezależnych mechanizmów powłoki** i jednego dokumentu, więc plan traktuje je
jako cztery równoległe tory + raport. Wzorcem do naśladowania jest **to, co powstało w 042** —
`src/lib/favorites/favoriteViews.ts` (czysty moduł obliczeniowy, importowalny z klienta) +
`src/actions/favoriteViews.ts` (Server Actions) + magistrala zdarzeń `favoritesBus.ts`. Trzy nowe
mechanizmy (stan widoku w adresie, rejestr skrótów, źródło akcji asystenta) budujemy dokładnie tak
samo: **czysty moduł w `src/lib/*` + cienki hook/komponent kliencki**, zero nowych zależności, zero
zmian w modelu danych.

Trzy z czterech torów to **naprawa regresji z 042** — plan celowo naprawia **przyczyny**, nie objawy:
brak sprawdzania modyfikatorów w jednym `switch`, `return null` przy pustych ulubionych, i widget
asystenta trzymany za `hidden xl:block`.

---

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Wszystko, czego feature potrzebuje w bazie, już istnieje:

- ulubione widoki → model `FavoriteView` (migracja 0221, spec 042) — pełny adres z parametrami mieści
  się w istniejącej kolumnie `path` (limit 512 znaków w `normalizeFavoritePath`, nie ruszamy go);
- stan widoku → **żyje wyłącznie w adresie strony**, świadomie nie jest utrwalany w bazie (C-53:
  utrwalanie = nowy model + migracja + akcje, a ulubione już dają trwałość na żądanie);
- skróty i akcje asystenta → dane statyczne w kodzie.

**Jedyna migracja** to seed raportu administracyjnego (AC-21..AC-23):

- Numer z `npm run next:migration`: **`0222`**
- Katalog: `worldofmag/prisma/migrations/0222_raport_architektura_zdarzeniowa/migration.sql`
- DDL: brak — wyłącznie `INSERT INTO "Report" (…) VALUES (gen_random_uuid()::text, …, $tag$…$tag$,
  'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("slug") DO UPDATE SET
  "content"=EXCLUDED."content","updatedAt"=CURRENT_TIMESTAMP;` — wzorzec 1:1 z
  `0113_marketplace_etapB_m5_report`. Slug **globalnie unikalny**:
  `omnia-architektura-zdarzeniowa-cofanie-live-2026-08-03` (C-14).

---

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych i bez zmienionych Server Actions.** To jest świadoma decyzja, nie przeoczenie:

- ulubione mają komplet akcji z 042 (`getFavoriteViews`, `addFavoriteView`, `removeFavoriteView`,
  `removeFavoriteViewByPath`, `updateFavoriteView`, `reorderFavoriteViews`) — zmiany w tym torze są
  czysto prezentacyjne;
- stan widoku i rejestr skrótów są w całości po stronie klienta;
- raport wjeżdża migracją SQL, nie akcją.

**Konsekwencja dla bramek:** `src/lib/ai/action-coverage.json` i `content-memory-coverage.json`
**nie wymagają nowych wpisów** — nie powstaje żadna nowa akcja ani żadne nowe wywołanie
`chatComplete`/`chatStream`. Bramki `check:actions`, `check:ai-coverage`, `check:cost-badge`,
`check:content-memory` mają przejść **bez modyfikacji manifestów**; gdyby któraś zażądała wpisu,
to znaczy, że zakres się rozjechał z planem.

Jedyne dotknięcie serwera: **`page.tsx` modułów zaczynają czytać `searchParams`** i przekazywać je
do komponentu klienckiego (patrz §5.2). To nie jest mutacja, nie wymaga guardów; strony i tak są
dynamiczne (wymagają sesji), więc nie tracimy statycznego renderowania.

---

## 4. RBAC / rejestr modułu (C-22)

- **Brak nowego sluga uprawnień.** Ulubione nadal filtrujemy przez `filterAccessibleFavorites`
  (`isPathLocked`) — mechanizm z 042 zostaje bez zmian.
- **Raport** trafia do `/reports` (dostęp: zalogowany), zgodnie z konwencją „Reports = authenticated,
  bez sluga". Treść jest adresowana do administratora, ale nie wprowadzamy dla niej wyjątku w RBAC.
- `permissions.ts`, `modules.tsx`, `ModuleSidebar` — **bez wpięć nowych modułów**; zmiany
  w `ModuleSidebar` są wyłącznie układowe (§5.1).

---

## 5. UI (C-30, C-31, C-32)

### 5.1. Tor A — ulubione widoczne i zarządzalne (AC-1, AC-2, AC-3)

**Przyczyna zgłoszenia** siedzi w `FavoritesSidebarSection.tsx:28` (`if (accessible.length === 0)
return null;`) — moja decyzja z 042 „pusty stan nie zajmuje miejsca" w praktyce znaczyła „funkcja nie
istnieje". Naprawa:

1. **Usuwamy wczesny `return null`.** Przy zerze wpisów sekcja renderuje nagłówek „ULUBIONE" +
   jednowierszową zachętę („Zapisz bieżący widok gwiazdką ↓") w `var(--text-muted)`.
2. **Punkt zapisu przenosimy na górę paska** — `FavoriteStarButton` przestaje być ostatnią pozycją
   listy nawigacji (`ModuleSidebar.tsx:295`) i staje się **pierwszym wierszem sekcji ulubionych**,
   z etykietą tekstową („Zapisz ten widok" / „Zapisano — kliknij, by edytować"), nie samą ikoną.
   Wymaga to nowego wariantu `placement: "viewbar"` w `FavoriteStarButton` (ikona + tekst,
   pełna szerokość) obok istniejących `"sidebar" | "topbar"`.
3. **Punkt zarządzania**: ikonka koła zębatego w nagłówku sekcji → `Link` do `/settings#ulubione`.
   W `src/app/settings/page.tsx` sekcja z `FavoriteViewsEditor` dostaje `id="ulubione"`, żeby kotwica
   działała. Edytor z 042 już umie nazwę/ikonę/kolor/kolejność/usuwanie → **AC-3 jest spełnione samym
   dowiązaniem**, bez nowego UI.
4. Pasek mobilny (`AppShell.tsx:147`) zostaje bez zmian — tam gwiazdka już jest widoczna.

**Decyzja i jej uzasadnienie (do odnotowania w verify).** AC-2 mówi „w pasku bieżącego widoku".
W Omnii **nie istnieje wspólny górny pasek na desktopie** — `AppShell` renderuje `<main>{children}</main>`,
a każdy moduł ma własny nagłówek. Dołożenie globalnego paska nad `children` oznaczałoby podwójne
nagłówki w ~20 modułach i utratę przestrzeni pionowej — to sprzeczne z C-53 i z „zero zbędnych
kliknięć/pikseli". Dlatego punkt zapisu ląduje **na samej górze nawigacji, w sekcji ulubionych**:
jest pierwszą rzeczą w pasku, ma etykietę tekstową i dotyczy bieżącego widoku. Alternatywa (gwiazdka
w nagłówku każdego modułu z osobna) to kilkanaście identycznych diffów — odrzucona.

### 5.2. Tor B — stan widoku w adresie (AC-4..AC-8b)

**Wzorzec do naśladowania:** `TasksPage` już przyjmuje `initialFilter` z serwera, a `NotesPage`
`initialPinnedOnly` — czyli „wartość startowa z propsa" jest w repo utartą konwencją. Rozszerzamy ją,
zamiast wymyślać nową.

**Nowy czysty moduł** `src/lib/viewState/viewState.ts` (bez Reacta, bez Prismy):

```ts
export interface ParamCodec<T> {
  parse: (raw: string | undefined) => T;      // brak/śmieci → wartość domyślna
  serialize: (value: T) => string | null;     // null = wartość domyślna → NIE trafia do adresu
}
export function oneOf<T extends string>(allowed: readonly T[], fallback: T): ParamCodec<T>;
export function text(fallback?: string): ParamCodec<string>;
export function idList(): ParamCodec<string[]>;   // "a,b,c"
export function flag(fallback: boolean): ParamCodec<boolean>;

export type ViewSpec = Record<string, ParamCodec<unknown>>;
export function parseViewParams<S extends ViewSpec>(spec: S, raw: RawParams): ViewValues<S>;
export function buildViewQuery<S extends ViewSpec>(spec: S, values: ViewValues<S>): string;
```

Reguły zaszyte w module (realizują ryzyka ze speca §9):
- **do adresu trafiają wyłącznie wartości różne od domyślnych** (`serialize` zwraca `null` dla
  domyślnej) — adres nie puchnie, a wejście „gołe" jest identyczne z dotychczasowym (AC-8);
- **kolejność parametrów jest stabilna** (kolejność kluczy w `spec`), żeby ten sam widok dawał ten sam
  adres — inaczej ulubione (`@@unique([ownerId, path])`) zapisywałyby duplikaty tego samego widoku;
- **nieznana/niepoprawna wartość → wartość domyślna**, nigdy wyjątek (adres jest wejściem
  użytkownika).

**Nowy hook** `src/hooks/useViewState.ts`:

```ts
const [view, setView] = useViewState(spec, initialParams);
setView({ filter: "DONE" });                    // domyślnie pushState → działa „wstecz" (AC-6)
setView({ q: value }, { replace: true });       // pole tekstowe → replaceState, bez zaśmiecania historii
```

Trzy decyzje implementacyjne, każda z powodu:

1. **Wartość startowa idzie z serwera propsem** (`page.tsx` czyta `searchParams` i przekazuje je
   dalej), a nie z `window.location` w pierwszym renderze. Powód jest twardy: czytanie adresu na
   kliencie przy renderze serwerowym bez parametrów to **rozjazd hydratacji**, a wpis z 2026-08-02
   w `doświadczenia.md` opisuje, jak jeden taki rozjazd degraduje całą aplikację. Przy propsie
   serwer i klient renderują identycznie i nie ma mignięcia widoku domyślnego.
2. **Zapis przez `window.history.pushState`/`replaceState`, nie `router.push`.** Next 14.2 integruje
   natywne History API z routerem App Routera, a `router.push` na tę samą trasę wymusiłby pobranie
   RSC przy **każdym** kliknięciu filtra. Odczyt cofnięcia — listener `popstate` przeliczający
   `window.location.search` przez `parseViewParams`.
3. **Nie używamy `useSearchParams`.** To już zapisana lekcja z 042 (`FavoriteStarButton.tsx:36`):
   w komponencie powłoki wymusza granicę `Suspense`. Tu dodatkowo byłoby zbędne — parametry mamy
   z propsa i z `popstate`.

**Faza A — trzy moduły (weryfikacja mechanizmu):**

| Moduł | Stan przenoszony do adresu | Klucze |
|-------|---------------------------|--------|
| Zadania (`TasksPage`) | filtr statusu, tagi, grupowanie, układ | `filter`, `tags`, `group`, `layout` |
| Zakupy (`ShoppingPage`) | zakładka filtra | `filter` |
| Notatki (`NotesPage`) | filtr, tryb widoku | `filter`, `view` |

W Zadaniach `initialFilter` i w Notatkach `initialPinnedOnly` **zostają** — stają się wartością
domyślną w `spec`, więc dotychczasowe wejścia (np. `/notes` z przypiętymi) działają jak dotąd.

**Faza B — pozostałe moduły.** Startuje dopiero po zielonej fazie A. Pełną, **zweryfikowaną w kodzie**
listę modułów wraz z decyzją „pokrywamy / pomijamy + dlaczego" etap `/tasks` zapisze w artefakcie
**`specs/043-nawigacja-widoki-asystent/pokrycie-widokow.md`** — to jest dowód na AC-8b. Rekonesans
wykonany na potrzeby planu wskazuje kandydatów:

- **do pokrycia:** Zdrowie (`tab`), Kalendarz (filtr modułu), Wiadomości (`view`), Usługi (katalog:
  szukajka/sortowanie/filtry; moje zlecenia: `tab`; moderacja: `tab`), Pogoda → Pomysły (`filter`),
  Warsztaty (zakładka detalu), Zwierzęta (zakładka detalu), Magazynowanie (szukajka listy),
  Kontakty (szukajka), Raporty (szukajka), Kuchnia (szukajka przepisów, szukajka spiżarni);
- **kandydaci do pominięcia z uzasadnieniem:** panele administracyjne (`/admin/audit`, `/admin/jobs`,
  `/admin/ai-coverage`, `/admin/access`) — narzędzia wewnętrzne, nie zapisuje się ich w ulubionych;
  oraz **stan formularzy i okien dialogowych** (tryb edytora map sklepów, tryb skanera, tryb nauki
  w Językach, tryb genetyki, szukajki wewnątrz szufladek) — to stan chwilowy kroku pracy, a nie widok
  do odtworzenia. Każde pominięcie musi mieć wiersz w artefakcie.

### 5.3. Tor C — rejestr skrótów (AC-9..AC-12)

**Potwierdzona przyczyna:** `useKeyboardShortcuts.ts:77-81` — `case "1": handlers.onFilterTab?.(0)`
siedzi w `switch (e.key)` za samym `if (typing) return;`, **bez sprawdzenia modyfikatorów**. `Alt+1`
odpala więc i skok do ulubionego (osobny listener w `FavoritesShortcuts`), i przełączenie zakładki.

Naprawiamy **przyczynę**, zgodnie z decyzją właściciela („wspólny rejestr, pierwszeństwo strony,
ściągawka"):

1. **`src/lib/shortcuts/registry.ts`** (czysty moduł): typ `ShortcutDef { id, keys, label, group,
   scope: "page" | "global" }`, `matchShortcut(e, keys)` i `formatKeys(keys)` do ściągawki.
   Zapis skrótu tekstem: `"j"`, `"Alt+1"`, `"Ctrl+K"`, `"?"`.
   **Jedna reguła, która likwiduje kolizję:** skrót bez modyfikatora dopasowuje się **tylko** gdy
   `!altKey && !ctrlKey && !metaKey`. `Shift` **nie** jest modyfikatorem blokującym — bez niego nie da
   się wpisać `?` ani żadnego znaku z górnego rzędu. Osobno zostaje reguła z lekcji o polskiej
   klawiaturze: **AltGr = Ctrl+Alt**, więc skrót `Alt+…` wymaga `altKey && !ctrlKey` (AC-12).
2. **`src/components/shell/ShortcutsProvider.tsx`**: kontekst + **jeden** listener `keydown` na
   `window`. Rejestracja przez `useShortcuts(defs, handlers)`; dyspozytor sortuje kandydatów
   `scope: "page"` **przed** `"global"`, pierwszy pasujący wygrywa i robi `preventDefault`.
   To jest realne pierwszeństwo strony — nie da się go uzyskać dwoma listenerami, bo komponent
   strony montuje się **po** powłoce, więc jego listener odpalałby się jako drugi.
   Prowider montujemy w `AppShell`, obok `FavoritesOverlay`.
3. **`useKeyboardShortcuts` zostaje z niezmienioną sygnaturą** (`ShortcutHandlers`) i tylko rejestruje
   się w prowiderze. Dzięki temu **żaden z modułów jej używających nie wymaga zmian** — a używa jej
   dziś m.in. Zadania, Zakupy, Notatki, Zdrowie, Kontakty (C-53). Gdy prowidera nie ma (test
   jednostkowy, izolowany render), hook degraduje się do własnego listenera.
4. **`FavoritesShortcuts.tsx`** przestaje mieć własny listener i rejestruje `Alt+1..9`/`Alt+0` jako
   `scope: "global"` — dzięki temu ulubione **pokazują się w ściągawce** i podlegają tej samej
   regule pierwszeństwa.
5. **`src/components/shortcuts/ShortcutsCheatSheet.tsx`**: nakładka wywoływana klawiszem `?`
   (i pozycją w palecie poleceń), listująca **aktualnie zarejestrowane** skróty — najpierw sekcja
   „Ta strona", potem „Globalne". Lista jest generowana z rejestru, więc nie może się rozjechać
   z rzeczywistością (AC-11). Oprawa: wyłącznie zmienne motywu, `Esc` zamyka, teksty PL.

### 5.4. Tor D — widget asystenta (AC-13..AC-17)

1. **`src/lib/ai/assistantStarters.ts`** — nowy, klientowo bezpieczny moduł z **jednym** źródłem
   akcji: przenosimy tu `STARTER_CHIPS` z `AICommandSheet.tsx:232` i dokładamy
   `buildAssistantStarters(ctx)` (kontekstowe podpowiedzi, dziś liczone ad-hoc w `HomePage.tsx:238`).
   Importują go **oba** miejsca — to jest cała treść AC-17.
2. **`src/components/home/HomeAssistantCard.tsx`** — nowy widget zastępujący
   `HomeAssistantColumn.tsx` (plik **usuwamy**; jego jedyną treścią było pole tekstowe, którego AC-15
   zabrania). Zawartość karty: ikona + „Asystent", wiersz przycisków-akcji (zawijany, z akcjami
   z pkt. 1) i wyraźne wejście „Otwórz asystenta". Kliknięcie akcji → `openAssistant({ prompt })`;
   `AICommandSheet` od 042 wysyła taką wiadomość **natychmiast po otwarciu**, więc AC-16 jest
   spełnione istniejącym okablowaniem — nie dopisujemy drugiej ścieżki.
3. **Pozycja na pulpicie:** karta renderuje się w `HomePage` **przed** siatką sekcji, na pełną
   szerokość, **bez** `hidden xl:block` — widoczna na każdej szerokości (AC-13, AC-14).
   **Świadomie nie jest sekcją personalizowaną.** Powód: `HomePage.tsx:213` dokleja nieznane klucze
   **na koniec** zapisanej kolejności, więc dodanie `"assistant"` do `DASHBOARD_SECTIONS` wylądowałoby
   u wszystkich obecnych użytkowników (w tym u właściciela, który to zgłosił) **na dole** pulpitu —
   dokładnie odwrotnie do AC-14. Karta ma być zwięzła (jeden wiersz nagłówka + wiersz akcji), żeby
   briefing został nad zgięciem (ryzyko ze speca §9).

### 5.5. Tor E — układ pulpitu bez dziur (AC-18..AC-20)

Dziury biorą się z `grid grid-cols-1 md:grid-cols-2` (`HomePage.tsx:418`): siatka wyrównuje **wiersze**
do najwyższego kafelka, więc pod niższym zostaje pusta przestrzeń. Zamieniamy siatkę na **układ
wielokolumnowy CSS** (`columns-1 md:columns-2`, `column-gap: 16px`), a kafelki dostają
`break-inside: avoid`, `width: 100%`, `margin-bottom: 16px` (w układzie kolumnowym `gap` nie działa).
Kafelki pakują się wtedy ciasno, bez wyrównywania do wiersza.

- **Kolejność:** w układzie kolumnowym czyta się pionowo (cała kolumna 1, potem kolumna 2). To nadal
  respektuje kolejność użytkownika i pozostaje sensowne (AC-20); na wąskim ekranie mamy jedną kolumnę,
  czyli dokładnie kolejność liniową.
- **Tryb personalizacji zostaje jednokolumnowy** (jak dziś) — strzałki „w górę/w dół" są czytelne
  tylko liniowo. AC-19 wymaga, by **poza** trybem edycji było **co najmniej równie uporządkowanie** —
  pakowanie bez dziur to spełnia.
- **Zero poziomego przewijania:** `min-width: 0` na kafelkach zostaje (to samo zabezpieczenie co przy
  `minmax(0,1fr)` w siatce).

### 5.6. Tor F — raport administracyjny (AC-21..AC-23)

Raport pisany jako markdown w migracji 0222, po polsku, z **weryfikowalnymi odwołaniami do kodu**.
Szkielet wymuszony przez kryteria akceptacji:

1. **Stan faktyczny** — czy Omnia jest sterowana zdarzeniami: nie w sensie event-sourcingu; mutacje to
   Server Actions + `revalidatePath`, jedyne kolejkowanie to `Job` + `JOB_HANDLERS`, jedyny „strumień"
   to SSE agenta AI.
   > **Korekta po rekonesansie (C-54, 2026-08-03).** Pierwotny szkic planu zakładał, że odświeżanie
   > międzyurządzeniowe nie istnieje. **Istnieje częściowo:** `src/components/shell/DataFreshness.tsx`
   > (montowany w `AppShell`) robi `router.refresh()` przy `visibilitychange`/`focus`/`pageshow`
   > oraz cyklicznie co 45 s, gdy karta jest widoczna. Raport **musi** to nazwać wprost — inaczej
   > sprzedawałby właścicielowi jako „nowość" coś, co ma od dawna. Konsekwencja dla pkt. 3: warianty
   > (a) i (b) są **już wdrożone**, więc realna oś decyzji zaczyna się dopiero od (c).
2. **Cofalność zmian** — co dziś jest cofalne (`TrashItem` — miękkie kasowanie z retencją;
   `NoteRevision` — historia wersji notatek; `AuditLog` — ślad zmian RBAC/konfiguracji), a co nie
   (każda edycja pola poza notatkami). Wprost: to jest cofanie **usunięć**, a nie historia **edycji**
   jak w dokumentach Google.
3. **Warianty dojścia** z kosztem i ryzykiem — od najtańszego: (a) rewalidacja na żądanie
   + odświeżanie przy powrocie do karty i (b) polling wybranych widoków — **oba już wdrożone**
   w `DataFreshness` (opisujemy je jako punkt wyjścia i podajemy realne opóźnienie ≤45 s);
   (c) SSE/WebSocket dla wybranych modułów, (d) dziennik zmian per encja (`*Revision`) jako fundament
   cofania, (e) pełny event sourcing / CRDT dla edycji współbieżnej.
4. **Czego nie da się osiągnąć tanio (AC-23)** — edycja współbieżna w stylu Google Docs wymaga CRDT/OT
   i trwałego połączenia; darmowy plan Rendera **usypia usługę testową po 15 min**, więc trwałe
   połączenia są tam z definicji zawodne; koszt utrzymania rośnie liniowo z liczbą modułów, a Omnia ma
   ich ~20 — bez jednego wspólnego mechanizmu skończy się to dwudziestoma implementacjami.
5. **Wskazanie miejsc w kodzie do zmiany (AC-22)** — `src/actions/*` (`revalidatePath`),
   `src/lib/jobs/*`, `src/lib/trash.ts`, `NoteRevision`, `AppShell` jako miejsce na wspólny kanał.

---

## 6. AI / integracje

- **Bez nowych `AIAction`** i bez zmian w egzekutorze `/api/llm/home/execute` — widget uruchamia
  akcje, które asystent już ma (spec §6).
- **Bez nowych read-toolów** w `agentTools.ts`.
- **Bez wywołań `chatComplete`/`chatStream`** → `check:cost-badge` i `check:content-memory` bez zmian
  w manifestach.
- Kalendarz / powiadomienia / trash / auto-expense — nie dotyczy.

---

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0222_raport_architektura_zdarzeniowa/migration.sql` | nowy | Seed raportu (AC-21..23), idempotentnie |
| `src/lib/viewState/viewState.ts` | nowy | Czysty mechanizm kodowania stanu widoku w adresie |
| `src/hooks/useViewState.ts` | nowy | Hook: props z serwera + `pushState`/`popstate` |
| `src/lib/shortcuts/registry.ts` | nowy | Definicje, dopasowanie klawiszy, reguła modyfikatorów |
| `src/components/shell/ShortcutsProvider.tsx` | nowy | Jeden listener + pierwszeństwo strony |
| `src/components/shortcuts/ShortcutsCheatSheet.tsx` | nowy | Ściągawka `?` (AC-11) |
| `src/lib/ai/assistantStarters.ts` | nowy | Jedno źródło akcji dla asystenta i widgetu (AC-17) |
| `src/components/home/HomeAssistantCard.tsx` | nowy | Widget bez pola tekstowego (AC-13..16) |
| `src/components/home/HomeAssistantColumn.tsx` | **usunięcie** | Zastąpiony; zawierał zakazane pole tekstowe |
| `src/hooks/useKeyboardShortcuts.ts` | edycja | Rejestracja w prowiderze; koniec `switch` bez modyfikatorów |
| `src/components/favorites/FavoritesShortcuts.tsx` | edycja | Skróty ulubionych przez rejestr |
| `src/components/favorites/FavoritesSidebarSection.tsx` | edycja | Usunięcie `return null`, zachęta, zapis i zarządzanie na górze |
| `src/components/favorites/FavoriteStarButton.tsx` | edycja | Wariant `placement="viewbar"` (ikona + etykieta) |
| `src/components/shell/ModuleSidebar.tsx` | edycja | Przeniesienie gwiazdki z dołu do sekcji ulubionych |
| `src/components/shell/AppShell.tsx` | edycja | Montaż `ShortcutsProvider` + ściągawki |
| `src/app/settings/page.tsx` | edycja | Kotwica `id="ulubione"` dla linku „Zarządzaj" |
| `src/components/home/HomePage.tsx` | edycja | Karta asystenta na górze, układ kolumnowy zamiast siatki |
| `src/app/tasks/**/page.tsx`, `src/components/tasks/TasksPage.tsx` | edycja | Faza A — stan widoku w adresie |
| `src/app/shopping/**/page.tsx`, `src/components/shopping/ShoppingPage.tsx` | edycja | Faza A |
| `src/app/notes/page.tsx`, `src/components/notes/NotesPage.tsx` | edycja | Faza A |
| moduły fazy B (wg `pokrycie-widokow.md`) | edycja | Faza B — wpięcie tego samego hooka |
| `specs/043-.../pokrycie-widokow.md` | nowy | Dowód pokrycia dla AC-8b |
| `e2e/specs/view-state.spec.ts`, `shortcuts.spec.ts`, `home-assistant.spec.ts` | nowe | Weryfikacja klikaczami |
| `e2e/specs/favorites.spec.ts` | edycja | Pusty stan + nowe położenie gwiazdki |
| `doświadczenia.md` | edycja | Lekcje: kolizja skrótów, dziury w siatce (C-51) |

---

## 8. Bramki i weryfikacja (C-50)

**Lokalnie** (C-13 — nigdy prod DB): lokalny Postgres 16 (`pg_ctlcluster 16 main start`),
`.env.local` + eksport `DATABASE_URL`/`DIRECT_URL` na `127.0.0.1:5432`, `npx prisma migrate deploy`.
Następnie `npm run check:migrations && npm run check:actions && npm run check:ai-coverage &&
npm run check:cost-badge && npm run check:content-memory && next lint --dir src && npm run build`.
Klikacze: `nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &`.

| AC | Sposób weryfikacji |
|----|--------------------|
| AC-1 | E2E: konto bez ulubionych → sekcja i punkt zarządzania widoczne w pasku |
| AC-2 | E2E: przycisk zapisu jest pierwszym elementem sekcji, ma etykietę tekstową |
| AC-3 | E2E: klik „Zarządzaj" → `/settings#ulubione`, edytor obecny |
| AC-4 | E2E: ustaw filtr+tagi+układ w Zadaniach → zapisz gwiazdką → wyjdź → wróć z ulubionych → stan odtworzony |
| AC-5 | E2E: po zmianie filtra adres zawiera parametry; otwarcie adresu w nowej karcie daje ten sam widok |
| AC-6 | E2E: dwie zmiany filtra → `goBack()` → poprzedni filtr |
| AC-7 | E2E: to samo dla Zakupów i Notatek |
| AC-8 | E2E: wejście na `/tasks`, `/shopping`, `/notes` bez parametrów → widok domyślny; plus pełny przebieg dotychczasowych klikaczy modułów bez regresji |
| AC-8a | E2E: po jednym sprawdzeniu na moduł fazy B (zapis → powrót) |
| AC-8b | Przegląd artefaktu `pokrycie-widokow.md` — każdy moduł ma wiersz „pokryty" albo „pominięty + powód" |
| AC-9 | E2E: `Alt+1` na `/tasks` → zmiana adresu na ulubiony, zakładka filtra bez zmian |
| AC-10 | E2E: goła `2` na `/tasks` → zmiana zakładki |
| AC-11 | E2E: `?` → nakładka zawiera skróty strony i globalne |
| AC-12 | E2E: pisanie w polu (w tym `ą`/`ć` przez AltGr) nie wyzwala skrótów |
| AC-13 | E2E na `devices["Pixel 5"]`: widget widoczny bez przewijania, pierwszy w `<main>` |
| AC-14 | E2E desktop: widget pierwszy |
| AC-15 | E2E: brak `textarea`/`input` w widgecie |
| AC-16 | E2E: klik akcji → panel asystenta otwarty i wiadomość wysłana (bez pisania) |
| AC-17 | Statycznie: jedyny eksport listy akcji w `assistantStarters.ts`, dwa importy; brak drugiej listy w kodzie |
| AC-18 | E2E: pomiar `boundingBox` kafelków — brak pionowej luki większej niż odstęp między kolumnami |
| AC-19 | E2E: włącz/wyłącz tryb personalizacji, porównaj brak dziur |
| AC-20 | E2E przy 360/768/1440 px: `scrollWidth === clientWidth` |
| AC-21..23 | Otwarcie `/reports/<slug>` po migracji; przegląd treści pod kątem: stan faktyczny, miejsca w kodzie, warianty z kosztem, jawne „czego nie da się tanio" |

---

## 9. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja |
|--------|-----------|
| **Przeniesienie stanu do adresu psuje moduły fazy A/B** | Wartość startowa z propsa = dotychczasowa wartość domyślna; AC-8 jako twarde kryterium; jeden wspólny hook = jedno miejsce do poprawki |
| **Rozjazd hydratacji** przy czytaniu adresu na kliencie | Parametry idą z serwera propsem; zero odczytu `window` w pierwszym renderze (lekcja 2026-08-02) |
| **`pushState` rozjeżdża się z routerem Next** | Next 14.2 integruje History API z App Routerem; `popstate` przelicza stan; test AC-6 pilnuje |
| **Rejestr skrótów psuje działające skróty w wielu modułach** | `useKeyboardShortcuts` zachowuje sygnaturę → moduły bez zmian; AC-10 i AC-12 jako testy regresji |
| **Układ kolumnowy CSS łamie kafelki w pół** | `break-inside: avoid` + `width: 100%`; jeśli przeglądarka mimo to złamie kafelek — awaryjny wariant: rozdział sekcji na dwie kolumny w JS (round-robin) przy zachowaniu kolejności |
| **Faza B dotyka kilkunastu modułów** | Rusza dopiero po zielonej fazie A; moduł po module, każdy z osobnym sprawdzeniem AC-8 |
| **Widget spycha briefing pod zgięcie** | Karta zwięzła: nagłówek + jeden zawijany wiersz akcji; pomiar w teście AC-13 |

**Rollback.** Kod: rewert commita/gałęzi — wszystkie tory są addytywne wobec danych, więc cofnięcie
kodu nie zostawia niespójności. Migracja 0222: to sam `INSERT` raportu — jej cofnięcie nie jest
potrzebne (raport nie wpływa na działanie), a gdyby było, wystarczy `DELETE FROM "Report" WHERE
"slug" = …`. **Nigdy nie usuwamy ani nie przenumerowujemy zastosowanej migracji.**

---

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14 (migracje)** — jedna migracja `0222`, numer z `npm run next:migration`,
  idempotentny seed raportu z globalnie unikalnym slugiem, brak zmian schematu, brak enumów Prisma.
- [x] **C-20..C-25 (server/RBAC/AI/trash/audit)** — brak nowych Server Actions i nowych `AIAction`;
  brak nowego sluga uprawnień; ulubione dalej filtrowane po uprawnieniu modułu docelowego;
  manifesty pokrycia bez zmian.
- [x] **C-30..C-32 (UX)** — oprawa wyłącznie na zmiennych motywu (`--accent-*`, `--on-accent`,
  `--radius`), widget asystenta widoczny na każdej szerokości (koniec `hidden xl:block`), teksty PL,
  minimalne cele dotyku zachowane.
- [x] **C-51 (dziennik doświadczeń)** — wpisy o kolizji `Alt+cyfra` (brak sprawdzania modyfikatorów)
  i o dziurach z wyrównywania wierszy w CSS Grid.
- [x] **C-53 (minimalizm)** — zero nowych zależności; jeden wspólny mechanizm stanu widoku zamiast
  implementacji per moduł; `useKeyboardShortcuts` z niezmienioną sygnaturą, żeby nie ruszać
  kilkunastu modułów; AC-3 realizowane dowiązaniem do istniejącego edytora, nie nowym ekranem.
- [x] **C-54 (spójność ze specem)** — plan nie zmienia kryteriów; jedyna interpretacja wymagająca
  odnotowania (AC-2 „pasek bieżącego widoku" wobec braku wspólnego górnego paska na desktopie) jest
  opisana wraz z powodem w §5.1 i podlega ocenie na etapie `/verify`.
