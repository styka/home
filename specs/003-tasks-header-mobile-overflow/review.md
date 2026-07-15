# Recenzja: Naprawa przepełnienia paska akcji w nagłówku Zadań na iPhone

- **Spec/Plan/Tasks/Verify:** w tym katalogu · **Data:** 2026-07-15
- **Zakres diffa:** `worldofmag/src/components/tasks/TasksPage.tsx` (jedyna zmiana kodu) + artefakty
  `specs/003-*` + wpis `doświadczenia.md`.
- **Werdykt:** ✅ **APPROVE** (jedno ustalenie correctness naprawione w trakcie recenzji).

## Ustalenia (od najpoważniejszego)

### 1. [correctness] `overflow-x-auto` przycinał rozwijane menu `ProjectActionsMenu` — **NAPRAWIONE**
- **Plik:** `src/components/tasks/TasksPage.tsx` (kontener akcji nagłówka).
- **Opis:** Pierwsza wersja fixu owijała **cały** rząd akcji w `overflow-x-auto`. Kontener z
  `overflow-x-auto` ma `overflow-y` liczone jako `auto` (reguła CSS: gdy jedna oś ≠ `visible`, druga
  `visible` staje się `auto`), więc staje się kontenerem przycinającym. `ProjectActionsMenu` renderuje
  `absolute`, ~200px wysokie menu (rename/usuń projektu) rozwijane w dół, zakotwiczone w `.relative`
  **wewnątrz** tego kontenera.
- **Scenariusz awarii (przed poprawką):** widok projektu (nie-inbox) → klik ⋮ „Akcje projektu" →
  menu rozwija się poniżej ~28px-owego rzędu i **jest ucinane** przez `overflow-y:auto` (albo pojawia
  się mikroskopijny pionowy scrollbar). Dotyczyło **też desktopu**, więc byłby to regres (sprzeczny z
  AC-4), którego `next build` nie wykrywa.
- **Poprawka (naniesiona):** rozdzielenie na dwa kontenery — przewijany wewnętrzny obejmuje tylko
  ikony (kosz…klipboard), a `ProjectActionsMenu` przeniesiony **poza** strefę scrolla jako sibling
  (`flex-shrink-0`, przypięty po prawej, zawsze widoczny i nieobcięty). Zaktualizowano `plan.md` §5 i
  `verify.md` (C-54). Build ponownie zielony.

### 2. Pozostałe obszary — bez uwag
- **Poprawność:** brak `await`/wyścigów/guardów — zmiana czysto prezentacyjna, brak logiki async,
  Server Actions, RBAC. `TaskListClipboardButton` nie ma popovera (tylko `state` etykiety) → bezpieczny
  wewnątrz scrolla.
- **Konwencje (C-12/C-30/C-31/C-32/C-01):** brak enumów/hexów/tekstów nie-PL; praca w `worldofmag/`;
  motyw na zmiennych CSS; mobile-first spełniony. ✅
- **Uproszczenia (C-53):** minimalna zmiana klas + jeden podział kontenera wymuszony poprawnością;
  zero nowych zależności/abstrakcji. ✅
- **Bezpieczeństwo:** brak kluczy/logów/renderu HTML w diffie. ✅

## Bramki (potwierdzone)
- `check:migrations` ✅ · `check:actions` ✅ · `next lint --dir src` ✅ (tylko istniejące ostrzeżenia)
  · `next build` ✅ (po poprawce, `✓ Compiled successfully`, `/tasks/[projectId]` OK).

## Werdykt
✅ **APPROVE** — ustalenie #1 naprawione w trakcie recenzji, artefakty spójne (C-54), bramki zielone.
Domknięcie: merge `claude/iphone-icon-overflow-m70m0m` → `develop`.
