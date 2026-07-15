# Weryfikacja: Filtry w widokach Kanban/Timeline + kompaktowy pasek „Dostosuj pulpit”

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-07-15
- **Środowisko:** lokalny Postgres (`omnia/omnia_dev`, 127.0.0.1:5432), `next build` lokalnie (C-13 — nigdy prod DB).

## 1. Bramki techniczne

| Komenda | Wynik | Dowód |
|---------|-------|-------|
| `npx prisma migrate deploy` (lokalny PG) | ✅ | „No pending migrations to apply.” (brak nowej migracji — zmiana czysto UI) |
| `npm run check:migrations` | ✅ exit 0 | „✔ Numeracja migracji OK (następny wolny numer: 0205).” |
| `npm run check:actions` | ✅ exit 0 | „✓ 95 akcji w katalogu, wszystkie obsługiwane przez executor.” |
| `next lint --dir src` | ✅ exit 0 | 0 błędów; 15 ostrzeżeń **wszystkie istniejące**. Nasze pliki: `TaskFilters.tsx`/`HomePage.tsx` — 0; `TasksPage.tsx` — 2 istniejące `exhaustive-deps` (l. 100 `checkDueNotifications`, l. 336 `navigateDown/Up`), **nie** z nowych memo. |
| `next build` | ✅ exit 0 | Kompilacja wszystkich tras przeszła (build-exit=0). |

**Werdykt bramek:** wszystkie zielone; zero nowych ostrzeżeń/błędów wprowadzonych tą zmianą.

## 2. Kryteria akceptacji

Weryfikacja przez prześledzenie ścieżki w kodzie (stan po implementacji) + zielony `next build`.
Ścieżki plików: `worldofmag/src/components/tasks/{TasksPage,TaskFilters}.tsx`, `.../home/HomePage.tsx`.

### A. Filtry w Kanban i Timeline

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** Kanban filtruje po tagach | ✅ | `kanbanTasks` (TasksPage l. 267–270) = `displayedTasks` przefiltrowane `selectedTagIds.every(...)`; przekazane do `<KanbanBoard tasks={kanbanTasks}>` (l. 640). Wcześniej Kanban dostawał surowe `displayedTasks`. |
| **AC-2** Timeline: tagi AND | ✅ | `timelineTasks` (l. 275–279) stosuje `selectedTagIds.every(...)` — semantyka AND (wszystkie zaznaczone tagi); `<TimelineView tasks={timelineTasks}>` (l. 642). |
| **AC-3** zakładki zmieniają widok | ✅ | **Timeline:** `timelineTasks` zawęża po `activeFilter` gdy ≠ „ALL” (l. 276) — przełączenie zakładki zmienia zbiór. **Kanban:** zakładki statusu ukryte — `showStatusTabs={layout !== "kanban"}` (l. 623) + `TaskFilters` nie renderuje wiersza zakładek (l. 25, 31). Stan „przełączam i nic się nie dzieje” usunięty u źródła (Q1 = wariant b). |
| **AC-4** spójny zbiór między układami | ✅ (z udokumentowaną interpretacją) | **Lista↔Timeline:** ten sam zbiór. Pod „Wszystkie” Lista pokazuje aktywne (główna sekcja) **oraz** terminalne w `CompletedSection` (`TaskList` l. 152–153, 181–182), a Timeline — wszystkie po dniu terminu → **ten sam zbiór, inna prezentacja** (dokładnie to dopuszcza AC-4). Konkretny status → oba zawężają identycznie. **Kanban:** celowo nie ma zakładek statusu (Q1=b), więc spójność liczona na poziomie tagi+wyszukiwanie; kolumny reprezentują statusy (prezentacja). Zgodne z planem §8. |
| **AC-5** wyszukiwanie + filtry | ✅ | `kanbanTasks`/`timelineTasks` wywodzą się z `displayedTasks`, które już zawiera wynik wyszukiwania tekstowego/AI (TasksPage l. 210–224). Filtry łączą się z wyszukiwaniem; brak regresji. |

