# Plan techniczny: Model daty zrobienia zadań cyklicznych (link wystąpień + bulk rolowanie) + usunięcie ikony sortu

- **Spec:** ./spec.md (022-recurring-completion-date-model)
- **Status:** draft
- **Data:** 2026-07-22

> **Zasada planu:** to jest **JAK**, pod istniejący kod modułu Tasks. Wzorzec do naśladowania = sam
> moduł Tasks (020/021): `completeRecurringTask`, `updateTask`/`bulkUpdateTasks`, pola dat w `TaskDetail`.

## 1. Podejście (2–4 zdania)
Domykamy model zapoczątkowany w 020/021 czterema minimalnymi zmianami: (a) trwały **link wystąpień**
cyklicznych przez nowe, nullable, self-referencyjne pole `Task.previousTaskId` (jak istniejące
`parentTaskId`, `onDelete: SetNull`); (b) **bulk „Zrobione" roluje cykliczne** przez istniejącą akcję
`completeRecurringTask` zamiast surowego `update`; (c) **sync** „daty ostatniego zrobienia" następcy przy
edycji `completedAt` poprzednika; (d) UI — przeniesienie/restyl pola daty pod „Start" i usunięcie ikony
sortu. Wszystko trzyma się wzorca sąsiednich pól/akcji (C-53), bez nowych zależności.

## 2. Model danych (Prisma)
- **Zmieniony model:** `Task` — nowa kolumna `previousTaskId String?` (nullable). Semantyka: wskazuje
  **domknięte** wystąpienie cykliczne, które utworzyło to (nowe) wystąpienie. Statusy pozostają `String`
  (bez enumów — C-12); to pole to zwykły nullable FK.
- **Relacja:** nowa self-relacja `Task` o nazwie **`TaskRecurrence`** (odrębna od istniejącej
  `TaskSubtasks`):
  - `previous  Task?   @relation("TaskRecurrence", fields: [previousTaskId], references: [id], onDelete: SetNull)`
  - `nextOccurrences Task[] @relation("TaskRecurrence")`
  - `@@index([previousTaskId])`
  - `onDelete: SetNull` — usunięcie/soft-delete poprzednika **nie** kaskaduje na następcę (C-24).
- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: **`0208`**
  - Katalog: `prisma/migrations/0208_task_previous_occurrence/migration.sql`
  - DDL:
    ```sql
    ALTER TABLE "Task" ADD COLUMN "previousTaskId" TEXT;
    CREATE INDEX "Task_previousTaskId_idx" ON "Task"("previousTaskId");
    ALTER TABLE "Task" ADD CONSTRAINT "Task_previousTaskId_fkey"
      FOREIGN KEY ("previousTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ```
  - Bez backfillu (świadomie poza zakresem — spec §5): spójność od następnego domknięcia.

## 3. Warstwa serwera (Server Actions — C-20)
Plik: `src/actions/tasks.ts` (istniejący; guardy `assertTaskAccess`/`requireAuth` + `revalidatePath`
bez zmian — C-21).

