# Recenzja: Wymuszanie automatycznych efektów zmiany statusu — centralnie

- **Spec/Plan/Verify:** ./spec.md · ./plan.md · ./verify.md
- **Data:** 2026-07-23
- **Zakres diffu:** `worldofmag/src/actions/tasks.ts`, `src/lib/recurrence.ts`,
  `src/lib/ai/executors/petExecutor.ts`, `src/lib/__tests__/recurrenceSuccessor.test.ts`
  (223 insercje / 80 delecji, 4 pliki).

## Ustalenia (od najpoważniejszego)

### 1. [correctness] Interakcja spawn ↔ blok 022/023 — sprawdzona, poprawna
`actions/tasks.ts` — jedyny punkt spawn'u ma warunek `patch.status === "DONE" && existing.status !==
"DONE" && existing.recurring`. Prześledzono scenariusze: (a) pierwsze domknięcie → blok 022/023
no-op'uje (brak jeszcze następcy z `previousTaskId`), spawn tworzy następcę; (b) późniejsza edycja daty
wykonania już-DONE → `existing.status === "DONE"` blokuje spawn, blok 022/023 koryguje istniejącego
następcę. **Brak podwójnego następcy i brak pominięcia.** Bez zmian wymaganych.

### 2. [correctness] Brak podwójnego spawn'u we wszystkich wejściach
`completeRecurringTask` = wrapper wołający `updateTask` raz; `bulkUpdateTasks` woła wrapper, a pozostałe
pola nakłada surowym `prisma.task.update` (nie przez `updateTask`) → jeden spawn. `toggleTaskStatus` i
executory AI wołają `updateTask` → jeden spawn. Zweryfikowano: DOKŁADNIE jeden punkt efektu.

### 3. [convention] Pety: ścieżka AI korzysta z domeny — zgodne z C-53
`petExecutor.log_treatment_done` woła `completeTreatment(t.id)` (re-sprawdza dostęp `assertPetAccess`,
respektuje `endDate`, tworzy `petCareLog` raz). Usunięto duplikat logiki i nieużywane importy. Reuse
zamiast reimplementacji — zgodnie z minimalizmem.

### 4. [minor/nieblokujące] `completeRecurringTask` nie rzuca już na niecyklicznym zadaniu
Wcześniej rzucał `"Not a recurring task"`; wrapper po prostu oznaczy DONE i zwróci zamknięte zadanie
(bez następcy). **Scenariusz:** wywołanie na niecyklicznym → brak wyjątku. W praktyce nieosiągalne —
UI (`TaskDetail`) pokazuje tę akcję tylko dla cyklicznych, a `bulkUpdateTasks` gałąź jest strzeżona
`existing.recurring`. Zachowanie łagodniejsze, nie błędne. **Nie wymaga poprawki.**

### 5. [correctness] `revalidatePath` zachowane (C-20)
Spawn tworzy następcę w tym samym projekcie co poprzednik; `updateTask` rewaliduje `/tasks` i
`/tasks/${existing.projectId}` po spawnie → lista następcy odświeżona. Pety: `completeTreatment`
rewaliduje przez `revalidatePet`. Brak utraty inwalidacji.

## Zgodność z konstytucją
C-01 (praca w `worldofmag/`) ✅ · C-12 (String+union, zero enumów) ✅ · C-20 (Server Actions +
`revalidatePath`) ✅ · C-21 (guardy dostępu nietknięte, wrapper przez `updateTask`) ✅ · C-23 (brak nowej
`AIAction`; `check:actions` zielone) ✅ · C-30..C-32 (brak zmian UI; teksty PL) ✅ · C-53 (konsolidacja,
zero nowych zależności/abstrakcji ponad 1 helper + 1 czystą funkcję) ✅ · C-51 (wpis do
`doświadczenia.md`) ✅.

## Bezpieczeństwo
Brak wycieków kluczy, brak nowych ścieżek renderujących HTML/markdown, kontrola dostępu zachowana na
każdej mutacji (`requireAuth` + `assert*Access`). Bez uwag.

## Werdykt
**APPROVE.** Zmiana jest minimalna, poprawna i realizuje wszystkie AC ze speca; bramki zielone
(test:unit 428/428, check:actions, check:migrations, lint, next build). Gotowe do merge do `develop`
i promocji na `master`.
