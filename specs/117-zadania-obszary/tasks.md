# Zadania: Obszary w Zadaniach + trwała odzyskiwalność kosza

- **Plan:** ./plan.md (117-zadania-obszary)
- **Status:** todo
- **Data:** 2026-08-31

> Kolejność od najłatwiejszego do najtrudniejszego, zgodna z zależnościami. `[P]` = można
> zrównoleglić. Odhaczamy w trakcie `/implement`.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)

## Faza 0 — Fundament danych
- [ ] **T-1** — `schema.prisma`: model `TaskArea` (projectId→Cascade, parentId self-relation
  Cascade, name, order, timestamps, `@@index([projectId, parentId])`), `Task.areaId` (SetNull,
  `@@index([areaId])`), `TrashItem.status @default("active")` + `resolvedAt` +
  `@@index([status, deletedAt])`. Migracje `0286_task_areas` i `0287_trash_status` (ręczny DDL,
  plan §2). Gotowe, gdy: `npm run check:migrations` OK, `npx prisma migrate deploy` na lokalnym
  Postgresie OK, `npx prisma generate` czysto, `npm run check:schema-drift` pusty.

## Faza 1 — Warstwa serwera: obszary
- [ ] **T-2** — Czyste funkcje `src/modules/tasks/lib/obszary.ts`: budowa drzewa z płaskiej listy,
  wykrywanie cyklu przy przenoszeniu, plan usunięcia (`scal`/`poddrzewo` → lista przepięć dzieci
  i zadań), sortowanie topologiczne do przywracania. Test jednostkowy w `__tests__`. Gotowe, gdy:
  `npm run test:unit` (nowy test) + `tsc -p tsconfig.test.json` zielone.
- [ ] **T-3** — Akcje `src/modules/tasks/actions/obszary.ts`: `getProjectAreas` (komentarz
  `paginacja: kompletny`), `createArea`, `renameArea`, `moveArea` (walidacja cyklu z T-2),
  `deleteArea(tryb)` ze snapshotem do kosza (moduł `"obszary"`) i transakcją; guard
  `assertProjectAccess`, `revalidatePath("/tasks")`. `TrashModule` += `"obszary"` w platformie.
  Wpisy w `src/lib/ai/action-coverage.json`. Gotowe, gdy: `npm run check:ai-coverage` OK.
- [ ] **T-4** — `updateTask` przyjmuje `areaId` (walidacja przynależności obszaru do projektu
  zadania; zmiana projektu odpina niepasujący obszar); snapshot kosza w `deleteTask` niesie
  `areaId`, restorator zadania go odtwarza. Gotowe, gdy: `tsc` zielone + wpis coverage bez zmian
  (ta sama akcja).

## Faza 2 — Warstwa serwera: nieusuwalność kosza
- [ ] **T-5** — `TrashStatus` (union) + zamiana 6 miejsc kasujących `TrashItem` na statusy:
  `platform/trash/trash.ts` (inline-cleanup, `purgeExpiredTrash`) i `src/actions/trash.ts`
  (`getTrash` filtr `active`, `restoreTrashItem`→`restored`, `purgeTrashItem`/`emptyTrash`→
  `emptied`). Gotowe, gdy: w repo nie ma już `trashItem.delete`/`deleteMany` poza
  `lib/privacy/purge.ts` (RODO), a istniejące testy kosza przechodzą.
- [ ] **T-6** — Refaktor: restoratory + dispatch z `src/actions/trash.ts` →
  `src/lib/trash/przywracanie.ts` (`przywrocZMigawki(item)`); akcja użytkownika woła helper.
  Nowy restorator `restoreObszary` (topologicznie, `skipDuplicates`, przypięcia zadań tylko gdy
  `areaId: null`). Gotowe, gdy: `tsc` + `next lint` zielone, restore notatki/zadania działa w dev
  (smoke).
- [ ] **T-7** — Admin: `src/actions/adminTrash.ts` (`getAdminTrash` z kursorem i filtrami,
  `adminRestoreTrashItem` + `logAudit`), `AuditCategory` += `"admin"`. Wpisy coverage
  (`access: "admin"`). Gotowe, gdy: `npm run check:ai-coverage` OK.

