# Zadania: Filtry w widokach Kanban/Timeline + kompaktowy pasek „Dostosuj pulpit”

- **Plan:** ./plan.md (001-filtry-widokow-i-pasek-pulpitu)
- **Status:** todo
- **Data:** 2026-07-15

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie małe, samodzielne i weryfikowalne. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`.
> `[P]` = można zrównoleglić (niezależne pliki/moduły).

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
- **Nie dotyczy.** Bez zmian w `schema.prisma` i bez migracji (plan §2). `npm run check:migrations`
  ma przejść bez nowego wpisu — sprawdzane w T-4.

## Faza 1 — Warstwa serwera / RBAC
- **Nie dotyczy.** Bez nowych i bez zmian w Server Actions, bez zmian RBAC (plan §3–§4). Personalizacja
  pulpitu używa istniejącej `setDashboardPrefs` bez modyfikacji.

## Faza 2 — UI

### Poprawka A — filtry w Kanban i Timeline (moduł Tasks)
- [x] **T-1** `[P]` — **`TaskFilters.tsx`: prop `showStatusTabs?: boolean` (default `true`).**
  Gdy `false` — nie renderuj kontenera zakładek statusu (wiersz `filters.map`); wiersz tagów bez
  zmian. Gdy `!showStatusTabs && allTags.length === 0` → `return null` (bez pustego paska 38px).
  Domyślne zachowanie (Lista/Timeline) identyczne jak dziś. Tylko zmienne CSS, teksty PL (C-30, C-32).
  **Gotowe, gdy:** komponent kompiluje się; wywołania bez nowego propu działają jak wcześniej; z
  `showStatusTabs={false}` znika wyłącznie wiersz zakładek.

- [x] **T-2** — **`TasksPage.tsx`: przekazanie filtrowanych zbiorów do Kanbana/Timeline + ukrycie
  zakładek w Kanbanie.** (zależy od T-1 — używa nowego propu). Wg planu §5A:
  - dodaj helper `applyTags(list)` (AND po `selectedTagIds`, 1:1 z `TaskList.applyTagFilter`);
  - `kanbanTasks = useMemo(() => applyTags(displayedTasks), [displayedTasks, selectedTagIds])`
    (wszystkie statusy — kolumny; bez filtra zakładki);
  - `timelineTasks = useMemo(...)` — `ALL` → wszystkie statusy; inny status → `t.status === activeFilter`;
    plus `applyTags`;
  - render: `KanbanBoard tasks={kanbanTasks}`, `TimelineView tasks={timelineTasks}` (Lista bez zmian);
  - `<TaskFilters … showStatusTabs={layout !== "kanban"} />`;
  - `visibleTasks` (clipboard) **bez zmian** — krótki komentarz, że to inny cel.
  `KanbanBoard.tsx`/`TimelineView.tsx` **bez zmian**.
  **Gotowe, gdy:** w Kanbanie zaznaczenie tagu zawęża karty; w Timeline zakładka statusu i tagi
  zawężają oś czasu; Lista działa jak dotąd; w Kanbanie nie ma wiersza zakładek statusu.

### Poprawka B — kompaktowy pasek „Dostosuj pulpit” (moduł Home)
- [ ] **T-3** `[P]` — **`HomePage.tsx`: usuń pełnowierszowy pasek, dodaj ikonkę-przełącznik w wierszu
  powitania.** Wg planu §5B:
  - usuń `<div style={{ justifyContent:"flex-end", marginTop:-4 }}>…</div>` (obecny pasek);
  - w wierszu powitania (logo + `h1` + Beta) dodaj przycisk `marginLeft:"auto"`, ikona
    `SlidersHorizontal` (normalny) / `Check` (edycja), `onClick={() => setEditing(v => !v)}`;
  - tryb edycji odróżnialny: akcent (`var(--bg-elevated)` + `var(--accent-blue)`) + etykieta „Gotowe”;
    normalny = sama ikona, tekst „Dostosuj pulpit” w `title`/`aria-label`;
  - cel dotyku ≥ ~32×32 px; tylko zmienne CSS; `aria-label` PL (C-30, C-31, C-32);
  - logika `editing`/`moveSection`/`toggleHidden`/`persist` i kontrolki sekcji — **bez zmian**.
  **Gotowe, gdy:** „Dostosuj pulpit” nie ma osobnej linijki; ikona wchodzi/wychodzi z trybu edycji;
  personalizacja sekcji działa; kontrolka widoczna i klikalna na mobile.

## Faza 3 — AI / integracje
- **Nie dotyczy.** Brak nowej `AIAction`, read-toola, wpięć w kalendarz/powiadomienia (plan §6).
  `npm run check:actions` ma przejść bez zmian — sprawdzane w T-4.

## Faza 4 — Bramki i domknięcie
- [ ] **T-4** — **Bramki lokalnie (C-13, C-50).** Lokalny Postgres + `export DATABASE_URL`/`DIRECT_URL`
  (127.0.0.1:5432), `npx prisma migrate deploy` (tylko aplikuje istniejące). Następnie:
  `npm run check:migrations`, `npm run check:actions`, `npx next lint`, `npx next build` — wszystko
  zielone. **Nie** odpalać pełnego `npm run build` (kończy się `migrate.js` → prod DB).
  **Gotowe, gdy:** `next build` przechodzi, brak nowych ostrzeżeń lint.
- [ ] **T-5** — **Mapowanie AC → wynik** (input do `/verify`): ręczny przegląd na dev serverze
  (`/tasks/<projekt z tagami>` w 3 układach; `/` w trybie normalnym i edycji, także wąski viewport).
  Odhaczyć każde AC-1..AC-10 z sekcją „jak sprawdzono” (plan §8).
- [ ] **T-6** — **`doświadczenia.md`: lekcja o bugu filtrów** (C-51). Problem: Kanban/Timeline dostawały
  `displayedTasks` (tylko wyszukiwanie), filtry status/tag żyły wyłącznie w `TaskList`. Rozwiązanie:
  policzyć zbiory w `TasksPage` i przekazać; w Kanbanie ukryć zakładki statusu (kolumny = statusy).
  Lekcja: przy wielu układach tego samego zbioru — filtruj **przed** rozgałęzieniem na widoki, nie w
  jednym z nich.

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadanie(a) | Sposób weryfikacji (T-5) |
|----|-----------|--------------------------|
| AC-1 (Kanban: tagi) | T-2 | zaznacz tag w Kanbanie → tylko zadania z tagiem |
| AC-2 (Timeline: tagi AND) | T-2 | ≥2 tagi → tylko zadania z wszystkimi |
| AC-3 (zakładki zmieniają widok) | T-1, T-2 | Timeline: zakładka statusu zawęża; Kanban: zakładki ukryte (Q1=b) |
| AC-4 (spójny zbiór między układami) | T-2 | Lista↔Timeline: ten sam status+tagi = ten sam zbiór; Kanban celowo pokazuje wszystkie kolumny (interpretacja w planie §8) |
| AC-5 (wyszukiwanie + filtry) | T-2 | zapytanie w Kanbanie/Timeline łączy się z filtrem tagów; brak regresji |
| AC-6 (brak osobnego wiersza) | T-3 | tryb normalny — „Dostosuj pulpit” bez własnej linijki |
| AC-7 (pełna funkcja edycji) | T-3 | wejście/wyjście z edycji; kolejność/ukrywanie zapisane |
| AC-8 (edycja odróżnialna) | T-3 | tryb edycji akcentowany + „Gotowe” |
| AC-9 (mobile) | T-3 | wąski viewport — ikona widoczna, klikalna, cel dotyku ≥ ~32 px |
| AC-10 (skiny) | T-3 | zmiana skórki — kolory ze zmiennych CSS, brak hardkodu |

## Notatki / blokady
- Ścieżka krytyczna: **T-1 → T-2** (poprawka A). **T-3** (poprawka B) niezależna, równolegle.
  Obie → **T-4** (build) → **T-5** (AC) → **T-6** (lekcja).
- Q1 przyjęte jako wariant (b) (pre-autoryzacja w specu); Q2 = ikonka w wierszu powitania. Zmiana
  decyzji przed `/implement` jest tania (lokalna do T-1/T-2 lub T-3).
