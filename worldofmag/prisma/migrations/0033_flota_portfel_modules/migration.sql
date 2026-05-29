-- ─── Moduły Flota i Portfel ─────────────────────────────────────────────────

-- CreateTable: Vehicle (Flota)
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "plate" TEXT,
    "vin" TEXT,
    "fuelType" TEXT NOT NULL DEFAULT 'petrol',
    "odometer" INTEGER NOT NULL DEFAULT 0,
    "inspectionDue" TIMESTAMP(3),
    "insuranceDue" TIMESTAMP(3),
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FuelLog
CREATE TABLE "FuelLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odometer" INTEGER NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION,
    "full" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ServiceRecord
CREATE TABLE "ServiceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odometer" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'other',
    "cost" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WalletElement (Portfel)
CREATE TABLE "WalletElement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'account',
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WalletElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WalletEntry (historia zmian salda)
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'adjustment',
    "category" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vehicle_ownerId_idx" ON "Vehicle"("ownerId");
CREATE INDEX "Vehicle_ownerTeamId_idx" ON "Vehicle"("ownerTeamId");
CREATE INDEX "FuelLog_vehicleId_date_idx" ON "FuelLog"("vehicleId", "date");
CREATE INDEX "ServiceRecord_vehicleId_date_idx" ON "ServiceRecord"("vehicleId", "date");
CREATE INDEX "WalletElement_ownerId_idx" ON "WalletElement"("ownerId");
CREATE INDEX "WalletElement_ownerTeamId_idx" ON "WalletElement"("ownerTeamId");
CREATE INDEX "WalletEntry_elementId_date_idx" ON "WalletEntry"("elementId", "date");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelLog" ADD CONSTRAINT "FuelLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletElement" ADD CONSTRAINT "WalletElement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletElement" ADD CONSTRAINT "WalletElement_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "WalletElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Permissions seed: moduły flota i portfel ────────────────────────────────
INSERT INTO "Permission" ("id", "slug", "name", "description") VALUES
  (gen_random_uuid()::text, 'module.flota', 'Flota', 'Dostęp do modułu zarządzania flotą pojazdów'),
  (gen_random_uuid()::text, 'module.portfel', 'Portfel', 'Dostęp do modułu zarządzania finansami/portfelem')
ON CONFLICT ("slug") DO NOTHING;

-- ADMIN: grant module.flota + module.portfel
INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'ADMIN', p."id"
FROM "Permission" p WHERE p."slug" IN ('module.flota', 'module.portfel')
ON CONFLICT ("role", "permissionId") DO NOTHING;
