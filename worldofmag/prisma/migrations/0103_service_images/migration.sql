-- Marketplace Etap A: M4 portfolio zdjęć wykonawcy.
CREATE TABLE "ServiceImage" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceImage_providerId_order_idx" ON "ServiceImage"("providerId", "order");
ALTER TABLE "ServiceImage" ADD CONSTRAINT "ServiceImage_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
