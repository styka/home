# Przywrócenie własności (`ownerId` / `ownerTeamId`) po etapie 4

**Po co ten dokument.** Etap 4 zadania 11 (rozdz. 8.10 „architektury docelowej") usuwa z bazy kolumny
`ownerId` i `ownerTeamId` — 46 tabel. To jedyny krok całej przebudowy, którego **nie cofa `git
revert`**: kod wraca w sekundę, dane nie wracają wcale. Migracja `0233_kopia_wlasnosci_przed_etapem4`
tworzy punkt przywrócenia **zanim** cokolwiek zniknie. Ten plik opisuje, jak z niego skorzystać.

Trzy rzeczy, które warto wiedzieć, zanim zaczniesz czytać dalej:

1. Kopia leży **w tej samej bazie**, w tabeli `_KopiaWlasnosci`. Nie zależy od tego, czy ktoś
   pamiętał o zrzucie na dysk — a to jest najczęstszy powód, dla którego backup nie istnieje
   dokładnie wtedy, gdy jest potrzebny.
2. Kopia **nie ma kluczy obcych** i **nie ma modelu w `schema.prisma`**. Jedno i drugie celowo:
   ma przetrwać usunięcie kolumn, do których się odnosi, i nie może jej ruszyć żadna akcja
   aplikacji ani job (nie ma jej w Prisma Client).
3. Ten dokument **nie zastępuje** PITR w Neonie (`runbook-deploy-rollback.md`). PITR cofa *całą*
   bazę do punktu w czasie — razem z danymi, które w międzyczasie wpisali użytkownicy. Kopia
   własności pozwala odtworzyć **tylko własność**, bez cofania reszty. Zwykle chcesz tego drugiego.

---

## Co dokładnie jest w kopii

| Kolumna | Znaczenie |
|---|---|
| `tabela` | nazwa tabeli źródłowej, np. `ShoppingList` |
| `klucz` | nazwy kolumn klucza głównego tej tabeli, po przecinku (np. `id`, dla `NewsPref` → `ownerId`) |
| `wiersz` | wartości klucza głównego złączone znakiem `\|`, w kolejności z `klucz` |
| `ownerId` | właściciel-osoba w chwili wykonania kopii (`NULL` = rekord systemowy) |
| `ownerTeamId` | właściciel-zespół w chwili wykonania kopii |
| `zapisano` | znacznik czasu wykonania kopii |

Identyfikator wiersza czytany jest z klucza głównego (`pg_index`), **nie** z założenia, że każda
tabela ma `id`. Pierwsza wersja migracji to założenie przyjęła i padła na `NewsPref`, którego
kluczem głównym jest samo `ownerId`. Dlatego kopia opisuje samą siebie kolumną `klucz` — procedura
odtworzenia nie musi niczego zgadywać.

### Sprawdzenie, czy kopia jest kompletna

Odpal **przed** etapem 4 i zapisz wynik. Skrypt porównuje liczbę wierszy w każdej tabeli
z kolumnami własnościowymi z liczbą wierszy w kopii:

```sql
DO $w$
DECLARE r record; ile bigint; kopia bigint; zle int := 0; wszystkie int := 0;
BEGIN
  FOR r IN SELECT DISTINCT c.table_name
             FROM information_schema.columns c
             JOIN information_schema.tables t
               ON t.table_schema = c.table_schema AND t.table_name = c.table_name
              AND t.table_type = 'BASE TABLE'
            WHERE c.table_schema = 'public'
              AND c.column_name IN ('ownerId','ownerTeamId')
              AND c.table_name <> '_KopiaWlasnosci'
            ORDER BY 1
  LOOP
    wszystkie := wszystkie + 1;
    EXECUTE format('SELECT count(*) FROM %I', r.table_name) INTO ile;
    SELECT count(*) INTO kopia FROM "_KopiaWlasnosci" WHERE tabela = r.table_name;
    IF ile <> kopia THEN
      zle := zle + 1;
      RAISE WARNING 'NIEZGODNOŚĆ %: tabela=% kopia=%', r.table_name, ile, kopia;
    END IF;
  END LOOP;
  RAISE NOTICE 'Sprawdzono % tabel, niezgodności: %', wszystkie, zle;
END $w$;
```

Oczekiwane: `niezgodności: 0`. Cokolwiek innego — **nie wchodź w etap 4**, dopóki nie wiadomo,
skąd różnica. Kopia z jedną dziurą jest gorsza niż brak kopii, bo daje fałszywe poczucie
zabezpieczenia.

> Uwaga na moment wykonania: kopia jest migawką ze **stanu na chwilę migracji 0233**. Jeżeli między
> 0233 a właściwym `DROP COLUMN` upłynie czas, w którym użytkownicy tworzą nowe rekordy, tamte
> rekordy w kopii nie będą miały wpisu. Dlatego 0233 i `DROP COLUMN` mają lecieć **w jednym
> wdrożeniu**, a jeśli nie mogą — kopię trzeba odświeżyć tuż przed (patrz „Odświeżenie kopii").

---

## Odtworzenie kolumn i danych

Trzy kroki. Wszystkie surowym SQL-em — Prisma nie zna tabeli kopii.

### Krok 1 — przywróć kolumny

Migracja odwracająca etap 4 (`ALTER TABLE … ADD COLUMN`) musi być **osobnym plikiem migracji**
(C-10), a nie ręczną komendą na produkcji. Kolumny wracają jako **nullowalne**, nawet jeśli przed
usunięciem miały `NOT NULL` — inaczej `ADD COLUMN` wywróci się na istniejących wierszach.

```sql
ALTER TABLE "ShoppingList" ADD COLUMN IF NOT EXISTS "ownerId"     TEXT;
ALTER TABLE "ShoppingList" ADD COLUMN IF NOT EXISTS "ownerTeamId" TEXT;
-- … pozostałe tabele; zestaw kolumn per tabela odczytasz z kopii:
--   SELECT tabela, count("ownerId") > 0 AS ma_owner, count("ownerTeamId") > 0 AS ma_team
--     FROM "_KopiaWlasnosci" GROUP BY 1;
-- UWAGA: powyższe rozpozna kolumnę tylko wtedy, gdy miała choć jedną wartość niepustą.
-- Pewne źródło to poprzedni `schema.prisma` sprzed etapu 4 (git), nie kopia.
```

Klucze obce i indeksy odtwórz **po** kroku 2 — dopóki dane nie wrócą, `REFERENCES` przejdzie tylko
przypadkiem.

### Krok 2 — wlej dane z kopii

```sql
DO $p$
DECLARE r record; ma_owner boolean; ma_team boolean; zestaw text; ile bigint; suma bigint := 0;
BEGIN
  FOR r IN SELECT DISTINCT tabela, klucz FROM "_KopiaWlasnosci" ORDER BY 1
  LOOP
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=r.tabela AND column_name='ownerId'),
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=r.tabela AND column_name='ownerTeamId')
      INTO ma_owner, ma_team;

    IF NOT ma_owner AND NOT ma_team THEN
      RAISE WARNING 'Pomijam % — kolumny własnościowe jeszcze nie istnieją (wykonaj krok 1).', r.tabela;
      CONTINUE;
    END IF;

    zestaw := concat_ws(', ',
      CASE WHEN ma_owner THEN '"ownerId" = k."ownerId"'         END,
      CASE WHEN ma_team  THEN '"ownerTeamId" = k."ownerTeamId"' END);

    -- Dopasowanie po kluczu głównym, złożonym tak samo jak przy zapisie kopii.
    EXECUTE format(
      'UPDATE %I t SET %s
         FROM "_KopiaWlasnosci" k
        WHERE k.tabela = %L
          AND k.wiersz = concat_ws(''|'', %s)',
      r.tabela, zestaw, r.tabela,
      (SELECT string_agg(format('t.%I::text', trim(kol)), ', ')
         FROM unnest(string_to_array(r.klucz, ',')) AS kol)
    );
    GET DIAGNOSTICS ile = ROW_COUNT;
    suma := suma + ile;
    RAISE NOTICE '% — przywrócono % wierszy', r.tabela, ile;
  END LOOP;
  RAISE NOTICE 'Razem przywrócono % wierszy.', suma;
END $p$;
```

Blok jest **idempotentny** — to zwykły `UPDATE` z kopii, więc powtórzenie wpisuje te same wartości.

### Krok 3 — sprawdź, zanim uznasz za zrobione

```sql
-- Ile wierszy w bazie NIE zgadza się z kopią (powinno być 0 dla każdej tabeli):
SELECT k.tabela, count(*) AS rozbieznych
  FROM "_KopiaWlasnosci" k
  -- wykonaj per tabela; przykład dla ShoppingList:
 WHERE k.tabela = 'ShoppingList'
   AND NOT EXISTS (
     SELECT 1 FROM "ShoppingList" t
      WHERE t."id" = k.wiersz
        AND t."ownerId"     IS NOT DISTINCT FROM k."ownerId"
        AND t."ownerTeamId" IS NOT DISTINCT FROM k."ownerTeamId")
 GROUP BY 1;
```

`IS NOT DISTINCT FROM`, nie `=` — porównanie musi traktować `NULL = NULL` jako zgodność, inaczej
każdy rekord systemowy wyjdzie jako rozbieżność.

### Czy ta procedura naprawdę działa — wynik próby

Nie „powinna działać". Przećwiczona na lokalnej bazie w transakcji zakończonej `ROLLBACK`:
`DROP COLUMN` na `Pet`, `ShoppingList` i `HealthEvent` → krok 1 → krok 2 → porównanie z migawką
sprzed usunięcia. Wynik: **85 wierszy przywróconych, 0 rozbieżności**.

Sam zielony wynik jeszcze niczego nie dowodzi, więc ta sama próba poszła drugi raz **z pominiętym
krokiem 2**: zgłosiła dokładnie 2 rozbieżności — tyle, ile w tych tabelach było wierszy z
niepustym właścicielem. Porównanie realnie patrzy na dane.

Stąd jedno ostrzeżenie do kroku 3: dla tabel, w których wszystkie wiersze są **systemowe**
(`ownerId IS NULL`), porównanie przejdzie na zielono nawet wtedy, gdy odtworzenie w ogóle się nie
wykonało — bo „przywrócony NULL" i „nigdy nie tknięty NULL" wyglądają identycznie. Siła tego
sprawdzenia bierze się z wierszy, które mają właściciela; przy tabelach czysto słownikowych
kontroluj dodatkowo licznik `Przywrócono % wierszy` z kroku 2.

---

## Odświeżenie kopii (gdy `DROP COLUMN` leci później niż 0233)

Migracja 0233 jest idempotentna przez `ON CONFLICT DO NOTHING`, co znaczy: powtórne uruchomienie
**dopisze nowe wiersze, ale NIE nadpisze istniejących**. To świadomy wybór — kopia ma być zdjęciem
sprzed zmiany, a nie kroniką aktualizowaną w miejscu. Jeżeli naprawdę chcesz świeżej migawki:

```sql
TRUNCATE "_KopiaWlasnosci";
-- a potem ponownie blok DO $kopia$ z migracji 0233
```

Rób to **tylko** wtedy, gdy etap 4 jeszcze się nie wykonał. Po `DROP COLUMN` nie ma z czego zrobić
nowej kopii, a `TRUNCATE` skasuje jedyną, którą masz.

---

## Czego ta kopia NIE odtwarza

Świadomie i wprost, żeby nikt nie liczył na więcej, niż tu jest:

- **kluczy obcych, indeksów i ograniczeń** zdjętych razem z kolumnami — te wracają z migracji
  odwracającej, nie z danych;
- **relacji Prismy** — 71 relacji na `User`/`Team` wskazywało na te kolumny; ich odtworzenie to
  zmiana w `schema.prisma`, czyli kod, czyli `git revert`;
- **`NewsPref` — tej tabeli kopia NIE odtworzy i nie da się tego naprawić.** `ownerId` **jest** jej
  kluczem głównym; nie ma `id` ani żadnej innej kolumny identyfikującej wiersz. Po `DROP COLUMN`
  wiersz zostaje bez tożsamości: kopia zna wartość, ale nie ma po czym dopasować ją z powrotem do
  konkretnego wiersza. To nie jest niedoróbka procedury, tylko własność tej tabeli — i **osobny
  warunek wejścia w etap 4**: `NewsPref` musi najpierw dostać własny klucz główny (`id`) albo
  zostać przepisany na `workspaceId` jako klucz, zanim `ownerId` z niej zniknie. Do tego czasu
  jedynym odwrotem dla `NewsPref` jest PITR całej bazy;
- **stanu z chwili awarii** — kopia zna stan z chwili wykonania 0233, nic późniejszego.

Do cofnięcia *całej* bazy służy PITR w Neonie — procedura w `runbook-deploy-rollback.md`.
