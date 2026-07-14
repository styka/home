# Zadania: <NAZWA FEATURE'A>

- **Plan:** ./plan.md (<NNN-slug>)
- **Status:** todo
- **Data:** <YYYY-MM-DD>

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami** (migracja → akcje → UI → AI → bramki). Każde zadanie jest małe, samodzielne i
> **weryfikowalne**. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
- [ ] **T-1** — Migracja `<NNNN_slug>` (DDL wg planu §2). Sprawdź `npm run check:migrations`.
- [ ] **T-2** — Aktualizacja `schema.prisma` zgodnie z migracją; `prisma generate` czysto.

## Faza 1 — Warstwa serwera
- [ ] **T-3** — Server Action(y) `src/actions/<nazwa>.ts` + guard dostępu (C-21) + `revalidatePath`.
- [ ] **T-4** `[P]` — (jeśli nowy moduł) slug RBAC w migracji + wpięcie `permissions.ts`.

## Faza 2 — UI
- [ ] **T-5** — Strona/serwerowy wrapper + komponent kliencki (motyw CSS-vars, PL).
- [ ] **T-6** — Wpięcie w `modules.tsx` + `ModuleSidebar` (desktop + mobilny tab bar), jeśli moduł.
- [ ] **T-7** `[P]` — Responsywność mobile (`hidden md:flex`, tab bar, safe-area) + skróty klawiszowe.

## Faza 3 — AI / integracje (jeśli dotyczy)
- [ ] **T-8** — `AIAction` + egzekutor w `/api/llm/home/execute`; `npm run check:actions` przechodzi.
- [ ] **T-9** `[P]` — read-tool / kalendarz / powiadomienia / auto-expense.

## Faza 4 — Bramki i domknięcie
- [ ] **T-10** — `next lint` + `next build` (lokalny Postgres, C-13) — zielone.
- [ ] **T-11** — Mapowanie każdego AC ze speca na wynik (input do `/verify`).
- [ ] **T-12** — Wpis do `doświadczenia.md`, jeśli po drodze był nieoczywisty problem (C-51).

## Notatki / blokady
- <T-x zablokowane, bo …>
