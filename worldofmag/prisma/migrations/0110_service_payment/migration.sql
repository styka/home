-- M9: płatność za zlecenie (kwota/metoda/status/faktura) + spięcie z Portfelem (opt-in).
CREATE TABLE "ServicePayment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "method" TEXT NOT NULL DEFAULT 'cash',
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "invoiceNo" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServicePayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServicePayment_requestId_key" ON "ServicePayment"("requestId");
ALTER TABLE "ServicePayment" ADD CONSTRAINT "ServicePayment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
