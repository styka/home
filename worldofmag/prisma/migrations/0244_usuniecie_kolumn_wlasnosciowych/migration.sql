-- 079 (zadanie 11, ETAP 4 — KROK OSTATNI): USUNIĘCIE KOLUMN WŁASNOŚCIOWYCH Z 40 TABEL.
--
-- Od tej migracji własność zasobu wyraża WYŁĄCZNIE `workspaceId`. Pięć tabel zachowuje `ownerId`
-- (`src/lib/db/workspace-nullable.json`) — ich wiersz może nie mieć właściciela, a wtedy nie ma
-- też przestrzeni, więc przestrzeń nie wyrazi ani ich własności, ani ich unikalności.
--
-- TO JEST JEDYNY KROK PRZEBUDOWY, KTÓREGO NIE COFA `git revert`: kod wraca, dane nie.
-- Odwrót jest przygotowany od 0233 (`_KopiaWlasnosci`) i opisany w
-- `docs/devops/przywrocenie-wlasnosci.md`.

-- ─── 1. ODŚWIEŻENIE KOPII WŁASNOŚCI (U-5 z przeglądu 078) ──────────────────────────────────
--
-- Kopia z 0233 jest MIGAWKĄ sprzed wielu tygodni i nic nie pilnowało jej świeżości: wstawka miała
-- `ON CONFLICT DO NOTHING`, więc rekord, który od tamtej pory zmienił właściciela, ma w kopii
-- wartość NIEAKTUALNĄ, a rekord utworzony później nie ma jej wcale. Przywrócenie z takiej kopii
-- rozdałoby część danych nie tym kontom — czyli awarię gorszą niż ta, przed którą kopia broni.
--
-- Dlatego pierwszym krokiem usuwania kolumn jest **odświeżenie**: wartości aktualizujemy,
-- brakujące dopisujemy, a wiersze, których w źródle już nie ma, kasujemy (inaczej kontrola
-- liczności niżej nigdy by się nie zgodziła).
DO $odswiez$
DECLARE
  r          record;
  ma_owner   boolean;
  ma_team    boolean;
  kol_o      text;
  kol_t      text;
  pk_wartosc text;
  pk_nazwy   text;
  wstawione  bigint;
  usuniete   bigint;
  suma_w     bigint := 0;
  suma_u     bigint := 0;
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

    SELECT string_agg(a.attname,                    ','  ORDER BY k.ord),
           string_agg(format('%I::text', a.attname), ', ' ORDER BY k.ord)
      INTO pk_nazwy, pk_wartosc
      FROM pg_index i
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
     WHERE i.indrelid = format('public.%I', r.table_name)::regclass
       AND i.indisprimary;

    IF pk_nazwy IS NULL THEN
      RAISE EXCEPTION 'Tabela % ma kolumny własnościowe, ale nie ma klucza głównego — kopii nie da się odtworzyć.', r.table_name;
    END IF;

    -- Wiersze, których w źródle już nie ma. Kasujemy PRZED wstawką, żeby kontrola liczności
    -- porównywała dwa aktualne zbiory, a nie zbiór z historią.
    EXECUTE format(
      'DELETE FROM "_KopiaWlasnosci" k
        WHERE k."tabela" = %L
          AND NOT EXISTS (SELECT 1 FROM %I s WHERE concat_ws(''|'', %s) = k."wiersz")',
      r.table_name, r.table_name, pk_wartosc
    );
    GET DIAGNOSTICS usuniete = ROW_COUNT;

    EXECUTE format(
      'INSERT INTO "_KopiaWlasnosci" ("tabela","klucz","wiersz","ownerId","ownerTeamId","zapisano")
       SELECT %L, %L, concat_ws(''|'', %s), %s, %s, CURRENT_TIMESTAMP FROM %I
       ON CONFLICT ("tabela","wiersz") DO UPDATE
         SET "ownerId"     = EXCLUDED."ownerId",
             "ownerTeamId" = EXCLUDED."ownerTeamId",
             "klucz"       = EXCLUDED."klucz",
             "zapisano"    = EXCLUDED."zapisano"',
      r.table_name, pk_nazwy, pk_wartosc, kol_o, kol_t, r.table_name
    );
    GET DIAGNOSTICS wstawione = ROW_COUNT;

    tabel  := tabel + 1;
    suma_w := suma_w + wstawione;
    suma_u := suma_u + usuniete;
  END LOOP;

  RAISE NOTICE 'Kopia własności odświeżona: % tabel, % wierszy zapisanych, % usuniętych.', tabel, suma_w, suma_u;
