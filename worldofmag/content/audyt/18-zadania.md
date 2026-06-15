# Rozdział 18 — Zadania (Tasks)

## Kontekst / stan z kodu

Jeden z najbogatszych modułów.

- **Rdzeń:** `src/actions/tasks.ts`, `taskProjects.ts`, `projectGroups.ts`; modele `Task`,
  `TaskProject`, `TaskProjectMember`, `TaskTagDef`, `TaskShare`, `ProjectGroup` (@@map `TaskView`).
- **Funkcje:** własne statusy per lista, grupy projektów (widok wieloprojektowy `/tasks/multi`),
  **cykliczność** (`src/lib/recurrence.ts`, współdzielona z nawykami/zwierzętami/lekami), podzadania,
  **widoki Kanban i Timeline** (DnD HTML5), tagi, bulk-add, widoki wirtualne (dziś/nadchodzące/zaległe).
- **Trwałość panelu szczegółów:** niedawny fix „sticky snapshot” (panel nie zamyka się, gdy zadanie
  wypada z filtrowanego widoku) — patrz `doświadczenia.md` 2026-06-14.

## Mocne strony

- **Kanban + Timeline + cykliczność + grupy projektów** — poziom dojrzałych narzędzi (Todoist/Linear).
- **Współdzielona logika cykliczności** (`recurrence.ts`) — DRY między modułami, pokryta testami.
- **Własne statusy per lista** — elastyczność rzadka w darmowych aplikacjach.

## Głos Zespołu A — Strażnicy

**Michał (senior dev):** „Mamy **dwa parsery języka naturalnego**: `AITaskInput` w Zadaniach i agent w
Home. To dryf — ujednolićmy (T5), inaczej utrzymujemy dwie ścieżki rozumienia »jutro o 15«.”

**Ewa (QA):** „**Audyt skrótów klawiszowych** (T6) — `j/k/x/e/d` powinny działać identycznie we
wszystkich widokach; dziś bywa niespójnie. To obietnica »keyboard-first«.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „Brakuje **zależności blocked-by** (T4) — »nie zacznę B, póki A nie skończone«. To
odróżnia listę zadań od realnego zarządzania projektem i otwiera drzwi do **modułu Praca** (Rozdz. 40).”

**Damian (senior dev):** „**Powiadomienia o terminach** (T3) — silnik `NM3` jest, brakuje podpięcia
eskalacji zaległych/nadchodzących. Szybkie, wysokie ROI (patrz Rozdz. 34).”

## Punkty sporne

- **Zależności zadań: pełny graf vs proste blocked-by.** **Konsensus:** zacząć od prostego `blockedBy`
  (lista), graf dopiero, gdy pojawi się realna potrzeba (Praca/B2B).

## Głos użytkowników

**Marek (29):** „Chcę powiadomienie, jak coś jest na jutro, i zależności między zadaniami.”
**Zofia (16):** „Skróty są super, ale nie wszędzie działają tak samo.” → T6.

## Konsensus i zalecenia

- **Z-230** *(P1 · S)* — **Powiadomienia o terminach zadań** (T3): podpiąć eskalację `Task.dueDate` do
  silnika powiadomień (Rozdz. 34).
- **Z-231** *(P1 · M)* — **Ujednolicić parser NL** (`AITaskInput` ↔ agent Home, T5) — jeden silnik.
- **Z-232** *(P1 · S)* — **Audyt spójności skrótów** (T6) `j/k/x/e/d` we wszystkich widokach.
- **Z-233** *(P2 · M)* — **Zależności `blockedBy`** (T4) — prosta wersja przed grafem.
- **Z-234** *(P2 · S)* — **Dokończyć testy** podzadań/cykliczności/sticky-panel (regresja UX z 2026-06-14).

## Dobre vs złe praktyki

**Dobre:** Kanban/Timeline, cykliczność współdzielona i testowana, własne statusy, naprawiony sticky-panel.
**Złe / do poprawy:** dwa parsery NL; niespójne skróty; brak zależności i powiadomień o terminach.
