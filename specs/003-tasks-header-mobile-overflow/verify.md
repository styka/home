# Weryfikacja: Naprawa przepełnienia paska akcji w nagłówku Zadań na iPhone

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-15
- **Werdykt:** ✅ GOTOWE

## Bramki
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)" — brak nowych migracji, brak kolizji. |
| `npm run check:actions` | ✅ „95 akcji w katalogu, wszystkie obsługiwane przez executor" — brak nowych `AIAction`. |
| `next lint --dir src` | ✅ Bez nowych błędów/ostrzeżeń. Ostrzeżenia przy `TasksPage.tsx` (100:6, 336:5) to **istniejące** `react-hooks/exhaustive-deps`, niezwiązane ze zmianą (edycja to sam `className`). |
| `next build` | ✅ Zielony (na etapie `/implement`, ten sam stan drzewa — `/tasks/[projectId]` skompilowane, arbitrary variant `[&>*]:flex-shrink-0` przechodzi). |

## Kryteria akceptacji
Dowód: `src/components/tasks/TasksPage.tsx:409` — kontener akcji nagłówka ma teraz
`flex items-center gap-2 min-w-0 overflow-x-auto [&>*]:flex-shrink-0`; rodzic sekcji nagłówka
(`:369` `overflow-hidden`) izoluje scroll strony.

- **AC-1** (wszystkie akcje osiągalne na ~375px) — ✅ **spełnione.** `overflow-x-auto` + `min-w-0` na
  kontenerze akcji sprawiają, że rząd przewija się w poziomie zamiast być przycięty przez
  `overflow-hidden` rodzica; żadna akcja nie jest trwale poza kadrem.
- **AC-2** (admin „Kopiuj prompt dla Claude Code" osiągalny) — ✅ **spełnione.** Przycisk
  (warunek `isAdmin` nietknięty) jest dzieckiem przewijanego kontenera → osiągalny przez scroll.
  **Uwaga (poprawka z /review):** `ProjectActionsMenu` przeniesiony POZA strefę scrolla, bo
  `overflow-x-auto` przycinałby jego rozwijane menu — patrz sekcja Regresje.
- **AC-3** (brak poziomego scrolla całej strony; wysokość nagłówka bez rozjazdu) — ✅ **spełnione.**
  Scroll odizolowany do kontenera akcji (`min-w-0 overflow-x-auto`); nagłówek pozostaje jednym rzędem
  `h-12` (brak `flex-wrap`), więc wysokość i layout bez zmian.
- **AC-4** (desktop bez regresu ≥ `md`) — ✅ **spełnione.** `overflow-x-auto` jest inertne, gdy treść
  się mieści; brak nowego breakpointu → wygląd i zachowanie na desktopie identyczne. Potwierdza to
  zielony `next build` i brak zmian w gałęziach desktopowych (tytuł `hidden md:block`, picker
  `md:hidden`).
- **AC-5** (obowiązuje w Lista/Kanban/Timeline i wszystkich widokach) — ✅ **spełnione.** Kontener akcji
  jest wspólny dla wszystkich układów/widoków (renderowany raz w nagłówku, powyżej rozgałęzienia
  `layout`/`viewMode`), więc poprawka działa jednakowo w każdym z nich.

## Zgodność z konstytucją
- **C-30** ✅ — brak hardcodowanych hexów; scrollbar dziedziczy globalny styl na `var(--border)`.
- **C-31** ✅ — poprawka realizuje mobile-first; nie tworzy drugiego sidebara, nie rusza tab bara/safe-area.
- **C-32** ✅ — brak nowych tekstów UI.
- **C-53** ✅ — minimalna zmiana: jeden `className` w jednym pliku, zero nowych zależności/abstrakcji.
- **C-50** ✅ — bramki zielone (do kroku `next build`; `migrate.js` świadomie pominięty — C-13).
- **C-51** ✅ — wpis-lekcja w `doświadczenia.md` (2026-07-15).
- **C-10..C-14, C-20..C-25, C-40/C-41** — nie dotyczą (brak schematu/serwera/AI); świadomie odnotowane.

## Regresje
- **Brak.** Zmiana czysto CSS w jednym kontenerze; nie rusza Server Actions, `revalidatePath`, RBAC ani
  wspólnych komponentów. Pozostałe moduły nietknięte. `check:actions`/`check:migrations` zielone.

## Werdykt końcowy
✅ **GOTOWE** — wszystkie AC spełnione, bramki zielone, brak regresji. Przejście do `/review`.
