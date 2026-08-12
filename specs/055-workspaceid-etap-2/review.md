# Recenzja: `workspaceId` utrzymywany dla nowych rekordów — etap 2 z czterech

Zakres: `git diff` względem produkcji (`0be82f5e`). Poza plikami generowanymi z treści diff to:
migracja `0228`, bramka `check-workspace-fill.js`, manifest, test zachowania, `package.json`,
`CLAUDE.md`, dziennik, `doświadczenia.md` i artefakty `specs/055-*`. **Zero plików aplikacji.**

## Ustalenia

### 1. Bramka nie zauważyłaby ZDJĘCIA wyzwalacza w późniejszej migracji
*`scripts/check-workspace-fill.js`* · **correctness** · **naprawione w recenzji**

Pierwsza wersja zliczała `CREATE TRIGGER` z całego katalogu migracji i nigdy nic z tego zbioru nie
usuwała. Wyzwalacz założony w 0228 liczył się więc jako obecny **na zawsze**.

*Scenariusz:* ktoś w migracji 0250 zdejmuje wyzwalacz z jednej tabeli (porządki, konflikt z inną
zmianą, pomyłka). Bramka nadal świeci na zielono, bo widzi `CREATE` z 0228. Tabela od tego momentu
zbiera `NULL`-e, a mechanizm, którego bramka miała pilnować, w tym jednym miejscu **nie działa** —
i bramka jest najcichsza dokładnie wtedy, gdy jest najbardziej potrzebna. To jest ten sam kształt,
co defekt `check-schema-drift` z 051.

*Poprawka:* migracje czytane **w kolejności numerów** (`sort()` — bez tego kolejność zależy od
systemu plików), a literalny `DROP TRIGGER … ON "tabela"` **usuwa** tabelę ze zbioru. `DROP TRIGGER
IF EXISTS` z samego 0228 idzie przez `format(%I)` i nie ma tam nazwy w cudzysłowie, więc wzorzec go
nie łapie — co jest zamierzone, bo tamten `DROP` służy wyłącznie idempotencji.
Kontrola negatywna: podrzucona migracja z `DROP TRIGGER "trg_Note_workspace" ON "Note"` → bramka
czerwona; po usunięciu → zielona.

### 2. Funkcja wyzwalacza bez ustalonego `search_path`
*`prisma/migrations/0228_.../migration.sql`* · **security (hardening)** · **naprawione w recenzji**

Funkcja odwoływała się do niekwalifikowanego `"Workspace"`, więc nazwa rozwiązywała się według
`search_path` **wołającego**.

*Scenariusz:* połączenie z innym `search_path` (narzędzie stawiające tabele w osobnym schemacie,
baza cienia z inną konfiguracją) trafia na inną tabelę `Workspace` i przypisuje rekordom cudze
identyfikatory przestrzeni — cicho, bo nikt tej kolumny jeszcze nie czyta. **Nie jest to
podniesienie uprawnień** (funkcja jest `SECURITY INVOKER`, nie `DEFINER`), tylko trudna do
wyśledzenia zła odpowiedź.

*Poprawka:* `SET search_path = public, pg_temp` na funkcji — zalecenie dokumentacji PostgreSQL dla
funkcji wyzwalaczy. Zweryfikowane w bazie: `pg_proc.proconfig` = `{"search_path=public, pg_temp"}`.

### 3. Dowód obejmował tylko `create`, a repo używa też `createMany`
*`src/platform/workspaces/__tests__/workspaceFill.integration.test.ts`* · **test-coverage** ·
**naprawione w recenzji**

Wyzwalacz jest `FOR EACH ROW`, więc *powinien* objąć każdy wiersz wsadu — ale „powinien" to
przewidywanie, a nie sprawdzenie, a `createMany` w Prismie idzie jednym wielowierszowym `INSERT`-em
(inna ścieżka niż `create`). Dołożony szósty przypadek: trzy notatki jednym `createMany`, każda
z przestrzenią właściciela. Przechodzi.

### 4. Świadomy koszt: wsadowy zapis to N zapytań
*`prisma/migrations/0228_.../migration.sql`* · **wydajność** · **bez zmian, odnotowane**

`createMany` na 1000 wierszy wykona 1000 `SELECT`-ów po indeksie unikalnym. Wewnątrz bazy, bez rundy
sieciowej, więc na skali Omnii jest to nieistotne — ale gdyby kiedyś pojawił się import kilkuset
tysięcy rekordów, właściwą odpowiedzią jest podanie `workspaceId` **wprost** (wyzwalacz go nie
nadpisuje — sprawdzone przypadkiem 6), a nie zdejmowanie wyzwalacza.

## Rzeczy sprawdzone, w których NIE ma ustalenia

- **`BEFORE INSERT` a wynik `create`.** Prisma robi `INSERT … RETURNING`, więc modyfikacja z
  wyzwalacza wraca do aplikacji w tym samym wywołaniu — potwierdzone testem, który czyta
  `workspaceId` **z wyniku** `create`, a nie z osobnego odczytu.
- **Idempotencja (C-14).** Migracja zastosowana trzykrotnie: `pg_trigger` konsekwentnie 45 wierszy,
  nie 90 i nie 135. `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` robią swoje.
- **`check:schema-drift`.** Zielony **bez nowych wyjątków** — `prisma migrate diff` nie widzi
  wyzwalaczy, więc mechanizm nie kosztował ani jednego wpisu w `schema-drift-allowed.json`.
  Sprawdzone po każdej zmianie migracji, bo to była pierwsza rzecz, która mogła się zepsuć.
- **Edycja zastosowanej migracji.** Nagłówek i `search_path` poprawiłem po tym, jak 0228 weszła na
  **lokalną** bazę. `prisma migrate deploy` nie protestuje, a na produkcji migracja **nigdy nie była
  stosowana** — pojedzie od razu w wersji poprawionej. Ta sama sytuacja i to samo uzasadnienie co
  w 054; gdyby migracja była już na produkcji, poprawka musiałaby iść nową migracją.
- **C-12, C-20, C-21, C-23, C-30..C-35.** Nie dotyczy: zero enumów (kolumna to `TEXT`), zero zmian
  w Server Actions i guardach, zero `AIAction`, zero UI.
- **Pierwszeństwo własności.** Ta sama reguła w trzech miejscach — backfill 0227, wyzwalacz 0228,
  `resolveRole` — sprawdzona testem (przypadek 3), nie tylko lekturą.

## Werdykt

**APPROVE Z UWAGAMI.**

Trzy ustalenia naniesione, jedno odnotowane bez zmiany. Najważniejsze z nich jest ustalenie 1
i warto nazwać wzorzec, bo powtarza się w tej fazie trzeci raz (051 — `check-schema-drift`
pomijana przy braku uprawnień; 054 — test przepuszczający pustą tabelę; teraz — bramka licząca
skasowany wyzwalacz): **bramka też ma warunki brzegowe, w których milknie, i trzeba ich szukać tak
samo jak w kodzie.** Zielona bramka, której nie widziało się czerwonej **z właściwego powodu**, jest
zdaniem o intencji.
