# Zadania: Obszary zamiast grup projektów — jedno drzewo porządku w Zadaniach, z migracją danych

- **Plan:** ./plan.md (125-obszary-zamiast-grup)
- **Status:** todo
- **Data:** 2026-09-05

> Kolejność zgodna z zależnościami: dane → serwer → UI → porządek po AI → bramki. `[P]` = można
> równolegle. Odhaczamy w trakcie `/implement`.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)

## Faza 0 — Fundament danych
- [ ] **T-1** — Migracja `0293_obszary_zamiast_grup` (plan §2: `TaskView.parentId` + FK SET NULL +
  indeks; `TaskProject.areaId` + FK SET NULL + indeks; idempotentny UPDATE „pierwsza grupa wygrywa"
  ze strażnikiem `~ '^\['`; ŻADNEGO DROP/DELETE) + synchronizacja `schema.prisma` (rename modelu
  `ProjectGroup` → `ProjectArea` z `parentId`/relacjami; `TaskProject.areaId`; `projectIds` z
  komentarzem legacy). **Gotowe, gdy:** `npm run check:migrations` zielone; na lokalnym PG z
  zasianymi przypadkami (projekt w 2 grupach, grupa pusta, złom w projectIds) `migrate deploy`
  ustawia `areaId` wg „pierwsza wygrywa", drugi deploy nic nie zmienia; `check:schema-drift` zielone.
- [ ] **T-2** — Typy: `ObszarProjektow` w `src/types/index.ts` (zastępuje typ `ProjectGroup`),
  `areaId` w typie projektu. **Gotowe, gdy:** typ wyeksportowany; stare użycia wskaże `tsc`
  (naprawiane w kolejnych zadaniach).

## Faza 1 — Warstwa serwera
- [ ] **T-3** — `src/modules/tasks/lib/poddrzewoObszarow.ts`: czysty helper (mapa parentId → BFS:
  id obszarów poddrzewa; + wyliczenie id projektów z `areaId`). **Gotowe, gdy:** działa dla drzewa
  ≥3 poziomów i wykrywa pełne poddrzewo (użyty przez serwer i klienta).
- [ ] **T-4** — `src/modules/tasks/actions/obszaryProjektow.ts` zastępuje `projectGroups.ts`
  (plan §3): `getObszaryProjektow` (drzewo + liczniki), `getObszarProjektow` (obszar + poddrzewo +
  projekty), `createObszarProjektow`, `updateObszarProjektow` (strażnik cyklu), `deleteObszarProjektow`,
  `ustawProjektyObszaru`; guardy i `revalidatePath("/tasks")` jak w starym pliku; `paginacja:
  kompletny` z powodem przy pełnych odczytach. Wpisy `obszaryProjektow:*` w `action-coverage.json`
  w miejsce `projectGroups:*`. **Gotowe, gdy:** `tsc` widzi komplet; stary plik usunięty.

## Faza 2 — UI
- [ ] **T-5** — Trasa `/tasks/obszar/[obszarId]` + gałąź `obszarId` w `TasksRouteView` (zakres z
  poddrzewa → `getTasksForProjects`, `viewMode="multi"`, prop `obszar` do `TasksPage` zamiast
  `zestaw`); redirect w `zestaw/[zestawId]/page.tsx` → `/tasks/obszar/<id>` (istniejący i mój,
  inaczej `notFound`). **Gotowe, gdy:** widok obszaru renderuje zadania poddrzewa; stary adres
  przekierowuje (AC-2, AC-3).
