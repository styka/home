# Plan techniczny: Edytowalna data wykonania + wybór daty przy oznaczaniu jako zrobione (single + bulk)

- **Spec:** ./spec.md (021-task-completion-date-edit)
- **Status:** draft
- **Data:** 2026-07-22

> **Zasada planu:** to jest **JAK**. Rozszerzamy istniejące akcje i UI modułu Tasks; **bez zmian
> schematu** (kolumny `completedAt`/`lastCompletedAt` już istnieją). Naśladujemy istniejące wzorce
> edycji dat (`dueDate`/`startDate`) i panel „Termin" w bulku.

## 1. Podejście
`completedAt` staje się **jawnie ustawialny**: `updateTask` przyjmie `completedAt` w patchu (jawna
wartość ma pierwszeństwo nad wyliczoną ze statusu), a `bulkUpdateTasks` przyjmie opcjonalny wspólny
`completedAt` (domyślnie `new Date()`). UI: w `TaskDetail` „Ukończone" staje się **edytowalnym polem
daty** (wzór `handleStartDateChange`), a w `BulkActionBar` panel „Status" dostaje opcjonalne pole daty
wykonania stosowane przy przełączaniu na status terminalny. Szybkie odhaczanie w wierszu bez zmian.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** `Task.completedAt` (istnieje), `Task.lastCompletedAt` (z 020) wystarczają.
Brak migracji → `npm run check:migrations` zielony (żadnego nowego katalogu).

## 3. Warstwa serwera (Server Actions — C-20)
Plik: `src/actions/tasks.ts`.

### 3.1 `updateTask` — przyjmij jawny `completedAt` (priorytet nad derivacją)
- Rozszerzyć typ patcha o `completedAt?: Date | null`.
- Logika (obecnie ~229–240): policz `derived` jak dziś (status→DONE ⇒ teraz; status→inny ⇒ null; brak
  zmiany statusu ⇒ undefined). Następnie **jawny wygrywa**:
  `const finalCompletedAt = patch.completedAt !== undefined ? patch.completedAt : derived;`
  `if (finalCompletedAt !== undefined) data.completedAt = finalCompletedAt;`
  (Nie wkładać `completedAt` bezpośrednio przez `{ ...patch }` — usunąć z rozlania, żeby nie ominąć
  logiki; ustawiamy je jawnie.)
- Guard C-21: `assertTaskAccess` już jest; `revalidatePath("/tasks")` + projekt — bez zmian.

### 3.2 `bulkUpdateTasks` — opcjonalny wspólny `completedAt`
- Rozszerzyć typ patcha o `completedAt?: Date | null`.
- W pętli (obecnie ~357–358): `if (newStatus === "DONE" && existing.status !== "DONE") data.completedAt
  = scalar.completedAt ?? new Date();` — podana wspólna data albo „teraz" (dotychczasowe zachowanie).
  (Uwzględnić `scalar.completedAt` przy destrukturyzacji `{ addTagIds, removeTagIds, ...scalar }`.)
- `revalidatePath` na końcu — bez zmian.

### 3.3 Cykliczne (spójność z 020) — bez zmian
- `completeRecurringTask` już przyjmuje `completionDate` i przenosi ją na `lastCompletedAt`. Ta ścieżka
  pozostaje; nie ruszamy jej (AC-6). (Bulk/`updateTask` na cyklicznym zadaniu działają na bieżącym
  rekordzie jak dotąd — poza zakresem zmiany zachowania cyklu.)

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Istniejący `module.tasks`, istniejący guard dostępu.

## 5. UI (C-30, C-31, C-32)

