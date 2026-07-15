# Recenzja kodu: Filtry w widokach Kanban/Timeline + kompaktowy pasek „Dostosuj pulpit”

- **Spec/Plan/Verify:** ./spec.md · ./plan.md · ./verify.md
- **Data:** 2026-07-15
- **Zakres diffa (feature 001, względem `2d41b04`):** 3 pliki, +47/−15
  - `worldofmag/src/components/tasks/TasksPage.tsx` (+23/−2)
  - `worldofmag/src/components/tasks/TaskFilters.tsx` (+8/−1)
  - `worldofmag/src/components/home/HomePage.tsx` (+19/−12)
- **Charakter:** zmiana czysto po stronie klienta (prezentacja). Bez migracji, Server Actions, RBAC,
  `AIAction`, renderu markdown/HTML, obsługi kluczy — całe kategorie ryzyka (C-10..C-14, C-20..C-25,
  C-40/41, XSS) **nie dotyczą**.

## Ustalenia (od najpoważniejszego)

Recenzja świeżym okiem nie wykryła błędów poprawności, naruszeń konwencji ani problemów
bezpieczeństwa. Poniżej trzy **nieblokujące** obserwacje.

### 1. [design] AC-4 zależy od decyzji Q1=b — do potwierdzenia przez właściciela
- **Plik:** `TasksPage.tsx:623` (`showStatusTabs={layout !== "kanban"}`) + `TaskFilters.tsx:25,31`.
- **Opis:** W Kanbanie zakładki statusu są ukryte (kolumny reprezentują statusy). To świadomy wybór
  (Q1=b, pre-autoryzowany w specu), ale sprawia, że przy aktywnej zakładce statusu przełączenie na
  Kanban pokazuje wszystkie kolumny — literalne brzmienie AC-4 („ten sam zbiór między układami”) jest
  spełnione tylko na poziomie tagów+wyszukiwania.
- **Skutek:** brak — zachowanie zgodne z intencją; ryzyko jedynie interpretacyjne.
- **Sugestia:** potwierdzić Q1=b (albo przełączyć na Q1=a — zakładki filtrują kolumny — zmiana lokalna
  do 2 linii). Bez zmiany kodu na tym etapie.

### 2. [simplification] Predykat filtra tagów powtórzony w 3 miejscach — zgodny z idiomem repo
- **Plik:** `TasksPage.tsx:259` (`visibleTasks`), `:269` (`kanbanTasks`), `:278` (`timelineTasks`).
- **Opis:** `selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid))` powtarza się;
  ten sam wzorzec jest też inline w `TaskList.applyTagFilter`.
- **Skutek:** brak funkcjonalny. Wyodrębnienie helpera byłoby DRY-ero, ale wprowadziłoby zależność
  domknięcia w `useMemo` (ryzyko nowego ostrzeżenia `exhaustive-deps`), a inline **jest** panującym
  stylem w tym pliku (`visibleTasks`).
- **Sugestia:** zostawić — zgodność ze stylem otoczenia > osobiste preferencje (C-53). Ewentualna
  refaktoryzacja osobno, dla całego pliku naraz.

### 3. [convention, pre-existing/out-of-scope] `#fff` w liczniku zakładek `TaskFilters`
- **Plik:** `TaskFilters.tsx` (badge licznika: `color: isActive ? "#fff" : ...`) — **poza tym diffem**.
- **Opis:** C-30 zaleca `var(--on-accent)` zamiast `#fff` na akcentach. Kod istniejący, nietknięty
  tą zmianą.
- **Sugestia:** sprzątnąć przy okazji osobnej zmiany w Zadaniach; nie blokuje tego feature'a.

## Weryfikacja poprawności — prześledzone ścieżki

- **`kanbanTasks` (l. 267–270):** przy braku tagów zwraca `displayedTasks` (wszystkie statusy → kolumny
  Kanbana, w tym terminalne — kolumna „Zrobione” się wypełnia); z tagami filtruje AND. ✔ poprawne,
  brak zawężania po zakładce jest zamierzone.
- **`timelineTasks` (l. 275–279):** `ALL` → wszystkie; inny status → `t.status === activeFilter`; potem
  tagi AND. `activeFilter` pochodzi z `["ALL", ...statusConfig.enabled]`, więc zawsze poprawny klucz. ✔
- **Zależności `useMemo`:** `[displayedTasks, selectedTagIds]` i `[displayedTasks, activeFilter,
  selectedTagIds]` — komplet, bez martwych/brakujących zależności (lint: 0 nowych ostrzeżeń). ✔
- **`TaskFilters` warunki:** `return null` gdy brak zakładek i brak tagów; `{showStatusTabs && (...)}`
  wokół wiersza zakładek — domyślne `true` zachowuje zachowanie Listy/Timeline. ✔ (build zielony)
- **`HomePage` przycisk:** `{editing && "Gotowe"}` renderuje `false`→nic (nie „0”); cel dotyku 32×32;
  tylko zmienne CSS; `aria-label`/`title` PL. Usunięcie starego paska bez osieroconych importów
  (`SlidersHorizontal`/`Check` nadal używane). ✔

## Regresje

- **Widok Lista** — `<TaskList tasks={displayedTasks} filter={activeFilter} selectedTagIds={...}>`
  bez zmian; własna logika filtrów nietknięta. ✔
- **`visibleTasks` / clipboard admina** — bez zmian. ✔
- **Inne wywołania `TaskFilters`** — brak; domyślny `showStatusTabs=true` nie zmienia nic gdzie
  indziej. ✔
- **Pulpit** — sekcje/`dashboardPrefs`/admin-widget/stopka bez zmian; przeniesiono wyłącznie kontrolkę
  wejścia w edycję. ✔
- Bramki (`check:migrations`/`check:actions`/`next lint`/`next build`) zielone (patrz `verify.md`). ✔

## Werdykt

**APPROVE.** Zmiana minimalna, poprawna, zgodna z konwencjami Omnia i idiomami repo; realizuje spec i
przechodzi bramki. Trzy obserwacje powyżej są nieblokujące (jedna projektowa do potwierdzenia, jedna
stylistyczna zgodna z repo, jedna pre-existing poza zakresem).

Ścieżka standingowa (build zielony): **commit → merge `claude/last-commit-message-pfuiph` → `develop`
→ push** (zgodnie z CLAUDE.md / C-52).
