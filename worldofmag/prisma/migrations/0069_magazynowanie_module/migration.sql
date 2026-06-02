-- Moduł Magazynowanie (Storage / Inventory).
-- Ogólny magazyn dla domu/firmy/gospodarstwa (garaż, strych, szafy), a także
-- magazyny firmowe/sklepowe/hurtownie i obieg kurierski. W odróżnieniu od
-- kuchennej spiżarni: brak dat ważności, za to SKU, magazyn nadrzędny (warehouse)
-- oraz dziennik ruchów (przyjęcie/wydanie/korekta/spis).

-- CreateTable
CREATE TABLE "StorageItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "warehouse" TEXT,
    "location" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "minQuantity" DOUBLE PRECISION,
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StorageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorageItem_ownerId_idx" ON "StorageItem"("ownerId");
CREATE INDEX "StorageItem_ownerTeamId_idx" ON "StorageItem"("ownerTeamId");
CREATE INDEX "StorageItem_warehouse_idx" ON "StorageItem"("warehouse");
CREATE INDEX "StorageItem_sku_idx" ON "StorageItem"("sku");
CREATE INDEX "StorageMovement_itemId_createdAt_idx" ON "StorageMovement"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "StorageItem" ADD CONSTRAINT "StorageItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageItem" ADD CONSTRAINT "StorageItem_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageMovement" ADD CONSTRAINT "StorageMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StorageItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permission seed (idempotentne; migrate.js też to robi, ale trzymamy razem z tabelami)
INSERT INTO "Permission" ("id", "slug", "name", "description") VALUES
  (gen_random_uuid()::text, 'module.magazynowanie', 'Magazynowanie', 'Dostęp do modułu magazynowania/inwentaryzacji (dom, firma, magazyny)')
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT gen_random_uuid()::text, 'ADMIN', p."id"
FROM "Permission" p WHERE p."slug" = 'module.magazynowanie'
ON CONFLICT ("role", "permissionId") DO NOTHING;
