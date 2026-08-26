# Plan techniczny: Moduł Zadania — UX tworzenia i przeglądania zadań

- **Spec:** ./spec.md (105-zadania-ux-tworzenia-i-widoku)
- **Status:** draft
- **Data:** 2026-08-26

> **Zasada planu:** to jest **JAK**, pisane pod istniejący kod modułu Zadania.

## 1. Podejście

Feature jest w całości **UI modułu Zadania** — **bez zmian w schemacie bazy i bez nowej Server
Action**. Wzorcem jest sam moduł Zadania (jego dzisiejsze `QuickAddTask`, `TasksPage`, `TaskDetail`)
oraz dwa istniejące rozwiązania platformy, których nie wymyślamy od nowa: `useViewState` (stan widoku
w adresie) i `platform/admin/trybAdmina` (preferencja układu w `localStorage`, z odczytem po
zamontowaniu). Cztery zmiany są lokalne w module, piąta — pusta luka w oknie potwierdzenia — jest
jednoliniową poprawką we wspólnym `Modal`, bo dotyczy wszystkich kilkudziesięciu wywołań, nie tylko
usuwania zadania.

Kluczowa decyzja, która trzyma zakres mały: **tryb pełny nie potrzebuje zmiany kontraktu widoku
(C-33)**. `TasksPage` renderuje `ModuleView` z `layout="fill"`, a wewnątrz ma własny wiersz
`<div className="flex flex-1 min-h-0 overflow-hidden">` z listą i panelem. „Zadanie na całej
przestrzeni modułu" = w tym wierszu nie renderujemy listy, a panel dostaje `flex-1`. Rama zostaje
nietknięta, więc nie ma ani wyjątku w module, ani poszerzania kontraktu dla dwudziestu innych.

## 2. Model danych (Prisma)

**Bez zmian w schemacie. Bez migracji.** Nie powstaje żaden model ani kolumna, więc `check:migrations`
i `check:schema-drift` nie mają się o co potknąć, a `npm run next:migration` nie jest wołane.

Trzy nowe stany, które trzeba gdzieś trzymać, i świadomy wybór nośnika dla każdego:

| Stan | Nośnik | Dlaczego ten, a nie inny |
|------|--------|--------------------------|
| Szerokość panelu szczegółów (px) | `localStorage`, klucz `omnia.zadania.uklad` | To **geometria jednego ekranu**, nie dane użytkownika: 27" w domu i 13" laptop mają mieć różną szerokość. Kolumna w bazie oznaczałaby migrację, akcję serwerową i odczyt przy każdym renderze — dokładnie argument z `trybAdmina.tsx`. |
| Tryb pełny (wł/wył) | ten sam klucz `omnia.zadania.uklad` | Jedna preferencja układu = jeden zapis; dwa klucze na dwa pola tego samego ustawienia to drugi nośnik tej samej rzeczy. |
| Ostatnio używany projekt (widget na `/tasks`) | **nic — wyliczane na serwerze** | Da się odczytać z danych, które już są: projekt ostatnio utworzonego zadania tego użytkownika. Zapisany „ostatni projekt" byłby trzecim nośnikiem faktu, który baza i tak zna, i rozjeżdżałby się po dodaniu zadania z asystenta. |

**Świadomie NIE w adresie (`useViewState`):** stan otwartego zadania (`openTaskId`) też nie żyje dziś
w adresie — jest stanem lokalnym z wejściem przez `?task=<id>`. Wsadzenie samego `pelny` do adresu
dałoby parametr opisujący panel, którego adres nie zna, i drugi nośnik obok `localStorage`.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych akcji.** Widget na `/tasks` woła istniejące `createTask` z `src/modules/tasks/actions/tasks.ts`
— to ta sama droga zapisu, której używa dzisiejsze `QuickAddTask` i asystent AI, razem z jej guardem
(`assertProjectAccess`), `trackActivity` i `revalidatePath`. Zadanie bez wskazanego projektu ma
`projectId: null` — dokładnie jak dziś w widokach wirtualnych; skrzynka nie dostaje nowej reguły.

Jedyna zmiana po stronie serwera to **odczyt w trasie** `src/app/tasks/page.tsx`:

```ts
// paginacja: kompletny — pojedynczy rekord (findFirst), nie lista
const ostatnie = await prisma.task.findFirst({
  where: { createdById: userId, projectId: { not: null } },
  orderBy: { createdAt: "desc" },
  select: { projectId: true },
});
```
Dokładany do istniejącego `Promise.all`. `findFirst` nie podlega `check:pagination` (bramka patrzy na
`findMany`), a `createdById` istnieje na `Task` — **nie dotykamy `ownerId`/`workspaceId`**, których
`check:owner-columns` pilnuje. Wynik (`ostatniProjektId`) jedzie propem do `TasksHomePage`; gdy jest
`null` albo wskazuje projekt spoza listy dostępnych, widget startuje na „Skrzynka".

## 4. RBAC / rejestr modułu (C-22)

Bez zmian: istniejący slug `module.tasks`, istniejące trasy, istniejące wpisy w `permissions.ts`,
`modules.tsx` i `ModuleSidebar`. Bramkowanie tras Zadań (`check:route-gating`) już jest w
`src/app/tasks/layout.tsx` i nie ruszamy go. Nie powstaje nowa trasa (osobny adres zadania został
odrzucony na `/specify`), więc `src/lib/ui/view-contract.json` też zostaje bez zmian.

## 5. UI (C-30, C-31, C-32)

### 5.1. Wspólny formularz dodawania — `FormularzZadania` (zgłoszenia 1 i 4a)

Nowy komponent `src/modules/tasks/ui/FormularzZadania.tsx` — **jedna** implementacja dodawania,
używana w dwóch miejscach. Powód: obie ścieżki muszą generować tytuł z opisu tą samą regułą; dwie
kopie rozjadą się przy pierwszej poprawce (C-53, C-35 — komponent dowozimy razem z konsumentami,
a tu od razu z dwoma).

Zachowanie:
- **Zwinięty** (stan wyjściowy): jeden rząd `[priorytet] [pole tekstowe] [+]`, jak dziś — ale pole to
  `<textarea rows={1}>` z auto-dopasowaniem wysokości (wzorzec z `TaskDetail`: `ref`-callback ustawia
  `scrollHeight` **synchronicznie po zamontowaniu**, żeby nie mrugało), więc **tekst rośnie w dół,
  a nie ucieka w bok** (AC-5).
- **Enter bez modyfikatora = dodaj od ręki** (AC-7). `Shift+Enter` = nowa linia. Skrót `a`/`n` nadal
  ustawia focus w polu przez `QuickAddTaskHandle.focus()` — nie ruszamy `useKeyboardShortcuts`.
- **Rozwinięcie** przyciskiem „Więcej" (ikona `ChevronDown`, `aria-expanded`) **oraz automatycznie**,
  gdy tekst przekroczy jedną linię — bo to jest moment, w którym użytkownik zaczął pisać opis, a nie
  tytuł.
- **Rozwinięty**: `textarea` opisu zostaje polem **aktywnym (focus)** i rośnie do ~10 wierszy; pod nim
  pole **Tytuł** z `placeholder` i podpisem „Tytuł powstanie z opisu — możesz go nadpisać” (AC-6).
  Wypełniony ręcznie tytuł **wyłącza generowanie** (nie wołamy LLM). Dalej: priorytet (ten sam
  przełącznik co dziś), termin (`datetime-local`), a w wariancie strony modułu — wybór projektu.
- **Esc** zwija formularz i **nie kasuje tekstu** (AC-8); zwinięte pole dalej pokazuje wpisaną treść,
  a `Esc` przy pustym polu oddaje focus liście (jak dziś).
- Logika tytułu (`deriveLocalTitle` + `llm.tasks.suggestTitle` z cichym fallbackiem) przenosi się
  z `QuickAddTask` **bez zmiany reguł** — to nie jest moment na jej poprawianie.

Props: `projectId` (kontekst listy), `pokazWyborProjektu?`, `projekty?`, `domyslnyProjektId?`,
`onCreated(task)`. Przekazywanie `forwardRef` z `focus()` zostaje.

`src/modules/tasks/ui/QuickAddTask.tsx` staje się **cienką nakładką** nad `FormularzZadania`
(zachowuje nazwę, eksport i `QuickAddTaskHandle`), więc `TasksPage` zmienia się w tym miejscu o zero
linii — nakładka na stare API zamiast przepisywania wywołań (wzorzec C-35).

**Uwaga na klikacze:** `e2e/specs/tasks.spec.ts` szuka pola przez `getByPlaceholder(/Dodaj zadanie/)`,
a dzisiejszy tekst brzmi „Dodaj lub opisz zadanie…", więc do tego wzorca **nie pasuje**. Nowy
`placeholder` ma zaczynać się od „Dodaj zadanie” — testy zaczną trafiać w pole, zamiast dalej
mijać się z nim.

