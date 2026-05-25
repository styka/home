-- ─── Pets · Faza 2: Husbandry (terrarium / akwarium) ────────────────────────

-- AlterTable: Pet → enclosureId
ALTER TABLE "Pet" ADD COLUMN "enclosureId" TEXT;

-- CreateTable
CREATE TABLE "PetEnclosure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TERRARIUM',
    "lengthCm" DOUBLE PRECISION,
    "widthCm" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "volumeL" DOUBLE PRECISION,
    "location" TEXT,
    "equipment" TEXT,
    "targetRanges" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PetEnclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetEnvironmentReading" (
    "id" TEXT NOT NULL,
    "enclosureId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tempWarmC" DOUBLE PRECISION,
    "tempCoolC" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "uvbIndex" DOUBLE PRECISION,
    "waterTempC" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "ammoniaPpm" DOUBLE PRECISION,
    "nitritePpm" DOUBLE PRECISION,
    "nitratePpm" DOUBLE PRECISION,
    "salinityPpt" DOUBLE PRECISION,
    "gh" DOUBLE PRECISION,
    "kh" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PetEnvironmentReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pet_enclosureId_idx" ON "Pet"("enclosureId");
CREATE INDEX "PetEnclosure_ownerId_idx" ON "PetEnclosure"("ownerId");
CREATE INDEX "PetEnclosure_ownerTeamId_idx" ON "PetEnclosure"("ownerTeamId");
CREATE INDEX "PetEnvironmentReading_enclosureId_measuredAt_idx" ON "PetEnvironmentReading"("enclosureId", "measuredAt");

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_enclosureId_fkey" FOREIGN KEY ("enclosureId") REFERENCES "PetEnclosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PetEnclosure" ADD CONSTRAINT "PetEnclosure_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetEnclosure" ADD CONSTRAINT "PetEnclosure_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetEnvironmentReading" ADD CONSTRAINT "PetEnvironmentReading_enclosureId_fkey" FOREIGN KEY ("enclosureId") REFERENCES "PetEnclosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
