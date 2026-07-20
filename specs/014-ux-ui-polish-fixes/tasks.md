# Zadania: Poprawki UX/UI — przepełnienie, widoczność ikon/pól, zoom na focus

- **Plan:** ./plan.md (014-ux-ui-polish-fixes)
- **Status:** done
- **Data:** 2026-07-20

> Cztery **niezależne** poprawki front-endowe (różne pliki) → większość zadań jest równoległa `[P]`.
> Brak Fazy 0/1/3 (bez migracji, Server Actions, RBAC, AI). Kolejność: od najprostszej edycji do
> najszerszej, potem bramki i domknięcie.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzednich (inny plik), można robić równolegle

## Faza 2 — UI (sedno feature'a)

- [x] **T-1** `[P]` — **Widoczność FAB asystenta przy szczegółach zadania** (AC-2). W
  `worldofmag/src/components/tasks/TasksPage.tsx` dodać `data-omnia-overlay="taskdetail"` do wrappera
  mobilnego panelu szczegółów (`md:hidden fixed inset-0 z-50 …`). *Gotowe, gdy:* atrybut jest na tym
  divie, więc `CONTENT_MODAL_SELECTOR` (`:not([data-omnia-overlay])`) go pomija — FAB nie znika przy
  otwartym zadaniu (desktop panel boczny + mobile modal).

- [x] **T-2** `[P]` — **Widoczność pola daty w QuickAddTask** (AC-3, AC-5). W
  `worldofmag/src/components/tasks/QuickAddTask.tsx` podnieść wagę pola `type="date"`: tło
  `var(--bg-elevated)`, padding `px-2 py-1`, dodać ikonę `Calendar` (`lucide-react`) jako afordancję —
  wzorem pola „Start" w `TaskDetail.tsx`; wyłącznie zmienne CSS (bez hexów). *Gotowe, gdy:* puste pole
  daty jest wyraźnie widoczne jako pole, spójnie z `TaskDetail`, w każdej skórce.

- [x] **T-3** `[P]` — **Anty-zoom na focus (iOS)** (AC-4). W `worldofmag/src/app/globals.css` dodać regułę
  `@media (pointer: coarse) { input:not([type="checkbox"]):not([type="radio"]), select, textarea {
  font-size: 16px; } }`. *Gotowe, gdy:* kontrolki formularzy na urządzeniu dotykowym mają efektywnie 16px
  (brak auto-zoomu), pinch-zoom nietknięty (bez `maximum-scale`), desktop bez zmian.

- [x] **T-4** `[P]` — **Zawijanie w stylach markdown** (AC-1). W
  `worldofmag/src/lib/markdown.ts` (`MARKDOWN_STYLES`) dodać `overflow-wrap: anywhere; word-break:
  break-word;` do `.md-p`, `.md-li`, `.md-oli`, `.md-td`, `.md-link`; zapewnić przewijanie szerokich
  tabel (`.md-table`/kontener `overflow-x:auto`). *Gotowe, gdy:* długie URL/tekst w treści wiedzy zawijają
  się zamiast rozpychać, szeroka tabela scrolluje się lokalnie.

- [x] **T-5** — **Przepełnienie layoutu Wiadomości** (AC-1). W
  `worldofmag/src/components/news/NewsPage.tsx` nadać kolumnie treści gridu `min-w-0` (grid
  `md:grid-cols-[240px_1fr]` — track `1fr` z domyślnym `min-width:auto` rozpycha stronę). W
  `worldofmag/src/components/news/NewsItemCard.tsx` dodać `break-words`/`min-w-0` na tytule i streszczeniu,
  by długie linki się łamały. *Gotowe, gdy:* przy szerokim obrazie lub długim linku strona **nie** ma
  poziomego scrolla na wąskim widoku.

## Faza 4 — Bramki i domknięcie

- [x] **T-6** — **Bramki** (C-50). Z `worldofmag/`: `npx next lint` + `npm run build` na **lokalnym**
  Postgresie (C-13 — nigdy prod DB). `check:migrations`/`check:actions` mają przejść trywialnie (brak
  nowych migracji/akcji). *Gotowe, gdy:* build zielony.

- [x] **T-7** — **Mapowanie AC → wynik** (input do `/verify`): AC-1→T-4+T-5, AC-2→T-1, AC-3→T-2,
  AC-4→T-3, AC-5→T-1+T-2 (weryfikacja braku hardcode kolorów). *Gotowe, gdy:* każde AC ma pokrycie.

- [x] **T-8** — **Wpis do `doświadczenia.md`** (C-51), jeśli po drodze wyszedł nieoczywisty problem
  (np. pułapka „mobilny modal w DOM na desktopie" z `useOverlayState`, albo specyficzność CSS vs Tailwind
  przy anty-zoomie). *Gotowe, gdy:* lekcja dopisana (jeśli dotyczy).

## Mapa kryteriów akceptacji
| AC | Zadania |
|----|---------|
| AC-1 (brak overflow Wiadomości) | T-4, T-5 |
| AC-2 (FAB widoczny w szczegółach zadania) | T-1 |
| AC-3 (widoczne pole daty przy dodawaniu) | T-2 |
| AC-4 (brak auto-zoomu na focus) | T-3 |
| AC-5 (poprawność w skórkach, brak hardcode) | T-1, T-2 |

## Notatki / blokady
- Brak zależności między T-1..T-5 (różne pliki) → można je robić w dowolnej kolejności/równolegle;
  T-6..T-8 wymagają ich ukończenia.