- [ ] **T-6** — `FiltrObszarow.tsx` zastępuje `ProjectScopeFilter.tsx` (plan §5): tryb filtra
  (drzewo z wcięciami, wybór jednowartościowy, „Wszystkie obszary", etykieta kotwicy) + tryb
  zarządzania (checkboxy projektów → `ustawProjektyObszaru`, nazwa/emoji/kolor, „Dodaj podobszar",
  „Usuń obszar" destructive → `/tasks/all`, błąd `role="alert"`, sync stanu po zapisie, zdarzenie
  `tasks:areas-changed` po każdej mutacji). Teksty przez `t()`. **Gotowe, gdy:** oba tryby działają,
  stary plik usunięty (AC-6, AC-7).
- [ ] **T-7** — `TasksPage`: `view.obszar` (URL) zamiast `view.projekty`; zawężanie klienckie po
  poddrzewie (helper z T-3 + `areaId` projektów); `FiltrObszarow` w widokach zbiorczych i tryb
  zarządzania w `viewMode="multi"`. **Gotowe, gdy:** filtr zawęża do poddrzewa, zdjęcie filtra =
  wszystko, param `projekty` zniknął bez błędów (AC-6).
- [ ] **T-8** `[P]` — `TasksSideNav`: sekcja „Obszary" (drzewo, zwijanie, projekty pod obszarem z
  `areaId`; projekty bez obszaru w płaskiej liście), nasłuch `tasks:areas-changed`; słowo „Grupy"
  znika. **Gotowe, gdy:** nawigacja odzwierciedla drzewo i mutacje natychmiast (AC-5, AC-7).
- [ ] **T-9** `[P]` — `TasksHomePage`: sekcja „Obszary" z licznikami i linkami (wcięcia
  pod-obszarów), widoczna przy ≥1 obszarze; tworzenie obszaru (pozycja w „Zarządzanie" / inline).
  **Gotowe, gdy:** sekcja działa i znika przy 0 obszarów (AC-4).

## Faza 3 — Porządek po AI (C-23)
- [ ] **T-10** — Usunięcie `create_project_group` z całego łańcucha: `aiAction.ts`,
  `actionContract.ts`, egzekutor `/api/llm/home/execute`, katalog `modules/tasks/ai/*`,
  wpis w `action-coverage.json`. **Gotowe, gdy:** `npm run check:actions` i
  `npm run check:ai-coverage` zielone; grep `create_project_group` pusty.

## Faza 4 — Bramki i domknięcie
- [ ] **T-11** — E2E: aktualizacja `zadania-zestawy.spec.ts` (łańcuch `/tasks/multi?group=` →
  `/tasks/obszar/<id>`; seed przez `areaId`); przebieg spec + pełna suita `scripts/e2e-web.sh`;
  grep `projectGroup|ProjectGroup|zestaw` po src/ na osierocone referencje. **Gotowe, gdy:** spec
  obszaru zielony, suita bez NOWYCH porażek względem stanu zastanego (por. verify 122).
- [ ] **T-12** — Bramki lokalne: `check:schema-drift`, `tsc -p tsconfig.test.json`, `check:i18n`,
  `check:ui-contract`, `next lint`, pełny `npm run build` do `next build` (lokalny PG, C-13).
  **Gotowe, gdy:** wszystko zielone (AC-10).
- [ ] **T-13** — Mapowanie AC-1..AC-10 → wynik (tabela, input do `/verify`); statusy w tym pliku;
  wpis do `doświadczenia.md` przy nieoczywistym problemie (C-51).

## Mapowanie AC → zadania
| AC | Zadania |
|----|---------|
| AC-1 (migracja, pierwsza wygrywa, brak grup w UI) | T-1, T-6..T-9 |
| AC-2 (widok zbiorczy obszaru) | T-5 |
| AC-3 (stare adresy) | T-5, T-11 |
| AC-4 (strona główna) | T-9 |
| AC-5 (sidebar) | T-8 |
| AC-6 (filtr jednowartościowy, poddrzewo) | T-3, T-6, T-7 |
| AC-7 (zarządzanie, destructive, natychmiastowość) | T-4, T-6, T-8 |
| AC-8 (bez kasowania źródła, idempotencja) | T-1 |
| AC-9 (117 nietknięte) | kontrola diffu w T-12 (żadnych zmian w `obszary.ts`/`TaskArea`) |
| AC-10 (build + e2e) | T-11, T-12 |

## Notatki / blokady
- Ścieżka krytyczna: T-1 → T-2 → T-4 → (T-5 → T-6 → T-7) → T-11/T-12; T-8/T-9 równolegle po T-4;
  T-10 niezależne po T-4 (manifesty w jednym stanie spójnym).
