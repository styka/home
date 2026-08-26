# Zadania: Moduł Zadania — UX tworzenia i przeglądania zadań

- **Plan:** ./plan.md (105-zadania-ux-tworzenia-i-widoku)
- **Status:** todo
- **Data:** 2026-08-26

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie jest małe, samodzielne i weryfikowalne. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatki)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych

**Nie dotyczy.** Plan §2: bez zmian w `schema.prisma`, bez migracji, bez nowych Server Actions.
`npm run check:migrations` i `check:schema-drift` nie mają nowego wejścia — nic tu nie robimy
i to jest świadome, nie przeoczone.

## Faza 1 — Poprawki punktowe (najtańsze, niezależne od reszty)

- [x] **T-1** — **Puste ciało okna potwierdzenia** (`src/components/ui/Modal.tsx`).
  Ciało (`<div className="flex-1 overflow-y-auto px-5 py-4">`) renderuj tylko, gdy `children` niesie
  treść (`children != null && children !== false`). Bez zmian w `ConfirmDialog`/`ConfirmProvider`.
  *Gotowe, gdy:* okno `confirmDialog({ title, destructive: true })` bez `description` nie ma pustego
  obszaru między nagłówkiem a stopką, a okna z treścią wyglądają jak dotąd. **[AC-16]**

- [x] **T-2** `[P]` — **Treść potwierdzenia usunięcia zadania.**
  `TaskDetail.tsx` (linia z „Usunąć zadanie?") i `TasksPage.tsx` (usuwanie pojedynczego zadania
  z listy) dostają `description` z tytułem zadania i wzmianką o Koszu; teksty przez `t()`
  (`messages/pl.json`). `destructive: true` zostaje.
  *Gotowe, gdy:* okno mówi, KTÓRE zadanie usuwam i gdzie trafi. **[AC-15]**

- [x] **T-3** `[P]` — **Odczyt ostatnio używanego projektu** (`src/app/tasks/page.tsx`).
  `prisma.task.findFirst({ where: { createdById: userId, projectId: { not: null } }, orderBy:
  { createdAt: "desc" }, select: { projectId: true } })` dołożone do istniejącego `Promise.all`;
  wynik jako prop `ostatniProjektId` do `TasksHomePage`. Bez `ownerId`/`workspaceId`
  (`check:owner-columns`), bez `findMany` (`check:pagination`).
  *Gotowe, gdy:* `TasksHomePage` dostaje id projektu albo `null`, a strona `/tasks` renderuje się
  jak dotąd. **[AC-2]**

## Faza 2 — Trwały tryb zaznaczania

- [x] **T-4** — **Rozdzielenie `finishSelection`** (`src/modules/tasks/ui/TasksPage.tsx`).
  Dwie funkcje zamiast jednej: `wyczyscZaznaczenie(msg)` (zeruje `selectedIds` + kotwicę, pokazuje
  komunikat, **zostawia `selectionMode`**) i `zakonczZaznaczanie()` (dodatkowo gasi tryb).
  Podmiana w sześciu wywołaniach wg tabeli z planu §5.6: `applyBulk`, `deleteBulk` i `onClear`
  paska → czyszczenie; przycisk trybu, `Esc` i zmiana układu → zakończenie.
  *Gotowe, gdy:* po akcji masowej checkboxy **są nadal w drzewie**, licznik = 0, a `Esc`/przycisk
  trybu je chowają. **[AC-17, AC-18, AC-19, AC-20]**

## Faza 3 — Formularz dodawania zadania

