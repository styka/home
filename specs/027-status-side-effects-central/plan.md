# Plan techniczny: Wymuszanie automatycznych efektów zmiany statusu — centralnie

- **Spec:** ./spec.md (027-status-side-effects-central)
- **Status:** draft
- **Data:** 2026-07-23

> **Zasada planu:** to jest **JAK**, pod istniejący kod Omnia. Wzorzec do naśladowania to sama warstwa
> domenowa Tasks (`src/actions/tasks.ts`), gdzie efekty uboczne już mają jedno miejsce dla ścieżek UI —
> rozszerzamy je na **jedno miejsce dla wszystkich wejść**.

## 1. Podejście
Konsolidacja, nie nowa funkcja. Efekt „domknięcie zadania cyklicznego = utworzenie następnego
wystąpienia" przenosimy do **jednego punktu egzekucji** — `updateTask` — tak, aby **każde** wejście
(UI, asystent AI, operacje zbiorcze) dawało identyczny wynik przez samo wywołanie `updateTask`.
Analogicznie w Pets doprowadzamy ścieżkę AI do wołania istniejącej logiki domenowej (`completeTreatment`)
zamiast jej równoległej kopii. Health/Leki i Habits — audyt potwierdza parytet (executory już wołają
akcje domenowe), więc bez zmian kodu, tylko odnotowanie. **Bez zmian w schemacie bazy.**

## 2. Model danych (Prisma)
**Bez zmian w schemacie. Brak migracji.** Feature jest czysto aplikacyjny — nie dodaje modeli/kolumn,
nie zmienia statusów (pozostają `String` + union TS — C-12). Reguły cykliczności, kotwice dat i pola
`previousTaskId`/`lastCompletedAt`/`nextDueAt` (specy 020/022/023) zostają nietknięte.

## 3. Warstwa serwera (Server Actions — C-20)
Plik: `src/actions/tasks.ts` (istniejący). Wszystkie funkcje kończą się `revalidatePath("/tasks")`
(+ per-projekt) jak dziś. Guardy dostępu (`assertTaskAccess`, `assertProjectAccess`) i własność
`ownerId`/`ownerTeamId` (C-21) — bez zmian.

**Rdzeń zmiany — jeden punkt egzekucji spawn'u w `updateTask`:**
1. Wydzielić prywatny, pure-ish helper tworzący następne wystąpienie z rekordu poprzednika:
   `spawnRecurringSuccessor(existing, { completedAt, anchor?, nextDueOverride? })` — przeniesienie
   istniejącego bloku „create następnika" z `completeRecurringTask` (obliczenie `nextDue` przez
   `computeNextDue` z bazą wg kotwicy, cutoff `endDate`, przesunięcie `startDate`, kopiowanie tagów,
   `previousTaskId`, `lastCompletedAt`). Zwraca utworzone zadanie albo `null` (koniec serii).
2. W `updateTask`, po `prisma.task.update` (nałożenie patcha), dodać **jedyny** warunek spawn'u:
   `patch.status === "DONE" && existing.status !== "DONE" && existing.recurring` → wywołać
   `spawnRecurringSuccessor(existing, { completedAt: finalCompletedAt ?? new Date(), ...recurringOpts })`.
   Warunek „prawdziwego przejścia" (`existing.status !== "DONE"`) czysto oddziela **pierwsze domknięcie**
   (spawn) od **późniejszej edycji daty wykonania już domkniętego** (brak spawn'u; obsługuje to blok
   022/023 działający na *istniejącym* następcy). To zachowuje specy 020/022/023 bez konfliktu.
3. Rozszerzyć `updateTask` o **wewnętrzny** 3. parametr `opts?: { recurring?: CompleteRecurringOptions }`
   (nie zmienia publicznego kształtu patcha), przez który przekazujemy jednorazowe odstępstwa
   (`anchor`/`nextDueOverride`/`completionDate`) tylko na potrzeby wrappera.

