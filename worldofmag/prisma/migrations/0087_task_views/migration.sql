-- Zapisane widoki wielu projektów (TaskView): nazwana, trwała kombinacja projektów
-- użytkownika oglądana razem (/tasks/multi?view=<id>). projectIds = JSON string[].
-- Idempotentne (re-run-safe) jak pozostałe migracje modeli.
CREATE TABLE IF NOT EXISTS "TaskView" (
  "id"         TEXT PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "emoji"      TEXT NOT NULL DEFAULT '🗂',
  "projectIds" TEXT NOT NULL DEFAULT '[]',
  "ownerId"    TEXT NOT NULL,
  "order"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TaskView_ownerId_idx" ON "TaskView"("ownerId");

-- Postgres nie ma IF NOT EXISTS dla ograniczeń — opakowujemy w DO/EXCEPTION, by re-run był bezpieczny.
DO $$ BEGIN
  ALTER TABLE "TaskView" ADD CONSTRAINT "TaskView_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
