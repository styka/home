-- Add teamId to CategoryIconVariant
ALTER TABLE "CategoryIconVariant" ADD COLUMN "teamId" TEXT;

-- Make userId optional (was NOT NULL)
ALTER TABLE "CategoryIconVariant" ALTER COLUMN "userId" DROP NOT NULL;

-- Add FK for teamId
ALTER TABLE "CategoryIconVariant"
  ADD CONSTRAINT "CategoryIconVariant_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update index
DROP INDEX IF EXISTS "CategoryIconVariant_userId_categoryName_idx";
CREATE INDEX "CategoryIconVariant_userId_teamId_categoryName_idx"
  ON "CategoryIconVariant"("userId", "teamId", "categoryName");

-- Add teamId and archived columns to Report
ALTER TABLE "Report" ADD COLUMN "teamId" TEXT;
ALTER TABLE "Report" ADD CONSTRAINT "Report_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Report_teamId_idx" ON "Report"("teamId");

-- Add archived fields to ShoppingList
ALTER TABLE "ShoppingList" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShoppingList" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Assign seeded reports (authorId IS NULL) to the oldest admin user
UPDATE "Report"
SET "authorId" = (
  SELECT id FROM "User"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "authorId" IS NULL;
