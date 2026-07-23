# Weryfikacja: Wymuszanie automatycznych efektów zmiany statusu — centralnie

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-23
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`), migracje zaaplikowane (`prisma migrate deploy`).

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run test:unit` (lokalny Postgres) | ✅ 428/428 pass, 0 fail (w tym 8 nowych `recurrenceSuccessor.test.ts` + integracyjne DB) |
| `npm run check:migrations` | ✅ Numeracja OK (następny wolny: 0209); brak nowej migracji (feature bez zmian schematu) |
| `npm run check:actions` | ✅ 159 akcji AI, wszystkie mają egzekutor (brak nowej `AIAction`) |
| `next lint --dir src` | ✅ tylko istniejące ostrzeżenia kosmetyczne (img/exhaustive-deps znane z roadmapy); 0 błędów |
| `next build` (lokalny Postgres, bez `migrate.js`/prod DB — C-13) | ✅ kompilacja + typecheck wszystkich tras bez błędów |

## Kryteria akceptacji
### ✅ AC-1 — AI →DONE zadania cyklicznego tworzy następcę
**Jak sprawdzono:** prześledzenie ścieżki. Executor AI `update_task` (`tasksExecutor.ts:66`) i
`update_task_status` (`:77`) wołają `updateTask(id, { status })`. W `updateTask` (`actions/tasks.ts:341`)
warunek `patch.status === "DONE" && existing.status !== "DONE" && existing.recurring` wywołuje
`spawnRecurringSuccessor` — jedyny punkt tworzenia następcy. Wcześniej `updateTask` nie tworzyło następnika,
więc AI go gubił. **Werdykt: spełnione.**

### ✅ AC-2 — Parytet UI toggle == bulk == AI
**Jak sprawdzono:** wszystkie wejścia zbiegają się do `updateTask` (jeden punkt spawn'u `:341`):
`toggleTaskStatus` (`:568`) woła `updateTask(id,{status:next})`; `bulkUpdateTasks` (`:469`) woła
`completeRecurringTask` → wrapper → `updateTask`; AI woła `updateTask`. `completeRecurringTask` (`:592`)
nie tworzy już własnego następcy (wrapper), więc brak dubletu. **Werdykt: spełnione.**

### ✅ AC-3 — `completedAt` przy →DONE / →inny status, spójnie dla wszystkich wejść
**Jak sprawdzono:** logika `derivedCompletedAt` w `updateTask` (`:287-290`: →DONE = teraz, →inny = null)
pozostała nietknięta i jest wspólna dla wszystkich wejść (bo wszystkie idą przez `updateTask`). Jawnie
podana data ma pierwszeństwo (`:296`). **Werdykt: spełnione.**

### ✅ AC-4 — Pety: AI == UI przez `completeTreatment`
**Jak sprawdzono:** `petExecutor.ts` `log_treatment_done` woła teraz `completeTreatment(t.id)`
(`actions/petCare.ts:108`) — tę samą funkcję co UI. Usunięto równoległą implementację
(`parseRecurringRule`+`computeNextDue`) i drugi `petCareLog.create` (log tworzy teraz tylko domena, raz).
Nieużywane importy usunięte (potwierdzone `next build`). **Werdykt: spełnione.**

### ✅ AC-5 — Audyt wszystkich akcji: jedno miejsce egzekucji
**Jak sprawdzono:** tabela wejście → akcja domenowa (poniżej). Brak surowych zapisów statusu zadań poza
`actions/tasks.ts` (grep). Health/Habits: executory już wołają akcje domenowe. **Werdykt: spełnione.**

| Moduł | Wejście | Akcja domenowa | Efekt uboczny wymuszony centralnie? |
|-------|---------|----------------|--------------------------------------|
| Tasks | UI toggle / bulk / AI / szczegóły | `updateTask` (jedyny spawn) | ✅ tak (`spawnRecurringSuccessor`) |
| Pets | UI / AI `log_treatment_done` | `completeTreatment` | ✅ tak (po zmianie AI woła domenę) |
| Health/Leki | UI / AI `log_dose`/`unlog_dose` | `logDose`/`unlogDose` | ✅ już wołane z obu wejść (bez zmian) |
| Habits | UI / AI `toggle_habit` | `toggleHabitDay` | ✅ już wołane z obu wejść (bez zmian) |

### ✅ AC-6 — Brak regresji 020/022/023 i statusów własnych
**Jak sprawdzono:** warunek „prawdziwego przejścia" (`existing.status !== "DONE"`) oddziela pierwsze
domknięcie (spawn) od późniejszej edycji daty wykonania już-DONE — tę obsługuje blok 022/023 (`:254-286`),
który pozostał nietknięty i przy pierwszym domknięciu no-op'uje (brak jeszcze następcy), więc obie ścieżki
się nie dublują. `recurrence.test.ts` + `recurrence-edges.test.ts` + nowe testy zielone. Normalizacja
custom-statusu przy zmianie projektu (`:218-228`, `:381-391`) bez zmian. **Werdykt: spełnione.**

### ✅ AC-7 — `build` zielony
`next build` przechodzi (patrz Bramki). **Werdykt: spełnione.**

## Zgodność z konstytucją
- **C-20** ✅ mutacje = Server Actions z `revalidatePath` (nietknięte); wrapper nie omija inwalidacji.
- **C-12** ✅ statusy pozostają `String` + union; zero enumów.
- **C-23** ✅ brak nowej `AIAction`; `check:actions` zielone.
- **C-21** ✅ guardy dostępu (`assertTaskAccess`/`assertPetAccess`) i własność nietknięte; wrapper przechodzi
  przez `updateTask`, który robi `requireAuth`+`assertTaskAccess`.
- **C-53** ✅ minimalizm — konsolidacja istniejącej logiki, zero nowych zależności/abstrakcji ponad
  jeden helper + jedną czystą funkcję; brak zmian schematu.
- **C-51** ✅ wpis do `doświadczenia.md` dopisany (2026-07-23) i objęty commitem.
- **C-10/C-11** — n/d (brak migracji, świadomie).

## Regresje
- **Bulk**: gałąź recurring woła `completeRecurringTask` (wrapper) i osobno nakłada pozostałe pola skalarne
  surowym `prisma.task.update` — brak drugiego spawn'u (raw update nie idzie przez `updateTask`). ✅
- **`completeRecurringTask` kontrakt zwrotu**: wrapper dogrywa następcę (`previousTaskId`, order desc) i go
  zwraca; gdy seria się skończyła — zwraca zamknięte zadanie. Zgodne z użyciem w `TaskDetail`. ✅
- **Pety**: `completeTreatment` respektuje `endDate` (`nextDueFrom`) i tworzy `petCareLog` raz — brak
  podwójnego logu ani rozjazdu terminu z UI. ✅
- Testy integracyjne DB (428/428) bez regresji w sąsiednich modułach.

## Werdykt końcowy
**GOTOWE.** Wszystkie AC-1..AC-7 spełnione z dowodem; bramki zielone; brak naruszeń konstytucji i regresji.
