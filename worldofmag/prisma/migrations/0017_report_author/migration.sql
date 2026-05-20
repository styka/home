-- Add authorId to Report
ALTER TABLE "Report" ADD COLUMN "authorId" TEXT;

-- Assign existing reports to the first admin user
UPDATE "Report"
SET "authorId" = (
  SELECT "id" FROM "User"
  WHERE "role" = 'ADMIN'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "authorId" IS NULL;

-- Foreign key constraint
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index
CREATE INDEX "Report_authorId_idx" ON "Report"("authorId");
