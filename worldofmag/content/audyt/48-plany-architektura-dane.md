# Dodatek A.2 — Plany wdrożenia: architektura i dane

Plany dla Claude Code realizujące zalecenia z Rozdz. 6 (architektura/kod) i Rozdz. 7 (dane/Prisma).
Każdy plan: **cel → kroki → pliki → kryteria akceptacji → ryzyka**.

---

## Plan Z-030 (P0) — Indeksy własności we wszystkich modelach multi-tenant

**Cel:** wyeliminować full-scany przy listowaniu danych użytkownika/zespołu.

**Kroki:**
1. Wypisać wszystkie modele z `ownerId`/`ownerTeamId` w `prisma/schema.prisma` i sprawdzić, które
   **nie** mają `@@index` na tych kolumnach (potwierdzone braki: `ShoppingList`, `TaskProject`, `Note`,
   `Store`; przejrzeć całość — jest ich kilkanaście).
2. Dodać `@@index([ownerId])` i `@@index([ownerTeamId])` (dla user-only — tylko `ownerId`).
3. Wygenerować migrację: `npm run next:migration` → utworzyć `prisma/migrations/NNNN_owner_indexes/
   migration.sql` z `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` (CONCURRENTLY — bez blokady tabeli;
   uwaga: poza transakcją).
4. Zweryfikować `npx next build` + `npm run check:migrations`.

**Pliki:** `prisma/schema.prisma`, nowa migracja.
**Kryteria akceptacji:** każdy model multi-tenant ma indeks na kolumnach własności; build zielony; (opcj.)
`EXPLAIN` na liście zadań pokazuje Index Scan zamiast Seq Scan.
**Ryzyka:** `CREATE INDEX CONCURRENTLY` nie działa w transakcji — w migracji nie owijać w `BEGIN/COMMIT`.

---

## Plan Z-031 (P1) — Indeksy złożone pod realne zapytania

**Cel:** przyspieszyć najczęstsze filtry (status, termin, data).
**Kroki:** zidentyfikować zapytania stron list (np. `tasks` po `ownerId+status`, `ownerId+dueDate`);
dodać `@@index([ownerId, status])`, `@@index([ownerId, dueDate])`, `@@index([ownerId, createdAt])` tam,
gdzie pasują; migracja jak Z-030.
**Kryteria:** plany zapytań kluczowych list używają indeksów złożonych.

---

## Plan Z-032 (P1) — Connection pooling (Neon)

**Cel:** przetrwać skok połączeń przy ruchu.
**Kroki:** w env produkcyjnym ustawić `DATABASE_URL` na **pooler** Neona (PgBouncer), `DIRECT_URL` na
połączenie bezpośrednie (tylko migracje); zweryfikować, że Prisma używa poolera do zapytań, a migracje
`DIRECT_URL`. Udokumentować w CLAUDE.md.
**Pliki:** konfiguracja env (Render), ewentualnie `schema.prisma` (komentarz), CLAUDE.md.
**Kryteria:** zapytania idą przez pooler; migracje działają przez `DIRECT_URL`.
**Ryzyka:** część funkcji (np. `LISTEN/NOTIFY`) nie działa przez pooler — nie używamy ich.

---

## Plan Z-033 (P1) — Jawna polityka `onDelete` (pod RODO)

**Cel:** zlikwidować ciche sieroty i przygotować twarde usuwanie konta.
**Kroki:** przejrzeć ~108 relacji bez jawnego `onDelete`; dla powiązań z `User`/własnością ustawić
świadomie `Cascade` (dane usera) lub `Restrict` (gdzie sierota jest błędem); spójnie z planem Z-051
(usuwanie konta). Migracja zmieniająca FK.
**Kryteria:** każda relacja własności/powiązania z `User` ma jawne `onDelete`; usunięcie testowego usera
nie zostawia sierot.

---

## Plan Z-034 (P2) — JSONB + GIN dla pól filtrowanych

**Cel:** umożliwić zapytania po wybranych polach JSON.
**Kroki:** wytypować pola filtrowane (kandydaci: `Pet.genetics`, dane bazy wiedzy); zmienić typ kolumny
na `Jsonb` (migracja `ALTER TABLE … USING …::jsonb`), dodać indeks GIN; zaktualizować odczyty (parsowanie
znika). Reszta JSON-jako-String zostaje.
**Ryzyka:** migracja typu wymaga poprawnych istniejących danych JSON — najpierw walidacja/sanityzacja.

---

## Plan Z-010 (P1) — Rozbić egzekutor AI `execute/route.ts`

**Cel:** zredukować plik 1467 linii i ryzyko regresji.
**Kroki:**
1. Wprowadzić `Record<AIAction["type"], (action, ctx) => Promise<Result>>` (rejestr handlerów) — np.
   `src/lib/ai/executors/*.ts` per moduł.
2. Przenosić handlery z łańcucha `if (type === …)` do rejestru **po jednym module na commit**.
3. Zostawić `check-action-coverage.js` (działa na nazwach typów — dostosować parsowanie, jeśli zmieni
   się kształt).
**Kryteria:** `execute/route.ts` deleguje do rejestru; strażnik pokrycia nadal zielony; build OK.
**Ryzyka:** strażnik czyta `type === "…"` — przy zmianie wzorca zaktualizować regex strażnika.

---

## Plan Z-011 / Z-015 (P1) — ESLint/Prettier + osobny typecheck

**Cel:** wczesne łapanie błędów, spójny styl.
**Kroki:** dodać `eslint` (config Next + `react-hooks`) i `prettier`; skrypty `lint`, `typecheck`
(`tsc --noEmit`); uruchomić, **naprawić tylko reguły krytyczne** (hooks, unused), resztę jako warning;
wpiąć do CI (plan Z-170) jako nieblokujące do czasu baseline = 0.
**Kryteria:** `npm run lint`/`npm run typecheck` działają; CI je uruchamia (ostrzegawczo).

---

## Pozostałe (skrót)

- **Z-012/Z-013 (P2)** — warstwa tokenów stylów + reguła „>800 linii”: realizować przyrostowo przy okazji
  dotykania plików (patrz Rozdz. 11, plan A.6).
- **Z-014 (P2)** — udokumentować granice modułów i agregatory w raporcie systemowym/`/admin/architecture`.
- **Z-035 (P2·L)** — ścieżka skalowania bazy (repliki/sharding): tylko projekt + gotowość kluczy, wdrożenie
  przy 10M+.
- **Z-036/Z-037 (P1/P2)** — przegląd FK bez `onDelete` (część Z-033) + diagnostyka „wolnych zapytań” w
  `/admin/health` (EXPLAIN na typowych listach).

**Kolejność w obrębie obszaru:** Z-030 → Z-031 → Z-032 → Z-033 → Z-010 → Z-011/Z-015 → reszta.
