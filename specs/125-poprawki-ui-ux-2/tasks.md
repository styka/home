# Zadania: Druga paczka poprawek UI/UX ze zgłoszeń administratora

- **Plan:** ./plan.md (125-poprawki-ui-ux-2)
- **Status:** todo
- **Data:** 2026-09-04

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami**. Każde zadanie jest małe, samodzielne i **weryfikowalne**. Odhaczamy `[ ]` → `[x]`
> w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Poprawki punktowe (bez zależności)

- [x] **T-1** `[P]` — **Zgł. 4:** `src/components/assistant/AICommandSheet.tsx` — trzy miejsca:
  (1) markdown link trybu robaczka (~1481) → `?task=${res.taskId}`; (2) stan `reportDone`
  (~547) + setter (~1162) poszerzone o `taskId`; (3) przycisk „Otwórz w zadaniach" (~2094) →
  `goTo(…?task=…)`. Potem grep kontrolny `` /tasks/${…projectId} `` w `src` — zero miejsc bez
  `?task=` (poza świadomymi linkami do listy). Gotowe, gdy: `tsc` czysty i grep czysty (AC-4).
- [x] **T-2** `[P]` — **Zgł. 2:** `src/modules/tasks/ui/TasksPage.tsx`, wywołanie
  `ModalDodaniaZadania` (~908): dodać `pokazWyborProjektu`, `projekty={allProjects}`,
  `domyslnyProjektId={viewMode === "project" ? projectId : null}`; `onCreated` przyjmuje
  (i ignoruje) drugi argument. Gotowe, gdy: dialog z widoku projektu ma select z preselekcją,
  z Dziś/zestawu — bez preselekcji; po dodaniu do innego projektu panel podglądu otwiera się
  w bieżącym widoku (AC-2).
- [x] **T-3** `[P]` — **Zgł. 1:** `src/modules/rosliny/ui/PrzestrzenPage.tsx` — blok
  `{ustawienia && <section>}` → `Modal` (title = istniejący klucz `ustawienia`, onClose czyści
  też `komunikat`); `usunPrzestrzen()` zamyka dialog przed nawigacją; slot `settings` otwiera
  na `true`. Gotowe, gdy: AC-1 (dialog nad treścią, zawartość kompletna, usunięcie działa,
  Esc zamyka, strona się nie rozsuwa).

## Faza 1 — Filtr tagów do paska akcji (zgł. 3; jeden ciąg zmian w 3 plikach)

- [x] **T-4** — `src/modules/tasks/ui/FiltrTagow.tsx`: wariant kompaktowy jako JEDYNY render
  przycisku — ikona `Tags` size 15 + licznik wybranych (badge jak liczniki zakładek; akcent
  `--accent-blue` gdy wybór aktywny), styl sąsiadów paska (p-1.5, rounded, flex-shrink-0),
  `title`/`aria-label` z pełną treścią („Filtr etykiet: 5 z 17"); rząd chipów wybranych
  etykiet USUNIĘTY (wybór ogląda się i zdejmuje w panelu `AnchoredLayer` — bez zmian w panelu).
  Gotowe, gdy: komponent renderuje tylko przycisk+panel, bez chipów; i18n przez `t()`.
- [x] **T-5** — `src/modules/tasks/ui/TaskFilters.tsx`: usunąć `FiltrTagow` i propsy tagów
  (`allTags`/`selectedTagIds`/`onTagToggle`/`onTagsClear`); wiersz = same zakładki; warunek
  `if (!showStatusTabs) return null`. Gotowe, gdy: `tsc` pokazuje wszystkich konsumentów do
  poprawy (tylko `TasksPage`), a Kanban nie renderuje pustego wiersza.
- [x] **T-6** — `src/modules/tasks/ui/TasksPage.tsx`: `<FiltrTagow …>` w pasku akcji zaraz za
  przyciskiem Szukaj (scrollowany `role="toolbar"`); propsy tagów zdjęte z `<TaskFilters>`.
  Gotowe, gdy: AC-3 w całości (zakładki pełne przy 5 tagach, przycisk z licznikiem obok lupy,
  klik otwiera panel, koniunkcja nietknięta).
- [x] **T-7** — Grep `e2e/` pod `FiltrTagow`/„Filtr etykiet"/licznik „z N" — dostosować
  selektory, jeśli jakiś spec celuje w filtr w starym miejscu. Gotowe, gdy: żaden spec nie
  szuka filtra w wierszu zakładek.

## Faza 2 — Bramki i domknięcie

- [ ] **T-8** — `npm run check:i18n`, `npm run check:ui-contract`, `tsc` testowy, `next lint`,
  pełny build do `next build` (lokalny Postgres, C-13). Gotowe, gdy: wszystko zielone.
- [ ] **T-9** — Mapowanie AC-1…AC-5 → wynik (input do `/verify`); przegląd widoków Zadań
  (lista/kanban/timeline/obszary, wirtualne, zestaw) i przestrzeni Roślin; skróty `a`/`n`.
- [ ] **T-10** — Wpis do `doświadczenia.md` (C-51 — lekcja: jeden link, wiele ścieżek
  generowania); commit + merge → `develop` wg C-52 (wykona `/review`).

## Mapowanie kryteriów akceptacji
| AC | Zadania |
|----|---------|
| AC-1 | T-3 |
| AC-2 | T-2 |
| AC-3 | T-4, T-5, T-6, T-7 |
| AC-4 | T-1 |
| AC-5 | T-8, T-9 |

## Notatki / blokady
- Ścieżka krytyczna: T-4 → T-5 → T-6 (ten sam ciąg propsów przez 3 pliki); Faza 0 w pełni
  równoległa względem Fazy 1.
- Branch roboczy odtworzony z `origin/develop` (2742e617) — poprzedni merge 118 jest już
  w historii; nic do rebase'owania.
