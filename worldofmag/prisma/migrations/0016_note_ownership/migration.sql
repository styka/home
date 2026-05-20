-- Add ownership fields to Note
ALTER TABLE "Note" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Note" ADD COLUMN "ownerTeamId" TEXT;

-- Assign existing notes to the first admin user so they are not orphaned
UPDATE "Note"
SET "ownerId" = (
  SELECT "id" FROM "User"
  WHERE "role" = 'ADMIN'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "ownerId" IS NULL;

-- Foreign key constraints
ALTER TABLE "Note" ADD CONSTRAINT "Note_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Note" ADD CONSTRAINT "Note_ownerTeamId_fkey"
  FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Note_ownerId_idx" ON "Note"("ownerId");
CREATE INDEX "Note_ownerTeamId_idx" ON "Note"("ownerTeamId");
