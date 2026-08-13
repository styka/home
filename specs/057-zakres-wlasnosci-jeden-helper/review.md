# Recenzja: zakres własności w jednym miejscu — etap 3B krok 1

Zakres: `git diff` względem produkcji (`434d51b2`). 58 plików, z czego 52 to mechaniczne
podstawienie helpera; reszta to helper, test, bramka, manifest, dziennik i artefakty.

## Ustalenia

### 1. Sweep pominął trasy `.tsx` — złapała to bramka, nie ja
*`src/app/kitchen/page.tsx`, `src/app/shopping/page.tsx`* · **correctness** · **naprawione**

Skrypt sweepa filtrował `--include=*.ts`. Trasy Next.js mają rozszerzenie `.tsx`, więc oba miejsca
zostałyby przy ręcznym warunku — i **wypadłyby z etapu 3B**, zachowując starą regułę przy zielonym
buildzie. Bramka przeszukuje `src/**/*.{ts,tsx}` niezależnie od sweepa i zgłosiła je natychmiast.

*Wniosek do zapisania:* bramka **nie może dziedziczyć założeń narzędzia, które sprawdza** — inaczej
potwierdza tylko jego własny zasięg.

### 2. Wartownik `{ id: "" }` jako „brak gałęzi"
*cztery pliki AI (`habits`, `pets`, `flota`, `magazynowanie`)* · **simplification** · **naprawione**

`teamIds.length > 0 ? { ownerTeamId: … } : { id: "" }` działał, ale wyrażał pustą alternatywę
**predykatem, który przypadkiem do niczego nie pasuje**. Czytelnik musi się domyślić, że pusty
identyfikator nigdy nie wystąpi. Zastąpione helperem, który tę gałąź po prostu pomija.

### 3. `PetShare` świadomie NIE wchodzi do helpera
*`src/modules/pets/actions/pets.ts:47`* · **correctness (decyzja)** · **bez zmian, odnotowane**

Kuszące było objąć helperem cały `accessOr` Pets — ale dwie z czterech gałęzi to **udostępnienia**,
nie własność. Gdyby wpadły do `ownedWhere`, krok 058 przełączyłby je razem z własnością na
przestrzenie i **po cichu zmienił regułę udostępniania** — a to jest zadanie 12, z własną tabelą
prawdy. Zostawione jawnie, z komentarzem.

### 4. Trzy wyjątki w manifeście — sprawdzone, czy są wyjątkami naprawdę
*`src/platform/auth/ownership-scope-coverage.json`* · **bez zmian**

- **`sharingGuard.ts`** — gałąź awaryjna sierot z 056; nie jest zakresem własności, tylko jego
  dopełnieniem dla rekordów bez przestrzeni. Znika w etapie 4.
- **`skins.ts`** — reguła **szersza** o `isSystem` i `isPublic`. Użycie helpera sugerowałoby, że to
  ta sama reguła co w modułach.
- **`briefing/route.ts`** — własność **projektu** zagnieżdżona w relacji zadania
  (`{ project: { ownerTeamId } }`), a nie własność czytanego rekordu.

Żaden z nich nie jest „nie chciało mi się" — każdy opisuje inną regułę niż ta, którą helper wyraża.

## Rzeczy sprawdzone, w których nie ma ustalenia

- **Zmiana jest strukturalnie pusta.** Helper zwraca ten sam obiekt; jedyne miejsca, gdzie kształt
  faktycznie się zmienia, to zwinięcie pustej gałęzi zespołowej — sprawdzone testem.
- **Import dołożony 19 plikom.** Pierwsza wersja skryptu importów gubiła użycia poprzedzone
  spreadem (`...ownedOr(`), bo lookbehind `(?<![\w.])` odrzucał kropkę. Wyszło od razu na `tsc`.
- **C-36.** Helper mieszka w `platform/auth` i przyjmuje `userId`/`teamIds` **parametrami** —
  nie sięga po sesję ani po katalog modułów.

## Werdykt

**APPROVE Z UWAGAMI.** Zmiana mechaniczna, zachowanie nietknięte, a to, co miało być trudne w 3B —
znalezienie wszystkich wystąpień — zostało zrobione raz i zabezpieczone bramką. 058 przełącza jeden
plik.