- [x] **T-5** — **`FormularzZadania`** (nowy `src/modules/tasks/ui/FormularzZadania.tsx`).
  Stan zwinięty = dzisiejszy rząd `[priorytet][pole][+]`, ale pole to `textarea rows={1}`
  z auto-dopasowaniem wysokości (ref-callback, synchronicznie po zamontowaniu — wzorzec
  z `TaskDetail`). `Enter` bez modyfikatora = zapis (`preventDefault`), `Shift+Enter` = nowa linia.
  Rozwinięcie przyciskiem „Więcej" (`aria-expanded`) **oraz** automatycznie, gdy tekst przekroczy
  jedną linię. Rozwinięty: opis w focusie, pole tytułu z podpisem o generowaniu (ręczny tytuł
  **wyłącza** wywołanie LLM), priorytet, termin, opcjonalnie wybór projektu. `Esc` zwija bez
  kasowania tekstu. Logika tytułu (`deriveLocalTitle` + `llm.tasks.suggestTitle` z cichym
  fallbackiem) **przeniesiona bez zmiany reguł**. `placeholder` zaczyna się od „Dodaj zadanie".
  Props: `projectId`, `pokazWyborProjektu?`, `projekty?`, `domyslnyProjektId?`, `onCreated`,
  `forwardRef` z `focus()`.
  *Gotowe, gdy:* komponent kompiluje się i realizuje AC-5..AC-8 w izolacji. **[AC-5, AC-6, AC-7, AC-8]**

- [x] **T-6** — **`QuickAddTask` jako cienka nakładka** (`src/modules/tasks/ui/QuickAddTask.tsx`).
  Zachowuje nazwę pliku, eksport i typ `QuickAddTaskHandle`; w środku renderuje `FormularzZadania`.
  *Gotowe, gdy:* `TasksPage` **nie zmienia się w tym miejscu ani o linię**, skrót `a`/`n` nadal
  ustawia focus, a dodawanie w projekcie działa jak przed zmianą (plus rosnące pole). **[AC-5, AC-7]**

- [x] **T-7** — **Widget na stronie modułu** (nowy `src/modules/tasks/ui/SzybkieDodanieZadania.tsx`
  + edycja `TasksHomePage.tsx`). Karta **nad kaflami** Dziś/Zaległe/Nadchodzące z `FormularzZadania`
  i `pokazWyborProjektu`; domyślny projekt = `ostatniProjektId`, a gdy `null` albo poza listą
  dostępnych — „Skrzynka". Po `onCreated`: `router.push('/tasks/<projectId>?task=<id>')`
  (zadanie bez projektu → `/tasks/all?task=<id>`), czyli **istniejące** wejście `?task=`.
  *Gotowe, gdy:* z `/tasks` da się utworzyć zadanie bez wchodzenia w projekt i lądujemy w nim
  z otwartymi szczegółami; konto bez projektów też dodaje. **[AC-1, AC-2, AC-3, AC-4]**

## Faza 4 — Widok szczegółów zadania

- [x] **T-8** — **Preferencja układu panelu** (nowy `src/modules/tasks/lib/ukladSzczegolow.ts`).
  Odczyt/zapis `localStorage` pod kluczem `omnia.zadania.uklad`
  (`{ szerokosc: number; pelny: boolean }`), całość w `try/catch`, domyślne `{ 480, false }`.
  *Gotowe, gdy:* helper zwraca domyślne przy zablokowanym magazynie i nie rzuca. **[AC-10, AC-12a]**

- [x] **T-9** — **`TaskDetail`: sekcje jako stałe + układ na szerokość**
  (`src/modules/tasks/ui/TaskDetail.tsx`). Dwanaście sekcji ciała przypisanych do stałych
  (`const sekcjaTytul = (…)`), złożonych w dwa warianty: wąski = **dzisiejsza kolejność jeden do
  jednego**, szeroki (`szeroki === true`) = siatka `minmax(0,1fr) 340px` — lewa kolumna treść
  (tytuł, opis, podzadania, komentarze), prawa metadane (status, weryfikacja, daty, tagi,
  powtarzalność, udostępnianie, załączniki). Nowe propy `szeroki?`, `onPrzelaczSzeroki?`;
  przycisk `Maximize2`/`Minimize2` w nagłówku **tylko od `md:`**, z `aria-pressed`.
  Przenoszenie **mechaniczne** — lista sekcji przed i po musi mieć te same 12 pozycji.
  *Gotowe, gdy:* wąski panel wygląda identycznie jak przed zmianą, a szeroki rozkłada treść
  na dwie kolumny. **[AC-11]**

