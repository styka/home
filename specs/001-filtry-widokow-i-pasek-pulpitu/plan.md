# Plan techniczny: Filtry w widokach Kanban/Timeline + kompaktowy pasek „Dostosuj pulpit”

- **Spec:** ./spec.md (001-filtry-widokow-i-pasek-pulpitu)
- **Status:** draft
- **Data:** 2026-07-15

> **Zasada planu:** to jest **JAK**. Plan pisany pod istniejący kod modułów Tasks i Home. Obie
> poprawki są **czysto po stronie klienta** (prezentacja) — zero zmian w schemacie, Server Actions,
> RBAC i asystencie AI.

## 1. Podejście (2–4 zdania)

Dwie niezależne, minimalne poprawki UI (C-53), każda naśladująca istniejący wzorzec swojego modułu.
**(A)** Błąd filtrowania: `TasksPage` filtruje zadania **tylko** dla układu Lista (przez `TaskList`,
który sam stosuje status+tagi), a do `KanbanBoard`/`TimelineView` wpuszcza surowe `displayedTasks`
(same wyniki wyszukiwania). Rozwiązanie: policzyć w `TasksPage` te same zbiory filtrowane co
`TaskList.applyTagFilter`/`applyStatusFilter` i przekazać je do Kanbana/Timeline; w Kanbanie
(kolumny = statusy) ukryć zakładki statusu (decyzja **Q1 = wariant b**, przyjęta zgodnie z pre-autoryzacją
w specu). **(B)** UX pulpitu: usunąć osobny, pełnowierszowy `<div>` z przyciskiem „Dostosuj pulpit”
i przenieść wejście w edycję do **ikonki w wierszu powitania** (Q2 = rekomendacja ze speca), bez
zmiany logiki personalizacji (`dashboardPrefs`).

Wzorce do naśladowania: `TaskList.tsx` (dokładna semantyka filtrów), istniejące przyciski-ikonki w
nagłówku `TasksPage.tsx` (styl przycisku ikonowego przez zmienne CSS), istniejący stan `editing` w
`HomePage.tsx`.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Brak nowych modeli/kolumn, brak migracji (C-10..C-12 nie dotyczą). Feature
operuje na już pobranych, autoryzowanych danych (`Task[]`, `TaskTagDef[]`) i istniejącej personalizacji
pulpitu (`DashboardPref`, przez `dashboardPrefs`). `npm run check:migrations` przejdzie bez nowego wpisu.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych i bez zmian w Server Actions.** Filtrowanie widoków Zadań dzieje się w kliencie na
`Task[]`, które strona już dostała (autoryzacja na poziomie `/tasks` bez zmian). Personalizacja pulpitu
nadal korzysta z istniejącej `setDashboardPrefs` (`src/actions/dashboardPrefs.ts`) z jej własnym
`revalidatePath` — **nie dokładamy** żadnej inwalidacji ani nowego wywołania. Guardy dostępu i
własność `ownerId`/`ownerTeamId` (C-21) — bez zmian.

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Istniejące slugi: `module.tasks` (A) i `module.home` (B). Brak nowego modułu, brak
wpięć w `permissions.ts` / `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)

### 5A. Filtry w Kanban i Timeline — `src/components/tasks/`

**`TasksPage.tsx`** (client) — policz filtrowane zbiory obok istniejącego `visibleTasks` i przekaż je
do widoków. Semantykę filtrów kopiujemy 1:1 z `TaskList` (spójność — AC-4):

```ts
// Filtr tagów (AND) — identyczny jak TaskList.applyTagFilter.
const applyTags = (list: Task[]) =>
  selectedTagIds.length === 0
    ? list
    : list.filter((t) => selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid)));

