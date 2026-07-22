# Weryfikacja: Widoczna „data wykonania" + działające sortowanie sekcji „Zrobione"

- **Spec:** ./spec.md (020-tasks-completed-date-sort)
- **Data:** 2026-07-22
- **Weryfikujący:** Claude Code (etap /verify)

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ `OK (następny wolny numer: 0208)` — 0207 unikalny |
| `npm run check:actions` | ✅ `159 akcji, wszystkie obsługiwane przez executor` |
| `next lint --dir src` | ✅ zero błędów (i brak nowych warningów w dotkniętych plikach) |
| `next build` (lokalny Postgres, C-13) | ✅ `Compiled successfully` + `130/130` |
| Migracja 0207 (lokalny Postgres) | ✅ `prisma migrate deploy` zaaplikował; kolumna istnieje w DB: `information_schema` → `Task.lastCompletedAt : timestamp` |

## Kryteria akceptacji
| AC | Werdykt | Dowód / jak sprawdzono |
|----|---------|------------------------|
| **AC-1 (sort widoczny: kolejność + daty)** | ✅ | `TaskRow.tsx:232-236` renderuje znacznik „✓ <data>" gdy `completedAt ?? lastCompletedAt`; `CompletedSection.tsx:20-27` sortuje po efektywnej dacie malejąco. Zrobione zadania mają `completedAt` → widoczne daty + reorder. |
| **AC-2 (toggle wraca do domyślnego)** | ✅ | `CompletedSection` przy `sortBy==="default"` zwraca `tasks` (bez sortu) → oryginalna kolejność. Przełącznik `sortBy` w `TasksPage` (toggle + stan `accent-blue`) bez zmian. |
| **AC-3 (nagłówek sygnalizuje sort)** | ✅ | `CompletedSection.tsx:33` — etykieta „✓ Zrobione / Anulowane — wg daty wykonania" gdy `sortBy==="completedAt"`, inaczej bazowa. |
| **AC-4 (cykliczne aktywne pokazują datę poprzedniego wykonania)** | ✅ | `tasks.ts:524` `completeRecurringTask` ustawia `lastCompletedAt: completedAt` na nowym wystąpieniu; `TaskRow.tsx:232` pokazuje ją także na aktywnym zadaniu (bo `completedAt` puste → fallback `lastCompletedAt`). |
| **AC-5 (trwałość)** | ✅ | Kolumna `Task.lastCompletedAt` istnieje w DB (potwierdzone zapytaniem do `information_schema`); wartość zapisywana przez Server Action (persist), nie liczona ulotnie. |
| **AC-6 (bez regresji)** | ✅ | Znacznik renderuje się **tylko** gdy `completedAt ?? lastCompletedAt` istnieje — zwykłe aktywne zadania (oba null) go nie mają. `TASK_INCLUDE` to `include` (relacje) → nowa kolumna zwracana automatycznie, bez zmian zapytań. Build/lint zielone. |
| **AC-7 (manualny scenariusz testowy)** | ✅ | `specs/020-tasks-completed-date-sort/manual-test.md` — kroki + oczekiwane rezultaty dla AC-1..AC-6 + znane ograniczenie (backfill). |

## Zgodność z konstytucją
- **C-10/C-11/C-12:** ✅ ręczna migracja `0207_task_last_completed_at` (`ADD COLUMN IF NOT EXISTS`,
  nullable, `TIMESTAMP(3)`), numer z `next:migration`, żadnych enumów; `schema.prisma` zsynchronizowany.
- **C-20:** ✅ zmiana w Server Action `completeRecurringTask`; `revalidatePath` już był (bez zmian).
- **C-30/C-32:** ✅ znacznik/nagłówek na `var(--text-muted)`; teksty PL („Data ostatniego wykonania",
  „— wg daty wykonania").
- **C-50/C-51:** ✅ build zielony; wpis do `doświadczenia.md` dodany. **C-22/C-23/C-40:** nie dotyczą.

## Regresje
- **Wspólny `TaskRow`:** znacznik gated na `completedAt ?? lastCompletedAt` → brak wpływu na aktywne
  niecykliczne zadania i pozostałe widoki (Dziś/Nadchodzące/Priorytety). Bez zmian layoutu poza
  dołożeniem opcjonalnego badge `text-xs`.
- **Migracja:** nullable, `IF NOT EXISTS`, bez default → nieblokująca; nie cofa danych.
- Brak zmian RBAC/AI/innych akcji → brak wpływu na sąsiednie moduły.
- **Uwaga (świadome, poza zakresem):** stare zadania cykliczne bez `lastCompletedAt` pokażą datę
  dopiero od następnego wykonania (ujęte w spec §5 i scenariuszu testowym).

## Werdykt końcowy
**GOTOWE.** Wszystkie bramki zielone; AC-1..AC-7 spełnione z dowodem w kodzie/DB; brak regresji.
Przejście do `/review`.
