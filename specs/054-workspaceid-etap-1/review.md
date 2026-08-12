# Recenzja: `workspaceId` — etap 1 z czterech

Zakres: `git diff` względem końca 053 (`043debdc`). Poza plikami generowanymi z treści
(`src/generated/*`) diff to: `prisma/schema.prisma`, migracja `0227`, nowy test kompletności,
dwa pliki poprawki typu, artefakty `specs/054-*`, dziennik i `doświadczenia.md`.

## Ustalenia

### 1. Kolejność instrukcji backfillu **milcząco** rozstrzygała pierwszeństwo własności
*`prisma/migrations/0227_workspaceid_etap1/migration.sql`* · **correctness (dokumentacja decyzji)**
· **naprawione w recenzji**

Konwencja mówi „użytkownik ALBO zespół", ale **nic tego nie wymusza na poziomie bazy** — obie
kolumny są nullowalne i niezależne. Rekord z obiema wypełnionymi dostawał przestrzeń **osobistą**,
i to wyłącznie dlatego, że `UPDATE` po `ownerId` stoi w pliku wyżej, a zespołowy odbija się od
warunku `workspaceId IS NULL`.

*Scenariusz:* rekord z `ownerId` **i** `ownerTeamId` (dziś takich nie ma — sprawdzone zapytaniem,
0 wierszy — ale nic ich nie zabrania) trafia do przestrzeni osobistej. Ktoś przestawia kolejność
instrukcji przy okazji porządków w etapie 2 i cicho zmienia semantykę własności.

*Poprawka:* nagłówek migracji nazywa tę regułę wprost i pokazuje, że **nie jest przypadkowa** —
`resolveRole` (`platform/sharing/access.ts:78–82`) sprawdza `ownerId` przed `ownerTeamId`, więc
backfill i kontrola dostępu odpowiadają na to samo pytanie tak samo. Gdyby ktoś odwrócił kolejność,
komentarz mówi, co się przy tym łamie.

### 2. Test sprawdzał kolumny, a nie instrukcje backfillu — pusta tabela ukrywała brak
*`src/platform/workspaces/__tests__/workspaceBackfill.integration.test.ts`* · **correctness** ·
**naprawione w recenzji**

Pierwsza wersja porównywała zbiór `ADD COLUMN` ze zbiorem modeli i liczyła rekordy w bazie.
Tabela, która dostała kolumnę i indeks, ale **nie dostała `UPDATE`-a**, przechodziła oba
sprawdzenia — bo na bazie testowej jest pusta, a puste są dziś prawie wszystkie.

*Scenariusz:* przy dokładaniu 45 tabel ręcznie gubię jeden `UPDATE`. Testy zielone, `migrate deploy`
na produkcji przechodzi, kolumna w tej jednej tabeli zostaje pusta dla **wszystkich** rekordów.
Wychodzi w etapie 4, gdy `NOT NULL` odbija całą migrację produkcyjną.

*Poprawka:* dwie kontrole **statyczne**, niezależne od zawartości bazy — każda kolumna właściciela
ma swój `UPDATE` (45 dla `ownerId`, 28 dla `ownerTeamId`) i każda tabela ma indeks. Sprawdzone
w obie strony. To jest ta sama zasada, którą wymusza reszta bramek Omnii: dowód ma nie zależeć od
tego, czy akurat są dane.

### 3. Ten sam trzyliniowy komentarz powtórzony 45 razy w schemacie
*`prisma/schema.prisma`* · **simplification** · **naprawione w recenzji**

135 linii identycznego tekstu w pliku, który i tak jest długi. Powtórzenie nie dodaje nic po
trzecim wystąpieniu, a przy etapie 4 trzeba by je poprawiać w 45 miejscach.