- [x] **T-10** — **`TasksPage`: szerokość, uchwyt, tryb pełny** (`src/modules/tasks/ui/TasksPage.tsx`).
  Panel desktopowy bierze szerokość z T-8 (ograniczenie `[360, min(900, 70vw)]`); uchwyt na lewej
  krawędzi (`onPointerDown` + `setPointerCapture`, `cursor: col-resize`, `role="separator"`,
  `aria-orientation="vertical"`, strzałki co 16 px — moduł jest keyboard-first), zapis **na
  `pointerup`**, nie przy każdym ruchu. W trybie pełnym `TaskList` **nie jest renderowana**, panel
  traci `border-l` i sztywną szerokość. Całość `hidden md:flex` — mobilny `md:hidden` panel bez
  zmian. Drabinka `Esc`: zaznaczanie → wyniki AI → wyszukiwarka → **tryb pełny** → zamknięcie
  zadania → odznaczenie wiersza.
  *Gotowe, gdy:* panel jest wyraźnie szerszy niż 380 px, da się go przeciągnąć, szerokość i tryb
  przeżywają przeładowanie, `j/k` działa jak dotąd, a na wąskim ekranie nie ma ani uchwytu, ani
  przełącznika. **[AC-9, AC-10, AC-11, AC-12, AC-12a, AC-13, AC-14]**

## Faza 5 — Teksty, manifesty, klikacze

- [x] **T-11** — **Teksty do `messages/pl.json`** (C-32): namespace'y
  `modules.tasks.FormularzZadania`, `modules.tasks.SzybkieDodanieZadania` + dopisy do
  `modules.tasks.TaskDetail` i `modules.tasks.TasksPage`. Zero literałów z polskimi znakami
  w komponentach.
  *Gotowe, gdy:* `npm run check:i18n` przechodzi (bramka sprawdza też, czy każde `t("klucz")`
  ma wpis).

- [x] **T-12** `[P]` — **Manifesty pokrycia AI po przeniesieniu wywołania LLM.**
  Wywołanie `llm.tasks.suggestTitle` przenosi się z `QuickAddTask.tsx` do `FormularzZadania.tsx`.
  Sprawdź `src/lib/ai/content-memory-coverage.json` i `src/lib/ai/cost-badge-coverage.json` — jeśli
  trzymają wpis pod starą ścieżką, **przenieś go**, nie twórz drugiego.
  *Gotowe, gdy:* `npm run check:content-memory` i `npm run check:cost-badge` przechodzą.

- [x] **T-13** — **Klikacze** (`e2e/specs/tasks-ux.spec.ts`): (a) po akcji masowej kolumna
  zaznaczeń **zostaje** i da się wykonać kolejną akcję bez klikania ikony trybu; (b) pole dodawania
  rośnie bez wewnętrznego przewijania (wzorzec istniejącego `[ux-AC23]`: `scrollHeight ≈
  clientHeight`); (c) tryb pełny chowa listę i przeżywa przeładowanie. **Żadnego `networkidle`**
  (`check:e2e-waits`) — czekamy na `"load"` albo na konkretny element.
  *Gotowe, gdy:* nowe testy przechodzą, a istniejące `[080-AC1]`, `[scenario-tasks-add-quick]`
  i `[scenario-tasks-nav-jk]` **nadal** przechodzą.

## Faza 6 — Bramki i domknięcie

- [x] **T-14** — **Bramki lokalnie** (C-13: lokalny Postgres, **nigdy prod `DATABASE_URL`**).
  `pg_ctlcluster 16 main start`, `.env.local` na `127.0.0.1:5432`, `npx prisma migrate deploy`,
  następnie `npm run check:i18n`, `check:ui-contract`, `check:client-safe`, `check:tailwind`,
  `check:e2e-waits`, `check:owner-columns`, `check:pagination`, `tsc --noEmit -p tsconfig.test.json`,
  `next lint --dir src`, `next build`. **Krok `scripts/migrate.js` pomijamy.**
  *Gotowe, gdy:* wszystko zielone do `next build` włącznie.

