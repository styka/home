-- CreateTable
CREATE TABLE "HealthEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VISIT',
    "title" TEXT NOT NULL,
    "doctorName" TEXT,
    "specialty" TEXT,
    "facility" TEXT,
    "location" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "result" TEXT,
    "referral" TEXT,
    "reminderAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthEvent_ownerId_scheduledAt_idx" ON "HealthEvent"("ownerId", "scheduledAt");

-- CreateIndex
CREATE INDEX "HealthEvent_ownerTeamId_scheduledAt_idx" ON "HealthEvent"("ownerTeamId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