- **`completeRecurringTask`** — w `prisma.task.create({ data: {…} })` (tworzenie następnego
  wystąpienia) dodać **`previousTaskId: existing.id`** obok istniejącego `lastCompletedAt: completedAt`.
  To realizuje AC-2 (link + „ostatnie zrobienie" = data zrobienia poprzednika). Reszta funkcji bez zmian.
- **`updateTask`** — po `prisma.task.update(...)` dodać **sync następcy** (AC-4): gdy jawnie podano datę
  (`explicitCompletedAt !== undefined`), wykonać
  `await prisma.task.updateMany({ where: { previousTaskId: id }, data: { lastCompletedAt: explicitCompletedAt } })`.
  `updateMany` obsłuży 0 lub 1 następcę (brak następcy → no-op; zwykłe/niecykliczne bez wpływu).
  `revalidatePath("/tasks")` już jest.
- **`bulkUpdateTasks`** — w pętli, w gałęzi domykania: zamiast bezwarunkowego surowego `update` dla
  `newStatus === "DONE" && existing.status !== "DONE"` rozgałęzić (AC-1):
  - jeśli `existing.recurring` → **`await completeRecurringTask(id, scalar.completedAt ? { completionDate: scalar.completedAt.toISOString() } : {})`** (tworzy kolejne wystąpienie tak jak pojedyncze odhaczenie, z ewentualną wspólną datą z 021); **usunąć `status` z `data`**, a pozostałe pola skalarne (priorytet/kategoria/projekt) i operacje tagów zastosować do domkniętego rekordu jak dotąd;
  - w przeciwnym razie zachowanie jak dziś: `data.completedAt = scalar.completedAt ?? new Date()`.
  - Gałąź „status nieterminalny" (`newStatus && newStatus !== "DONE" → completedAt = null`) bez zmian.
  - Uwaga: panel „Status" w bulku wysyła tylko `status` (+ opcjonalnie `completedAt`), więc kolizja z
    priorytetem/projektem w praktyce nie zachodzi; kod i tak stosuje resztę `data` bezpiecznie.
- `toTask` to rzutowanie — `previousTaskId` (pole skalarne) wraca automatycznie; **`TASK_INCLUDE` bez
  zmian**.

## 4. RBAC / rejestr modułu (C-22)
- Bez zmian — istniejący slug `module.tasks`, istniejące guardy dostępu. Brak wpięć w
  `permissions.ts`/`modules.tsx`/`ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
- **`src/components/tasks/TaskDetail.tsx`**
  - **Przenieść** edytowalne pole „data zrobienia" ze stopki **Meta** (obecnie ~845–857) **pod pole
    „Start"** (po bloku ~527). Wyrównać styl do „Start": `Calendar size={13}` + `label w-20` „Zrobione”
    + `input type="date"` klasy `flex-1 … border rounded px-2 py-1`, kolory ze zmiennych
    (`--text-muted`/`--border`/`--text-secondary`). Zachować warunek `task.completedAt` (pole widoczne,
    gdy zadanie ma datę zrobienia) i handler `handleCompletedAtChange` (bez zmian). (AC-5)
  - **Rozróżnienie w szczegółach (AC-3):** tuż pod polem „Zrobione" dodać **read-only** wiersz
    „Ostatnio zrobione: &lt;data&gt;”, renderowany gdy `task.lastCompletedAt && !task.completedAt`
    (aktywne cykliczne pokazuje datę ostatniego zrobienia poprzednika, nie własną). Styl jak inne meta
    (tekst `--text-muted`).
  - Ze stopki **Meta** usunąć blok „Ukończone: …" (zostają tylko „Utworzone/Zaktualizowane").
- **`src/components/tasks/TasksPage.tsx`** — usunąć: stan `sortBy` (~66), load/save z localStorage
  (`tasks.sortBy`, ~132–140), przycisk „Sortuj zrobione po dacie wykonania" (~576–585) i przekazanie
  `sortBy={sortBy}` do `TaskList` (~804). Usunąć nieużywany import `CalendarCheck`; poprawić komentarz
  z listą ikon (~505). (AC-7)
- **`src/components/tasks/TaskList.tsx`** — usunąć prop `sortBy` (typ ~17 i sygnatura ~58) oraz jego
  przekazanie do `CompletedSection` (~205, ~227).
- **`src/components/tasks/CompletedSection.tsx`** — usunąć prop `sortBy`, `doneTime`, `ordered`,
  `key={sortBy}`, warunkowy `label`/`defaultOpen`. Sekcja wraca do domyślnej kolejności (`tasks`),
  stały label „✓ Zrobione / Anulowane", `defaultOpen={false}`, `muted`. (AC-7)
- **`src/components/tasks/TaskRow.tsx`** — **bez zmian**: znacznik „✓ &lt;data&gt;" (czyta
  `completedAt ?? lastCompletedAt`) pozostaje. (AC-7)
- Teksty PL; mobile/keyboard bez zmian (nie dotykamy layoutu list ani skrótów).

## 6. AI / integracje (C-23, C-40)
- **Nie dotyczy.** Brak nowej `AIAction`/read-toola; sygnatury akcji AI bez zmian (`completedAt` już było
  opcjonalne z 021, nowy `previousTaskId` ustawiany wyłącznie wewnętrznie w `completeRecurringTask`).
  `check:actions` pozostaje zielony. Kalendarz/powiadomienia/trash bez zmian (link SetNull nie łamie
  soft-delete).

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/prisma/schema.prisma` | edycja | `Task.previousTaskId` + relacja `TaskRecurrence` + indeks |
| `worldofmag/prisma/migrations/0208_task_previous_occurrence/migration.sql` | nowy | DDL kolumny/indeksu/FK (C-10) |
| `worldofmag/src/types/index.ts` | edycja | dodać `previousTaskId: string \| null` do typu `Task` |
| `worldofmag/src/actions/tasks.ts` | edycja | link w `completeRecurringTask`; bulk roluje cykliczne; sync następcy w `updateTask` |
| `worldofmag/src/components/tasks/TaskDetail.tsx` | edycja | pole „Zrobione" pod „Start" + read-only „Ostatnio zrobione"; usunąć z Meta |
| `worldofmag/src/components/tasks/TasksPage.tsx` | edycja | usunąć stan/przełącznik/persist sortu |
| `worldofmag/src/components/tasks/TaskList.tsx` | edycja | usunąć prop `sortBy` (przelot) |
| `worldofmag/src/components/tasks/CompletedSection.tsx` | edycja | usunąć logikę sortu, domyślna kolejność |
| `doświadczenia.md` | edycja | wpis-lekcja (C-51) |

## 8. Bramki i weryfikacja (C-50)
- Lokalny Postgres (C-13): `pg_ctlcluster 16 main start`, `.env.local` → `127.0.0.1:5432`, eksport
  `DATABASE_URL`/`DIRECT_URL`, `npx prisma migrate deploy` (zaaplikuje 0208). **Nigdy** prod DB /
  `scripts/migrate.js`.
- `npm run check:migrations` (0208 unikalny), `npm run check:actions` (bez nowych akcji AI),
  `next lint --dir src`, `next build` (do kroku build; bez `migrate.js`).
- Mapowanie AC → weryfikacja:
  - **AC-1** — bulk „Zrobione" na cyklicznym: powstaje kolejne wystąpienie (jak pojedyncze); podana
    wspólna data trafia na domknięte. Sprawdzenie w `bulkUpdateTasks` (gałąź `existing.recurring`).
  - **AC-2** — `completeRecurringTask` ustawia `previousTaskId` + `lastCompletedAt` na następcy.
  - **AC-3** — `TaskDetail` pokazuje „Ostatnio zrobione" dla aktywnego cyklicznego; wiersze bez zmian
    (`completedAt ?? lastCompletedAt`).
  - **AC-4** — edycja `completedAt` w szczegółach → `updateMany(previousTaskId=id)` aktualizuje
    `lastCompletedAt` następcy.
  - **AC-5** — pole daty pod „Start", ten sam wzorzec markup/stylów.
  - **AC-6** — `toggleTaskStatus`/klik ikony/`x` bez zmian → „dziś" natychmiast (wariant A).
  - **AC-7** — brak przełącznika sortu; `CompletedSection` w domyślnej kolejności; znacznik „✓" w
    `TaskRow` obecny.
  - **AC-8** — niecykliczne/zwykłe pola i inne widoki nietknięte; `next build` zielony.

## 9. Ryzyka techniczne i plan wycofania
- **Self-FK a soft-delete/Kosz:** `onDelete: SetNull` — usunięcie poprzednika zeruje `previousTaskId`
  następcy, nie kaskaduje (C-24). Zgodne z istniejącym `parentTaskId`.
- **Bulk wołające `completeRecurringTask` w pętli:** dodatkowe `requireAuth`/`assertTaskAccess` per
  zadanie — akceptowalny narzut (zaznaczenia są małe); poprawność > mikrooptymalizacja.
- **Nadpisanie `completedAt` w bulku dla cyklicznych:** obsłużone przez `completionDate` w
  `completeRecurringTask` (nie przez surowy `update`), więc data poprawna i spójna z 021.
- **Rollback:** kod — revert commita; migracja — 0208 tylko dodaje kolumnę/indeks/FK (addytywna,
  nieniszcząca), bezpieczna do pozostawienia (por. runbook devops). Brak potrzeby down-migracji.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — ręczna migracja 0208, numer z `next:migration`, bez enumów.
- [x] C-20..C-25 — zmiany w Server Actions z `revalidatePath`; guardy dostępu bez zmian; brak nowej
  `AIAction`; SetNull nie łamie soft-delete/Kosza; brak zmian RBAC/audytu.
- [x] C-30..C-32 — pola/etykiety na zmiennych CSS, teksty PL, layout mobile/keyboard nietknięty.
- [x] C-53 (minimalizm) — najmniejszy zestaw: jedno pole + reuse istniejącej akcji cyklicznej + usunięcie
  martwej logiki sortu; zero nowych zależności/abstrakcji.
