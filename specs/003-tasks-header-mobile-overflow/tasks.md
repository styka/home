# Zadania: Naprawa przepełnienia paska akcji w nagłówku Zadań na iPhone

- **Plan:** ./plan.md (003-tasks-header-mobile-overflow)
- **Status:** done
- **Data:** 2026-07-15

> Feature czysto prezentacyjny — brak faz danych/serwera/AI. Kolejność: UI → bramki → domknięcie.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można równolegle

## Faza 0 — Fundament danych
- [ ] **T-1** — **Brak.** Bez zmian schematu/migracji (plan §2). `check:migrations` przejdzie trywialnie.

## Faza 1 — Warstwa serwera / RBAC
- [ ] **T-2** — **Brak.** Bez Server Actions i bez zmian RBAC (plan §3, §4).

## Faza 2 — UI (jedyna warstwa zmian)
- [x] **T-3** — W `src/components/tasks/TasksPage.tsx` na kontenerze akcji nagłówka
  (`<div className="flex items-center gap-2">`, ~linia 408) dodać `min-w-0 overflow-x-auto
  [&>*]:flex-shrink-0`. Nie ruszać mobilnego pickera (`flex-1 mr-2`), desktopowego tytułu ani logiki
  `isAdmin` przy `TaskListClipboardButton`.
  **Gotowe, gdy:** kontener akcji przewija się w poziomie na wąskim ekranie, ikony zachowują rozmiar,
  a reszta nagłówka nietknięta.

## Faza 3 — AI / integracje
- [ ] **T-4** — **Brak.** Nie dotyczy (plan §6). `check:actions` przejdzie trywialnie.

## Faza 4 — Bramki i domknięcie
- [x] **T-5** — Weryfikacja lokalna: `node_modules/.bin/next lint` (jeśli dostępny) + `node_modules/.bin/next build`
  (do kroku `next build`, bez `migrate.js` — C-13). **Gotowe, gdy:** build zielony, brak nowych błędów/ostrzeżeń
  wprowadzonych zmianą.
- [x] **T-6** — Mapowanie AC → wynik (input do `/verify`):
  - **AC-1/AC-2/AC-5** — T-3 (scroll kontenera akcji; wszystkie akcje osiągalne we wszystkich układach/widokach).
  - **AC-3** — T-3 (`overflow-x-auto` + `min-w-0` izolują scroll; strona bez poziomego scrolla).
  - **AC-4** — T-3 (klasa inertna przy braku nadmiaru → desktop bez regresu).
- [x] **T-7** — Wpis do `doświadczenia.md` (C-51): lekcja o `overflow-hidden` rodzica przycinającym
  przepełniony nagłówek na mobile (fix = izolowany `overflow-x-auto` na kontenerze akcji).

## Ścieżka krytyczna
T-3 (jedyna zmiana kodu) → T-5 (build) → T-6 (mapowanie AC) → T-7 (lekcja). T-1/T-2/T-4 to świadome „brak".

## Notatki / blokady
- Brak.
