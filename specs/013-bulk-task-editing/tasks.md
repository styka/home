# Zadania: Bulkowa (zbiorcza) edycja zadań

- **Plan:** ./plan.md (013-bulk-task-editing)
- **Status:** todo
- **Data:** 2026-07-20

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Feature **nie rusza schematu** (Faza 0 pusta). Każde zadanie małe, samodzielne, weryfikowalne.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
- Bez zmian w schemacie / bez migracji (plan §2). Statusy/priorytety pozostają `String`+union.

## Faza 1 — Warstwa serwera
- [x] **T-1** — W `src/actions/tasks.ts` dodać **`bulkUpdateTasks(taskIds, patch)`**: `requireAuth`,
  jednorazowy `assertProjectAccess` gdy `patch.projectId`, pętla z `assertTaskAccess` (skip przy braku
  dostępu), reużyta logika `completedAt` + normalizacji statusu przy przeniesieniu projektu, zapis
  skalarów, tagi `addTagIds`/`removeTagIds` (createMany skipDuplicates / deleteMany), `revalidatePath`
  dla `/tasks` i dotkniętych projektów, zwrot `{ updated, skipped }`. **Gotowe, gdy:** akcja kompiluje
  się, zmienia tylko przekazane pola, pomija zadania bez dostępu. (AC-2..AC-7, AC-10, AC-12)
- [x] **T-2** — W `src/actions/tasks.ts` dodać **`bulkDeleteTasks(taskIds)`**: `requireAuth`, pętla z
  `assertTaskAccess` (skip), reużyta ścieżka `recordTrash` → `prisma.task.delete`, `revalidatePath`,
  zwrot `{ deleted, skipped }`. **Gotowe, gdy:** usunięte zadania trafiają do `TrashItem`. (AC-8, AC-10)
- [x] **T-3** `[P]` — Dodać wpisy `bulkUpdateTasks` i `bulkDeleteTasks` do
  `src/lib/ai/action-coverage.json` ze statusem `excluded` (powód: „bulk edycja UI-only, brak akcji AI
  w 1. wersji"). **Gotowe, gdy:** `npm run check:ai-coverage` przechodzi.

## Faza 2 — UI
- [ ] **T-4** — Nowy komponent **`src/components/tasks/BulkActionBar.tsx`**: pływający pasek/bottom-sheet
  (licznik „Zaznaczono N", „Zaznacz wszystkie/Odznacz", „Anuluj"; akcje: Status z
  `resolveStatuses(statusConfig)`, Priorytet, Termin ustaw/wyczyść, Kategoria, Projekt z `allProjects`,
  Tagi dodaj/usuń z `allTags`, Usuń z potwierdzeniem). Zmienne CSS + `--on-accent`, `safe-area-inset-bottom`,
  `useTransition`, komunikat „Zmieniono X z N". Teksty PL. **Gotowe, gdy:** pasek renderuje się i woła
  akcje z T-1/T-2. (AC-1, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-12)
- [ ] **T-5** — `TaskRow.tsx`: propsy `selectionMode`/`isChecked`/`onToggleSelect(id, shiftKey)`,
  checkbox ≥20×20 po lewej (kolory CSS-vars), w trybie zaznaczania klik toggluje zaznaczenie (nie
  otwiera panelu), Shift+klik = zakres, long-press (~450 ms) na mobile wchodzi w tryb. **Gotowe, gdy:**
  wiersz zaznacza się kliknięciem/gestem, poza trybem zachowanie bez zmian. (AC-13)
- [ ] **T-6** — `TaskList.tsx`: przekazać propsy zaznaczenia do `TaskRow` + indeks w kolejności renderu
  do obsługi zakresu Shift. **Gotowe, gdy:** zaznaczenie działa we wszystkich wariantach grupowania.
- [ ] **T-7** — `TasksPage.tsx`: stan `selectionMode`/`selectedIds`/`lastClickedId`, przycisk „Zaznacz"
  w nagłówku (tylko `layout === "list"`), render `BulkActionBar`, „zaznacz wszystkie" po `visibleTasks`,
  Esc czyści i wychodzi (wpięte w obsługę klawiszy), dolny padding listy gdy pasek widoczny. **Gotowe,
  gdy:** pełny cykl zaznacz→zmień→wyczyść działa na widoku listy. (AC-1, AC-9, AC-11)

## Faza 3 — AI / integracje
- Nie dotyczy (plan §6) — brak nowej `AIAction`/read-toola; pokrycie AI domknięte w T-3.

## Faza 4 — Bramki i domknięcie
- [ ] **T-8** — `npm run check:actions`, `npm run check:ai-coverage`, `npm run check:migrations`,
  `next lint`, `next build` (lokalny Postgres — C-13) — zielone.
- [ ] **T-9** — Mapowanie każdego AC (AC-1..AC-13) na wynik — input do `/verify`.
- [ ] **T-10** — Wpis do `doświadczenia.md`, jeśli po drodze był nieoczywisty problem (C-51).

## Ścieżka krytyczna / zależności
- **T-1 → T-4**: `BulkActionBar` woła `bulkUpdateTasks`; **T-2 → T-4** dla usuwania.
- **T-5 → T-6 → T-7**: checkbox w wierszu → przekazanie w liście → orkiestracja stanu w stronie.
- **T-3** równolegle do UI, ale **musi być przed T-8** (bramka `check:ai-coverage`).
- **T-8** po całości; **T-9/T-10** domknięcie.

## Mapowanie AC → zadania
| AC | Zadania |
|----|---------|
| AC-1 pasek+licznik | T-4, T-7 |
| AC-2 status | T-1, T-4 |
| AC-3 tylko wybrane pola | T-1 |
| AC-4 termin ustaw/wyczyść | T-1, T-4 |
| AC-5 kategoria | T-1, T-4 |
| AC-6 przenieś projekt | T-1, T-4 |
| AC-7 tagi dodaj/usuń | T-1, T-4 |
| AC-8 usuń→Kosz | T-2, T-4 |
| AC-9 zaznacz wszystkie | T-4, T-7 |
| AC-10 pomijanie bez dostępu | T-1, T-2, T-4 |
| AC-11 Esc/Anuluj | T-4, T-7 |
| AC-12 custom statusy listy | T-1, T-4 |
| AC-13 mobile/checkbox/Shift | T-5, T-6 |
