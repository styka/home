-- Zadanie 11 przebudowy, ETAP 1 z CZTERECH — `workspaceId` jako docelowy klucz własności.
--
-- Rozdz. 8.10 nazywa to najbardziej ryzykownym krokiem całej przebudowy i podaje kolejność:
--   (a) dodać kolumnę NULLABLE  ← TO ROBI TA MIGRACJA
--   (b) wypełnić migracją SQL   ← TO TEŻ
--   (c) przełączyć zapytania    ← etap 3, osobny przebieg
--   (d) uczynić wymaganą        ← etap 4, osobny przebieg
-- „Nigdy w jednym kroku."
--
-- Co ta migracja ROBI aplikacji: nic. Kolumna nie ma ani jednego czytelnika — dostęp i własność
-- liczą się dalej przez `ownerId`/`ownerTeamId`.
--
-- Backfill korzysta z przestrzeni zbudowanych w 051: rekord użytkownika trafia do jego przestrzeni
-- osobistej, rekord zespołu — do przestrzeni zespołu. Warunek `workspaceId IS NULL` czyni każdy
-- UPDATE idempotentnym i bezpiecznym przy powtórzeniu wdrożenia.
--
-- PIERWSZEŃSTWO WŁASNOŚCI. Konwencja mówi „użytkownik ALBO zespół", ale nic tego nie wymusza
-- na poziomie bazy. Gdyby rekord miał obie kolumny, decyduje KOLEJNOŚĆ instrukcji: najpierw idzie
-- UPDATE po `ownerId`, więc wygrywa przestrzeń osobista, a UPDATE zespołowy odbija się od warunku
-- `workspaceId IS NULL`. To NIE jest przypadek — dokładnie tak rozstrzyga `resolveRole`
-- (`platform/sharing/access.ts`: `ownerId` sprawdzane przed `ownerTeamId`), więc backfill i kontrola
-- dostępu odpowiadają na to samo pytanie tak samo.
--
-- Rekord, którego właściciel nie ma przestrzeni (konto usunięte), zostaje z NULL — świadomie.
-- Etap 4 musi wiedzieć, ile takich jest, więc test je ZLICZA, zamiast je przemilczeć.
--
-- UWAGA (C-15): `prisma migrate diff` wygenerował dodatkowo DROP INDEX na dwóch indeksach
-- trigramowych i trzy ALTER COLUMN ... DROP DEFAULT. To NIE jest rozjazd, tylko granica
-- `schema.prisma` (wpisy w `schema-drift-allowed.json`). Zostały USUNIĘTE — w 051 dokładnie te
-- instrukcje skasowały indeksy wyszukiwania notatek.
--
-- Wycofanie: ALTER TABLE ... DROP COLUMN "workspaceId" na objętych tabelach. Bezpieczne, bo nic
-- z tej kolumny nie czyta.