**`completeRecurringTask(id, opts)` → cienki wrapper (koniec z podwójną egzekucją):**
- Ustala `completedAt` z `opts.completionDate` i woła **raz** `updateTask(id, { status:"DONE",
  completedAt }, { recurring: opts })`. To jedyne miejsce spawn'u (w `updateTask`) gwarantuje brak
  dubletu. Wrapper zwraca **następcę** (dogrywa `findFirst({ previousTaskId:id }, order desc)`), żeby
  zachować dotychczasowy kontrakt zwrotu (UI/AI oczekują nowego wystąpienia). Usuwamy z niego:
  osobne `updateTask(status:DONE)` + osobny zapis `completedAt` + własny `prisma.task.create` następnika
  (te przenosi helper wołany z `updateTask`).

**Uproszczenie wywołujących (redukcja rozjazdów):**
- `toggleTaskStatus`: usunąć specjalny `if (next==="DONE" && task.recurring) return completeRecurringTask(id)`
  — teraz wystarcza `updateTask(id, { status: next })`, bo `updateTask` wymusza spawn (kotwica z reguły
  zadania, jak dotąd). Mniej ścieżek = mniej pułapek.
- `bulkUpdateTasks`: gałąź `isDoneTransition && existing.recurring` nadal woła `completeRecurringTask`
  (wrapper) — pojedynczy spawn zachowany; niecykliczne DONE zostają surowym updatem jak dziś. Bez zmian
  logiki, tylko korzysta z nowej, jednopunktowej egzekucji.
- **Executory AI zadań** (`src/lib/ai/executors/tasksExecutor.ts`, `update_task` i `update_task_status`):
  **bez zmian** — już wołają `updateTask`, które teraz robi spawn. To realizuje AC-1 (naprawa zgłoszonego
  błędu) „za darmo" przez centralizację.

**Pets — doprowadzenie ścieżki AI do domeny:**
- `src/lib/ai/executors/petExecutor.ts`, `log_treatment_done`: zastąpić własne liczenie
  (`parseRecurringRule`+`computeNextDue`+`petCareLog.create`+`petTreatment.update`) **jednym** wywołaniem
  domenowego `completeTreatment(t.id)` (z `@/actions/petCare`). Lookup zabiegu po nazwie zostaje w
  executorze; usuwamy duplikat (który tworzył własny `petCareLog` i inaczej dobierał bazę terminu).
  `completeTreatment` już respektuje `endDate` (`nextDueFrom`) i tworzy log — parytet z UI.

**Health/Leki i Habits — audyt (bez zmian kodu):**
- `healthExecutor` (`log_dose`/`unlog_dose`) woła domenowe `logDose`/`unlogDose`; `habitsExecutor`
  (`toggle_habit`) woła `toggleHabitDay`; `createTaskFromHabit` woła `createTask`. Parytet zachowany —
  odnotować w `verify.md`/audycie jako „sprawdzone, brak rozjazdu".

