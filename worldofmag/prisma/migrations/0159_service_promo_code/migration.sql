-- M16: kody rabatowe wykonawcy + rabat na platnosci.
ALTER TABLE "ServicePayment" ADD COLUMN "promoCode" TEXT;
ALTER TABLE "ServicePayment" ADD COLUMN "discount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ServicePromoCode" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'percent',
    "value" INTEGER NOT NULL,
    "minAmount" INTEGER,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServicePromoCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServicePromoCode_providerId_code_key" ON "ServicePromoCode"("providerId", "code");
CREATE INDEX "ServicePromoCode_providerId_idx" ON "ServicePromoCode"("providerId");
ALTER TABLE "ServicePromoCode" ADD CONSTRAINT "ServicePromoCode_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