END
$odswiez$;

-- ─── 2. KONTROLA LICZNOŚCI PER TABELA (U-5) ───────────────────────────────────────────────
--
-- Odświeżenie mogło się nie udać w sposób, którego samo z siebie nie zgłosi (np. klucz główny
-- zmieniony między migracjami, więc `wiersz` przestał pasować i powstały duplikaty zamiast
-- aktualizacji). Sprawdzamy więc to, co sprawdzalne bez zaufania do kroku wyżej: **liczba wierszy
-- w kopii musi się zgadzać z liczbą wierszy w tabeli źródłowej**. Rozjazd przerywa migrację —
-- lepiej nie wdrożyć niczego niż usunąć kolumny, których kopia nie obejmuje w całości.
DO $kontrola$
DECLARE
  r      record;
  w_zrod bigint;
  w_kopii bigint;
  zle    text := '';
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
    EXECUTE format('SELECT count(*) FROM %I', r.table_name) INTO w_zrod;
    SELECT count(*) INTO w_kopii FROM "_KopiaWlasnosci" WHERE "tabela" = r.table_name;
    IF w_zrod <> w_kopii THEN
      zle := zle || format('%s: źródło %s, kopia %s; ', r.table_name, w_zrod, w_kopii);
    END IF;
  END LOOP;
  IF zle <> '' THEN
    RAISE EXCEPTION 'Kopia własności nie pokrywa danych — %', zle;
  END IF;
  RAISE NOTICE 'Kontrola liczności kopii własności: zgodna dla wszystkich tabel.';
END
$kontrola$;

-- ─── 3. ZDJĘCIE WYZWALACZA Z TABEL, KTÓRE TRACĄ WŁAŚCICIELA ───────────────────────────────
--
-- `omnia_fill_workspace` (0228/0236/0238/0240) wyprowadza przestrzeń Z KOLUMN WŁAŚCICIELSKICH
-- i od 0240 dodatkowo odrzuca rozjazd między nią a podanym `workspaceId`. Bez tych kolumn nie ma
-- z czego wyprowadzać ani czego porównywać — wyzwalacz stałby się kodem, który zawsze wychodzi
-- pierwszym `IF`-em. Zdejmujemy go z 40 tabel; **na pięciu wyjątkowych ZOSTAJE**, bo tam kolumna
-- właściciela żyje dalej i nadal jest z czego wyprowadzać.
--
-- Sama funkcja zostaje z tego samego powodu. Bramka `check:workspace-fill` pilnuje zgodności
-- w obie strony: wyzwalacz na tabeli spoza listy wyjątków też wywali build.
DROP TRIGGER IF EXISTS "trg_ShoppingList_workspace" ON "ShoppingList";
DROP TRIGGER IF EXISTS "trg_Note_workspace" ON "Note";
DROP TRIGGER IF EXISTS "trg_TaskProject_workspace" ON "TaskProject";
DROP TRIGGER IF EXISTS "trg_TaskView_workspace" ON "TaskView";
DROP TRIGGER IF EXISTS "trg_Store_workspace" ON "Store";
DROP TRIGGER IF EXISTS "trg_Recipe_workspace" ON "Recipe";
DROP TRIGGER IF EXISTS "trg_Cookbook_workspace" ON "Cookbook";
DROP TRIGGER IF EXISTS "trg_MealPlanEntry_workspace" ON "MealPlanEntry";
DROP TRIGGER IF EXISTS "trg_PantryItem_workspace" ON "PantryItem";
DROP TRIGGER IF EXISTS "trg_StorageItem_workspace" ON "StorageItem";
DROP TRIGGER IF EXISTS "trg_StorageSupplier_workspace" ON "StorageSupplier";
DROP TRIGGER IF EXISTS "trg_StorageDocument_workspace" ON "StorageDocument";
DROP TRIGGER IF EXISTS "trg_StoragePurchaseOrder_workspace" ON "StoragePurchaseOrder";
DROP TRIGGER IF EXISTS "trg_Pet_workspace" ON "Pet";
DROP TRIGGER IF EXISTS "trg_PetEnclosure_workspace" ON "PetEnclosure";
DROP TRIGGER IF EXISTS "trg_PetBreedingPair_workspace" ON "PetBreedingPair";
DROP TRIGGER IF EXISTS "trg_PetSale_workspace" ON "PetSale";
DROP TRIGGER IF EXISTS "trg_Vehicle_workspace" ON "Vehicle";
DROP TRIGGER IF EXISTS "trg_WalletElement_workspace" ON "WalletElement";
DROP TRIGGER IF EXISTS "trg_FavoriteView_workspace" ON "FavoriteView";
DROP TRIGGER IF EXISTS "trg_Budget_workspace" ON "Budget";
DROP TRIGGER IF EXISTS "trg_FinanceGoal_workspace" ON "FinanceGoal";
DROP TRIGGER IF EXISTS "trg_LanguageDeck_workspace" ON "LanguageDeck";
DROP TRIGGER IF EXISTS "trg_HealthEvent_workspace" ON "HealthEvent";
DROP TRIGGER IF EXISTS "trg_MedicationSchedule_workspace" ON "MedicationSchedule";
DROP TRIGGER IF EXISTS "trg_Habit_workspace" ON "Habit";
DROP TRIGGER IF EXISTS "trg_NewsSource_workspace" ON "NewsSource";
DROP TRIGGER IF EXISTS "trg_NewsTopic_workspace" ON "NewsTopic";
DROP TRIGGER IF EXISTS "trg_NewsArticle_workspace" ON "NewsArticle";
DROP TRIGGER IF EXISTS "trg_NewsHiddenTopic_workspace" ON "NewsHiddenTopic";
DROP TRIGGER IF EXISTS "trg_NewsPref_workspace" ON "NewsPref";
DROP TRIGGER IF EXISTS "trg_UserFact_workspace" ON "UserFact";
DROP TRIGGER IF EXISTS "trg_WeatherLocation_workspace" ON "WeatherLocation";
DROP TRIGGER IF EXISTS "trg_WeatherWatcher_workspace" ON "WeatherWatcher";
DROP TRIGGER IF EXISTS "trg_WeatherIdea_workspace" ON "WeatherIdea";
DROP TRIGGER IF EXISTS "trg_AiContent_workspace" ON "AiContent";
DROP TRIGGER IF EXISTS "trg_AiSectionPref_workspace" ON "AiSectionPref";
DROP TRIGGER IF EXISTS "trg_NewsRefreshRun_workspace" ON "NewsRefreshRun";
DROP TRIGGER IF EXISTS "trg_Workshop_workspace" ON "Workshop";
DROP TRIGGER IF EXISTS "trg_Contact_workspace" ON "Contact";

