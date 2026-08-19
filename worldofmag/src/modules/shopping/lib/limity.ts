/**
 * 080 (Z6): sufit pozycji na jedno zlecenie wsadowe — zabezpieczenie przed wklejeniem powieści
 * zamiast listy zakupów.
 *
 * Stała mieszka TUTAJ, a nie przy akcji, bo z pliku `"use server"` wolno eksportować wyłącznie
 * funkcje asynchroniczne — `next build` wywala się na wszystkim innym, a `tsc --noEmit` tego
 * NIE łapie (zapisane w CLAUDE.md).
 */
export const MAX_POZYCJI_WSADOWO = 200;
