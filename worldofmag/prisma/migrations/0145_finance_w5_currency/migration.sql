-- W5: waluta sprawozdawcza + kursy walut (per-user).
ALTER TABLE "FinanceSettings" ADD COLUMN "baseCurrency" TEXT NOT NULL DEFAULT 'PLN';

CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExchangeRate_userId_currency_key" ON "ExchangeRate"("userId", "currency");
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
