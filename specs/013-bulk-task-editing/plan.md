# Plan techniczny: Bulkowa (zbiorcza) edycja zadań

- **Spec:** ./spec.md (013-bulk-task-editing)
- **Status:** draft
- **Data:** 2026-07-20

> **Zasada planu:** to jest **JAK**. Pisane pod istniejący moduł Tasks — naśladujemy jego wzorce
> (Server Actions z `revalidatePath`, guard `assertTaskAccess`, zmienne CSS, mobile-first), C-53.

## 1. Podejście (2–4 zdania)
Rozszerzamy **istniejący moduł Tasks** (widok listy) o tryb zaznaczania i zbiorcze akcje —
bez nowego modułu, trasy ani zmian schematu. Warstwa serwera to **dwie nowe Server Actions** w
`src/actions/tasks.ts` (`bulkUpdateTasks`, `bulkDeleteTasks`), które wewnętrznie powtarzają logikę
sprawdzoną w `updateTask`/`updateTaskTags`/`deleteTask` (guard per zadanie, normalizacja statusu przy
przeniesieniu projektu, soft-delete do Kosza). UI dokłada stan zaznaczenia w `TasksPage`, checkbox w
`TaskRow` i **pływający pasek akcji** `BulkActionBar` — wzorzec wizualny jak istniejące paski/panele
modułu. Wzorzec do naśladowania: sam moduł Tasks (`TasksPage`/`TaskList`/`TaskRow` + `actions/tasks.ts`).

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Zbiorcza edycja operuje wyłącznie na istniejących polach `Task`
(`status`, `priority`, `dueDate`, `category`, `projectId`) oraz na istniejącej relacji `TaskTaskTag`
(tagi). Soft-delete korzysta z istniejącego `TrashItem` (`recordTrash`). Nie ma nowego modelu ani
kolumny → **nie tworzymy migracji** (C-10 nie dotyczy). Statusy/priorytety pozostają `String` + unions
w `src/types` (`TaskStatus`, `TaskPriority`) — C-12 zachowane.

## 3. Warstwa serwera (Server Actions — C-20)
Plik: `src/actions/tasks.ts` (dopisujemy do istniejącego).

