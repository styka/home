-- ─── Pets module ────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL DEFAULT 'other',
    "breed" TEXT,
    "sex" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthApprox" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3),
    "acquiredFrom" TEXT,
    "microchipId" TEXT,
    "identifier" TEXT,
    "color" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deceasedAt" TIMESTAMP(3),
    "notes" TEXT,
    "presetKey" TEXT NOT NULL DEFAULT 'companion',
    "featureFlags" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetShare" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PetShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetMeasurement" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightGrams" DOUBLE PRECISION,
    "lengthCm" DOUBLE PRECISION,
    "bodyScore" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PetMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetHealthRecord" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PetHealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetVetVisit" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vetName" TEXT,
    "clinic" TEXT,
    "reason" TEXT,
    "diagnosis" TEXT,
    "cost" DOUBLE PRECISION,
    "nextVisitAt" TIMESTAMP(3),
    "attachmentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PetVetVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetTreatment" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MEDICATION',
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "route" TEXT,
    "batch" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "recurring" TEXT,
    "lastDoneAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PetTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetCareTask" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "details" TEXT,
    "recurring" TEXT,
    "lastDoneAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PetCareTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetCareLog" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "careTaskId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'CUSTOM',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PetCareLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pet_ownerId_idx" ON "Pet"("ownerId");
CREATE INDEX "Pet_ownerTeamId_idx" ON "Pet"("ownerTeamId");
CREATE UNIQUE INDEX "PetShare_petId_userId_key" ON "PetShare"("petId", "userId");
CREATE UNIQUE INDEX "PetShare_petId_teamId_key" ON "PetShare"("petId", "teamId");
CREATE INDEX "PetShare_petId_idx" ON "PetShare"("petId");
CREATE INDEX "PetMeasurement_petId_date_idx" ON "PetMeasurement"("petId", "date");
CREATE INDEX "PetHealthRecord_petId_date_idx" ON "PetHealthRecord"("petId", "date");
CREATE INDEX "PetVetVisit_petId_date_idx" ON "PetVetVisit"("petId", "date");
CREATE INDEX "PetVetVisit_nextVisitAt_idx" ON "PetVetVisit"("nextVisitAt");
CREATE INDEX "PetTreatment_petId_idx" ON "PetTreatment"("petId");
CREATE INDEX "PetTreatment_nextDueAt_idx" ON "PetTreatment"("nextDueAt");
CREATE INDEX "PetCareTask_petId_idx" ON "PetCareTask"("petId");
CREATE INDEX "PetCareTask_nextDueAt_idx" ON "PetCareTask"("nextDueAt");
CREATE INDEX "PetCareLog_petId_occurredAt_idx" ON "PetCareLog"("petId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetShare" ADD CONSTRAINT "PetShare_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetShare" ADD CONSTRAINT "PetShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetShare" ADD CONSTRAINT "PetShare_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetMeasurement" ADD CONSTRAINT "PetMeasurement_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetHealthRecord" ADD CONSTRAINT "PetHealthRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetVetVisit" ADD CONSTRAINT "PetVetVisit_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetTreatment" ADD CONSTRAINT "PetTreatment_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetCareTask" ADD CONSTRAINT "PetCareTask_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetCareLog" ADD CONSTRAINT "PetCareLog_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetCareLog" ADD CONSTRAINT "PetCareLog_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "PetTreatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PetCareLog" ADD CONSTRAINT "PetCareLog_careTaskId_fkey" FOREIGN KEY ("careTaskId") REFERENCES "PetCareTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Permissions seed for pets module ────────────────────────────────────────
INSERT INTO "Permission" ("id", "slug", "name", "description") VALUES
  (gen_random_uuid()::text, 'module.pets', 'Zwierzęta', 'Dostęp do modułu zarządzania zwierzętami')
ON CONFLICT ("slug") DO NOTHING;

-- ADMIN: grant module.pets
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'ADMIN', p."id"
FROM "Permission" p WHERE p."slug" = 'module.pets'
ON CONFLICT ("role", "permissionId") DO NOTHING;
