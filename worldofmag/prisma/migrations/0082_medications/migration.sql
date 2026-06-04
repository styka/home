-- Leki i pielęgnacja: harmonogram podawania leków oraz cyklicznych czynności
-- pielęgnacyjnych (kind MEDICATION|CARE) + dziennik odhaczonych dawek (MedicationLog).
-- Idempotentne (re-run-safe) jak 0078.
CREATE TABLE IF NOT EXISTS "MedicationSchedule" (
  "id"           TEXT PRIMARY KEY,
  "kind"         TEXT NOT NULL DEFAULT 'MEDICATION',
  "name"         TEXT NOT NULL,
  "dosage"       TEXT,
  "route"        TEXT,
  "reason"       TEXT,
  "instructions" TEXT,
  "freqType"     TEXT NOT NULL DEFAULT 'DAILY',
  "interval"     INTEGER NOT NULL DEFAULT 1,
  "daysOfWeek"   TEXT,
  "timesOfDay"   TEXT,
  "hourlyStart"  TEXT,
  "hourlyEnd"    TEXT,
  "startDate"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate"      TIMESTAMP(3),
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "notes"        TEXT,
  "ownerId"      TEXT,
  "ownerTeamId"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "MedicationLog" (
  "id"         TEXT PRIMARY KEY,
  "scheduleId" TEXT NOT NULL,
  "date"       TEXT NOT NULL,
  "slot"       TEXT NOT NULL,
  "outcome"    TEXT NOT NULL DEFAULT 'TAKEN',
  "takenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note"       TEXT
);

CREATE INDEX IF NOT EXISTS "MedicationSchedule_ownerId_idx" ON "MedicationSchedule"("ownerId");
CREATE INDEX IF NOT EXISTS "MedicationSchedule_ownerTeamId_idx" ON "MedicationSchedule"("ownerTeamId");
CREATE UNIQUE INDEX IF NOT EXISTS "MedicationLog_scheduleId_date_slot_key" ON "MedicationLog"("scheduleId", "date", "slot");
CREATE INDEX IF NOT EXISTS "MedicationLog_scheduleId_date_idx" ON "MedicationLog"("scheduleId", "date");

-- Postgres nie ma IF NOT EXISTS dla ograniczeń — opakowujemy w DO/EXCEPTION, by re-run był bezpieczny.
DO $$ BEGIN
  ALTER TABLE "MedicationSchedule" ADD CONSTRAINT "MedicationSchedule_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MedicationSchedule" ADD CONSTRAINT "MedicationSchedule_ownerTeamId_fkey"
    FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MedicationLog" ADD CONSTRAINT "MedicationLog_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "MedicationSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