- [~] **T-15** — **Uruchomienie klikaczy**:
  `nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &`, potem `tail -40 /tmp/e2e.log`.
  *Gotowe, gdy:* suite przechodzi albo każdy czerwony test ma ustaloną przyczynę niezwiązaną
  z tą zmianą.

- [ ] **T-16** — **Mapowanie AC → wynik** (wejście do `/verify`): dla każdego z 21 kryteriów
  (AC-1..AC-20 + AC-12a) zapisz, czym zostało potwierdzone (klikacz / oględziny / kod).

- [x] **T-17** — **Wpisy do `doświadczenia.md`** (C-51, po polsku, format `## YYYY-MM-DD — tytuł`):
  (a) puste okno potwierdzenia — ciało modalu renderowane bezwarunkowo z `flex-1` i wypełnieniem,
  więc brak `description` daje rozciągniętą lukę; (b) `finishSelection` robiło dwie rzeczy naraz
  i było wołane w sześciu miejscach, więc „wyczyść zaznaczenie" zawsze znaczyło też „wyjdź z trybu".

## Mapowanie kryteriów akceptacji

| AC | Zadanie(a) |
|----|------------|
| AC-1 | T-7 |
| AC-2 | T-3, T-7 |
| AC-3 | T-7 |
| AC-4 | T-7 |
| AC-5 | T-5, T-6 |
| AC-6 | T-5 |
| AC-7 | T-5, T-6 |
| AC-8 | T-5 |
| AC-9 | T-10 |
| AC-10 | T-8, T-10 |
| AC-11 | T-9, T-10 |
| AC-12 | T-10 |
| AC-12a | T-8, T-10 |
| AC-13 | T-10 |
| AC-14 | T-10 |
| AC-15 | T-2 |
| AC-16 | T-1 |
| AC-17 | T-4 |
| AC-18 | T-4 |
| AC-19 | T-4 |
| AC-20 | T-4 |

Żadne kryterium nie zostaje bez zadania.

## Ścieżka krytyczna

```
T-5 (FormularzZadania) ──> T-6 (nakładka QuickAddTask) ──┐
                       └─> T-7 (widget /tasks) <── T-3   ├─> T-11 (teksty) ─> T-14 ─> T-15 ─> T-16 ─> T-17
T-8 (preferencja) ─────> T-10 (panel) <── T-9 (TaskDetail)┘
T-1, T-2, T-4, T-12 — niezależne, wchodzą w dowolnym momencie przed T-14
```

- **T-5 blokuje T-6 i T-7** — oba są jego konsumentami (C-35: komponent dowozimy z konsumentami).
- **T-8 i T-9 blokują T-10** — panel potrzebuje i preferencji, i przełącznika w `TaskDetail`.
- **T-11 zbiera teksty ze wszystkich zadań UI**, więc idzie po nich, nie równolegle.
- **T-14 blokuje T-15** — klikacze `scripts/e2e-web.sh` budują aplikację (098), więc build musi
  być zielony wcześniej.

## Notatki / blokady

- **Największe ryzyko to T-9** — przeniesienie ~500 linii JSX do stałych. Kontrola: lista 12 sekcji
  przed i po zmianie musi się zgadzać co do sztuki.
- **T-6 jest sprawdzianem T-5**: jeśli `TasksPage` musi się zmienić, żeby nakładka zadziałała, to
  znaczy, że `FormularzZadania` ma złe API — poprawiamy komponent, nie wywołanie.
- **T-1 dotyka wszystkich okien w aplikacji** — przy T-14 przejść wzrokiem po kilku modalach
  z treścią, czy `flex-1` nie zniknął tam, gdzie jest potrzebny.