-- AlterTable
ALTER TABLE "AiContent" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "AiSectionPref" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Cookbook" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "FavoriteView" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "FinanceGoal" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "HealthEvent" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "ItemHistory" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "LanguageDeck" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "MealPlanEntry" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "MedicationSchedule" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "NewsArticle" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "NewsHiddenTopic" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "NewsPref" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "NewsRefreshRun" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "NewsSource" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "NewsTopic" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "NoteGroup" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "PetBreedingPair" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "PetEnclosure" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "PetSale" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "ShoppingList" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Skin" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "StorageDocument" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "StorageItem" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "StoragePurchaseOrder" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "StorageSupplier" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "TaskProject" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "TaskView" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "UserFact" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "WalletElement" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "WeatherIdea" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "WeatherLocation" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "WeatherWatcher" ADD COLUMN     "workspaceId" TEXT;
-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "workspaceId" TEXT;
-- CreateIndex
CREATE INDEX "AiContent_workspaceId_idx" ON "AiContent"("workspaceId");
-- CreateIndex
CREATE INDEX "AiSectionPref_workspaceId_idx" ON "AiSectionPref"("workspaceId");
-- CreateIndex
CREATE INDEX "Budget_workspaceId_idx" ON "Budget"("workspaceId");
-- CreateIndex
CREATE INDEX "Contact_workspaceId_idx" ON "Contact"("workspaceId");
-- CreateIndex
CREATE INDEX "Cookbook_workspaceId_idx" ON "Cookbook"("workspaceId");
-- CreateIndex
CREATE INDEX "FavoriteView_workspaceId_idx" ON "FavoriteView"("workspaceId");
-- CreateIndex
CREATE INDEX "FinanceGoal_workspaceId_idx" ON "FinanceGoal"("workspaceId");
-- CreateIndex
CREATE INDEX "Habit_workspaceId_idx" ON "Habit"("workspaceId");
-- CreateIndex
CREATE INDEX "HealthEvent_workspaceId_idx" ON "HealthEvent"("workspaceId");
-- CreateIndex
CREATE INDEX "ItemHistory_workspaceId_idx" ON "ItemHistory"("workspaceId");
-- CreateIndex
CREATE INDEX "Job_workspaceId_idx" ON "Job"("workspaceId");
-- CreateIndex
CREATE INDEX "LanguageDeck_workspaceId_idx" ON "LanguageDeck"("workspaceId");
-- CreateIndex
CREATE INDEX "MealPlanEntry_workspaceId_idx" ON "MealPlanEntry"("workspaceId");
-- CreateIndex
CREATE INDEX "MedicationSchedule_workspaceId_idx" ON "MedicationSchedule"("workspaceId");
-- CreateIndex
CREATE INDEX "NewsArticle_workspaceId_idx" ON "NewsArticle"("workspaceId");
-- CreateIndex
CREATE INDEX "NewsHiddenTopic_workspaceId_idx" ON "NewsHiddenTopic"("workspaceId");
-- CreateIndex
CREATE INDEX "NewsPref_workspaceId_idx" ON "NewsPref"("workspaceId");
-- CreateIndex
CREATE INDEX "NewsRefreshRun_workspaceId_idx" ON "NewsRefreshRun"("workspaceId");
-- CreateIndex
CREATE INDEX "NewsSource_workspaceId_idx" ON "NewsSource"("workspaceId");
-- CreateIndex
CREATE INDEX "NewsTopic_workspaceId_idx" ON "NewsTopic"("workspaceId");
-- CreateIndex
CREATE INDEX "Note_workspaceId_idx" ON "Note"("workspaceId");
-- CreateIndex
CREATE INDEX "NoteGroup_workspaceId_idx" ON "NoteGroup"("workspaceId");
-- CreateIndex
CREATE INDEX "PantryItem_workspaceId_idx" ON "PantryItem"("workspaceId");
-- CreateIndex
CREATE INDEX "Pet_workspaceId_idx" ON "Pet"("workspaceId");
-- CreateIndex
CREATE INDEX "PetBreedingPair_workspaceId_idx" ON "PetBreedingPair"("workspaceId");
-- CreateIndex
CREATE INDEX "PetEnclosure_workspaceId_idx" ON "PetEnclosure"("workspaceId");
-- CreateIndex
CREATE INDEX "PetSale_workspaceId_idx" ON "PetSale"("workspaceId");
-- CreateIndex
CREATE INDEX "Recipe_workspaceId_idx" ON "Recipe"("workspaceId");
-- CreateIndex
CREATE INDEX "ShoppingList_workspaceId_idx" ON "ShoppingList"("workspaceId");
-- CreateIndex
CREATE INDEX "Skin_workspaceId_idx" ON "Skin"("workspaceId");
-- CreateIndex
CREATE INDEX "StorageDocument_workspaceId_idx" ON "StorageDocument"("workspaceId");
-- CreateIndex
CREATE INDEX "StorageItem_workspaceId_idx" ON "StorageItem"("workspaceId");
-- CreateIndex
CREATE INDEX "StoragePurchaseOrder_workspaceId_idx" ON "StoragePurchaseOrder"("workspaceId");
-- CreateIndex
CREATE INDEX "StorageSupplier_workspaceId_idx" ON "StorageSupplier"("workspaceId");
-- CreateIndex
CREATE INDEX "Store_workspaceId_idx" ON "Store"("workspaceId");
-- CreateIndex
CREATE INDEX "Tag_workspaceId_idx" ON "Tag"("workspaceId");
-- CreateIndex
CREATE INDEX "TaskProject_workspaceId_idx" ON "TaskProject"("workspaceId");
-- CreateIndex
CREATE INDEX "TaskView_workspaceId_idx" ON "TaskView"("workspaceId");
-- CreateIndex
CREATE INDEX "UserFact_workspaceId_idx" ON "UserFact"("workspaceId");
-- CreateIndex
CREATE INDEX "Vehicle_workspaceId_idx" ON "Vehicle"("workspaceId");
-- CreateIndex
CREATE INDEX "WalletElement_workspaceId_idx" ON "WalletElement"("workspaceId");
-- CreateIndex
CREATE INDEX "WeatherIdea_workspaceId_idx" ON "WeatherIdea"("workspaceId");
-- CreateIndex
CREATE INDEX "WeatherLocation_workspaceId_idx" ON "WeatherLocation"("workspaceId");
-- CreateIndex
CREATE INDEX "WeatherWatcher_workspaceId_idx" ON "WeatherWatcher"("workspaceId");
-- CreateIndex
CREATE INDEX "Workshop_workspaceId_idx" ON "Workshop"("workspaceId");