-- ─── 4. USUNIĘCIE KOLUMN ──────────────────────────────────────────────────────────────────
--
-- `DROP COLUMN` zabiera razem z kolumną jej klucz obcy i indeksy — kaskadę po koncie i zespole
-- przejął klucz obcy `workspaceId → Workspace` z 0243.
ALTER TABLE "ShoppingList"         DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "Note"                 DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "TaskProject"          DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "TaskView"             DROP COLUMN "ownerId";
ALTER TABLE "Store"                DROP COLUMN "ownerId";
ALTER TABLE "Recipe"               DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "Cookbook"             DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "MealPlanEntry"        DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "PantryItem"           DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "StorageItem"          DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "StorageSupplier"      DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "StorageDocument"      DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "StoragePurchaseOrder" DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "Pet"                  DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "PetEnclosure"         DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "PetBreedingPair"      DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "PetSale"              DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "Vehicle"              DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "WalletElement"        DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "FavoriteView"         DROP COLUMN "ownerId";
ALTER TABLE "Budget"               DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "FinanceGoal"          DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "LanguageDeck"         DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "HealthEvent"          DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "MedicationSchedule"   DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "Habit"                DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "NewsSource"           DROP COLUMN "ownerId";
ALTER TABLE "NewsTopic"            DROP COLUMN "ownerId";
ALTER TABLE "NewsArticle"          DROP COLUMN "ownerId";
ALTER TABLE "NewsHiddenTopic"      DROP COLUMN "ownerId";
ALTER TABLE "NewsPref"             DROP COLUMN "ownerId";
ALTER TABLE "UserFact"             DROP COLUMN "ownerId";
ALTER TABLE "WeatherLocation"      DROP COLUMN "ownerId";
ALTER TABLE "WeatherWatcher"       DROP COLUMN "ownerId";
ALTER TABLE "WeatherIdea"          DROP COLUMN "ownerId";
ALTER TABLE "AiContent"            DROP COLUMN "ownerId";
ALTER TABLE "AiSectionPref"        DROP COLUMN "ownerId";
ALTER TABLE "NewsRefreshRun"       DROP COLUMN "ownerId";
ALTER TABLE "Workshop"             DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
ALTER TABLE "Contact"              DROP COLUMN "ownerId", DROP COLUMN "ownerTeamId";
