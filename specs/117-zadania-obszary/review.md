# Recenzja: Obszary w Zadaniach + trwała odzyskiwalność kosza

- **Spec:** ./spec.md (117-zadania-obszary)
- **Data:** 2026-08-31
- **Zakres:** `git diff origin/develop...HEAD -- worldofmag/` (branch `claude/task-module-areas-ty9j66`)
- **Metoda:** świeża recenzja subagentem `omnia-reviewer` (pełny diff + kontekst wywołań) +
  własny przegląd adversarialny miejsc najwyższego ryzyka.

## Ustalenia (od najpoważniejszego) i co z nimi zrobiono

1. **`src/modules/tasks/actions/tasks.ts` — correctness — NANIESIONE.** Odpinanie obszaru przy
   przenosinach działało tylko dla zmiany na *inny projekt*; przeniesienie do braku projektu
   (`projectId: null`) zostawiało `areaId` z cudzego drzewa. Scenariusz: zadanie z projektu A
   z obszarem X → do Skrzynki → `projectId=null`, `areaId=X`. Poprawka: warunek
   `patch.projectId !== undefined && patch.projectId !== existing.projectId`.
2. **`obszary.ts` + `lib/trash/przywracanie.ts` — correctness — NANIESIONE.** Migawka trybu
   „scal" nie niosła listy pod-obszarów przepiętych na dziadka, więc przywrócenie oddawało
   obszar z zadaniami, ale bez dawnych pod-obszarów (AC-6 częściowo). Poprawka: `childIds`
   w migawce + warunkowe przepięcie z powrotem przy przywracaniu (wzorzec „nie kradnij" —
   tylko dzieci, które nadal wiszą tam, gdzie zostawiło je usunięcie). Dowód: nowy smoke
   `smoke-scal-117.ts` — „C1 z powrotem pod X: true".
3. **`WyborObszaru.tsx` — FAŁSZYWY ALARM.** Zgłoszone „zwykłe spacje zwijane w `<option>`" —
   plik używa NBSP (`U+00A0`, potwierdzone `cat -A`; diff renderuje NBSP jak zwykłą spację,
   stąd pomyłka recenzenta). Bez zmian.
4. **`KoszAdmina.tsx` + `ObszaryWidok.tsx` — correctness (UX) — NANIESIONE.** Błąd przywracania
   przez admina kończył się cichym zgaśnięciem spinnera (restorator rzuca sensowne polskie
   komunikaty — „Projekt tych obszarów już nie istnieje"); analogicznie `usunObszar` nie łapał
   błędu `deleteArea`. Poprawka: `catch` z komunikatem `role="alert"` w panelu admina; w dialogu
   usuwania błąd zostawia dialog otwarty (spójnie z `zapiszDialog`).
5. **`KoszAdmina.tsx` — convention (C-53/110) — NANIESIONE.** Ręczny link „← Admin" zamiast
   komponentu `PowrotDoPanelu` (dokładnie wzorzec, który 110 zlikwidowało). Zamienione.
6. **`src/actions/trash.ts` `purgeTrashItem` — correctness (niska) — NANIESIONE.** Brak warunku
   `status: "active"` pozwalał drugiej karcie przestemplować wpis `restored` na `emptied`.
   Poprawka: `updateMany({ where: { id, userId, status: "active" } })`.
7. **Przywracanie bez ponownego sprawdzenia dostępu do projektu — security (niska) —
   ODNOTOWANE, bez zmian.** Użytkownik usunięty z zespołu po usunięciu zasobu może z własnego
   kosza odtworzyć obszary w projekcie zespołu. To wzorzec istniejący od dawna w `restoreTask`
   (nie regresja 117), skutek ograniczony (tworzy/przypina, nie czyta). Zapisane do roadmapy
   jako osobna, świadoma zmiana reguły dostępu (C-17 wymaga tabeli prawdy — nie „przy okazji").
8. **`TaskDetail.tsx` etykieta `Obszar` hardcodowana — convention (C-32, niska) — ODNOTOWANE,
   bez zmian.** Spójne z zastanym długiem pliku (sąsiednie `Projekt`/`Termin`/`Start` też są
   inline, ASCII); wyciąganie jednej etykiety z trzech to pół roboty — pójdzie z rewizją
   `t.rich(...)` z roadmapy.

Dodatkowo w ramach recenzji naniesiono uwagę z `verify.md`: teksty kosza użytkownika mówiły
„Usuń trwale / nie można cofnąć", co po nieusuwalności jest nieprawdą — przepisane na „Usuń
z kosza" + informację o możliwości przywrócenia przez administratora.

## Weryfikacja po poprawkach

- `tsc --noEmit` (oba configi), `next lint --dir src` (0/0), `check:i18n` — zielone.
- Smoke „scal" (nowy) + wcześniejszy smoke „poddrzewo/emptied/restore" — zielone.
- Pełny `npm run build` na lokalnym Postgresie — zielony (log `build6`).

## Werdykt

**APPROVE Z UWAGAMI** — ustalenia 1–6 naniesione i zweryfikowane; 7–8 odnotowane świadomie
(nie-regresje, osobne zmiany). Zgodnie ze standing authorization: merge do `develop`, push,
automatyczna promocja `develop → master` (ff-only, po kontroli integralności).
