-- 079 (zadanie 11, etap 4 część 3) — KLUCZ OBCY `workspaceId → Workspace`, KASKADA WŁĄCZNIE.
--
-- POWÓD, KTÓREGO NIE WIDZI KOMPILATOR. Do dziś usunięcie konta albo zespołu sprzątało jego dane
-- KASKADĄ po kolumnie własnościowej (`owner User @relation(onDelete: Cascade)` na 39 z 40 tabel
-- objętych etapem 4). `workspaceId` nie miało klucza obcego W OGÓLE, więc `DROP COLUMN` zabrałby
-- tę kaskadę bez jednego błędu kompilacji i bez czerwonego testu: usunięcie konta zostawiłoby
-- w bazie jego portfel, flotę, magazyn i pogodę, a operacja zgłosiłaby sukces. To jest dokładnie
-- ten przypadek z `doświadczenia.md`: wartość kolumny niesie ZNACZENIE POZA samą wartością.
--
-- Kaskada przez przestrzeń odtwarza obie dawne ścieżki jeden do jednego, bo lustro z zadania 9
-- wiąże przestrzeń z jej źródłem kluczem obcym `ON DELETE CASCADE`:
--   usunięcie konta   → `Workspace.personalUserId` → przestrzeń osobista → jej zasoby,
--   usunięcie zespołu → `Workspace.teamId`         → przestrzeń zespołu  → jego zasoby.
--
-- JEDNA TABELA ZYSKUJE KASKADĘ, KTÓREJ NIE MIAŁA: `Contact` (Z-370 — kolumna właściciela bez
-- klucza obcego). Dotąd ratował ją wyłącznie jawny `deleteMany` w `lib/privacy/purge.ts`, a przy
-- usunięciu ZESPOŁU kontakty zespołowe zostawały osierocone. Teraz nie zostaną. To poszerzenie
-- SPRZĄTANIA, nie dostępu.
--
-- Pięciu tabel z `workspace-nullable.json` migracja NIE dotyka: ich `ownerId` jest `SetNull`,
-- więc kaskada po przestrzeni zmieniłaby zachowanie (rekord miał zostać jako systemowy, a nie
-- zniknąć). One zachowują `ownerId` i jego semantykę.

-- Kontrola przed zmianą: żaden wiersz nie może wskazywać nieistniejącej przestrzeni. Gdyby
-- wskazywał, `ADD CONSTRAINT` i tak by padł — ale z komunikatem o więzach, nie o tym, CO jest nie
-- tak. Ten blok mówi wprost, która tabela i ile wierszy.
DO $$
DECLARE
  t text;
  n bigint;
  zle text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ShoppingList',
    'Note',
    'TaskProject',
    'TaskView',
    'Store',
    'Recipe',
    'Cookbook',
    'MealPlanEntry',
    'PantryItem',
    'StorageItem',
    'StorageSupplier',
    'StorageDocument',
    'StoragePurchaseOrder',
    'Pet',
    'PetEnclosure',
    'PetBreedingPair',
    'PetSale',
    'Vehicle',
    'WalletElement',
    'FavoriteView',
    'Budget',
    'FinanceGoal',
    'LanguageDeck',
    'HealthEvent',
    'MedicationSchedule',
    'Habit',
    'NewsSource',
    'NewsTopic',
    'NewsArticle',
    'NewsHiddenTopic',
    'NewsPref',
    'UserFact',
    'WeatherLocation',
    'WeatherWatcher',
    'WeatherIdea',
    'AiContent',
    'AiSectionPref',
    'NewsRefreshRun',
    'Workshop',
    'Contact'
  ] LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I r LEFT JOIN "Workspace" w ON w.id = r."workspaceId" WHERE w.id IS NULL',
      t
    ) INTO n;
    IF n > 0 THEN
      zle := zle || format('%s: %s wierszy; ', t, n);
    END IF;
  END LOOP;
  IF zle <> '' THEN
    RAISE EXCEPTION 'Rekordy wskazują nieistniejącą przestrzeń — %', zle;
  END IF;
END $$;

ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskView" ADD CONSTRAINT "TaskView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Store" ADD CONSTRAINT "Store_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cookbook" ADD CONSTRAINT "Cookbook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageItem" ADD CONSTRAINT "StorageItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageSupplier" ADD CONSTRAINT "StorageSupplier_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageDocument" ADD CONSTRAINT "StorageDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoragePurchaseOrder" ADD CONSTRAINT "StoragePurchaseOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetEnclosure" ADD CONSTRAINT "PetEnclosure_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetBreedingPair" ADD CONSTRAINT "PetBreedingPair_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetSale" ADD CONSTRAINT "PetSale_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletElement" ADD CONSTRAINT "WalletElement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriteView" ADD CONSTRAINT "FavoriteView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceGoal" ADD CONSTRAINT "FinanceGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LanguageDeck" ADD CONSTRAINT "LanguageDeck_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationSchedule" ADD CONSTRAINT "MedicationSchedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsSource" ADD CONSTRAINT "NewsSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsTopic" ADD CONSTRAINT "NewsTopic_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsHiddenTopic" ADD CONSTRAINT "NewsHiddenTopic_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsPref" ADD CONSTRAINT "NewsPref_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFact" ADD CONSTRAINT "UserFact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeatherLocation" ADD CONSTRAINT "WeatherLocation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeatherWatcher" ADD CONSTRAINT "WeatherWatcher_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeatherIdea" ADD CONSTRAINT "WeatherIdea_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiContent" ADD CONSTRAINT "AiContent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSectionPref" ADD CONSTRAINT "AiSectionPref_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsRefreshRun" ADD CONSTRAINT "NewsRefreshRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