-- ═══ BACKFILL — z przestrzeni zbudowanych w 051 ═══
--
-- UWAGA: nazwy TABEL, nie modeli. `ProjectGroup` jest zmapowany na `TaskView` przez `@@map`,
-- więc backfill pisany po nazwach modeli wywalił się na `relation "ProjectGroup" does not exist`.
-- Instrukcje `ADD COLUMN` tego problemu nie miały, bo generuje je Prisma — pisany ręcznie SQL musi
-- `@@map` uwzględnić sam.

UPDATE "Skin" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Skin" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "ShoppingList" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "ShoppingList" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "ItemHistory" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "NoteGroup" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "NoteGroup" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "Tag" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Tag" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "Note" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Note" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "TaskProject" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "TaskProject" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "TaskView" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Store" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Job" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Recipe" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Recipe" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "Cookbook" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Cookbook" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "MealPlanEntry" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "MealPlanEntry" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "PantryItem" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "PantryItem" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "StorageItem" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "StorageItem" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "StorageSupplier" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "StorageSupplier" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "StorageDocument" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "StorageDocument" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "StoragePurchaseOrder" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "StoragePurchaseOrder" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "Pet" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Pet" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "PetEnclosure" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "PetEnclosure" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "PetBreedingPair" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "PetBreedingPair" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "PetSale" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "PetSale" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "Vehicle" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Vehicle" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "WalletElement" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "WalletElement" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "FavoriteView" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Budget" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Budget" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "FinanceGoal" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "FinanceGoal" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "LanguageDeck" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "LanguageDeck" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "HealthEvent" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "HealthEvent" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "MedicationSchedule" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "MedicationSchedule" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "Habit" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Habit" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "NewsSource" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "NewsTopic" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "NewsArticle" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "NewsHiddenTopic" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "NewsPref" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "UserFact" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "WeatherLocation" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "WeatherWatcher" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "WeatherIdea" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "AiContent" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "AiSectionPref" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "NewsRefreshRun" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Workshop" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Workshop" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";

UPDATE "Contact" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerId" IS NOT NULL AND w."personalUserId" = t."ownerId";

UPDATE "Contact" t SET "workspaceId" = w."id" FROM "Workspace" w
WHERE t."workspaceId" IS NULL AND t."ownerTeamId" IS NOT NULL AND w."teamId" = t."ownerTeamId";
