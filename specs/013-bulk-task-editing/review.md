# Recenzja: Bulkowa (zbiorcza) edycja zadań

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md · **Data:** 2026-07-20
- **Diff:** 11 plików, +1017/−16 (kod: `actions/tasks.ts`, `BulkActionBar.tsx`, `TaskRow.tsx`,
  `TaskList.tsx`, `TasksPage.tsx`, `action-coverage.json`).

## Ustalenia (od najpoważniejszego)

Brak ustaleń blokujących (correctness/security). Poniżej drobne uwagi (non-blocking):

1. **`TasksPage.tsx` — „Zaznacz wszystkie" pomija sekcję „Zrobione"** · convention/UX ·
   `toggleSelectAllVisible` operuje na `visibleTasks`, które w zakładce „Wszystkie" wykluczają zadania
   terminalne (są w osobnej sekcji „Zrobione"). Skutek: „Zaznacz wszystkie" zaznacza tylko aktywne
   zadania; ukończone można dobrać ręcznie lub Shift+klik (są w `orderedIds`). To spójne z filozofią
   „aktywne w centrum" i **zamierzone** — nie defekt. Sugestia (opcjonalnie później): dopisek w tooltipie.
2. **`BulkActionBar.tsx` — wartości pól w popoverach nie resetują się między otwarciami** ·
   simplification · `dueValue`/`categoryValue` zostają po zamknięciu panelu. Skutek: przy ponownym
   otwarciu widać poprzednią wartość. Czysto kosmetyczne, bez wpływu na dane. Do ewentualnego
   sprzątnięcia; nie blokuje.

## Poprawność (sprawdzone, OK)
- **Guardy dostępu (C-21):** `bulkUpdateTasks`/`bulkDeleteTasks` robią `requireAuth` + `assertTaskAccess`
  per zadanie w `try/catch` (skip przy braku dostępu). Przeniesienie projektu: `assertProjectAccess`
  celu raz przed pętlą. Brak IDOR — tożsame z `updateTask`/`deleteTask`.
- **`revalidatePath` (C-20):** obie akcje odświeżają `/tasks` + dotknięte projekty (stare i nowe).
- **`completedAt` / normalizacja custom statusu:** wierna kopia logiki `updateTask` — brak rozjazdu.
- **Soft-delete (C-24):** `bulkDeleteTasks` zapisuje pełną migawkę do `recordTrash` przed `delete`.
- **Tagi dodaj/usuń:** `deleteMany` po `removeTagIds` + `createMany skipDuplicates` po `addTagIds` —
  pozostałe tagi nietknięte; idempotentne (brak duplikatów).
- **Brak `await`/wyścigów:** wszystkie operacje Prisma awaitowane; pętla sekwencyjna.

## Konwencje Omnia
- **C-12** brak enumów (statusy/priorytety jako `String`/union). ✅
- **C-30** UI wyłącznie na zmiennych CSS (`--bg-*`, `--accent-*`, `--on-accent`, `--border`); brak
  hardcodowanych hexów w nowym kodzie. ✅ (`TaskTagBadge` liczy rgba z `tag.color` — to istniejący,
  niezmieniony helper.)
- **C-31** checkbox 20×20, long-press mobilny, `env(safe-area-inset-bottom)`, Esc, padding listy pod
  pasek. ✅ Brak drugiego sidebara.
- **C-32** teksty PL. ✅
- **C-01/C-02** praca w `worldofmag/src`, importy `@/*`. ✅
- **C-23** brak nowej `AIAction`; nowe akcje `excluded` w manifeście → bramka zielona. ✅
- **C-53** reuse `updateTask`/`deleteTask`/`recordTrash`/istniejących pickerów; brak nowych
  zależności/migracji/tras. ✅

## Bezpieczeństwo
- Brak wycieku kluczy, brak renderu surowego HTML, każda mutacja za `requireAuth` + guard dostępu.
  Zbiorcze usunięcie za `confirm` + soft-delete (odwracalne). ✅

## Werdykt
**APPROVE Z UWAGAMI** — dwie uwagi kosmetyczne/UX, obie non-blocking i zgodne z filozofią modułu.
Poprawność, bezpieczeństwo i konwencje bez zastrzeżeń; bramki zielone (`verify.md`). Merge do `develop`.
