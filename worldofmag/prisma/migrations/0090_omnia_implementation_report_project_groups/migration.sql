-- Raport implementacyjny: „Grupy projektów" w module Zadania (przeprojektowanie „Widoków").
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-05 (grupy projektów)',
  'omnia-implementacja-2026-06-05-grupy-projektow',
  $omnia_project_groups$# Omnia — Raport implementacji 2026-06-05

Trzecia iteracja tematu „zadania z wielu projektów naraz". Na podstawie rozmowy z
użytkownikiem zmieniono model mentalny z osobnych „Widoków" na **grupy projektów**
wplecione w listę projektów (folder, który rozwijasz i klikasz po wspólny widok), przy
zachowaniu elastycznego modelu wiele-do-wielu (projekt może być w kilku grupach i nadal
stoi samodzielnie na liście).

---

## Grupy projektów zamiast „Widoków" — foldery w liście projektów
**Diagnoza:** Zapisane „Widoki wielu projektów" działały, ale jako osobna sekcja nie
trafiały w intuicję. Użytkownik chciał **grup projektów** żyjących w samej liście
projektów: grupa zachowuje się jak „super-projekt" (klik = wspólny widok zadań), rozwija
się, by pokazać projekty w środku, a przy projekcie ma być widać, że należy do grupy.
Wybrany (świadomie) model: elastyczny, wiele-do-wielu (jak portfolia w Asanie), nie sztywne
foldery 1:1 — bo projekt ma móc być w kilku grupach i wciąż występować pojedynczo.

**Rozwiązanie:** Model danych pozostał ten sam (lista projektów jako JSON `string[]`), więc
zmiana jest głównie konceptualno-prezentacyjna. Encję przemianowano w kodzie
`TaskView` → `ProjectGroup`, ale **bez ruszania tabeli** — przez Prisma `@@map("TaskView")`.
Dzięki temu nie ma ryzykownego `ALTER TABLE RENAME` na już wdrożonym (na `develop`)
środowisku; migracja dokłada jedynie kolumnę `color` (kropka-znacznik). Akcje
(`taskViews.ts` → `projectGroups.ts`) zachowały logikę dostępu i liczenia aktywnych zadań
(jeden `groupBy`), doszła obsługa koloru.

Panel boczny Zadań przebudowano: nad listą projektów jest sekcja **„Grupy"** — każda grupa
to rozwijalny **folder** (chevron; stan rozwinięcia trzymany w `localStorage`
`tasks.groups.expanded`, domyślnie zwinięte, by nie zaśmiecać). Klik w nazwę grupy otwiera
wspólny widok `/tasks/multi?group=<id>`; rozwinięcie pokazuje projekty grupy zagnieżdżone.
Przy każdym projekcie na płaskiej liście dodano **dyskretny znacznik przynależności** —
małe kropki w kolorach grup, z tooltipem „W grupach: …". Widać więc obie strony relacji:
grupa→projekty (po rozwinięciu) i projekt→grupy (po kropkach). Zachowano „pasek zakresu"
(chipy projektów) na wspólnym widoku jako mocny, zawsze widoczny sygnał „z czego ta lista".
Trasa obsługuje `?group=<id>` z aliasem wstecznym `?view=` oraz doraźnym `?projects=`.

Świadome decyzje UX (konkurujemy z najlepszymi): foldery-nad-projektami to znajoma
konwencja (Things/Finder); grupy zwinięte domyślnie + subtelny znacznik = brak przytłoczenia
mimo duplikacji (projekt jest i pod grupą, i samodzielnie); inline-edytor (emoji, nazwa z
auto-podpowiedzią, kolor, checkboxy projektów) to jeden spójny przepływ create/edit.

**Zmienione pliki:**
- `prisma/schema.prisma` — `TaskView` → `model ProjectGroup { … @@map("TaskView") }` + `color String?`; relacja `User.projectGroups`.
- `prisma/migrations/0089_project_group_color/` — `ADD COLUMN IF NOT EXISTS "color"`.
- `src/actions/projectGroups.ts` — nowy (z `taskViews.ts`): CRUD grup + `color`, liczenie aktywnych zadań.
- `src/types/index.ts` — `TaskView` → `ProjectGroup` (+ `color`).
- `src/app/tasks/[projectId]/page.tsx` — `?group=` (alias `?view=`), `getProjectGroup`, `multiGroupId`.
- `src/components/tasks/TasksSideNav.tsx` — sekcja „Grupy" jako foldery (chevron + zagnieżdżone projekty + localStorage), znacznik przynależności przy projektach, edytor z kolorem.
- `src/components/tasks/TasksPage.tsx` — pasek zakresu: prop `multiGroupId`, link edycji `?group=…&edit=1`.
- `CLAUDE.md`, `doświadczenia.md` — aktualizacja schematu/akcji/trasy + lekcja.

## Podsumowanie
Iteracja na bazie feedbacku: ta sama logika danych, nowy model mentalny i nawigacja.
Kluczowe decyzje: `@@map` zamiast rename tabeli (zero ryzyka na wdrożonej DB) oraz foldery
grup wplecione w listę projektów z dwukierunkową widocznością przynależności. Weryfikacja:
`node scripts/check-action-coverage.js` (czysto), `npx prisma generate`, `next build`
(kompilacja i type-check bez błędów; `UntrustedHost` przy prerenderze nieszkodliwe). Raport
zapisany przez migrację → trafia do `/reports` na deployu.
$omnia_project_groups$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
