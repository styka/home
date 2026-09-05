# Recenzja: Druga paczka poprawek UI/UX ze zgłoszeń administratora

- **Spec:** ./spec.md (125-poprawki-ui-ux-2)
- **Data:** 2026-09-05
- **Zakres:** `git diff origin/develop...HEAD` (bez `src/generated/`); recenzja własna + świeże
  oko subagenta omnia-reviewer.

## Ustalenia (od najpoważniejszego)

1. **`src/modules/tasks/ui/TasksPage.tsx` (wywołanie modalu) — correctness, NANIESIONE.**
   W widokach wirtualnych/zestawach pole projektu było wstępnie ustawione na projekt-skrzynkę:
   `domyslnyProjektId=null` spadał w inicjalizatorze `FormularzZadania` na fallback z propa
   `projectId`, a tam jechało `addProjectId = inboxId` (realny projekt „📥 Skrzynka", nie widok
   wirtualny). Scenariusz: na `/tasks/today` select pokazywał wybraną „📥 Skrzynkę" zamiast pustej
   opcji — wbrew regule właściciela „bez automatu" i niespójnie ze stroną modułu (121). Poprawka:
   `domyslnyProjektId=""` poza widokiem projektu (pusty string nie jest nullish, fallback martwy)
   + usunięty martwy `addProjectId`; `verify.md` AC-2 skorygowane (C-54). `tsc` + lint zielone.
2. **`TasksPage.tsx:114` — correctness (edge, mechanizm zastany, bez akcji).** Link `?task=` nie
   otworzy panelu, gdy użytkownik JUŻ stoi na stronie tego projektu (`initialOpenTaskId` czytany
   tylko w inicjalizatorach `useState`; nawigacja na tę samą trasę nie remountuje strony).
   Ograniczenie istnieje od 118 dla ścieżki agentowej — nie wprowadza go ten diff; scenariusz
   wąski (admin przeglądający skrzynkę zgłasza z czatu). Odnotowane jako znany dług.
3. **`FiltrTagow.tsx` — kosmetyka (bez akcji).** Blok `AnchoredLayer` zachował o poziom głębsze
   wcięcie po zdjęciu wrappera; zero wpływu na działanie, do wygładzenia przy następnej edycji.

## Sprawdzone i czyste

- Jedyny konsument `TaskFilters`/`FiltrTagow` to `TasksPage`; `ModalDodaniaZadania` ma dwóch
  konsumentów (`TasksPage`, `TasksHomePage`) — sygnatury zgodne; Kanban nie traci filtra (pasek
  akcji renderowany w każdym układzie) i nie renderuje pustego wiersza zakładek.
- `?task=` w obu ścieżkach bez agenta; `canRead === false` nadal ukrywa oba linki; `taskId`
  w zwrotce `submitFeedbackTask` na obu ścieżkach; `TasksRouteView` czyta parametr; zero
  czwartego miejsca (grep).
- `AnchoredLayer` to portal — przewijany pasek go nie przycina; e2e [100-AC6/AC7] pasują do
  nowego markupu (title-prefix, `role="toolbar"`, 0 spanów bez wyboru).
- Brak martwych importów po kasacji chipów (`TaskTagBadge`/`cn` żywe w panelu); pusty
  `allProjects` niegroźny; `reportDone` czytany w jednym miejscu; C-30/C-32 bez nowych naruszeń.
- `Modal` ustawień Roślin: import istniał, `confirmDialog({destructive})` zachowany, `komunikat`
  czyszczony przy zamknięciu.

## Werdykt

**APPROVE Z UWAGAMI** (ustalenie 1 naniesione w recenzji; 2–3 odnotowane, nieblokujące).
Zgodnie z C-52: merge `claude/worldofmag-ui-bugs-pplbag` → `develop` → push, następnie
automatyczna promocja `develop → master` (`--ff-only`) po kontroli integralności.
