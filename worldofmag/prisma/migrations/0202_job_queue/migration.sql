-- Z-131 (T-17): kolejka zadań w tle dla ciężkich operacji AI. Wieloworkerowa
-- (pobieranie przez SELECT ... FOR UPDATE SKIP LOCKED w kodzie kolejki).
-- UWAGA: `prisma migrate diff` chciał tu też usunąć indeksy trigramowe notatek
-- (Note_*_trgm_idx z migr. 0201) — to ŚWIADOMY DRYF (nie ma ich w schema.prisma),
-- więc CELOWO ich NIE ruszamy; poniżej tylko utworzenie tabeli Job.
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "result" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");
CREATE INDEX "Job_ownerId_createdAt_idx" ON "Job"("ownerId", "createdAt");
CREATE INDEX "Job_dedupeKey_idx" ON "Job"("dedupeKey");