// Kanban: kolumny = wszystkie włączone statusy (także terminalne, by kolumna „Zrobione”
// się wypełniała), więc NIE filtrujemy po zakładce statusu — tylko tagi (+ wyszukiwanie,
// już zawarte w displayedTasks). Zakładki statusu w Kanbanie ukryte (patrz TaskFilters).
const kanbanTasks = useMemo(() => applyTags(displayedTasks), [displayedTasks, selectedTagIds]);

// Timeline: zakładka statusu działa. „Wszystkie” = wszystkie statusy (w tym terminalne,
// jak dotąd — grupowane po dniu terminu); konkretny status zawęża. Plus filtr tagów.
const timelineTasks = useMemo(() => {
  const byStatus = activeFilter === "ALL" ? displayedTasks : displayedTasks.filter((t) => t.status === activeFilter);
  return applyTags(byStatus);
}, [displayedTasks, activeFilter, selectedTagIds]);
```

Render (zamiana propu `tasks`):
```tsx
{layout === "kanban" ? (
  <KanbanBoard tasks={kanbanTasks} statusConfig={statusConfig} onOpen={setOpenTaskId} />
) : layout === "timeline" ? (
  <TimelineView tasks={timelineTasks} statusConfig={statusConfig} onOpen={setOpenTaskId} />
) : (
  <TaskList tasks={displayedTasks} filter={activeFilter} selectedTagIds={selectedTagIds} … />
)}
```

Pasek filtrów — ukryj zakładki statusu w Kanbanie (wiersz tagów zostaje):
```tsx
<TaskFilters … showStatusTabs={layout !== "kanban"} />
```

Uwagi:
- `visibleTasks` (dla `TaskListClipboardButton`, ALL→bez terminalnych) **zostaje bez zmian** — to inne
  przeznaczenie (kopiuje aktywne zadania z bieżącej zakładki). Rozdzielenie jest celowe; opisane, by
  recenzja nie zgłosiła „duplikatu”.
- Skrót `1–5` (`onFilterTab`) nadal ustawia `activeFilter`; w Kanbanie (ukryte zakładki) jest to
  nieszkodliwe (widok ignoruje status). Bez dodatkowej logiki (C-53).
- `KanbanBoard`/`TimelineView` — **bez zmian w środku**: nadal dostają `Task[]` i renderują. Zmienne
  CSS w tych komponentach już są (C-30).

**`TaskFilters.tsx`** — dodaj opcjonalny prop, domyślnie zachowanie jak dziś:
```ts
showStatusTabs?: boolean; // default true
```
- Gdy `showStatusTabs === false`: nie renderuj kontenera zakładek statusu (wiersz z `filters.map`);
  wiersz tagów renderuj jak dotąd.
- Gdy `!showStatusTabs && allTags.length === 0`: `return null` (bez pustego paska 38px z ramką w
  Kanbanie bez tagów).
- Kolory/teksty bez zmian — już przez zmienne CSS, PL (C-30, C-32).

### 5B. Kompaktowy pasek „Dostosuj pulpit” — `src/components/home/HomePage.tsx`

- **Usuń** osobny `<div style={{ display:"flex", justifyContent:"flex-end", marginTop:-4 }}>…</div>`
  (obecne linie ~367–377) — to on zjada pełny wiersz.
- **Dodaj** ikonkę-przełącznik w istniejącym wierszu powitania
  (`<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>` z logo + `h1` + Beta):
  przycisk `marginLeft:"auto"`, ikona `SlidersHorizontal` (tryb normalny) / `Check` (tryb edycji),
  `onClick={() => setEditing(v => !v)}`.
- **Tryb edycji odróżnialny (AC-8):** w `editing` przycisk dostaje akcentowe tło/kolor
  (`var(--bg-elevated)` + `var(--accent-blue)`) i pokazuje krótką etykietę „Gotowe”; w trybie
  normalnym jest ikoną bez etykiety (tekst „Dostosuj pulpit” trafia do `title`/`aria-label`).
- **Mobile (AC-9, C-31):** wiersz powitania nie jest `hidden md:*`, więc ikonka jest i na mobile;
  rozmiar celu dotyku ≥ ~32×32 px (`padding` + `minWidth/minHeight`), `aria-label` po polsku.
- **Motyw (AC-10, C-30):** wyłącznie zmienne CSS (jak obecny przycisk — bez hexów; ewentualny tekst na
  akcencie = `var(--on-accent)`).
- Reszta bez zmian: stan `editing`, `moveSection`, `toggleHidden`, `persist`, sekcje z kontrolkami
  góra/dół/ukryj (renderowane, gdy `editing`).

## 6. AI / integracje (C-23, C-40)

**Nie dotyczy.** Brak nowej `AIAction` i egzekutora (`check:actions` przejdzie), brak read-toola, brak
wpięć w kalendarz/powiadomienia/auto-expense.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/components/tasks/TasksPage.tsx` | edycja | policz `kanbanTasks`/`timelineTasks`; przekaż filtrowane zbiory do `KanbanBoard`/`TimelineView`; `showStatusTabs={layout !== "kanban"}` do `TaskFilters` |
| `worldofmag/src/components/tasks/TaskFilters.tsx` | edycja | prop `showStatusTabs?: boolean` (default true) — ukrycie wiersza zakładek w Kanbanie; `return null`, gdy brak zakładek i brak tagów |
| `worldofmag/src/components/home/HomePage.tsx` | edycja | usuń pełnowierszowy pasek „Dostosuj pulpit”; dodaj kompaktową ikonkę-przełącznik w wierszu powitania |
| `doświadczenia.md` | dopisanie | lekcja z buga filtrów w widokach (C-51) — dopisać razem z fixem |

