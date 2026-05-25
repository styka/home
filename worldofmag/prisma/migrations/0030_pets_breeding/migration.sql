-- ─── Pets · Faza 3: Hodowla, rodowody, genetyka, sprzedaż ───────────────────

-- AlterTable: Pet → rodowód + genetyka
ALTER TABLE "Pet" ADD COLUMN "sireId" TEXT;
ALTER TABLE "Pet" ADD COLUMN "damId" TEXT;
ALTER TABLE "Pet" ADD COLUMN "genetics" TEXT;

-- CreateTable
CREATE TABLE "PetBreedingPair" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL DEFAULT 'other',
    "maleId" TEXT,
    "femaleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startedAt" TIMESTAMP(3),
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PetBreedingPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetClutch" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "laidAt" TIMESTAMP(3),
    "eggCount" INTEGER,
    "fertileCount" INTEGER,
    "incubationTempC" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "expectedHatchAt" TIMESTAMP(3),
    "hatchedAt" TIMESTAMP(3),
    "hatchedCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'INCUBATING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PetClutch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetSale" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "buyerName" TEXT,
    "buyerContact" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PetSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pet_sireId_idx" ON "Pet"("sireId");
CREATE INDEX "Pet_damId_idx" ON "Pet"("damId");
CREATE INDEX "PetBreedingPair_ownerId_idx" ON "PetBreedingPair"("ownerId");
CREATE INDEX "PetBreedingPair_ownerTeamId_idx" ON "PetBreedingPair"("ownerTeamId");
CREATE INDEX "PetBreedingPair_maleId_idx" ON "PetBreedingPair"("maleId");
CREATE INDEX "PetBreedingPair_femaleId_idx" ON "PetBreedingPair"("femaleId");
CREATE INDEX "PetClutch_pairId_idx" ON "PetClutch"("pairId");
CREATE INDEX "PetClutch_expectedHatchAt_idx" ON "PetClutch"("expectedHatchAt");
CREATE INDEX "PetSale_petId_idx" ON "PetSale"("petId");
CREATE INDEX "PetSale_ownerId_idx" ON "PetSale"("ownerId");

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PetBreedingPair" ADD CONSTRAINT "PetBreedingPair_maleId_fkey" FOREIGN KEY ("maleId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PetBreedingPair" ADD CONSTRAINT "PetBreedingPair_femaleId_fkey" FOREIGN KEY ("femaleId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PetBreedingPair" ADD CONSTRAINT "PetBreedingPair_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetBreedingPair" ADD CONSTRAINT "PetBreedingPair_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetClutch" ADD CONSTRAINT "PetClutch_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "PetBreedingPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetSale" ADD CONSTRAINT "PetSale_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetSale" ADD CONSTRAINT "PetSale_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetSale" ADD CONSTRAINT "PetSale_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
