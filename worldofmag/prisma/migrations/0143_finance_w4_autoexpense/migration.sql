-- W4: auto-księgowanie wydatków do Portfela (źródło wpisu + ustawienia per-user).
ALTER TABLE "WalletEntry" ADD COLUMN "sourceModule" TEXT;
ALTER TABLE "WalletEntry" ADD COLUMN "sourceId" TEXT;
CREATE INDEX "WalletEntry_sourceModule_sourceId_idx" ON "WalletEntry"("sourceModule", "sourceId");

CREATE TABLE "FinanceSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoExpenseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoExpenseElementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinanceSettings_userId_key" ON "FinanceSettings"("userId");
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "FinanceSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
