# Zadania: `workspaceId` utrzymywany dla nowych rekordów — etap 2 z czterech

Spec: `spec.md` · Plan: `plan.md` · Gałąź: `claude/omnia-architecture-skins-qlv2ew`

Ścieżka krytyczna: **T-1 → T-2 → T-3 → T-4 → T-5 → T-6**. T-3 (bramka) i T-4 (dowód zachowania) są
niezależne od siebie, ale oba wymagają zastosowanej migracji z T-2.

## Faza 1 — mechanizm

- [x] **T-1** — Ustalić listę objętych tabel i numer migracji.
      Lista wyprowadzona ze `schema.prisma` (`workspaceId String?`, z uwzględnieniem `@@map`),
      numer z `npm run next:migration`.
      *Gotowe, gdy:* lista liczy 45 pozycji i zgadza się z tą z migracji 0227; numer znany.

- [x] **T-2** — Napisać i zastosować migrację `0228_workspaceid_etap2_trigger`.
      Jedna funkcja `omnia_fill_workspace()` (czyta wiersz przez `to_jsonb(NEW)`, pierwszeństwo
      `ownerId`, brak przestrzeni → `NULL`, podana wartość nie jest nadpisywana) + 45 wyzwalaczy
      `BEFORE INSERT` zakładanych pętlą `DO` po **jawnej liście**. Idempotentnie: `CREATE OR REPLACE`
      + `DROP TRIGGER IF EXISTS`. Nagłówek mówi, że to etap 2 z czterech i **kiedy wyzwalacz znika**
      (etap 4, razem z `ownerId`/`ownerTeamId`).
      *Gotowe, gdy:* `npm run check:migrations` zielony; migracja przechodzi na lokalnym Postgresie;
      **powtórne** zastosowanie nie psuje niczego; `npm run check:schema-drift` **nadal zielony bez
      nowych wyjątków**.

## Faza 2 — bramka i dowód

- [ ] **T-3 [P]** — Bramka `check:workspace-fill` + pusty manifest wyjątków.
      `scripts/check-workspace-fill.js` + `src/platform/workspaces/fill-coverage.json`; skrypt
      w `package.json` i wpięcie w `build` obok `check:workspace-mirror`. Trzy kontrole: model bez
      wyzwalacza, wyzwalacz bez modelu, martwy wpis w manifeście.
      *Gotowe, gdy:* bramka zielona na obecnym stanie **i** czerwona po usunięciu jednego wyzwalacza
      z migracji (kontrola negatywna — bramka, której nie widziało się czerwonej, jest zdaniem
      o intencji).

- [ ] **T-4 [P]** — Test zachowania `workspaceFill.integration.test.ts`.
      Pięć przypadków: właściciel osobisty → jego przestrzeń · zespół → przestrzeń zespołu ·
      obie kolumny → wygrywa osobista · właściciel bez przestrzeni → `NULL` i **`create` nie rzuca** ·
      `workspaceId` podany wprost → nie nadpisany. Rekordy tworzone **przez Prismę**, własny fixture,
      `skip` bez `DATABASE_URL`.
      *Gotowe, gdy:* pięć przypadków zielonych; test sprzątane dane usuwa po sobie.

## Faza 3 — domknięcie

- [ ] **T-5** — Komplet bramek i build.
      `check:workspace-fill`, `check:schema-drift`, reszta bramek, `test:unit`, `check:test-types`,
      **`npx tsc --noEmit`** (łańcuch builda go nie zawiera — lekcja z 054), `next lint`,
      `npm run build` przeciw lokalnemu Postgresowi (C-13).
      *Gotowe, gdy:* build **exit 0**, liczniki **160 / 551 / 35 / 35** bez spadku.

- [ ] **T-6** — Dokumentacja: `CLAUDE.md`, dziennik, lekcja.
      `CLAUDE.md` — opis nowej bramki na liście bramek (lista ma być prawdziwa). Dziennik (rozdz. 15)
      — wpis 055: dlaczego wyzwalacz zamiast rozszerzenia Prismy, co zostaje na etapy 3 i 4.
      `doświadczenia.md` — lekcja, jeśli po drodze wyjdzie nieoczywisty problem (C-51).
      *Gotowe, gdy:* trzy pliki (albo dwa + świadome „nie było czego zapisać") zaktualizowane.

## Pokrycie kryteriów akceptacji

| AC | Zadanie | Sposób sprawdzenia |
|----|---------|--------------------|
| AC-1 właściciel osobisty | T-2, T-4 | przypadek 1 testu |
| AC-2 zespół | T-2, T-4 | przypadek 2 |
| AC-3 pierwszeństwo osobistej, reguła w jednym miejscu | T-2, T-4 | przypadek 3 + jedna funkcja w migracji |
| AC-4 brak przestrzeni nie blokuje zapisu | T-2, T-4 | przypadek 4 (`create` nie rzuca) |
| AC-5 bramka wykrywa pominięcie | T-3 | kontrola negatywna: usunięty wyzwalacz → bramka czerwona |
| AC-6 zero odczytów, zero zmian dla użytkownika | T-5 | `git diff` + `grep`; zero plików UI/akcji |
| AC-7 bramki i build | T-5 | tabela wyników w `verify.md` |
| AC-8 dziennik | T-6 | wpis w rozdz. 15 |