### 5.1 Edytowalne „Ukończone" w `TaskDetail` — AC-1, AC-3
- Plik: `src/components/tasks/TaskDetail.tsx`.
- Zamienić read-only `{task.completedAt && <div>Ukończone: …</div>}` (~836) na **edytowalne pole daty**:
  gdy `task.completedAt` istnieje → `<input type="date" value={toDateValue(task.completedAt)}
  onChange={handleCompletedAtChange}>` (styl/wzór jak pole „Start"), z etykietą „Ukończone".
- Handler (wzór `handleStartDateChange`): `run(() => updateTask(task.id, { completedAt:
  parseDateInput(v, { dayOnly: true }) }))`; stan lokalny `completedAtValue` + sync w `useEffect`
  (jak `startDate`). Pusta wartość → dopuszczamy `null` (wyczyszczenie), spójnie z parseDateInput.
- Kolory ze zmiennych CSS, tekst PL. (Data-only wystarcza — spójne ze znacznikiem „✓ <data>" z 020.)

### 5.2 Opcjonalna wspólna data w bulku „Status → Zrobione" — AC-4, AC-5
- Plik: `src/components/tasks/BulkActionBar.tsx`.
- Rozszerzyć `BulkPatch` o `completedAt?: Date | null`.
- W panelu `panel === "status"` dodać **na górze** opcjonalne pole daty: `<input type="date">` +
  krótka etykieta „Data wykonania (opcjonalnie — dla »Zrobione«)". Stan `doneDateValue`.
- Przy kliknięciu statusu: `apply({ status: s.key, completedAt: (statusMetaFor(s.key,
  statusConfig).isTerminal && doneDateValue) ? new Date(doneDateValue + "T12:00:00") : undefined })`.
  Gdy data pusta lub status nieterminalny → `completedAt` niewysyłane (bulk użyje „teraz"/nie ruszy).
- `TasksPage.applyBulk` przekazuje cały patch do `bulkUpdateTasks` (generycznie) — bez zmian.
- Kolory/układ jak istniejący panel „Termin"; teksty PL.

### 5.3 Szybkie odhaczanie w wierszu — bez zmian (AC-7)
- `toggleTaskStatus`/klik ikony statusu w `TaskRow` — nietknięte; nadal „teraz".

## 6. AI / integracje (C-23, C-40)
**Nie dotyczy.** Brak nowej `AIAction`/read-toola. Uwaga: `updateTask`/`bulkUpdateTasks` są mapowane w
AI-execute — rozszerzenie ich **opcjonalnym** polem `completedAt` nie zmienia sygnatury wywoływanej
przez AI (pole opcjonalne). `check:actions` zielony.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/actions/tasks.ts` | edycja | `updateTask` + `bulkUpdateTasks`: przyjmij `completedAt` (jawny priorytet / wspólny w bulku) |
| `worldofmag/src/components/tasks/TaskDetail.tsx` | edycja | Edytowalne pole daty „Ukończone" (AC-1/AC-3) |
| `worldofmag/src/components/tasks/BulkActionBar.tsx` | edycja | `BulkPatch.completedAt` + opcjonalne pole daty w panelu „Status" |
| `doświadczenia.md` (root) | edycja | C-51: jawny `completedAt` vs derivacja ze statusu (priorytet), wspólna data w bulku |

## 8. Bramki i weryfikacja (C-50)
- Lokalny Postgres (C-13): migracje już zaaplikowane (brak nowych); `prisma generate` niepotrzebne
  (brak zmian schematu). `npm run check:migrations`, `npm run check:actions`, `next lint --dir src`,
  `next build`. **Nie** `scripts/migrate.js` na prod.
- Mapowanie AC → weryfikacja:
  - **AC-1** — `TaskDetail` pole „Ukończone" edytowalne → `updateTask({ completedAt })`; znacznik „✓" (020) odzwierciedla.
  - **AC-2** — logika derivacji zachowana (status→inny ⇒ null; →DONE bez daty ⇒ teraz).
  - **AC-3** — po oznaczeniu done pole daty edytowalne → zapis wskazanej daty (jawny priorytet w updateTask).
  - **AC-4** — bulk „Zrobione" bez daty → `new Date()` (istniejące).
  - **AC-5** — bulk z podaną datą → wszystkie dostają tę datę (`scalar.completedAt`).
  - **AC-6** — `completeRecurringTask`/`lastCompletedAt` nietknięte (prześledzenie: brak zmian w tej ścieżce).
  - **AC-7** — `toggleTaskStatus`/wiersz bez zmian.

## 9. Ryzyka techniczne i plan wycofania
- **Ryzyko:** `{ ...patch }` w `updateTask` wrzuciłby `completedAt` z pominięciem logiki priorytetu.
  Mitygacja: wyłączyć `completedAt` z rozlania i ustawiać jawnie po policzeniu `final`. (Kluczowy punkt
  recenzji.)
- **Ryzyko:** strefa czasowa — `type=date` + „T12:00:00"/`dayOnly` (jak istniejące pola) unika przeskoku
  dnia. Mitygacja: użyć tych samych helperów co `startDate`.
- **Ryzyko:** edycja `completedAt` na zadaniu, które potem zmieni status → derivacja nadpisze. To
  zamierzone (status rządzi): zmiana na „inny" czyści datę; zmiana na „Zrobione" bez podanej daty =
  teraz. Ujęte w AC-2.
- Rollback: zmiany w 3 plikach klienta/akcji, brak migracji → zwykły revert kodu.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak zmian schematu; jawnie).
- [x] C-20..C-25 — zmiana w Server Actions z istniejącym `revalidatePath`+guard; brak RBAC/AI/trash/audit.
- [x] C-30..C-32 — pola daty/etykiety na zmiennych CSS, teksty PL, wzorce istniejących pól.
- [x] C-53 (minimalizm) — rozszerzamy istniejące akcje/UI, zero nowych modeli/zależności/migracji.
