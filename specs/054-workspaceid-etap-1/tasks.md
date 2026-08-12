# Zadania: `workspaceId` — etap 1 z czterech

Spec: `spec.md` · Plan: `plan.md` · Gałąź: `claude/omnia-architecture-skins-qlv2ew`

Ścieżka krytyczna jest liniowa: **T-1 → T-2 → T-3 → T-4 → T-5**. Nic tu nie idzie równolegle,
bo każdy krok czyta wynik poprzedniego (zbiór modeli → DDL → zastosowanie → dowód kompletności).

## Faza 1 — schemat

- [x] **T-1** — Wyznaczyć zbiór modeli i dopisać kolumnę do `schema.prisma`.
      `workspaceId String?` + `@@index([workspaceId])` na każdym modelu z `ownerId` lub
      `ownerTeamId`. `Team` **wykluczony** z komentarzem `///` mówiącym dlaczego (jest źródłem
      przestrzeni, nie zasobem w niej).
      *Gotowe, gdy:* 45 modeli ma kolumnę, `prisma format` przechodzi, `Team` jej nie ma.

## Faza 2 — migracja

- [x] **T-2** — Napisać `prisma/migrations/0227_workspaceid_etap1/migration.sql`.
      Numer z `npm run next:migration`. DDL z `prisma migrate diff` **przeczytany w całości**
      (C-15) — usunąć `DROP INDEX` na indeksach trigramowych i `ALTER COLUMN … DROP DEFAULT`,
      a w nagłówku wymienić, co usunięto i dlaczego. Backfill po nazwach **tabel** (`@@map`).
      *Gotowe, gdy:* `grep -E "^(DROP|ALTER TABLE .* DROP)"` nic nie zwraca; nagłówek opisuje
      cztery etapy i sposób wycofania; `npm run check:migrations` zielony.

- [x] **T-3** — Zastosować migrację lokalnie i potwierdzić idempotencję.
      Lokalny Postgres (C-13). Backfill uruchomiony dwa razy — drugi przebieg nie zmienia nic.
      *Gotowe, gdy:* migracja przechodzi na czystym i na zapełnionym stanie; powtórzenie
      backfillu daje zero zmian; `reconcileWorkspaces()` po backfillu zwraca `{0,0,0}`
      (dowód, że TypeScript i SQL rozumieją regułę tak samo).

## Faza 3 — dowód

- [x] **T-4** — Test kompletności wyprowadzony ze schematu.
      `src/platform/workspaces/__tests__/workspaceBackfill.integration.test.ts`: lista tabel
      z `schema.prisma` (z `@@map`), porównanie ze zbiorem `ADD COLUMN` w 0227, rozróżnienie
      **luka** (właściciel ma przestrzeń — awaria) od **sieroty** (właściciel jej nie ma —
      liczba do raportu). Kontrola negatywna: wyzerować kolumnę na jednym rekordzie i zobaczyć
      test na czerwono.
      *Gotowe, gdy:* test zielony na wypełnionej bazie i czerwony po wprowadzeniu luki.

## Faza 4 — domknięcie

- [x] **T-5** — Bramki, build, dziennik, lekcja.
      Komplet bramek + `test:unit` + `next lint` + `next build` (lokalny Postgres).
      Dziennik (rozdz. 15): etap 1 **wraz z jawną listą pozostałych trzech etapów** i tym, co
      każdy obejmuje (AC-7). `doświadczenia.md`: lekcja o `@@map` w ręcznie pisanym SQL-u (C-51).
      *Gotowe, gdy:* bramki bez spadku liczników (160/551/35/35), build zielony, oba wpisy są.

## Pokrycie kryteriów akceptacji

| AC | Zadanie | Sposób sprawdzenia |
|----|---------|--------------------|
| AC-1 kolumna nullable + indeks | T-1, T-2 | schemat + DDL; żadna istniejąca kolumna nie tknięta |
| AC-2 zero rekordów z własnością i pustą przestrzenią | T-4 | test kompletności po wszystkich 45 tabelach |
| AC-3 backfill idempotentny | T-3 | drugi przebieg = zero zmian |
| AC-4 aplikacja nie zauważa | T-2, T-5 | zero zmian w `src/` poza testem; build + lint |
| AC-5 `check:schema-drift` zielony | T-5 | bramka porównuje schemat z katalogiem migracji |
| AC-6 komplet bramek i build | T-5 | wynik każdej bramki w `verify.md` |
| AC-7 dziennik z listą etapów 2–4 | T-5 | wpis w rozdz. 15 |
