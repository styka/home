# Recenzja: Widoczna „data wykonania" + działające sortowanie sekcji „Zrobione"

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md (020-tasks-completed-date-sort)
- **Data:** 2026-07-22 · **Recenzent:** Claude Code (etap /review)

## Zakres
Diff względem `origin/develop`: **6 plików, +35/−12**. Migracja 0207 (nowa kolumna), `schema.prisma`,
typ `Task`, Server Action `completeRecurringTask`, `TaskRow` (znacznik), `CompletedSection` (sort +
nagłówek).

## Ustalenia
**Brak ustaleń** (correctness / convention / simplification / security) wymagających zmiany.

Przegląd:
- **Poprawność:** `lastCompletedAt: completedAt` (`tasks.ts:524`) — `completedAt` to policzony wcześniej
  `Date`; poprawnie ląduje w `create`. `revalidatePath` w tej akcji był i został. `TaskRow` — znacznik
  gated `(completedAt ?? lastCompletedAt) && …` (Date-truthy albo null → brak fałszywego renderu „0"),
  `!` bezpieczne dzięki bramce; `new Date(...)` obsługuje Date i string (serializacja server→client).
  `CompletedSection` sortuje tylko przy `sortBy==="completedAt"`, inaczej oryginalna kolejność (AC-2).
- **Migracja/schemat:** `TIMESTAMP(3)` nullable = Prisma `DateTime?`; `ADD COLUMN IF NOT EXISTS` →
  idempotentne, nieblokujące na prod; numer 0207 unikalny; `schema.prisma` spójny.
- **Konwencje:** brak enumów (C-12), kolory `var(--text-muted)` (C-30), teksty PL (C-32), praca w
  `worldofmag/` (C-01). `TASK_INCLUDE` = `include` → nowa kolumna zwracana bez zmian zapytań.
- **Minimalizm (C-53):** reuse `TaskGroup`/`renderTask`, drobny helper `formatDoneDate`, jedna kolumna;
  bez nowych zależności.
- **Bezpieczeństwo:** brak markdown/HTML/kluczy → brak powierzchni ataku.

Uwaga informacyjna (nie-defekt): statusy terminalne inne niż `DONE` (np. „Anulowane") mają
`completedAt=null` (istniejąca logika, poza zakresem) → bez znacznika i na końcu sortu — zachowanie
oczekiwane i spójne ze spec.

## Werdykt
**APPROVE.** Implementacja poprawna, minimalna i zgodna z konwencjami Omnia; wszystkie bramki zielone;
AC-1..AC-7 pokryte z dowodem w kodzie i DB (kolumna potwierdzona). W przeciwieństwie do defektów
zależnych od iOS, tę zmianę dało się w pełni zweryfikować w sandboxie (build + DB + prześledzenie
logiki). Migracja nullable/`IF NOT EXISTS` → bezpieczna na produkcji. Domknięcie: merge do `develop` +
automatyczna promocja `develop → master` (C-52).
