-- Z-033/Z-036: jawna polityka onDelete dla relacji własności (pod RODO / twarde usunięcie konta).
-- Naprawia 'ciche sieroty': 10 modeli własności (ShoppingList, TaskProject, Note, Recipe,
-- Cookbook, MealPlanEntry, LanguageDeck, HealthEvent, MedicationSchedule, Habit) miało owner/
-- ownerTeam na SetNull lub bez polityki → usunięcie usera/zespołu zostawiało osierocony rekord
-- (ownerId=NULL, niewidoczny, niezgodny z RODO). Ujednolicenie z resztą schematu (Cascade).
-- Pozostałe relacje aktora/zespołu (Task.createdBy/assignee, TaskComment, TaskShare, Team.*,
-- TeamInvitation.*) dostały JAWNE onDelete równe dotychczasowej domyślności (zero zmian w DB).

-- DropForeignKey
ALTER TABLE "ShoppingList" DROP CONSTRAINT "ShoppingList_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "ShoppingList" DROP CONSTRAINT "ShoppingList_ownerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_ownerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "TaskProject" DROP CONSTRAINT "TaskProject_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "TaskProject" DROP CONSTRAINT "TaskProject_ownerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_ownerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "Cookbook" DROP CONSTRAINT "Cookbook_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Cookbook" DROP CONSTRAINT "Cookbook_ownerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "MealPlanEntry" DROP CONSTRAINT "MealPlanEntry_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "MealPlanEntry" DROP CONSTRAINT "MealPlanEntry_ownerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "LanguageDeck" DROP CONSTRAINT "LanguageDeck_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "LanguageDeck" DROP CONSTRAINT "LanguageDeck_ownerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "HealthEvent" DROP CONSTRAINT "HealthEvent_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "HealthEvent" DROP CONSTRAINT "HealthEvent_ownerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "MedicationSchedule" DROP CONSTRAINT "MedicationSchedule_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "MedicationSchedule" DROP CONSTRAINT "MedicationSchedule_ownerTeamId_fkey";

-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_ownerTeamId_fkey";

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cookbook" ADD CONSTRAINT "Cookbook_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cookbook" ADD CONSTRAINT "Cookbook_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageDeck" ADD CONSTRAINT "LanguageDeck_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageDeck" ADD CONSTRAINT "LanguageDeck_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationSchedule" ADD CONSTRAINT "MedicationSchedule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationSchedule" ADD CONSTRAINT "MedicationSchedule_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