## 4. RBAC / rejestr modułu (C-22)
Bez zmian. Korzystamy z istniejących `module.tasks`, `module.pets`, `module.health`, `module.habits`.
Brak nowego slugu, brak wpięć w `permissions.ts`/`modules.tsx`/`ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
Bez zmian w UI. Komponenty Tasks (`TaskRow`, `TaskDetail`, `BulkActionBar`) już wołają
`toggleTaskStatus`/`updateTask`/`bulkUpdateTasks`/`completeRecurringTask` — zachowanie widoczne dla
użytkownika pozostaje identyczne (dla ścieżek UI nic się nie zmienia), zmienia się tylko to, że **AI
i inne wejścia dołączają do tej samej semantyki**. Zero hardcodowanych kolorów, brak nowych tras.

## 6. AI / integracje (C-23, C-40)
- **Brak nowych `AIAction`** → `check:actions` bez ryzyka (istniejące typy mają egzekutory).
- Zmiana dotyczy *zachowania* istniejących egzekutorów (Tasks: bez zmian w kodzie executora, zysk przez
  `updateTask`; Pets: przekierowanie do domeny). Read-toole/kalendarz/powiadomienia bez zmian; poprawny
  spawn utrzymuje spójność agendy (kalendarz agreguje `dueDate` zadań — nowe wystąpienie pojawi się
  automatycznie).
- Routing LLM (C-40) nie dotyczy — to warstwa danych, nie wywołania modelu.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `src/actions/tasks.ts` | edycja | Helper `spawnRecurringSuccessor`; spawn jako jedyny punkt w `updateTask` (+ wewn. opts); `completeRecurringTask` → wrapper; uproszczenie `toggleTaskStatus` |
| `src/lib/ai/executors/petExecutor.ts` | edycja | `log_treatment_done` woła `completeTreatment` zamiast reimplementacji |
| `src/lib/__tests__/recurrenceSuccessor.test.ts` | nowy | Testy jednostkowe czystej logiki wyliczania pól następnika (kotwica DUE/COMPLETION, `endDate` cutoff, przesunięcie `startDate`) — lock zachowania |
| `specs/027-status-side-effects-central/verify.md` | (etap 5) | Audyt AC-5: tabela wejście→akcja domenowa dla wszystkich objętych modułów |
| `doświadczenia.md` | edycja | Wpis o pułapce „logika biznesowa w wywołującym vs warstwie domenowej" (C-51) |

## 8. Bramki i weryfikacja (C-50)
- Lokalnie: `npm run test:unit` (nowe + istniejące `recurrence*.test.ts`), `npm run check:actions`,
  `npm run check:migrations`, `next lint`, `next build`. **Bez** `migrate.js` na prod DB (C-13); migracji
  brak, więc krok DB nie dotyczy.
- Mapowanie AC → weryfikacja:
  - **AC-1/AC-2** — czytanie kodu: jedyny punkt spawn'u to `updateTask`; toggle/bulk/executory AI zbiegają
    się do niego → identyczny wynik. Test jednostkowy helpera potwierdza wyliczenie następnika.
  - **AC-3** — logika `completedAt` w `updateTask` (→DONE=data, →inny=null) nietknięta; obowiązuje dla
    wszystkich wejść, bo wszystkie idą przez `updateTask`.
  - **AC-4** — `petExecutor.log_treatment_done` woła `completeTreatment` (ta sama funkcja co UI) → parytet;
    weryfikacja przez czytanie diffu + brak drugiego `petCareLog`.
  - **AC-5** — tabela audytu w `verify.md`: każde wejście zmiany stanu → jedna akcja domenowa.
  - **AC-6** — istniejące `recurrence.test.ts`/`recurrence-edges.test.ts` zielone + nowy test; blok 022/023
    (edycja daty domkniętego) pozostaje, warunek „prawdziwego przejścia" go nie narusza.
  - **AC-7** — `next build` zielony.

## 9. Ryzyka techniczne i plan wycofania
- **Podwójny spawn** (updateTask i completeRecurringTask oba tworzą następnika) → mitygacja: helper
  wołany **wyłącznie** z `updateTask`; `completeRecurringTask` nie tworzy już następnika, tylko woła
  `updateTask`. Warunek `existing.status !== "DONE"` blokuje spawn przy powtórnym zapisie tego samego
  rekordu.
- **Regresja 022/023** (edycja daty wykonania domkniętego zadania) → warunek przejścia oddziela pierwsze
  domknięcie od późniejszej edycji; blok synchronizacji następcy zostaje.
- **Zmiana kontraktu zwrotu** `completeRecurringTask` (miał zwracać następcę) → wrapper dogrywa i zwraca
  następcę.
- **Pets: podwójny log** → usuwamy własny `petCareLog.create` z executora; `completeTreatment` tworzy go raz.
- **Rollback:** czysto kodowy (brak migracji) — rewert commita. Zgodnie z runbookiem devops: brak granicy
  build↔migracja.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **brak zmian w schemacie**, brak migracji (świadomie).
- [x] C-20..C-25 — Server Actions z `revalidatePath`; guardy/własność nietknięte; brak nowej `AIAction`
      (C-23 spełnione); Trash/Audit nie dotyczą tej zmiany.
- [x] C-30..C-32 — brak zmian UI; teksty PL zachowane; motyw nietknięty.
- [x] C-53 (minimalizm) — konsolidacja istniejącej logiki do jednego punktu; zero nowych zależności,
      zero enumów, zero refaktorów niezwiązanych z efektami cyklicznymi.
- [x] C-12 — statusy pozostają `String` + union.
- [x] C-51 — wpis do `doświadczenia.md` zaplanowany.
