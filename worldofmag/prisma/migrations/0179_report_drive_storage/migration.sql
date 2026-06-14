-- Raporty mogą być przechowywane w bazie ("db") lub na Dysku Google ("drive").
-- Istniejące raporty pozostają w bazie (DEFAULT 'db') — nie migrujemy ich treści.
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "storage" TEXT NOT NULL DEFAULT 'db';
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "driveFileId" TEXT;