- **`bulkUpdateTasks(taskIds: string[], patch): Promise<{ updated: number; skipped: number }>`**
  gdzie `patch` = `Partial<{ status: string; priority: TaskPriority; dueDate: Date | null;
  category: string; projectId: string | null; addTagIds: string[]; removeTagIds: string[] }>`.
  - `requireAuth()`; jeśli `patch.projectId` ustawiony → `assertProjectAccess(patch.projectId, user.id)`
    raz (cel przeniesienia).
  - Pętla po `taskIds`: pobierz zadanie; `assertTaskAccess` w `try/catch` — **brak dostępu = skip**
    (zliczamy `skipped`), nie rzucamy. Dla dostępnych:
    - Odtwórz logikę `completedAt` z `updateTask` (status→DONE ustawia `completedAt`, zejście z DONE
      zeruje).
    - Odtwórz normalizację statusu przy przeniesieniu do innego projektu, gdy `patch.status`
      nieustawiony (custom status „osierocony" → pierwszy status celu) — jak w `updateTask`.
    - Zapis skalarów jednym `update`. Tagi: `addTagIds` → `createMany … skipDuplicates`; `removeTagIds`
      → `deleteMany where taskId+tagId in`. Semantyka **dodaj/usuń** (pozostałe tagi nietknięte) — AC-7.
  - `revalidatePath("/tasks")` + `revalidatePath` dla dotkniętych `projectId` (starych i nowego).
    `void trackActivity("tasks", "bulk_update_tasks", { count, patchKeys })`.
  - Zwraca liczniki do UI (AC-10 „zmieniono X z N").
- **`bulkDeleteTasks(taskIds: string[]): Promise<{ deleted: number; skipped: number }>`**
  - `requireAuth()`; pętla z `assertTaskAccess` (skip przy braku dostępu); dla każdego reużyj ścieżki z
    `deleteTask`: `recordTrash(...)` (migawka pól + `tagIds`) → `prisma.task.delete`. Soft-delete (C-24).
  - `revalidatePath("/tasks")` + dotknięte projekty.
- **Guard/własność (C-21):** korzystamy z istniejących `assertTaskAccess` / `assertProjectAccess` —
  dostęp liczony przez współwłasność `ownerId`/`ownerTeamId` + `TaskShare`. Żadnego nowego modelu
  dostępu. Zadania bez prawa edycji są **pomijane**, nie zmieniane (AC-10).
- **Wydajność:** operacje w ramach jednej akcji; zapisy skalarne można zamknąć w
  `prisma.task.updateMany` dla podzbioru bez normalizacji statusu, ale dla poprawności normalizacji per
  zadanie zostajemy przy pętli (N zadań to realnie dziesiątki, nie tysiące). Jeśli okaże się to wąskie
  gardło — optymalizacja w `/implement`, nie przedwcześnie (C-53).

## 4. RBAC / rejestr modułu (C-22)
- Slug: **istniejący `module.tasks`** — bez nowego uprawnienia, bez wpięć w `permissions.ts` /
  `modules.tsx` / `ModuleSidebar`. Feature to rozszerzenie istniejącej strony `/tasks`.

## 5. UI (C-30, C-31, C-32)
- **Trasa:** bez nowej — działamy w `src/components/tasks/TasksPage.tsx` (client) na widoku listy
  (`layout === "list"`).
- **Stan zaznaczenia w `TasksPage`:** `selectionMode: boolean`, `selectedIds: Set<string>`,
  `lastClickedId: string | null` (kotwica zakresu Shift). „Zaznacz wszystkie" operuje na
  `visibleTasks` (aktualnie widoczne po filtrach). Esc czyści i wychodzi z trybu (AC-11) — wpięte w
  istniejącą obsługę klawiszy.
- **`TaskList` → `TaskRow` (propsy):** przekazać `selectionMode`, `isChecked`,
  `onToggleSelect(id, shiftKey)`. W `TaskList` mamy już płaską kolejność renderu — indeks do zakresu
  Shift liczymy z posortowanej listy przekazanej do wierszy.
- **`TaskRow`:** gdy `selectionMode` — po lewej checkbox **≥ 20×20 px** (`var(--accent-blue)` gdy
  zaznaczony, `var(--border)` ramka); klik w wiersz w trybie zaznaczania **toggluje zaznaczenie**
  (nie otwiera szczegółów). Shift+klik = zakres. Poza trybem — zachowanie bez zmian. Desktop: checkbox
  pojawia się przy najechaniu (`group-hover`) lub gdy tryb aktywny. Mobile: **długie przytrzymanie**
  (`onTouchStart` + timer ~450 ms) wchodzi w tryb i zaznacza wiersz; alternatywnie przycisk „Zaznacz"
  w nagłówku listy (pewna ścieżka, gdy gest koliduje z przewijaniem — ryzyko z §9).
- **Nowy komponent `src/components/tasks/BulkActionBar.tsx`:** pływający pasek/bottom-sheet u dołu
  obszaru listy, widoczny gdy `selectedIds.size > 0`. Zawiera:
  - licznik „Zaznaczono N", „Zaznacz wszystkie / Odznacz", „Anuluj" (Esc),
  - akcje: **Status** (lista z `resolveStatuses(effectiveStatusConfig)` — statusy bieżącej listy,
    AC-12), **Priorytet** (`TASK_PRIORITY_LABELS`), **Termin** (input `date` + „Wyczyść termin"),
    **Kategoria** (pole tekstowe), **Projekt** (select z `allProjects`), **Tagi** (dodaj/usuń z
    `allTags` — dwa zestawy chipów), **Usuń** (z potwierdzeniem, kolor `--accent-red`).
  - Każda akcja wywołuje `bulkUpdateTasks`/`bulkDeleteTasks` w `useTransition`, po sukcesie pokazuje
    krótką informację „Zmieniono X z N" (gdy `skipped>0`) i czyści zaznaczenie.
  - **Styling:** wyłącznie zmienne CSS (`--bg-elevated`, `--border`, `--accent-*`, tekst na akcentach
    `--on-accent`) — C-30. Pozycja `sticky`/`fixed` z `padding-bottom: env(safe-area-inset-bottom)`,
    nie zasłania treści (lista dostaje dolny `padding` gdy pasek widoczny) — C-31. Na mobile pasek jako
    dolny sheet nad tab barem; **nigdy drugi sidebar** — nie dotyczy (pasek to nie nav).
  - Teksty po polsku (C-32).
- **Widoki Kanban/Timeline:** poza zakresem 1. wersji — przycisk „Zaznacz" i pasek pokazujemy tylko dla
  `layout === "list"` (spec §5).

## 6. AI / integracje (C-23, C-40)
- **Nie dotyczy.** Nie dodajemy `AIAction` ani read-toola (spec §6) → `check:actions` nie jest
  zagrożony. Kalendarz/agenda odświeżą się same przez `revalidatePath` po zmianie terminów; brak
  nowych powiadomień. Uwaga na bramkę **`check:ai-coverage`**: nowe eksporty `bulkUpdateTasks`/
  `bulkDeleteTasks` w `src/actions/tasks.ts` to mutujące Server Actions — trzeba dodać ich wpisy do
  `src/lib/ai/action-coverage.json` ze statusem `excluded` (powód: „bulk UI-only, brak akcji AI w 1.
  wersji"), inaczej `scripts/check-ai-coverage.js` wywali build.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `src/actions/tasks.ts` | edycja | `bulkUpdateTasks`, `bulkDeleteTasks` (+ `revalidatePath`, guard, soft-delete) |
| `src/components/tasks/BulkActionBar.tsx` | nowy | pływający pasek/bottom-sheet akcji zbiorczych |
| `src/components/tasks/TaskRow.tsx` | edycja | checkbox zaznaczania, klik/Shift+klik/long-press |
| `src/components/tasks/TaskList.tsx` | edycja | przekazanie propsów zaznaczenia + indeksu do zakresu |
| `src/components/tasks/TasksPage.tsx` | edycja | stan `selectionMode`/`selectedIds`, przycisk „Zaznacz", render `BulkActionBar`, Esc |
| `src/lib/ai/action-coverage.json` | edycja | wpisy `excluded` dla obu nowych akcji (bramka `check:ai-coverage`) |
| `doświadczenia.md` | edycja (jeśli wyjdzie bug) | log lekcji wg C-51 |

## 8. Bramki i weryfikacja (C-50)
- Lokalna weryfikacja: lokalny Postgres + `npx prisma migrate deploy` (schemat bez zmian, ale build i
  tak wymaga generacji Prisma) — **nigdy prod DB** (C-13). Zatrzymujemy się na kroku `next build`.
- `npm run check:actions`, `npm run check:ai-coverage`, `npm run check:migrations`, `next lint`,
  `next build`.
- **Mapowanie AC → weryfikacja:**
  - AC-1/AC-9/AC-11 — ręczny klik w widoku listy (tryb, licznik, „zaznacz wszystkie", Esc).
  - AC-2/AC-3/AC-5/AC-6 — zaznacz kilka zadań, ustaw pojedyncze pole, sprawdź w DB/Studio że zmieniło
    się tylko to pole (nietknięte bez zmian) i tylko dla zaznaczonych.
  - AC-4 — ustaw i wyczyść termin zbiorczo.
  - AC-7 — dodaj tag T i usuń tag U; potwierdź, że pozostałe tagi zadań zostały.
  - AC-8 — usuń zbiorczo, sprawdź obecność wpisów w `/trash` i brak na liście.
  - AC-10 — zaznaczenie z zadaniem bez prawa edycji (np. współdzielone VIEWER) → licznik „X z N",
    pozycja niezmieniona.
  - AC-12 — na liście z custom statusami pasek pokazuje statusy tej listy.
  - AC-13 — DevTools mobile: checkbox ≥ 20×20, pasek respektuje safe-area, Shift+klik na desktopie.

## 9. Ryzyka techniczne i plan wycofania
- **Long-press vs przewijanie/drag&drop kolejności na mobile** → próg czasu + ruchu anuluje gest;
  zawsze dostępny przycisk „Zaznacz" jako pewna alternatywa. Mitygacja w `TaskRow`.
- **Zakres Shift+klik przy grupowaniu** (lista dzielona na sekcje dni/projektów/priorytetów) → zakres
  liczymy po faktycznej kolejności renderu przekazanej do wierszy; jeśli sekcje utrudniają globalny
  indeks, ograniczamy zakres do bieżącej sekcji (akceptowalne, opisać w `/verify`).
- **Częściowe uprawnienia** → jawny wynik „zmieniono X z N"; brak cichych rozjazdów (AC-10).
- **Rollback:** czysto kodowy (brak migracji) — rewert commita cofa całość; żadnego stanu w DB do
  odkręcania (runbook devops: rollback kodu).

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **bez zmian schematu**, brak migracji; statusy `String`+union (C-12).
- [x] C-20..C-25 — Server Actions z `revalidatePath` (C-20); guard `assertTaskAccess`/własność (C-21);
  slug istniejący `module.tasks` (C-22); brak nowej `AIAction`, ale wpis `excluded` w manifeście
  (C-23); soft-delete do Kosza (C-24); brak zmian RBAC/config → C-25 nie dotyczy.
- [x] C-30..C-32 — kolory ze zmiennych CSS, `--on-accent` na akcentach (C-30); mobile-first, checkbox
  20×20, `safe-area`, Esc (C-31); teksty PL (C-32).
- [x] C-53 (minimalizm) — brak nowego modułu/trasy/migracji/zależności; maksymalne reużycie
  `updateTask`/`deleteTask`/istniejących komponentów i pickerów.
