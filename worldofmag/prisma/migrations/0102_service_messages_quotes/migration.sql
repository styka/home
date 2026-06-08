-- Marketplace Etap A: M1 czat (ServiceMessage) + M3 wyceny (ServiceQuote).
CREATE TABLE "ServiceMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceMessage_requestId_createdAt_idx" ON "ServiceMessage"("requestId", "createdAt");
ALTER TABLE "ServiceMessage" ADD CONSTRAINT "ServiceMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceMessage" ADD CONSTRAINT "ServiceMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ServiceQuote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceQuote_requestId_createdAt_idx" ON "ServiceQuote"("requestId", "createdAt");
ALTER TABLE "ServiceQuote" ADD CONSTRAINT "ServiceQuote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceQuote" ADD CONSTRAINT "ServiceQuote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