### 5.2. Widget na stronie modułu — `SzybkieDodanieZadania` (zgłoszenie 1)

Nowy `src/modules/tasks/ui/SzybkieDodanieZadania.tsx`: karta na samej górze `TasksHomePage`, **nad
kaflami** Dziś/Zaległe/Nadchodzące, renderująca `FormularzZadania` z `pokazWyborProjektu`.
Po `onCreated` robi `router.push('/tasks/<projectId>?task=<id>')` — wykorzystując **istniejące**
wejście `?task=` (`TasksRouteView` → `initialOpenTaskId`), więc nowe zadanie otwiera się od razu
w szczegółach (AC-3). Zadanie bez projektu → `/tasks/all?task=<id>`.
`TasksHomePage` dostaje dwa nowe propy (`ostatniProjektId`, i tak ma już `projects`).

### 5.3. Panel szczegółów: szerokość, uchwyt i tryb pełny (zgłoszenia 4b i 5)

`src/modules/tasks/lib/ukladSzczegolow.ts` — mały moduł odczytu/zapisu `localStorage`
(`omnia.zadania.uklad` = `{ szerokosc: number; pelny: boolean }`), **cały w `try/catch`**: prywatne
okno i zablokowany magazyn to poprawne stany, nie błędy. Odczyt **dopiero w `useEffect`** po
zamontowaniu — serwer nie zna `localStorage`, a różnica zerwałaby hydratację (to samo, co robi
`TrybAdminaProvider`). Domyślne: `szerokosc: 480`, `pelny: false`.

W `TasksPage`:
- panel desktopowy dostaje `style={{ width: pelny ? undefined : szerokosc }}` i `flex-1` w trybie
  pełnym; **szerokość jest ograniczana** do `[360, min(900, 70% szerokości okna)]`, żeby lista nigdy
  nie zniknęła przez przypadek (AC-9, AC-10);
- **uchwyt** — wąski (`w-1.5`) `div` z `onPointerDown` + `setPointerCapture` na lewej krawędzi panelu,
  `cursor: col-resize`, `role="separator"` + `aria-orientation="vertical"` i obsługa strzałek
  z klawiatury (po 16 px), bo moduł jest keyboard-first (C-31). Zapis do `localStorage` **na
  `pointerup`**, nie przy każdym ruchu;
- w trybie pełnym lista **nie jest renderowana** (`{!pelny && <TaskList …/>}`), panel traci `border-l`
  i sztywną szerokość (AC-11);
- **wszystko to jest `hidden md:flex`** — mobilny widok zadania (osobny `div` z `md:hidden`) zostaje
  bez zmian, uchwytu i przełącznika tam nie ma (AC-13, C-31: nigdy dwa panele obok siebie).

Drabinka `Esc` w `onEscape` (kolejność ma znaczenie, bo Esc zdejmuje jedną warstwę):
`tryb zaznaczania → wyniki AI → wyszukiwarka → tryb pełny → zamknięcie zadania → odznaczenie wiersza`.

### 5.4. `TaskDetail` — nagłówek i układ na szerokość (zgłoszenia 4b, 5, 2)

- Nowy prop `szeroki?: boolean` (domyślnie `false`) i `onPrzelaczSzeroki?: () => void`.
  W nagłówku panelu, **tylko od `md:` w górę**, przycisk `Maximize2`/`Minimize2` z `aria-pressed`.
- **Reflow bez duplikowania JSX**: dzisiejsze sekcje ciała (status+priorytet, cykliczne domknięcie,
  weryfikacja, tytuł, opis, daty, tagi, powtarzalność, podzadania, udostępnianie, załączniki,
  komentarze) zostają **przypisane do stałych** (`const sekcjaTytul = (…)`), a niżej składane w dwa
  warianty: wąski = dzisiejsza kolejność jeden do jednego, szeroki = siatka
  `minmax(0,1fr) 340px` — po lewej treść (tytuł, opis, podzadania, komentarze), po prawej metadane
  (status, weryfikacja, daty, tagi, powtarzalność, udostępnianie, załączniki). **Każda sekcja ma
  dokładnie jedną definicję**, więc nie powstaje drugi układ do utrzymywania, a wąski wariant jest
  sprawdzalny wzrokiem jako „bez zmian".