## Faza 3 — UI
- [ ] **T-8** — `WyborObszaru.tsx` (dropdown z wcięciami) wpięty w `TaskDetail` i
  `FormularzZadania`; teksty w `messages/pl.json`. Gotowe, gdy: przypisanie/odpięcie obszaru
  działa w dev (AC-2).
- [ ] **T-9** — Stan widoku: `layout` += `"obszary"`, parametr `obszary: sekcje|drill|panel`,
  helper `wariantObszarow.ts` (localStorage, wzór `ukladSzczegolow`); przycisk „Obszary" w
  przełączniku layoutu projektu; `TasksPage`/`TasksRouteView`/`page.tsx` przekazują listę obszarów
  projektu. Gotowe, gdy: wejście bez parametru wraca do ostatniego wariantu, URL wygrywa (AC-4).
- [ ] **T-10** — `ObszaryWidok.tsx` + `ObszarySekcje.tsx` (wariant domyślny): sekcje wg drzewa,
  wcięcia, „Bez obszaru", wiersze przez istniejący `TaskList`/`TaskRow`; `PrzelacznikSegmentowy`
  wariantów. Zarządzanie: „Nowy obszar", menu ⋮ (zmień nazwę / pod-obszar / przenieś / usuń),
  dialog usunięcia z wyborem trybu (`destructive`). Gotowe, gdy: AC-1/AC-3/AC-5 przechodzą w dev.
- [ ] **T-11** `[P]` — `ObszaryDrill.tsx` (mobile: kafle pod-obszarów + zadania + okruszki) i
  `ObszaryPanel.tsx` (`hidden lg:block`, klik filtruje z pod-obszarami) — oba na tym samym zbiorze
  zadań co sekcje. Gotowe, gdy: przełączanie 3 wariantów nie gubi/nie dubluje zadań (AC-3/AC-4).
- [ ] **T-12** `[P]` — `/trash`: etykieta modułu `"obszary"`; przywrócenie obszaru z kosza działa
  (AC-6).
- [ ] **T-13** — Panel `/admin/kosz`: `page.tsx` + `KoszAdmina.tsx` (tabela, filtry, „Przywróć
  właścicielowi", „załaduj więcej"), wpis w `src/lib/admin/narzedzia.ts` (+ test kluczy) i w
  `src/lib/ui/view-contract.json`. Gotowe, gdy: `npm run check:admin-links` +
  `npm run check:ui-contract` OK, AC-8 przechodzi w dev.

## Faza 4 — Bramki i domknięcie
- [ ] **T-14** — Pełna lokalna weryfikacja: `npm run check:pagination`, `check:i18n`,
  `check:owner-columns`, `check:boundaries`, `tsc -p tsconfig.test.json`, `npm run test:unit`,
  `next lint`, `next build` (lokalny Postgres, C-13 — bez `migrate.js` na prod). Gotowe, gdy:
  wszystko zielone.
- [ ] **T-15** — Mapowanie AC-1…AC-9 na wyniki (input do `/verify`): smoke w dev wg planu §8,
  w tym AC-7 (statusy w DB po opróżnieniu/retencji) i AC-9 (projekt zespołowy).
- [ ] **T-16** — Wpis(y) do `doświadczenia.md`, jeśli był nieoczywisty problem (C-51); commit.

## Mapowanie kryteriów akceptacji
| AC | Zadania |
|----|---------|
| AC-1 (drzewo ≥3 poziomy) | T-1, T-2, T-3, T-10 |
| AC-2 (jeden obszar na zadanie) | T-4, T-8 |
| AC-3 (sekcje, „Bez obszaru", bez dubli) | T-10, T-11 |
| AC-4 (3 warianty, pamięć, domyślne sekcje) | T-9, T-11 |
| AC-5 (dwa tryby usuwania) | T-2, T-3, T-10 |
| AC-6 (przywrócenie z kosza) | T-3, T-6, T-12 |
| AC-7 (opróżnienie/retencja nie kasuje) | T-1, T-5 |
| AC-8 (panel admina + przywrócenie + audyt) | T-7, T-13 |
| AC-9 (obszary wspólne w projekcie zespołowym) | T-3 (guard przez projekt), T-15 |

## Notatki / blokady
- Ścieżka krytyczna: T-1 → T-3 → (T-5 → T-6 → T-7) i (T-9 → T-10) → T-13 → T-14.
- T-11/T-12 równoległe względem T-13.