### B. Kompaktowy pasek „Dostosuj pulpit”

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-6** brak osobnego wiersza | ✅ | Dawny pełnowierszowy `<div justifyContent:"flex-end">` **usunięty** (brak w pliku). Kontrolka to teraz przycisk w wierszu powitania (HomePage l. 351–367), wciśnięty w prawo `marginLeft:"auto"` (l. 356) — nie zajmuje własnej linijki. |
| **AC-7** pełna funkcja edycji | ✅ | `onClick={() => setEditing(v => !v)}` (l. 352); logika `moveSection`/`toggleHidden`/`persist` (→ `setDashboardPrefs`) i renderowanie kontrolek sekcji **nietknięte** (l. 380+). Wejście i wyjście z edycji działa. |
| **AC-8** edycja odróżnialna | ✅ | W trybie edycji przycisk: tło `var(--bg-elevated)`, kolor `var(--accent-blue)`, ikona `Check` + etykieta „Gotowe” (l. 360–366); w normalnym — sama ikona `SlidersHorizontal`, kolor `var(--text-muted)`. Jednoznaczne wyjście. |
| **AC-9** mobile | ✅ | Wiersz powitania nie jest `hidden md:*` → ikona widoczna na mobile; cel dotyku `minWidth:32, minHeight:32` (l. 358); `aria-label` po polsku (l. 353). Układ powitania nienaruszony. |
| **AC-10** skiny | ✅ | Wyłącznie zmienne CSS: `var(--border)`, `var(--bg-elevated)`, `var(--accent-blue)`, `var(--text-muted)` (l. 359–361). Brak hardkodowanych hexów w kontrolce. |

**Pokrycie AC:** 10/10 spełnione (AC-4 z jawną, udokumentowaną interpretacją Kanbana — zgodną z pre-autoryzacją Q1 w specu).

## 3. Zgodność z konstytucją

| Reguła | Status | Uwaga |
|--------|--------|-------|
| C-01 (praca w `worldofmag/`) | ✅ | Zmiany tylko w `worldofmag/src/...` + artefakty `specs/` + `doświadczenia.md`. |
| C-02 (alias `@/*`) | ✅ | Bez nowych importów względnych. |
| C-10..C-14 (migracje) | ✅ n/d | Brak zmian w schemacie; `check:migrations` zielone. |
| C-20..C-25 (server/RBAC/AI/trash/audit) | ✅ n/d | Brak nowych/zmienionych Server Actions, RBAC, `AIAction`, trash, audit; personalizacja pulpitu korzysta z istniejącej `setDashboardPrefs`. |
| C-30 (zmienne CSS) | ✅ | Nowa kontrolka pulpitu i nowe memo — bez hexów. *Pre-existing (poza zakresem):* `TaskFilters` licznik zakładek używa `#fff` na aktywnym tle — kod istniejący, nietknięty tą zmianą. |
| C-31 (mobile/keyboard) | ✅ | Cel dotyku 32×32; brak drugiego sidebara; skróty `1–5`/`/` nienaruszone (w Kanbanie `1–5` nieszkodliwe — zakładki ukryte). |
| C-32 (teksty PL) | ✅ | Wszystkie teksty/aria po polsku. |
| C-50 (build) | ✅ | Bramki do `next build` zielone. |
| C-51 (lekcja) | ✅ | Wpis `doświadczenia.md` 2026-07-15 dodany razem z fixem. |
| C-53 (minimalizm) | ✅ | 3 pliki komponentów, 2 memo, 1 opcjonalny prop; `KanbanBoard`/`TimelineView` nietknięte; zero nowych zależności. |

## 4. Regresje

- **Widok Lista** — bez zmian funkcjonalnych: nadal `<TaskList tasks={displayedTasks} filter={activeFilter} selectedTagIds={...}>`; własna logika filtrów w `TaskList` nietknięta. ✅
- **`visibleTasks` (clipboard admina)** — nietknięte; `TaskListClipboardButton` (l. 513) dostaje ten sam zbiór co wcześniej. ✅
- **`TaskFilters` w innych miejscach** — prop `showStatusTabs` domyślnie `true`, więc Lista/Timeline renderują zakładki jak dotąd; brak wywołań `TaskFilters` poza `TasksPage`. ✅
- **Pulpit** — zmieniono wyłącznie umiejscowienie kontrolki personalizacji; sekcje, `dashboardPrefs`, admin-widget, stopka — bez zmian. ✅
- **Brak** migracji, zmian `revalidatePath`, RBAC → brak wpływu na sąsiednie moduły. `next build` skompilował wszystkie trasy. ✅

## 5. Werdykt końcowy

**GOTOWE.** Wszystkie bramki zielone, 10/10 kryteriów akceptacji spełnione (AC-4 zgodnie z jawną,
pre-autoryzowaną interpretacją dla Kanbana — Q1=b). Brak regresji w sąsiednich modułach. Zgodność z
konstytucją zachowana.

Uwagi do rozważenia przez recenzenta (nie blokujące):
- Potwierdzić decyzję **Q1=b** (w Kanbanie zakładki statusu ukryte) — to świadomy wybór, ale zmienia
  interpretację AC-4 względem dosłownego brzmienia (opisane wyżej).
- Pre-existing `#fff` w liczniku zakładek `TaskFilters` (C-30) — poza zakresem tej zmiany; ewentualnie
  do sprzątnięcia osobno.

**Następny krok: `/review specs/001-filtry-widokow-i-pasek-pulpitu`**