- **Treść potwierdzenia usunięcia** (AC-15): `confirmDialog({ title: t("usunacZadanie"),
  description: t("zadanieTrafiDoKosza", { tytul: task.title }), destructive: true })`. Ta sama
  poprawka w `TasksPage` przy usuwaniu pojedynczego zadania z listy (linia z „Usunąć zadanie?").

### 5.5. Puste okno potwierdzenia — poprawka wspólna (zgłoszenie 2, AC-16)

`src/components/ui/Modal.tsx` renderuje ciało **bezwarunkowo**:
`<div className="flex-1 overflow-y-auto px-5 py-4" …>{children}</div>`. Gdy `ConfirmDialog` nie dostał
`description`, `children` jest `false` — zostaje pusty, rozciągnięty `flex-1` z 32 px wypełnienia.
To jest ta „pusta luka”. Poprawka: renderuj ciało tylko gdy `children` niesie treść
(`children != null && children !== false`). Zmiana dotyczy jednego pliku i wszystkich okien naraz —
dlatego jest robiona tutaj, a nie obchodzona w Zadaniach.

### 5.6. Trwały tryb zaznaczania (zgłoszenie 3)

W `TasksPage` dzisiejsze `finishSelection(msg)` robi **dwie rzeczy naraz** (czyści zaznaczenie
i wychodzi z trybu) i jest wołane w sześciu miejscach — stąd błąd. Rozdzielamy na dwie funkcje
o jawnych nazwach:

| Funkcja | Co robi | Gdzie wołana |
|---|---|---|
| `wyczyscZaznaczenie(msg)` | zeruje `selectedIds` i kotwicę, pokazuje komunikat, **zostawia `selectionMode`** | po `applyBulk`, po `deleteBulk`, `onClear` w `BulkActionBar` |
| `zakonczZaznaczanie()` | dodatkowo `setSelectionMode(false)` | przycisk trybu w pasku akcji, `Esc`, zmiana układu na Kanban/Oś czasu |

To realizuje AC-17 i AC-18 (tryb zostaje, można zaznaczać dalej), AC-19 (wyjście wyłącznie jawne)
i AC-20 (licznik zeruje się, bo zaznaczenie jest czyszczone, więc nie może wskazywać usuniętych
zadań). Przycisk trybu i tak już przełącza w obie strony — zachowanie sprawdzane przez istniejący
klikacz `[080-AC1]` zostaje nienaruszone.

Ponieważ `BulkActionBar` znika przy pustym zaznaczeniu, ikona `CheckSquare` w pasku akcji **zostaje
podświetlona** (`--accent-blue`) tak długo, jak tryb jest włączony — to jedyny widoczny sygnał, że
tryb trwa, i jednocześnie wyjście z niego.

### 5.7. Teksty (C-32)

Wszystkie nowe napisy do `messages/pl.json`, w namespace'ach wywiedzionych ze ścieżki:
`modules.tasks.FormularzZadania`, `modules.tasks.SzybkieDodanieZadania`, plus dopisy do
`modules.tasks.TaskDetail` i `modules.tasks.TasksPage`. Zero literałów z polskimi znakami
w komponentach — `check:i18n` jest regułą bezwzględną (097), a bramka sprawdza też, czy każde
`t("klucz")` ma wpis.

### 5.8. Motyw (C-30)

Nowe elementy (karta widgetu, uchwyt szerokości, przycisk trybu pełnego, siatka szerokiego układu)
wyłącznie na `var(--bg-surface)`, `var(--bg-elevated)`, `var(--border)`, `var(--accent-blue)`,
`var(--on-accent)`. Żadnych hexów.

## 6. AI / integracje

**Nie dotyczy.** Nie powstaje nowa `AIAction` ani read-tool, więc `check:actions`, `check:ai-coverage`
i `check:cost-badge` nie mają nowego wejścia. `llm.tasks.suggestTitle` jest **przeniesione, nie
dodane** — plik z wywołaniem LLM się zmienia (`QuickAddTask` → `FormularzZadania`), więc trzeba
sprawdzić, czy `src/lib/ai/content-memory-coverage.json` i `cost-badge-coverage.json` nie trzymają
wpisu pod starą ścieżką; jeśli tak — **przenieść wpis**, nie tworzyć drugiego. Kalendarz,
powiadomienia i Kosz: bez zmian (usunięcie zadania nadal idzie do Kosza — nowa treść okna właśnie
o tym mówi).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/modules/tasks/ui/FormularzZadania.tsx` | nowy | Rozwijany formularz dodawania (rosnące pole, opis w focusie, tytuł z adnotacją, priorytet/termin/projekt) — AC-5..AC-8 |
| `src/modules/tasks/ui/QuickAddTask.tsx` | edycja | Cienka nakładka nad `FormularzZadania`; zachowuje eksport i `QuickAddTaskHandle` |
| `src/modules/tasks/ui/SzybkieDodanieZadania.tsx` | nowy | Widget na stronie modułu + przejście do utworzonego zadania — AC-1..AC-4 |
| `src/modules/tasks/ui/TasksHomePage.tsx` | edycja | Osadzenie widgetu nad kaflami; prop `ostatniProjektId` |
| `src/app/tasks/page.tsx` | edycja | Odczyt ostatnio używanego projektu (`findFirst`) |
| `src/modules/tasks/lib/ukladSzczegolow.ts` | nowy | Odczyt/zapis preferencji układu panelu (`localStorage`, `try/catch`) |
| `src/modules/tasks/ui/TasksPage.tsx` | edycja | Szerokość panelu + uchwyt + tryb pełny; rozdzielenie `finishSelection`; drabinka `Esc`; treść potwierdzenia — AC-9..AC-14, AC-17..AC-20 |
| `src/modules/tasks/ui/TaskDetail.tsx` | edycja | Przełącznik trybu pełnego, dwukolumnowy układ na szerokość, treść okna usunięcia — AC-11, AC-15 |
| `src/components/ui/Modal.tsx` | edycja | Nie renderuj pustego ciała okna — AC-16 |
| `messages/pl.json` | edycja | Nowe teksty (C-32) |
| `e2e/specs/tasks-ux.spec.ts` | edycja | Klikacze dla trwałego trybu zaznaczania i rosnącego pola dodawania |
| `doświadczenia.md` | edycja | Wpisy dla dwóch naprawionych błędów (C-51) |

## 8. Bramki i weryfikacja (C-50)

Lokalnie, **nigdy z prod `DATABASE_URL`** (C-13): lokalny Postgres 16 (`pg_ctlcluster 16 main start`),
`.env.local` na `127.0.0.1:5432`, `npx prisma migrate deploy` (nowych migracji nie ma, więc to tylko
postawienie bazy pod build i klikacze). Weryfikujemy **do kroku `next build`** włącznie —
`scripts/migrate.js` pomijamy.

Bramki, które ta zmiana realnie dotyka: `check:i18n` (nowe teksty), `check:ui-contract` (brak hexów,
`ModuleView` ze `state` — bez zmian), `check:client-safe`, `check:tailwind` (klasy w `src/modules` są
pokryte od 098), `check:e2e-waits` (żadnego `networkidle` w nowych testach), `next lint`, `tsc`.

Mapowanie kryteriów akceptacji na sposób sprawdzenia:

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1, AC-2, AC-4 | Klikacz + oględziny `/tasks`: widget nad kaflami, wybrany projekt widoczny przed zapisem, konto bez projektów dodaje do skrzynki |
| AC-3 | Klikacz: po zapisie adres pasuje do `/tasks/<id>?task=<id>` i panel szczegółów jest widoczny |
| AC-5 | Klikacz (wzorzec istniejącego `[ux-AC23]`): `scrollHeight ≈ clientHeight` pola po wpisaniu długiego tekstu — brak wewnętrznego przewijania |
| AC-6 | Oględziny: opis ma focus po rozwinięciu, pole tytułu z podpisem; ręczny tytuł nie wywołuje LLM (brak żądania w sieci) |
| AC-7 | Klikacz: `Enter` w zwiniętym polu tworzy zadanie (istniejący `[scenario-tasks-add-quick]` zaczyna trafiać w pole po zmianie `placeholder`) |
| AC-8 | Oględziny: `Esc` zwija, tekst zostaje |
| AC-9, AC-10 | Klikacz: szerokość panelu > 380 px; po przeciągnięciu i przeładowaniu strony ta sama szerokość |
| AC-11, AC-12, AC-12a | Klikacz: po przełączeniu `TaskList` znika z drzewa, panel zajmuje pełną szerokość; ponowne przełączenie i `Esc` wracają do listy; wartość przeżywa przeładowanie |
| AC-13 | Klikacz w wariancie mobilnym: brak przełącznika i uchwytu, jeden panel na ekranie |
| AC-14 | Klikacz: `j`/`k` przy otwartym zadaniu w trybie panelu (rozszerzenie istniejącego `[scenario-tasks-nav-jk]`) |
| AC-15 | Oględziny: okno usunięcia zadania ma tytuł **i** treść z nazwą zadania oraz wzmianką o Koszu |
| AC-16 | Oględziny + klikacz: okno potwierdzenia bez opisu nie ma pustego obszaru (wysokość okna spada) |
| AC-17..AC-20 | Klikacz: po akcji masowej `button[aria-label="Zaznacz zadanie"]` **nadal jest w drzewie**, licznik = 0, kolejna akcja masowa wykonalna bez klikania ikony trybu; `Esc` chowa kolumnę |

Klikacze uruchamiamy sposobem z `CLAUDE.md` dla sesji zdalnej:
`nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &`.

## 9. Ryzyka techniczne i plan wycofania

- **Rozbicie `TaskDetail` na stałe sekcje to 500 linii przenoszenia JSX.** Najłatwiej tu o cichą
  zgubę sekcji. Mitygacja: przenosimy **mechanicznie**, sekcja po sekcji, wariant wąski składamy
  w dokładnie dzisiejszej kolejności i porównujemy listę sekcji przed i po (12 pozycji).
- **Rozjazd hydratacji przy `localStorage`.** Odczyt tylko w `useEffect`, pierwszy render zawsze
  z domyślnymi — inaczej powtórzymy błąd opisany w `doświadczenia.md` (2026-08-02).
- **`textarea` zamiast `input` psuje `Enter`.** Domyślnie `Enter` wstawia nową linię. Mitygacja:
  jawny `onKeyDown` (Enter bez `Shift` → `submit` + `preventDefault`), a AC-7 jest kryterium
  blokującym w `/verify`.
- **Uchwyt przeciągania kontra przewijanie na dotyku.** Uchwyt istnieje wyłącznie od `md:` w górę,
  więc na telefonie nie ma czego przechwycić.
- **Zmiana `Modal` dotyka wszystkich okien.** Zmiana jest zawężająca (mniej DOM przy pustym ciele),
  ale przechodzimy wzrokiem po oknach z ciałem, żeby `flex-1` nie zniknął tam, gdzie jest potrzebny.
- **Regres w widoku wielu projektów / Kanbanie.** Tryb pełny i zaznaczanie dotyczą tylko
  `layout === "list"`; przy zmianie układu wołamy `zakonczZaznaczanie()`.

**Wycofanie:** zmiana jest wyłącznie kodem — brak migracji, brak danych do odkręcania. Rollback =
`git revert` scalenia do `develop`; klucz `omnia.zadania.uklad` zostaje w przeglądarkach jako
nieodczytywany śmieć i nikomu nie szkodzi.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14 (migracje)** — bez zmian w schemacie, bez migracji; napisane wprost w §2.
- [x] **C-20** — mutacja idzie istniejącą Server Action `createTask` z jej `revalidatePath`.
- [x] **C-21/C-17** — bez zmian w dostępie; korzystamy z `assertProjectAccess` wewnątrz `createTask`.
- [x] **C-22** — istniejący slug `module.tasks`, brak nowych tras i wpisów w rejestrze.
- [x] **C-23/C-40** — brak nowych `AIAction` i read-toolów; przeniesienie wywołania LLM sprawdzone
      wobec manifestów pokrycia.
- [x] **C-24** — usuwanie zadania nadal przez Kosz; okno potwierdzenia zaczyna to mówić.
- [x] **C-30** — wyłącznie zmienne CSS.
- [x] **C-31** — mobilny widok nietknięty, uchwyt i tryb pełny tylko od `md:`; `Enter`, `a/n`, `j/k`
      i `Esc` zachowane.
- [x] **C-32** — nowe teksty w `messages/pl.json`, polski jako źródło.
- [x] **C-33** — tryb pełny mieści się **wewnątrz** `layout="fill"`; kontrakt widoku nietknięty,
      brak wyjątku w module.
- [x] **C-34** — potwierdzenia dalej przez `confirmDialog`, `destructive` deklarowane jawnie,
      dochodzi brakująca treść.
- [x] **C-35** — `FormularzZadania` powstaje **z dwoma konsumentami**; `QuickAddTask` zostaje jako
      cienka nakładka na stare API zamiast przepisywania wywołań.
- [x] **C-51** — wpisy do `doświadczenia.md` dla pustego okna i wyłączającego się trybu zaznaczania.
- [x] **C-53 (minimalizm)** — zero nowych zależności, zero nowych tabel, zero nowych tras, zero
      nowych akcji; nowe pliki: dwa komponenty i jeden mały helper.
