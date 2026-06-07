-- Warsztaty (Workshop): zarządzanie przydomowym warsztatem/pracownią dowolnego
-- typu + tryb Dom/Pro (per-user) + wyposażenie (narzędzia/maszyny/materiały) +
-- projekty/zlecenia (Pro). Idempotentne (re-run-safe) jak 0082.

CREATE TABLE IF NOT EXISTS "WarsztatSettings" (
  "userId"    TEXT PRIMARY KEY,
  "mode"      TEXT NOT NULL DEFAULT 'home',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Workshop" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "type"        TEXT NOT NULL DEFAULT 'ogolny',
  "description" TEXT,
  "location"    TEXT,
  "ownerId"     TEXT,
  "ownerTeamId" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WorkshopItem" (
  "id"            TEXT PRIMARY KEY,
  "workshopId"    TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "kind"          TEXT NOT NULL DEFAULT 'tool',
  "category"      TEXT,
  "quantity"      DOUBLE PRECISION,
  "unit"          TEXT,
  "minQuantity"   DOUBLE PRECISION,
  "condition"     TEXT NOT NULL DEFAULT 'good',
  "status"        TEXT NOT NULL DEFAULT 'owned',
  "brand"         TEXT,
  "station"       TEXT,
  "assignedTo"    TEXT,
  "purchasePrice" DOUBLE PRECISION,
  "purchaseDate"  TIMESTAMP(3),
  "lastServiceAt" TIMESTAMP(3),
  "nextServiceAt" TIMESTAMP(3),
  "suggestionKey" TEXT,
  "photoUrl"      TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WorkshopProject" (
  "id"          TEXT PRIMARY KEY,
  "workshopId"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'planned',
  "assignedTo"  TEXT,
  "startedAt"   TIMESTAMP(3),
  "dueAt"       TIMESTAMP(3),
  "doneAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Workshop_ownerId_idx" ON "Workshop"("ownerId");
CREATE INDEX IF NOT EXISTS "Workshop_ownerTeamId_idx" ON "Workshop"("ownerTeamId");
CREATE INDEX IF NOT EXISTS "WorkshopItem_workshopId_idx" ON "WorkshopItem"("workshopId");
CREATE INDEX IF NOT EXISTS "WorkshopItem_nextServiceAt_idx" ON "WorkshopItem"("nextServiceAt");
CREATE INDEX IF NOT EXISTS "WorkshopProject_workshopId_idx" ON "WorkshopProject"("workshopId");

-- Postgres nie ma IF NOT EXISTS dla ograniczeń — opakowujemy w DO/EXCEPTION.
DO $$ BEGIN
  ALTER TABLE "WarsztatSettings" ADD CONSTRAINT "WarsztatSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_ownerTeamId_fkey"
    FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkshopItem" ADD CONSTRAINT "WorkshopItem_workshopId_fkey"
    FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkshopProject" ADD CONSTRAINT "WorkshopProject_workshopId_fkey"
    FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
