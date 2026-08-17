-- Zadanie 11, ETAP 4 — KROK ZEROWY: KOPIA ZAPASOWA WŁASNOŚCI (rozdz. 8.10).
--
-- Etap 4 usuwa `ownerId`/`ownerTeamId` z 45 tabel. To jedyny krok całej przebudowy, którego
-- **nie da się cofnąć samym `git revert`**: kod wraca, dane nie. Ta migracja tworzy punkt
-- przywrócenia ZANIM cokolwiek zniknie — i robi to WEWNĄTRZ bazy, więc odtworzenie nie zależy
-- od tego, czy ktoś pamiętał o zrzucie na dysk.
--
-- CO ROBI: dla każdej tabeli mającej `ownerId` albo `ownerTeamId` zapisuje do jednej tabeli
-- archiwalnej czwórkę (tabela, klucz główny wiersza, właściciel, zespół). Nic nie usuwa,
-- nic nie zmienia — po jej zastosowaniu aplikacja działa dokładnie tak samo.
--
-- DLACZEGO KLUCZ GŁÓWNY, A NIE `id`: pierwsza wersja tej migracji zakładała, że każda tabela ma
-- kolumnę `id`. `NewsPref` jej nie ma — jej kluczem głównym JEST `ownerId`. Migracja padła
-- (`42703: column "id" does not exist`). Kopia, która pomija choćby jedną tabelę, jest gorsza niż
-- brak kopii, bo daje fałszywe poczucie zabezpieczenia — więc identyfikator wiersza czytamy
-- z `pg_index`, a nie z założenia. Nazwy kolumn klucza lądują w `klucz`, żeby procedura
-- odtworzenia nie musiała ich zgadywać (kopia opisuje samą siebie).
--
-- CZEGO NIE ROBI, świadomie: nie ustawia `workspaceId NOT NULL` i nie kasuje kolumn.
-- Pomiar wykonany przed napisaniem tej migracji pokazał, dlaczego tego jeszcze nie wolno:
--
--   * 45 tabel ma komplet `workspaceId`, ale **79 wierszy go nie ma** — w trzech tabelach:
--     ItemHistory (69), Skin (9), ShoppingList (1);
--   * **wszystkie 79 to rekordy SYSTEMOWE** (`ownerId IS NULL`), czyli te, które wg CLAUDE.md
--     są wspólne dla wszystkich kont i edytowalne tylko przez administratora. Zero sierot
--     z właścicielem — backfill z 0227 zadziałał bezbłędnie.
--
-- Wniosek, który zmienia kształt etapu 4: **rekord systemowy z definicji nie należy do żadnej
-- przestrzeni**, więc `workspaceId NOT NULL` na tabelach słownikowych jest regułą błędną, a nie
-- brakującym backfillem. Wymaga decyzji właściciela (przestrzeń systemowa vs. kolumna nadal
-- nullowalna dla słowników) — i dlatego etap 4 zatrzymuje się tutaj, na przygotowanym odwrocie.
--
-- ODTWORZENIE: patrz `docs/devops/przywrocenie-wlasnosci.md`.

CREATE TABLE IF NOT EXISTS "_KopiaWlasnosci" (
    "tabela"      TEXT        NOT NULL,
    "klucz"       TEXT        NOT NULL,
    "wiersz"      TEXT        NOT NULL,
    "ownerId"     TEXT,
    "ownerTeamId" TEXT,
    "zapisano"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "_KopiaWlasnosci_pkey" PRIMARY KEY ("tabela", "wiersz")
);

COMMENT ON TABLE "_KopiaWlasnosci" IS
  'Punkt przywrócenia własności sprzed etapu 4 zadania 11. Bez kluczy obcych celowo: ma przetrwać usunięcie kolumn, do których się odnosi.';
COMMENT ON COLUMN "_KopiaWlasnosci"."klucz" IS
  'Nazwy kolumn klucza głównego tabeli źródłowej, po przecinku — w tej samej kolejności, w jakiej wartości złączono w "wiersz" znakiem |.';

-- Wypełnienie: jedna wstawka na tabelę, budowana dynamicznie, bo ani kolumny właścicielskie, ani
-- klucz główny nie są wszędzie te same (część tabel ma tylko `ownerId`, np. ItemHistory; NewsPref
-- nie ma `id`). `ON CONFLICT DO NOTHING` czyni całość idempotentną — ponowne zastosowanie niczego
-- nie duplikuje ani nie nadpisuje.
DO $kopia$
DECLARE
  r          record;
  ma_owner   boolean;
  ma_team    boolean;
  kol_o      text;
  kol_t      text;
  pk_nazwy   text;
  pk_wartosc text;
  ile        bigint;
  suma       bigint := 0;
  tabel      int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('ownerId', 'ownerTeamId')
      AND c.table_name <> '_KopiaWlasnosci'
    ORDER BY c.table_name
  LOOP
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=r.table_name AND column_name='ownerId')
      INTO ma_owner;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=r.table_name AND column_name='ownerTeamId')
      INTO ma_team;

    kol_o := CASE WHEN ma_owner THEN '"ownerId"'     ELSE 'NULL::text' END;
    kol_t := CASE WHEN ma_team  THEN '"ownerTeamId"' ELSE 'NULL::text' END;

    -- Identyfikator wiersza = klucz główny tabeli, odczytany z katalogu systemowego.
    SELECT string_agg(a.attname,                    ','  ORDER BY k.ord),
           string_agg(format('%I::text', a.attname), ', ' ORDER BY k.ord)
      INTO pk_nazwy, pk_wartosc
      FROM pg_index i
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
     WHERE i.indrelid = format('public.%I', r.table_name)::regclass
       AND i.indisprimary;

    -- Tabela bez klucza głównego jest nieodtwarzalna wierszami. Lepiej zerwać migrację niż
    -- zapisać kopię z dziurą, o której nikt się nie dowie aż do próby przywrócenia.
    IF pk_nazwy IS NULL THEN
      RAISE EXCEPTION 'Tabela % ma kolumny własnościowe, ale nie ma klucza głównego — kopii nie da się odtworzyć.', r.table_name;
    END IF;

    EXECUTE format(
      'INSERT INTO "_KopiaWlasnosci" ("tabela","klucz","wiersz","ownerId","ownerTeamId")
       SELECT %L, %L, concat_ws(''|'', %s), %s, %s FROM %I
       ON CONFLICT ("tabela","wiersz") DO NOTHING',
      r.table_name, pk_nazwy, pk_wartosc, kol_o, kol_t, r.table_name
    );
    GET DIAGNOSTICS ile = ROW_COUNT;
    tabel := tabel + 1;
    suma  := suma + ile;
  END LOOP;

  RAISE NOTICE 'Kopia własności: % tabel, % wierszy zarchiwizowanych.', tabel, suma;
END
$kopia$;
