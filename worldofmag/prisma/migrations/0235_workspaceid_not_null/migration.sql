-- Zadanie 11, ETAP 4 (część 1 z 2): `workspaceId NOT NULL` na 41 z 45 tabel lustrzanych.
--
-- Ta migracja NIE usuwa jeszcze `ownerId`/`ownerTeamId` — zaostrza tylko kolumnę docelową, żeby od
-- teraz każdy nowy wiersz miał przestrzeń. Usunięcie kolumn własnościowych to osobny przebieg,
-- poprzedzony kopią z migracji 0233 i procedurą z `docs/devops/przywrocenie-wlasnosci.md`.
--
-- CZTERY TABELE ZOSTAJĄ NULLOWALNE — i to nie jest dług, tylko poprawna reguła.
-- Pomiar przed tą migracją znalazł 79 wierszy bez przestrzeni i WSZYSTKIE okazały się rekordami
-- SYSTEMOWYMI (`ownerId IS NULL`) — wspólnymi dla wszystkich kont, edytowalnymi tylko przez
-- administratora (model trójpoziomowy, CLAUDE.md „Dictionary Ownership Levels"). Rekord systemowy
-- z definicji NIE NALEŻY do żadnej przestrzeni, więc `NULL` jest tu prawdziwą odpowiedzią, a nie
-- brakiem odpowiedzi. Wymuszenie `NOT NULL` wymagałoby wymyślenia „przestrzeni systemowej", której
-- członkiem musiałby być każdy — a to tworzy nowy tryb awarii: brak jednego wiersza
-- `WorkspaceMember` i użytkownik po cichu przestaje widzieć wszystkie słowniki.
--
-- Lista wyjątków opiera się na SEMANTYCE, nie na dzisiejszych licznikach: `NoteGroup` i `Tag` mają
-- dziś zero rekordów systemowych, ale 034 celowo dało im ten model — gdyby ich tu zabrakło,
-- pierwszy tag systemowy założony przez administratora wywróciłby zapis na produkcji.
-- Listy pilnuje bramka `npm run check:workspace-nullable` (manifest: src/lib/db/workspace-nullable.json),
-- która pozwala jej maleć, ale nie rosnąć.
--
-- KROK 1 sprząta pojedynczy wiersz, który udawał rekord systemowy, a nim nie był.
-- KROK 2 sprawdza założenie i zatrzymuje migrację z czytelnym komunikatem, jeśli się nie potwierdzi.

-- ─── KROK 1: bezpańska lista `default` z seeda ──────────────────────────────
-- `id = "default"`, bez właściciela, z najstarszej wersji aplikacji. `ownedWhereAsync` filtruje po
-- `ownerId`/`ownerTeamId`, więc tej listy nie widział ŻADEN użytkownik — to martwe dane, nie
-- słownik. Usuwamy, ale tylko jeśli jest pusta; z pozycjami przypisujemy ją administratorowi,
-- żeby żadna migracja nie kasowała cudzej treści.
DO $lista$
DECLARE pozycji bigint; admin_id text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ShoppingList" WHERE "id" = 'default' AND "ownerId" IS NULL AND "ownerTeamId" IS NULL) THEN
    RAISE NOTICE 'Brak bezpańskiej listy `default` — nic do sprzątania.';
  ELSE
    SELECT count(*) INTO pozycji FROM "Item" WHERE "listId" = 'default';
    IF pozycji = 0 THEN
      DELETE FROM "ShoppingList" WHERE "id" = 'default';
      RAISE NOTICE 'Usunięto pustą bezpańską listę `default`.';
    ELSE
      SELECT u."id" INTO admin_id
        FROM "User" u
        JOIN "UserRole" ur ON ur."userId" = u."id" AND ur."role" = 'ADMIN'
       ORDER BY u."createdAt" LIMIT 1;
      IF admin_id IS NULL THEN
        RAISE EXCEPTION 'Lista `default` ma % pozycji, a w bazie nie ma administratora, któremu można ją przypisać.', pozycji;
      END IF;
      UPDATE "ShoppingList" SET "ownerId" = admin_id WHERE "id" = 'default';
      RAISE NOTICE 'Lista `default` ma % pozycji — przypisano administratorowi (%), zamiast kasować.', pozycji, admin_id;
    END IF;
  END IF;
END
$lista$;

-- ─── KROK 2: kontrola założenia przed zaostrzeniem ──────────────────────────
-- Bez tego `SET NOT NULL` padłby na kryptycznym „column contains null values", nie mówiąc KTÓRA
-- tabela i ILE wierszy. Nieudana migracja blokuje wszystkie następne, więc komunikat musi od razu
-- wskazywać, co naprawić. Wcześniej próbujemy jeszcze uzupełnić przestrzeń z kolumn własnościowych
-- — dokładnie tak, jak robi to wyzwalacz przy zapisie.
DO $kontrola$
DECLARE r record; ile bigint; winne text := ''; ma_owner boolean; ma_team boolean; warunek text;
BEGIN
  FOR r IN SELECT unnest(ARRAY['AiContent', 'AiSectionPref', 'Budget', 'Contact', 'Cookbook', 'FavoriteView', 'FinanceGoal', 'Habit', 'HealthEvent', 'Job', 'LanguageDeck', 'MealPlanEntry', 'MedicationSchedule', 'NewsArticle', 'NewsHiddenTopic', 'NewsPref', 'NewsRefreshRun', 'NewsSource', 'NewsTopic', 'Note', 'PantryItem', 'Pet', 'PetBreedingPair', 'PetEnclosure', 'PetSale', 'Recipe', 'ShoppingList', 'StorageDocument', 'StorageItem', 'StoragePurchaseOrder', 'StorageSupplier', 'Store', 'TaskProject', 'TaskView', 'UserFact', 'Vehicle', 'WalletElement', 'WeatherIdea', 'WeatherLocation', 'WeatherWatcher', 'Workshop']) AS t
  LOOP
    -- Kolumny własnościowe NIE są jednakowe we wszystkich tabelach (np. `AiContent` ma tylko
    -- `ownerId`). Pierwsza wersja tego bloku zakładała obie i padła na `42703` — ta sama pomyłka,
    -- co przy kopii własności w 0233. Warunek składamy per tabela, z katalogu systemowego.
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=r.t AND column_name='ownerId'),
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=r.t AND column_name='ownerTeamId')
      INTO ma_owner, ma_team;

    warunek := concat_ws(' OR ',
      CASE WHEN ma_owner THEN '(x."ownerId" IS NOT NULL AND w."personalUserId" = x."ownerId")' END,
      CASE WHEN ma_team  THEN '(x."ownerTeamId" IS NOT NULL AND w."teamId" = x."ownerTeamId")' END);

    IF warunek <> '' THEN
      EXECUTE format(
        'UPDATE %I x SET "workspaceId" = w."id" FROM "Workspace" w
          WHERE x."workspaceId" IS NULL AND (%s)', r.t, warunek);
    END IF;

    EXECUTE format('SELECT count(*) FROM %I WHERE "workspaceId" IS NULL', r.t) INTO ile;
    IF ile > 0 THEN
      winne := winne || format('%s (%s), ', r.t, ile);
    END IF;
  END LOOP;

  IF winne <> '' THEN
    RAISE EXCEPTION E'Nie mogę zaostrzyć `workspaceId` — wiersze bez przestrzeni w: %.\nAlbo mają właściciela bez przestrzeni w lustrze (uruchom uzgodnienie z platform/workspaces), albo są rekordami systemowymi i ich tabela należy do wyjątków w src/lib/db/workspace-nullable.json.', rtrim(winne, ', ');
  END IF;

  RAISE NOTICE 'Kontrola przeszła: 41 tabel bez wierszy pozbawionych przestrzeni.';
END
$kontrola$;

-- ─── KROK 3: zaostrzenie ────────────────────────────────────────────────────
ALTER TABLE "AiContent" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "AiSectionPref" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Budget" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Contact" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Cookbook" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "FavoriteView" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "FinanceGoal" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Habit" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "HealthEvent" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Job" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "LanguageDeck" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "MealPlanEntry" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "MedicationSchedule" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "NewsArticle" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "NewsHiddenTopic" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "NewsPref" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "NewsRefreshRun" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "NewsSource" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "NewsTopic" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Note" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PantryItem" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Pet" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PetBreedingPair" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PetEnclosure" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PetSale" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ShoppingList" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "StorageDocument" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "StorageItem" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "StoragePurchaseOrder" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "StorageSupplier" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Store" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "TaskProject" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "TaskView" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "UserFact" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Vehicle" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "WalletElement" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "WeatherIdea" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "WeatherLocation" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "WeatherWatcher" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Workshop" ALTER COLUMN "workspaceId" SET NOT NULL;
