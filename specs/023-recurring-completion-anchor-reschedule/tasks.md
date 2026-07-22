# Zadania: Przeliczenie terminu następcy po edycji daty wykonania (kotwica „od daty wykonania")

- **Plan:** ./plan.md (023-recurring-completion-anchor-reschedule)
- **Status:** done
- **Data:** 2026-07-22

> **Zasada listy:** feature nie rusza schematu ani UI — to jedna, wewnętrzna zmiana w `updateTask`.
> Każde zadanie małe i weryfikowalne. `[P]` = niezależne.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane · `[P]` równoległe

## Faza 0 — Fundament danych
- (brak) — plan §2: **bez zmian w schemacie/migracji** (używa istniejących pól + powiązania
  `previousTaskId` z 022). `check:migrations` zielony bez nowego katalogu.

## Faza 1 — Warstwa serwera (`src/actions/tasks.ts`)
- [x] **T-1** — **Import `parseRecurringRule`.** Upewnić się, że w `src/actions/tasks.ts` dostępne są
  `computeNextDue` (już importowane) i `parseRecurringRule` z `@/lib/recurrence`; dodać import
  `parseRecurringRule`, jeśli brakuje. *Gotowe, gdy:* obie funkcje można wywołać, kompiluje się.
- [x] **T-2** — **Przeliczenie terminu następcy w `updateTask`.** Rozszerzyć istniejący blok 022
  (`if (explicitCompletedAt !== undefined) { … updateMany(lastCompletedAt) }`): po `updateMany`, gdy
  `rule = parseRecurringRule(existing.recurring)` ma `anchor === "COMPLETION"`, `explicitCompletedAt !==
  null` i `existing.completedAt` istnieje — pobrać `successor = findFirst({ where: { previousTaskId: id,
  status: { not: "DONE" } } })`; policzyć `oldNextDue = computeNextDue(existing.completedAt, rule)`; jeśli
  `successor.dueDate?.getTime() === oldNextDue?.getTime()` (nietknięty) → `newNextDue =
  computeNextDue(explicitCompletedAt, rule)`, ustawić `data.dueDate = newNextDue` i (gdy
  `successor.startDate`) `data.startDate = successor.startDate + (newNextDue - oldNextDue)`, a następnie
  `prisma.task.update({ where: { id: successor.id }, data })`. `revalidatePath` bez zmian. *Gotowe, gdy:*
  korekta daty wykonania na cyklicznym „od daty wykonania" przelicza termin+start nietkniętego, aktywnego
  następcy; ręczne zmiany/„Następne w tej dacie", kotwica DUE, zrobiony następca i niecykliczne — bez
  zmian (AC-1..AC-6).

## Faza 2 — UI
- (brak) — plan §5: brak zmian w UI (efekt widoczny przez istniejący `revalidatePath`).

## Faza 3 — AI / integracje
- (brak) — plan §6: brak nowej `AIAction`/read-toola. `check:actions` zielony.

## Faza 4 — Bramki i domknięcie
- [x] **T-3** — **Bramki jakości (C-50).** Z `worldofmag/` (lokalny Postgres — C-13; brak nowych
  migracji): `npm run check:migrations`, `npm run check:actions`, `next lint --dir src`, `next build`.
  **Nie** `scripts/migrate.js`. *Gotowe, gdy:* wszystko zielone do `next build`.
- [x] **T-4** — **Mapowanie AC → wynik** (input do `/verify`): patrz tabela niżej; żaden AC bez pokrycia.
- [x] **T-5** — **Wpis do `doświadczenia.md`** (C-51): kotwica „od daty wykonania" wymaga przeliczenia
  terminu następcy przy korekcie daty wykonania; heurystyka „nietknięty termin" chroni ręczne zmiany.

## Mapowanie kryteriów akceptacji
| AC | Zadanie |
|----|---------|
| AC-1 (przeliczenie dla COMPLETION) | T-2 |
| AC-2 (przesunięcie startu) | T-2 |
| AC-3 (poszanowanie ręcznych zmian / override) | T-2 (heurystyka równości terminów) |
| AC-4 (kotwica DUE bez zmian) | T-2 (bramka `anchor === "COMPLETION"`) |
| AC-5 (tylko aktywny bezpośredni następca) | T-2 (`status: { not: "DONE" }`) |
| AC-6 (bez regresji) | T-2 (zachowany `updateMany`) + T-3 (build) |

## Ścieżka krytyczna / zależności
- **T-1 → T-2** (import przed użyciem) → **T-3** (bramki) → T-4/T-5 (domknięcie). Liniowo, jeden commit
  logiczny (T-1+T-2 mogą wejść razem).

## Notatki / blokady
- Uwaga recenzji: przeliczenie **tylko** przy `anchor === "COMPLETION"` i „nietkniętym" terminie —
  inaczej ryzyko nadpisania świadomej zmiany użytkownika.
