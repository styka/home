-- Magazynowanie 2.0 — rozbudowa Dom + Profesjonalny.
-- Rozszerza StorageItem (barcode, wartość, zdjęcie, ważność/gwarancja, dostawca),
-- StorageMovement (powiązanie z partią/dokumentem) oraz dokłada modele pro:
-- tryb (StorageSettings), dostawcy, partie/serie (FEFO), dokumenty PZ/WZ/faktura,
-- zamówienia do dostawców.

-- AlterTable: StorageItem
ALTER TABLE "StorageItem" ADD COLUMN "barcode" TEXT;
ALTER TABLE "StorageItem" ADD COLUMN "unitPrice" DOUBLE PRECISION;
ALTER TABLE "StorageItem" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "StorageItem" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "StorageItem" ADD COLUMN "warrantyUntil" TIMESTAMP(3);
ALTER TABLE "StorageItem" ADD COLUMN "supplierId" TEXT;

-- AlterTable: StorageMovement
ALTER TABLE "StorageMovement" ADD COLUMN "batchId" TEXT;
ALTER TABLE "StorageMovement" ADD COLUMN "documentId" TEXT;

-- CreateTable
CREATE TABLE "StorageSettings" (
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'home',
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StorageSettings_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "StorageSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StorageSupplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageBatch" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotNo" TEXT,
    "serialNo" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "StorageBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageDocument" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT,
    "supplierId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCost" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageDocumentLine" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "unitPrice" DOUBLE PRECISION,
    "lineTotal" DOUBLE PRECISION,
    CONSTRAINT "StorageDocumentLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoragePurchaseOrder" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "draftText" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoragePurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoragePurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    CONSTRAINT "StoragePurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorageItem_barcode_idx" ON "StorageItem"("barcode");
CREATE INDEX "StorageItem_supplierId_idx" ON "StorageItem"("supplierId");
CREATE INDEX "StorageSupplier_ownerId_idx" ON "StorageSupplier"("ownerId");
CREATE INDEX "StorageSupplier_ownerTeamId_idx" ON "StorageSupplier"("ownerTeamId");
CREATE INDEX "StorageBatch_itemId_idx" ON "StorageBatch"("itemId");
CREATE INDEX "StorageBatch_expiresAt_idx" ON "StorageBatch"("expiresAt");
CREATE INDEX "StorageDocument_ownerId_idx" ON "StorageDocument"("ownerId");
CREATE INDEX "StorageDocument_ownerTeamId_idx" ON "StorageDocument"("ownerTeamId");
CREATE INDEX "StorageDocument_supplierId_idx" ON "StorageDocument"("supplierId");
CREATE INDEX "StorageDocumentLine_documentId_idx" ON "StorageDocumentLine"("documentId");
CREATE INDEX "StoragePurchaseOrder_ownerId_idx" ON "StoragePurchaseOrder"("ownerId");
CREATE INDEX "StoragePurchaseOrder_ownerTeamId_idx" ON "StoragePurchaseOrder"("ownerTeamId");
CREATE INDEX "StoragePurchaseOrder_supplierId_idx" ON "StoragePurchaseOrder"("supplierId");
CREATE INDEX "StoragePurchaseOrderLine_orderId_idx" ON "StoragePurchaseOrderLine"("orderId");

-- AddForeignKey
ALTER TABLE "StorageItem" ADD CONSTRAINT "StorageItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "StorageSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StorageSettings" ADD CONSTRAINT "StorageSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageSupplier" ADD CONSTRAINT "StorageSupplier_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageSupplier" ADD CONSTRAINT "StorageSupplier_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageBatch" ADD CONSTRAINT "StorageBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StorageItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageDocument" ADD CONSTRAINT "StorageDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageDocument" ADD CONSTRAINT "StorageDocument_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageDocument" ADD CONSTRAINT "StorageDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "StorageSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StorageDocumentLine" ADD CONSTRAINT "StorageDocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StorageDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoragePurchaseOrder" ADD CONSTRAINT "StoragePurchaseOrder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoragePurchaseOrder" ADD CONSTRAINT "StoragePurchaseOrder_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoragePurchaseOrder" ADD CONSTRAINT "StoragePurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "StorageSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoragePurchaseOrderLine" ADD CONSTRAINT "StoragePurchaseOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoragePurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
