# Recenzja: Przestrzenie i nadania — fundament danych pod współdzielenie

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-12 · **Branch:** `claude/omnia-architecture-skins-qlv2ew`
- **Diff:** 25 plików, **+1737 / −41** (w tym 5 plików generowanych i 4 artefakty pipeline'u)

Recenzja celowała w to, czego `verify.md` sprawdzić nie mógł: czy nowy zapis do bazy nie psuje
ścieżek, na których siedzi, i czy bramka pilnuje tego, co deklaruje. Znalazła trzy rzeczy — jedna
z nich to **przeoczony punkt mutacji**, którego nie widziała ani weryfikacja, ani ja.

---

## Ustalenia

### 1. Bramka lustra nie widziała transakcji interaktywnych — i przez to przeoczyliśmy trzeci punkt mutacji — correctness

- **Plik:** `worldofmag/scripts/check-workspace-mirror.js:33` (przed poprawką) →
  `worldofmag/src/lib/privacy/purge.ts`
- **Kategoria:** correctness

Wzorzec bramki brzmiał `prisma\.(team|teamMember)\.(create|update|delete…)`. W transakcji
interaktywnej (`prisma.$transaction(async (tx) => …)`) mutacja nazywa się **`tx.team.update`**, więc
bramka ją przepuszczała bez słowa. Na tym opierało się moje własne zdanie z planu i z `CLAUDE.md`:
*„dziś takich plików są dokładnie dwa"*. **Były trzy.**

**Scenariusz awarii (realny, nie hipotetyczny):** użytkownik usuwa konto (RODO, `purgeUserData`).
Jeśli był właścicielem zespołu z innymi członkami, `resolveOwnedTeams` przekazuje własność następcy:
`TeamMember.role → "OWNER"` i `Team.ownerId → successor`. Członkostwo usuwanego znika z przestrzeni
kaskadą (FK na `userId`), ale **rola `owner` nie przeskakuje na następcę** — przestrzeń zostaje bez
właściciela. Po zadaniu 10, gdy `requireAccess` zacznie czytać przestrzenie, następca **straciłby
prawo zarządzania zespołem, którego jest właścicielem**.

**Poprawione w recenzji:** wzorzec obejmuje `tx` obok `prisma` (z komentarzem, dlaczego), a
`purge.ts` uzgadnia przestrzenie zespołów, których własność przeszła. Uzgodnienie idzie **po
commicie transakcji** — `syncTeamWorkspace` pracuje na globalnym kliencie i w środku widziałoby stan
sprzed zapisu. `resolveOwnedTeams` zwraca w tym celu listę przekazanych zespołów; zespoły usunięte
na liście nie są, bo ich przestrzeń kaskaduje razem z nimi.

Bramka po poprawce raportuje **3 pliki**, nie 2. Test negatywny na wariancie `tx.` wykonany.

### 2. Lustro mogło wywalić logowanie i tworzenie zespołu — correctness

- **Pliki:** `worldofmag/src/platform/auth/session.ts` (zdarzenie `createUser`),
  `worldofmag/src/actions/teams.ts`, `worldofmag/src/actions/invitations.ts`
- **Kategoria:** correctness

Wpięcia były zwykłym `await`. Wyjątek z lustra propagował się do wołającego.

**Scenariusz awarii:** chwilowy błąd bazy przy `ensurePersonalWorkspace` w zdarzeniu `createUser`
przerywa **zakładanie konta** — a przestrzeń osobista nie ma dziś ani jednego czytelnika. To samo
w `createTeam`: zespół powstał, lustro padło, użytkownik widzi błąd i próbuje ponownie, tworząc
duplikat. Drugi, cichszy wariant: `ensurePersonalWorkspace` wywołane równolegle dwa razy trafia na
unikalny indeks `personalUserId` i jedno wywołanie rzuca.

Ryzyko jest asymetryczne: **koszt awarii lustra ≈ 0** (nikt go nie czyta, a `reconcileWorkspaces`
naprawia rozjazd), **koszt awarii operacji użytkownika = wysoki**.

**Poprawione w recenzji:** dwa jawnie nazwane warianty ciche — `mirrorTeamWorkspace`
i `mirrorPersonalWorkspace` — logujące ostrzeżenie zamiast rzucać; ścieżki użytkownika wołają je,
a `syncTeamWorkspace`/`ensurePersonalWorkspace` zostają ścisłe dla testów i `reconcileWorkspaces`.
**W kodzie stoi wprost, kiedy to przestaje być bezpieczne:** gdy przestrzenie dostaną pierwszego
czytelnika (zadanie 10), warianty ciche mają zniknąć, bo cichy brak wiersza zamieni się w cichą
odmowę dostępu.

### 3. Migracja kasowała indeksy trigramowe — correctness — **naprawione już na etapie weryfikacji**

- **Plik:** `worldofmag/prisma/migrations/0226_workspaces_and_grants/migration.sql`
- **Kategoria:** correctness

Odnotowuję dla porządku, bo to najpoważniejsza rzecz tego przebiegu; pełny opis w `verify.md`.
DDL wygenerowany przez `prisma migrate diff --to-schema-datamodel` zawierał `DROP INDEX` na obu
indeksach GIN wyszukiwania notatek i trzy `ALTER COLUMN "updatedAt" DROP DEFAULT` na niezwiązanych
tabelach — bo diff proponuje **doprowadzenie bazy do schematu**, więc chce skasować wszystko, co
żyje wyłącznie w surowym SQL-u. Usunięte; w migracji został komentarz wymieniający je z nazwy.
Zasada wylądowała w konstytucji jako **C-15**.

### 4. Guardy dostępu w funkcjach lustra — świadomie ich nie ma — obserwacja

- **Kategoria:** obserwacja (bez poprawki)

`syncTeamWorkspace` i `ensurePersonalWorkspace` nie sprawdzają uprawnień i **nie mogą**: są wołane
z akcji, które już sprawdziły `requireTeamRole`, oraz ze zdarzenia tworzenia konta, gdzie sesji
jeszcze nie ma. Guard w środku byłby albo martwy, albo blokowałby zakładanie konta. To ten sam układ
co w `platform/trash` i jest opisany w nagłówku modułu — sprawdziłem, że nie da się ich zawołać
z trasy ani z akcji bez uprzedniego guardu.

### 5. Backfill nie może utracić danych — obserwacja

Przeczytałem migrację instrukcja po instrukcji pod kątem tego, co może zniszczyć: po usunięciu
pięciu niezamówionych statementów zostały **wyłącznie** `CREATE TABLE`/`CREATE INDEX`/
`ADD CONSTRAINT` i pięć `INSERT … ON CONFLICT`. Żadnego `UPDATE` ani `DELETE` na istniejących
tabelach. Najgorszy możliwy skutek błędu to niekompletne lustro — nigdy utrata danych.

### Czego NIE zgłaszam

Zero enumów Prisma, zero zaszytych kolorów (przebieg nie dotyka UI), teksty PL, zero nowych
`AIAction`, zero nowych zależności, `revalidatePath` nietknięte, model współwłasności
(`ownerId`/`ownerTeamId`) bez jednej zmiany. `resourceType` w nadaniach jest **tekstem**, więc
platforma nadal nie zna żadnego modułu (C-36). Test lustra sprząta po sobie w `finally`.

---

## Bramki po recenzji

| Komenda | Wynik |
|---|---|
| `npm run build` (pełny potok, lokalny Postgres) | ✅ **exit 0**, „Compiled successfully" |
| `npm run test:unit` | ✅ **666 / 666** |
| `tsc --noEmit` · `tsc -p tsconfig.test.json` | ✅ oba exit 0 |
| `next lint --dir src` | ✅ 0 błędów |
| `check:workspace-mirror` | ✅ **3 pliki** mutujące zespół, każdy uzgadnia przestrzeń |
| `check:schema-drift` | ✅ realnie uruchomiona, brak rozjazdu |
| `check:actions` 160 · `check:ai-coverage` 551 · `check:cost-badge` 35 · `check:content-memory` 35 | ✅ bez ruchu |
| `check:migrations` · `check:module-registry` · `check:boundaries` · `check:ui-contract` | ✅ |

**Klikacze:** nieuruchamiane — decyzja właściciela. Dla przebiegu bez ani jednego pliku w `src/app`
i `src/components` maszynowy dowód z AC-9 jest ostrzejszy niż klikacz.

---

## Werdykt

## **APPROVE Z UWAGAMI**

**Faza 2 przebudowy jest otwarta.** Fundament współdzielenia istnieje i — co ważniejsze — **jest
wypełniony danymi**: każde konto i każdy zespół ma swoją przestrzeń, a niezmiennik utrzymuje się
także dla danych powstających po wdrożeniu. Aplikacja nie zauważa niczego: zero plików w trasach
i komponentach, dostęp liczony dalej przez `ownerId`/`ownerTeamId`.

Najcenniejsze w tym przebiegu jest to, **co znalazły narzędzia, a nie oko**, i w jakiej kolejności.
Naprawa bramki `check:schema-drift` — która wcześniej **pomijała kontrolę** w środowisku bez
uprawnienia `CREATEDB`, czyli była najcichsza tam, gdzie najbardziej potrzebna — natychmiast wyłapała
migrację kasującą indeksy wyszukiwania notatek. Poszerzenie wzorca bramki lustra o transakcje
interaktywne wyłapało **trzeci punkt mutacji zespołów**, o którym twierdziłem w planie, że nie
istnieje. Obie rzeczy przeszłyby build na zielono.

Zaliczam też własną pomyłkę w diagnozie: padające testy `notesFts` wziąłem najpierw za stan lokalnej
bazy i **odtworzyłem indeksy ręcznie**, przez co defekt schował się na jeden cykl. To jest zapisane
w `doświadczenia.md`, bo lekcja jest ogólna: padający test to hipoteza o przyczynie, nie usterka
środowiska do obejścia.

**Uwagi, z którymi to wypuszczamy:**
- **`ResourceGrant` i `ResourceInvitation` nie mają konsumenta** do zadań 10/12 — świadome
  odstępstwo od C-35 z nazwaną ceną, powtórzone w dzienniku i w `CLAUDE.md`, żeby nikt nie usunął
  ich „w ramach porządków";
- **unikalność nadań linkowych nie działa** (`subjectId: NULL`, a w PostgreSQL `NULL != NULL`) —
  poprawka wymaga częściowego indeksu w surowym SQL-u i wchodzi w zadaniu 12, gdy będzie wiadomo,
  czy nadania linkowe w ogóle są w pierwszej odsłonie;
- **warianty ciche lustra mają zniknąć w zadaniu 10** — dopóki nikt nie czyta przestrzeni, połknięcie
  błędu jest właściwym kompromisem; potem przestaje być.

**Pierwszy krok dalej:** zadanie 10 — `platform/sharing`, `requireAccess`, dziedziczenie nadań
i cache per żądanie (rozdz. 8.9).
