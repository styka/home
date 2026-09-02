# Zadania: Poprawki UX — edytor skórek w dialogu, panel szczegółów zadania bez zbędnej linii, jeden mechanizm zakresu projektów

- **Plan:** ./plan.md (121-ux-skorki-zadania-filtr)
- **Status:** in-progress
- **Data:** 2026-09-02

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami**. Feature nie rusza schematu ani akcji AI — Fazy 0 i 3 z szablonu świadomie puste
> (plan §2, §6). Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
*(pusta — bez zmian w schemacie i bez migracji; plan §2)*

## Faza 1 — Warstwa serwera
- [x] **T-1** — Sprawdź `revalidatePath` w `updateProjectGroup`/`deleteProjectGroup`
  (`src/modules/tasks/actions/projectGroups.ts`): mają rewalidować `/tasks` (widok zestawu żyje pod
  `/tasks/zestaw/...`). Jeśli brakuje — dopisz. **Gotowe, gdy:** obie akcje kończą się
  `revalidatePath` obejmującym trasy zadań; żadnych innych zmian w pliku.

## Faza 2 — UI
- [x] **T-2** `[P]` — **Skórki w dialogu** (`src/components/settings/SkinPicker.tsx`): render
  `SkinEditor` przenieść z bloku inline do `<Modal open onClose title wide>`; tytuły „Nowa skórka" /
  „Edycja skórki" przez `t()` (nowe klucze w `messages/pl.json`); `onSaved` nadal aktywuje skórkę.
  **Gotowe, gdy:** po kliknięciu „Utwórz własną skórkę" / „Edytuj" / „Duplikuj i edytuj" edytor jest
  w modalu (Esc zamyka), inline-sekcja nie istnieje, zero literałów z diakrytykami w JSX (AC-1..AC-3).
- [x] **T-3** `[P]` — **Panel szczegółów zadania bez wiersza nagłówka**
  (`src/modules/tasks/ui/TaskDetail.tsx`): usuń blok nagłówka `h-12`; spinner, rozwiń/zwiń
  (desktop, `aria-pressed`), usuń i zamknij przenieś do wiersza tytułu (`sekcjaTytul`,
  `flex-shrink-0` na grupie akcji, pole tytułu `min-w-0 flex-1`); mobilne „Wróć" jako pierwszy
  element wiersza (`md:hidden`); cele dotyku ≥ 44 px; Esc/fokus bez regresu. **Gotowe, gdy:** panel
  zaczyna się wierszem tytułu, wszystkie 4 akcje + „Wróć" działają, klucz `szczegolyZadania`
  zostaje w `pl.json` (używa go `TasksGuide`) (AC-4, AC-5).
- [x] **T-4** — **Tryb zestawu w filtrze** (`src/modules/tasks/ui/ProjectScopeFilter.tsx`): nowy
  opcjonalny prop `zestaw` (id, name, emoji, color, projectIds); z propem — roboczy wybór w stanie
  lokalnym, pola nazwa/emoji/kolor (kontrolki jak w edytorze z `TasksSideNav`), przyciski „Zapisz
  zmiany" (aktywny gdy roboczy ≠ zapisany i wybór niepusty; `updateProjectGroup`), „Zapisz jako nowy
  zestaw" (`createProjectGroup` + `router.push`), „Usuń zestaw" (`confirmDialog destructive` →
  `deleteProjectGroup` → `router.push("/tasks")`); etykieta kotwicy z licznikiem („N z M"); bez
  propa — zachowanie dokładnie dzisiejsze. Teksty przez `t()`. **Gotowe, gdy:** oba tryby działają,
  pusty wybór nie da się zapisać (AC-6, AC-9).
- [x] **T-5** — **Wpięcie trybu zestawu + usunięcie duplikatów** (`TasksRouteView.tsx`,
  `TasksPage.tsx`): przekaż dane zestawu z `getProjectGroup` do `TasksPage`; renderuj
  `ProjectScopeFilter` także dla `viewMode === "multi"` (z propem `zestaw`); usuń pasek chipów
  „Projekty: …" wraz z ołówkiem `?edit=1`; usuń `multiGroupId`/`scopeProjects` z propsów, jeśli po
  zmianie nic ich nie czyta (grep po użyciach). **Gotowe, gdy:** widok zestawu pokazuje zakres
  wyłącznie w dropdownie, pasek chips nie istnieje, widoki wirtualne działają bez zmian (AC-6, AC-9).
- [x] **T-6** — **Sidebar bez edytora grup** (`src/modules/tasks/ui/TasksSideNav.tsx`): usuń
  `groupEditor`, `openEditGroup`, `handleDeleteGroup`, auto-otwieranie z `?edit=1` (`autoEditedId`
  + efekt), formularz i ikonki ołówka/kosza; grupy zostają czystymi linkami do
  `/tasks/zestaw/<id>`; jeśli był przycisk „nowa grupa" otwierający formularz — usuń (tworzenie
  przejmuje dropdown). **Gotowe, gdy:** sidebar renderuje grupy jako linki, martwy kod edytora
  i nieużywane importy usunięte (AC-7).

## Faza 3 — AI / integracje
*(pusta — bez nowych `AIAction`/read-tooli; plan §6)*

## Faza 4 — Bramki i domknięcie
- [ ] **T-7** — Bramki lokalne: `tsc --noEmit -p tsconfig.test.json`, `npm run check:i18n`,
  `npm run check:ui-contract`, `next lint --dir src`, potem pełny `npm run build` **do kroku
  `next build`** na lokalnym Postgresie (C-13). **Gotowe, gdy:** wszystko zielone (AC-10).
- [ ] **T-8** — Mapowanie AC-1..AC-10 ze speca na wynik (krótka tabela — input do `/verify`);
  aktualizacja statusów w tym pliku.
- [ ] **T-9** — Wpis do `doświadczenia.md`, jeśli po drodze wystąpił nieoczywisty problem (C-51);
  commit + merge `claude/*` → `develop` wg C-52 (wykonuje pipeline po recenzji).

## Mapowanie AC → zadania
| AC | Zadania |
|----|---------|
| AC-1, AC-2, AC-3 (skórki w dialogu) | T-2 |
| AC-4, AC-5 (panel szczegółów) | T-3 |
| AC-6 (zakres w dropdownie, bez chips) | T-4, T-5 |
| AC-7 (sidebar: linki; rename/delete w dropdownie) | T-4, T-6 |
| AC-8 (istniejące zestawy działają, bez migracji) | T-1 (rewalidacja), brak migracji strukturalnie |
| AC-9 (filtr ad hoc bez regresu) | T-4, T-5 |
| AC-10 (build zielony) | T-7 |

## Notatki / blokady
- T-1: bez zmian w kodzie — wszystkie trzy akcje grup już kończyły się `revalidatePath("/tasks")`.
- Ścieżka krytyczna: T-4 → T-5 → T-6 (T-5 wpina prop z T-4; T-6 usuwa edytor dopiero, gdy dropdown
  przejął jego funkcje — inaczej okno bez klamki). T-2 i T-3 niezależne, można równolegle.
