# Plan techniczny: `workspaceId` — etap 1 z czterech

Spec: `specs/054-workspaceid-etap-1/spec.md` · Gałąź: `claude/omnia-architecture-skins-qlv2ew`

## 1. Sedno decyzji

Rozdz. 8.10 podaje kolejność i zakazuje jej skracania: **(a) kolumna nullable → (b) backfill →
(c) przełączenie odczytów → (d) `NOT NULL`**. Ten przebieg to **(a) + (b)**. Wszystko, co poniżej,
służy jednemu: żeby po tej migracji aplikacja zachowywała się **identycznie**, a kolumna była
gotowa, kompletna i sprawdzona, zanim ktokolwiek zacznie z niej czytać.

Cztery decyzje, które ustawiają resztę:

1. **Zbiór modeli wyznacza własność, nie intuicja.** Kolumnę dostaje model, który ma `ownerId`
   **lub** `ownerTeamId`. Wyszło 45. Model bez żadnej z tych kolumn nie ma z czego wypełnić
   przestrzeni — tak z zestawu wypadł `Task`, którego własność idzie przez `createdById`/`assigneeId`
   i pochodną od projektu.
2. **`Team` jest poza zbiorem — świadomie.** Zespół jest **źródłem** przestrzeni
   (`Workspace.teamId`), nie zasobem, który w jakiejś przestrzeni żyje. Nadanie mu `workspaceId`
   zamknęłoby pojęciową pętlę „zespół należy do przestrzeni, która należy do zespołu".
3. **Backfill w tej samej migracji co kolumna.** Rozdzielenie ich na dwie migracje otwiera okno,
   w którym kolumna istnieje pusta — a to jest dokładnie stan, którego etap 3 nie może zastać.
4. **Etap 2 osobno.** Utrzymywanie kolumny dla **nowych** rekordów dotyka każdej ścieżki zapisu
   w aplikacji; wypełnienie istniejących jest jednorazowe i odwracalne przez `DROP COLUMN`.
   To dwa różne poziomy ryzyka i nie jadą razem (decyzja właściciela, spec §8).

## 2. Model danych i migracja (C-10, C-11, C-12, C-14)

**`prisma/schema.prisma`** — na każdym z 45 modeli:

```prisma
  workspaceId  String?
  @@index([workspaceId])
```

Bez relacji do `Workspace`. Relacja Prismy wymusiłaby `onDelete`, a odpowiedź na „co się dzieje
z zasobem, gdy znika przestrzeń" należy do etapu 4, nie do tego. Indeks jest po to, żeby etap 3
(`WHERE workspaceId IN (…)`) nie wszedł w skan sekwencyjny na tabelach z historią.

**`prisma/migrations/0227_workspaceid_etap1/migration.sql`** (numer z `npm run next:migration`):

- 45 × `ALTER TABLE "X" ADD COLUMN "workspaceId" TEXT;` — generowane przez `prisma migrate diff`;
- 45 × `CREATE INDEX "X_workspaceId_idx" …`;
- 73 × `UPDATE` backfillu: po jednym na `ownerId` (45) i po jednym na `ownerTeamId` (28).

Wzorzec pojedynczego `UPDATE` — warunek `workspaceId IS NULL` jest tym, co czyni go **idempotentnym**
(C-14) i bezpiecznym przy powtórzonym wdrożeniu:

```sql
UPDATE "X" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";
```

**Dwie pułapki, które ta migracja musi ominąć:**

- **`@@map`.** Ręcznie pisany SQL musi używać nazw **tabel**, nie modeli. `ProjectGroup` jest
  zmapowany na `TaskView` — backfill pisany po nazwach modeli pada z `relation "ProjectGroup"
  does not exist`. Instrukcje `ADD COLUMN` tego problemu nie mają, bo generuje je Prisma.
- **C-15.** Wyjście `prisma migrate diff` idzie **do przeczytania**, nie do doklejenia. Tu
  dopisało `DROP INDEX` na dwóch indeksach trigramowych notatek i trzy `ALTER COLUMN … DROP
  DEFAULT` — w 051 dokładnie te instrukcje skasowały wyszukiwanie notatek. Filtr:
  `grep -E "^(DROP|ALTER TABLE .* DROP)"` przed commitem, a nagłówek migracji **nazywa** usunięte
  instrukcje, żeby następny czytelnik nie uznał ich braku za przeoczenie.

