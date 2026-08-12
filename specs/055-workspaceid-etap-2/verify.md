# Weryfikacja: `workspaceId` utrzymywany dla nowych rekordów — etap 2 z czterech

Spec: `spec.md` · Plan: `plan.md` · Zadania: `tasks.md` · Data: 2026-08-12

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:migrations` | ✅ następny wolny numer 0229; brak kolizji |
| `check:actions` | ✅ **160** akcji |
| `check:ai-coverage` | ✅ **551** akcji sklasyfikowanych |
| `check:cost-badge` | ✅ **35** plików |
| `check:content-memory` | ✅ **35** plików |
| `check:ui-contract` | ✅ 21/21 modułów |
| `check:schema-drift` | ✅ **zielony bez nowych wyjątków** — wyzwalacze są niewidoczne dla `prisma migrate diff`, więc mechanizm nie kosztował ani jednego wpisu w `schema-drift-allowed.json` |
| `check:boundaries` | ✅ 4 przypadki próbne |
| `check:module-registry` | ✅ 21 modułów, dziewięć kontroli |
| `check:workspace-mirror` | ✅ 3 pliki mutujące zespół |
| **`check:workspace-fill`** | ✅ **45 tabel z `workspaceId`, każda z wyzwalaczem** (nowa bramka) |
| `check:test-types` | ✅ exit 0 |
| `tsc --noEmit` (cała aplikacja) | ✅ exit 0 — uruchomione **przed** buildem (lekcja z 054) |
| `test:unit` | ✅ **689/689** (było 683 — sześć nowych asercji z T-4) |
| `next lint --dir src` | ✅ zero błędów |
| `npm run build` | ✅ **exit 0**, cały łańcuch z `migrate.js` przeciw lokalnemu Postgresowi (C-13) |

Liczniki **160 / 551 / 35 / 35** — bez spadku względem 054.

## 2. Kryteria akceptacji

**AC-1 — właściciel osobisty dostaje swoją przestrzeń, bez udziału autora akcji.** ✅
Przypadek 1 testu `workspaceFill.integration.test.ts`: `prisma.note.create({ ownerId })` zwraca
rekord z `workspaceId` równym przestrzeni osobistej użytkownika. **Żadna Server Action nie została
zmieniona** — `git diff` wobec produkcji nie dotyka `src/actions/`, więc „bez udziału autora akcji"
jest sprawdzone nie deklaracją, tylko brakiem zmian.

**AC-2 — zespół.** ✅ Przypadek 2: rekord z `ownerTeamId` dostaje przestrzeń zespołu.

**AC-3 — pierwszeństwo osobistej, reguła w jednym miejscu.** ✅
Przypadek 3: rekord z **obiema** kolumnami dostaje przestrzeń **osobistą**. Reguła stoi w jednej
funkcji `omnia_fill_workspace()` — nie jest powtórzona 45 razy — i jest tą samą, którą stosuje
backfill 0227 oraz `resolveRole` (`platform/sharing/access.ts:78–82`). Trzy mechanizmy, jedna
odpowiedź na pytanie „czyj to zasób".

**AC-4 — brak przestrzeni nie blokuje zapisu.** ✅
Przypadek 4: użytkownik bez przestrzeni; `create` **nie rzuca**, rekord powstaje z `workspaceId
= NULL`. To najważniejszy przypadek całego etapu — mechanizm siedzi na ścieżce zapisu każdego
modułu, więc błąd w nim objawiłby się nie brakującym polem, tylko **odrzuconym zapisem
użytkownika**.

**AC-5 — bramka wykrywa pominięcie.** ✅ **z kontrolą negatywną w dwóch wariantach:**

| Zaburzenie | Reakcja bramki |
|-----------|----------------|
| usunięcie `'Note'` z listy w migracji | ✖ „Tabela »Note« ma kolumnę `workspaceId`, a nie ma wyzwalacza" |
| literówka `'Habit'` → `'Habitt'` | ✖ **oba** błędy naraz: brak wyzwalacza dla `Habit` **i** wyzwalacz na nieistniejącej `Habitt` |

Drugi wariant jest powodem, dla którego bramka sprawdza w **obie** strony: sama kontrola „czy każdy
model ma wyzwalacz" pokazałaby literówkę jako jeden niejasny brak, bez wskazania przyczyny.
Manifest wyjątków (`fill-coverage.json`) jest **pusty** i taki ma zostać; martwy wpis też wywala
bramkę.

**AC-6 — zero odczytów, zero zmian dla użytkownika.** ✅
`git diff` wobec `origin/master`: **0 plików** w `src/app/`, `src/components/`, `src/actions/`,
`src/modules/`. Odczytów kolumny nadal nie ma — `grep` poza `platform/workspaces`/`platform/sharing`
i plikami generowanymi zwraca trzy trafienia, wszystkie to **komentarze** (`TagChip.tsx:10,13`,
`tasks/sharing.ts:53`) albo test.

**AC-7 — bramki i build.** ✅ Tabela wyżej.

**AC-8 — dziennik.** ✅ Wpis „055 — `workspaceId` utrzymywany dla nowych rekordów" w rozdz. 15,
z tabelą zakresu etapów 3 i 4 oraz warunkiem wejścia każdego z nich.

## 3. Zgodność z konstytucją

C-01 ✅ · C-10 ✅ ręczna migracja · C-11 ✅ numer z `next:migration` · C-12 ✅ brak enumów ·
C-13 ✅ tylko lokalny Postgres · **C-14 ✅** idempotencja sprawdzona wprost: powtórne zastosowanie
migracji zostawia 45 wyzwalaczy, nie 90 · C-15 ✅ migracja pisana ręcznie, nie z `migrate diff` ·
C-20/C-21 ✅ akcje i guardy nietykane · C-22..C-25 ✅ nie dotyczy · C-30..C-35 ✅ zero UI ·
C-50 ✅ · C-51 ✅ lekcja „kompilator nie widzi BRAKU pola opcjonalnego" · C-53 ✅ jeden mechanizm
zamiast 224 poprawek.

## 4. Regresje

- **Zapis w każdym module** — `test:unit` (689) obejmuje testy integracyjne tworzące rekordy
  w kilku modułach; wszystkie przechodzą, więc wyzwalacz nie zmienia zachowania zapisu.
- **Wydajność** — wyzwalacz robi jeden `SELECT` po indeksie **unikalnym** (`Workspace.personalUserId`
  / `Workspace.teamId`), w bazie, bez rundy sieciowej z Node. Przy rekordzie z już ustawioną
  przestrzenią kończy się na pierwszym `IF` i nie odpytuje wcale.
- **Migracja 0228 na produkcji** — sama zakłada wyzwalacze, nie rusza danych. Wycofanie
  (`DROP TRIGGER` + `DROP FUNCTION`) jest bezobjawowe, bo nic z kolumny nie czyta.
- **Seedy i skrypty** — objęte tak samo jak kod aplikacji; to jest zaleta wyzwalacza, nie skutek
  uboczny.

## 5. Werdykt

**GOTOWE.** Osiem z ośmiu kryteriów spełnionych, komplet bramek zielony, build exit 0.

Etap 2 zamyka lukę, która rosła sama: od tej migracji **każdy** nowy rekord dostaje przestrzeń,
niezależnie od tego, którą ścieżką zapisu powstał — również surowym SQL-em, seedem czy skryptem,
czyli tam, gdzie rozwiązanie w kodzie aplikacji by nie sięgnęło.

**Uwaga przekazywana dalej:** rekordy z `NULL` powstałe **przed** 0227 (sieroty — właściciel bez
przestrzeni) nadal istnieją i to jest w porządku. Etap 4 musi je policzyć i rozstrzygnąć; test
kompletności z 054 już je raportuje.