*Poprawka:* jeden blok nagłówkowy na górze `schema.prisma` (czym jest kolumna, cztery etapy, że
**dziś nie ma czytelnika**, i które modele są świadomie poza zbiorem) plus jednoliniowy znacznik
przy każdej kolumnie. Diff schematu zjechał z 270 do 59 dodanych linii. `prisma format` i
`check:schema-drift` po zmianie zielone — komentarze nie mają wpływu na DDL.

### 4. Poprawka typu `TagChip` — sprawdzona, nie kwestionowana
*`src/modules/notes/ui/TagChip.tsx:6`* · **convention** · **bez zmian**

Zwężenie `tag: Tag` → `tag: Pick<Tag, "name" | "color">` jest właściwym z dwóch wyjść (drugie —
dopisanie `workspaceId: null` do literału — wracałoby przy każdej kolejnej kolumnie, w tym
w etapie 4, gdy kolumna stanie się wymagana). Sprawdziłem **wszystkie osiem** miejsc używających
`TagChip` (`QuickNoteBar`, `NoteGroupSection`, `NoteRow` ×2, `NotesPage` ×2, `TagsManager` ×2):
siedem podaje prawdziwy rekord `tag`, ósme to poprawiony literał podglądu. Zwężenie typu żadnego
z nich nie dotyka — `Pick` przyjmuje pełny rekord bez zmian. Komponent czyta dokładnie dwa pola
(`tag.color` w `getTagStyle`, `tag.name` w treści chipa).

## Rzeczy sprawdzone, w których NIE ma ustalenia

- **Determinizm backfillu.** `Workspace.personalUserId` i `Workspace.teamId` są `@unique`, więc
  `UPDATE … FROM "Workspace"` nie ma jak trafić na dwa dopasowania. Gdyby nie były, wynik byłby
  niedeterministyczny i cichy.
- **Pokrycie migracji.** Skrypt porównawczy: 45 modeli, zero brakujących `UPDATE`-ów, zero
  brakujących indeksów, zero instrukcji bez modelu, w obie strony.
- **C-15.** `grep -E "^(DROP|ALTER TABLE .* DROP)"` na 0227 nie zwraca nic; indeksy trigramowe
  notatek obecne w bazie po zastosowaniu migracji (to je 051 skasowało tym mechanizmem).
- **C-12.** Kolumna to `TEXT`/`String?`, żadnego enuma.
- **C-20/C-21/C-23.** Nie dotyczy — zero Server Actions, zero `AIAction`, zero zmian w kontroli
  dostępu. Kolumna nie ma czytelnika, co potwierdza `grep` opisany w `verify.md`.
- **Edycja zastosowanej migracji.** Nagłówek 0227 poprawiłem po tym, jak migracja weszła na
  **lokalną** bazę. Sprawdzone: `prisma migrate deploy` nie protestuje („No pending migrations"),
  a na produkcji ta migracja **nigdy nie była stosowana** — pojedzie od razu w wersji poprawionej.
  Zmiana dotyczy wyłącznie komentarzy. Gdyby dotyczyła SQL-a po wdrożeniu na produkcję, byłaby
  niedopuszczalna.

## Werdykt

**APPROVE Z UWAGAMI.**

Trzy ustalenia, wszystkie naniesione w recenzji; żadne nie zmienia zachowania. Dwa pierwsze są tego
samego rodzaju i to jest właściwa uwaga do przekazania dalej: **przy migracji rozłożonej na cztery
etapy najgroźniejsze jest to, co przechodzi dziś dlatego, że danych jeszcze nie ma.** Etap 1 zamyka
się z kolumną kompletną, sprawdzoną w sposób niezależny od zawartości bazy, i bez ani jednego
czytelnika — dokładnie tak, jak wymaga rozdz. 8.10.

**Uwaga do etapu 2, przekazana świadomie:** rekord utworzony **po** tej migracji ma `workspaceId`
NULL, bo utrzymywanie kolumny w przód to osobny etap. Kolumna jest kompletna wobec danych
istniejących w chwili migracji, nie wobec przyszłych.