## 3. Server Actions, RBAC, UI, AI

**Bez zmian — i to jest kryterium akceptacji, nie brak zakresu.** Kolumna nie ma ani jednego
czytelnika: dostęp liczy się dalej przez `requireAccess` (052) na `ownerId`/`ownerTeamId`. Żadnej
akcji, żadnego `revalidatePath`, żadnego uprawnienia, żadnego `AIAction`, zero UI.

## 4. Weryfikacja

**Test kompletności** — `src/platform/workspaces/__tests__/workspaceBackfill.integration.test.ts`,
wzorowany na teście lustra z 051 (skip bez `DATABASE_URL`, własny odczyt przez Prismę):

- **lista tabel wyprowadzana ze `schema.prisma`**, nie wpisana ręcznie. Ręczna lista sprawdza to,
  o czym pamiętałem w dniu pisania testu, a pytanie brzmi odwrotnie: czy backfill objął
  **wszystkie**. Parser czyta `@@map`, więc pyta o `TaskView`, nie o `ProjectGroup`;
- **porównanie dwóch źródeł prawdy**: zbiór modeli z `workspaceId` w schemacie = zbiór tabel
  z `ADD COLUMN` w 0227. Rozjazdu w tę stronę `check:schema-drift` nie złapie;
- **luka vs sierota.** Rekord z właścicielem, który **ma** przestrzeń, a pustym `workspaceId` =
  awaria. Rekord, którego właściciel przestrzeni **nie ma** (konto usunięte) = liczba do raportu,
  bo etap 4 musi znać jej skalę.

**Kontrola negatywna:** ręcznie wyzerować `workspaceId` na jednym rekordzie i sprawdzić, że test
świeci na czerwono. Test, którego nie widziało się czerwonego, jest zdaniem o intencji.

**Bramki (C-50):** `check:migrations`, `check:schema-drift` (to jest ta krytyczna — porównuje
schemat z katalogiem migracji), pełny komplet pozostałych, `test:unit`, `next lint`, `next build`
przeciw **lokalnemu** Postgresowi (C-13).

## 5. Pliki

| Plik | Zmiana |
|------|--------|
| `prisma/schema.prisma` | `workspaceId String?` + `@@index` na 45 modelach; `Team` wykluczony z komentarzem `///` |
| `prisma/migrations/0227_workspaceid_etap1/migration.sql` | nowy — 45 kolumn, 45 indeksów, 73 `UPDATE` |
| `src/platform/workspaces/__tests__/workspaceBackfill.integration.test.ts` | nowy — test kompletności |
| `worldofmag/content/architektura/15-dziennik.md` | wpis: etap 1 + jawna lista pozostałych trzech |
| `doświadczenia.md` | lekcja o `@@map` w ręcznym SQL-u (C-51) |

## 6. Ryzyka i wycofanie

| Ryzyko | Odpowiedź |
|--------|-----------|
| Migracja dotyka 45 tabel | Wyłącznie `ADD COLUMN` + `UPDATE` **nowej** kolumny — żaden istniejący wiersz nie traci danych |
| `migrate diff` dopisze niezamówione DDL | C-15: całość czytana, `DROP`/`ALTER` odfiltrowane, usunięcia opisane w nagłówku |
| Rekord bez przestrzeni właściciela | Zostaje `NULL`; test **liczy** te przypadki zamiast je przemilczeć |
| Ktoś uzna kolumnę za gotową do czytania | Nagłówek migracji i wpis w dzienniku mówią wprost: etapy 2–4 przed nią |

**Wycofanie:** `ALTER TABLE … DROP COLUMN "workspaceId"` na objętych tabelach. Bezpieczne, bo nic
z tej kolumny nie czyta.

## 7. Checklista konstytucji

C-01 praca w `worldofmag/` ✓ · C-10 ręczna migracja ✓ · C-11 numer z `next:migration` ✓ ·
C-12 brak enumów (kolumna to `TEXT`) ✓ · C-13 tylko lokalny Postgres ✓ · C-14 idempotencja ✓ ·
C-15 DDL czytany, nie doklejany ✓ · C-21 własność **dokładana obok**, nie zastępowana ✓ ·
C-50 komplet bramek ✓ · C-51 wpis do `doświadczenia.md` ✓ · C-53 minimalizm — zero zmian
w kodzie aplikacji ✓