Bez nowych plików. `KanbanBoard.tsx` i `TimelineView.tsx` — **bez zmian** (dostają gotowo przefiltrowane `Task[]`).

## 8. Bramki i weryfikacja (C-50)

**Weryfikacja lokalna (C-13 — nigdy prod DB):** lokalny Postgres z CLAUDE.md, `export DATABASE_URL`/
`DIRECT_URL` na `127.0.0.1:5432`, `npx prisma migrate deploy` (tylko aplikuje istniejące — brak nowej
migracji). Następnie zmiana czysto kliencka:
- `npm run check:migrations` — bez nowej migracji, zielone.
- `npm run check:actions` — bez nowej `AIAction`, zielone.
- `npx next lint` — brak nowych ostrzeżeń.
- `npx next build` — kompilacja przechodzi. **Nie odpalać pełnego `npm run build`** (kończy się
  `migrate.js` → prod DB; C-13).
- Manualnie (dev server) na `/tasks/<projekt z tagami>`: przełącz Lista/Kanban/Timeline i sprawdź AC.

**Mapowanie AC → weryfikacja:**

| AC | Jak sprawdzimy |
|----|----------------|
| AC-1 (Kanban filtruje po tagach) | W Kanbanie zaznacz tag → na kartach zostają tylko zadania z tym tagiem; odznacz → pełny zestaw. |
| AC-2 (Timeline tagi, AND) | W Timeline zaznacz ≥2 tagi → tylko zadania mające wszystkie; grupy po dniach się zawężają. |
| AC-3 (zakładki zmieniają widok) | **Timeline:** przełącz zakładkę statusu (np. „Do zrobienia”) → oś czasu pokazuje tylko ten status. **Kanban:** zakładki statusu są ukryte (Q1=b) — „przełączanie nic nie robi” zniknęło u źródła; filtruje tag. |
| AC-4 (spójny zbiór między układami) | Interpretacja z tym planem: dla Listy↔Timeline ten sam status+tagi = ten sam zbiór (różni prezentacja). Kanban celowo pokazuje **wszystkie kolumny statusów** (ALL-incl-terminal), więc spójność liczymy na poziomie tagów+wyszukiwania; różnica statusowa jest własnością prezentacji Kanbana (kolumny). |
| AC-5 (wyszukiwanie + filtry) | W Kanbanie/Timeline wpisz zapytanie (tekst/AI) → wyniki łączą się z filtrem tagów; brak regresji. |
| AC-6 (brak osobnego wiersza) | Na `/` w trybie normalnym „Dostosuj pulpit” nie ma własnej linijki — jest ikoną w wierszu powitania; nad fałdą więcej treści. |
| AC-7 (pełna funkcja edycji) | Klik ikony → tryb edycji; zmiana kolejności/ukrywanie sekcji zapisuje `dashboardPrefs`; ponowny klik → wyjście. |
| AC-8 (edycja odróżnialna) | W trybie edycji ikona ma akcent + etykietę „Gotowe”; jasne wyjście. |
| AC-9 (mobile) | Na szerokości mobilnej ikonka widoczna, klikalna, cel dotyku ≥ ~32 px; układ powitania nienaruszony. |
| AC-10 (skiny) | Zmiana skórki (Light/Blue) → kontrolka dziedziczy kolory ze zmiennych CSS, brak hardkodu. |

## 9. Ryzyka techniczne i plan wycofania

- **Kanban traci kolumny terminalne, jeśli błędnie zastosujemy „ALL→bez terminalnych”.** → Świadomie
  `kanbanTasks` **nie** filtruje po statusie (tylko tagi), więc kolumny DONE/CANCELLED się wypełniają.
- **Rozjazd z `visibleTasks` (clipboard).** → Zostawiamy `visibleTasks` nietknięte; nowe zbiory to
  osobne memoized wartości o innym przeznaczeniu (opisane w kodzie komentarzem).
- **Regresja wyszukiwania.** → `kanbanTasks`/`timelineTasks` wywodzą się z `displayedTasks` (które już
  zawiera wyszukiwanie tekstowe/AI), więc wyszukiwanie działa dalej (AC-5).
- **UX pulpitu na mobile — odcięcie wejścia w edycję.** → Ikonka w niereponsywnie ukrywanym wierszu
  powitania + `aria-label`; sprawdzane w AC-9.
- **Rollback:** zmiana wyłącznie w kodzie (3 pliki komponentów + lekcja). Wycofanie = `git revert`
  commita; brak migracji, więc bez rollbacku bazy (por. runbook devops — granica kod/migracja).

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14 (migracje)** — nie dotyczą (bez zmian w schemacie); `check:migrations` zielone.
- [x] **C-20..C-25 (server/RBAC/AI/trash/audit)** — bez nowych Server Actions, RBAC, `AIAction`, trash,
  audit; personalizacja pulpitu korzysta z istniejącej akcji (jej `revalidatePath` bez zmian).
- [x] **C-30..C-32 (UX)** — tylko zmienne CSS (bez hexów), mobile zachowane (`hidden md:*` niereruszone,
  brak drugiego sidebara), teksty po polsku.
- [x] **C-51** — lekcja o bugu filtrów dopisana do `doświadczenia.md` razem z fixem.
- [x] **C-53 (minimalizm)** — najmniejszy zestaw zmian: 3 pliki komponentów, jeden nowy prop, dwa
  memoized zbiory; zero nowych zależności/abstrakcji; `KanbanBoard`/`TimelineView` nietknięte.

---

**Decyzje przyjęte w planie (zgłoszone w specu jako Q1/Q2, z pre-autoryzacją właściciela):**
- **Q1 = wariant (b):** w Kanbanie zakładki statusu ukryte (kolumny i tak reprezentują statusy);
  filtruje tag + wyszukiwanie. W Timeline zakładki działają normalnie.
- **Q2 = ikonka „suwaki” w wierszu powitania** zamiast osobnego wiersza.

Jeśli właściciel woli inaczej (np. Q1=a — zakładki filtrują kolumny Kanbana; albo inne miejsce
kontrolki pulpitu) — korekta jest lokalna i tania, do naniesienia przed `/implement`.
